// Prova de que a latam-kashpay LIBERA o app (08/11/2026), no projeto de
// TESTE do Supabase (wyiqwsgfictcfkytldnu). Nunca aponta para a produção: o
// endereço está fixo aqui embaixo.
//
// Imita as vendas processadas pela Digistore24 (os produtos "… D" da
// KashPay), com e-mail de mentira (@exemplo.com). São 6 chamadas, uma de
// cada vez. A conferência no banco é feita com o SQL que o script imprime
// no fim (e a limpeza também).
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/latam/testes/prova-libera-no-teste.mjs

import { createHmac } from 'node:crypto';

const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/latam-kashpay';
const SEGREDO_DE_ENSAIO = 'kp_ensaio_somente_no_banco_de_teste_latam';
const marca = `prova-libera-${Date.now()}`;
const email = `${marca}@exemplo.com`;
let ok = 0;
let falha = 0;
const confere = (descricao, condicao, detalhe = '') => {
  if (condicao) { ok += 1; console.log(`  ok    ${descricao}`); }
  else { falha += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
};

const oferta = (id, name, total, type = 'main') => ({ id, name, price: total, type, quantity: 1, total });
const pedido = (id, offers, extra = {}) => ({
  id, amount: offers.reduce((soma, o) => soma + o.total, 0), currency: 'USD', net_amount: 2000, status: 'paid', payment_method: 'card',
  created_at: new Date(Date.now() - 60_000).toISOString(), paid_at: new Date().toISOString(), refunded_at: null, chargeback_at: null,
  payment_details: { id: 'pi_prova', card_brand: 'visa', card_last_digits: '4242', card_holder_name: 'PRUEBA LIBERA', installments: 1, statement_descriptor: '7AMENES' },
  offers,
  customer: { id: 'cus_prova', name: 'Prueba Libera', phone: '+5215500000001', email },
  subscription: null,
  tracking: { src: null, ref: null, sck: null, vtid: null, utm_content: `${marca}|1`, utm_campaign: 'prova', utm_term: null, utm_medium: null, utm_source: 'prova' },
  ...extra,
});

async function enviar(evento, data) {
  const corpo = JSON.stringify({ event: evento, created_at: new Date().toISOString(), data });
  const assinatura = `sha256=${createHmac('sha256', SEGREDO_DE_ENSAIO).update(corpo).digest('hex')}`;
  const resposta = await fetch(TESTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KashPay-Event': evento, 'X-KashPay-Signature': assinatura },
    body: corpo,
  });
  let json = null;
  try { json = await resposta.json(); } catch { /* segue */ }
  return { status: resposta.status, json };
}

console.log(`Prova no TESTE (${TESTE}), marca ${marca}`);

const principal = pedido(`${marca}-1`, [oferta('d-prova-1', '7 Amenes de la Madrugada D', 3700)]);
let r = await enviar('order.paid', principal);
confere('1. principal D: 200, gravado e liberado', r.status === 200 && r.json?.gravado === true && r.json?.liberado === true, JSON.stringify(r));

r = await enviar('order.paid', principal);
confere('2. o mesmo aviso de novo: duplicado, sem erro', r.status === 200 && r.json?.duplicated === true, JSON.stringify(r));

r = await enviar('order.paid', pedido(`${marca}-2`, [oferta('d-prova-2', 'Cántico Angelical D', 2700)]));
confere('3. Cántico D (upsell): 200 e liberado', r.status === 200 && r.json?.liberado === true, JSON.stringify(r));

r = await enviar('order.paid', pedido(`${marca}-3`, [oferta('d-prova-3', 'Oraciones a los Santos Arcángeles D', 2700)]));
confere('4. Arcángeles D (upsell): 200 e liberado', r.status === 200 && r.json?.liberado === true, JSON.stringify(r));

r = await enviar('order.refunded', { ...principal, status: 'refunded', refunded_at: new Date().toISOString() });
confere('5. reembolso: 200, gravado, nada liberado', r.status === 200 && r.json?.liberado === false, JSON.stringify(r));

r = await enviar('order.paid', pedido(`${marca}-4`, [oferta('d-prova-4', '7 Amenes de la Madrugada D', 3700)], { customer: { id: 'cus_x', name: 'Sin Correo', phone: '+5215500000002' } }));
confere('6. pedido sem e-mail: 200, gravado, NÃO liberado', r.status === 200 && r.json?.gravado === true && r.json?.liberado === false, JSON.stringify(r));

console.log(`\n${ok} ok, ${falha} falharam.`);
console.log(`
-- CONFERIR no banco de TESTE:
select c.email, c.name, a.status, a.source, a.expires_at::date, a.kashpay_transaction_id
  from public.latam_customers c join public.latam_access a on a.customer_id = c.id and a.product = 'app'
 where c.email = '${email}';
select transaction_id, event, produtos, customer_id is not null as tem_cliente, status, detail
  from public.latam_kashpay_events where transaction_id like '${marca}%' order by received_at;
select origem, pedido, produtos from public.latam_pedidos_pagos where email = '${email}';
select public.latam_extras((select id from public.latam_customers where email = '${email}'));
select products, payments, unknown_payments from public.latam_admin_customers() where email = '${email}';

-- LIMPAR depois:
delete from public.latam_kashpay_events where transaction_id like '${marca}%';
delete from public.latam_customers where email = '${email}';
`);
process.exit(falha ? 1 : 0);
