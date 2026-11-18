// latam-reembolso: o reembolso em um toque do app em espanhol (13/11/2026).
//
// Por quê: de 05 a 09/11, 12 clientes da Whop foram ao banco ("não fui eu")
// em vez de pedir o dinheiro para nós, e cada chargeback custa a venda + até
// US$ 44 de taxas e pesa na saúde da conta. Decisão do Caio (13/11): pedir
// para nós tem de ser MAIS FÁCIL que pedir ao banco. Plano e telas:
// docs/app-es.md, seção "O reembolso em um toque".
//
// SEPARADA da latam-api de propósito: entrar, rezar e os pop-ups não
// dependem desta função, e esta não mexe em nada deles. Lê as compras e grava
// só em latam_refund_requests (supabase/latam/11-reembolso.sql).
//
// A página da cliente só REGISTRA o pedido. Quem devolve é a equipe, pelo
// painel /es-reembolsos: à mão (e marca lá) ou, desde 18/11, pelo botão que
// devolve pela API da Whop nova ou da Digistore, com a senha do painel.
//
// Ações (POST, JSON, sem login: quem não consegue entrar também pede):
//   compras  {email}            -> as compras desse e-mail, para ela marcar
//   pedir    {email, pedidos[]} -> grava o pedido com o que ela marcou.
//            {email, sin_compra: true} -> grava sem compra achada (a equipe procura)
//   motivo   {id, motivo}       -> o motivo opcional, depois do pedido
//
// Ações do painel do suporte (/es-reembolsos, 18/11/2026), com a sessão do
// app no cabeçalho x-latam-session e só para quem está em latam_admins:
//   admin_lista, admin_compras {email}, admin_criar {email, pedidos[], nota},
//   admin_atualizar {id, status|nota|email|total_cents|valor_devolvido_cents|motivo},
//   admin_excluir {id}. Banco: supabase/latam/14-painel-reembolsos.sql.
//   admin_localizar {id} (só lê: as compras do e-mail na Whop nova e nas 2
//   Digistores) e admin_reembolsar {id, conta, ref, senha} (DEVOLVE dinheiro
//   pela API). Banco: supabase/latam/15-reembolso-pela-api.sql.
//
// LATAM e EUA no mesmo painel (18/11/2026; supabase/latam/17-painel-latam-eua.sql):
// a lista traz os pedidos de latam_refund_requests e de en_refund_requests,
// cada um com "regiao". As ações sobre um pedido (atualizar, excluir,
// localizar, reembolsar) recebem {regiao: 'eua'} para mexer na tabela en_;
// sem regiao, é LATAM (o painel antigo continua funcionando). O histórico de
// um pedido dos EUA fica em latam_admin_actions, sem target_customer_id
// (ele aponta para latam_customers) e com regiao nos detalhes. Registrar
// pedido novo (admin_compras, admin_criar) continua só LATAM.
//
// O e-mail passa pela mesma correção da /es-entrar (gmial.com, .con, espaço,
// acento): o bloco abaixo é cópia do da latam-api. Se mudar lá, mudar aqui.
//
// Freios (latam_permite, de 09-resgate.sql, por impressão digital do IP):
// buscar compras 30 por hora; pedir 10 por hora. Decisão do Caio (13/11): o
// risco de alguém ver as compras de outro e-mail é muito baixo; o dinheiro só
// volta para o cartão de quem pagou, e todo pedido passa pelo "sim" dele.

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
  badEmail: 'Escribe el correo que usaste en la compra, completo (por ejemplo: maria@gmail.com).',
  tooMany: 'Hubo muchos intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  nothingMarked: 'Marca lo que quieres que te devolvamos.',
  badRequest: 'Solicitud inválida.',
  offline: 'No pudimos conectar ahora. Inténtalo de nuevo en unos instantes.',
};

const MOTIVOS = new Set(['no_pude_entrar', 'no_era_lo_que_esperaba', 'no_reconozco', 'cobro_de_mas', 'otro']);
// O painel aceita também o motivo que só o leitor de e-mails usa (SQL 16):
// comprou o extra sem perceber.
const MOTIVOS_PAINEL = new Set([...MOTIVOS, 'extra_sin_querer']);
const TABELA_DA_REGIAO = { latam: 'latam_refund_requests', eua: 'en_refund_requests' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PEDIDO = /^(pay_[A-Za-z0-9]{6,40}|kashpay:[A-Za-z0-9-]{6,80})$/;

// O painel do suporte (/es-reembolsos, 18/11/2026). Em português: quem usa é a equipe.
const SESSION_TOKEN = /^[a-f0-9]{64}$/;
const STATUS = new Set(['pendente', 'feito', 'desistiu', 'recusado']);
const PAINEL = {
  entrar: 'Sua sessão acabou. Entre de novo com o seu e-mail.',
  proibido: 'Este e-mail não está na equipe. Peça ao Arthur para incluir você.',
  email: 'Escreva um e-mail completo.',
  pedido: 'Pedido inválido.',
  sumiu: 'Esse pedido não existe mais (alguém pode ter excluído).',
  valor: 'Valor inválido.',
};
const textoCurto = (valor: unknown, maximo: number) =>
  typeof valor === 'string' ? valor.replace(/\u0000/g, '').trim().slice(0, maximo) : '';

// ------------------------------------------------------------------------
// Devolver pela API (18/11/2026; supabase/latam/15-reembolso-pela-api.sql).
// Pedido do time: o suporte devolve pelo painel, sem entrar em conta nenhuma.
// Desde 13/11 a Whop antiga está travada; as vendas passam pela Whop nova ou
// pela Digistore, que (ainda) não avisam o app. Por isso a compra é PROCURADA
// pelo e-mail da cliente nas 3 contas, e só uma compra achada assim pode ser
// devolvida (o painel nunca devolve um número digitado à mão).
// As chaves e a senha moram nos segredos do Supabase, nunca no código.
// ------------------------------------------------------------------------
const WHOP_API = 'https://api.whop.com/api/v1';
const WHOP_VERSAO = '2026-11-04-1';
const DIGI_API = 'https://www.digistore24.com/api/call';
const CONTAS_DIGI = [
  { conta: 'digistore_latam', nome: 'Digistore (LATAM)', segredo: 'DIGISTORE_LATAM_API_KEY' },
  // A conta do app em inglês é a dos EUA (en-digistore).
  { conta: 'digistore_en', nome: 'Digistore (EUA)', segredo: 'DIGISTORE_EN_API_KEY' },
] as const;
const CONTA_NOMES: Record<string, string> = { whop_nova: 'Whop nova', digistore_latam: 'Digistore (LATAM)', digistore_en: 'Digistore (EUA)' };
const REF_WHOP = /^pay_[A-Za-z0-9]{6,40}$/;
const REF_DIGI = /^[A-Za-z0-9-]{4,40}$/;
// No banco de TESTE não há chave nenhuma e a senha é de ensaio: dinheiro de
// verdade nunca sai do teste.
const NO_TESTE = base.includes('wyiqwsgfictcfkytldnu');
const SENHA_DE_ENSAIO = 'ensaio-do-painel';
const API_ERRO = {
  semSenha: 'A senha do painel ainda não foi configurada no Supabase (PAINEL_REEMBOLSO_SENHA).',
  senha: 'Senha errada.',
  senhaTravada: 'Muitas senhas erradas. Espere 15 minutos.',
  naoAchou: 'Essa compra não foi encontrada no e-mail deste pedido. Procure de novo.',
  jaDevolvida: 'Essa compra já foi devolvida.',
  disputa: 'Essa compra tem disputa aberta no banco. Não devolva por fora: responda a disputa.',
};

type Achado = {
  plataforma: 'whop' | 'digistore'; conta: string; conta_nome: string; ref: string;
  valor_cents: number; moeda: string; data: string; produto: string;
  situacao: 'paga' | 'devolvida' | 'disputa' | 'outra'; situacao_texto: string; kashpay: string;
};
class SemChave extends Error {}

const centavos = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

async function chamarFora(url: string, init: RequestInit) {
  const resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const texto = await resposta.text();
  let corpo: any = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = null; }
  return { status: resposta.status, ok: resposta.ok, corpo, texto: texto.slice(0, 300) };
}

const whopChave = () => {
  const chave = Deno.env.get('WHOP_NOVA_API_KEY') || '';
  if (!chave) throw new SemChave('Sem a chave da Whop nova (WHOP_NOVA_API_KEY).');
  return chave;
};
const whopCabecalhos = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${whopChave()}`, 'Api-Version-Date': WHOP_VERSAO, Accept: 'application/json', ...extra,
});
const erroWhop = (r: { status: number; corpo: any; texto: string }) =>
  r.status === 401 ? 'a Whop recusou a chave (401)'
    : r.status === 403 ? 'a chave da Whop não tem a permissão (403): confira payment:manage, payment:basic:read, payment:dispute:read e member:email:read'
      : `a Whop respondeu ${r.status}: ${(r.corpo && (r.corpo.error?.message || r.corpo.message)) || r.texto}`;

function achadoDaWhop(p: any): Achado {
  const total = centavos(p?.total?.amount ?? p?.amount_charged?.amount);
  const devolvido = centavos(p?.refunded_amount?.amount);
  const disputa = Boolean(p?.dispute_created_at);
  const situacao = disputa ? 'disputa' : devolvido > 0 && devolvido >= total ? 'devolvida' : p?.status === 'paid' ? 'paga' : 'outra';
  const item = Array.isArray(p?.line_items) ? p.line_items[0] : null;
  return {
    plataforma: 'whop', conta: 'whop_nova', conta_nome: CONTA_NOMES.whop_nova, ref: String(p?.id || ''),
    valor_cents: total, moeda: String(p?.currency || p?.total?.currency || 'usd').toUpperCase(),
    data: String(p?.paid_at || p?.created_at || ''), produto: String(item?.product_title || item?.label || ''),
    situacao,
    situacao_texto: disputa ? 'disputa no banco' : devolvido > 0 ? (devolvido >= total ? 'já devolvida' : 'devolvida em parte') : String(p?.status || ''),
    kashpay: String(p?.metadata?.kashpay_transaction_id || ''),
  };
}

async function procurarNaWhop(email: string): Promise<Achado[]> {
  const url = `${WHOP_API}/payments?query=${encodeURIComponent(email)}&first=20&order=created_at&direction=desc`;
  const r = await chamarFora(url, { headers: whopCabecalhos() });
  if (!r.ok) throw new Error(erroWhop(r));
  const lista = Array.isArray(r.corpo?.data) ? r.corpo.data : [];
  // A busca da Whop também acha nome e usuário: fica só o que é deste e-mail.
  return lista
    .filter((p: any) => !p?.customer_email || String(p.customer_email).toLowerCase() === email)
    .map(achadoDaWhop)
    .filter((a: Achado) => REF_WHOP.test(a.ref));
}

const digiChave = (segredo: string) => {
  const chave = Deno.env.get(segredo) || '';
  if (!chave) throw new SemChave(`Sem a chave da Digistore (${segredo}).`);
  return chave;
};
async function digi(segredo: string, funcao: string, params: Record<string, string>) {
  const url = `${DIGI_API}/${funcao}?${new URLSearchParams(params)}`;
  const r = await chamarFora(url, { method: 'POST', headers: { 'X-DS-API-KEY': digiChave(segredo), Accept: 'application/json' } });
  if (r.corpo?.result === 'success') return r.corpo.data;
  const motivo = (r.corpo && (r.corpo.message || r.corpo.code)) || r.texto || `HTTP ${r.status}`;
  throw new Error(`a Digistore respondeu: ${motivo}`);
}
function situacaoDigi(status: string): Achado['situacao'] {
  const s = status.toLowerCase();
  if (/chargeback|dispute/.test(s)) return 'disputa';
  if (/refund|cancel|revers/.test(s)) return 'devolvida';
  if (/complet|paid|payment|active|success/.test(s)) return 'paga';
  return 'outra';
}
async function procurarNaDigistore(conta: typeof CONTAS_DIGI[number], email: string): Promise<Achado[]> {
  const data = await digi(conta.segredo, 'listPurchasesOfEmail', { email, limit: '20', language: 'en' });
  const lista = Array.isArray(data) ? data : Array.isArray(data?.purchases) ? data.purchases : Array.isArray(data?.purchase_list) ? data.purchase_list : [];
  return lista.map((p: any) => {
    const status = String(p?.status || p?.billing_status || '');
    return {
      plataforma: 'digistore' as const, conta: conta.conta, conta_nome: conta.nome, ref: String(p?.id || p?.purchase_id || ''),
      valor_cents: centavos(p?.amount), moeda: String(p?.currency || 'USD').toUpperCase(),
      data: String(p?.created_at || ''), produto: String(p?.product_name || p?.main_product_name || ''),
      situacao: situacaoDigi(status), situacao_texto: status, kashpay: '',
    };
  }).filter((a: Achado) => REF_DIGI.test(a.ref));
}

// Procura nas 3 contas ao mesmo tempo. Uma conta que falha não derruba as outras.
async function procurarCompras(email: string, so?: string) {
  const buscas: { conta: string; busca: () => Promise<Achado[]> }[] = [];
  if (!so || so === 'whop_nova') buscas.push({ conta: 'whop_nova', busca: () => procurarNaWhop(email) });
  for (const conta of CONTAS_DIGI) if (!so || so === conta.conta) buscas.push({ conta: conta.conta, busca: () => procurarNaDigistore(conta, email) });
  const resultados = await Promise.allSettled(buscas.map(b => b.busca()));
  const achados: Achado[] = [];
  const erros: { conta: string; conta_nome: string; erro: string }[] = [];
  resultados.forEach((r, i) => {
    const conta = buscas[i].conta;
    if (r.status === 'fulfilled') achados.push(...r.value);
    else erros.push({ conta, conta_nome: CONTA_NOMES[conta], erro: r.reason instanceof Error ? r.reason.message : 'erro' });
  });
  return { achados, erros };
}

// Qual compra achada é a deste pedido: a mesma transação da KashPay, ou o
// mesmo valor com no máximo 2 dias de diferença.
function bateComOPedido(a: Achado, itens: any[]) {
  return itens.some(i => {
    if (a.kashpay && i?.pedido === `kashpay:${a.kashpay}`) return true;
    const perto = i?.pagado_en && a.data && Math.abs(Date.parse(i.pagado_en) - Date.parse(a.data)) <= 2 * 86_400_000;
    return Boolean(perto) && Math.abs((Number(i?.valor_cents) || 0) - a.valor_cents) <= 1;
  });
}

const iguais = async (a: string, b: string) => (await sha256(a)) === (await sha256(b));

// ------------------------------------------------------------------------
// A correção do e-mail: CÓPIA da latam-api (de "function distancia" até
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
  // \p{M} = os acentos soltos depois do NFD (o mesmo que a faixa U+0300-U+036F da latam-api).
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
  (await db('rpc/latam_reembolso_compras', 'POST', { p_email: email })) || [];

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
    return (await db('rpc/latam_permite', 'POST', { p_chave: await sha256(chave), p_maximo: maximo, p_minutos: minutos })) !== false;
  } catch (error) {
    console.error('latam-reembolso freio', error instanceof Error ? error.message : 'error');
    return true;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': 'https://setemadrugadas.com.br',
    'Access-Control-Allow-Headers': 'content-type, x-latam-session',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const originAllowed = !origin || allowedOrigins.has(origin) || allowedNetlifyPreview.test(origin) || allowedLocalOrigin.test(origin);
  if (!originAllowed) return respond({ error: 'Origen no permitido.' }, 403);
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
      const [cliente] = await db(`latam_customers?email=eq.${encodeURIComponent(achou.email)}&select=id&limit=1`);
      const customerId = cliente ? cliente.id : null;

      // Sem compra achada: grava igual, e a equipe procura (nunca beco sem saída).
      if (body.sin_compra === true && !achou.compras.length) {
        const [linha] = await db('latam_refund_requests', 'POST', {
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

      const [linha] = await db('latam_refund_requests', 'POST', {
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
      await db(`latam_refund_requests?id=eq.${id}&motivo=is.null&created_at=gte.${encodeURIComponent(desde)}`, 'PATCH',
        { motivo, motivo_en: new Date().toISOString() }, 'return=minimal');
      return respond({ ok: true });
    }

    // ------------------------------------------- o painel do suporte (18/11)
    // /es-reembolsos. Só para quem está em latam_admins, com a sessão do app
    // (a mesma do /es-admin, cabeçalho x-latam-session). Devolver dinheiro só
    // pelo admin_reembolsar (com a senha); o resto só guarda e marca.
    // Toda mudança fica em latam_admin_actions, com quem fez.
    if (typeof body.action === 'string' && body.action.startsWith('admin_')) {
      const token = req.headers.get('x-latam-session') || '';
      if (!SESSION_TOKEN.test(token)) return respond({ error: PAINEL.entrar }, 401);
      const [sessao] = await db(`latam_sessions?token_hash=eq.${await sha256(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=customer_id&limit=1`);
      if (!sessao) return respond({ error: PAINEL.entrar }, 401);
      const [admin] = await db(`latam_admins?customer_id=eq.${sessao.customer_id}&select=customer_id&limit=1`);
      if (!admin) return respond({ error: PAINEL.proibido }, 403);
      const eu = sessao.customer_id as string;
      const agora = new Date().toISOString();
      const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : '';
      // De qual tabela é o pedido (SQL 17). Sem regiao = LATAM, como antes.
      const regiao: keyof typeof TABELA_DA_REGIAO = body.regiao === 'eua' ? 'eua' : 'latam';
      if (body.regiao !== undefined && body.regiao !== 'eua' && body.regiao !== 'latam') return respond({ error: PAINEL.pedido }, 400);
      const tabela = TABELA_DA_REGIAO[regiao];
      // O histórico é um só (latam_admin_actions). O alvo aponta para
      // latam_customers: num pedido dos EUA ele fica vazio e o id da cliente
      // dos EUA vai nos detalhes.
      const registrar = (action: string, alvo: string | null, email: string, details: Record<string, unknown>) =>
        db('latam_admin_actions', 'POST', {
          admin_customer_id: eu,
          target_customer_id: regiao === 'eua' ? null : alvo,
          target_email: email,
          action,
          details: regiao === 'eua' ? { ...details, regiao, en_customer_id: alvo } : details,
        }, 'return=minimal');

      if (body.action === 'admin_lista') {
        // A lista com LATAM + EUA (SQL 17). Sem ela no banco, a antiga (só LATAM).
        const lista = async () => {
          try {
            return await db('rpc/latam_admin_reembolsos_todos', 'POST', {});
          } catch (error) {
            if ((error as { status?: number }).status !== 404) throw error;
            const antigos = await db('rpc/latam_admin_reembolsos', 'POST', {});
            return (antigos || []).map((p: Record<string, unknown>) => ({ regiao: 'latam', ...p }));
          }
        };
        const [pedidos, [quem]] = await Promise.all([
          lista(),
          db(`latam_customers?id=eq.${eu}&select=email,name&limit=1`),
        ]);
        return respond({ pedidos: pedidos || [], eu: quem || null, agora });
      }

      // As compras de um e-mail, para registrar um pedido que chegou por
      // e-mail ou WhatsApp (sem freio: só a equipe chega aqui).
      if (body.action === 'admin_compras') {
        const achou = await buscar(body.email);
        if (!achou) return respond({ error: PAINEL.email }, 400);
        const [cliente] = await db(`latam_customers?email=eq.${encodeURIComponent(achou.email)}&select=id,name,country&limit=1`);
        return respond({ email: achou.email, cliente: cliente || null, compras: achou.compras });
      }

      if (body.action === 'admin_criar') {
        const achou = await buscar(body.email);
        if (!achou) return respond({ error: PAINEL.email }, 400);
        const [cliente] = await db(`latam_customers?email=eq.${encodeURIComponent(achou.email)}&select=id&limit=1`);
        const marcados = new Set((Array.isArray(body.pedidos) ? body.pedidos : [])
          .filter((p): p is string => typeof p === 'string' && PEDIDO.test(p)).slice(0, 20));
        const escolhidas = achou.compras.filter(c => marcados.has(c.pedido));
        const nota = textoCurto(body.nota, 2000);
        const [linha] = await db('latam_refund_requests', 'POST', {
          email: achou.email,
          customer_id: cliente ? cliente.id : null,
          itens: escolhidas.map(c => ({
            pedido: c.pedido, origem: c.origem, produto: c.produto, nombre: c.nombre,
            valor_cents: c.valor_cents, moneda: c.moneda, pagado_en: c.pagado_en,
          })),
          total_cents: escolhidas.reduce((soma, c) => soma + (c.valor_cents || 0), 0),
          moneda: escolhidas[0]?.moneda || 'USD',
          sin_compra: !escolhidas.length,
          canal: 'manual',
          nota,
          atualizado_em: agora,
        });
        await registrar('refund_create', linha.customer_id, linha.email, { id: linha.id, total_cents: linha.total_cents });
        return respond({ ok: true, id: linha.id });
      }

      if (body.action === 'admin_atualizar') {
        if (!id) return respond({ error: PAINEL.pedido }, 400);
        const [antes] = await db(`${tabela}?id=eq.${id}&select=*&limit=1`);
        if (!antes) return respond({ error: PAINEL.sumiu }, 404);
        const mudar: Record<string, unknown> = {};
        if (body.status !== undefined) {
          if (typeof body.status !== 'string' || !STATUS.has(body.status)) return respond({ error: PAINEL.pedido }, 400);
          if (body.status !== antes.status) {
            mudar.status = body.status;
            // Voltar para pendente apaga quem resolveu; qualquer outro, grava.
            mudar.resuelto_en = body.status === 'pendente' ? null : agora;
            mudar.resuelto_por = body.status === 'pendente' ? null : eu;
          }
        }
        if (body.nota !== undefined) mudar.nota = textoCurto(body.nota, 2000);
        if (body.email !== undefined) {
          const email = validEmail(body.email);
          if (!email) return respond({ error: PAINEL.email }, 400);
          mudar.email = email;
        }
        for (const campo of ['total_cents', 'valor_devolvido_cents'] as const) {
          if (body[campo] === undefined) continue;
          if (body[campo] === null && campo === 'valor_devolvido_cents') { mudar[campo] = null; continue; }
          const valor = body[campo];
          if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0 || valor > 10000000) return respond({ error: PAINEL.valor }, 400);
          mudar[campo] = valor;
        }
        if (body.motivo !== undefined) {
          if (body.motivo !== null && !(typeof body.motivo === 'string' && MOTIVOS_PAINEL.has(body.motivo))) return respond({ error: PAINEL.pedido }, 400);
          mudar.motivo = body.motivo;
          if (body.motivo && !antes.motivo_en) mudar.motivo_en = agora;
        }
        const mudou = Object.keys(mudar).filter(campo => !campo.startsWith('resuelto_') && campo !== 'motivo_en');
        if (!mudou.length) return respond({ ok: true });
        mudar.atualizado_em = agora;
        await db(`${tabela}?id=eq.${id}`, 'PATCH', mudar, 'return=minimal');
        const de: Record<string, unknown> = {};
        const para: Record<string, unknown> = {};
        for (const campo of mudou) { de[campo] = antes[campo]; para[campo] = mudar[campo]; }
        await registrar('refund_update', antes.customer_id, String(mudar.email || antes.email), { id, de, para });
        return respond({ ok: true });
      }

      // Excluir apaga de vez (decisão do Arthur, 18/11). A foto inteira do
      // pedido fica no histórico: numa disputa com o banco, ela ainda existe.
      if (body.action === 'admin_excluir') {
        if (!id) return respond({ error: PAINEL.pedido }, 400);
        const [antes] = await db(`${tabela}?id=eq.${id}&select=*&limit=1`);
        if (!antes) return respond({ error: PAINEL.sumiu }, 404);
        await registrar('refund_delete', antes.customer_id, antes.email, { pedido: antes });
        await db(`${tabela}?id=eq.${id}`, 'DELETE', undefined, 'return=minimal');
        return respond({ ok: true });
      }

      // -------------------------------------- devolver pela API (18/11/2026)
      // Procurar: as compras deste e-mail nas 3 contas, marcando qual bate
      // com o pedido. Só leitura: nada é devolvido aqui.
      if (body.action === 'admin_localizar') {
        if (!id) return respond({ error: PAINEL.pedido }, 400);
        const [pedido] = await db(`${tabela}?id=eq.${id}&select=id,email,itens&limit=1`);
        if (!pedido) return respond({ error: PAINEL.sumiu }, 404);
        // EUA ou LATAM, procura nas 3 contas: só lê, e acha a compra onde estiver.
        const { achados, erros } = await procurarCompras(pedido.email);
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const tentativas = await db(`latam_refund_api_log?request_id=eq.${id}&select=created_at,conta,ref,valor_cents,moeda,ok,resposta&order=created_at.desc&limit=20`).catch(() => []);
        return respond({
          email: pedido.email,
          achados: achados.map(a => ({ ...a, bate: bateComOPedido(a, itens) }))
            .sort((a, b) => Number(b.bate) - Number(a.bate) || Date.parse(b.data) - Date.parse(a.data)),
          erros,
          // Cobranças da Whop ANTIGA (travada desde 13/11): sem chave, só à mão.
          whop_antiga: itens.filter((i: any) => i?.origem === 'whop').map((i: any) => i.pedido),
          tentativas,
        });
      }

      // Devolver: confere a senha, procura de novo a compra no e-mail do
      // pedido (nunca confia no que veio da tela), e só então devolve.
      if (body.action === 'admin_reembolsar') {
        if (!id) return respond({ error: PAINEL.pedido }, 400);
        const conta = typeof body.conta === 'string' && CONTA_NOMES[body.conta] ? body.conta : '';
        const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
        if (!conta || !(conta === 'whop_nova' ? REF_WHOP : REF_DIGI).test(ref)) return respond({ error: PAINEL.pedido }, 400);

        const senhaCerta = Deno.env.get('PAINEL_REEMBOLSO_SENHA') || (NO_TESTE ? SENHA_DE_ENSAIO : '');
        if (!senhaCerta) return respond({ error: API_ERRO.semSenha }, 503);
        // A trava conta só as senhas ERRADAS (5 em 15 min, por pessoa): olha o
        // contador do freio sem somar, e só soma quando a senha está errada.
        const chaveDaTrava = `reembolso-senha:${eu}`;
        const [trava] = await db(`latam_login_limits?key=eq.${await sha256(chaveDaTrava)}&select=attempts,window_start&limit=1`).catch(() => []);
        if (trava && Number(trava.attempts) >= 5 && Date.parse(trava.window_start) > Date.now() - 15 * 60_000) {
          return respond({ error: API_ERRO.senhaTravada }, 429);
        }
        if (typeof body.senha !== 'string' || !(await iguais(body.senha, senhaCerta))) {
          await permite(chaveDaTrava, 5, 15);
          return respond({ error: API_ERRO.senha }, 403);
        }

        const [pedido] = await db(`${tabela}?id=eq.${id}&select=*&limit=1`);
        if (!pedido) return respond({ error: PAINEL.sumiu }, 404);
        const { achados, erros } = await procurarCompras(pedido.email, conta);
        if (erros.length) return respond({ error: `Não deu para conferir a compra: ${erros[0].erro}` }, 502);
        const alvo = achados.find(a => a.ref === ref);
        if (!alvo) return respond({ error: API_ERRO.naoAchou }, 404);
        if (alvo.situacao === 'disputa') return respond({ error: API_ERRO.disputa }, 409);
        if (alvo.situacao === 'devolvida') return respond({ error: API_ERRO.jaDevolvida }, 409);

        const [quem] = await db(`latam_customers?id=eq.${eu}&select=email&limit=1`);
        let ok = false;
        let resposta = '';
        try {
          if (alvo.plataforma === 'whop') {
            const r = await chamarFora(`${WHOP_API}/payments/${encodeURIComponent(ref)}/refund`, {
              method: 'POST',
              // A mesma chave para o mesmo pedido: clicar duas vezes não devolve duas vezes.
              headers: whopCabecalhos({ 'Content-Type': 'application/json', 'Idempotency-Key': `painel-${id}-${ref}` }),
              body: JSON.stringify({ metadata: { pedido_painel: id, operador: quem?.email || eu } }),
            });
            ok = r.ok;
            resposta = r.ok ? `Whop: devolvida (${centavos(r.corpo?.refunded_amount?.amount) / 100 || alvo.valor_cents / 100})` : erroWhop(r);
          } else {
            const segredo = CONTAS_DIGI.find(c => c.conta === conta)!.segredo;
            const data = await digi(segredo, 'refundPurchase', { purchase_id: ref, operator: quem?.email || 'painel', language: 'en' });
            ok = true;
            resposta = `Digistore: ${(data && (data.note || data.status)) || 'devolvida'}`;
          }
        } catch (error) {
          ok = false;
          resposta = error instanceof Error ? error.message : 'erro';
        }

        await db('latam_refund_api_log', 'POST', {
          request_id: id, admin_customer_id: eu, plataforma: alvo.plataforma, conta, ref,
          valor_cents: alvo.valor_cents, moeda: alvo.moeda, ok, resposta: resposta.slice(0, 500),
        }, 'return=minimal').catch(e => console.error('latam-reembolso log', e instanceof Error ? e.message : 'erro'));
        if (!ok) return respond({ error: `Não devolveu: ${resposta}` }, 502);

        // Deu certo: o pedido vira "Reembolsado", somando o que já foi devolvido.
        const devolvido = (pedido.status === 'feito' ? Number(pedido.valor_devolvido_cents) || 0 : 0) + alvo.valor_cents;
        const linha = `Devolvido pela API: ${CONTA_NOMES[conta]} ${ref} (${(alvo.valor_cents / 100).toFixed(2)} ${alvo.moeda})`;
        const mudar = {
          status: 'feito', resuelto_en: agora, resuelto_por: eu, valor_devolvido_cents: devolvido,
          nota: textoCurto(pedido.nota ? `${pedido.nota}\n${linha}` : linha, 2000), atualizado_em: agora,
        };
        await db(`${tabela}?id=eq.${id}`, 'PATCH', mudar, 'return=minimal');
        await registrar('refund_api', pedido.customer_id, pedido.email, { id, conta, ref, valor_cents: alvo.valor_cents, moeda: alvo.moeda });
        return respond({ ok: true, resposta, valor_cents: alvo.valor_cents, moeda: alvo.moeda });
      }

      return respond({ error: PAINEL.pedido }, 400);
    }

    return respond({ error: MESSAGES.badRequest }, 400);
  } catch (error) {
    console.error('latam-reembolso', error instanceof Error ? error.message : 'error');
    return respond({ error: MESSAGES.offline }, 503);
  }
});
