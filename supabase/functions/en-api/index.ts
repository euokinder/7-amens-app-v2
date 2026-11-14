// en-api: o login e a jornada do app em inglês (7 Amens Before Dawn).
//
// CÓPIA da latam-api (o app em espanhol), traduzida: docs/app-en.md.
// SEPARADA do app brasileiro e do espanhol de propósito. Lê e grava só
// tabelas en_*: nunca customers, entitlements, member_sessions, nada do
// Brasil, e nada latam_*. A member-api e a latam-api não sabem que esta
// função existe, e vice-versa.
//
// As mensagens que a cliente lê são em inglês. Os NOMES dos campos que a
// tela lê continuam os do espanhol (cliente.nombre, hoy, abierto,
// completados, acceso_hasta, siguiente...), de propósito: as telas js/en são
// cópia das js/es. O painel (/en-admin) continua em português: quem usa é a
// equipe.
//
// Ações:
//   login     e-mail da compra -> sessão de 1 ano (sem senha, como no Brasil).
//             Se o e-mail não acha ninguém, entra o resgate pelo e-mail (ver
//             O RESGATE, abaixo)
//   entry     link de entrada (/en-login#código) -> sessão
//   buscar_compra       o resgate pelo cartão: os 4 últimos números + o nome
//   entrada_emergencia  o resgate sem compra achada: nome + e-mail ou telefone
//   session   confere a sessão e devolve o retrato da jornada
//   progress  marca ou desmarca um dia como rezado ("I prayed this prayer").
//             Com journey: 'cantico', um dia do Cântico
//   oferta    registra o que ela fez com o pop-up (apareceu, tocou, fechou)
//   corregir_correo     logo depois do resgate pelo cartão, ela troca o
//             e-mail gravado com erro pelo dela
//   logout    encerra a sessão
//   admin_*   o painel do app em inglês (/en-admin), só para quem está em
//             en_admins (supabase/en/04-admin.sql)
//
// ⏳ EUA: checkout — o checkout dos EUA ainda não existe. Toda leitura de
// compra passa pela visão en_pedidos_pagos (supabase/en/02-compras.sql), que
// fica vazia até ele chegar. O app funciona inteiro sem ela.
//
// O RESGATE (supabase/en/09-resgate.sql): para quem não acha o e-mail da
// compra. Decisão do Caio no espanhol: o público é idoso e vulnerável, e
// entrar vem antes de proteger. A escada da /en-login:
//   1. o e-mail, com os erros comuns corrigidos sem ela ver (gmial.com,
//      .con, espaço, vírgula, acento). Se ainda não achar: o "gêmeo" (o MESMO
//      e-mail com o domínio gravado errado na compra: gmsil.com) e o
//      "parecido" (uma letra de diferença antes do @, só em conta que nunca
//      entrou e se for uma só). O gêmeo tem o e-mail gravado corrigido na hora;
//   2. o final do cartão + o nome que ela escreve (vêm da compra, em
//      en_pedidos_pagos; ⏳ EUA: checkout — até lá, não acha ninguém e a tela
//      segue para o passo 3). Entra se sobrar UMA cliente;
//   3. a entrada de emergência: nome + e-mail ou telefone, e ela entra na
//      hora, com 12 meses e sem os extras. A equipe confere no painel.
// Regras que valem para todo resgate:
//   - conta de administradora NUNCA entra por resgate (só pelo e-mail exato);
//   - só acha conta com o app ativo e dentro do prazo;
//   - os 4 números do cartão não são gravados em lugar nenhum;
//   - tudo fica em en_resgates, que o painel mostra;
//   - sem o SQL 09 no banco, o resgate não acha nada e o login segue como antes.
//
// OS POP-UPS: a mesma lógica do Brasil, em tabelas en_
// (supabase/en/03-popups.sql). Ao abrir a página, junto com o retrato, o
// banco escolhe o pop-up dela (en_claim_offer) e ele vem em `oferta`.
// Não custa chamada a mais: vai na mesma ida ao servidor. Se o banco ainda não
// tiver a função, ou ela falhar, vem `oferta: null` e o app segue normal.
//
// OS EXTRAS DENTRO DO APP: o UP01 (The Four Archangels) e o UP02 (Angelic
// Canticle), no mesmo esquema do Brasil. Quem tem cada um sai de en_extras
// (supabase/en/05-extras.sql): a compra, a dúvida (libera os dois) e o
// painel por cima. Vem no retrato, em `extras` (['arcangeles','cantico']), e
// o Cântico, em `cantico` ({abierto, completados}), com a MESMA âncora e o
// mesmo calendário das madrugadas. Sem a função no banco, ou se ela falhar,
// vem `extras: null`: a tela abre os dois (a mesma rede de segurança da
// trava do Brasil: na dúvida, não tranca quem pagou).
//
// A TRAVA (uma oração por dia) é calculada AQUI, no servidor:
//   - "hoje" é o dia no fuso do celular dela, guardado no primeiro acesso
//     (sem fuso válido, vale America/New_York). O relógio do celular não
//     manda: só o fuso, uma vez;
//   - no dia do primeiro acesso ela tem o Start Here (dia 0) e o First Amen
//     (dia 1); cada meia-noite, no fuso dela, abre o seguinte, até o 7
//     ("Unlocks tomorrow" na tela);
//   - não depende de marcar "I prayed this prayer": é calendário, não botão;
//   - dia já marcado nunca volta a trancar.
// É trava de experiência, não de segurança (os textos são arquivos públicos),
// a mesma calibragem do app brasileiro.
//
// A cota de chamadas do Supabase é da organização inteira, dividida com o
// Brasil e a LATAM. Por isso a tela chama esta função só ao abrir a página,
// nunca de tempos em tempos.

const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const allowedOrigins = new Set([
  'https://setemadrugadas.com.br',
  'https://www.setemadrugadas.com.br',
]);
// O link permanente de cada deploy (<id>--7madrugadas.netlify.app) e o teste local.
const allowedNetlifyPreview = /^https:\/\/[a-z0-9][a-z0-9-]*--7madrugadas\.netlify\.app$/;
const allowedLocalOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const DEFAULT_TZ = 'America/New_York';
// 1 ano, como o acesso (era 90 dias até 10/11/2026): ela entra uma vez no
// celular e não precisa digitar de novo.
const SESSION_MS = 365 * 24 * 60 * 60 * 1000;
const LAST_DAY = 7;
const RETRIABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const encoder = new TextEncoder();
const eq = (value: string) => encodeURIComponent(value);
const nowIso = () => new Date().toISOString();

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
// 32 bytes sorteados = 64 letras hexadecimais. Só a impressão digital vai ao banco.
const newSessionToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
const SESSION_TOKEN = /^[a-f0-9]{64}$/;
const ENTRY_CODE = /^[A-Za-z0-9]{16}$/;

const validEmail = (value: unknown) => {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '';
};

// O fuso que o celular informou ("America/Bogota"). Só nome de fuso de
// verdade passa: o Intl recusa o que não conhece.
function validTimeZone(value: unknown) {
  const zone = typeof value === 'string' ? value.trim() : '';
  if (!zone || zone.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(zone)) return '';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return '';
  }
}
// O dia de hoje no fuso dela, no formato do banco ("2026-11-05").
const todayIn = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const firstName = (name: unknown) => (typeof name === 'string' ? name.trim().split(/\s+/)[0] || '' : '');

type Customer = { id: string; email: string; name: string; timezone: string | null; first_access_on: string | null };
const CUSTOMER_FIELDS = 'id,email,name,timezone,first_access_on';

// O acesso ao app: ativo e dentro do prazo (12 meses a partir da compra).
async function accessOf(customerId: string) {
  const [row] = await db(`en_access?customer_id=eq.${customerId}&product=eq.app&select=status,expires_at&limit=1`);
  if (!row || row.status !== 'active') return { ok: false as const, expired: null };
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return { ok: false as const, expired: row.expires_at as string };
  return { ok: true as const, until: (row.expires_at as string | null) || null };
}

// Data do fim do acesso, como ela lê nos EUA, com o mês por extenso para
// não confundir dia e mês: "November 5, 2027". A /en (js/en/inicio.js)
// mostra "Your access is valid through November 5, 2027."
const asUsDate = (iso: string, zone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));

// O e-mail do suporte dos EUA (Arthur, 14/11/2026). Vazio, as mensagens dizem
// só "contact our team", sem canal. Preenchido, elas dizem o e-mail. É o
// mesmo CORREO de js/en/config.js: mudou lá, mudar aqui.
const SUPPORT_EMAIL = 'sevenamenssuport@gmail.com';
const writeToUs = SUPPORT_EMAIL ? `write to us at ${SUPPORT_EMAIL}` : 'contact our team';

// A /en-login (js/en/entrar.js) segue para o resgate SÓ quando vem
// `siguiente: 'nombre'` (o e-mail não achou ninguém, ou achou uma conta sem
// acesso ativo e sem data de fim). O acesso vencido vem sem `siguiente`, com
// a data. E ela reconhece "Invalid request" (badRequest, 400) como "a função
// não conhece esta ação". Mudar essas regras aqui = mudar lá também.
const MESSAGES = {
  badEmail: 'Please type the full email you used for your purchase (for example: mary@gmail.com).',
  tooMany: 'There were too many attempts in a row. Please wait a few minutes and try again.',
  notFound: 'We could not find a purchase with this email. Please check that it is the same email you used to pay.',
  expired: (date: string) => `Your access ended on ${date}. Please ${writeToUs}, and we will help you.`,
  badLink: 'This link is incomplete. Please ask our team for a new one.',
  deadLink: 'This link no longer works. Please ask our team for a new one.',
  signInAgain: 'Your session has ended. Please sign in again with your email.',
  locked: 'This prayer is not open yet. A new prayer unlocks each day at midnight.',
  lockedCantico: 'This day of the Canticle is not open yet. It opens one day at a time.',
  notOwned: 'This content is not part of your access yet.',
  badRequest: 'Invalid request.',
  offline: 'We could not connect right now. Please try again in a moment.',
  // O resgate. A /en-login mostra textos dela; estes são a rede.
  rescueBad: 'Please type your name and the last 4 digits of your card.',
  cardNotFound: 'We could not find a purchase with that card and that name.',
  emergencyBad: 'Please type your name and your email or phone number.',
  emergencyOff: `Please ${writeToUs}, and we will help you today.`,
  emergencyLimit: `Several accesses were already created from this connection today. Please ${writeToUs}, and we will help you.`,
  closed: `This access was closed. Please ${writeToUs}, and we will help you.`,
  fixNotAllowed: `We could not change the email right now. Please ${writeToUs}, and we will change it for you.`,
  fixTaken: `That email is already on another account. Please ${writeToUs}, and we will sort it out.`,
};

// ----------------------------------------------------------- O RESGATE
// (10/11/2026; o porquê está no topo deste arquivo e em 09-resgate.sql.)

// Quantas letras separam dois textos: trocar, faltar, sobrar ou inverter duas
// vizinhas conta 1 cada ('gmial' e 'gmail' = 1). A mesma conta de
// en_distancia, no banco.
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
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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
const dominioDe = (email: string) => email.slice(email.lastIndexOf('@') + 1);

// Os nomes, para comparar o que ela escreveu com o da compra: sem acento, sem
// maiúscula, sem "de", "la", "del"... Basta UMA palavra igual (ou com uma
// letra trocada, nas de 5 letras ou mais): o cartão pode estar no nome do
// marido ou do filho, que costuma dividir o sobrenome com ela.
// (Os do espanhol e do português ficam: muita cliente americana tem nome latino.)
const PALAVRAS_VAZIAS = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'van', 'von', 'sra', 'senora', 'don', 'dona', 'mrs', 'miss', 'the', 'and']);
const palavrasDoNome = (texto: unknown) => (typeof texto === 'string' ? texto : '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ')
  .split(' ').filter(palavra => palavra.length >= 3 && !PALAVRAS_VAZIAS.has(palavra));
const nomesBatem = (dela: string[], daCompra: string[]) =>
  dela.some(a => daCompra.some(b => a === b || (a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1)));
const limparNome = (valor: unknown) => (typeof valor === 'string' ? valor : '').replace(/\s+/g, ' ').trim().slice(0, 80);

// Os e-mails que ela tentou na entrada (a tela manda até 3), já limpos.
const correosTentados = (valor: unknown) => (Array.isArray(valor) ? valor : [])
  .slice(0, 3).map(item => validEmail(corrigirCorreo(item))).filter(Boolean);

// O registro de cada resgate (en_resgates), que o painel mostra. Falhar
// aqui nunca impede a entrada dela.
async function registrarResgate(dados: Record<string, unknown>) {
  try {
    const [linha] = await db('en_resgates', 'POST', dados);
    return linha || null;
  } catch (error) {
    console.error('en-api resgate', error instanceof Error ? error.message : 'error');
    return null;
  }
}

// O freio do resgate (en_permite, em 09-resgate.sql): true (pode), false
// (passou do limite) ou null (sem a função no banco: o resgate fica desligado,
// e a entrada pelo e-mail segue normal).
async function permite(chave: string, maximo: number, minutos: number): Promise<boolean | null> {
  try {
    return (await db('rpc/en_permite', 'POST', { p_chave: await sha256(chave), p_maximo: maximo, p_minutos: minutos })) === true;
  } catch (error) {
    console.error('en-api freio do resgate', error instanceof Error ? error.message : 'error');
    return null;
  }
}

// Troca o e-mail gravado (o login dela). Igual ao admin_update_email do
// painel. Não derruba a sessão: quem troca é ela mesma, entrando.
// ⏳ EUA: checkout — no espanhol, as compras dela (latam_whop_events) iam
// junto, senão ela "perderia" o que comprou. Aqui, en_pedidos_pagos acha a
// compra também pela cliente (customer_id), e não só pelo e-mail. Se a tabela
// de avisos do checkout achar a cliente SÓ pelo e-mail, levar o e-mail dela
// junto aqui (o parâmetro `de` fica para isso).
async function trocarEmailGravado(customerId: string, _de: string, para: string) {
  const [taken] = await db(`en_customers?email=eq.${eq(para)}&select=id&limit=1`);
  if (taken && taken.id !== customerId) return false;
  await db(`en_customers?id=eq.${customerId}`, 'PATCH', { email: para }, 'return=minimal');
  return true;
}

// O resgate pelo e-mail, quando o que ela digitou não achou ninguém:
//   1. o mesmo e-mail limpo e com o domínio corrigido (gmial.com -> gmail.com);
//   2. o gêmeo: a conta com o MESMO antes do @ e o domínio gravado errado, que
//      corrigido dá o que ela digitou. O e-mail gravado é corrigido;
//   3. o parecido: uma letra de diferença antes do @, mesmo domínio, conta que
//      nunca entrou, e uma só.
// Devolve a cliente achada e como, ou null.
type Achada = { customer: Customer; metodo: 'corrigido' | 'gemeo' | 'parecido'; anterior?: string };
async function resgatarPorCorreo(tentativas: string[], alvo: string, ip: string): Promise<Achada | null> {
  for (const email of tentativas) {
    const [customer] = await db(`en_customers?email=eq.${eq(email)}&select=${CUSTOMER_FIELDS}&limit=1`);
    if (customer) return { customer, metodo: 'corrigido' };
  }
  const arroba = alvo.lastIndexOf('@');
  if (arroba < 1 || (await permite(`resgate:${ip}`, 30, 60)) !== true) return null;
  let candidatos: { customer_id: string; email: string; tipo: string; entrou: boolean }[] = [];
  try {
    candidatos = await db('rpc/en_resgate_candidatos', 'POST', { p_local: alvo.slice(0, arroba), p_dominio: alvo.slice(arroba + 1) }) || [];
  } catch (error) {
    console.error('en-api candidatos', error instanceof Error ? error.message : 'error');
    return null;
  }
  const buscar = async (id: string) => (await db(`en_customers?id=eq.${id}&select=${CUSTOMER_FIELDS}&limit=1`))[0] || null;
  const gemeos = candidatos.filter(c => c.tipo === 'gemeo' && !DOMINIOS_CONHECIDOS.has(dominioDe(c.email)) && corrigirCorreo(c.email) === alvo);
  if (gemeos.length === 1) {
    const customer = await buscar(gemeos[0].customer_id);
    if (customer) {
      const anterior = customer.email;
      try {
        if (await trocarEmailGravado(customer.id, anterior, alvo)) customer.email = alvo;
      } catch (error) {
        console.error('en-api gemeo', error instanceof Error ? error.message : 'error');
      }
      return { customer, metodo: 'gemeo', anterior };
    }
  }
  const parecidos = candidatos.filter(c => c.tipo === 'parecido' && !c.entrou);
  if (parecidos.length === 1) {
    const customer = await buscar(parecidos[0].customer_id);
    if (customer) return { customer, metodo: 'parecido' };
  }
  return null;
}

// O acesso como está no banco, para a entrada de emergência separar "nunca
// teve" (libera), "fechado" (não reabre) e "vencido" (avisa a data).
async function acessoBruto(customerId: string) {
  const [row] = await db(`en_access?customer_id=eq.${customerId}&product=eq.app&select=status,expires_at&limit=1`);
  return row as { status: string; expires_at: string | null } | undefined;
}
const EMERGENCIA_MS = 365 * 24 * 60 * 60 * 1000;

async function createSession(customerId: string) {
  const token = newSessionToken();
  await db('en_sessions', 'POST', {
    token_hash: await sha256(token),
    customer_id: customerId,
    expires_at: new Date(Date.now() + SESSION_MS).toISOString(),
  }, 'return=minimal');
  return token;
}

// O calendário dela: o fuso, o dia de hoje e até que dia o calendário já abriu.
function calendar(customer: Customer, reportedZone: unknown) {
  const zone = validTimeZone(customer.timezone) || validTimeZone(reportedZone) || DEFAULT_TZ;
  const today = todayIn(zone);
  const firstDay = customer.first_access_on || today;
  const open = Math.min(LAST_DAY, Math.max(1, 1 + daysBetween(firstDay, today)));
  return { zone, today, open };
}

// Os extras dela (en_extras, em 05-extras.sql). Falhar aqui nunca derruba
// a jornada: vem null, e a tela abre os dois.
type Extras = { extras: string[]; origem: Record<string, string>; cantico_hechos: number[] };
const EXTRA_KEYS = new Set(['arcangeles', 'cantico']);
async function extrasOf(customerId: string): Promise<Extras | null> {
  try {
    const answer = await db('rpc/en_extras', 'POST', { p_customer_id: customerId });
    if (!answer || !Array.isArray(answer.extras)) return null;
    return {
      extras: answer.extras.filter((key: unknown) => typeof key === 'string' && EXTRA_KEYS.has(key)),
      origem: answer.origem && typeof answer.origem === 'object' ? answer.origem : {},
      cantico_hechos: (Array.isArray(answer.cantico_hechos) ? answer.cantico_hechos : [])
        .map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= LAST_DAY),
    };
  } catch (error) {
    console.error('en-api extras', error instanceof Error ? error.message : 'error');
    return null;
  }
}
// As compras de uma cliente, para a ficha do painel: pela cliente
// (customer_id) e pelo e-mail, sem repetir. Lê a visão en_pedidos_pagos
// (supabase/en/02-compras.sql). ⏳ EUA: checkout — vazia até ele chegar.
// Sem a visão no banco, ou se ela falhar, vem lista vazia: a ficha abre igual.
type Compra = {
  pedido: string; produtos: string[] | null; valor_cents: number | null; moneda: string | null; pagado_en: string | null;
  devuelto: boolean | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null;
};
const COMPRA_FIELDS = 'pedido,produtos,valor_cents,moneda,pagado_en,devuelto,utm_source,utm_medium,utm_campaign,utm_content';
async function comprasDa(customerId: string, email: string): Promise<Compra[]> {
  try {
    const [porCliente, porEmail] = await Promise.all([
      db(`en_pedidos_pagos?customer_id=eq.${customerId}&select=${COMPRA_FIELDS}&order=pagado_en.desc&limit=40`),
      db(`en_pedidos_pagos?email=eq.${eq(email)}&select=${COMPRA_FIELDS}&order=pagado_en.desc&limit=40`),
    ]);
    const vistas = new Set<string>();
    return [...(porCliente || []), ...(porEmail || [])]
      .filter((c: Compra) => c && typeof c.pedido === 'string' && !vistas.has(c.pedido) && Boolean(vistas.add(c.pedido)))
      .sort((a: Compra, b: Compra) => Date.parse(b.pagado_en || '') - Date.parse(a.pagado_en || '') || 0)
      .slice(0, 40);
  } catch (error) {
    console.error('en-api compras', error instanceof Error ? error.message : 'error');
    return [];
  }
}

// Até que dia o Cântico está aberto: o mesmo calendário das madrugadas, e dia
// já marcado nunca volta a trancar.
const canticoOpen = (calendarOpen: number, done: number[]) => Math.min(LAST_DAY, Math.max(calendarOpen, ...done));

// O retrato da jornada. `visit` grava o dia de visita (no login, na entrada
// pelo link e ao abrir a página); marcar um dia não grava visita de novo.
// Cada consulta ao banco é uma ida e volta pela internet: o que não depende
// de outra coisa vai junto, em paralelo, para a tela não ficar esperando.
async function journey(customer: Customer, reportedZone: unknown, accessUntil: string | null, visit: boolean) {
  const { zone, today, open: calendarOpen } = calendar(customer, reportedZone);

  const writes: Promise<unknown>[] = [];
  // Primeiro acesso: fixa a âncora e o fuso, uma vez só. O filtro
  // "first_access_on=is.null" impede que uma segunda aba mude o que a
  // primeira acabou de gravar.
  if (!customer.first_access_on) {
    writes.push(db(`en_customers?id=eq.${customer.id}&first_access_on=is.null`, 'PATCH',
      { first_access_on: today, timezone: customer.timezone || zone }, 'return=minimal'));
  } else if (!customer.timezone) {
    writes.push(db(`en_customers?id=eq.${customer.id}&timezone=is.null`, 'PATCH', { timezone: zone }, 'return=minimal'));
  }
  if (visit) {
    writes.push(db('en_visit_days?on_conflict=customer_id,visited_on', 'POST',
      { customer_id: customer.id, visited_on: today, last_seen_at: nowIso() }, 'return=minimal,resolution=merge-duplicates'));
  }
  // O pop-up só vem ao abrir a página (visit), nunca ao marcar um dia. Falhar
  // aqui nunca derruba a jornada: na dúvida, sem pop-up.
  const offer = visit ? claimOffer(customer.id, zone) : Promise.resolve(null);
  const [rows, oferta, extras] = await Promise.all([
    db(`en_progress?customer_id=eq.${customer.id}&select=day&order=day.asc`),
    offer,
    extrasOf(customer.id),
    ...writes,
  ]);
  const done = (rows as { day: number }[]).map(row => Number(row.day)).filter(day => day >= 0 && day <= LAST_DAY);
  // Dia já marcado nunca volta a trancar.
  const open = Math.min(LAST_DAY, Math.max(calendarOpen, ...done));
  const canticoDone = extras ? extras.cantico_hechos : [];
  return {
    cliente: { nombre: firstName(customer.name), email: customer.email },
    hoy: today,
    zona: zone,
    abierto: open,
    completados: done,
    acceso_hasta: accessUntil ? asUsDate(accessUntil, zone) : null,
    oferta,
    extras: extras ? extras.extras : null,
    cantico: { abierto: canticoOpen(calendarOpen, canticoDone), completados: canticoDone },
  };
}

const OFFER_KEY = /^[a-z0-9_-]+$/;

// O painel (/en-admin). Em português: quem usa é a equipe brasileira.
const ADMIN_ACTIONS = new Set([
  'admin_dashboard', 'admin_customer_detail', 'admin_grant_access',
  'admin_revoke_access', 'admin_update_email', 'admin_entry_link',
  'admin_grant_extra', 'admin_revoke_extra', 'admin_resolver_resgate',
]);
// Os resgates que o painel mostra (09-resgate.sql). Sem a tabela, vem null e
// o painel só não mostra a seção.
const RESGATE_FIELDS = 'id,customer_id,metodo,email_digitado,email_anterior,nome,contato,pais,situacao,resolvido_em,created_at';
const ADMIN = {
  forbidden: 'Acesso administrativo não autorizado.',
  badCustomer: 'Cliente inválida.',
  notFound: 'Cliente não encontrada.',
  badEmail: 'Informe um e-mail válido.',
  taken: 'Já existe uma cliente com esse e-mail.',
  noAccess: 'Esta cliente não tem acesso ao app.',
  badExtra: 'Extra inválido.',
};
const UUID = /^[0-9a-f-]{36}$/;
const MANUAL_ACCESS_MS = 365 * 24 * 60 * 60 * 1000;
// O código do link de entrada: 16 letras e números (a mesma regra de
// ENTRY_CODE e da trava do banco), sem os que se confundem (0/O, 1/l/I).
const ENTRY_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const newEntryCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => ENTRY_LETTERS[b % ENTRY_LETTERS.length]).join('');
async function claimOffer(customerId: string, zone: string) {
  try {
    const rows = await db('rpc/en_claim_offer', 'POST', { p_customer_id: customerId, p_zone: zone });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !OFFER_KEY.test(row.campaign_key || '')) return null;
    return {
      campaign_key: row.campaign_key,
      eyebrow: row.eyebrow || '',
      headline: row.headline || '',
      body: row.body || '',
      cta_label: row.cta_label || '',
      dismiss_label: row.dismiss_label || '',
      target_url: row.target_url || '',
      offer_type: row.offer_type || 'product',
    };
  } catch (error) {
    console.error('en-api oferta', error instanceof Error ? error.message : 'error');
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': 'https://setemadrugadas.com.br',
    'Access-Control-Allow-Headers': 'content-type, x-en-session',
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
    if (raw.length > 2048) return respond({ error: MESSAGES.badRequest }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return respond({ error: MESSAGES.badRequest }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ error: MESSAGES.badRequest }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    // O país da conexão, só para a equipe ler no painel do resgate.
    const paisDaConexao = (req.headers.get('cf-ipcountry') || '').toUpperCase();
    const pais = /^[A-Z]{2}$/.test(paisDaConexao) ? paisDaConexao : '';

    // --------------------------------------------------------- sem sessão
    if (body.action === 'login') {
      // Primeiro como ela digitou (o de sempre). Se não achar ninguém, o mesmo
      // e-mail limpo e com o domínio corrigido, o gêmeo e o parecido (O
      // RESGATE, no topo deste arquivo).
      const original = validEmail(body.email);
      const limpo = validEmail(limparCorreo(body.email));
      const corrigido = validEmail(corrigirCorreo(body.email));
      const email = original || limpo || corrigido;
      if (!email) return respond({ error: MESSAGES.badEmail }, 400);
      // O balde é por pessoa (e-mail) dentro do endereço de internet, como no
      // Brasil: a operadora põe muita gente atrás do mesmo IP.
      const [allowed, [exata]] = await Promise.all([
        db('rpc/en_allow_login', 'POST', { bucket_key: await sha256(`login:${ip}|${email}`) }),
        db(`en_customers?email=eq.${eq(email)}&select=${CUSTOMER_FIELDS}&limit=1`),
      ]);
      if (!allowed) return respond({ error: MESSAGES.tooMany }, 429);
      let customer: Customer | null = exata || null;
      let achada: Achada | null = null;
      if (!customer) {
        const tentativas = [...new Set([limpo, corrigido])].filter(outro => outro && outro !== email);
        achada = await resgatarPorCorreo(tentativas, corrigido || email, ip);
        customer = achada ? achada.customer : null;
      }
      // `siguiente`: a tela segue para o resgate pelo nome e pelo cartão.
      if (!customer) return respond({ error: MESSAGES.notFound, siguiente: 'nombre' }, 403);
      const access = await accessOf(customer.id);
      if (!access.ok) {
        const zone = validTimeZone(customer.timezone) || validTimeZone(body.tz) || DEFAULT_TZ;
        if (access.expired) return respond({ error: MESSAGES.expired(asUsDate(access.expired, zone)) }, 403);
        return respond({ error: MESSAGES.notFound, siguiente: 'nombre' }, 403);
      }
      const digitado = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
      const [token, portrait] = await Promise.all([
        createSession(customer.id),
        journey(customer, body.tz, access.until, true),
        achada ? registrarResgate({ customer_id: customer.id, metodo: achada.metodo, email_digitado: digitado, email_anterior: achada.anterior || '', pais }) : null,
      ]);
      return respond({ token, ...portrait });
    }

    // O resgate pelo cartão: os 4 últimos números + o nome que ela escreve.
    // Entra se sobrar UMA cliente com o app ativo. Os números não são gravados.
    if (body.action === 'buscar_compra') {
      const final = typeof body.final === 'string' ? body.final.replace(/\D/g, '') : '';
      const nombre = limparNome(body.nombre);
      const delas = palavrasDoNome(nombre);
      if (!/^\d{4}$/.test(final) || !delas.length) return respond({ error: MESSAGES.rescueBad }, 400);
      const freio = await permite(`cartao:${ip}`, 8, 60);
      if (freio === null) return respond({ error: MESSAGES.offline }, 503);
      if (!freio) return respond({ error: MESSAGES.tooMany }, 429);
      let filas: { customer_id: string; email: string; nome_cliente: string; nome_cartao: string }[] = [];
      try {
        filas = await db('rpc/en_resgate_cartao', 'POST', { p_final: final }) || [];
      } catch (error) {
        console.error('en-api cartao', error instanceof Error ? error.message : 'error');
        return respond({ error: MESSAGES.offline }, 503);
      }
      const ids = [...new Set(filas
        .filter(fila => nomesBatem(delas, palavrasDoNome(`${fila.nome_cliente || ''} ${fila.nome_cartao || ''}`)))
        .map(fila => fila.customer_id))];
      if (ids.length !== 1) return respond({ error: MESSAGES.cardNotFound, siguiente: 'emergencia' }, 404);
      const [customer] = await db(`en_customers?id=eq.${ids[0]}&select=${CUSTOMER_FIELDS}&limit=1`);
      const access = customer ? await accessOf(customer.id) : { ok: false as const, expired: null };
      if (!customer || !access.ok) return respond({ error: MESSAGES.cardNotFound, siguiente: 'emergencia' }, 404);
      // Se ela tentou outro e-mail antes, a tela oferece trocar o gravado pelo
      // dela (corregir_correo), se ele estiver livre.
      const tentados = correosTentados(body.correos).filter(outro => outro !== customer.email);
      let sugerido = '';
      if (tentados[0]) {
        const [taken] = await db(`en_customers?email=eq.${eq(tentados[0])}&select=id&limit=1`);
        if (!taken) sugerido = tentados[0];
      }
      const [token, portrait] = await Promise.all([
        createSession(customer.id),
        journey(customer, body.tz, access.until, true),
        registrarResgate({ customer_id: customer.id, metodo: 'cartao', nome: nombre, email_digitado: tentados.join(', '), pais }),
      ]);
      return respond({ token, ...portrait, compra: { correo: customer.email, sugerido } });
    }

    // A entrada de emergência: nada achou a compra. Ela escreve o nome e um
    // e-mail ou WhatsApp e entra na hora (12 meses, sem os extras). A equipe
    // confere no painel. Desliga em en_resgate_config (09-resgate.sql).
    if (body.action === 'entrada_emergencia') {
      const nombre = limparNome(body.nombre);
      const contato = typeof body.contacto === 'string' ? body.contacto.trim().slice(0, 120) : '';
      const comoEmail = contato.includes('@') ? validEmail(corrigirCorreo(contato)) : '';
      const digitos = contato.replace(/\D/g, '');
      const comoTelefone = !contato.includes('@') && digitos.length >= 7 && digitos.length <= 15 ? digitos : '';
      if (!/[a-zA-ZÀ-ÿ]{2,}/.test(nombre) || (!comoEmail && !comoTelefone)) return respond({ error: MESSAGES.emergencyBad }, 400);
      let config: { emergencia_ligada?: boolean; emergencias_por_dia?: number } | undefined;
      try {
        [config] = await db('en_resgate_config?id=eq.1&select=emergencia_ligada,emergencias_por_dia&limit=1');
      } catch (error) {
        console.error('en-api config do resgate', error instanceof Error ? error.message : 'error');
      }
      if (!config || config.emergencia_ligada !== true) return respond({ error: MESSAGES.emergencyOff }, 503);
      const freio = await permite(`emergencia:${ip}`, Number(config.emergencias_por_dia) || 0, 24 * 60);
      if (freio === null) return respond({ error: MESSAGES.emergencyOff }, 503);
      if (!freio) return respond({ error: MESSAGES.emergencyLimit }, 429);
      // Sem e-mail, o telefone vira um endereço que não existe (.invalid é
      // reservado: nada é entregue lá). A equipe acha o número no painel.
      // (O prefixo "whatsapp-" é o do espanhol; o painel procura por ele.)
      const email = comoEmail || `whatsapp-${comoTelefone}@no-email.invalid`;
      let [customer] = await db(`en_customers?email=eq.${eq(email)}&select=${CUSTOMER_FIELDS}&limit=1`);
      let liberar = true;
      let situacao = 'por_confirmar';
      if (customer) {
        const atual = await acessoBruto(customer.id);
        if (atual && atual.status !== 'active') return respond({ error: MESSAGES.closed }, 403);
        if (atual && atual.expires_at && Date.parse(atual.expires_at) <= Date.now()) {
          const zone = validTimeZone(customer.timezone) || validTimeZone(body.tz) || DEFAULT_TZ;
          return respond({ error: MESSAGES.expired(asUsDate(atual.expires_at, zone)) }, 403);
        }
        if (atual) { liberar = false; situacao = 'resolvido'; } // a conta é dela e tem o app: entra como no login
        if (!customer.name) await db(`en_customers?id=eq.${customer.id}`, 'PATCH', { name: nombre }, 'return=minimal');
      } else {
        try {
          [customer] = await db('en_customers', 'POST', { email, name: nombre });
        } catch (error) {
          // Outra aba criou a mesma conta no mesmo instante.
          [customer] = await db(`en_customers?email=eq.${eq(email)}&select=${CUSTOMER_FIELDS}&limit=1`);
          if (!customer) throw error;
        }
      }
      if (liberar) {
        const agora = nowIso();
        await db('en_access', 'POST', {
          customer_id: customer.id, product: 'app', status: 'active', source: 'emergencia',
          expires_at: new Date(Date.now() + EMERGENCIA_MS).toISOString(), granted_at: agora, updated_at: agora,
          note: 'Entrada de emergência: a equipe confere a compra no painel.',
        }, 'return=minimal');
      }
      const access = await accessOf(customer.id);
      if (!access.ok) return respond({ error: MESSAGES.emergencyOff }, 503);
      const [token, portrait] = await Promise.all([
        createSession(customer.id),
        journey(customer, body.tz, access.until, true),
        registrarResgate({
          customer_id: customer.id, metodo: 'emergencia', nome: nombre, contato,
          email_digitado: correosTentados(body.correos).join(', '), pais, situacao,
        }),
      ]);
      return respond({ token, ...portrait });
    }

    if (body.action === 'entry') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!ENTRY_CODE.test(code)) return respond({ error: MESSAGES.badLink }, 400);
      const [allowed, [link]] = await Promise.all([
        db('rpc/en_allow_login', 'POST', { bucket_key: await sha256(`entrada:${ip}|${code}`) }),
        db(`en_entry_links?token=eq.${code}&select=customer_id,uses&limit=1`),
      ]);
      if (!allowed) return respond({ error: MESSAGES.tooMany }, 429);
      if (!link) return respond({ error: MESSAGES.deadLink }, 404);
      const [customer] = await db(`en_customers?id=eq.${link.customer_id}&select=${CUSTOMER_FIELDS}&limit=1`);
      const access = customer ? await accessOf(customer.id) : { ok: false as const, expired: null };
      if (!customer || !access.ok) {
        const zone = validTimeZone(customer?.timezone) || DEFAULT_TZ;
        return respond({ error: access.expired ? MESSAGES.expired(asUsDate(access.expired, zone)) : MESSAGES.deadLink }, 403);
      }
      const [token, portrait] = await Promise.all([
        createSession(customer.id),
        journey(customer, body.tz, access.until, true),
        // Só para o suporte saber se ela já tocou no link.
        db(`en_entry_links?customer_id=eq.${customer.id}`, 'PATCH',
          { last_used_at: nowIso(), uses: (Number(link.uses) || 0) + 1 }, 'return=minimal'),
      ]);
      return respond({ token, ...portrait });
    }

    // --------------------------------------------------------- com sessão
    const token = req.headers.get('x-en-session') || '';
    if (!SESSION_TOKEN.test(token)) return respond({ error: MESSAGES.signInAgain }, 401);
    const tokenHash = await sha256(token);
    const [session] = await db(`en_sessions?token_hash=eq.${tokenHash}&expires_at=gt.${eq(nowIso())}&select=customer_id&limit=1`);
    if (!session) return respond({ error: MESSAGES.signInAgain }, 401);

    if (body.action === 'logout') {
      await db(`en_sessions?token_hash=eq.${tokenHash}`, 'DELETE', undefined, 'return=minimal');
      return respond({ ok: true });
    }
    const isAdminAction = typeof body.action === 'string' && ADMIN_ACTIONS.has(body.action);
    const comSessao = ['session', 'progress', 'oferta', 'corregir_correo'];
    if (!comSessao.includes(String(body.action)) && !isAdminAction) return respond({ error: MESSAGES.badRequest }, 400);

    const [[customer], access] = await Promise.all([
      db(`en_customers?id=eq.${session.customer_id}&select=${CUSTOMER_FIELDS}&limit=1`),
      accessOf(session.customer_id),
    ]);
    if (!customer || !access.ok) {
      const zone = validTimeZone(customer?.timezone) || DEFAULT_TZ;
      return respond({ error: !access.ok && access.expired ? MESSAGES.expired(asUsDate(access.expired, zone)) : MESSAGES.notFound }, 403);
    }

    if (body.action === 'oferta') {
      // Como o offer_event do Brasil: só marca a hora, uma vez (a primeira).
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const event = typeof body.event === 'string' ? body.event : '';
      if (!OFFER_KEY.test(campaignKey) || !['shown', 'clicked', 'dismissed'].includes(event)) return respond({ error: MESSAGES.badRequest }, 400);
      const column = `${event}_at`;
      await db(`en_offer_events?customer_id=eq.${customer.id}&campaign_key=eq.${eq(campaignKey)}&${column}=is.null`, 'PATCH',
        { [column]: nowIso() }, 'return=minimal');
      return respond({ ok: true });
    }

    // Logo depois do resgate pelo cartão (30 min), ela troca o e-mail gravado
    // (que tinha o erro) pelo dela, uma vez. Fora disso, só a equipe troca.
    if (body.action === 'corregir_correo') {
      const nuevo = validEmail(corrigirCorreo(body.email));
      if (!nuevo) return respond({ error: MESSAGES.badEmail }, 400);
      if (nuevo === customer.email) return respond(await journey(customer, body.tz, access.until, false));
      const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      let resgate: { id: number; email_anterior: string } | undefined;
      try {
        [resgate] = await db(`en_resgates?customer_id=eq.${customer.id}&metodo=eq.cartao&created_at=gt.${eq(desde)}&select=id,email_anterior&order=created_at.desc&limit=1`);
      } catch {
        resgate = undefined;
      }
      if (!resgate || resgate.email_anterior) return respond({ error: MESSAGES.fixNotAllowed }, 403);
      if (!(await trocarEmailGravado(customer.id, customer.email, nuevo))) return respond({ error: MESSAGES.fixTaken }, 409);
      await db(`en_resgates?id=eq.${resgate.id}`, 'PATCH', { email_anterior: customer.email, contato: nuevo }, 'return=minimal');
      return respond(await journey({ ...customer, email: nuevo }, body.tz, access.until, false));
    }

    // ------------------------------------------- o painel (/en-admin, 07/11)
    // Só para quem está em en_admins. Lê e grava só tabelas en_: o painel
    // do Brasil (admin.html + member-api) não é tocado. Toda ação que muda algo
    // fica em en_admin_actions, com quem fez.
    if (isAdminAction) {
      const [admin] = await db(`en_admins?customer_id=eq.${customer.id}&select=customer_id&limit=1`);
      if (!admin) return respond({ error: ADMIN.forbidden }, 403);
      const audit = (action: string, target: string | null, email: string, details: Record<string, unknown>) =>
        db('en_admin_actions', 'POST',
          { admin_customer_id: customer.id, target_customer_id: target, target_email: email, action, details }, 'return=minimal');
      const target = typeof body.customer_id === 'string' && UUID.test(body.customer_id) ? body.customer_id : '';
      const now = nowIso();

      if (body.action === 'admin_dashboard') {
        // A lista inteira: os números do topo e a busca saem dela, no navegador.
        const [customers, campaigns, resgates] = await Promise.all([
          db('rpc/en_admin_customers', 'POST', {}),
          db('rpc/en_admin_offers', 'POST', {}),
          db(`en_resgates?select=${RESGATE_FIELDS}&order=created_at.desc&limit=150`).catch(() => null),
        ]);
        return respond({ customers, campaigns, resgates });
      }

      // A equipe conferiu a entrada de emergência (achou a compra, ou decidiu).
      if (body.action === 'admin_resolver_resgate') {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return respond({ error: MESSAGES.badRequest }, 400);
        const [linha] = await db(`en_resgates?id=eq.${id}`, 'PATCH', { situacao: 'resolvido', resolvido_por: customer.id, resolvido_em: now });
        if (!linha) return respond({ error: 'Resgate não encontrado.' }, 404);
        return respond({ ok: true });
      }

      if (body.action === 'admin_customer_detail') {
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        const [person] = await db(`en_customers?id=eq.${target}&select=id,email,name,country,timezone,first_access_on,created_at&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        const [access, progress, visits, offers, compras, history, links, extras, resgates] = await Promise.all([
          db(`en_access?customer_id=eq.${target}&product=eq.app&select=status,source,expires_at,granted_at,revoked_at&limit=1`),
          db(`en_progress?customer_id=eq.${target}&select=day,completed_at&order=day.asc`),
          db(`en_visit_days?customer_id=eq.${target}&select=visited_on,first_seen_at,last_seen_at&order=visited_on.desc&limit=60`),
          db(`en_offer_events?customer_id=eq.${target}&select=campaign_key,claimed_at,shown_at,clicked_at,dismissed_at&order=claimed_at.desc`),
          comprasDa(target, person.email),
          db(`en_admin_actions?target_customer_id=eq.${target}&select=action,details,created_at&order=created_at.desc&limit=30`),
          db(`en_entry_links?customer_id=eq.${target}&select=token,created_at,last_used_at,uses&limit=1`),
          extrasOf(target),
          db(`en_resgates?customer_id=eq.${target}&select=${RESGATE_FIELDS}&order=created_at.desc&limit=20`).catch(() => []),
        ]);
        // As compras, no formato que o painel (js/en/admin.js) já lê, herdado do
        // espanhol: `payments` (um por cobrança) e `orders` (o produto, o valor
        // e a etiqueta de cada uma). ⏳ EUA: checkout — vazias até lá.
        const payments = compras.map(c => ({
          event_type: 'payment', status: c.devuelto ? 'devolvido' : 'processed', detail: '', received_at: c.pagado_en, tx: c.pedido,
        }));
        const orders = compras.map(c => ({
          transaction_id: c.pedido, produtos: Array.isArray(c.produtos) ? c.produtos : [], amount_cents: c.valor_cents,
          currency: c.moneda, paid_at: c.pagado_en, utm_source: c.utm_source, utm_medium: c.utm_medium,
          utm_campaign: c.utm_campaign, utm_content: c.utm_content,
        }));
        return respond({
          customer: person, access: access[0] || null, progress, visits, offers, payments, orders, history,
          entry_link: links[0] || null,
          extras: extras ? { origem: extras.origem, cantico_hechos: extras.cantico_hechos } : null,
          resgates,
        });
      }

      // Os extras dentro do app (05-extras.sql). O painel manda por cima da
      // compra: liberar soma, retirar tira mesmo de quem comprou. Sem prazo
      // próprio: o extra vale enquanto o app valer.
      if (body.action === 'admin_grant_extra' || body.action === 'admin_revoke_extra') {
        const granting = body.action === 'admin_grant_extra';
        const product = typeof body.product === 'string' && EXTRA_KEYS.has(body.product) ? body.product : '';
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        if (!product) return respond({ error: ADMIN.badExtra }, 400);
        const [person] = await db(`en_customers?id=eq.${target}&select=email&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        await db('en_access?on_conflict=customer_id,product', 'POST', granting
          ? { customer_id: target, product, status: 'active', source: 'manual', expires_at: null, granted_at: now, revoked_at: null, updated_at: now }
          : { customer_id: target, product, status: 'revoked', source: 'manual', expires_at: null, revoked_at: now, updated_at: now },
          'return=minimal,resolution=merge-duplicates');
        await audit(granting ? 'grant_extra' : 'revoke_extra', target, person.email, { product });
        return respond({ ok: true });
      }

      if (body.action === 'admin_grant_access' || body.action === 'admin_revoke_access') {
        const granting = body.action === 'admin_grant_access';
        let id = target;
        let email = validEmail(body.email);
        if (!id) {
          // Liberar aceita e-mail que ainda não existe: é assim que entra quem
          // comprou fora do webhook, ou uma cortesia.
          if (!email) return respond({ error: ADMIN.badEmail }, 400);
          const [found] = await db(`en_customers?email=eq.${eq(email)}&select=id&limit=1`);
          if (found) id = found.id;
          else if (granting) id = (await db('en_customers', 'POST', { email }))[0].id;
          else return respond({ error: ADMIN.notFound }, 404);
        } else {
          const [found] = await db(`en_customers?id=eq.${id}&select=email&limit=1`);
          if (!found) return respond({ error: ADMIN.notFound }, 404);
          email = found.email;
        }
        const [current] = await db(`en_access?customer_id=eq.${id}&product=eq.app&select=status,expires_at&limit=1`);
        if (granting) {
          // 12 meses a partir de hoje, como na compra. Quem já tinha prazo maior
          // (ou nenhum prazo) não perde nada.
          const twelveMonths = new Date(Date.now() + MANUAL_ACCESS_MS).toISOString();
          const keep = current && (current.expires_at === null || Date.parse(current.expires_at) > Date.parse(twelveMonths));
          const expires = keep ? current.expires_at : twelveMonths;
          if (current) {
            await db(`en_access?customer_id=eq.${id}&product=eq.app`, 'PATCH',
              { status: 'active', revoked_at: null, expires_at: expires, updated_at: now }, 'return=minimal');
          } else {
            await db('en_access', 'POST',
              { customer_id: id, product: 'app', status: 'active', source: 'manual', expires_at: expires, granted_at: now, updated_at: now }, 'return=minimal');
          }
          await audit('grant_access', id, email, { expires_at: expires });
        } else {
          if (!current) return respond({ error: ADMIN.noAccess }, 404);
          await db(`en_access?customer_id=eq.${id}&product=eq.app`, 'PATCH',
            { status: 'revoked', revoked_at: now, updated_at: now }, 'return=minimal');
          await audit('revoke_access', id, email, {});
        }
        return respond({ ok: true, customer_id: id });
      }

      if (body.action === 'admin_update_email') {
        const email = validEmail(body.email);
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        if (!email) return respond({ error: ADMIN.badEmail }, 400);
        const [current] = await db(`en_customers?id=eq.${target}&select=email&limit=1`);
        if (!current) return respond({ error: ADMIN.notFound }, 404);
        if (current.email === email) return respond({ ok: true });
        const [taken] = await db(`en_customers?email=eq.${eq(email)}&select=id&limit=1`);
        if (taken && taken.id !== target) return respond({ error: ADMIN.taken }, 409);
        await db(`en_customers?id=eq.${target}`, 'PATCH', { email }, 'return=minimal');
        // ⏳ EUA: checkout — no espanhol, as compras dela (latam_whop_events)
        // iam junto com o e-mail. Aqui, en_pedidos_pagos acha a compra também
        // pela cliente (customer_id). Se a tabela do checkout achar a cliente
        // SÓ pelo e-mail, levar o e-mail junto aqui (ver trocarEmailGravado).
        // O e-mail é o login: as sessões abertas não sobrevivem à troca.
        await db(`en_sessions?customer_id=eq.${target}`, 'DELETE', undefined, 'return=minimal');
        await audit('update_email', target, email, { from: current.email, to: email });
        return respond({ ok: true });
      }

      if (body.action === 'admin_entry_link') {
        // Copiar de novo devolve o MESMO link (o que já foi mandado continua
        // valendo). Com renew: true, sai um código novo e o antigo para na hora.
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        const [person] = await db(`en_customers?id=eq.${target}&select=email&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        if (body.renew !== true) {
          const [existing] = await db(`en_entry_links?customer_id=eq.${target}&select=token,created_at,last_used_at,uses&limit=1`);
          if (existing) return respond({ entry_link: existing });
        }
        const [created] = await db('en_entry_links?on_conflict=customer_id', 'POST',
          { customer_id: target, token: newEntryCode(), created_by: customer.id, created_at: now, last_used_at: null, uses: 0 },
          'return=representation,resolution=merge-duplicates');
        await audit(body.renew === true ? 'renew_entry_link' : 'entry_link', target, person.email, {});
        return respond({ entry_link: { token: created.token, created_at: created.created_at, last_used_at: created.last_used_at, uses: created.uses } });
      }
    }

    if (body.action === 'progress') {
      const day = body.day;
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > LAST_DAY || typeof body.done !== 'boolean') {
        return respond({ error: MESSAGES.badRequest }, 400);
      }
      if (body.journey !== undefined && body.journey !== 'cantico') return respond({ error: MESSAGES.badRequest }, 400);

      // Um dia do Cântico. Só para quem tem o Cântico, e
      // só dia já aberto. A recusa vem com o retrato, como a das madrugadas
      // (a tela guarda o retrato que chega junto do 409).
      if (body.journey === 'cantico') {
        const mine = await extrasOf(customer.id);
        if (!mine) return respond({ error: MESSAGES.offline }, 503);
        if (!mine.extras.includes('cantico')) {
          return respond({ error: MESSAGES.notOwned, ...(await journey(customer, body.tz, access.until, false)) }, 409);
        }
        if (body.done && day > canticoOpen(calendar(customer, body.tz).open, mine.cantico_hechos)) {
          return respond({ error: MESSAGES.lockedCantico, ...(await journey(customer, body.tz, access.until, false)) }, 409);
        }
        if (body.done) {
          await db('en_cantico_progress?on_conflict=customer_id,day', 'POST',
            { customer_id: customer.id, day }, 'return=minimal,resolution=ignore-duplicates');
        } else {
          await db(`en_cantico_progress?customer_id=eq.${customer.id}&day=eq.${day}`, 'DELETE', undefined, 'return=minimal');
        }
        return respond(await journey(customer, body.tz, access.until, false));
      }

      if (body.done) {
        // O calendário resolve sem ir ao banco. Só um dia além do calendário
        // pede a lista do que ela já marcou (dia marcado nunca volta a trancar).
        if (day > calendar(customer, body.tz).open) {
          const before = await journey(customer, body.tz, access.until, false);
          if (day > before.abierto) return respond({ error: MESSAGES.locked, ...before }, 409);
        }
        await db('en_progress?on_conflict=customer_id,day', 'POST',
          { customer_id: customer.id, day }, 'return=minimal,resolution=ignore-duplicates');
      } else {
        await db(`en_progress?customer_id=eq.${customer.id}&day=eq.${day}`, 'DELETE', undefined, 'return=minimal');
      }
      return respond(await journey(customer, body.tz, access.until, false));
    }

    return respond(await journey(customer, body.tz, access.until, true));
  } catch (error) {
    console.error('en-api', error instanceof Error ? error.message : 'error');
    return respond({ error: MESSAGES.offline }, 503);
  }
});
