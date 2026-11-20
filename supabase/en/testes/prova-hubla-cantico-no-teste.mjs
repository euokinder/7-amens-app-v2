// Prova, no projeto de TESTE (wyiqwsgfictcfkytldnu), de que a venda do Angelic
// Canticle pela Hubla (15-hubla-cantico.sql) libera o app e o Cântico sozinha,
// pela en-hubla que já existe (a mesma da prova dos Arcanjos). Os avisos têm a
// forma dos avisos reais da Hubla: event.product.id = o produto/oferta e
// event.products[].id = o legacyId. O token de ensaio só vale no banco de teste.
// NUNCA aponta para a produção: o endereço está fixo e o script recusa outro.
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/en/testes/prova-hubla-cantico-no-teste.mjs
// São 8 chamadas, uma depois da outra.

const BASE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1';
if (!BASE.includes('wyiqwsgfictcfkytldnu')) throw new Error('Só o banco de TESTE.');
const ORIGIN = 'http://localhost:3500';
const TOKEN = 'hubla_ensaio_somente_no_banco_de_teste_en';
const EMAIL = 'prova.hubla.cantico@exemplo.com';
const PRODUTO = 'jXYM7bYWFscWbDIhrTWC';   // produto e oferta
const LEGACY = 'ZHFtB3h77n7zAjgwgam2';    // legacyId do produto
const RUN = Date.now().toString(36);

let falhas = 0;
const confere = (nome, ok, extra = '') => {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}${extra ? ` | ${extra}` : ''}`);
};

async function aviso(type, event, idem) {
  const r = await fetch(`${BASE}/en-hubla`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hubla-token': TOKEN, 'x-hubla-sandbox': 'false',
      'x-hubla-idempotency': idem || `prova-${RUN}-${Math.random().toString(36).slice(2)}` },
    body: JSON.stringify({ type, version: '2.0.0', event }),
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { json = { bruto: texto.slice(0, 200) }; }
  return { status: r.status, json };
}
async function chamar(funcao, corpo, sessao) {
  const headers = { Origin: ORIGIN, 'Content-Type': 'application/json' };
  if (sessao) headers['x-en-session'] = sessao;
  const r = await fetch(`${BASE}/${funcao}`, { method: 'POST', headers, body: JSON.stringify(corpo) });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { bruto: texto.slice(0, 200) }; }
  return { status: r.status, json };
}
const api = (corpo, sessao) => chamar('en-api', { tz: 'America/New_York', ...corpo }, sessao);

const user = { id: 'provaCanticoUser', email: EMAIL, firstName: 'Prova', lastName: 'Canticle', phone: '+15555550101', document: '' };
const product = { id: PRODUTO, name: 'Angelic Canticle' };
const products = [{ id: LEGACY, name: 'Angelic Canticle', offers: [{ id: PRODUTO, name: 'Angelic Canticle' }] }];
const SUB = `prova-sub-${RUN}`;
const utm = { source: 'app-en', medium: 'direto', campaign: 'cantico', content: 'sem-popup' };

// 1. Acesso dado, e a mesma entrega de novo.
const IDEM = `prova-${RUN}-membro`;
const membro = { user, product, products, subscription: { id: SUB, type: 'one_time', status: 'active', firstPaymentSession: { utm } } };
const a1 = await aviso('customer.member_added', membro, IDEM);
confere('acesso dado: libera', a1.status === 200 && a1.json?.liberado === true, JSON.stringify(a1.json));
const a2 = await aviso('customer.member_added', membro, IDEM);
confere('mesma entrega de novo: 200', a2.status === 200, JSON.stringify(a2.json));

// 2. Fatura paga com o cupom (US$ 32,90).
const p1 = await aviso('invoice.payment_succeeded', { user, product, products,
  invoice: { id: `prova-inv-${RUN}`, subscriptionId: SUB, status: 'paid', currency: 'USD', amount: { totalCents: 3290 }, paymentSession: { utm } } });
confere('fatura paga: libera', p1.status === 200 && p1.json?.liberado === true, JSON.stringify(p1.json));

// 3. Ela entra no app com o e-mail da compra, com o Cântico e 12 meses.
const l1 = await api({ action: 'login', email: EMAIL });
const token = l1.json?.token;
confere('entra no app com o e-mail da compra', l1.status === 200 && /^[a-f0-9]{64}$/.test(token || ''), `status ${l1.status} "${l1.json?.error || ''}"`);
confere('Cântico liberado (e só ele)', JSON.stringify(l1.json?.extras) === '["cantico"]', `extras ${JSON.stringify(l1.json?.extras)}`);
confere('acesso por 12 meses', /\b2027\b/.test(l1.json?.acceso_hasta || ''), l1.json?.acceso_hasta);

// 4. A lista do reembolso enxerga a compra de US$ 32,90.
const c1 = await chamar('en-refund', { action: 'compras', email: EMAIL });
const compras = c1.json?.compras || [];
confere('reembolso: uma compra de 32,90', c1.status === 200 && compras.length === 1 && compras[0].valor_cents === 3290,
  JSON.stringify(compras.map(c => [c.pedido, c.nombre, c.valor_cents, c.devuelto])));

// 5. Fecha a sessão.
const out = await api({ action: 'logout' }, token);
confere('logout', out.status === 200, `${out.status}`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
console.log(`
Apagar depois (banco de TESTE):
  delete from public.en_hubla_events where idempotency_key like 'prova-${RUN}%';
  delete from public.en_customers where email = '${EMAIL}';`);
process.exitCode = falhas ? 1 : 0;
