// latam-api: o login e a jornada do app em espanhol (7 Amenes de la Madrugada).
//
// SEPARADA do app brasileiro de propósito (docs/app-es.md). Lê e grava só
// tabelas latam_*: nunca customers, entitlements, member_sessions nem nada do
// Brasil. A member-api não sabe que esta função existe, e vice-versa.
//
// Ações:
//   login     e-mail da compra -> sessão de 90 dias (sem senha, como no Brasil)
//   entry     link de entrada (/es-entrar#código) -> sessão
//   session   confere a sessão e devolve o retrato da jornada
//   progress  marca ou desmarca um dia como rezado ("Ya recé"). Com
//             journey: 'cantico', um dia do Cántico ("Terminé este día")
//   oferta    registra o que ela fez com o pop-up (apareceu, tocou, fechou)
//   logout    encerra a sessão
//   admin_*   o painel da LATAM (/es-admin), só para quem está em latam_admins
//             (supabase/latam/04-admin.sql)
//
// OS POP-UPS (07/11/2026): a mesma lógica do Brasil, em tabelas latam_
// (supabase/latam/03-popups.sql). Ao abrir a página, junto com o retrato, o
// banco escolhe o pop-up dela (latam_claim_offer) e ele vem em `oferta`.
// Não custa chamada a mais: vai na mesma ida ao servidor. Se o banco ainda não
// tiver a função, ou ela falhar, vem `oferta: null` e o app segue normal.
//
// OS EXTRAS DENTRO DO APP (07/11/2026): o UP01 (Arcángeles) e o UP02 (Cántico
// Angelical), no mesmo esquema do Brasil. Quem tem cada um sai de
// latam_extras (supabase/latam/05-extras.sql): a compra, a dúvida (libera os
// dois, decisão do Caio) e o painel por cima. Vem no retrato, em `extras`
// (['arcangeles','cantico']), e o Cántico, em `cantico` ({abierto,
// completados}), com a MESMA âncora e o mesmo calendário das madrugadas.
// Sem a função no banco, ou se ela falhar, vem `extras: null`: a tela abre
// os dois (a mesma rede de segurança da trava do Brasil: na dúvida, não
// tranca quem pagou).
//
// A TRAVA (uma oração por dia) é calculada AQUI, no servidor:
//   - "hoje" é o dia no fuso do celular dela, guardado no primeiro acesso
//     (sem fuso válido, vale America/Mexico_City). O relógio do celular não
//     manda: só o fuso, uma vez;
//   - no dia do primeiro acesso ela tem o Comienza aquí (dia 0) e o Primer
//     Amén (dia 1); cada meia-noite, no fuso dela, abre o seguinte, até o 7;
//   - não depende de marcar "Ya recé": é calendário, não botão;
//   - dia já marcado nunca volta a trancar.
// É trava de experiência, não de segurança (os textos são arquivos públicos),
// a mesma calibragem do app brasileiro.
//
// A cota de chamadas do Supabase é da organização inteira, dividida com o
// Brasil. Por isso a tela chama esta função só ao abrir a página, nunca de
// tempos em tempos.

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

const DEFAULT_TZ = 'America/Mexico_City';
const SESSION_MS = 90 * 24 * 60 * 60 * 1000;
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
  const [row] = await db(`latam_access?customer_id=eq.${customerId}&product=eq.app&select=status,expires_at&limit=1`);
  if (!row || row.status !== 'active') return { ok: false as const, expired: null };
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return { ok: false as const, expired: row.expires_at as string };
  return { ok: true as const, until: (row.expires_at as string | null) || null };
}

// Data do fim do acesso, como ela lê: 05/11/2027.
const asDayMonthYear = (iso: string, zone: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

const MESSAGES = {
  badEmail: 'Escribe el correo que usaste en la compra, completo (por ejemplo: maria@gmail.com).',
  tooMany: 'Hubo muchos intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  notFound: 'No encontramos una compra con este correo. Revisa que sea el mismo correo que usaste al pagar.',
  expired: (date: string) => `Tu acceso terminó el ${date}. Escríbenos y te ayudamos.`,
  badLink: 'Este enlace está incompleto. Pide uno nuevo a nuestro equipo.',
  deadLink: 'Este enlace ya no funciona. Pide uno nuevo a nuestro equipo.',
  signInAgain: 'Tu sesión terminó. Entra de nuevo con tu correo.',
  locked: 'Este día todavía no está abierto. Cada madrugada se abre una oración nueva.',
  lockedCantico: 'Este día del Cántico todavía no está abierto. Se abre un día a la vez.',
  notOwned: 'Este contenido todavía no está en tu acceso.',
  badRequest: 'Solicitud inválida.',
  offline: 'No pudimos conectar ahora. Inténtalo de nuevo en unos instantes.',
};

async function createSession(customerId: string) {
  const token = newSessionToken();
  await db('latam_sessions', 'POST', {
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

// Os extras dela (latam_extras, em 05-extras.sql). Falhar aqui nunca derruba
// a jornada: vem null, e a tela abre os dois.
type Extras = { extras: string[]; origem: Record<string, string>; cantico_hechos: number[] };
const EXTRA_KEYS = new Set(['arcangeles', 'cantico']);
async function extrasOf(customerId: string): Promise<Extras | null> {
  try {
    const answer = await db('rpc/latam_extras', 'POST', { p_customer_id: customerId });
    if (!answer || !Array.isArray(answer.extras)) return null;
    return {
      extras: answer.extras.filter((key: unknown) => typeof key === 'string' && EXTRA_KEYS.has(key)),
      origem: answer.origem && typeof answer.origem === 'object' ? answer.origem : {},
      cantico_hechos: (Array.isArray(answer.cantico_hechos) ? answer.cantico_hechos : [])
        .map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= LAST_DAY),
    };
  } catch (error) {
    console.error('latam-api extras', error instanceof Error ? error.message : 'error');
    return null;
  }
}
// Até que dia o Cántico está aberto: o mesmo calendário das madrugadas, e dia
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
    writes.push(db(`latam_customers?id=eq.${customer.id}&first_access_on=is.null`, 'PATCH',
      { first_access_on: today, timezone: customer.timezone || zone }, 'return=minimal'));
  } else if (!customer.timezone) {
    writes.push(db(`latam_customers?id=eq.${customer.id}&timezone=is.null`, 'PATCH', { timezone: zone }, 'return=minimal'));
  }
  if (visit) {
    writes.push(db('latam_visit_days?on_conflict=customer_id,visited_on', 'POST',
      { customer_id: customer.id, visited_on: today, last_seen_at: nowIso() }, 'return=minimal,resolution=merge-duplicates'));
  }
  // O pop-up só vem ao abrir a página (visit), nunca ao marcar um dia. Falhar
  // aqui nunca derruba a jornada: na dúvida, sem pop-up.
  const offer = visit ? claimOffer(customer.id, zone) : Promise.resolve(null);
  const [rows, oferta, extras] = await Promise.all([
    db(`latam_progress?customer_id=eq.${customer.id}&select=day&order=day.asc`),
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
    acceso_hasta: accessUntil ? asDayMonthYear(accessUntil, zone) : null,
    oferta,
    extras: extras ? extras.extras : null,
    cantico: { abierto: canticoOpen(calendarOpen, canticoDone), completados: canticoDone },
  };
}

const OFFER_KEY = /^[a-z0-9_-]+$/;

// O painel (/es-admin). Em português: quem usa é a equipe brasileira.
const ADMIN_ACTIONS = new Set([
  'admin_dashboard', 'admin_customer_detail', 'admin_grant_access',
  'admin_revoke_access', 'admin_update_email', 'admin_entry_link',
  'admin_grant_extra', 'admin_revoke_extra',
]);
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
const KASHPAY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MANUAL_ACCESS_MS = 365 * 24 * 60 * 60 * 1000;
// O código do link de entrada: 16 letras e números (a mesma regra de
// ENTRY_CODE e da trava do banco), sem os que se confundem (0/O, 1/l/I).
const ENTRY_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const newEntryCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => ENTRY_LETTERS[b % ENTRY_LETTERS.length]).join('');
async function claimOffer(customerId: string, zone: string) {
  try {
    const rows = await db('rpc/latam_claim_offer', 'POST', { p_customer_id: customerId, p_zone: zone });
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
    console.error('latam-api oferta', error instanceof Error ? error.message : 'error');
    return null;
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
    if (raw.length > 2048) return respond({ error: MESSAGES.badRequest }, 400);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return respond({ error: MESSAGES.badRequest }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ error: MESSAGES.badRequest }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';

    // --------------------------------------------------------- sem sessão
    if (body.action === 'login') {
      const email = validEmail(body.email);
      if (!email) return respond({ error: MESSAGES.badEmail }, 400);
      // O balde é por pessoa (e-mail) dentro do endereço de internet, como no
      // Brasil: a operadora põe muita gente atrás do mesmo IP.
      const [allowed, [customer]] = await Promise.all([
        db('rpc/latam_allow_login', 'POST', { bucket_key: await sha256(`login:${ip}|${email}`) }),
        db(`latam_customers?email=eq.${eq(email)}&select=${CUSTOMER_FIELDS}&limit=1`),
      ]);
      if (!allowed) return respond({ error: MESSAGES.tooMany }, 429);
      if (!customer) return respond({ error: MESSAGES.notFound }, 403);
      const access = await accessOf(customer.id);
      if (!access.ok) {
        const zone = validTimeZone(customer.timezone) || validTimeZone(body.tz) || DEFAULT_TZ;
        return respond({ error: access.expired ? MESSAGES.expired(asDayMonthYear(access.expired, zone)) : MESSAGES.notFound }, 403);
      }
      const [token, portrait] = await Promise.all([createSession(customer.id), journey(customer, body.tz, access.until, true)]);
      return respond({ token, ...portrait });
    }

    if (body.action === 'entry') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!ENTRY_CODE.test(code)) return respond({ error: MESSAGES.badLink }, 400);
      const [allowed, [link]] = await Promise.all([
        db('rpc/latam_allow_login', 'POST', { bucket_key: await sha256(`entrada:${ip}|${code}`) }),
        db(`latam_entry_links?token=eq.${code}&select=customer_id,uses&limit=1`),
      ]);
      if (!allowed) return respond({ error: MESSAGES.tooMany }, 429);
      if (!link) return respond({ error: MESSAGES.deadLink }, 404);
      const [customer] = await db(`latam_customers?id=eq.${link.customer_id}&select=${CUSTOMER_FIELDS}&limit=1`);
      const access = customer ? await accessOf(customer.id) : { ok: false as const, expired: null };
      if (!customer || !access.ok) {
        const zone = validTimeZone(customer?.timezone) || DEFAULT_TZ;
        return respond({ error: access.expired ? MESSAGES.expired(asDayMonthYear(access.expired, zone)) : MESSAGES.deadLink }, 403);
      }
      const [token, portrait] = await Promise.all([
        createSession(customer.id),
        journey(customer, body.tz, access.until, true),
        // Só para o suporte saber se ela já tocou no link.
        db(`latam_entry_links?customer_id=eq.${customer.id}`, 'PATCH',
          { last_used_at: nowIso(), uses: (Number(link.uses) || 0) + 1 }, 'return=minimal'),
      ]);
      return respond({ token, ...portrait });
    }

    // --------------------------------------------------------- com sessão
    const token = req.headers.get('x-latam-session') || '';
    if (!SESSION_TOKEN.test(token)) return respond({ error: MESSAGES.signInAgain }, 401);
    const tokenHash = await sha256(token);
    const [session] = await db(`latam_sessions?token_hash=eq.${tokenHash}&expires_at=gt.${eq(nowIso())}&select=customer_id&limit=1`);
    if (!session) return respond({ error: MESSAGES.signInAgain }, 401);

    if (body.action === 'logout') {
      await db(`latam_sessions?token_hash=eq.${tokenHash}`, 'DELETE', undefined, 'return=minimal');
      return respond({ ok: true });
    }
    const isAdminAction = typeof body.action === 'string' && ADMIN_ACTIONS.has(body.action);
    if (body.action !== 'session' && body.action !== 'progress' && body.action !== 'oferta' && !isAdminAction) return respond({ error: MESSAGES.badRequest }, 400);

    const [[customer], access] = await Promise.all([
      db(`latam_customers?id=eq.${session.customer_id}&select=${CUSTOMER_FIELDS}&limit=1`),
      accessOf(session.customer_id),
    ]);
    if (!customer || !access.ok) {
      const zone = validTimeZone(customer?.timezone) || DEFAULT_TZ;
      return respond({ error: !access.ok && access.expired ? MESSAGES.expired(asDayMonthYear(access.expired, zone)) : MESSAGES.notFound }, 403);
    }

    if (body.action === 'oferta') {
      // Como o offer_event do Brasil: só marca a hora, uma vez (a primeira).
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const event = typeof body.event === 'string' ? body.event : '';
      if (!OFFER_KEY.test(campaignKey) || !['shown', 'clicked', 'dismissed'].includes(event)) return respond({ error: MESSAGES.badRequest }, 400);
      const column = `${event}_at`;
      await db(`latam_offer_events?customer_id=eq.${customer.id}&campaign_key=eq.${eq(campaignKey)}&${column}=is.null`, 'PATCH',
        { [column]: nowIso() }, 'return=minimal');
      return respond({ ok: true });
    }

    // ------------------------------------------- o painel (/es-admin, 07/11)
    // Só para quem está em latam_admins. Lê e grava só tabelas latam_: o painel
    // do Brasil (admin.html + member-api) não é tocado. Toda ação que muda algo
    // fica em latam_admin_actions, com quem fez.
    if (isAdminAction) {
      const [admin] = await db(`latam_admins?customer_id=eq.${customer.id}&select=customer_id&limit=1`);
      if (!admin) return respond({ error: ADMIN.forbidden }, 403);
      const audit = (action: string, target: string | null, email: string, details: Record<string, unknown>) =>
        db('latam_admin_actions', 'POST',
          { admin_customer_id: customer.id, target_customer_id: target, target_email: email, action, details }, 'return=minimal');
      const target = typeof body.customer_id === 'string' && UUID.test(body.customer_id) ? body.customer_id : '';
      const now = nowIso();

      if (body.action === 'admin_dashboard') {
        // A lista inteira: os números do topo e a busca saem dela, no navegador.
        const [customers, campaigns] = await Promise.all([
          db('rpc/latam_admin_customers', 'POST', {}),
          db('rpc/latam_admin_offers', 'POST', {}),
        ]);
        return respond({ customers, campaigns });
      }

      if (body.action === 'admin_customer_detail') {
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        const [person] = await db(`latam_customers?id=eq.${target}&select=id,email,name,country,timezone,first_access_on,created_at&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        const [access, progress, visits, offers, payments, history, links, extras] = await Promise.all([
          db(`latam_access?customer_id=eq.${target}&product=eq.app&select=status,source,expires_at,granted_at,revoked_at&limit=1`),
          db(`latam_progress?customer_id=eq.${target}&select=day,completed_at&order=day.asc`),
          db(`latam_visit_days?customer_id=eq.${target}&select=visited_on,first_seen_at,last_seen_at&order=visited_on.desc&limit=60`),
          db(`latam_offer_events?customer_id=eq.${target}&select=campaign_key,claimed_at,shown_at,clicked_at,dismissed_at&order=claimed_at.desc`),
          db(`latam_whop_events?customer_email=eq.${eq(person.email)}&select=event_type,status,detail,received_at,tx:payload->data->metadata->>kashpay_transaction_id&order=received_at.desc&limit=40`),
          db(`latam_admin_actions?target_customer_id=eq.${target}&select=action,details,created_at&order=created_at.desc&limit=30`),
          db(`latam_entry_links?customer_id=eq.${target}&select=token,created_at,last_used_at,uses&limit=1`),
          extrasOf(target),
        ]);
        // O produto de cada pagamento está no pedido da KashPay (a Whop não diz).
        const ids = [...new Set((payments as { tx?: unknown }[]).map(p => p.tx).filter((id): id is string => typeof id === 'string' && KASHPAY_ID.test(id)))];
        const orders = ids.length
          ? await db(`latam_kashpay_events?event=eq.order.paid&transaction_id=in.(${ids.join(',')})&select=transaction_id,produtos,amount_cents,currency,paid_at,utm_source,utm_medium,utm_campaign,utm_content`)
          : [];
        return respond({
          customer: person, access: access[0] || null, progress, visits, offers, payments, orders, history,
          entry_link: links[0] || null,
          extras: extras ? { origem: extras.origem, cantico_hechos: extras.cantico_hechos } : null,
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
        const [person] = await db(`latam_customers?id=eq.${target}&select=email&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        await db('latam_access?on_conflict=customer_id,product', 'POST', granting
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
          const [found] = await db(`latam_customers?email=eq.${eq(email)}&select=id&limit=1`);
          if (found) id = found.id;
          else if (granting) id = (await db('latam_customers', 'POST', { email }))[0].id;
          else return respond({ error: ADMIN.notFound }, 404);
        } else {
          const [found] = await db(`latam_customers?id=eq.${id}&select=email&limit=1`);
          if (!found) return respond({ error: ADMIN.notFound }, 404);
          email = found.email;
        }
        const [current] = await db(`latam_access?customer_id=eq.${id}&product=eq.app&select=status,expires_at&limit=1`);
        if (granting) {
          // 12 meses a partir de hoje, como na compra. Quem já tinha prazo maior
          // (ou nenhum prazo) não perde nada.
          const twelveMonths = new Date(Date.now() + MANUAL_ACCESS_MS).toISOString();
          const keep = current && (current.expires_at === null || Date.parse(current.expires_at) > Date.parse(twelveMonths));
          const expires = keep ? current.expires_at : twelveMonths;
          if (current) {
            await db(`latam_access?customer_id=eq.${id}&product=eq.app`, 'PATCH',
              { status: 'active', revoked_at: null, expires_at: expires, updated_at: now }, 'return=minimal');
          } else {
            await db('latam_access', 'POST',
              { customer_id: id, product: 'app', status: 'active', source: 'manual', expires_at: expires, granted_at: now, updated_at: now }, 'return=minimal');
          }
          await audit('grant_access', id, email, { expires_at: expires });
        } else {
          if (!current) return respond({ error: ADMIN.noAccess }, 404);
          await db(`latam_access?customer_id=eq.${id}&product=eq.app`, 'PATCH',
            { status: 'revoked', revoked_at: now, updated_at: now }, 'return=minimal');
          await audit('revoke_access', id, email, {});
        }
        return respond({ ok: true, customer_id: id });
      }

      if (body.action === 'admin_update_email') {
        const email = validEmail(body.email);
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        if (!email) return respond({ error: ADMIN.badEmail }, 400);
        const [current] = await db(`latam_customers?id=eq.${target}&select=email&limit=1`);
        if (!current) return respond({ error: ADMIN.notFound }, 404);
        if (current.email === email) return respond({ ok: true });
        const [taken] = await db(`latam_customers?email=eq.${eq(email)}&select=id&limit=1`);
        if (taken && taken.id !== target) return respond({ error: ADMIN.taken }, 409);
        await db(`latam_customers?id=eq.${target}`, 'PATCH', { email }, 'return=minimal');
        // As compras dela são achadas pelo e-mail (latam_whop_events): sem levar
        // o e-mail junto, ela "perderia" o que comprou, no painel e na escolha
        // dos pop-ups. O aviso original (payload) não muda.
        await db(`latam_whop_events?customer_email=eq.${eq(current.email)}`, 'PATCH', { customer_email: email }, 'return=minimal');
        // O e-mail é o login: as sessões abertas não sobrevivem à troca.
        await db(`latam_sessions?customer_id=eq.${target}`, 'DELETE', undefined, 'return=minimal');
        await audit('update_email', target, email, { from: current.email, to: email });
        return respond({ ok: true });
      }

      if (body.action === 'admin_entry_link') {
        // Copiar de novo devolve o MESMO link (o que já foi mandado continua
        // valendo). Com renew: true, sai um código novo e o antigo para na hora.
        if (!target) return respond({ error: ADMIN.badCustomer }, 400);
        const [person] = await db(`latam_customers?id=eq.${target}&select=email&limit=1`);
        if (!person) return respond({ error: ADMIN.notFound }, 404);
        if (body.renew !== true) {
          const [existing] = await db(`latam_entry_links?customer_id=eq.${target}&select=token,created_at,last_used_at,uses&limit=1`);
          if (existing) return respond({ entry_link: existing });
        }
        const [created] = await db('latam_entry_links?on_conflict=customer_id', 'POST',
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

      // Um dia do Cántico ("Terminé este día"). Só para quem tem o Cántico, e
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
          await db('latam_cantico_progress?on_conflict=customer_id,day', 'POST',
            { customer_id: customer.id, day }, 'return=minimal,resolution=ignore-duplicates');
        } else {
          await db(`latam_cantico_progress?customer_id=eq.${customer.id}&day=eq.${day}`, 'DELETE', undefined, 'return=minimal');
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
        await db('latam_progress?on_conflict=customer_id,day', 'POST',
          { customer_id: customer.id, day }, 'return=minimal,resolution=ignore-duplicates');
      } else {
        await db(`latam_progress?customer_id=eq.${customer.id}&day=eq.${day}`, 'DELETE', undefined, 'return=minimal');
      }
      return respond(await journey(customer, body.tz, access.until, false));
    }

    return respond(await journey(customer, body.tz, access.until, true));
  } catch (error) {
    console.error('latam-api', error instanceof Error ? error.message : 'error');
    return respond({ error: MESSAGES.offline }, 503);
  }
});
