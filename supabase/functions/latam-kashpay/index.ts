// latam-kashpay: o aviso de pedido da KashPay. Faz duas coisas:
//   1. RASTREIO das vendas da LATAM (qual anúncio vendeu), lido pelo Hub de
//      Criativos LATAM (desde 06/11/2026);
//   2. desde 08/11/2026, LIBERA o app em espanhol. A KashPay é o checkout e
//      está na frente de toda venda, seja a Whop ou a Digistore24 quem
//      processa o pagamento. Por isso a liberação mora aqui, e não numa
//      integração por processadora (decisão do Caio, 08/11).
// A latam-whop continua ligada: as vendas processadas pela Whop são
// liberadas pelas duas, e liberar duas vezes não duplica nada (a conta é
// sempre "ativo até a data mais longe").
//
// Grava latam_kashpay_events, latam_customers e latam_access (e lê
// latam_kashpay_offers). Não lê nem escreve nenhuma tabela do Brasil.
//
// DADO PESSOAL, o mínimo (decisão de 06/11, ajustada em 08/11). O aviso da
// KashPay traz nome, e-mail e telefone de quem comprou e o nome no cartão.
// - O e-mail e o nome vão SÓ para latam_customers, que é o login dela,
//   como já faz a latam-whop. O telefone e o cartão não vão a lugar nenhum.
// - A linha de latam_kashpay_events é montada campo a campo, só com o que o
//   Hub precisa, mais o customer_id (o número da cliente, nunca o e-mail).
// - O corpo do aviso NÃO é guardado, e os registros (console) também não
//   levam dado de pessoa.
//
// A conta da KashPay tem produtos de OUTRAS operações (em inglês). Só o que é
// do 7 Amenes vira linha; o resto recebe 200 e é esquecido.
//
// Documentação: https://app.kashpay.com.br/docs/webhooks (lida em 06/11/2026).
// Só o aviso REAL confirma um campo (a lição da Hubla): o que não der para
// classificar com segurança fica 'needs_review', nunca adivinhado.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// O banco de TESTE (o mesmo do localhost; ninguém de verdade dentro).
const BANCO_DE_TESTE = base.includes('wyiqwsgfictcfkytldnu');
// A chave de assinatura que a KashPay gera ao salvar o webhook (Integrações →
// Webhooks). Nome próprio, para nunca se confundir com o segredo de outra
// porta. Só no banco de TESTE, e só enquanto o segredo de verdade não estiver
// configurado lá, vale um segredo de ensaio: ele está escrito aqui, num
// repositório público, e por isso nunca vale na produção.
const SEGREDO_DE_ENSAIO = 'kp_ensaio_somente_no_banco_de_teste_latam';
const kashpaySecret = (Deno.env.get('LATAM_KASHPAY_SECRET') || (BANCO_DE_TESTE ? SEGREDO_DE_ENSAIO : '')).trim();

// Os produtos do 7 Amenes, reconhecidos por um pedaço do nome da oferta (sem
// acento, minúsculo). Palavras em espanhol que as outras operações da conta,
// em inglês, não usam ("Archangel" não tem o "arcangel" sem h).
const PELO_NOME: [string, string][] = [
  ['amenes', 'principal'],      // as duas ofertas "7 Amenes de la Madrugada"
  ['arcangel', 'arcangeles'],   // Oraciones a los Santos Arcángeles (UP01)
  ['desata', 'desatanudos'],    // Novena a la Virgen Desatanudos (UP02)
  // O UP02 é o Cántico Angelical (o nome "Desatanudos" foi engano). No banco,
  // ele continua sendo 'desatanudos'. "Cántico Angelical D" é o produto da
  // Digistore24 (08/11).
  ['cantico', 'desatanudos'],
];
// A compra libera o app por 12 meses, como na latam-whop.
const ACCESS_DAYS = 365;
// Oferta com nome de preço ("19 usd" e "9 usd" são do 7 Amenes; um upsell
// pode ter um nome assim também). Outra operação pode repetir o nome, então,
// sem o id confirmado em latam_kashpay_offers, o pedido fica 'needs_review'
// (não conta no Hub, mas também não se perde).
const NOME_DE_PRECO = /^(?:us)?\$?\s*\d+(?:[.,]\d+)?\s*(?:usd|us\$|dolares)?$/;
const NOSSOS = new Set(['principal', 'arcangeles', 'desatanudos']);

// A KashPay espera resposta em até 15 s. Cada tentativa no banco tem 3,5 s;
// três tentativas e as pausas cabem em ~12,5 s.
const RETRIABLE = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
const TEMPO_POR_TENTATIVA_MS = 3500;
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
type Json = Record<string, any>;
const obj = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {});
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const plain = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const encoder = new TextEncoder();
const eq = (value: string) => encodeURIComponent(value);
const now = () => new Date().toISOString();
const isConflict = (error: unknown) => (error as { status?: number })?.status === 409;
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Valores em centavos e quantidades: a documentação diz inteiro. Outra coisa
// vira nulo (e o detalhe avisa), nunca um número adivinhado.
function integer(value: unknown) {
  // "27.00" (texto com ponto) seria 27 centavos: não vale.
  const number = typeof value === 'string' && /^\s*-?\d+\s*$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && Math.abs(number) < 2_000_000_000 ? number : null;
}
function when(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
// O utm como veio, com duas limpezas: o que vem depois de "::" (no Brasil é o
// fbclid, o código do clique, que o Hub não usa) e qualquer e-mail colado num
// link.
function tracked(value: unknown) {
  const cleaned = text(value).split('::')[0].replace(/[^\s@|:]+@[^\s@|:]+\.[^\s@|:]+/g, '[e-mail]').trim().slice(0, 300);
  return cleaned || null;
}

// ------------------------------------------------------------ assinatura
// X-KashPay-Signature: sha256=<HMAC-SHA256(chave, corpo cru) em hexadecimal>.
// A chave é usada como texto, como no exemplo da documentação.
async function hmacHex(key: string, bytes: Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, bytes));
  return Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante: uma assinatura errada não se adivinha letra a letra.
function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

async function verify(header: string | null, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!kashpaySecret) return { ok: false, motivo: 'segredo LATAM_KASHPAY_SECRET não configurado' };
  const value = text(header);
  if (!value) return { ok: false, motivo: 'sem o cabeçalho X-KashPay-Signature' };
  const received = value.replace(/^sha256=/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(received)) return { ok: false, motivo: 'assinatura fora do formato sha256=<64 letras hexadecimais>' };
  const expected = await hmacHex(kashpaySecret, bytes);
  return sameToken(received, expected) ? { ok: true } : { ok: false, motivo: 'assinatura não confere com o segredo' };
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------ as ofertas
type Offer = { id: string; name: string; type: string; quantity: number | null; total: number | null; produto: string | null };

function byName(name: string) {
  const clean = plain(name);
  for (const [piece, produto] of PELO_NOME) if (clean.includes(piece)) return produto;
  return null;
}

// O mapa de ids só é lido quando algum nome não basta (é uma tabela pequena).
async function offerMap() {
  const rows = await db('latam_kashpay_offers?select=offer_id,produto&limit=1000');
  return new Map<string, string>((rows || []).map((row: Json) => [text(row.offer_id), text(row.produto)]));
}

// O formato do aviso, só com os NOMES dos campos (nunca os valores), para
// entender um aviso que não veio como a documentação diz.
const shapeOf = (payload: Json, data: Json) =>
  `campos do aviso: ${Object.keys(payload).sort().join(', ') || '(nenhum)'}; de data: ${Object.keys(data).sort().join(', ') || '(nenhum)'}`;

// ------------------------------------------------------------ a liberação
// O e-mail da compra é o login dela (data.customer.email, na documentação).
// Cliente que já existe não tem nada sobrescrito: o aviso só preenche o
// nome, se estiver em branco. Quem paga às vezes escreve o e-mail no lugar
// do nome: isso não vira nome.
async function ensureCustomer(address: string, rawName: unknown) {
  const name = text(rawName).replace(/\s+/g, ' ');
  const cleanName = name.includes('@') ? '' : name.slice(0, 120);
  const find = async () => (await db(`latam_customers?email=eq.${eq(address)}&select=id,name&limit=1`))[0] || null;
  const existing = await find();
  if (existing) {
    if (cleanName && !text(existing.name)) {
      // Um dado acessório nunca pode atrasar o acesso.
      try { await db(`latam_customers?id=eq.${existing.id}`, 'PATCH', { name: cleanName }, 'return=minimal'); } catch { /* segue */ }
    }
    return existing.id as string;
  }
  try {
    const [created] = await db('latam_customers', 'POST', { email: address, ...(cleanName ? { name: cleanName } : {}) });
    return created.id as string;
  } catch (erro) {
    // Dois avisos da mesma cliente nova chegando juntos (a KashPay e a Whop):
    // quem perde a corrida usa o cadastro que o outro acabou de criar.
    if (isConflict(erro)) {
      const winner = await find();
      if (winner) return winner.id as string;
    }
    throw erro;
  }
}

// A mesma regra da latam-whop: liberar é "deixar ativo até a data mais
// longe". Repetir o aviso não duplica nada (a chave é cliente + produto), e a
// ordem dos avisos não importa. Uma compra nova reativa quem tinha sido
// retirada à mão: ela pagou de novo.
async function grantAccess(customerId: string, paidAt: string | null, transactionId: string) {
  const start = Date.parse(paidAt || '') || Date.now();
  const until = new Date(start + ACCESS_DAYS * 86_400_000).toISOString();
  const path = `latam_access?customer_id=eq.${customerId}&product=eq.app`;
  const [existing] = await db(`${path}&select=status,expires_at`);
  const stamp = now();
  if (existing) {
    if (existing.status === 'active' && (!existing.expires_at || Date.parse(existing.expires_at) >= Date.parse(until))) {
      return existing.expires_at ? `já tinha acesso até ${String(existing.expires_at).slice(0, 10)}` : 'já tinha acesso sem prazo';
    }
    const furthest = existing.expires_at && Date.parse(existing.expires_at) > Date.parse(until) ? existing.expires_at : until;
    await db(path, 'PATCH', {
      status: 'active', expires_at: furthest, kashpay_transaction_id: transactionId, granted_at: stamp, revoked_at: null, updated_at: stamp,
    }, 'return=minimal');
    return `acesso até ${String(furthest).slice(0, 10)}`;
  }
  try {
    await db('latam_access', 'POST', {
      customer_id: customerId, product: 'app', status: 'active', source: 'kashpay',
      expires_at: until, kashpay_transaction_id: transactionId, granted_at: stamp, updated_at: stamp,
    }, 'return=minimal');
  } catch (erro) {
    // A Whop liberou no mesmo instante: o acesso já existe, e está certo.
    if (!isConflict(erro)) throw erro;
    return 'liberado no mesmo instante pelo aviso da Whop';
  }
  return `acesso até ${until.slice(0, 10)}`;
}

Deno.serve(async (req: Request) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > 512_000) return respond({ error: 'Aviso grande demais.' }, 413);
  const signatureHeader = req.headers.get('x-kashpay-signature');
  const assinatura = await verify(signatureHeader, bytes);
  if (!assinatura.ok) {
    console.error('latam-kashpay assinatura-recusada', JSON.stringify({
      motivo: assinatura.motivo,
      evento: text(req.headers.get('x-kashpay-event')) || null,
      cabecalho: signatureHeader ? (/^sha256=/i.test(signatureHeader.trim()) ? 'sha256=…' : 'sem o prefixo sha256=') : 'ausente',
    }));
    return respond({ error: 'Não autorizado.' }, 401);
  }

  let payload: Json | null = null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
  } catch { /* tratado abaixo */ }
  if (!payload) return respond({ error: 'JSON inválido.' }, 400);

  const event = (text(payload.event) || text(req.headers.get('x-kashpay-event')) || 'unknown').slice(0, 60);
  const data = obj(payload.data);
  const tracking = obj(data.tracking);
  const notes: string[] = [];
  let status = 'recorded';

  // Monta as ofertas só com id, nome, tipo, quantidade e total.
  const rawOffers = Array.isArray(data.offers) ? data.offers : null;
  const offers: Offer[] = (rawOffers || []).map((item: unknown) => {
    const offer = obj(item);
    return {
      id: text(offer.id).slice(0, 100),
      name: text(offer.name).slice(0, 200),
      type: text(offer.type).slice(0, 50),
      quantity: integer(offer.quantity),
      total: integer(offer.total),
      produto: null,
    };
  });

  try {
    if (!rawOffers) {
      // Formato diferente do da documentação: guarda para alguém olhar, sem
      // contar no Hub. Pode ser de outra operação; por isso não conta.
      status = 'needs_review';
      notes.push(`Aviso sem a lista de ofertas (data.offers): não deu para saber se é do 7 Amenes. ${shapeOf(payload, data)}.`);
    } else if (!offers.length) {
      console.log('latam-kashpay sem-ofertas', JSON.stringify({ evento: event }));
      return respond({ ok: true, gravado: false, motivo: 'pedido sem ofertas' });
    } else {
      const map = offers.every(offer => byName(offer.name)) ? new Map<string, string>() : await offerMap();
      for (const offer of offers) offer.produto = (offer.id && map.get(offer.id)) || byName(offer.name);
      const ours = offers.some(offer => NOSSOS.has(offer.produto || ''));
      const generic = offers.filter(offer => !offer.produto && NOME_DE_PRECO.test(plain(offer.name)));
      if (!ours && !generic.length) {
        // Outra operação da conta: nada é gravado. Só a contagem, sem conteúdo.
        console.log('latam-kashpay outra-operacao', JSON.stringify({ evento: event }));
        return respond({ ok: true, gravado: false, motivo: 'pedido de outra operação' });
      }
      if (!ours) {
        status = 'needs_review';
        notes.push(`Oferta de nome genérico (${generic.map(offer => `"${offer.name}", id ${offer.id || 'sem id'}`).join('; ')}): pode ser de outra operação. Não conta no Hub até o id ser confirmado em latam_kashpay_offers.`);
      }
    }

    let transactionId = text(data.id).slice(0, 100);
    if (!transactionId) {
      // Sem o id do pedido não há chave contra repetição; a impressão digital
      // do corpo serve, porque a KashPay repete o mesmo corpo.
      transactionId = `sem-id-${(await sha256Hex(bytes)).slice(0, 32)}`;
      status = 'needs_review';
      notes.push(`Aviso sem data.id. ${shapeOf(payload, data)}.`);
    }

    const amount = integer(data.amount);
    if (data.amount !== undefined && data.amount !== null && amount === null) notes.push('data.amount fora do formato (inteiro em centavos): gravado em branco.');
    const produtos = [...new Set(offers.map(offer => offer.produto || '').filter(produto => NOSSOS.has(produto)))];

    // A liberação vem ANTES de gravar o pedido. Se ela falhar, nada é gravado
    // e a resposta 500 faz a KashPay tentar de novo. Gravado primeiro, a
    // repetição cairia em "duplicado" e a cliente ficaria de fora.
    // Qualquer pedido pago do 7 Amenes libera o app, upsell inclusive (a mesma
    // regra da latam-whop): ela não compra upsell sem ter comprado o app.
    // Pedido 'needs_review' não libera: não dá para ter certeza de que é nosso.
    let customerId: string | null = null;
    if (event === 'order.paid' && status === 'recorded' && produtos.length) {
      const customer = obj(data.customer);
      const address = text(customer.email).toLowerCase();
      if (!validEmail(address)) {
        notes.push('Pedido pago sem e-mail utilizável em data.customer.email: o app NÃO foi liberado. Liberar à mão no /es-admin.');
        console.error('latam-kashpay SEM_EMAIL', JSON.stringify({ evento: event, transacao: transactionId, campos_customer: Object.keys(customer).sort() }));
      } else {
        customerId = await ensureCustomer(address, customer.name);
        notes.push(`App liberado: ${await grantAccess(customerId, when(data.paid_at), transactionId)}.`);
      }
    }

    const record = {
      event,
      transaction_id: transactionId,
      order_status: text(data.status).slice(0, 40),
      amount_cents: amount,
      net_amount_cents: integer(data.net_amount),
      currency: text(data.currency).toUpperCase().slice(0, 10),
      payment_method: text(data.payment_method).slice(0, 40),
      offers: offers.map(offer => ({ ...offer, produto: NOSSOS.has(offer.produto || '') ? offer.produto : null })),
      produtos,
      order_created_at: when(data.created_at),
      paid_at: when(data.paid_at),
      refunded_at: when(data.refunded_at),
      chargeback_at: when(data.chargeback_at),
      event_created_at: when(payload.created_at),
      utm_source: tracked(tracking.utm_source),
      utm_medium: tracked(tracking.utm_medium),
      utm_campaign: tracked(tracking.utm_campaign),
      utm_content: tracked(tracking.utm_content),
      utm_term: tracked(tracking.utm_term),
      src: tracked(tracking.src),
      ref: tracked(tracking.ref),
      sck: tracked(tracking.sck),
      vtid: tracked(tracking.vtid),
      // Só vai quando existe: o pedido que não libera nada (reembolso,
      // outra situação) continua igual ao de antes de 08/11.
      ...(customerId ? { customer_id: customerId } : {}),
      status,
      detail: (status === 'recorded' ? `Gravado: ${produtos.join(', ')}.` : notes.shift() || 'Para conferir.') + (notes.length ? ` ${notes.join(' ')}` : ''),
    };

    // O on_conflict é obrigatório: sem ele o banco só ignora repetição pela
    // chave padrão, e o mesmo aviso de novo voltava erro 409 (a lição da
    // Payt, 16/10/2026).
    const saved = await db('latam_kashpay_events?on_conflict=event,transaction_id&select=event', 'POST', record,
      'return=representation,resolution=ignore-duplicates');
    if (!saved || !saved.length) return respond({ ok: true, duplicated: true, liberado: Boolean(customerId) });
    return respond({ ok: true, gravado: true, status, liberado: Boolean(customerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    // Sem dado de pessoa: dá para regravar à mão a partir daqui, se a KashPay
    // esgotar as 3 tentativas.
    console.error('latam-kashpay EVENTO_NAO_GRAVADO', JSON.stringify({
      falha: message, evento: event, transacao: text(data.id) || null, valor: integer(data.amount), moeda: text(data.currency) || null,
      pago_em: when(data.paid_at), utm_content: tracked(tracking.utm_content),
    }));
    // 500 faz a KashPay tentar de novo (depois de 30 s e de 3 min).
    return respond({ error: 'Falha ao gravar o evento.' }, 500);
  }
});
