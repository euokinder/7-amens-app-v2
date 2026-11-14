// en-digistore: o aviso (IPN) da Digistore24 para o app em inglês
// (7 Amens Before Dawn, setemadrugadas.com.br/en).
//
// CÓPIA da latam-digistore (o app em espanhol), com quatro diferenças:
//   1. só tabelas en_* (en_digistore_events, en_digistore_products,
//      en_customers, en_access). Não lê nem escreve nada do Brasil nem da LATAM;
//   2. os números dos produtos moram numa TABELA (en_digistore_products,
//      supabase/en/13-digistore.sql), não no código: oferta nova é uma linha
//      de SQL, sem publicar a função de novo;
//   3. um pagamento pode trazer mais de um produto (product_id, product_id_2,
//      product_id_3…, como diz o guia oficial): todos são lidos;
//   4. a origem gravada em en_access é 'checkout', a que o app em inglês
//      reservou para "a venda" (01-tabelas.sql): é ela que o painel mostra
//      como "from the purchase" e que a Lucy conta como compradora
//      (en_chat_posicao, 10-chat.sql). Quem cobrou fica em en_digistore_events.
//
// A conta da Digistore dos EUA é OUTRA, separada da da LATAM (Arthur, 14/11):
// outra senha do IPN e outros números de produto.
//
//   on_payment de um produto conhecido  → app por 12 meses ("ativo até a data
//                                         mais longe"); Arcanjos e Cântico
//                                         também liberam o extra
//   on_payment de produto desconhecido  → needs_review, NADA é liberado
//   on_refund / on_chargeback / outros  → só registra (reembolso e disputa
//                                         não tiram o acesso: a regra do
//                                         espanhol, que o inglês copia)
//   connection_test                     → só responde OK
//
// Toda leitura de compra do app (extras, pop-ups, painel, reembolso) passa
// pela visão en_pedidos_pagos, que desde o 13-digistore.sql lê
// en_digistore_events.
//
// DADO PESSOAL, o mínimo (a mesma regra do espanhol): o e-mail, o nome e o
// país vão SÓ para en_customers, que é o login dela. A linha do aviso leva o
// customer_id, nunca o e-mail. O corpo do aviso não é guardado, e os
// registros (console) não levam dado de pessoa.
//
// Fonte: o guia oficial do IPN (digistore24.com/download/ipn/examples/ipn/
// digistore_ipn.pdf, lido de novo em 14/11/2026). Pontos que mandam aqui:
//   - "An order consists one initial sale and up to three upsells": o upsell
//     tem o MESMO order_id da compra principal; cada item é uma transação
//     (transaction_id próprio) e um aviso próprio;
//   - a mesma transação pode ter product_id_2, product_id_3…;
//   - o aviso NÃO traz os números do cartão (por isso o resgate pelo cartão
//     não acha quem comprou pela Digistore);
//   - a Digistore só dá o aviso por entregue com o texto exato "OK", em até
//     30 s; sem ele, repete.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// O banco de TESTE (o mesmo do localhost; ninguém de verdade dentro).
const BANCO_DE_TESTE = base.includes('wyiqwsgfictcfkytldnu');
// A senha do IPN ("SHA512 passphrase" na tela da Digistore). Só no banco de
// TESTE, e só enquanto a senha de verdade não estiver lá, vale uma senha de
// ensaio: ela está escrita aqui, num repositório público, e por isso nunca
// vale na produção.
const SENHA_DE_ENSAIO = 'ds24_ensaio_somente_no_banco_de_teste_en';
const ipnPassword = (Deno.env.get('EN_DIGISTORE_IPN_PASSWORD') || (BANCO_DE_TESTE ? SENHA_DE_ENSAIO : '')).trim();

// Os produtos que liberam um extra além do app (05-extras.sql). Os outros
// produtos conhecidos (principal, aporte, tres_madrugadas) liberam só o app.
const EXTRAS = new Set(['arcangeles', 'cantico']);
// A compra libera o app por 12 meses (decisão do espanhol, copiada; a
// Digistore proíbe acesso "vitalício").
const ACCESS_DAYS = 365;
// Quantos produtos um mesmo pagamento pode trazer (product_id … product_id_9).
const MAX_ITENS = 9;

// A Digistore espera a resposta em até 30 s. Cada tentativa no banco tem 4 s.
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

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const eq = (value: string) => encodeURIComponent(value);
const now = () => new Date().toISOString();
const isConflict = (error: unknown) => (error as { status?: number })?.status === 409;
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
// "27.00" ou "27,00" → 27. Outra coisa vira nulo, nunca um número adivinhado.
function money(value: unknown) {
  const raw = text(value).replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && Math.abs(number) < 1e9 ? Math.round(number * 100) / 100 : null;
}
// O utm como veio, com duas limpezas: o que vem depois de "::" (o código do
// clique, que o Hub não usa) e qualquer e-mail colado num link.
function tracked(value: unknown) {
  const cleaned = text(value).split('::')[0].replace(/[^\s@|:]+@[^\s@|:]+\.[^\s@|:]+/g, '[e-mail]').trim().slice(0, 300);
  return cleaned || null;
}

// ------------------------------------------------------------ assinatura
// O guia oficial: tirar o sha_sign; pular os campos vazios ("0" fica);
// ordenar pelo nome do campo sem diferenciar maiúscula; juntar
// nome=valor+SENHA para CADA campo; SHA-512 em hexadecimal MAIÚSCULO.
// Conferido contra o exemplo do guia (buyer_email, order_id, payment_id,
// transaction_amount, transaction_currency, senha "xxxxx"). Igual à da
// latam-digistore.
export async function digistoreSignature(fields: [string, string][], password: string) {
  const usable = fields.filter(([key, value]) => key !== 'sha_sign' && key !== 'SHASIGN' && value !== '');
  usable.sort(([a], [b]) => {
    const la = a.toLowerCase(), lb = b.toLowerCase();
    return la < lb ? -1 : la > lb ? 1 : a < b ? -1 : a > b ? 1 : 0;
  });
  const joined = usable.map(([key, value]) => `${key}=${value}${password}`).join('');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(joined)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Comparação em tempo constante: uma assinatura errada não se adivinha letra a letra.
function sameToken(received: string, expected: string) {
  if (!expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

async function verify(fields: [string, string][]): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!ipnPassword) return { ok: false, motivo: 'senha EN_DIGISTORE_IPN_PASSWORD não configurada' };
  const received = (fields.find(([key]) => key === 'sha_sign' || key === 'SHASIGN')?.[1] || '').trim().toUpperCase();
  if (!received) return { ok: false, motivo: 'sem o campo sha_sign' };
  if (!/^[0-9A-F]{128}$/.test(received)) return { ok: false, motivo: 'sha_sign fora do formato (128 letras hexadecimais)' };
  const expected = await digistoreSignature(fields, ipnPassword);
  return sameToken(received, expected) ? { ok: true } : { ok: false, motivo: 'assinatura não confere com a senha' };
}

// ------------------------------------------------------------ os produtos
// Os itens do pagamento: product_id/product_name, depois product_id_2/
// product_name_2 e assim por diante (o guia oficial).
function itensDo(get: (key: string) => string) {
  const itens: { id: string; nome: string }[] = [];
  for (let n = 1; n <= MAX_ITENS; n += 1) {
    const sufixo = n === 1 ? '' : `_${n}`;
    const id = get(`product_id${sufixo}`).slice(0, 40);
    if (!id) continue;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) continue; // número de produto é número
    if (itens.some(item => item.id === id)) continue;
    itens.push({ id, nome: get(`product_name${sufixo}`).slice(0, 120) });
  }
  return itens;
}

// O que cada número de produto é, pela tabela en_digistore_products. Erro do
// banco aqui sobe: a resposta 500 faz a Digistore tentar de novo.
async function produtosDe(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const linhas = await db(`en_digistore_products?product_id=in.(${ids.map(eq).join(',')})&select=product_id,produto`);
  return new Map<string, string>((linhas || []).map((l: { product_id: string; produto: string }) => [String(l.product_id), String(l.produto)]));
}

// ------------------------------------------------------------ a liberação
// O e-mail da compra é o login dela. Cliente que já existe não tem nada
// sobrescrito: o aviso só preenche o nome e o país, se estiverem em branco.
async function ensureCustomer(address: string, rawName: string, country: string) {
  const name = rawName.replace(/\s+/g, ' ').trim();
  const cleanName = name.includes('@') ? '' : name.slice(0, 120);
  const find = async () => (await db(`en_customers?email=eq.${eq(address)}&select=id,name,country&limit=1`))[0] || null;
  const existing = await find();
  if (existing) {
    const faltando: Record<string, string> = {};
    if (cleanName && !text(existing.name)) faltando.name = cleanName;
    if (country && !text(existing.country)) faltando.country = country;
    if (Object.keys(faltando).length) {
      // Um dado acessório nunca pode atrasar o acesso.
      try { await db(`en_customers?id=eq.${existing.id}`, 'PATCH', faltando, 'return=minimal'); } catch { /* segue */ }
    }
    return existing.id as string;
  }
  try {
    const [created] = await db('en_customers', 'POST', {
      email: address, ...(cleanName ? { name: cleanName } : {}), ...(country ? { country } : {}),
    });
    return created.id as string;
  } catch (erro) {
    // Outro aviso (ou o painel) criou a mesma cliente no mesmo instante: usa a dela.
    if (isConflict(erro)) {
      const winner = await find();
      if (winner) return winner.id as string;
    }
    throw erro;
  }
}

// "Ativo até a data mais longe", como no espanhol. Repetir o aviso não
// duplica nada (a chave é cliente + produto). Uma compra nova reativa quem
// tinha sido retirada à mão: ela pagou de novo.
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

// O extra não tem prazo próprio: vale enquanto o app valer (05-extras.sql).
// Já ativo (pelo painel ou por outra compra): fica como está. Retirado: volta,
// porque ela pagou de novo.
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

const OK = () => new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (message: string, status: number) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail('Método não permitido.', 405);
  const raw = await req.text();
  if (raw.length > 256_000) return fail('Aviso grande demais.', 413);

  // A Digistore manda o aviso como formulário (POST comum). Por garantia,
  // aceita também JSON plano.
  let fields: [string, string][] = [];
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        fields = Object.entries(parsed).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]);
      }
    } catch { /* tratado abaixo */ }
  } else {
    // Campo repetido: vale o último, como no PHP do exemplo oficial.
    const last = new Map<string, string>();
    for (const [key, value] of new URLSearchParams(raw)) last.set(key, value);
    fields = [...last.entries()];
  }
  if (!fields.length) return fail('Aviso vazio.', 400);

  const assinatura = await verify(fields);
  const get = (key: string) => text(fields.find(([name]) => name === key)?.[1]);
  const event = (get('event') || 'unknown').slice(0, 60);
  if (!assinatura.ok) {
    console.error('en-digistore assinatura-recusada', JSON.stringify({ motivo: assinatura.motivo, evento: event }));
    return fail('Não autorizado.', 401);
  }

  // O "Test connection" da tela da Digistore.
  if (event === 'connection_test') {
    console.log('en-digistore teste-de-conexao', JSON.stringify({ ok: true }));
    return OK();
  }

  const itens = itensDo(get);
  const apiMode = get('api_mode').toLowerCase().slice(0, 10);
  const notes: string[] = [];
  let status = 'recorded';

  try {
    let transactionId = get('transaction_id').slice(0, 100);
    if (!transactionId) {
      // Sem a chave contra repetição: usa o pagamento ou o pedido.
      transactionId = (get('payment_id') || (get('order_id') ? `pedido-${get('order_id')}` : '')).slice(0, 100);
      if (!transactionId) {
        console.error('en-digistore SEM_TRANSACAO', JSON.stringify({ evento: event, campos: fields.map(([k]) => k).sort().join(',') }));
        return OK(); // Nada a fazer; repetir não ajudaria.
      }
      notes.push('Aviso sem transaction_id: a chave é o pagamento ou o pedido.');
    }

    // O que é cada item, pela tabela. Só o que está lá é nosso: nada é
    // reconhecido pelo nome, nada é adivinhado.
    const mapa = await produtosDe(itens.map(item => item.id));
    const conhecidos = [...new Set(itens.map(item => mapa.get(item.id)).filter((p): p is string => Boolean(p)))];
    const desconhecidos = itens.filter(item => !mapa.has(item.id));

    if (!itens.length) {
      status = 'needs_review';
      notes.unshift('Aviso sem número de produto: nada foi liberado.');
    } else if (desconhecidos.length) {
      status = 'needs_review';
      const lista = desconhecidos.map(item => `${item.id} "${item.nome}"`).join(', ');
      notes.unshift(conhecidos.length
        ? `Produto não cadastrado em en_digistore_products (${lista}): esse item NÃO foi liberado; os outros foram.`
        : `Produto não cadastrado em en_digistore_products (${lista}): nada foi liberado. Se for do 7 Amens, cadastrar o número e liberar à mão no /en-admin.`);
    }
    // Compra de teste (Testpay) na produção: registra, não libera.
    const isTest = apiMode !== '' && apiMode !== 'live';
    if (isTest && !BANCO_DE_TESTE) {
      status = 'ignored';
      notes.unshift(`Compra de teste (api_mode=${apiMode}) na produção: nada foi liberado.`);
    }

    // A liberação vem ANTES de gravar o aviso. Se ela falhar, nada é gravado
    // e a resposta 500 faz a Digistore tentar de novo. Gravado primeiro, a
    // repetição cairia em "duplicado" e a cliente ficaria de fora.
    let customerId: string | null = null;
    if (event === 'on_payment' && conhecidos.length && status !== 'ignored') {
      const address = (get('email') || get('buyer_email') || get('address_email')).toLowerCase();
      if (!validEmail(address)) {
        status = 'needs_review';
        notes.push('Pagamento sem e-mail utilizável: o app NÃO foi liberado. Liberar à mão no /en-admin.');
        console.error('en-digistore SEM_EMAIL', JSON.stringify({ evento: event, transacao: transactionId }));
      } else {
        const name = `${get('address_first_name')} ${get('address_last_name')}`;
        const country = (get('country') || get('address_country')).toUpperCase();
        customerId = await ensureCustomer(address, name, /^[A-Z]{2}$/.test(country) ? country : '');
        notes.push(`App: ${await grantApp(customerId)}.`);
        for (const produto of conhecidos) {
          if (EXTRAS.has(produto)) notes.push(`Extra: ${await grantExtra(customerId, produto)}.`);
        }
      }
    } else if (event !== 'on_payment' && status === 'recorded') {
      notes.push('Só registro: reembolso e disputa não tiram o acesso (regra do app em inglês).');
    }

    const record = {
      event,
      transaction_id: transactionId,
      order_id: get('order_id').slice(0, 40) || null,
      product_id: itens[0]?.id || null,
      product_ids: itens.map(item => item.id).join(',') || null,
      product_name: itens.map(item => item.nome).filter(Boolean).join(' + ').slice(0, 250) || null,
      produtos: conhecidos.length ? conhecidos : null,
      api_mode: apiMode || null,
      amount: money(get('amount_brutto') || get('transaction_amount')),
      currency: (get('currency') || get('transaction_currency')).toUpperCase().slice(0, 10) || null,
      pay_method: get('pay_method').slice(0, 40) || null,
      country: (get('country') || get('address_country')).toUpperCase().slice(0, 2) || null,
      utm_source: tracked(get('utm_source')),
      utm_medium: tracked(get('utm_medium')),
      utm_campaign: tracked(get('utm_campaign')),
      utm_content: tracked(get('utm_content')),
      utm_term: tracked(get('utm_term')),
      campos: fields.map(([key]) => key).sort().join(',').slice(0, 4000),
      ...(customerId ? { customer_id: customerId } : {}),
      status,
      detail: (status === 'recorded' && conhecidos.length ? `Gravado: ${conhecidos.join(' + ')}. ` : '') + notes.join(' '),
    };

    // O on_conflict é obrigatório: sem ele o banco só ignora repetição pela
    // chave padrão, e o mesmo aviso de novo voltava erro 409 (lição da Payt).
    await db('en_digistore_events?on_conflict=event,transaction_id', 'POST', record, 'return=minimal,resolution=ignore-duplicates');
    console.log('en-digistore gravado', JSON.stringify({ evento: event, produtos: conhecidos, status, liberado: Boolean(customerId) }));
    return OK();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    // Sem dado de pessoa: dá para refazer à mão a partir daqui.
    console.error('en-digistore EVENTO_NAO_GRAVADO', JSON.stringify({
      falha: message, evento: event, transacao: get('transaction_id') || null, pedido: get('order_id') || null,
      produtos: itens.map(item => item.id).join(',') || null,
    }));
    // Sem o "OK", a Digistore tenta de novo (3 min depois, e assim por diante).
    return fail('Falha ao gravar o aviso.', 500);
  }
});
