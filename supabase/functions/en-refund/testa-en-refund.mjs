// Teste local da en-refund (o reembolso em um toque do app em inglês): não
// toca em banco nenhum nem em serviço de pagamento.
//
// O banco é o de mentira do app em inglês (supabase/en/testes/banco-falso.mjs).
// A função en_reembolso_compras do banco é imitada aqui com a mesma regra do
// SQL (11-reembolso.sql), lendo a visão en_pedidos_pagos (02-compras.sql). O
// que se confere é o caminho na função: as compras, o pedido, o motivo, as
// recusas em inglês, que a visão nunca é gravada, que nada de pagamento é
// chamado e que nenhuma tabela do Brasil nem da LATAM é tocada.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/en-refund/testa-en-refund.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  banco, tocadas, forcarFalha, carregarFuncao, confere, cenario, fechar, rpcsDoTeste, tentativasDeGravarVisao,
} from '../../en/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const funcao = await carregarFuncao(alvo, { SUPABASE_URL: 'https://lbaudlocfbjunnaoyrtz.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa' });

// Qualquer chamada para fora do banco (um checkout, por exemplo) é anotada.
const fetchDoBanco = globalThis.fetch;
const deFora = [];
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).includes('.supabase.co/rest/v1/')) { deFora.push(String(url)); return new Response('{}', { status: 500 }); }
  return fetchDoBanco(url, init);
};

// en_reembolso_compras, como no SQL.
const NOMES = { principal: '7 Amens Before Dawn', arcangeles: 'The Four Archangels', cantico: 'Angelic Canticle' };
rpcsDoTeste['rpc/en_reembolso_compras'] = ({ p_email: email }) => {
  const ids = banco.en_customers.filter(c => c.email === email).map(c => c.id);
  return banco.en_pedidos_pagos
    .filter(p => p.pedido && (String(p.email || '').toLowerCase() === email || ids.includes(p.customer_id)))
    .map(p => ({
      pedido: p.pedido, origem: p.origem || '', produto: (p.produtos || [])[0] || '',
      nombre: NOMES[(p.produtos || [])[0]] || (p.nome_produto || '').trim() || 'Your purchase',
      valor_cents: p.valor_cents || 0, moneda: (p.moneda || 'USD').toUpperCase(), pagado_en: p.pagado_en, devuelto: Boolean(p.devuelto),
      pedido_abierto: banco.en_refund_requests.some(q => q.status === 'pendente' && (q.itens || []).some(i => i.pedido === p.pedido)),
    }))
    .sort((a, b) => Date.parse(b.pagado_en) - Date.parse(a.pagado_en))
    .slice(0, 20);
};
let freioAberto = true;
rpcsDoTeste['rpc/en_permite'] = () => freioAberto;

const compra = (campos = {}) => banco.en_pedidos_pagos.push({
  pedido: 'pay_A1b2C3d4', origem: 'checkout', customer_id: null, email: 'mary@gmail.com', produtos: ['principal'], nome_produto: null,
  valor_cents: 2921, moneda: 'USD', pagado_en: '2026-11-10T12:00:00.000Z', devuelto: false, ...campos,
});

async function chamar(action, corpo = {}, { origin = 'https://setemadrugadas.com.br', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': '200.1.2.3', 'cf-ipcountry': 'US' };
  if (origin) headers.origin = origin;
  const resposta = await funcao(new Request('https://exemplo/en-refund', {
    method, headers, body: method === 'POST' ? JSON.stringify({ action, ...corpo }) : undefined,
  }));
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}
const emIngles = texto => typeof texto === 'string' && texto.length > 0 && !/[áéíóúñ¿¡]/i.test(texto)
  && !/\b(correo|compra|devolvamos|Solicitud|pudimos|intentos)\b/i.test(texto);

console.log(`Testando: ${alvo}`);

await cenario('1. Quem pode chamar (CORS)', async () => {
  confere('o site: 204', (await chamar('', {}, { method: 'OPTIONS' })).status === 204);
  confere('o teste local: 204', (await chamar('', {}, { method: 'OPTIONS', origin: 'http://localhost:3000' })).status === 204);
  const estranho = await chamar('compras', { email: 'mary@gmail.com' }, { origin: 'https://golpe.example' });
  confere('site estranho: 403, em inglês', estranho.status === 403 && estranho.corpo.error === 'Origin not allowed.');
});

await cenario('2. Sem compra (como hoje, com a visão vazia): lista vazia e pedido "sin_compra"', async () => {
  const lista = await chamar('compras', { email: 'mary@gmial.con' });
  confere('200, sem compras (sem compra achada, fica o e-mail como ela digitou)', lista.status === 200 && lista.corpo.compras.length === 0 && lista.corpo.email === 'mary@gmial.con', JSON.stringify(lista.corpo));
  const pede = await chamar('pedir', { email: 'mary@gmail.com', sin_compra: true });
  confere('pedir mesmo assim: grava o pedido sem compra', pede.status === 200 && pede.corpo.sin_compra === true
    && banco.en_refund_requests.length === 1 && banco.en_refund_requests[0].sin_compra === true && banco.en_refund_requests[0].pais === 'US');
});

await cenario('3. Com compras: a lista em inglês, o pedido e o motivo', async () => {
  banco.en_customers.push({ id: 'c1', email: 'mary@gmail.com', name: 'Mary' });
  compra();
  compra({ pedido: 'pay_Z9y8X7w6', produtos: ['arcangeles'], valor_cents: 2700, pagado_en: '2026-11-11T12:00:00.000Z' });
  compra({ pedido: 'pay_Old00001', produtos: [], nome_produto: 'Bonus Book', devuelto: true, pagado_en: '2026-11-01T12:00:00.000Z' });
  compra({ pedido: 'pay_Achada01', email: 'outro@gmail.com', customer_id: 'c1', produtos: ['cantico'], pagado_en: '2026-11-09T12:00:00.000Z' });
  const lista = await chamar('compras', { email: 'MARY@gmail.com ' });
  const nomes = lista.corpo.compras.map(c => c.nombre).join(' | ');
  confere('as 4 compras dela (também a achada pela cliente), da mais nova para a mais velha', lista.corpo.compras.map(c => c.pedido).join(',') === 'pay_Z9y8X7w6,pay_A1b2C3d4,pay_Achada01,pay_Old00001', nomes);
  confere('os nomes que ela lê, em inglês', nomes === 'The Four Archangels | 7 Amens Before Dawn | Angelic Canticle | Bonus Book', nomes);
  const errado = await chamar('compras', { email: 'mary@gmial.con' });
  confere('e-mail com erro comum (gmial.con): acha as compras pelo corrigido e avisa a tela', errado.corpo.compras.length === 4 && errado.corpo.corrigido === 'mary@gmail.com', JSON.stringify(errado.corpo).slice(0, 200));
  confere('a tela recebe só os campos de sempre', Object.keys(lista.corpo.compras[0]).sort().join(',') === 'devuelto,fecha,moneda,nombre,pedido,pedido_abierto,valor_cents');
  const nada = await chamar('pedir', { email: 'mary@gmail.com', pedidos: [] });
  confere('pedir sem marcar nada: 400, em inglês', nada.status === 400 && emIngles(nada.corpo.error) && nada.corpo.error.includes('refund'), nada.corpo?.error);
  const devolvida = await chamar('pedir', { email: 'mary@gmail.com', pedidos: ['pay_Old00001'] });
  confere('pedir uma já devolvida: 400', devolvida.status === 400);
  const pede = await chamar('pedir', { email: 'mary@gmail.com', pedidos: ['pay_Z9y8X7w6', 'pay_A1b2C3d4', 'pay_de_outra_pessoa'] });
  const pedido = banco.en_refund_requests[0];
  confere('pedido gravado: as 2 dela, com o total cobrado', pede.status === 200 && pede.corpo.total_cents === 5621 && pedido?.itens.length === 2
    && pedido.total_cents === 5621 && pedido.customer_id === 'c1', JSON.stringify(pede.corpo));
  confere('o id que não é dela é ignorado', !JSON.stringify(pedido.itens).includes('pay_de_outra_pessoa'));
  const repete = await chamar('pedir', { email: 'mary@gmail.com', pedidos: ['pay_Z9y8X7w6'] });
  confere('tocou duas vezes: não duplica', repete.status === 200 && repete.corpo.ya_pedido === true && banco.en_refund_requests.length === 1);
  const motivo = await chamar('motivo', { id: pedido.id, motivo: 'no_reconozco' });
  confere('o motivo (código do espanhol, que a página manda): gravado', motivo.status === 200 && pedido.motivo === 'no_reconozco');
  const inventado = await chamar('motivo', { id: pedido.id, motivo: 'scam' });
  confere('motivo inventado: 400 "Invalid request."', inventado.status === 400 && inventado.corpo.error === 'Invalid request.');
});

await cenario('4. Recusas e falhas, em inglês', async () => {
  const ruim = await chamar('compras', { email: 'mary@' });
  confere('e-mail incompleto: 400, em inglês', ruim.status === 400 && emIngles(ruim.corpo.error) && ruim.corpo.error.includes('email'), ruim.corpo?.error);
  freioAberto = false;
  const freio = await chamar('compras', { email: 'mary@gmail.com' });
  confere('muitas tentativas: 429, em inglês', freio.status === 429 && emIngles(freio.corpo.error) && freio.corpo.error.includes('attempts'), freio.corpo?.error);
  freioAberto = true;
  forcarFalha({ quando: ({ tabela }) => tabela === 'rpc/en_reembolso_compras', status: 500 });
  const caiu = await chamar('compras', { email: 'mary@gmail.com' });
  confere('banco fora: 503, em inglês', caiu.status === 503 && emIngles(caiu.corpo.error) && caiu.corpo.error.includes('could not connect'), caiu.corpo?.error);
  confere('ação desconhecida: 400 "Invalid request."', (await chamar('devolver_ja', {})).corpo?.error === 'Invalid request.');
});

await cenario('5. Só objetos en_, nenhum pagamento, a visão nunca gravada', async () => {
  compra();
  await chamar('compras', { email: 'mary@gmail.com' });
  await chamar('pedir', { email: 'mary@gmail.com', pedidos: ['pay_A1b2C3d4'] });
  await chamar('pedir', { email: 'nobody@gmail.com', sin_compra: true });
  const fora = [...tocadas].filter(t => !t.startsWith('en_') && !t.startsWith('rpc/en_'));
  confere('só objetos en_', fora.length === 0, fora.join(', '));
  confere('nada latam_ nem de pagamento', ![...tocadas].some(t => /latam|whop|kashpay|digistore/.test(t)), [...tocadas].join(', '));
  confere('nenhuma chamada para fora do banco (nenhum checkout)', deFora.length === 0, deFora.join(', '));
  confere('a visão das compras nunca é gravada', tentativasDeGravarVisao.length === 0, tentativasDeGravarVisao.join(', '));
});

fechar();
