// Prova da latam-digistore publicada no projeto de TESTE (wyiqwsgfictcfkytldnu).
// Manda avisos assinados com a senha de ensaio (que só vale no banco de teste),
// do mesmo jeito que a Digistore24 manda: formulário, sha_sign SHA-512.
// Depois, conferir no banco e apagar a cliente de mentira (o SQL sai no fim).
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/latam/testes/prova-digistore-no-teste.mjs

import { createHash } from 'node:crypto';

const URL_TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/latam-digistore';
const SENHA_DE_ENSAIO = 'ds24_ensaio_somente_no_banco_de_teste_latam';
const EMAIL = 'prova-digistore-ipn@teste.invalid';

function assinar(campos, senha) {
  const chaves = Object.keys(campos).filter(k => campos[k] !== '').sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return createHash('sha512').update(chaves.map(k => `${k}=${campos[k]}${senha}`).join('')).digest('hex').toUpperCase();
}
async function enviar(campos, senha = SENHA_DE_ENSAIO) {
  const corpo = new URLSearchParams({ ...campos, sha_sign: assinar(campos, senha) }).toString();
  const r = await fetch(URL_TESTE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo });
  return { status: r.status, texto: await r.text() };
}
const venda = extra => ({
  event: 'on_payment', api_mode: 'test', ipn_version: '1.6', order_id: 'PROVA1', transaction_id: 'prova-t1',
  product_id: '742832', product_name: 'Oraciones a los Santos Arcángeles', amount_brutto: '27.00', currency: 'USD',
  pay_method: 'test', country: 'MX', email: EMAIL, address_first_name: 'Prova', address_last_name: 'Digistore',
  utm_source: 'app-es', utm_medium: 'popup', utm_campaign: 'prova', ...extra,
});

const passos = [
  ['teste de conexão', { event: 'connection_test', ipn_version: '1.6' }, 'OK'],
  ['Arcángeles (libera app + extra)', venda(), 'OK'],
  ['o mesmo aviso de novo', venda(), 'OK'],
  ['Cántico', venda({ transaction_id: 'prova-t2', product_id: '742816', product_name: 'Cántico Angelical' }), 'OK'],
  ['reembolso (só registra)', venda({ event: 'on_refund', transaction_id: 'prova-t3', amount_brutto: '-27.00' }), 'OK'],
];
for (const [nome, campos, esperado] of passos) {
  const r = await enviar(campos);
  console.log(`${r.status === 200 && r.texto === esperado ? 'ok   ' : 'FALHA'} ${nome}: ${r.status} ${r.texto}`);
}
const errada = await enviar(venda({ transaction_id: 'prova-t9' }), 'senha-errada');
console.log(`${errada.status === 401 ? 'ok   ' : 'FALHA'} senha errada recusada: ${errada.status}`);

console.log(`
Conferir no banco de TESTE:
  select a.product, a.status, a.source, a.expires_at from public.latam_access a
    join public.latam_customers c on c.id = a.customer_id where c.email = '${EMAIL}' order by a.product;
  select event, transaction_id, produto, status, utm_source, detail from public.latam_digistore_events
    where order_id = 'PROVA1' order by received_at;
Apagar depois:
  delete from public.latam_digistore_events where order_id = 'PROVA1';
  delete from public.latam_customers where email = '${EMAIL}';`);
