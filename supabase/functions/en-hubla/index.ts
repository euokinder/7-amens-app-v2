// en-hubla: o aviso (webhook) da HUBLA para o app em inglês
// (7 Amens Before Dawn, setemadrugadas.com.br/en). 19/11/2026.
//
// Em 19/11/2026 os Arcanjos do app em inglês passaram a ser vendidos pela
// Hubla, em dólar (/en-offer-archangels: 3 ofertas do produto "Protection of
// the Four Archangels"). Esta função faz para a Hubla o que a en-digistore faz
// para a Digistore24, com as MESMAS regras:
//   - produto conhecido = está na tabela en_hubla_products (14-hubla.sql).
//     Nada é reconhecido pelo nome. Código desconhecido = needs_review, NADA
//     é liberado;
//   - todo produto conhecido libera o app por 12 meses, "ativo até a data
//     mais longe" (comprar de novo nunca encurta); Arcanjos e Cântico também
//     liberam o extra;
//   - reembolso, disputa e "acesso removido" SÓ REGISTRAM (a regra do app em
//     inglês, copiada do espanhol). Tirar é o "Remove" do /en-admin;
//   - repetição não duplica nada (a chave é o x-hubla-idempotency);
//   - a origem em en_access é 'checkout' (a venda), como na Digistore.
//
// ⛔ SEPARADA DO BRASIL: esta função NÃO lê nem escreve nada do Brasil
// (customers, entitlements, hubla_events, hubla_product_map). Ela recebe de
// uma integração de webhook PRÓPRIA na Hubla, com outro token (o segredo
// EN_HUBLA_WEBHOOK_TOKEN; cada integração da Hubla tem o seu). A hubla-webhook
// do Brasil continua como estava.
//
// Quando libera:
//   customer.member_added       (a Hubla deu o acesso: compra paga ou
//                                assinatura grátis dada pela equipe)
//   invoice.payment_succeeded   (fatura paga: a "compra aprovada" da
//                                documentação). As duas, porque a Hubla não
//                                manda member_added para quem já tem uma
//                                assinatura ativa da mesma oferta (comprar de
//                                novo), e não garante a ordem. Liberar duas
//                                vezes não muda nada.
// Todo o resto: só registra.
//
// Fonte: a documentação oficial (hubla.gitbook.io/docs/webhooks, lida em
// 19/11/2026) e dois avisos reais deste produto (19/11):
//   - cabeçalhos x-hubla-token, x-hubla-sandbox ("true"/"false"),
//     x-hubla-idempotency (o mesmo nas novas tentativas e no reenvio);
//   - a Hubla só repete quando a resposta é 5xx ou demora mais de 30 s
//     (4xx NÃO repete). Por isso erro do banco devolve 500;
//   - event.user.email (quem comprou), event.product.id (o produto),
//     event.products[].offers[].id (a oferta), event.invoice.id,
//     event.invoice.amount.totalCents, event.invoice.currency,
//     event.invoice.subscriptionId, event.subscription.id/.type, e as
//     etiquetas em event.invoice.paymentSession.utm ou
//     event.subscription.firstPaymentSession.utm.
//
// DADO PESSOAL, o mínimo: e-mail e nome vão só para en_customers (o login
// dela). A linha do aviso leva o customer_id; o corpo do aviso não é guardado.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// O banco de TESTE (o mesmo do localhost; ninguém de verdade dentro).
const BANCO_DE_TESTE = base.includes('wyiqwsgfictcfkytldnu');
// Só no banco de TESTE, e só enquanto o token de verdade não estiver lá, vale
// um token de ensaio: ele está escrito aqui, num repositório público, e por
// isso nunca vale na produção.
const TOKEN_DE_ENSAIO = 'hubla_ensaio_somente_no_banco_de_teste_en';
const hublaToken = (Deno.env.get('EN_HUBLA_WEBHOOK_TOKEN') || (BANCO_DE_TESTE ? TOKEN_DE_ENSAIO : '')).trim();

const EXTRAS = new Set(['arcangeles', 'cantico']);
const ACCESS_DAYS = 365;
const LIBERA = new Set(['customer.member_added', 'invoice.payment_succeeded']);

// A Hubla espera a resposta em até 30 s. Cada tentativa no banco tem 4 s.
const RETRIABLE = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
const TEMPO_POR_TENTATIVA_MS = 4000;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const excerpt = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 200);

async function db(path: string, method = 'GET', body?: unknown, prefer = 'return=representation') {
  let lastError: Error & { status?: number } = new Error(`Database call never ran on ${path}`);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await wait(attempt * 400);
    let response: Response;
    try {
      response = await fetch(`${base}/rest/v1/${path}`, {
        method,
        headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: prefer },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TEMPO_POR_TENTATIVA_MS),
      });
    } catch (networkError) {
      lastError = new Error(`Database unreachable on ${path.split('?')[0]}: ${networkError instanceof Error ? networkError.message : 'erro de rede'}`);
      continue;
    }
    if (response.ok) {
      const answer = await response.text();
      return answer ? JSON.parse(answer) : null;
    }
    const detail = excerpt(await response.text().catch(() => ''));
    lastError = new Error(`Database operation failed (${response.status}) on ${path.split('?')[0]}${detail ? `: ${detail}` : ''}`);
    lastError.status = response.status;
    if (!RETRIABLE.has(response.status)) throw lastError;
  }
  throw lastError;
}

// deno-lint-ignore no-explicit-any
type Json = any;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const eq = (value: string) => encodeURIComponent(value);
const now = () => new Date().toISOString();
const isConflict = (error: unknown) => (error as { status?: number })?.status === 409;
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const CODIGO = /^[A-Za-z0-9_-]{1,60}$/;
// O utm como veio, com uma limpeza: qualquer e-mail colado num link.
function tracked(value: unknown) {
  const cleaned = text(value).replace(/[^\s@|:]+@[^\s@|:]+\.[^\s@|:]+/g, '[e-mail]').trim().slice(0, 300);
  return cleaned || null;
}

function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

// ------------------------------------------------------------ os produtos
// Todos os códigos do aviso: o produto (event.product.id) e, na lista
// event.products, o produto e cada oferta. Quem decide o que é nosso é a
// tabela en_hubla_products.
export function codigosDo(event: Json) {
  const codigos: { id: string; nome: string }[] = [];
  const add = (id: unknown, nome: unknown) => {
    const codigo = text(id);
    if (!CODIGO.test(codigo) || codigos.some(item => item.id === codigo)) return;
    codigos.push({ id: codigo, nome: text(nome).slice(0, 120) });
  };
  add(event?.product?.id, event?.product?.name);
  for (const product of Array.isArray(event?.products) ? event.products : []) {
    add(product?.id, product?.name);
    for (const offer of Array.isArray(product?.offers) ? product.offers : []) add(offer?.id, offer?.name);
  }
  return codigos;
}

async function produtosDe(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const linhas = await db(`en_hubla_products?hubla_id=in.(${ids.map(eq).join(',')})&select=hubla_id,produto`);
  return new Map<string, string>((linhas || []).map((l: { hubla_id: string; produto: string }) => [String(l.hubla_id), String(l.produto)]));
}

// ------------------------------------------------------------ a liberação
// CÓPIA da en-digistore (ensureCustomer, grantApp, grantExtra). Se mudar lá,
// mudar aqui.
async function ensureCustomer(address: string, rawName: string) {
  const name = rawName.replace(/\s+/g, ' ').trim();
  const cleanName = name.includes('@') ? '' : name.slice(0, 120);
  const find = async () => (await db(`en_customers?email=eq.${eq(address)}&select=id,name&limit=1`))[0] || null;
  const existing = await find();
  if (existing) {
    if (cleanName && !text(existing.name)) {
      try { await db(`en_customers?id=eq.${existing.id}`, 'PATCH', { name: cleanName }, 'return=minimal'); } catch { /* segue */ }
    }
    return existing.id as string;
  }
  try {
    const [created] = await db('en_customers', 'POST', { email: address, ...(cleanName ? { name: cleanName } : {}) });
    return created.id as string;
  } catch (erro) {
    if (isConflict(erro)) {
      const winner = await find();
      if (winner) return winner.id as string;
    }
    throw erro;
  }
}

async function grantApp(customerId: string) {
  const until = new Date(Date.now() + ACCESS_DAYS * 86_400_000).toISOString();
  const path = `en_access?customer_id=eq.${customerId}&product=eq.app`;
  const [existing] = await db(`${path}&select=status,expires_at`);
  const stamp = now();
  if (existing) {
    if (existing.status === 'active' && (!existing.expires_at || Date.parse(existing.expires_at) >= Date.parse(until))) {
      return existing.expires_at ? `já tinha acesso até ${String(existing.expires_at).slice(0, 10)}` : 'já tinha acesso sem prazo';
    }
    const furthest = existing.expires_at && Date.parse(existing.expires_at) > Date.parse(until) ? existing.expires_at : until;
    await db(path, 'PATCH', { status: 'active', expires_at: furthest, granted_at: stamp, revoked_at: null, updated_at: stamp }, 'return=minimal');
    return `acesso até ${String(furthest).slice(0, 10)}`;
  }
  try {
    await db('en_access', 'POST', {
      customer_id: customerId, product: 'app', status: 'active', source: 'checkout',
      expires_at: until, granted_at: stamp, updated_at: stamp,
    }, 'return=minimal');
  } catch (erro) {
    if (!isConflict(erro)) throw erro;
    return 'liberado no mesmo instante por outro caminho';
  }
  return `acesso até ${until.slice(0, 10)}`;
}

async function grantExtra(customerId: string, product: string) {
  const path = `en_access?customer_id=eq.${customerId}&product=eq.${product}`;
  const [existing] = await db(`${path}&select=status`);
  const stamp = now();
  if (existing) {
    if (existing.status === 'active') return `${product} já estava liberado`;
    await db(path, 'PATCH', { status: 'active', expires_at: null, granted_at: stamp, revoked_at: null, updated_at: stamp }, 'return=minimal');
    return `${product} liberado de novo`;
  }
  try {
    await db('en_access', 'POST', {
      customer_id: customerId, product, status: 'active', source: 'checkout',
      expires_at: null, granted_at: stamp, updated_at: stamp,
    }, 'return=minimal');
  } catch (erro) {
    if (!isConflict(erro)) throw erro;
    return `${product} liberado no mesmo instante por outro caminho`;
  }
  return `${product} liberado`;
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
  if (!sameToken(text(req.headers.get('x-hubla-token')), hublaToken)) {
    console.error('en-hubla token-recusado', JSON.stringify({ configurado: Boolean(hublaToken) }));
    return respond({ error: 'Não autorizado.' }, 401);
  }

  const raw = await req.text();
  if (raw.length > 512_000) return respond({ error: 'Aviso grande demais.' }, 413);
  let payload: Json;
  try { payload = JSON.parse(raw); } catch { return respond({ error: 'JSON inválido.' }, 400); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return respond({ error: 'Aviso vazio.' }, 400);

  const eventType = (text(payload.type) || 'unknown').slice(0, 80);
  const event: Json = payload.event && typeof payload.event === 'object' ? payload.event : {};
  const sandbox = text(req.headers.get('x-hubla-sandbox')).toLowerCase() === 'true';
  const idempotencyKey = (text(req.headers.get('x-hubla-idempotency'))
    || Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
      .map(byte => byte.toString(16).padStart(2, '0')).join('')).slice(0, 200);

  const invoice: Json = event.invoice && typeof event.invoice === 'object' ? event.invoice : {};
  const subscription: Json = event.subscription && typeof event.subscription === 'object' ? event.subscription : {};
  const utm: Json = invoice?.paymentSession?.utm || subscription?.firstPaymentSession?.utm || {};
  const codigos = codigosDo(event);
  const notes: string[] = [];
  let status = 'recorded';

  try {
    const mapa = await produtosDe(codigos.map(item => item.id));
    const conhecidos = [...new Set(codigos.map(item => mapa.get(item.id)).filter((p): p is string => Boolean(p)))];

    if (!codigos.length) {
      status = LIBERA.has(eventType) ? 'needs_review' : 'recorded';
      if (LIBERA.has(eventType)) notes.push('Aviso sem código de produto: nada foi liberado.');
    } else if (!conhecidos.length) {
      status = LIBERA.has(eventType) ? 'needs_review' : 'recorded';
      notes.push(`Produto não cadastrado em en_hubla_products (${codigos.map(item => `${item.id} "${item.nome}"`).join(', ')}): nada foi liberado.`
        + (LIBERA.has(eventType) ? ' Se for do 7 Amens, cadastrar o código e reenviar o aviso pelo histórico da Hubla.' : ''));
    }
    // Teste de regra da Hubla (sandbox) na produção: registra, não libera.
    if (sandbox && !BANCO_DE_TESTE) {
      status = 'ignored';
      notes.unshift('Aviso de teste da Hubla (sandbox) na produção: nada foi liberado.');
    }

    // A liberação vem ANTES de gravar o aviso. Se ela falhar, a resposta 500
    // faz a Hubla tentar de novo.
    let customerId: string | null = null;
    if (LIBERA.has(eventType) && conhecidos.length && status !== 'ignored') {
      const address = text(event?.user?.email).toLowerCase();
      if (!validEmail(address)) {
        status = 'needs_review';
        notes.push('Aviso sem e-mail utilizável: o app NÃO foi liberado. Liberar à mão no /en-admin.');
      } else {
        customerId = await ensureCustomer(address, `${text(event?.user?.firstName)} ${text(event?.user?.lastName)}`);
        notes.push(`App: ${await grantApp(customerId)}.`);
        for (const produto of conhecidos) {
          if (EXTRAS.has(produto)) notes.push(`Extra: ${await grantExtra(customerId, produto)}.`);
        }
      }
    } else if (!LIBERA.has(eventType) && status === 'recorded') {
      notes.push('Só registro: reembolso, disputa e acesso removido não tiram o acesso (regra do app em inglês).');
    }

    const cents = Number(invoice?.amount?.totalCents);
    const record = {
      idempotency_key: idempotencyKey,
      event_type: eventType,
      sandbox,
      invoice_id: text(invoice.id).slice(0, 100) || null,
      subscription_id: (text(subscription.id) || text(invoice.subscriptionId)).slice(0, 100) || null,
      invoice_status: text(invoice.status).slice(0, 40) || null,
      subscription_type: text(subscription.type).slice(0, 40) || null,
      product_ids: codigos.map(item => item.id).join(',') || null,
      product_name: [...new Set(codigos.map(item => item.nome).filter(Boolean))].join(' + ').slice(0, 250) || null,
      produtos: conhecidos.length ? conhecidos : null,
      amount_cents: Number.isInteger(cents) && cents >= 0 && cents < 1e9 ? cents : null,
      currency: text(invoice.currency).toUpperCase().slice(0, 10) || null,
      utm_source: tracked(utm?.source),
      utm_medium: tracked(utm?.medium),
      utm_campaign: tracked(utm?.campaign),
      utm_content: tracked(utm?.content),
      utm_term: tracked(utm?.term),
      ...(customerId ? { customer_id: customerId } : {}),
      status,
      detail: (status === 'recorded' && customerId ? `Liberado: ${conhecidos.join(' + ')}. ` : '') + notes.join(' '),
    };

    // O on_conflict é obrigatório (lição da Payt). merge-duplicates: o
    // reenvio pelo histórico da Hubla (mesmo x-hubla-idempotency), depois de
    // cadastrar um código novo, atualiza a linha que tinha ficado needs_review.
    await db('en_hubla_events?on_conflict=idempotency_key', 'POST', record, 'return=minimal,resolution=merge-duplicates');
    console.log('en-hubla gravado', JSON.stringify({ evento: eventType, produtos: conhecidos, status, liberado: Boolean(customerId) }));
    return respond({ ok: true, status, liberado: Boolean(customerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    console.error('en-hubla EVENTO_NAO_GRAVADO', JSON.stringify({
      falha: message, evento: eventType, idempotencia: idempotencyKey, fatura: text(invoice.id) || null,
      produtos: codigos.map(item => item.id).join(',') || null,
    }));
    // 500: a Hubla tenta de novo (até 5 vezes) e o aviso fica no histórico.
    return respond({ error: 'Falha ao gravar o aviso.' }, 500);
  }
});
