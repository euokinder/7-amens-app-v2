// Email-only identification is intentional for this validation release.
// No privileged key or database access is ever exposed to the browser.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// setemadrugadas.com.br é a produção; 7-amens-app-v2 é onde se valida antes de
// promover. Domínio fora desta lista é recusado antes de chegar no banco, então
// esquecer um endereço aqui derruba o login inteiro naquele endereço.
const allowedOrigin = 'https://setemadrugadas.com.br';
const allowedOrigins = new Set([
  'https://setemadrugadas.com.br',
  'https://www.setemadrugadas.com.br',
  'https://7-amens-app-v2.netlify.app',
  // O endereço antigo do projeto de produção continua respondendo e é o link
  // que a Netlify mostra no painel. Sem ele aqui, quem abrisse por ali via o
  // app travar em "confira sua conexão" com a conexão perfeita.
  'https://7madrugadas.netlify.app',
]);
// Qualquer prefixo antes de --<projeto>: cobre branch, deploy preview e também
// o link permanente de cada deploy (<id>--7madrugadas.netlify.app).
const allowedNetlifyPreview = /^https:\/\/[a-z0-9][a-z0-9-]*--(?:7-amens-app-v2|7madrugadas)\.netlify\.app$/;
const allowedLocalOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const lifetime = 90 * 24 * 60 * 60 * 1000;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');
async function db(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method, headers: { apikey: secret, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Database operation failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
// O banco devolve no máximo uma página por consulta, e esse teto é do servidor:
// pedir um limite maior não traz mais linhas, ele corta em silêncio. Quem lê só
// a primeira página acha que viu tudo. Para os números do painel serem
// verdadeiros, o resumo precisa enxergar TODAS as clientes, então aqui as
// páginas são buscadas em sequência até a última.
const PAGINA = 1000;
// Trava de segurança: se uma consulta vier errada, isto impede uma varredura
// sem fim consumindo o banco.
const TETO_DE_LINHAS = 20000;
async function dbTodas(path: string) {
  // Mesmo tipo solto que db() já devolve: o código que consome estas linhas
  // declara o formato que espera em cada uso, e apertar aqui quebraria aquilo.
  // deno-lint-ignore no-explicit-any
  const todas: any[] = [];
  let passo = 0;
  while (todas.length < TETO_DE_LINHAS) {
    const pagina = await db(`${path}&limit=${PAGINA}&offset=${todas.length}`);
    if (!pagina.length) break;
    // A primeira página revela o teto real do servidor, que pode ser menor que
    // PAGINA. Sem guardar esse número, uma página cheia porém curta seria lida
    // como "acabaram as clientes" e o resumo voltaria a mentir.
    if (!passo) passo = pagina.length;
    todas.push(...pagina);
    if (pagina.length < passo) break;
  }
  return todas;
}
const eq = (value: string) => encodeURIComponent(value);
async function access(customerId: string) {
  const rows = await db(`entitlements?customer_id=eq.${customerId}&status=eq.active&select=product_key`);
  return rows.map((row: {product_key: string}) => row.product_key);
}
const isAdmin = async (customerId: string) =>
  (await db(`member_admins?customer_id=eq.${customerId}&select=customer_id&limit=1`)).length > 0;
// Every manual change to access is recorded: more than one operator can grant
// and revoke, so "who did this" has to be answerable.
const audit = (adminId: string, action: string, targetId: string | null, targetEmail: string, details: unknown) =>
  db('admin_actions', 'POST', { admin_customer_id: adminId, action, target_customer_id: targetId, target_email: targetEmail, details });
const validEmail = (value: unknown) => {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '';
};
// O dia de hoje na conta de Brasília, no formato "2026-09-20".
//
// Quem decide que dia é hoje é o servidor, NUNCA o celular da cliente. Relógio
// torto, fuso de viagem ou aparelho com a data errada não podem adiantar nem
// atrasar a madrugada dela. Em UTC o dia viraria às 21h de Brasília — três
// horas adiantado — e quem rezasse às 22h já encontraria a oração de amanhã
// aberta. 'en-CA' é o truque que entrega o formato do banco sem precisar
// montar a data pedaço por pedaço.
const hojeEmBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

async function snapshot(customer: { id: string; email: string; name: string }, products: string[], includeCampaigns = false) {
  const [progress, catalog, offers, surveys, admin, primeiraVisita] = await Promise.all([
    db(`prayer_progress?customer_id=eq.${customer.id}&select=prayer_key,completed,updated_at`),
    db('products?enabled=eq.true&select=key,title,description,checkout_url,content_url&order=sort_order.asc'),
    includeCampaigns ? db('rpc/claim_member_offer', 'POST', { p_customer_id: customer.id, p_trigger_type: 'entry', p_source_campaign_key: null }) : Promise.resolve([]),
    includeCampaigns ? db('rpc/claim_member_survey', 'POST', { p_customer_id: customer.id }) : Promise.resolve([]),
    // Só um sinal para a tela: quem não é administradora nem deve ver o painel
    // abrir. A tranca de verdade continua sendo a checagem de cada ação aqui.
    includeCampaigns ? isAdmin(customer.id) : Promise.resolve(false),
    // A TRAVA DAS MADRUGADAS: o primeiro dia em que ela pisou no app é a
    // âncora da jornada — o Dia 1 é nesse dia, o Dia 2 na meia-noite seguinte.
    // Vai em TODO snapshot, não só na verificação de sessão: se sumisse na
    // resposta de "salvar progresso", a tela redesenharia com as sete abertas
    // no instante em que ela marca uma oração como concluída.
    // Custo: uma leitura direta na chave primária (customer_id, visited_on),
    // devolvendo uma linha. É das consultas mais baratas que existem aqui.
    db(`member_visit_days?customer_id=eq.${customer.id}&select=visited_on&order=visited_on.asc&limit=1`),
  ]);
  // `primeiroAcesso` vem vazio na primeiríssima verificação de sessão de uma
  // cliente nova: a gravação do dia de visita acontece na mesma leva de
  // consultas e pode chegar depois desta. Não é problema — sem âncora, o
  // js/trava.js usa `hoje`, que é exatamente o dia em que ela está entrando.
  return { customer: { email: customer.email, name: customer.name }, products, progress, catalog, offer: offers[0] || null, survey: surveys[0] || null, admin, hoje: hojeEmBrasilia(), primeiroAcesso: primeiraVisita[0]?.visited_on || null };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-member-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const originAllowed = !origin || allowedOrigins.has(origin) || allowedNetlifyPreview.test(origin) || allowedLocalOrigin.test(origin);
  if (!originAllowed) return respond({ error: 'Origem não permitida.' }, 403);
  if (origin) cors['Access-Control-Allow-Origin'] = origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 4096) return respond({ error: 'Solicitação inválida.' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return respond({ error: 'Solicitação inválida.' }, 400); }
    if (!body || typeof body !== 'object') return respond({ error: 'Solicitação inválida.' }, 400);
    if (body.action === 'login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'Confira seu e-mail e tente novamente.' }, 400);
      // Contar só por endereço de internet barra cliente inocente: operadora de
      // celular põe muita gente atrás do mesmo IP. A conta é por pessoa (e-mail)
      // dentro do endereço, então uma vizinha de operadora nunca trava a outra.
      const rateKey = await hash(`login:${req.headers.get('x-forwarded-for')?.split(',')[0] || ''}|${email}`);
      const permitted = await db('rpc/allow_member_login', 'POST', { bucket_key: rateKey });
      if (!permitted) return respond({ error: 'Muitas tentativas seguidas com este e-mail. Aguarde um minutinho e tente de novo.' }, 429);
      const customers = await db(`customers?email=eq.${eq(email)}&select=id,email,name&limit=1`);
      const customer = customers[0];
      const products = customer ? await access(customer.id) : [];
      if (!products.includes('principal')) return respond({ error: 'Não encontramos um acesso ativo para esse e-mail. Confira o e-mail da compra ou fale conosco.' }, 403);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await db('member_sessions', 'POST', { token_hash: await hash(token), customer_id: customer.id, expires_at: new Date(Date.now() + lifetime).toISOString() });
      return respond({ token, ...await snapshot(customer, products) });
    }
    const token = req.headers.get('x-member-session') || '';
    if (!/^[a-f0-9-]{72}$/.test(token)) return respond({ error: 'Entre novamente com seu e-mail.' }, 401);
    const tokenHash = await hash(token);
    const sessions = await db(`member_sessions?token_hash=eq.${tokenHash}&expires_at=gt.${eq(new Date().toISOString())}&select=customer_id&limit=1`);
    if (!sessions.length) return respond({ error: 'Entre novamente com seu e-mail.' }, 401);
    const customerId = sessions[0].customer_id;
    if (body.action === 'logout') {
      await db(`member_sessions?token_hash=eq.${tokenHash}`, 'DELETE');
      return respond({ ok: true });
    }
    const products = await access(customerId);
    if (!products.includes('principal')) return respond({ error: 'Seu acesso não está ativo. Fale conosco para receber ajuda.' }, 403);
    if (body.action === 'progress') {
      if (typeof body.prayer_key !== 'string' || !/^(principal:[0-7]|desatadora:[1-9])$/.test(body.prayer_key) || typeof body.completed !== 'boolean') return respond({ error: 'Progresso inválido.' }, 400);
      await db('prayer_progress?on_conflict=customer_id,prayer_key', 'POST', { customer_id: customerId, prayer_key: body.prayer_key, completed: body.completed, updated_at: new Date().toISOString() });
    } else if (body.action === 'offer_event') {
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const event = typeof body.event === 'string' ? body.event : '';
      if (!/^[a-z0-9_-]+$/.test(campaignKey) || !['shown', 'clicked', 'dismissed'].includes(event)) return respond({ error: 'Evento inválido.' }, 400);
      const column = `${event}_at`;
      await db(`member_offer_events?customer_id=eq.${customerId}&campaign_key=eq.${eq(campaignKey)}`, 'PATCH', { [column]: new Date().toISOString() });
      return respond({ ok: true });
    } else if (body.action === 'offer_claim') {
      const triggerType = typeof body.trigger_type === 'string' ? body.trigger_type : '';
      const sourceCampaignKey = typeof body.source_campaign_key === 'string' ? body.source_campaign_key : '';
      if (triggerType !== 'dismissal' || !/^[a-z0-9_-]+$/.test(sourceCampaignKey)) return respond({ error: 'Oferta inválida.' }, 400);
      const offers = await db('rpc/claim_member_offer', 'POST', {
        p_customer_id: customerId,
        p_trigger_type: triggerType,
        p_source_campaign_key: sourceCampaignKey,
      });
      return respond({ offer: offers[0] || null });
    } else if (body.action === 'survey_event') {
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const event = typeof body.event === 'string' ? body.event : '';
      if (!/^[a-z0-9_-]+$/.test(campaignKey) || !['shown', 'started', 'dismissed'].includes(event)) return respond({ error: 'Evento inválido.' }, 400);
      const column = `${event}_at`;
      await db(`member_survey_events?customer_id=eq.${customerId}&campaign_key=eq.${eq(campaignKey)}`, 'PATCH', { [column]: new Date().toISOString() });
      return respond({ ok: true });
    } else if (body.action === 'survey_submit') {
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const answers = body.answers && typeof body.answers === 'object' ? body.answers : null;
      const allowed = {
        motherhood_status: ['mother','grandmother','mother_and_grandmother','neither'],
        relationship_status: ['married','relationship','single','widowed','prefer_not_to_say'],
        church_frequency: ['weekly','monthly','occasionally','not_attending_but_faithful','reconnecting'],
        primary_prayer_recipient: ['children','grandchildren','partner','whole_family','someone_in_difficulty','self'],
        primary_intention: ['family_protection','children_or_grandchildren','health_and_healing','marriage_or_relationship','finances_and_work','peace_and_anxiety','difficult_cause'],
        favorite_devotion: ['saint_michael','saint_benedict','our_lady','saint_joseph','saint_rita','saint_jude','sacred_heart_or_divine_mercy','no_specific_devotion'],
      } as const;
      if (!/^[a-z0-9_-]+$/.test(campaignKey) || !answers || Array.isArray(answers)) return respond({ error: 'Respostas inválidas.' }, 400);
      const responseValues: Record<string, string> = {};
      for (const [field, values] of Object.entries(allowed)) {
        if (!(values as readonly string[]).includes(String(answers[field]))) return respond({ error: 'Responda todas as perguntas para continuar.' }, 400);
        responseValues[field] = String(answers[field]);
      }
      const [event] = await db(`member_survey_events?customer_id=eq.${customerId}&campaign_key=eq.${eq(campaignKey)}&select=campaign_key&limit=1`);
      const [campaign] = event ? await db(`member_survey_campaigns?key=eq.${eq(campaignKey)}&select=survey_key&limit=1`) : [];
      if (!event || !campaign) return respond({ error: 'Esta pesquisa não está disponível.' }, 404);
      const now = new Date().toISOString();
      await db('member_survey_responses?on_conflict=customer_id,survey_key', 'POST', {
        customer_id: customerId,
        survey_key: campaign.survey_key,
        survey_version: 1,
        ...responseValues,
        completed_at: now,
        updated_at: now,
      });
      await db(`member_survey_events?customer_id=eq.${customerId}&campaign_key=eq.${eq(campaignKey)}`, 'PATCH', { completed_at: now });
      return respond({ ok: true });
    } else if (body.action === 'offer_preview') {
      // Mostra a campanha sempre, para revisar o desenho, sem gravar exibição
      // nem gastar uma das duas aparições reais da cliente.
      if (!await isAdmin(customerId)) return respond({ error: 'Acesso administrativo não autorizado.' }, 403);
      const wanted = typeof body.campaign_key === 'string' && /^[a-z0-9_-]+$/.test(body.campaign_key) ? body.campaign_key : '';
      const filtro = wanted ? `key=eq.${eq(wanted)}` : 'enabled=is.true&trigger_type=eq.entry';
      const [campaign] = await db(`member_offer_campaigns?${filtro}&target_url=not.is.null&select=key,headline,body,cta_label,target_url,offer_type,eyebrow,dismiss_label&order=sort_order.asc&limit=1`);
      if (!campaign) return respond({ offer: null });
      return respond({ offer: { campaign_key: campaign.key, ...campaign, preview: true } });
    } else if (body.action === 'admin_customer_detail') {
      if (!await isAdmin(customerId)) return respond({ error: 'Acesso administrativo não autorizado.' }, 403);
      const target = typeof body.customer_id === 'string' ? body.customer_id : '';
      if (!/^[0-9a-f-]{36}$/.test(target)) return respond({ error: 'Cliente inválida.' }, 400);
      const [profile] = await db(`admin_customer_overview?id=eq.${target}&select=*`);
      if (!profile) return respond({ error: 'Cliente não encontrada.' }, 404);
      // Hubla keys its events by e-mail, not by our customer id, and the address
      // may arrive in any case, so the match is deliberately case-insensitive.
      const address = String(profile.email || '');
      const [entitlements, progress, visits, offers, surveys, events, history] = await Promise.all([
        db(`entitlements?customer_id=eq.${target}&select=product_key,status,source,granted_at,revoked_at,updated_at&order=product_key.asc`),
        db(`prayer_progress?customer_id=eq.${target}&select=prayer_key,completed,updated_at&order=prayer_key.asc`),
        db(`member_visit_days?customer_id=eq.${target}&select=visited_on,first_seen_at,last_seen_at&order=visited_on.desc&limit=60`),
        db(`member_offer_events?customer_id=eq.${target}&select=campaign_key,claimed_at,shown_at,clicked_at,dismissed_at,converted_at&order=claimed_at.desc`),
        db(`member_survey_responses?customer_id=eq.${target}&select=*`),
        db(`hubla_events?payload->event->user->>email=ilike.${eq(address)}&select=event_type,processing_status,sandbox,received_at,payload&order=received_at.desc&limit=40`),
        db(`admin_actions?target_customer_id=eq.${target}&select=action,details,created_at&order=created_at.desc&limit=30`),
      ]);
      const hubla = events.map((row: Record<string, any>) => ({
        event_type: row.event_type, processing_status: row.processing_status, sandbox: row.sandbox,
        received_at: row.received_at, product: row.payload?.event?.product?.name || null,
        invoice_status: row.payload?.event?.invoice?.status || null,
      }));
      return respond({ customer: profile, entitlements, progress, visits, offers, survey: surveys[0] || null, hubla, history });
    } else if (body.action === 'admin_grant_access' || body.action === 'admin_revoke_access') {
      if (!await isAdmin(customerId)) return respond({ error: 'Acesso administrativo não autorizado.' }, 403);
      const granting = body.action === 'admin_grant_access';
      const productKey = typeof body.product_key === 'string' ? body.product_key : '';
      if (!/^[a-z0-9_-]+$/.test(productKey)) return respond({ error: 'Produto inválido.' }, 400);
      const [product] = await db(`products?key=eq.${eq(productKey)}&select=key,title`);
      if (!product) return respond({ error: 'Produto não encontrado.' }, 404);

      // Granting accepts an e-mail that is not in the base yet: this is how an
      // older buyer, or a courtesy, gets in without waiting for a Hubla event.
      let target = typeof body.customer_id === 'string' && /^[0-9a-f-]{36}$/.test(body.customer_id) ? body.customer_id : '';
      const address = validEmail(body.email);
      if (!target) {
        if (!address) return respond({ error: 'Informe um e-mail válido.' }, 400);
        const [found] = await db(`customers?email=eq.${eq(address)}&select=id`);
        if (found) target = found.id;
        else if (granting) {
          const [created] = await db('customers', 'POST', { email: address, name: typeof body.name === 'string' ? body.name.trim() : '' });
          target = created.id;
        } else return respond({ error: 'Cliente não encontrada.' }, 404);
      }

      const stamp = new Date().toISOString();
      const [existing] = await db(`entitlements?customer_id=eq.${target}&product_key=eq.${eq(productKey)}&select=product_key`);
      const fields = granting
        ? { status: 'active', source: 'manual', granted_at: stamp, revoked_at: null, updated_at: stamp }
        : { status: 'revoked', revoked_at: stamp, updated_at: stamp };
      if (existing) await db(`entitlements?customer_id=eq.${target}&product_key=eq.${eq(productKey)}`, 'PATCH', fields);
      else if (granting) await db('entitlements', 'POST', { customer_id: target, product_key: productKey, ...fields });
      else return respond({ error: 'Esta cliente não possui esse produto.' }, 404);

      await audit(customerId, granting ? 'grant_access' : 'revoke_access', target, address, { product_key: productKey, product_title: product.title });
      return respond({ ok: true, customer_id: target });
    } else if (body.action === 'admin_update_email') {
      if (!await isAdmin(customerId)) return respond({ error: 'Acesso administrativo não autorizado.' }, 403);
      const target = typeof body.customer_id === 'string' ? body.customer_id : '';
      const address = validEmail(body.email);
      if (!/^[0-9a-f-]{36}$/.test(target)) return respond({ error: 'Cliente inválida.' }, 400);
      if (!address) return respond({ error: 'Informe um e-mail válido.' }, 400);
      const [current] = await db(`customers?id=eq.${target}&select=email`);
      if (!current) return respond({ error: 'Cliente não encontrada.' }, 404);
      const [taken] = await db(`customers?email=eq.${eq(address)}&select=id`);
      if (taken && taken.id !== target) return respond({ error: 'Já existe uma cliente com esse e-mail.' }, 409);
      await db(`customers?id=eq.${target}`, 'PATCH', { email: address });
      // The e-mail is the login, so open sessions must not survive the change.
      await db(`member_sessions?customer_id=eq.${target}`, 'DELETE');
      await audit(customerId, 'update_email', target, address, { from: current.email, to: address });
      return respond({ ok: true });
    } else if (body.action === 'admin_dashboard') {
      const admins = await db(`member_admins?customer_id=eq.${customerId}&select=customer_id&limit=1`);
      if (!admins.length) return respond({ error: 'Acesso administrativo não autorizado.' }, 403);
      // The catalogue here is deliberately unfiltered: a product disabled in the
      // app still has to be grantable by hand from the panel.
      // Aqui vai a lista COMPLETA, não a primeira página: os quatro números do
      // topo do painel são somados a partir dela, e a busca por nome/e-mail
      // acontece no navegador em cima do que chegou. Cortar esta lista faz o
      // painel esconder as clientes mais antigas e ainda exibir totais errados
      // como se fossem os de verdade — foi o que aconteceu ao travar em 500.
      // O desempate por id é obrigatório: sem ele, duas clientes cadastradas no
      // mesmo instante podem pular ou repetir na virada de uma página para a
      // outra.
      const [customers, campaigns, catalogue] = await Promise.all([
        dbTodas('admin_customer_overview?select=*&order=created_at.desc,id.desc'),
        db('admin_offer_overview?select=*&order=sort_order.asc'),
        db('products?select=key,title,type,billing_type,enabled&order=sort_order.asc'),
      ]);
      // A visão que separa Pix de cartão é nova. Se o banco ainda não recebeu
      // o metricas-do-funil.sql, ela simplesmente não existe — e o painel
      // inteiro não pode cair por causa de um número a mais. Sem ela, esse
      // bloco some da tela e todo o resto continua de pé.
      const payments = await db('admin_payment_overview?select=*').catch(() => []);

      // Os números do funil saem da lista que já foi carregada acima: nenhuma
      // consulta a mais ao banco, nenhum custo novo por abrir o painel.
      const temProduto = (customer: { active_products: string[] | null }, key: string) =>
        Array.isArray(customer.active_products) && customer.active_products.includes(key);
      const frontBuyers = customers.filter((customer: { active_products: string[] | null }) => temProduto(customer, 'principal'));

      // "Compraram o upsell" esconde que são TRÊS produtos diferentes, e some
      // com dois deles. O painel precisa dizer QUAL. A lista sai do catálogo,
      // nunca escrita à mão: o catálogo vai crescer (novenas, jornadas de 21 e
      // 30 dias) e um número cravado no código pararia de contar sozinho.
      const addons = catalogue.filter((product: { type: string }) => product.type === 'addon');
      const byProduct = addons.map((product: { key: string; title: string }) => ({
        key: product.key,
        title: product.title,
        buyers: frontBuyers.filter((customer: { active_products: string[] | null }) => temProduto(customer, product.key)).length,
      }));

      // A ESCADA. De quem tem o extra N, quantas tem o N+1.
      // A base de cada degrau e o degrau ANTERIOR, nunca o total: e isso que
      // separa "28,6% de quem levou o UP01" de "4,4% de todas as clientes".
      // E a base do terceiro degrau sao TODAS as donas do UP02, nao so as que
      // tambem tem UP01 - foi essa a pergunta feita.
      const codigo = (key: string) => key.replace(/^upsell_0?/, 'UP0').toUpperCase();
      const donasDe = (key: string) =>
        frontBuyers.filter((customer: { active_products: string[] | null }) => temProduto(customer, key));

      const steps = addons.map((produto: { key: string }, i: number) => {
        const anterior = i === 0
          ? { rotulo: 'o principal', pessoas: frontBuyers }
          : { rotulo: codigo(addons[i - 1].key), pessoas: donasDe(addons[i - 1].key) };
        return {
          de: anterior.rotulo,
          para: codigo(produto.key),
          base: anterior.pessoas.length,
          n: anterior.pessoas.filter((customer: { active_products: string[] | null }) => temProduto(customer, produto.key)).length,
        };
      });

      // Quem tem um extra sem ter o anterior. Se isto for zero, a esteira esta
      // sendo seguida na ordem; se nao for, o extra vende sozinho - e isso muda
      // onde a oferta deve ser colocada.
      const outOfOrder = addons.slice(1).map((produto: { key: string }, i: number) => ({
        produto: codigo(produto.key),
        semOAnterior: codigo(addons[i].key),
        pessoas: frontBuyers.filter((customer: { active_products: string[] | null }) =>
          temProduto(customer, produto.key) && !temProduto(customer, addons[i].key)).length,
      }));

      const somaCampanhas = (campo: string) =>
        campaigns.reduce((total: number, campaign: Record<string, number>) => total + (campaign[campo] || 0), 0);

      return respond({
        products: catalogue,
        summary: {
          customers: customers.length,
          activeCustomers: customers.filter((customer: { funnel_stage: string }) => customer.funnel_stage !== 'sem_acesso_ativo').length,
          completedProfiles: customers.filter((customer: { profile_completed_at: string | null }) => Boolean(customer.profile_completed_at)).length,
          completedPrayers: customers.reduce((total: number, customer: { completed_prayers: number }) => total + customer.completed_prayers, 0),
        },
        funnel: {
          base: frontBuyers.length,
          frontBuyers: frontBuyers.length,
          steps,
          outOfOrder,
          anyAddonBuyers: frontBuyers.filter((customer: { active_products: string[] | null }) =>
            addons.some((product: { key: string }) => temProduto(customer, product.key))).length,
          byProduct,
          enteredApp: frontBuyers.filter((customer: { distinct_visit_days: number }) => (customer.distinct_visit_days || 0) > 0).length,
          offerShown: somaCampanhas('shown'),
          offerClicked: somaCampanhas('clicked'),
          offerConverted: somaCampanhas('converted'),
          byPaymentMethod: payments,
        },
        customers,
        campaigns,
      });
    } else if (body.action !== 'session') return respond({ error: 'Ação inválida.' }, 400);
    const [customer] = await db(`customers?id=eq.${customerId}&select=id,email,name`);
    return respond(await snapshot(customer, products, body.action === 'session'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Member API error');
    return respond({ error: 'Não foi possível conectar agora. Tente novamente em instantes.' }, 503);
  }
});
