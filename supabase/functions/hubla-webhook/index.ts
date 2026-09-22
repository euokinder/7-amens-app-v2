// Hubla webhook receiver.
//
// Access truth comes only from customer.member_added / customer.member_removed.
// Financial and subscription events are stored for audit and never move access.
// Raw payloads are kept so any dispute can be reconstructed months later.
//
// See docs/hubla-integracao-spec.md for the full specification.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const hublaToken = Deno.env.get('HUBLA_WEBHOOK_TOKEN') || '';

// A passing error - the key refused for one instant, the database blinking -
// must never cost an event. On 18/09 a single 401 lost a R$ 197 sale. Retry
// briefly before giving up; only statuses that can heal on their own qualify,
// because a malformed request of ours would fail the same way forever.
const RETRIABLE = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const excerpt = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 200);

async function db(path: string, method = 'GET', body?: unknown, prefer = 'return=representation') {
  let lastError = new Error(`Database call never ran on ${path}`);

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
      // No answer at all: the network is down, always worth another try.
      lastError = new Error(`Database unreachable on ${path}: ${networkError instanceof Error ? networkError.message : 'erro de rede'}`);
      continue;
    }

    if (response.ok) return response.status === 204 ? null : response.json();

    const detail = excerpt(await response.text().catch(() => ''));
    lastError = new Error(`Database operation failed (${response.status}) on ${path}${detail ? `: ${detail}` : ''}`);
    if (!RETRIABLE.has(response.status)) throw lastError;
  }

  throw lastError;
}

const eq = (value: string) => encodeURIComponent(value);
const now = () => new Date().toISOString();
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
// A mesma conta feita pela member-api e pelo recuperacao-por-cpf.sql. Os tres
// precisam bater: se divergirem, a busca por CPF para de achar quem procura,
// e o defeito nao aparece na tela de ninguem.
const sha256 = async (valor: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor)))).map(b => b.toString(16).padStart(2, '0')).join('');
const email = (value: unknown) => text(value).toLowerCase();

// Timing-safe comparison so a wrong token cannot be guessed byte by byte.
function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

// Hubla names a product through several identifiers (product, offer, checkout).
// Collect every candidate and let hubla_product_map decide which ones we know.
const collectIds = (value: unknown, into: Set<string>) => { const id = text(value); if (id) into.add(id); };

function singularProductIds(event: Record<string, any>) {
  const ids = new Set<string>();
  collectIds(event?.product?.id, ids);
  return [...ids];
}

function listedProductIds(event: Record<string, any>) {
  const ids = new Set<string>();
  for (const product of Array.isArray(event?.products) ? event.products : []) {
    collectIds(product?.id, ids);
    for (const offer of Array.isArray(product?.offers) ? product.offers : []) collectIds(offer?.id, ids);
  }
  return [...ids];
}

const candidateProductIds = (event: Record<string, any>) =>
  [...new Set([...singularProductIds(event), ...listedProductIds(event)])];

async function mapProducts(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db(`hubla_product_map?hubla_id=in.(${ids.map(eq).join(',')})&select=product_key`);
  return [...new Set(rows.map((row: { product_key: string }) => row.product_key))] as string[];
}

// On the recommended integration a single sale with order bump can carry several
// products in one event, so granting only the first would silently skip an extra.
// Removal stays deliberately narrow: event.product is the specific membership
// that ended, and wrongly revoking a paying customer is far worse than granting
// one product late.
async function targetProducts(event: Record<string, any>, granting: boolean) {
  if (!granting) {
    const specific = await mapProducts(singularProductIds(event));
    return specific.length ? specific : mapProducts(listedProductIds(event));
  }
  const keys = await mapProducts(candidateProductIds(event));
  if (!keys.length) return keys;
  // A product flagged as unlocking the app also grants the main entitlement.
  // The R$ 97 offer points at the front product on Hubla but is catalogued as
  // an upsell here, and its buyers must not end up locked out of the app.
  const unlocks = await db(`products?key=in.(${keys.map(eq).join(',')})&unlocks_app=is.true&select=key&limit=1`);
  return unlocks.length ? [...new Set([...keys, 'principal'])] : keys;
}

// The purchase email stays the customer's login; hubla_user_id is the stable
// external identity. Only fields actually present in the event are written.
async function upsertCustomer(user: Record<string, any>) {
  const address = email(user?.email);
  if (!address) return null;

  const first = text(user?.firstName);
  const last = text(user?.lastName);
  const fields: Record<string, unknown> = {};
  if (first) fields.first_name = first;
  if (last) fields.last_name = last;
  if (text(user?.phone)) fields.phone = text(user?.phone);
  // O CPF vem em event.user.document — confirmado na documentacao oficial da
  // Hubla em 22/09/2026 e presente em 99,6% dos eventos ja guardados. Serve
  // para a cliente recuperar sozinha o e-mail de acesso quando nao lembra qual
  // usou, tirando essa conversa do WhatsApp do suporte.
  //
  // Guardado embaralhado, nunca legivel. So 11 digitos: CNPJ nao recupera nada.
  const documento = text(user?.document).replace(/\D/g, '');
  if (documento.length === 11 && !/^(.)\1{10}$/.test(documento)) {
    fields.cpf_hash = await sha256(documento);
    fields.cpf_ultimos3 = documento.slice(-3);
  }
  if (text(user?.id)) fields.hubla_user_id = text(user?.id);
  const fullName = [first, last].filter(Boolean).join(' ');
  if (fullName) fields.name = fullName;

  const [existing] = await db(`customers?email=eq.${eq(address)}&select=id`);
  if (existing) {
    if (Object.keys(fields).length) {
      // A duplicated hubla_user_id must never block the access itself.
      try { await db(`customers?id=eq.${existing.id}`, 'PATCH', fields); } catch { /* keep going */ }
    }
    return existing.id as string;
  }

  try {
    const [created] = await db('customers', 'POST', { email: address, ...fields });
    return created.id as string;
  } catch (erro) {
    // Rede de seguranca de ordem de implantacao. Se esta funcao subir ANTES do
    // recuperacao-por-cpf.sql rodar, as colunas do CPF ainda nao existem e o
    // cadastro inteiro falharia — ou seja, quem acabou de pagar ficaria sem
    // acesso por causa de um campo acessorio. Entao tenta de novo sem ele.
    // Ja aconteceu uma venda perdida neste projeto; nao pode acontecer outra.
    if (!('cpf_hash' in fields)) throw erro;
    delete fields.cpf_hash;
    delete fields.cpf_ultimos3;
    const [created] = await db('customers', 'POST', { email: address, ...fields });
    return created.id as string;
  }
}

// Hubla does not guarantee event order. A lower version means a late event:
// keep it in the log but never let it overwrite a newer state.
function isLateEvent(existing: Record<string, any> | null, version: number | null) {
  return Boolean(existing && version !== null && existing.last_subscription_version !== null
    && version < existing.last_subscription_version);
}

async function currentEntitlement(customerId: string, productKey: string) {
  const [row] = await db(`entitlements?customer_id=eq.${customerId}&product_key=eq.${eq(productKey)}&select=*`);
  return row || null;
}

async function applyEntitlement(event: Record<string, any>, productKey: string, granting: boolean) {
  const customerId = await upsertCustomer(event?.user || {});
  if (!customerId) return { status: 'needs_reconciliation', error: 'Evento sem e-mail de comprador.', customerId: null };

  const subscription = event?.subscription || {};
  const version = Number.isInteger(subscription?.version) ? subscription.version as number : null;
  const existing = await currentEntitlement(customerId, productKey);
  if (isLateEvent(existing, version)) return { status: 'ignored', error: 'Evento atrasado; estado mais novo preservado.', customerId };

  const stamp = now();
  const fields: Record<string, unknown> = {
    status: granting ? 'active' : 'revoked',
    source: 'hubla',
    external_reference: text(subscription?.id) || null,
    hubla_subscription_id: text(subscription?.id) || null,
    last_subscription_version: version,
    last_modified_at: text(subscription?.modifiedAt) || stamp,
    updated_at: stamp,
    ...(granting ? { granted_at: stamp, revoked_at: null } : { revoked_at: stamp }),
  };

  if (existing) await db(`entitlements?customer_id=eq.${customerId}&product_key=eq.${eq(productKey)}`, 'PATCH', fields);
  else await db('entitlements', 'POST', { customer_id: customerId, product_key: productKey, ...fields });

  return { status: 'processed', error: null, customerId };
}

// The panel already counts how many customers saw an in-app offer and how many
// clicked it. Until now the last column, the one that matters, always read zero
// because nothing ever wrote converted_at: on 19/09 the real numbers were 245
// clicks and 10 purchases, and the panel showed 245 and 0.
//
// This closes that gap at the only moment the truth is known - the purchase.
// The campaign says which product it sells (offered_product_key), so a sale of
// that product right after a click on that pop-up is the conversion.
//
// Every failure here is swallowed on purpose. This is bookkeeping: it must
// never be able to cost a customer the access she paid for. It also means the
// function can be deployed before metricas-do-funil.sql runs - the column will
// simply not exist yet, and the only consequence is a panel still showing zero.
async function markOfferConverted(event: Record<string, any>, customerId: string, productKeys: string[]) {
  try {
    // A PROVA de que a venda veio do pop-up é a etiqueta que viaja até o
    // checkout, não o fato de a cliente ter clicado antes. Os Quatro Arcanjos
    // são vendidos em DOIS lugares que caem no mesmo checkout: o upsell do
    // funil do anúncio (minutos depois da compra principal) e este pop-up.
    // Sem esta trava, toda venda do funil feita por quem passou pelo app
    // seria creditada ao pop-up: em 19/09 isso daria 10 vendas onde existiam
    // 2 de verdade — cinco vezes mais do que a realidade.
    const utm = event?.subscription?.firstPaymentSession?.utm || {};
    if (text(utm?.medium) !== 'popup') return;

    const campaigns = await db(
      `member_offer_campaigns?offered_product_key=in.(${productKeys.map(eq).join(',')})&select=key`);
    if (!campaigns.length) return;
    const keys = campaigns.map((campaign: { key: string }) => campaign.key);
    await db(
      `member_offer_events?customer_id=eq.${customerId}&campaign_key=in.(${keys.map(eq).join(',')})`
      + '&clicked_at=not.is.null&converted_at=is.null',
      'PATCH', { converted_at: now() }, 'return=minimal');
  } catch (error) {
    console.error('hubla-webhook offer-conversion', error instanceof Error ? error.message : 'erro inesperado');
  }
}

Deno.serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
  if (!sameToken(req.headers.get('x-hubla-token') || '', hublaToken)) return respond({ error: 'Não autorizado.' }, 401);

  const raw = await req.text();
  let payload: Record<string, any>;
  try { payload = JSON.parse(raw); } catch { return respond({ error: 'JSON inválido.' }, 400); }

  const sandbox = (req.headers.get('x-hubla-sandbox') || '').toLowerCase() === 'true';
  const eventType = text(payload?.type) || 'unknown';
  const event = payload?.event || {};
  // Hubla states the header is always present; hash the body as a fallback so a
  // missing header can never turn into duplicated access.
  const idempotencyKey = text(req.headers.get('x-hubla-idempotency'))
    || Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))))
      .map(byte => byte.toString(16).padStart(2, '0')).join('');

  // Built outside the try so the rescue in the catch can still write the whole
  // event when the very first insert is what failed.
  const record = {
    idempotency_key: idempotencyKey,
    event_type: eventType,
    payload_version: text(payload?.version) || null,
    sandbox,
    hubla_user_id: text(event?.user?.id) || null,
    hubla_product_id: candidateProductIds(event)[0] || null,
    subscription_id: text(event?.subscription?.id) || null,
    invoice_id: text(event?.invoice?.id) || null,
    entity_version: Number.isInteger(event?.subscription?.version) ? event.subscription.version : null,
    payload,
  };

  try {
    // Insert first: the unique key makes idempotency atomic, with no race between
    // a lookup and a write when Hubla retries.
    let stored: Record<string, any> | undefined;
    const [inserted] = await db('hubla_events', 'POST', record, 'return=representation,resolution=ignore-duplicates');
    if (inserted) {
      stored = inserted;
    } else {
      const [previous] = await db(`hubla_events?idempotency_key=eq.${eq(idempotencyKey)}&select=id,processing_status`);
      // Already settled: acknowledge without doing the work twice. A previous
      // failure is retried, otherwise a transient error would be stuck forever.
      if (previous && ['processed', 'ignored', 'needs_reconciliation'].includes(previous.processing_status)) {
        return respond({ ok: true, duplicated: true });
      }
      stored = previous;
    }

    // Neither inserted nor found. Fall into the rescue instead of dying on
    // stored.id, which would leave no trace of the event anywhere.
    if (!stored?.id) throw new Error('Evento gravado mas nao localizado para processamento.');

    const settle = (status: string, error: string | null = null) =>
      db(`hubla_events?id=eq.${stored.id}`, 'PATCH', { processing_status: status, error, processed_at: now() });

    // Sandbox events are recorded for inspection but must never touch real access.
    if (sandbox) {
      await settle('ignored', 'Evento de sandbox: registrado sem alterar acesso.');
      return respond({ ok: true, sandbox: true });
    }

    if (eventType === 'customer.member_added' || eventType === 'customer.member_removed') {
      const granting = eventType === 'customer.member_added';
      const productKeys = await targetProducts(event, granting);
      if (!productKeys.length) {
        // Unknown product is a configuration problem, not a delivery problem:
        // acknowledge so Hubla stops retrying, and never guess an access.
        await settle('needs_reconciliation', `Produto não mapeado: ${candidateProductIds(event).join(', ') || 'sem id'}`);
        return respond({ ok: true, unmapped: true });
      }

      const results = [];
      for (const productKey of productKeys) results.push(await applyEntitlement(event, productKey, granting));

      // She bought after clicking an offer inside the app? Write it down.
      const buyerId = results.find(result => result.customerId)?.customerId;
      if (granting && buyerId) await markOfferConverted(event, buyerId, productKeys);

      const failed = results.find(result => result.status === 'needs_reconciliation');
      await settle(failed ? 'needs_reconciliation' : 'processed',
        failed ? failed.error : (productKeys.length > 1 ? `Produtos aplicados: ${productKeys.join(', ')}` : null));
      return respond({ ok: true, products: productKeys });
    }

    // Financial and subscription events are audit only, by design.
    await settle('ignored', 'Evento registrado para auditoria; não altera acesso.');
    return respond({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    console.error('hubla-webhook', message);
    try {
      // Upsert, never PATCH. A PATCH cannot mark a row that was never inserted,
      // and that is exactly how the R$ 197 event of 18/09 vanished: the failure
      // happened during the insert itself. This writes the event when it is
      // missing and marks it failed when it is there, so the payload survives
      // and conferir-acessos-perdidos.sql can always find it.
      await db('hubla_events?on_conflict=idempotency_key', 'POST',
        { ...record, processing_status: 'failed', error: message },
        'return=minimal,resolution=merge-duplicates');
    } catch (rescueError) {
      // The database is unreachable even for this. Nothing durable is possible
      // from here, so print the whole payload - it can be replayed from the
      // logs - and answer 500 so Hubla delivers the event again.
      const reason = rescueError instanceof Error ? rescueError.message : 'erro desconhecido';
      console.error('hubla-webhook EVENTO_NAO_GRAVADO', JSON.stringify({ idempotencyKey, falha: message, gravacao: reason, payload }));
    }
    return respond({ error: 'Falha ao processar o evento.' }, 500);
  }
});
