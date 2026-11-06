// Prova de ponta a ponta no projeto de TESTE do Supabase (wyiqwsgfictcfkytldnu).
// Nunca aponta para a produção: o endereço está fixo aqui embaixo.
//
// Manda uma venda assinada com o segredo de ensaio para a latam-whop, entra
// pela latam-api com o e-mail dessa venda, confere a sessão, marca o "Ya
// recé", tenta abrir um dia fechado e sai. São 11 chamadas, uma de cada vez.
// A cliente de prova usa um e-mail @exemplo.com, apagado depois pelo SQL do
// fim deste arquivo.
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/latam/testes/prova-no-teste.mjs

import { createHmac } from 'node:crypto';

const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1';
const SEGREDO_DE_ENSAIO = 'ws_ensaio_somente_no_banco_de_teste_latam';
const email = `prova.latam.${Date.now()}@exemplo.com`;
let ok = 0;
let falha = 0;
const confere = (descricao, condicao, detalhe = '') => {
  if (condicao) { ok += 1; console.log(`  ok    ${descricao}`); }
  else { falha += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
};

async function whop(payload, { id = `msg_prova_${Date.now()}`, segredo = SEGREDO_DE_ENSAIO } = {}) {
  const corpo = JSON.stringify(payload);
  const segundos = Math.floor(Date.now() / 1000);
  const assinatura = createHmac('sha256', Buffer.from(segredo, 'utf8')).update(`${id}.${segundos}.${corpo}`).digest('base64');
  const resposta = await fetch(`${TESTE}/latam-whop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(segundos), 'webhook-signature': `v1,${assinatura}` },
    body: corpo,
  });
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}

async function api(action, corpo = {}, token) {
  const headers = { 'Content-Type': 'application/json', origin: 'http://localhost:3000' };
  if (token) headers['x-latam-session'] = token;
  const resposta = await fetch(`${TESTE}/latam-api`, { method: 'POST', headers, body: JSON.stringify({ action, ...corpo }) });
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}

const venda = {
  id: 'evt_prova', type: 'payment.succeeded', api_version: 'v1',
  data: {
    id: `pay_prova_${Date.now()}`, status: 'paid', account_id: 'biz_aTBX1NJKGf65tH', product_id: null,
    line_items: [{ product_id: null, variant_id: 'plan_prova' }],
    customer_email: email, billing_address: { name: 'Prueba Latam', country: 'CO' },
    total: { currency: 'usd', amount: '27.00' }, paid_at: new Date().toISOString(),
  },
};

console.log(`Prova no TESTE com ${email}\n`);
const idVenda = `msg_prova_${Date.now()}`;
const vendeu = await whop(venda, { id: idVenda });
confere('venda assinada: 200', vendeu.status === 200, JSON.stringify(vendeu.corpo));
const repetiu = await whop(venda, { id: idVenda });
confere('mesmo aviso de novo: avisa repetido', repetiu.corpo?.duplicated === true, JSON.stringify(repetiu.corpo));
const falsa = await whop(venda, { segredo: 'ws_segredo_errado' });
confere('assinatura errada: 401', falsa.status === 401);

const login = await api('login', { email: email.toUpperCase(), tz: 'America/Bogota' });
confere('login com o e-mail da venda: 200', login.status === 200, JSON.stringify(login.corpo));
confere('primeiro dia: abierto 1, no fuso dela', login.corpo?.abierto === 1 && login.corpo?.zona === 'America/Bogota');
confere('acesso de 12 meses', /\/\d{4}$/.test(login.corpo?.acceso_hasta || ''), login.corpo?.acceso_hasta);
const token = login.corpo?.token;
const sessao = await api('session', { tz: 'Asia/Tokyo' }, token);
confere('sessão: 200, e o fuso gravado não muda', sessao.status === 200 && sessao.corpo?.zona === 'America/Bogota');
const rezou = await api('progress', { day: 1, done: true }, token);
confere('"Ya recé" no Primer Amén', rezou.status === 200 && rezou.corpo?.completados?.join() === '1', JSON.stringify(rezou.corpo));
const fechado = await api('progress', { day: 4, done: true }, token);
confere('dia fechado: 409', fechado.status === 409);
const saiu = await api('logout', {}, token);
confere('sair: 200', saiu.status === 200);
confere('depois de sair, a sessão não abre', (await api('session', {}, token)).status === 401);

console.log(`\n${ok} conferências ok, ${falha} falharam.`);
console.log(`\nPara limpar (SQL no banco de TESTE):\n  delete from public.latam_whop_events where customer_email = '${email}' or webhook_id like 'msg_prova_%';\n  delete from public.latam_customers where email = '${email}';`);
process.exit(falha ? 1 : 0);
