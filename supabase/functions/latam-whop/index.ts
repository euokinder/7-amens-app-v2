// latam-whop: o aviso de venda da Whop que libera o app em espanhol.
//
// SEPARADA do Brasil de propósito (docs/app-es.md). Grava só tabelas latam_*:
// latam_whop_events, latam_customers e latam_access. Não lê nem escreve
// hubla_*, payt_*, customers ou entitlements.
//
// De onde vem a venda: a cliente paga no checkout da KashPay, que cobra pela
// Whop. A Whop manda "payment.succeeded" para cá (Standard Webhooks, api v1).
// ⚠️ A venda da KashPay chega SEM o código do produto (product_id nulo), e o
// código do preço (plan_) muda a cada checkout. Por isso a regra não é um
// mapa de produtos:
//   pagamento pago na empresa da LATAM = acesso ao app, por 12 meses.
// Exceção: produtos de OUTRA porta que moram na mesma empresa da Whop
// (PRODUTOS_DE_FORA) não liberam nada aqui.
//
// Reembolso e disputa NÃO tiram o acesso (decisão de 05/11/2026, a mesma da
// Payt): ficam só registrados. Tirar é à mão (latam_access.status = revoked).
//
// Só o aviso REAL confirma um campo (a lição da Hubla). Por isso o aviso
// inteiro fica guardado em latam_whop_events, e o que não der para liberar
// fica "needs_review", nunca vira acesso adivinhado.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// O banco de TESTE (o mesmo do localhost; ninguém de verdade dentro).
const BANCO_DE_TESTE = base.includes('wyiqwsgfictcfkytldnu');
// O segredo que a Whop mostra ao criar o webhook (começa com "ws_"). Nome
// próprio da LATAM, para nunca se confundir com o segredo de outra porta.
// Só no banco de TESTE, e só enquanto o segredo de verdade não estiver
// configurado lá, vale um segredo de ensaio: ele está escrito aqui, num
// repositório público, e por isso nunca vale na produção.
const SEGREDO_DE_ENSAIO = 'ws_ensaio_somente_no_banco_de_teste_latam';
const whopSecret = (Deno.env.get('LATAM_WHOP_SECRET') || (BANCO_DE_TESTE ? SEGREDO_DE_ENSAIO : '')).trim();

// A empresa "7 Amenes de la Madrugada" na Whop.
const EMPRESAS_LATAM = new Set(['biz_aTBX1NJKGf65tH']);
// Produtos de outra porta na mesma empresa da Whop. "As 3 Madrugadas de
// Intercessão" é do app BRASILEIRO (criado em 04/11/2026, ainda sem venda).
const PRODUTOS_DE_FORA = new Set(['prod_5j3iKMwnWInbK']);
const ACCESS_DAYS = 365;
// A Whop pede para recusar aviso com horário a mais de 5 minutos do agora.
const TOLERANCIA_MS = 5 * 60 * 1000;
// Um erro passageiro não pode custar uma venda: tenta de novo só o que pode
// se curar sozinho.
const RETRIABLE = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
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
      });
    } catch (networkError) {
      lastError = new Error(`Database unreachable on ${path}: ${networkError instanceof Error ? networkError.message : 'erro de rede'}`);
      continue;
    }
    // Gravar com return=minimal responde 201 SEM corpo (e o PATCH, 204).
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

const eq = (value: string) => encodeURIComponent(value);
const now = () => new Date().toISOString();
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const lower = (value: unknown) => text(value).toLowerCase();
const isConflict = (error: unknown) => (error as { status?: number })?.status === 409;
const encoder = new TextEncoder();
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Comparação em tempo constante: uma assinatura errada não se adivinha letra a letra.
function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

// ------------------------------------------------------------ assinatura
// A Whop assina "{webhook-id}.{webhook-timestamp}.{corpo cru}" com HMAC-SHA256
// e manda "v1,<base64>" no cabeçalho webhook-signature. A documentação não diz
// como a chave sai do segredo "ws_...". Até um aviso de verdade mostrar qual
// é, as leituras possíveis do MESMO segredo são aceitas, e o registro diz qual
// conferiu. Nenhuma delas abre a porta para quem não tem o segredo.
function fromBase64(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function fromHex(value: string) {
  if (!value || value.length % 2 || /[^0-9a-f]/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g)!.map(pair => parseInt(pair, 16)));
}

function candidateKeys(value: string) {
  const keys: { name: string; bytes: Uint8Array }[] = [{ name: 'texto', bytes: encoder.encode(value) }];
  const rest = value.replace(/^(ws|whsec)_/, '');
  if (rest !== value) keys.push({ name: 'texto-sem-prefixo', bytes: encoder.encode(rest) });
  const hex = fromHex(rest);
  if (hex) keys.push({ name: 'hex', bytes: hex });
  const decoded = fromBase64(rest);
  if (decoded && decoded.length >= 16) keys.push({ name: 'base64', bytes: decoded });
  return keys;
}

async function hmacBase64(keyBytes: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return btoa(String.fromCharCode(...signature));
}

async function verify(headers: Headers, raw: string): Promise<{ ok: true; via: string } | { ok: false; motivo: string }> {
  if (!whopSecret) return { ok: false, motivo: 'segredo LATAM_WHOP_SECRET não configurado' };
  const id = text(headers.get('webhook-id'));
  const timestamp = text(headers.get('webhook-timestamp'));
  const header = text(headers.get('webhook-signature'));
  if (!id || !timestamp || !header) return { ok: false, motivo: 'faltam os cabeçalhos webhook-id, webhook-timestamp ou webhook-signature' };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() - seconds * 1000) > TOLERANCIA_MS) {
    return { ok: false, motivo: 'horário do aviso fora da janela de 5 minutos' };
  }
  const received = header.split(/\s+/)
    .map(part => part.split(','))
    .filter(([version, value]) => version === 'v1' && value)
    .map(([, value]) => value);
  if (!received.length) return { ok: false, motivo: 'assinatura sem a versão v1' };
  const message = `${id}.${timestamp}.${raw}`;
  for (const key of candidateKeys(whopSecret)) {
    const expected = await hmacBase64(key.bytes, message);
    if (received.some(value => sameToken(value, expected))) return { ok: true, via: key.name };
  }
  return { ok: false, motivo: 'assinatura não confere com o segredo' };
}

// ------------------------------------------------------------ o aviso
// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

function productIds(payment: Json) {
  const ids = new Set<string>();
  const add = (value: unknown) => { const id = text(value); if (id) ids.add(id); };
  add(payment?.product?.id);
  add(payment?.product_id);
  for (const item of Array.isArray(payment?.line_items) ? payment.line_items : []) add(item?.product_id);
  return [...ids];
}

const emailOf = (payment: Json) =>
  lower(payment?.customer_email) || lower(payment?.user?.email) || lower(payment?.member?.email) || lower(payment?.email);
// Nome para a saudação. Quem paga às vezes escreve o e-mail no lugar do nome:
// isso não vira nome.
const nameOf = (payment: Json) => {
  const name = (text(payment?.user?.name) || text(payment?.billing_address?.name) || text(payment?.customer_name)).replace(/\s+/g, ' ');
  return name.includes('@') ? '' : name.slice(0, 120);
};
const accountOf = (payload: Json, payment: Json) =>
  text(payment?.account_id) || text(payment?.company_id) || text(payment?.company?.id) || text(payload?.account_id) || text(payload?.company_id);

// O e-mail da compra é o login dela. Cliente que já existe não tem nada
// sobrescrito: o aviso só preenche o que estiver em branco.
async function upsertCustomer(address: string, payment: Json) {
  const fields: Json = {};
  const name = nameOf(payment);
  if (name) fields.name = name;
  const country = text(payment?.billing_address?.country).toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) fields.country = country;
  const whopUser = text(payment?.user?.id);
  if (whopUser) fields.whop_user_id = whopUser;

  const find = async () => (await db(`latam_customers?email=eq.${eq(address)}&select=id,name,country,whop_user_id&limit=1`))[0] || null;
  const existing = await find();
  if (existing) {
    const blanks: Json = {};
    for (const [field, value] of Object.entries(fields)) if (!text(existing[field])) blanks[field] = value;
    if (Object.keys(blanks).length) {
      // Um dado acessório nunca pode atrasar o acesso.
      try { await db(`latam_customers?id=eq.${existing.id}`, 'PATCH', blanks, 'return=minimal'); } catch { /* segue */ }
    }
    return existing.id as string;
  }
  try {
    const [created] = await db('latam_customers', 'POST', { email: address, ...fields });
    return created.id as string;
  } catch (erro) {
    // Dois avisos da mesma cliente nova chegando juntos: quem perde a corrida
    // usa o cadastro que o outro acabou de criar.
    if (isConflict(erro)) {
      const winner = await find();
      if (winner) return winner.id as string;
    }
    throw erro;
  }
}

// Liberar é sempre "deixar ativo até a data mais longe". Repetir o aviso não
// duplica nada (a chave é cliente + produto), e a ordem dos avisos não importa.
// Uma compra nova reativa quem tinha sido retirada à mão: ela pagou de novo.
async function grantAccess(customerId: string, payment: Json) {
  const paidAt = Date.parse(text(payment?.paid_at) || text(payment?.created_at)) || Date.now();
  const until = new Date(paidAt + ACCESS_DAYS * 86_400_000).toISOString();
  const paymentId = text(payment?.id) || null;
  const path = `latam_access?customer_id=eq.${customerId}&product=eq.app`;
  const [existing] = await db(`${path}&select=status,expires_at,source`);
  const stamp = now();
  if (existing) {
    if (existing.status === 'active' && (!existing.expires_at || Date.parse(existing.expires_at) >= Date.parse(until))) {
      return existing.expires_at ? `já tinha acesso até ${existing.expires_at.slice(0, 10)}` : 'já tinha acesso sem prazo';
    }
    const furthest = existing.expires_at && Date.parse(existing.expires_at) > Date.parse(until) ? existing.expires_at : until;
    await db(path, 'PATCH', {
      status: 'active', expires_at: furthest, whop_payment_id: paymentId, granted_at: stamp, revoked_at: null, updated_at: stamp,
    }, 'return=minimal');
    return `acesso até ${String(furthest).slice(0, 10)}`;
  }
  try {
    await db('latam_access', 'POST', {
      customer_id: customerId, product: 'app', status: 'active', source: 'whop',
      expires_at: until, whop_payment_id: paymentId, granted_at: stamp, updated_at: stamp,
    }, 'return=minimal');
  } catch (erro) {
    if (!isConflict(erro)) throw erro;
  }
  return `acesso até ${until.slice(0, 10)}`;
}

// Situações em que o pagamento claramente não está de pé.
const NAO_PAGO = new Set(['void', 'uncollectible', 'draft', 'failed', 'canceled', 'open', 'pending']);

Deno.serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);

  const raw = await req.text();
  if (raw.length > 512_000) return respond({ error: 'Aviso grande demais.' }, 413);
  const assinatura = await verify(req.headers, raw);

  let payload: Json | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
  } catch { /* tratado abaixo */ }

  const type = text(payload?.type) || 'unknown';
  const data: Json = (payload?.data && typeof payload.data === 'object') ? payload.data : {};
  // Reembolso e disputa trazem o pagamento original dentro de data.payment.
  const payment: Json = type === 'payment.succeeded' ? data : (data.payment && typeof data.payment === 'object' ? data.payment : data);
  const webhookId = text(req.headers.get('webhook-id')) || text(payload?.id);
  const record = {
    webhook_id: webhookId || `sem-id-${Date.now()}`,
    event_type: type,
    payment_id: text(payment?.id) || null,
    customer_email: emailOf(payment) || null,
    payload: payload ?? { corpo_nao_json: raw.slice(0, 2000) },
  };

  if (!assinatura.ok) {
    console.error('latam-whop assinatura-recusada', JSON.stringify({ motivo: assinatura.motivo, tipo: type, temId: Boolean(webhookId) }));
    // Só no banco de teste: guarda o aviso recusado (sem liberar nada), para
    // dar para ver o formato no primeiro teste.
    if (BANCO_DE_TESTE) {
      try {
        await db('latam_whop_events?on_conflict=webhook_id', 'POST',
          { ...record, status: 'ignored', detail: `Assinatura recusada: ${assinatura.motivo}. Guardado só no banco de teste, sem liberar nada.`, processed_at: now() },
          'return=minimal,resolution=ignore-duplicates');
      } catch { /* só um rastro de teste */ }
    }
    return respond({ error: 'Não autorizado.' }, 401);
  }
  if (!payload) return respond({ error: 'JSON inválido.' }, 400);
  if (!webhookId) return respond({ error: 'Aviso sem webhook-id.' }, 400);

  try {
    // O on_conflict é obrigatório: sem ele o banco só ignora repetição da
    // chave principal pelo nome padrão, e o mesmo aviso de novo voltava erro
    // 409 (a lição da Payt, 16/10/2026).
    const [inserted] = await db('latam_whop_events?on_conflict=webhook_id', 'POST', record, 'return=representation,resolution=ignore-duplicates');
    if (!inserted) {
      const [previous] = await db(`latam_whop_events?webhook_id=eq.${eq(webhookId)}&select=status`);
      // Já resolvido: confirma sem refazer. O que falhou ou ficou para
      // conferir é refeito quando a Whop tenta de novo.
      if (previous && ['processed', 'ignored'].includes(previous.status)) return respond({ ok: true, duplicated: true });
    }

    const settle = (status: string, detail: string) =>
      db(`latam_whop_events?webhook_id=eq.${eq(webhookId)}`, 'PATCH', { status, detail, processed_at: now() }, 'return=minimal');
    const via = `Assinatura conferida (chave: ${assinatura.via}).`;

    if (type.startsWith('refund.') || type.startsWith('dispute.')) {
      await settle('ignored', `${via} Registrado. Reembolso e disputa não tiram o acesso (decisão de 05/11/2026); tirar é à mão.`);
      return respond({ ok: true, kept: true });
    }
    if (type !== 'payment.succeeded') {
      await settle('ignored', `${via} Registrado; não altera acesso.`);
      return respond({ ok: true });
    }

    const account = accountOf(payload, payment);
    if (account && !EMPRESAS_LATAM.has(account)) {
      await settle('ignored', `${via} Pagamento da empresa ${account}, que não é a da LATAM.`);
      return respond({ ok: true, ignored: true });
    }
    const products = productIds(payment);
    const fromElsewhere = products.filter(id => PRODUTOS_DE_FORA.has(id));
    if (fromElsewhere.length) {
      await settle('ignored', `${via} Produto de outra porta (${fromElsewhere.join(', ')}): não libera o app em espanhol.`);
      return respond({ ok: true, ignored: true });
    }
    const paymentStatus = lower(payment?.status);
    if (NAO_PAGO.has(paymentStatus)) {
      await settle('ignored', `${via} Pagamento com status ${paymentStatus}: não libera.`);
      return respond({ ok: true, ignored: true });
    }
    const address = emailOf(payment);
    if (!address || !validEmail(address)) {
      await settle('needs_review', `${via} Compra sem e-mail utilizável: sem e-mail ela não entra no app. Liberar à mão, com o e-mail certo.`);
      return respond({ ok: true, needsReview: true });
    }

    const customerId = await upsertCustomer(address, payment);
    const result = await grantAccess(customerId, payment);
    const amount = text(payment?.total?.amount) || text(payment?.usd_total?.amount) || text(payment?.total);
    const currency = text(payment?.total?.currency) || text(payment?.currency);
    await settle('processed', `${via} App liberado: ${result}.${amount ? ` Valor ${amount} ${currency}.` : ''}`);
    return respond({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    console.error('latam-whop', message);
    try {
      // Upsert, nunca PATCH: se a falha foi na própria gravação, o aviso ainda
      // não existe, e um PATCH não deixaria rastro nenhum.
      await db('latam_whop_events?on_conflict=webhook_id', 'POST',
        { ...record, status: 'failed', detail: message.slice(0, 500), processed_at: now() },
        'return=minimal,resolution=merge-duplicates');
    } catch (rescueError) {
      console.error('latam-whop EVENTO_NAO_GRAVADO', JSON.stringify({ webhookId, falha: message, gravacao: rescueError instanceof Error ? rescueError.message : 'erro' }));
    }
    // 500 faz a Whop tentar de novo (12 vezes, por cerca de 3 dias).
    return respond({ error: 'Falha ao processar o evento.' }, 500);
  }
});
