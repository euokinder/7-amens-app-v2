// Prova da latam-kashpay publicada no projeto de TESTE do Supabase
// (wyiqwsgfictcfkytldnu). Nunca aponta para a produção: o endereço está fixo
// aqui embaixo.
//
// Manda avisos assinados com o segredo de ensaio, no formato da documentação
// da KashPay, com nome, e-mail e telefone de mentira (@exemplo.com). São 10
// chamadas, uma de cada vez. Depois, a conferência no banco é feita com o SQL
// que o script imprime no fim (e a limpeza também).
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/latam/testes/prova-kashpay-no-teste.mjs

import { createHmac } from 'node:crypto';

const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/latam-kashpay';
const SEGREDO_DE_ENSAIO = 'kp_ensaio_somente_no_banco_de_teste_latam';
const marca = `prova-kp-${Date.now()}`;
let ok = 0;
let falha = 0;
const confere = (descricao, condicao, detalhe = '') => {
  if (condicao) { ok += 1; console.log(`  ok    ${descricao}`); }
  else { falha += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
};

const pedido = (id, extra = {}) => ({
  id, amount: 2700, currency: 'USD', net_amount: 2430, status: 'paid', payment_method: 'card',
  created_at: new Date(Date.now() - 60_000).toISOString(), paid_at: new Date().toISOString(), refunded_at: null, chargeback_at: null,
  payment_details: { id: 'pi_prova', card_brand: 'visa', card_last_digits: '4242', card_holder_name: 'PRUEBA KASHPAY', installments: 1, statement_descriptor: '7AMENES' },
  offers: [{ id: 'offer_prova_7a', name: '7 Amenes de la Madrugada', price: 2700, type: 'main', quantity: 1, total: 2700 }],
  customer: { id: 'cus_prova', name: 'Prueba Kashpay', phone: '+5215500000000', email: `${marca}@exemplo.com` },
  subscription: null,
  tracking: { src: null, ref: null, sck: null, vtid: 'vtid_prova', utm_content: 'AC07 H2|120000000000000001::fbclidDePrueba::', utm_campaign: 'prova_kashpay', utm_term: null, utm_medium: 'prova', utm_source: 'FB' },
  ...extra,
});

async function enviar(evento, data, { segredo = SEGREDO_DE_ENSAIO, assinar = true, metodo = 'POST' } = {}) {
  const corpo = JSON.stringify({ event: evento, created_at: new Date().toISOString(), data });
  const headers = { 'Content-Type': 'application/json', 'X-KashPay-Event': evento };
  if (assinar) headers['X-KashPay-Signature'] = `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`;
  const resposta = await fetch(TESTE, { method: metodo, headers, body: metodo === 'GET' ? undefined : corpo });
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}

const pago = `${marca}-1`;
const abandonado = `${marca}-2`;
const generico = `${marca}-3`;
console.log(`Prova no TESTE com a marca ${marca}\n`);

const r1 = await enviar('order.paid', pedido(pago));
confere('venda paga: 200 e gravada', r1.status === 200 && r1.corpo?.gravado === true, JSON.stringify(r1));
const r2 = await enviar('order.paid', pedido(pago));
confere('o mesmo aviso de novo (retentativa): avisa repetido', r2.status === 200 && r2.corpo?.duplicated === true, JSON.stringify(r2));
const r3 = await enviar('order.refunded', pedido(pago, { status: 'refunded', refunded_at: new Date().toISOString() }));
confere('reembolso: 200 e gravado', r3.status === 200 && r3.corpo?.gravado === true, JSON.stringify(r3));
const r4 = await enviar('order.chargeback', pedido(pago, { status: 'chargeback', chargeback_at: new Date().toISOString() }));
confere('chargeback: 200 e gravado', r4.status === 200 && r4.corpo?.gravado === true, JSON.stringify(r4));
const r5 = await enviar('order.abandoned', pedido(abandonado, { status: 'abandoned', paid_at: null }));
confere('abandonado: 200 e gravado', r5.status === 200 && r5.corpo?.gravado === true, JSON.stringify(r5));
const r6 = await enviar('order.paid', pedido(`${marca}-4`, { offers: [{ id: 'offer_prova_dcc', name: 'Divine Cross Codes', type: 'main', total: 3700 }] }));
confere('outra operação: 200 e NÃO gravado', r6.status === 200 && r6.corpo?.gravado === false, JSON.stringify(r6));
const r7 = await enviar('order.paid', pedido(generico, { amount: 1900, offers: [{ id: 'offer_prova_19', name: '19 usd', type: 'main', total: 1900 }] }));
confere('"19 usd" sem id confirmado: gravado como needs_review', r7.status === 200 && r7.corpo?.status === 'needs_review', JSON.stringify(r7));
const r8 = await enviar('order.paid', pedido(`${marca}-5`), { segredo: 'segredo_errado' });
confere('assinatura errada: 401', r8.status === 401, JSON.stringify(r8));
const r9 = await enviar('order.paid', pedido(`${marca}-6`), { assinar: false });
confere('sem assinatura: 401', r9.status === 401, JSON.stringify(r9));
const r10 = await enviar('order.paid', pedido(`${marca}-7`), { metodo: 'GET' });
confere('GET: 405', r10.status === 405, JSON.stringify(r10));

console.log(`\n${ok} conferências ok, ${falha} falharam.`);
console.log(`\nConferir no banco de TESTE (tem de voltar 5 linhas: 4 recorded e 1 needs_review, e zero achados de pessoa):
  select event, transaction_id, status, amount_cents, produtos, utm_content, detail from public.latam_kashpay_events where transaction_id like '${marca}%' order by received_at;
  select count(*) as achados_de_pessoa from public.latam_kashpay_events e where e.transaction_id like '${marca}%'
     and (to_jsonb(e)::text ilike '%exemplo.com%' or to_jsonb(e)::text ilike '%Prueba Kashpay%' or to_jsonb(e)::text like '%5215500000000%' or to_jsonb(e)::text ilike '%PRUEBA KASHPAY%' or to_jsonb(e)::text like '%4242%' or to_jsonb(e)::text like '%fbclid%');
Para limpar:
  delete from public.latam_kashpay_events where transaction_id like '${marca}%';`);
process.exit(falha ? 1 : 0);
