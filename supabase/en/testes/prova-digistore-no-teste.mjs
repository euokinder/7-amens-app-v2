// Prova da en-digistore publicada no projeto de TESTE (wyiqwsgfictcfkytldnu),
// de ponta a ponta: o aviso da Digistore libera, a cliente entra no app
// (en-api), o extra aparece, a repetição não duplica, o reembolso só registra
// (e a compra aparece como devolvida na lista do reembolso, en-refund).
// Manda avisos assinados com a senha de ensaio (que só vale no banco de
// teste), do mesmo jeito que a Digistore24 manda: formulário, sha_sign SHA-512.
// NUNCA aponta para a produção: o endereço está fixo e o script recusa outro.
// Depois, conferir no banco e apagar as clientes de mentira (o SQL sai no fim).
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/en/testes/prova-digistore-no-teste.mjs
// São 16 chamadas, uma depois da outra.

import { createHash } from 'node:crypto';

const BASE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1';
if (!BASE.includes('wyiqwsgfictcfkytldnu')) throw new Error('Só o banco de TESTE.');
const ORIGIN = 'http://localhost:3500';
const SENHA_DE_ENSAIO = 'ds24_ensaio_somente_no_banco_de_teste_en';
const EMAIL = 'prova.digistore.en@exemplo.com';
const OUTRA = 'prova.digistore.en.outra@exemplo.com';
const PEDIDO = 'PROVAEN1';

let falhas = 0;
const confere = (nome, ok, extra = '') => {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}${extra ? ` | ${extra}` : ''}`);
};

function assinar(campos, senha) {
  const chaves = Object.keys(campos).filter(k => campos[k] !== '').sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return createHash('sha512').update(chaves.map(k => `${k}=${campos[k]}${senha}`).join('')).digest('hex').toUpperCase();
}
async function aviso(campos, senha = SENHA_DE_ENSAIO) {
  const corpo = new URLSearchParams({ ...campos, sha_sign: assinar(campos, senha) }).toString();
  const r = await fetch(`${BASE}/en-digistore`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo });
  return { status: r.status, texto: await r.text() };
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

const venda = extra => ({
  event: 'on_payment', api_mode: 'test', ipn_version: '1.6', order_id: PEDIDO, transaction_id: 'prova-en-t1',
  product_id: '741394', product_name: 'The 7 Amens of the Early Morning', amount_brutto: '37.00', currency: 'USD',
  pay_method: 'test', country: 'US', email: EMAIL, address_first_name: 'Prova', address_last_name: 'Digistore',
  utm_source: 'app-en', utm_medium: 'popup', utm_campaign: 'prova', ...extra,
});
const arcanjos = extra => venda({ transaction_id: 'prova-en-t2', product_id: '741399', product_name: 'Protection of the Four Archangels', amount_brutto: '27.00', ...extra });

// 1. O "Test connection" da Digistore.
const t = await aviso({ event: 'connection_test', ipn_version: '1.6' });
confere('teste de conexão', t.status === 200 && t.texto === 'OK', `${t.status} ${t.texto}`);

// 2. A compra do app (front).
const v1 = await aviso(venda());
confere('venda do front: OK', v1.status === 200 && v1.texto === 'OK', `${v1.status} ${v1.texto}`);

// 3. Ela entra no app com o e-mail da compra.
const l1 = await api({ action: 'login', email: EMAIL });
const token = l1.json?.token;
confere('entra no app com o e-mail da compra', l1.status === 200 && /^[a-f0-9]{64}$/.test(token || ''), `status ${l1.status} "${l1.json?.error || ''}"`);
confere('nome vindo da compra e sem extras', l1.json?.cliente?.nombre === 'Prova' && JSON.stringify(l1.json?.extras) === '[]',
  `nombre ${l1.json?.cliente?.nombre}, extras ${JSON.stringify(l1.json?.extras)}`);
confere('acesso por 12 meses', /\b2027\b/.test(l1.json?.acceso_hasta || ''), l1.json?.acceso_hasta);

// 4. Os Arcanjos (upsell no mesmo pedido, outra transação), duas vezes.
const v2 = await aviso(arcanjos());
const v3 = await aviso(arcanjos());
confere('Arcanjos e a repetição: OK', v2.texto === 'OK' && v3.texto === 'OK', `${v2.status} / ${v3.status}`);

// 5. Na verificação seguinte do app, os Arcanjos aparecem.
const s1 = await api({ action: 'session' }, token);
confere('Arcanjos liberados na sessão', s1.status === 200 && JSON.stringify(s1.json?.extras) === '["arcangeles"]', `extras ${JSON.stringify(s1.json?.extras)}`);

// 6. A lista do reembolso (en-refund) enxerga as duas compras.
const c1 = await chamar('en-refund', { action: 'compras', email: EMAIL });
const compras = c1.json?.compras || [];
// (A tela recebe o nome em inglês, "nombre", e não a chave do produto.)
const FRONT = '7 Amens Before Dawn';
const ARCANJOS = 'The Four Archangels';
confere('reembolso: duas compras, pela visão', c1.status === 200 && compras.length === 2
  && compras.some(c => c.nombre === FRONT && c.valor_cents === 3700) && compras.some(c => c.nombre === ARCANJOS && c.valor_cents === 2700),
  JSON.stringify(compras.map(c => [c.pedido, c.nombre, c.valor_cents, c.devuelto])));

// 7. Reembolso dos Arcanjos: só registra.
const r1 = await aviso(arcanjos({ event: 'on_refund', transaction_id: 'prova-en-t3', amount_brutto: '-27.00' }));
confere('reembolso: OK', r1.status === 200 && r1.texto === 'OK', `${r1.status} ${r1.texto}`);
const s2 = await api({ action: 'session' }, token);
confere('depois do reembolso, o app e os Arcanjos continuam', s2.status === 200 && JSON.stringify(s2.json?.extras) === '["arcangeles"]', `status ${s2.status} extras ${JSON.stringify(s2.json?.extras)}`);
const c2 = await chamar('en-refund', { action: 'compras', email: EMAIL });
const devolvida = (c2.json?.compras || []).find(c => c.nombre === ARCANJOS);
const front = (c2.json?.compras || []).find(c => c.nombre === FRONT);
confere('a compra dos Arcanjos aparece devolvida; o front não', devolvida?.devuelto === true && front?.devuelto === false,
  JSON.stringify((c2.json?.compras || []).map(c => [c.nombre, c.devuelto])));

// 8. Produto que não está na tabela: não libera ninguém.
const d1 = await aviso(venda({ transaction_id: 'prova-en-t9', order_id: 'PROVAEN2', product_id: '999999', product_name: 'Unknown offer', email: OUTRA }));
confere('produto desconhecido: OK (sem liberar)', d1.texto === 'OK', `${d1.status} ${d1.texto}`);
const l2 = await api({ action: 'login', email: OUTRA });
confere('quem comprou o desconhecido não entra', l2.status === 403, `status ${l2.status}`);

// 9. Senha errada.
const e1 = await aviso(venda({ transaction_id: 'prova-en-t8' }), 'senha-errada');
confere('senha errada recusada', e1.status === 401, `${e1.status}`);

// 10. Fecha a sessão aberta pela prova.
const out = await api({ action: 'logout' }, token);
confere('logout', out.status === 200, `${out.status}`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
console.log(`
Conferir no banco de TESTE:
  select a.product, a.status, a.source, a.expires_at from public.en_access a
    join public.en_customers c on c.id = a.customer_id where c.email = '${EMAIL}' order by a.product;
  select event, transaction_id, produtos, status, detail from public.en_digistore_events
    where order_id in ('${PEDIDO}', 'PROVAEN2') order by received_at;
Apagar depois (o customer some com as sessões, o acesso e os dias, em cascata):
  delete from public.en_digistore_events where order_id in ('${PEDIDO}', 'PROVAEN2');
  delete from public.en_customers where email in ('${EMAIL}', '${OUTRA}');`);
process.exitCode = falhas ? 1 : 0;
