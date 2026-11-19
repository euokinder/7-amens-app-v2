// Prova da en-hubla publicada no projeto de TESTE (wyiqwsgfictcfkytldnu), de
// ponta a ponta: a venda dos Arcanjos pela Hubla libera o app e o extra, a
// cliente entra no app (en-api) com o e-mail da compra, a repetição não
// duplica, o reembolso só registra (e a compra aparece devolvida na lista do
// reembolso, en-refund), código desconhecido não libera, token errado volta.
// Os avisos têm a FORMA dos avisos reais deste produto (19/11/2026) e da
// documentação oficial da Hubla. O token de ensaio só vale no banco de teste.
// NUNCA aponta para a produção: o endereço está fixo e o script recusa outro.
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/en/testes/prova-hubla-no-teste.mjs
// São 15 chamadas, uma depois da outra.

const BASE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1';
if (!BASE.includes('wyiqwsgfictcfkytldnu')) throw new Error('Só o banco de TESTE.');
const ORIGIN = 'http://localhost:3500';
const TOKEN = 'hubla_ensaio_somente_no_banco_de_teste_en';
const EMAIL = 'prova.hubla.en@exemplo.com';
const OUTRA = 'prova.hubla.en.outra@exemplo.com';
const PRODUTO = 'iUKyTVZAZdUij7F61dFt';
const MICHAEL = '9TXhK3aXGlTym1dxWgXm';
const RUN = Date.now().toString(36);

let falhas = 0;
const confere = (nome, ok, extra = '') => {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}${extra ? ` | ${extra}` : ''}`);
};

async function aviso(type, event, { idem, token = TOKEN, sandbox = 'false' } = {}) {
  const r = await fetch(`${BASE}/en-hubla`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-hubla-token': token, 'x-hubla-sandbox': sandbox,
      'x-hubla-idempotency': idem || `prova-${RUN}-${Math.random().toString(36).slice(2)}`,
    },
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

const user = email => ({ id: 'provaHublaUser', email, firstName: 'Prova', lastName: 'Hubla', phone: '+15555550100', document: '' });
const produtos = (oferta, nome) => [{ id: PRODUTO, name: 'Protection of the Four Archangels', offers: [{ id: oferta, name: nome }] }];
const INVOICE = `prova-inv-${RUN}`;
const SUB = `prova-sub-${RUN}`;
const membro = (email = EMAIL, oferta = MICHAEL) => ({
  user: user(email), product: { id: PRODUTO, name: 'Protection of the Four Archangels' },
  products: produtos(oferta, 'The Shield of Michael'),
  subscription: { id: SUB, type: 'one_time', status: 'active',
    firstPaymentSession: { utm: { source: 'app-en', medium: 'pagina', campaign: 'arcanjos', content: null, term: 'pagina-vsl' } } },
});
const fatura = (status = 'paid', extra = {}) => ({
  user: user(EMAIL), product: { id: PRODUTO, name: 'Protection of the Four Archangels' },
  products: produtos(MICHAEL, 'The Shield of Michael'),
  invoice: { id: INVOICE, subscriptionId: SUB, status, currency: 'USD', amount: { totalCents: 3430 },
    paymentSession: { utm: { source: 'app-en', medium: 'pagina', campaign: 'arcanjos', term: 'pagina-vsl' } } },
  ...extra,
});

// 1. A Hubla dá o acesso (customer.member_added), e a mesma entrega de novo.
const IDEM = `prova-${RUN}-membro`;
const a1 = await aviso('customer.member_added', membro(), { idem: IDEM });
confere('acesso dado: libera', a1.status === 200 && a1.json?.liberado === true, JSON.stringify(a1.json));
const a2 = await aviso('customer.member_added', membro(), { idem: IDEM });
confere('mesma entrega de novo: 200', a2.status === 200, JSON.stringify(a2.json));

// 2. A fatura paga (o valor vai para a lista de compras).
const p1 = await aviso('invoice.payment_succeeded', fatura());
confere('fatura paga: 200', p1.status === 200 && p1.json?.liberado === true, JSON.stringify(p1.json));

// 3. Ela entra no app com o e-mail da compra, com os Arcanjos e 12 meses.
const l1 = await api({ action: 'login', email: EMAIL });
const token = l1.json?.token;
confere('entra no app com o e-mail da compra', l1.status === 200 && /^[a-f0-9]{64}$/.test(token || ''), `status ${l1.status} "${l1.json?.error || ''}"`);
confere('nome da compra e Arcanjos liberados', l1.json?.cliente?.nombre === 'Prova' && JSON.stringify(l1.json?.extras) === '["arcangeles"]',
  `nombre ${l1.json?.cliente?.nombre}, extras ${JSON.stringify(l1.json?.extras)}`);
confere('acesso por 12 meses', /\b2027\b/.test(l1.json?.acceso_hasta || ''), l1.json?.acceso_hasta);

// 4. A lista do reembolso enxerga UMA compra (a fatura), de US$ 34,30.
const c1 = await chamar('en-refund', { action: 'compras', email: EMAIL });
const compras = c1.json?.compras || [];
confere('reembolso: uma compra, pela visão', c1.status === 200 && compras.length === 1
  && compras[0].valor_cents === 3430 && compras[0].nombre === 'The Four Archangels' && compras[0].devuelto === false,
  JSON.stringify(compras.map(c => [c.pedido, c.nombre, c.valor_cents, c.devuelto])));

// 5. Reembolso (fatura reembolsada e acesso removido): só registra.
const r1 = await aviso('invoice.refunded', fatura('refunded'));
const r2 = await aviso('customer.member_removed', { ...membro(), subscription: { id: SUB, type: 'one_time', status: 'inactive' } });
confere('reembolso e acesso removido: 200, sem liberar', r1.status === 200 && r2.status === 200 && !r1.json?.liberado && !r2.json?.liberado,
  `${JSON.stringify(r1.json)} ${JSON.stringify(r2.json)}`);
const s2 = await api({ action: 'session' }, token);
confere('depois do reembolso, o app e os Arcanjos continuam', s2.status === 200 && JSON.stringify(s2.json?.extras) === '["arcangeles"]',
  `status ${s2.status} extras ${JSON.stringify(s2.json?.extras)}`);
const c2 = await chamar('en-refund', { action: 'compras', email: EMAIL });
confere('a compra aparece devolvida', (c2.json?.compras || [])[0]?.devuelto === true, JSON.stringify(c2.json?.compras));

// 6. Código que não está na tabela: não libera ninguém.
const d1 = await aviso('customer.member_added', {
  user: user(OUTRA), product: { id: 'CodigoDesconhecido01', name: 'Unknown' },
  products: [{ id: 'CodigoDesconhecido01', name: 'Unknown', offers: [{ id: 'CodigoDesconhecido01', name: 'Unknown' }] }],
  subscription: { id: `prova-sub2-${RUN}`, type: 'one_time', status: 'active' },
});
confere('código desconhecido: 200, needs_review', d1.status === 200 && d1.json?.status === 'needs_review' && !d1.json?.liberado, JSON.stringify(d1.json));
const l2 = await api({ action: 'login', email: OUTRA });
confere('quem comprou o desconhecido não entra', l2.status === 403, `status ${l2.status}`);

// 7. Token errado.
const e1 = await aviso('customer.member_added', membro(OUTRA), { token: 'token-errado' });
confere('token errado recusado', e1.status === 401, `${e1.status}`);

// 8. Fecha a sessão aberta pela prova.
const out = await api({ action: 'logout' }, token);
confere('logout', out.status === 200, `${out.status}`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
console.log(`
Conferir no banco de TESTE:
  select a.product, a.status, a.source, a.expires_at from public.en_access a
    join public.en_customers c on c.id = a.customer_id where c.email = '${EMAIL}' order by a.product;
  select event_type, produtos, status, detail from public.en_hubla_events where idempotency_key like 'prova-${RUN}%' order by received_at;
Apagar depois:
  delete from public.en_hubla_events where idempotency_key like 'prova-%';
  delete from public.en_customers where email in ('${EMAIL}', '${OUTRA}');`);
process.exitCode = falhas ? 1 : 0;
