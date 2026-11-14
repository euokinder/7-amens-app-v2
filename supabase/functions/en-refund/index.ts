// en-refund: o reembolso em um toque do app em inglês (7 Amens Before Dawn).
//
// CÓPIA da latam-reembolso (o app em espanhol, 13/11/2026), traduzida.
// Por quê, no espanhol: de 05 a 09/11, 12 clientes foram ao banco ("não fui
// eu") em vez de pedir o dinheiro para nós, e cada chargeback custa a venda +
// até US$ 44 de taxas e pesa na saúde da conta. Decisão do Caio (13/11): pedir
// para nós tem de ser MAIS FÁCIL que pedir ao banco. Plano e telas:
// docs/app-es.md, seção "O reembolso em um toque", e docs/app-en.md.
//
// SEPARADA da en-api de propósito: entrar, rezar e os pop-ups não
// dependem desta função, e esta não mexe em nada deles. Lê as compras e grava
// só em en_refund_requests (supabase/en/11-reembolso.sql). Nada do Brasil e
// nada latam_*.
//
// NÃO DEVOLVE DINHEIRO. Só registra o pedido. Quem devolve é a equipe: no
// chat do dia, o agente mostra a fila ao Arthur e, com o "sim" dele, devolve
// e marca o pedido como 'feito'.
// ⏳ EUA: checkout — a devolução em si acontece no painel (ou na API) do
// checkout americano, que ainda não existe. Esta função não chama nenhum
// serviço de pagamento, e não vai chamar: o "sim" da equipe vem antes.
//
// As compras vêm da visão en_pedidos_pagos (supabase/en/02-compras.sql), que
// fica VAZIA até o checkout existir: a página mostra "sem compra", e ela pode
// pedir mesmo assim (sin_compra: a equipe procura a compra).
//
// As mensagens que a cliente lê são em inglês. Os nomes dos campos e os
// códigos do motivo continuam os do espanhol (a página js/en/reembolso.js é
// cópia da do espanhol).
//
// Ações (POST, JSON, sem login: quem não consegue entrar também pede):
//   compras  {email}            -> as compras desse e-mail, para ela marcar
//   pedir    {email, pedidos[]} -> grava o pedido com o que ela marcou.
//            {email, sin_compra: true} -> grava sem compra achada (a equipe procura)
//   motivo   {id, motivo}       -> o motivo opcional, depois do pedido
//
// O e-mail passa pela mesma correção da /en-login (gmial.com, .con, espaço,
// acento): o bloco abaixo é cópia do da en-api. Se mudar lá, mudar aqui.
//
// Freios (en_permite, de 09-resgate.sql, por impressão digital do IP):
// buscar compras 30 por hora; pedir 10 por hora. Decisão do Caio (13/11): o
// risco de alguém ver as compras de outro e-mail é muito baixo; o dinheiro só
// volta para o cartão de quem pagou, e todo pedido passa pelo "sim" da equipe.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const allowedOrigins = new Set([
  'https://setemadrugadas.com.br',
  'https://www.setemadrugadas.com.br',
]);
const allowedNetlifyPreview = /^https:\/\/[a-z0-9][a-z0-9-]*--7madrugadas\.netlify\.app$/;
const allowedLocalOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const RETRIABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const encoder = new TextEncoder();

async function db(path: string, method = 'GET', body?: unknown, prefer = 'return=representation') {
  let lastError: Error & { status?: number } = new Error(`Database call never ran on ${path}`);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await wait(attempt * 300);
    let response: Response;
    try {
      response = await fetch(`${base}/rest/v1/${path}`, {
        method,
        headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: prefer },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (networkError) {
      lastError = new Error(`Database unreachable on ${path}: ${networkError instanceof Error ? networkError.message : 'network'}`);
      continue;
    }
    if (response.ok) {
      const answer = await response.text();
      return answer ? JSON.parse(answer) : null;
    }
    lastError = new Error(`Database operation failed (${response.status}) on ${path.split('?')[0]}`);
    lastError.status = response.status;
    if (!RETRIABLE.has(response.status)) throw lastError;
  }
  throw lastError;
}

const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');

const validEmail = (value: unknown) => {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '';
};

const MESSAGES = {
  badEmail: 'Please type the full email you used for your purchase (for example: mary@gmail.com).',
  tooMany: 'There were too many attempts in a row. Please wait a few minutes and try again.',
  nothingMarked: 'Please check what you would like us to refund.',
  badRequest: 'Invalid request.',
  offline: 'We could not connect right now. Please try again in a moment.',
};

const MOTIVOS = new Set(['no_pude_entrar', 'no_era_lo_que_esperaba', 'no_reconozco', 'cobro_de_mas', 'otro']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// O id de uma cobrança (en_pedidos_pagos.pedido). ⏳ EUA: checkout — no
// espanhol era pay_... (Whop) ou kashpay:...; o formato do checkout americano
// ainda não se sabe, então vale qualquer id simples. A trava de verdade é que
// o pedido tem de estar nas compras achadas para o e-mail dela.
const PEDIDO = /^[A-Za-z0-9][A-Za-z0-9_:.-]{3,119}$/;

// ------------------------------------------------------------------------
// A correção do e-mail: CÓPIA da en-api (de "function distancia" até
// "dominioDe"). Se mudar lá, mudar aqui.
// ------------------------------------------------------------------------
function distancia(a: string, b: string) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  const d: number[][] = Array.from({ length: la + 1 }, (_, i) => Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= la; i += 1) {
    for (let j = 1; j <= lb; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[la][lb];
}

// Domínios de e-mail de verdade: o que ela digitar igual a um destes nunca é
// "corrigido". Na dúvida, um domínio entra na lista: estar aqui só impede a
// correção, e corrigir um domínio de verdade levaria à conta de outra pessoa.
const DOMINIOS_CONHECIDOS = new Set([
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.es', 'hotmail.com.ar', 'hotmail.com.mx', 'hotmail.cl', 'hotmail.com.co', 'hotmail.com.pe', 'hotmail.com.br', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.it', 'hotmail.de',
  'outlook.com', 'outlook.es', 'outlook.com.ar', 'outlook.com.mx', 'outlook.cl', 'outlook.com.co', 'outlook.com.pe', 'outlook.com.br', 'outlook.com.ve',
  'live.com', 'live.com.mx', 'live.com.ar', 'live.cl', 'live.com.co', 'live.com.pe', 'live.com.ve', 'live.es',
  'msn.com', 'passport.com',
  'yahoo.com', 'yahoo.es', 'yahoo.com.mx', 'yahoo.com.ar', 'yahoo.com.co', 'yahoo.com.pe', 'yahoo.cl', 'yahoo.com.ve', 'yahoo.com.br', 'yahoo.com.ec', 'yahoo.com.uy', 'yahoo.com.py', 'yahoo.com.bo', 'yahoo.com.gt', 'yahoo.com.do', 'yahoo.com.pa', 'yahoo.com.sv', 'yahoo.com.hn', 'yahoo.com.ni', 'yahoo.co.cr', 'yahoo.fr', 'yahoo.it', 'yahoo.de', 'yahoo.co.uk',
  'ymail.com', 'rocketmail.com', 'myyahoo.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'mail.com', 'email.com', 'gmx.com', 'gmx.net', 'gmx.es', 'zoho.com', 'yandex.com', 'proton.me', 'protonmail.com', 'tutanota.com', 'inbox.com',
  'att.net', 'sbcglobal.net', 'bellsouth.net', 'comcast.net', 'verizon.net', 'earthlink.net', 'cox.net', 'charter.net', 'optonline.net', 'twc.com', 'frontier.com', 'juno.com', 'netzero.net',
  'prodigy.net.mx', 'terra.com', 'terra.com.mx', 'terra.cl', 'terra.com.br', 'speedy.com.ar', 'fibertel.com.ar', 'arnet.com.ar', 'cantv.net', 'etb.net.co', 'une.net.co', 'movistar.cl', 'tutopia.com', 'uol.com.br', 'bol.com.br', 'ig.com.br',
]);
// Os provedores grandes, pelo nome antes do ponto: 'gmial' vira gmail.com.
const PROVEDORES: Record<string, string> = {
  gmail: 'gmail.com', hotmail: 'hotmail.com', outlook: 'outlook.com', yahoo: 'yahoo.com',
  icloud: 'icloud.com', ymail: 'ymail.com', live: 'live.com', aol: 'aol.com', msn: 'msn.com',
};
// O final digitado errado no lugar de ".com".
const FINAL_ERRADO = new Set(['con', 'cpm', 'vom', 'xom', 'cim', 'comm', 'coom', 'cmo', 'ocm', 'om', 'cm', 'como', 'conm', 'comn', 'vcom', 'cpom']);
const SIGLA_DE_PAIS = /^[a-z]{2}$/;

// O provedor que ela quis dizer: o nome exato, ou o grande mais perto (até 2
// letras), se só um ficar mais perto. Nomes curtos (live, aol, msn) só exatos.
function provedorDe(nome: string) {
  if (PROVEDORES[nome]) return nome;
  if (nome.length < 3) return '';
  let melhor = '';
  let menor = 99;
  let empate = false;
  for (const provedor of Object.keys(PROVEDORES)) {
    if (provedor.length < 5) continue;
    const d = distancia(nome, provedor);
    if (d < menor) { melhor = provedor; menor = d; empate = false; } else if (d === menor) empate = true;
  }
  return melhor && !empate && menor <= 2 ? melhor : '';
}

// O domínio que ela quis dizer: gmsil.com, gmail.con, gmail.comba,
// hotmail.com.como e iclod.con viram gmail.com, hotmail.com e icloud.com.
// yajoo.com.mx vira yahoo.com.mx. Domínio desconhecido só perde o final
// errado (empresa.con vira empresa.com).
function corrigirDominio(dominio: string) {
  if (!dominio || DOMINIOS_CONHECIDOS.has(dominio)) return dominio;
  const partes = dominio.split('.').filter(Boolean);
  const ultimo = partes[partes.length - 1] || '';
  if (partes.length >= 2 && FINAL_ERRADO.has(ultimo)) {
    const soOFinal = [...partes.slice(0, -1), 'com'].join('.');
    if (DOMINIOS_CONHECIDOS.has(soOFinal)) return soOFinal;
  }
  let nome = partes[0] || '';
  const resto = partes.slice(1);
  if (!resto.length && nome.length > 6 && nome.endsWith('com')) nome = nome.slice(0, -3); // hotmailcom
  const provedor = provedorDe(nome);
  if (!provedor) return partes.length === 2 && FINAL_ERRADO.has(ultimo) ? `${nome}.com` : dominio;
  // A variação do provedor no país dela, se existir: yahoo.com.mx, hotmail.es.
  // "hotmail.co" é ".com" cortado (o erro clássico), não Colômbia: com uma
  // parte só depois do nome, vale só provedor.país que exista na lista.
  const pais = resto.length === 2 && SIGLA_DE_PAIS.test(resto[1]) ? resto[1]
    : resto.length === 1 && SIGLA_DE_PAIS.test(resto[0]) ? resto[0] : '';
  if (pais) {
    const opcao = resto.length === 2 ? `${provedor}.com.${pais}` : `${provedor}.${pais}`;
    if (DOMINIOS_CONHECIDOS.has(opcao)) return opcao;
  }
  return PROVEDORES[provedor];
}

// O e-mail sem os tropeços de quem digita no celular: espaço, aspas, acento,
// maiúscula, vírgula no lugar do ponto, @ ou ponto repetido.
function limparCorreo(valor: unknown) {
  if (typeof valor !== 'string') return '';
  // \p{M} = os acentos soltos depois do NFD (o mesmo que a faixa U+0300-U+036F da en-api).
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/[\s"'<>()[\]]/g, '')
    .replace(/[,;:]/g, '.')
    .replace(/@{2,}/g, '@')
    .replace(/\.{2,}/g, '.')
    .replace(/\.+@/g, '@')
    .replace(/@\.+/g, '@')
    .replace(/^\.+|\.+$/g, '');
}
function corrigirCorreo(valor: unknown) {
  const limpo = limparCorreo(valor);
  const arroba = limpo.lastIndexOf('@');
  if (arroba < 1) return limpo;
  return `${limpo.slice(0, arroba)}@${corrigirDominio(limpo.slice(arroba + 1))}`;
}

// ------------------------------------------------------------------------
// As compras
// ------------------------------------------------------------------------
type Compra = {
  pedido: string; origem: string; produto: string; nombre: string; valor_cents: number;
  moneda: string; pagado_en: string; devuelto: boolean; pedido_abierto: boolean;
};

const comprasDe = async (email: string): Promise<Compra[]> =>
  (await db('rpc/en_reembolso_compras', 'POST', { p_email: email })) || [];

// Como ela digitou; se não achar nada, o mesmo e-mail limpo e com o domínio
// corrigido (gmial.con -> gmail.com). Devolve o e-mail que achou as compras.
async function buscar(valor: unknown) {
  const original = validEmail(valor);
  const corrigido = validEmail(corrigirCorreo(valor));
  const email = original || corrigido;
  if (!email) return null;
  let compras = await comprasDe(email);
  let usado = email;
  if (!compras.length && corrigido && corrigido !== email) {
    const outras = await comprasDe(corrigido);
    if (outras.length) { compras = outras; usado = corrigido; }
  }
  return { email: usado, corrigido: usado !== original ? usado : '', compras };
}

const paraTela = (c: Compra) => ({
  pedido: c.pedido,
  nombre: c.nombre,
  valor_cents: c.valor_cents,
  moneda: c.moneda,
  fecha: c.pagado_en,
  devuelto: c.devuelto,
  pedido_abierto: c.pedido_abierto,
});

// O freio: true (pode), false (passou do limite). Sem o freio no banco, deixa
// passar: nunca travar quem quer o dinheiro de volta.
async function permite(chave: string, maximo: number, minutos: number) {
  try {
    return (await db('rpc/en_permite', 'POST', { p_chave: await sha256(chave), p_maximo: maximo, p_minutos: minutos })) !== false;
  } catch (error) {
    console.error('en-refund freio', error instanceof Error ? error.message : 'error');
    return true;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': 'https://setemadrugadas.com.br',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const originAllowed = !origin || allowedOrigins.has(origin) || allowedNetlifyPreview.test(origin) || allowedLocalOrigin.test(origin);
  if (!originAllowed) return respond({ error: 'Origin not allowed.' }, 403);
  if (origin) cors['Access-Control-Allow-Origin'] = origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond({ error: MESSAGES.badRequest }, 405);

  try {
    const raw = await req.text();
    if (raw.length > 4096) return respond({ error: MESSAGES.badRequest }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return respond({ error: MESSAGES.badRequest }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ error: MESSAGES.badRequest }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const paisDaConexao = (req.headers.get('cf-ipcountry') || '').toUpperCase();
    const pais = /^[A-Z]{2}$/.test(paisDaConexao) ? paisDaConexao : '';

    // ------------------------------------------------------------ compras
    if (body.action === 'compras') {
      if (!(await permite(`reembolso-compras:${ip}`, 30, 60))) return respond({ error: MESSAGES.tooMany }, 429);
      const achou = await buscar(body.email);
      if (!achou) return respond({ error: MESSAGES.badEmail }, 400);
      return respond({ email: achou.email, corrigido: achou.corrigido, compras: achou.compras.map(paraTela) });
    }

    // -------------------------------------------------------------- pedir
    if (body.action === 'pedir') {
      if (!(await permite(`reembolso-pedir:${ip}`, 10, 60))) return respond({ error: MESSAGES.tooMany }, 429);
      const achou = await buscar(body.email);
      if (!achou) return respond({ error: MESSAGES.badEmail }, 400);
      const [cliente] = await db(`en_customers?email=eq.${encodeURIComponent(achou.email)}&select=id&limit=1`);
      const customerId = cliente ? cliente.id : null;

      // Sem compra achada: grava igual, e a equipe procura (nunca beco sem saída).
      if (body.sin_compra === true && !achou.compras.length) {
        const [linha] = await db('en_refund_requests', 'POST', {
          email: achou.email, customer_id: customerId, sin_compra: true, pais,
        });
        return respond({ ok: true, id: linha.id, total_cents: 0, moneda: 'USD', sin_compra: true });
      }

      const marcados = new Set((Array.isArray(body.pedidos) ? body.pedidos : [])
        .filter((p): p is string => typeof p === 'string' && PEDIDO.test(p)).slice(0, 20));
      const escolhidas = achou.compras.filter(c => marcados.has(c.pedido) && !c.devuelto);
      if (!escolhidas.length) return respond({ error: MESSAGES.nothingMarked }, 400);
      const novas = escolhidas.filter(c => !c.pedido_abierto);
      const moneda = escolhidas[0].moneda || 'USD';
      const total = escolhidas.reduce((soma, c) => soma + (c.valor_cents || 0), 0);
      // Tudo o que ela marcou já estava pedido (tocou duas vezes): só confirma.
      if (!novas.length) return respond({ ok: true, id: null, total_cents: total, moneda, ya_pedido: true });

      const [linha] = await db('en_refund_requests', 'POST', {
        email: achou.email,
        customer_id: customerId,
        itens: novas.map(c => ({
          pedido: c.pedido, origem: c.origem, produto: c.produto, nombre: c.nombre,
          valor_cents: c.valor_cents, moneda: c.moneda, pagado_en: c.pagado_en,
        })),
        total_cents: novas.reduce((soma, c) => soma + (c.valor_cents || 0), 0),
        moneda,
        pais,
      });
      return respond({ ok: true, id: linha.id, total_cents: total, moneda });
    }

    // ------------------------------------------------------------- motivo
    if (body.action === 'motivo') {
      const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : '';
      const motivo = typeof body.motivo === 'string' && MOTIVOS.has(body.motivo) ? body.motivo : '';
      if (!id || !motivo) return respond({ error: MESSAGES.badRequest }, 400);
      // Só o pedido recém-feito (2 h) e só uma vez.
      const desde = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await db(`en_refund_requests?id=eq.${id}&motivo=is.null&created_at=gte.${encodeURIComponent(desde)}`, 'PATCH',
        { motivo, motivo_en: new Date().toISOString() }, 'return=minimal');
      return respond({ ok: true });
    }

    return respond({ error: MESSAGES.badRequest }, 400);
  } catch (error) {
    console.error('en-refund', error instanceof Error ? error.message : 'error');
    return respond({ error: MESSAGES.offline }, 503);
  }
});
