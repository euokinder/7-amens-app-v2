// Email-only identification is intentional for this validation release.
// No privileged key or database access is ever exposed to the browser.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = 'https://7-amens-app-v2.netlify.app';
const lifetime = 90 * 24 * 60 * 60 * 1000;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');
async function db(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method, headers: { apikey: secret, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Database operation failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
const eq = (value: string) => encodeURIComponent(value);
async function access(customerId: string) {
  const rows = await db(`entitlements?customer_id=eq.${customerId}&status=eq.active&select=product_key`);
  return rows.map((row: {product_key: string}) => row.product_key);
}
async function snapshot(customer: { id: string; email: string; name: string }, products: string[], includeOffer = false) {
  const [progress, catalog, offers] = await Promise.all([
    db(`prayer_progress?customer_id=eq.${customer.id}&select=prayer_key,completed,updated_at`),
    db('products?enabled=eq.true&select=key,title,description,checkout_url,content_url&order=sort_order.asc'),
    includeOffer ? db('rpc/claim_member_offer', 'POST', { p_customer_id: customer.id }) : Promise.resolve([]),
  ]);
  return { customer: { email: customer.email, name: customer.name }, products, progress, catalog, offer: offers[0] || null };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-member-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (origin && origin !== allowedOrigin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return respond({ error: 'Origem não permitida.' }, 403);
  if (origin?.startsWith('http://')) cors['Access-Control-Allow-Origin'] = origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return respond({ error: 'Solicitação inválida.' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return respond({ error: 'Solicitação inválida.' }, 400); }
    if (!body || typeof body !== 'object') return respond({ error: 'Solicitação inválida.' }, 400);
    if (body.action === 'login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'Confira seu e-mail e tente novamente.' }, 400);
      const rateKey = await hash(`login:${req.headers.get('x-forwarded-for')?.split(',')[0] || email}`);
      const permitted = await db('rpc/allow_member_login', 'POST', { bucket_key: rateKey });
      if (!permitted) return respond({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429);
      const customers = await db(`customers?email=eq.${eq(email)}&select=id,email,name&limit=1`);
      const customer = customers[0];
      const products = customer ? await access(customer.id) : [];
      if (!products.includes('principal')) return respond({ error: 'Não encontramos um acesso ativo para esse e-mail. Confira o e-mail da compra ou fale conosco.' }, 403);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await db('member_sessions', 'POST', { token_hash: await hash(token), customer_id: customer.id, expires_at: new Date(Date.now() + lifetime).toISOString() });
      return respond({ token, ...await snapshot(customer, products) });
    }
    const token = req.headers.get('x-member-session') || '';
    if (!/^[a-f0-9-]{72}$/.test(token)) return respond({ error: 'Entre novamente com seu e-mail.' }, 401);
    const tokenHash = await hash(token);
    const sessions = await db(`member_sessions?token_hash=eq.${tokenHash}&expires_at=gt.${eq(new Date().toISOString())}&select=customer_id&limit=1`);
    if (!sessions.length) return respond({ error: 'Entre novamente com seu e-mail.' }, 401);
    const customerId = sessions[0].customer_id;
    if (body.action === 'logout') {
      await db(`member_sessions?token_hash=eq.${tokenHash}`, 'DELETE');
      return respond({ ok: true });
    }
    const products = await access(customerId);
    if (!products.includes('principal')) return respond({ error: 'Seu acesso não está ativo. Fale conosco para receber ajuda.' }, 403);
    if (body.action === 'progress') {
      if (typeof body.prayer_key !== 'string' || !/^(principal:[0-7]|desatadora:[1-9])$/.test(body.prayer_key) || typeof body.completed !== 'boolean') return respond({ error: 'Progresso inválido.' }, 400);
      await db('prayer_progress?on_conflict=customer_id,prayer_key', 'POST', { customer_id: customerId, prayer_key: body.prayer_key, completed: body.completed, updated_at: new Date().toISOString() });
    } else if (body.action === 'offer_event') {
      const campaignKey = typeof body.campaign_key === 'string' ? body.campaign_key : '';
      const event = typeof body.event === 'string' ? body.event : '';
      if (!/^[a-z0-9_-]+$/.test(campaignKey) || !['shown', 'clicked', 'dismissed'].includes(event)) return respond({ error: 'Evento inválido.' }, 400);
      const column = `${event}_at`;
      await db(`member_offer_events?customer_id=eq.${customerId}&campaign_key=eq.${eq(campaignKey)}`, 'PATCH', { [column]: new Date().toISOString() });
      return respond({ ok: true });
    } else if (body.action !== 'session') return respond({ error: 'Ação inválida.' }, 400);
    const [customer] = await db(`customers?id=eq.${customerId}&select=id,email,name`);
    return respond(await snapshot(customer, products, body.action === 'session'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Member API error');
    return respond({ error: 'Não foi possível conectar agora. Tente novamente em instantes.' }, 503);
  }
});

