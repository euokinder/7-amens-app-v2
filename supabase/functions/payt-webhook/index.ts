// Payt webhook receiver (postback "PayT V1").
//
// A porta de entrada da Payt, SEPARADA da Hubla de propósito: a Hubla continua
// vendendo, e "uma coisa não pode quebrar a outra" (Caio, 16/10/2026). Este
// arquivo não lê nem escreve hubla_events nem hubla_product_map. A única
// tabela em comum é entitlements, a lista de acessos de cada cliente.
//
// Regras decididas pelo Caio em 16/10/2026:
//   * compra aprovada libera o produto comprado;
//   * reembolso e chargeback NÃO tiram o acesso (é promessa da VSL). A Payt só
//     DÁ acesso, nunca tira: os avisos de devolução ficam só registrados.
//     Tirar, se um dia precisar, é o botão "Revogar" do painel;
//   * tudo é pagamento único por enquanto. Avisos de assinatura ficam só
//     registrados.
//
// O formato do aviso: a ajuda oficial da Payt
// (help.payt.com.br/article/155-postback) diz onde cadastrar e quais avisos
// existem, mas não descreve o JSON. Os nomes dos campos abaixo seguem o "Guia
// do Postback PayT" (github.com/ventuinha/payt-postback), que não é da Payt e
// se contradiz em dois pontos ("canceled" e "cancelled"; um exemplo de upsell
// sem o upsell_code prometido). Por isso o aviso inteiro é guardado em
// payt_events, e só o evento REAL confirma um campo — a lição da Hubla.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// A "chave única" que a Payt cria ao cadastrar o postback, e que vem dentro de
// cada aviso (integration_key). Sem ela configurada, tudo é recusado.
const paytKey = Deno.env.get('PAYT_INTEGRATION_KEY') || '';
// No banco de TESTE (o mesmo do localhost; ninguém de verdade dentro) os
// avisos marcados como teste pela Payt liberam acesso, para dar para provar o
// caminho inteiro. Na produção eles são só guardados.
const BANCO_DE_TESTE = base.includes('wyiqwsgfictcfkytldnu');

// Um erro passageiro não pode custar uma venda (lição de 18/09, na Hubla):
// tenta de novo só o que pode se curar sozinho.
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

    // Gravar com return=minimal responde 201 SEM corpo (e o PATCH, 204): ler
    // isso como JSON quebraria uma gravação que deu certo.
    if (response.ok) {
      const answer = await response.text();
      return answer ? JSON.parse(answer) : null;
    }

    const detail = excerpt(await response.text().catch(() => ''));
    lastError = new Error(`Database operation failed (${response.status}) on ${path}${detail ? `: ${detail}` : ''}`);
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
// A mesma conta da member-api, do hubla-webhook e do recuperacao-por-cpf.sql:
// quem comprou pela Payt também consegue recuperar o e-mail pelo CPF.
const sha256 = async (valor: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor)))).map(b => b.toString(16).padStart(2, '0')).join('');
// A mesma trava de e-mail da tabela customers: o que não passaria nela vira
// reconciliação, e não um erro de banco.
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Comparação em tempo constante: uma chave errada não se adivinha letra a letra.
function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

// A Payt dá código ao produto e a cada oferta dele (o "Payt Object ID" das
// páginas do funil é oferta-produto, como R6VDGP-RKBQN6). Junta todo código
// que o aviso trouxer, e o payt_product_map decide quais conhecemos.
function candidateCodes(payload: Record<string, any>) {
  const codes = new Set<string>();
  const add = (value: unknown) => { const code = text(value); if (code) codes.add(code); };
  const product = payload?.product || {};
  add(product?.code);
  for (const item of Array.isArray(product?.items) ? product.items : []) add(item?.code);
  for (const bump of Array.isArray(payload?.order_bumps) ? payload.order_bumps : []) {
    add(bump?.code);
    add(bump?.product?.code);
  }
  add(payload?.upsell_code);
  return [...codes];
}

async function mapCodes(codes: string[]) {
  if (!codes.length) return { keys: [] as string[], unknown: [] as string[] };
  const rows = await db(`payt_product_map?payt_code=in.(${codes.map(eq).join(',')})&select=payt_code,product_key`);
  const known = new Set(rows.map((row: { payt_code: string }) => row.payt_code));
  const keys = [...new Set(rows.map((row: { product_key: string }) => row.product_key))] as string[];
  return { keys, unknown: codes.filter(code => !known.has(code)) };
}

// Um produto marcado como "abre o app" também dá o principal (a mesma regra
// do hubla-webhook).
async function withPrincipal(keys: string[]) {
  if (!keys.length || keys.includes('principal')) return keys;
  const unlocks = await db(`products?key=in.(${keys.map(eq).join(',')})&unlocks_app=is.true&select=key&limit=1`);
  return unlocks.length ? [...keys, 'principal'] : keys;
}

// O e-mail da compra é o login dela. Cliente que já existe (por exemplo, vinda
// da Hubla) não tem nada sobrescrito: a Payt só preenche o que estiver em
// branco, para não pisar no que a Hubla gravou.
async function upsertCustomer(customer: Record<string, any>) {
  const address = lower(customer?.email);
  const fullName = text(customer?.name).replace(/\s+/g, ' ');
  const [first, ...rest] = fullName ? fullName.split(' ') : [];
  const fields: Record<string, unknown> = {};
  if (fullName) fields.name = fullName;
  if (first) fields.first_name = first;
  if (rest.length) fields.last_name = rest.join(' ');
  if (text(customer?.phone)) fields.phone = text(customer?.phone);
  const documento = text(customer?.doc).replace(/\D/g, '');
  if (documento.length === 11 && !/^(.)\1{10}$/.test(documento)) {
    fields.cpf_hash = await sha256(documento);
    fields.cpf_ultimos3 = documento.slice(-3);
  }

  const find = async () => (await db(`customers?email=eq.${eq(address)}&select=*`))[0] || null;
  const fillBlanks = async (existing: Record<string, any>) => {
    const blanks: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(fields)) {
      if (field in existing && !text(existing[field])) blanks[field] = value;
    }
    if (Object.keys(blanks).length) {
      // Um dado acessório nunca pode atrasar o acesso.
      try { await db(`customers?id=eq.${existing.id}`, 'PATCH', blanks, 'return=minimal'); } catch { /* segue */ }
    }
    return existing.id as string;
  };

  const existing = await find();
  if (existing) return fillBlanks(existing);

  try {
    const [created] = await db('customers', 'POST', { email: address, ...fields });
    return created.id as string;
  } catch (erro) {
    // O principal e o UP01 chegam com segundos de diferença: dois avisos da
    // mesma cliente nova tentam criar o cadastro juntos, e o segundo bate na
    // trava do e-mail (409). Aconteceu na Hubla em 19/09. Aqui, quem perde a
    // corrida usa o cadastro que o outro acabou de criar.
    if (isConflict(erro)) {
      const winner = await find();
      if (winner) return winner.id as string;
    }
    // Sem as colunas do CPF (banco antigo), cadastra sem elas.
    if (!('cpf_hash' in fields)) throw erro;
    delete fields.cpf_hash;
    delete fields.cpf_ultimos3;
    const [created] = await db('customers', 'POST', { email: address, ...fields });
    return created.id as string;
  }
}

// Liberar é a única ação da Payt sobre o acesso, e é sempre "deixar ativo":
// repetir o mesmo aviso não duplica nada (a chave da tabela é cliente +
// produto) e a ordem em que os avisos chegam não importa.
// Acesso já ativo, venha de onde vier, fica como está.
async function grant(customerId: string, productKey: string, transactionId: string) {
  const path = `entitlements?customer_id=eq.${customerId}&product_key=eq.${eq(productKey)}`;
  const [existing] = await db(`${path}&select=status,source`);
  if (existing?.status === 'active') return `${productKey} (já tinha, ${existing.source})`;

  const stamp = now();
  const fields = {
    status: 'active',
    source: 'payt',
    external_reference: transactionId || null,
    granted_at: stamp,
    revoked_at: null,
    last_modified_at: stamp,
    updated_at: stamp,
  };
  if (existing) {
    await db(`${path}&status=neq.active`, 'PATCH', fields, 'return=minimal');
    return productKey;
  }
  try {
    await db('entitlements', 'POST', { customer_id: customerId, product_key: productKey, ...fields }, 'return=minimal');
  } catch (erro) {
    // Outro aviso da mesma compra liberou no mesmo instante.
    if (!isConflict(erro)) throw erro;
  }
  return productKey;
}

// Devolução de dinheiro, de qualquer tipo. Fica registrada; o acesso fica.
const DEVOLUCAO = new Set([
  'refunded', 'refunded_partial', 'one_click_buy_refunded', 'one_click_buy_refunded_partial',
  'chargeback', 'chargeback_presented', 'peding_refund', 'pending_refund',
]);
// Situações em que o pedido não está de pé, mesmo que o pagamento diga "paid".
const NAO_LIBERA = new Set(['canceled', 'cancelled', 'lost_cart', 'waiting_payment', 'subscription_canceled', 'subscription_overdue']);

Deno.serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);

  const raw = await req.text();
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('não é um objeto');
  } catch {
    // O primeiro aviso de verdade mostra o formato: deixa a pista no log.
    console.error('payt-webhook corpo-nao-json', JSON.stringify({ contentType: req.headers.get('content-type'), tamanho: raw.length }));
    return respond({ error: 'JSON inválido.' }, 400);
  }

  if (!sameToken(text(payload.integration_key), paytKey)) {
    console.error('payt-webhook chave-recusada', JSON.stringify({
      chaveConfigurada: Boolean(paytKey), veioChave: 'integration_key' in payload, campos: Object.keys(payload).slice(0, 40),
    }));
    return respond({ error: 'Não autorizado.' }, 401);
  }

  // A chave nunca vai para o banco.
  const { integration_key: _chave, ...guardado } = payload;
  const status = lower(payload.status);
  const paymentStatus = lower(payload?.transaction?.payment_status);
  const transactionId = text(payload.transaction_id);
  const isTest = payload.test === true || lower(payload.test) === 'true';
  const codes = candidateCodes(payload);
  // A Payt não documenta um cabeçalho de "mesmo aviso". O próprio conteúdo
  // serve: o mesmo aviso reenviado tem o mesmo conteúdo, e esbarra na trava.
  const idempotencyKey = await sha256(raw);

  const record = {
    idempotency_key: idempotencyKey,
    event_status: status || 'unknown',
    payment_status: paymentStatus || null,
    sale_type: text(payload.type) || null,
    transaction_id: transactionId || null,
    product_code: codes[0] || null,
    customer_email: lower(payload?.customer?.email) || null,
    sandbox: isTest,
    payload: guardado,
  };

  try {
    let stored: Record<string, any> | undefined;
    // O on_conflict é obrigatório: sem ele o banco só ignora repetição da
    // chave principal (o id), e o mesmo aviso de novo voltava erro 409 para a
    // Payt. Pego no aviso de teste de verdade, em 16/10/2026.
    const [inserted] = await db('payt_events?on_conflict=idempotency_key', 'POST', record, 'return=representation,resolution=ignore-duplicates');
    if (inserted) {
      stored = inserted;
    } else {
      const [previous] = await db(`payt_events?idempotency_key=eq.${eq(idempotencyKey)}&select=id,processing_status`);
      // Já resolvido: confirma sem refazer. O que ficou "para conferir" (um
      // código sem mapa) e o que falhou são refeitos quando a Payt reenvia:
      // cadastrou o código, pediu o reenvio, e a venda libera sozinha.
      if (previous && ['processed', 'ignored'].includes(previous.processing_status)) {
        return respond({ ok: true, duplicated: true });
      }
      stored = previous;
    }
    if (!stored?.id) throw new Error('Evento gravado mas nao localizado para processamento.');

    const settle = (processing: string, error: string | null = null) =>
      db(`payt_events?id=eq.${stored.id}`, 'PATCH', { processing_status: processing, error, processed_at: now() }, 'return=minimal');

    if (isTest && !BANCO_DE_TESTE) {
      await settle('ignored', 'Aviso de teste da Payt: registrado sem alterar acesso.');
      return respond({ ok: true, test: true });
    }

    if (DEVOLUCAO.has(paymentStatus)) {
      await settle('ignored', 'Reembolso ou chargeback registrado. O acesso fica, de propósito (decisão do Caio, 16/10/2026).');
      return respond({ ok: true, kept: true });
    }

    const paid = paymentStatus ? paymentStatus === 'paid' : ['paid', 'billed'].includes(status);
    if (!paid || NAO_LIBERA.has(status)) {
      await settle('ignored', 'Registrado; não altera acesso.');
      return respond({ ok: true });
    }

    const { keys, unknown } = await mapCodes(codes);
    if (!keys.length) {
      // Código desconhecido é configuração, não entrega: responde 200 para a
      // Payt não insistir, e nunca adivinha um acesso.
      await settle('needs_reconciliation', `Produto não mapeado: ${codes.join(', ') || 'sem código'}`);
      return respond({ ok: true, unmapped: true });
    }

    const customer = payload?.customer || {};
    const address = lower(customer?.email);
    if (customer?.fake_email === true || !address || !validEmail(address)) {
      await settle('needs_reconciliation', 'Compra sem e-mail utilizável: sem e-mail ela não entra no app. Liberar pelo painel, com o e-mail certo.');
      return respond({ ok: true, unmatched: true });
    }

    const customerId = await upsertCustomer(customer);
    const products = await withPrincipal(keys);
    const applied = [];
    for (const productKey of products) applied.push(await grant(customerId, productKey, transactionId));

    const notes = [`Produtos: ${applied.join(', ')}`];
    if (unknown.length) notes.push(`Também veio código sem mapa: ${unknown.join(', ')}`);
    await settle('processed', notes.join('. '));
    return respond({ ok: true, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    console.error('payt-webhook', message);
    try {
      // Upsert, nunca PATCH: se a falha foi na própria gravação, o aviso
      // ainda não existe, e um PATCH não deixaria rastro nenhum.
      await db('payt_events?on_conflict=idempotency_key', 'POST',
        { ...record, processing_status: 'failed', error: message },
        'return=minimal,resolution=merge-duplicates');
    } catch (rescueError) {
      const reason = rescueError instanceof Error ? rescueError.message : 'erro desconhecido';
      console.error('payt-webhook EVENTO_NAO_GRAVADO', JSON.stringify({ idempotencyKey, falha: message, gravacao: reason, payload: guardado }));
    }
    return respond({ error: 'Falha ao processar o evento.' }, 500);
  }
});
