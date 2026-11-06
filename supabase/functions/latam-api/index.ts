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
//   progress  marca ou desmarca um dia como rezado ("Ya recé")
//   logout    encerra a sessão
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
  const [rows] = await Promise.all([
    db(`latam_progress?customer_id=eq.${customer.id}&select=day&order=day.asc`),
    ...writes,
  ]);
  const done = (rows as { day: number }[]).map(row => Number(row.day)).filter(day => day >= 0 && day <= LAST_DAY);
  // Dia já marcado nunca volta a trancar.
  const open = Math.min(LAST_DAY, Math.max(calendarOpen, ...done));
  return {
    cliente: { nombre: firstName(customer.name), email: customer.email },
    hoy: today,
    zona: zone,
    abierto: open,
    completados: done,
    acceso_hasta: accessUntil ? asDayMonthYear(accessUntil, zone) : null,
  };
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
    if (body.action !== 'session' && body.action !== 'progress') return respond({ error: MESSAGES.badRequest }, 400);

    const [[customer], access] = await Promise.all([
      db(`latam_customers?id=eq.${session.customer_id}&select=${CUSTOMER_FIELDS}&limit=1`),
      accessOf(session.customer_id),
    ]);
    if (!customer || !access.ok) {
      const zone = validTimeZone(customer?.timezone) || DEFAULT_TZ;
      return respond({ error: !access.ok && access.expired ? MESSAGES.expired(asDayMonthYear(access.expired, zone)) : MESSAGES.notFound }, 403);
    }

    if (body.action === 'progress') {
      const day = body.day;
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > LAST_DAY || typeof body.done !== 'boolean') {
        return respond({ error: MESSAGES.badRequest }, 400);
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
