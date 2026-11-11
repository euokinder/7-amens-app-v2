// Teste local da latam-kashpay: não toca em banco nenhum.
//
// Sobe a função num banco de mentira e manda avisos assinados no formato da
// documentação da KashPay (https://app.kashpay.com.br/docs/webhooks, lida em
// 06/11/2026), com nome, e-mail, telefone e nome no cartão de mentira, para
// provar que nada disso é gravado.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/latam-kashpay/testa-latam-kashpay.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, limparFalhas, carregarFuncao, confere, cenario, fechar,
} from '../../latam/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const SEGREDO = 'kp_live_0123456789abcdef0123456789abcdef';
const SEGREDO_DE_ENSAIO = 'kp_ensaio_somente_no_banco_de_teste_latam';
const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co';
const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co';
const env = (base, segredo) => ({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa', LATAM_KASHPAY_SECRET: segredo });

const naProducao = await carregarFuncao(alvo, env(PRODUCAO, SEGREDO));
const producaoSemSegredo = await carregarFuncao(alvo, env(PRODUCAO, ''));
const noTesteSemSegredo = await carregarFuncao(alvo, env(TESTE, ''));

// Os dados de pessoa do aviso (de mentira). Nenhum deles pode aparecer no banco.
const PESSOA = ['Maria Lopez Prueba', 'maria.prueba@exemplo.com', '+5215512345678', 'MARIA L PRUEBA', 'cus_PESSOA123', 'pi_3PagamentoX', '4242'];

const assinar = (corpo, chave = SEGREDO) => `sha256=${createHmac('sha256', chave).update(corpo).digest('hex')}`;

const OFERTA_PRINCIPAL = { id: 'offer_7a1', name: '7 Amenes de la Madrugada', price: 2700, price_formatted: '$27.00', type: 'main', quantity: 1, total: 2700, total_formatted: '$27.00' };
const pedido = (extra = {}) => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  amount: 2700,
  currency: 'USD',
  net_amount: 2430,
  status: 'paid',
  payment_method: 'card',
  created_at: '2026-11-06T19:59:00Z',
  paid_at: '2026-11-06T20:00:00Z',
  refunded_at: null,
  chargeback_at: null,
  payment_details: {
    id: 'pi_3PagamentoX', card_brand: 'visa', card_last_digits: '4242', card_holder_name: 'MARIA L PRUEBA',
    installments: 1, statement_descriptor: '7AMENES', qr_code: null, qr_code_url: null, barcode: null, bank_slip_url: null,
  },
  offers: [OFERTA_PRINCIPAL],
  customer: { id: 'cus_PESSOA123', name: 'Maria Lopez Prueba', phone: '+5215512345678', email: 'maria.prueba@exemplo.com' },
  subscription: null,
  tracking: {
    src: null, ref: null, sck: 'abc', vtid: 'vtid_abc123',
    utm_content: 'AC07 H2|120249941143260497::IwAR0fbclidDeMentira::',
    utm_campaign: '[ESP] 7 Amenes|1202', utm_term: 'Instagram_Reels|1203', utm_medium: 'Conjunto 01|1204', utm_source: 'FB',
  },
  ...extra,
});
const aviso = (evento, data) => ({ event: evento, created_at: '2026-11-06T20:00:01Z', data });

function enviar(payload, { manipulador = naProducao, assinatura, chave, metodo = 'POST' } = {}) {
  const corpo = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json', 'X-KashPay-Event': typeof payload === 'object' ? payload.event || '' : '' };
  const valor = assinatura === undefined ? assinar(corpo, chave) : assinatura;
  if (valor !== null) headers['X-KashPay-Signature'] = valor;
  return manipulador(new Request('https://exemplo/latam-kashpay', { method: metodo, headers, body: metodo === 'GET' ? undefined : corpo }));
}
const eventos = () => banco.latam_kashpay_events;
const linha = (evento = 'order.paid') => eventos().find(e => e.event === evento) || {};
const semPessoa = linhas => {
  const tudo = JSON.stringify(linhas);
  return PESSOA.filter(valor => tudo.includes(valor));
};
// Guarda o que a função escreve no console, para conferir que não vaza pessoa.
// O placar do teste continua saindo na tela.
async function comConsole(corpo) {
  const ditos = [];
  const { log, error } = console;
  const guarda = original => (...args) => {
    const dito = args.join(' ');
    if (dito.startsWith('latam-kashpay')) ditos.push(dito); else original(...args);
  };
  console.log = guarda(log);
  console.error = guarda(error);
  try { await corpo(); } finally { console.log = log; console.error = error; }
  return ditos;
}

console.log(`Testando: ${alvo}`);

await cenario('1. Venda paga do 7 Amenes: grava o que o Hub precisa', async () => {
  const resposta = await enviar(aviso('order.paid', pedido()));
  const corpo = await resposta.json();
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('diz que gravou', corpo.gravado === true && corpo.status === 'recorded', JSON.stringify(corpo));
  const l = linha();
  confere('uma linha', eventos().length === 1);
  confere('evento e transação', l.event === 'order.paid' && l.transaction_id === 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  confere('status do pedido', l.order_status === 'paid');
  confere('valor e líquido em centavos', l.amount_cents === 2700 && l.net_amount_cents === 2430);
  confere('moeda e meio de pagamento', l.currency === 'USD' && l.payment_method === 'card');
  confere('produto principal', JSON.stringify(l.produtos) === '["principal"]', JSON.stringify(l.produtos));
  confere('oferta com id, nome, tipo, quantidade e total', JSON.stringify(l.offers) === JSON.stringify([{ id: 'offer_7a1', name: '7 Amenes de la Madrugada', type: 'main', quantity: 1, total: 2700, produto: 'principal' }]), JSON.stringify(l.offers));
  confere('datas', l.paid_at === '2026-11-06T20:00:00.000Z' && l.order_created_at === '2026-11-06T19:59:00.000Z' && l.event_created_at === '2026-11-06T20:00:01.000Z' && l.refunded_at === null);
  confere('utm_content sem o fbclid', l.utm_content === 'AC07 H2|120249941143260497', l.utm_content);
  confere('os outros campos de tracking', l.utm_source === 'FB' && l.utm_medium === 'Conjunto 01|1204' && l.utm_campaign === '[ESP] 7 Amenes|1202' && l.utm_term === 'Instagram_Reels|1203' && l.sck === 'abc' && l.vtid === 'vtid_abc123' && l.src === null && l.ref === null);
  confere('nenhum dado de pessoa gravado (nome, e-mail, telefone, cartão)', semPessoa(eventos()).length === 0, semPessoa(eventos()).join(', '));
  confere('nenhuma coluna de pessoa nem o corpo cru', !('customer' in l) && !('payload' in l) && !('payment_details' in l));
  confere('nome bastou: o mapa de ofertas nem foi lido', !tocadas.has('latam_kashpay_offers'));
});

await cenario('2. Retentativa da KashPay (o mesmo aviso 3 vezes) não duplica', async () => {
  const corpo = aviso('order.paid', pedido());
  await enviar(corpo);
  const segunda = await (await enviar(corpo)).json();
  const terceira = await enviar(corpo);
  confere('a repetição responde 200 e avisa', terceira.status === 200 && segunda.duplicated === true);
  confere('continua uma linha', eventos().length === 1);
});

await cenario('3. Reembolso e chargeback: uma linha cada, mesmo pedido', async () => {
  await enviar(aviso('order.paid', pedido()));
  await enviar(aviso('order.refunded', pedido({ status: 'refunded', refunded_at: '2026-11-08T10:00:00Z' })));
  await enviar(aviso('order.chargeback', pedido({ status: 'chargeback', chargeback_at: '2026-11-20T10:00:00Z' })));
  confere('três linhas, a mesma transação', eventos().length === 3 && new Set(eventos().map(e => e.transaction_id)).size === 1);
  confere('reembolso com a data', linha('order.refunded').order_status === 'refunded' && linha('order.refunded').refunded_at === '2026-11-08T10:00:00.000Z');
  confere('chargeback com a data', linha('order.chargeback').chargeback_at === '2026-11-20T10:00:00.000Z');
  confere('o anúncio vem junto', linha('order.refunded').utm_content === 'AC07 H2|120249941143260497');
});

await cenario('4. Pedido abandonado e recusado também ficam (sem data de pagamento)', async () => {
  await enviar(aviso('order.abandoned', pedido({ id: 'ab-1', status: 'abandoned', paid_at: null })));
  await enviar(aviso('order.failed', pedido({ id: 'ab-2', status: 'failed', paid_at: null })));
  confere('duas linhas recorded', eventos().length === 2 && eventos().every(e => e.status === 'recorded'));
  confere('abandonado sem paid_at', linha('order.abandoned').paid_at === null && linha('order.abandoned').order_status === 'abandoned');
});

await cenario('5. Pedido de OUTRA operação da conta: 200 e nada gravado', async () => {
  const ditos = await comConsole(async () => {
    const resposta = await enviar(aviso('order.paid', pedido({ offers: [{ id: 'offer_dcc', name: 'Divine Cross Codes', type: 'main', quantity: 1, total: 3700 }] })));
    const corpo = await resposta.json();
    confere('responde 200 (a KashPay não insiste)', resposta.status === 200);
    confere('diz que não gravou', corpo.gravado === false && corpo.motivo === 'pedido de outra operação', JSON.stringify(corpo));
  });
  confere('nenhuma linha', eventos().length === 0);
  confere('o registro do console é só a contagem, sem conteúdo', ditos.length === 1 && ditos[0].includes('outra-operacao') && semPessoa(ditos).length === 0 && !ditos[0].includes('Divine'), ditos.join(' / '));
  await enviar(aviso('order.paid', pedido({ offers: [{ id: 'offer_arch', name: 'Journey with My Archangel', type: 'main', total: 1900 }] })));
  confere('"Archangel" (inglês) não confunde com Arcángeles', eventos().length === 0);
});

await cenario('6. Upsells: Arcángeles e Desatanudos', async () => {
  await enviar(aviso('order.paid', pedido({ id: 'up-1', amount: 2700, offers: [{ id: 'offer_up1', name: 'Oraciones a los Santos Arcángeles', type: 'main', total: 2700 }] })));
  await enviar(aviso('order.paid', pedido({ id: 'up-2', amount: 1700, offers: [{ id: 'offer_up2', name: 'NOVENA A LA VIRGEN DESATANUDOS', type: 'main', total: 1700 }] })));
  confere('Arcángeles reconhecido (com ou sem acento)', JSON.stringify(eventos().find(e => e.transaction_id === 'up-1')?.produtos) === '["arcangeles"]');
  confere('Desatanudos reconhecido (maiúsculas)', JSON.stringify(eventos().find(e => e.transaction_id === 'up-2')?.produtos) === '["desatanudos"]');
  await enviar(aviso('order.paid', pedido({ id: 'up-3', offers: [{ id: 'offer_up1b', name: 'UP01 - Arcángel', type: 'main', total: 2700 }] })));
  confere('"Arcángel" no singular também', JSON.stringify(eventos().find(e => e.transaction_id === 'up-3')?.produtos) === '["arcangeles"]');
  await enviar(aviso('order.paid', pedido({ id: 'up-4', offers: [{ id: 'offer_27', name: '27 USD', type: 'main', total: 2700 }] })));
  const l = eventos().find(e => e.transaction_id === 'up-4') || {};
  confere('upsell com nome de preço ("27 USD"): não se perde, fica needs_review', l.status === 'needs_review' && JSON.stringify(l.produtos) === '[]', l.status);
});

await cenario('7. Oferta "19 usd" sem id confirmado: guarda para conferir, não conta', async () => {
  const resposta = await enviar(aviso('order.paid', pedido({ id: 'gen-1', amount: 1900, offers: [{ id: 'offer_19', name: '19 usd', type: 'main', total: 1900 }] })));
  confere('responde 200', resposta.status === 200);
  const l = eventos()[0] || {};
  confere('needs_review', l.status === 'needs_review', l.status);
  confere('sem produto (o Hub não conta)', JSON.stringify(l.produtos) === '[]');
  confere('o detalhe diz qual oferta e o id', l.detail.includes('"19 usd", id offer_19'), l.detail);
  confere('o mapa foi lido', tocadas.has('latam_kashpay_offers'));
});

await cenario('8. "19 usd" com o id confirmado no mapa: conta como principal', async () => {
  banco.latam_kashpay_offers.push({ offer_id: 'offer_19', produto: 'principal', offer_name: '19 usd' });
  banco.latam_kashpay_offers.push({ offer_id: 'offer_9', produto: 'fora', offer_name: '9 usd' });
  await enviar(aviso('order.paid', pedido({ id: 'gen-2', offers: [{ id: 'offer_19', name: '19 usd', type: 'main', total: 1900 }] })));
  confere('recorded, principal', eventos()[0]?.status === 'recorded' && JSON.stringify(eventos()[0]?.produtos) === '["principal"]');
  const r = await (await enviar(aviso('order.paid', pedido({ id: 'gen-3', offers: [{ id: 'offer_9', name: '9 usd', type: 'main', total: 900 }] })))).json();
  confere('id marcado "fora": não grava', r.gravado === false && eventos().length === 1);
});

await cenario('9. Principal + oferta genérica no mesmo pedido: conta', async () => {
  await enviar(aviso('order.paid', pedido({ amount: 3600, offers: [OFERTA_PRINCIPAL, { id: 'offer_9', name: '9 usd', type: 'order_bump', total: 900 }] })));
  const l = linha();
  confere('recorded com o principal', l.status === 'recorded' && JSON.stringify(l.produtos) === '["principal"]');
  confere('a oferta genérica fica sem produto', l.offers?.[1]?.produto === null);
});

await cenario('10. Assinatura: errada, ausente, fora do formato, e sem o prefixo', async () => {
  const errada = await enviar(aviso('order.paid', pedido()), { chave: 'outro_segredo' });
  confere('assinatura errada: 401', errada.status === 401);
  const ausente = await enviar(aviso('order.paid', pedido()), { assinatura: null });
  confere('sem assinatura: 401', ausente.status === 401);
  const torta = await enviar(aviso('order.paid', pedido()), { assinatura: 'sha256=xyz' });
  confere('fora do formato: 401', torta.status === 401);
  const corpo = JSON.stringify(aviso('order.paid', pedido()));
  const adulterado = await naProducao(new Request('https://exemplo/latam-kashpay', {
    method: 'POST', headers: { 'X-KashPay-Signature': assinar(corpo) }, body: corpo.replace('2700', '1'),
  }));
  confere('corpo mexido depois de assinado: 401', adulterado.status === 401);
  confere('nada gravado nem lido', eventos().length === 0 && tocadas.size === 0);
  const maiuscula = await enviar(aviso('order.paid', pedido()), { assinatura: assinar(JSON.stringify(aviso('order.paid', pedido()))).replace('sha256=', 'SHA256=').toUpperCase().replace('SHA256=', 'sha256=') });
  confere('hexadecimal em maiúsculas: aceita', maiuscula.status === 200);
  const semPrefixo = await enviar(aviso('order.paid', pedido({ id: 'sp' })), { assinatura: assinar(JSON.stringify(aviso('order.paid', pedido({ id: 'sp' })))).replace('sha256=', '') });
  confere('só o hexadecimal, sem "sha256=": aceita (o segredo é o mesmo)', semPrefixo.status === 200);
});

await cenario('11. Produção sem o segredo recusa tudo; segredo de ensaio só no banco de TESTE', async () => {
  const semSegredo = await enviar(aviso('order.paid', pedido()), { manipulador: producaoSemSegredo });
  confere('produção sem segredo: 401', semSegredo.status === 401);
  const ensaioNaProducao = await enviar(aviso('order.paid', pedido()), { manipulador: producaoSemSegredo, chave: SEGREDO_DE_ENSAIO });
  confere('segredo de ensaio na produção: 401', ensaioNaProducao.status === 401);
  confere('nada gravado', eventos().length === 0);
  const ensaio = await enviar(aviso('order.paid', pedido()), { manipulador: noTesteSemSegredo, chave: SEGREDO_DE_ENSAIO });
  confere('segredo de ensaio no teste: 200', ensaio.status === 200);
  confere('e grava no teste', eventos().length === 1);
});

await cenario('12. Aviso num formato diferente da documentação: guarda só o formato', async () => {
  const semOfertas = pedido();
  delete semOfertas.offers;
  const resposta = await enviar(aviso('order.paid', semOfertas));
  const l = eventos()[0] || {};
  confere('200 e needs_review', resposta.status === 200 && l.status === 'needs_review', l.status);
  confere('o detalhe lista os nomes dos campos', l.detail.includes('de data:') && l.detail.includes('customer') && l.detail.includes('tracking'), l.detail);
  confere('e nenhum valor de pessoa', semPessoa(eventos()).length === 0, semPessoa(eventos()).join(', '));
  const vazio = await (await enviar(aviso('order.paid', pedido({ id: 'vazio', offers: [] })))).json();
  confere('lista de ofertas vazia: não grava', vazio.gravado === false && eventos().length === 1);
});

await cenario('13. Aviso sem data.id: chave pela impressão digital do corpo', async () => {
  const semId = pedido();
  delete semId.id;
  const corpo = aviso('order.paid', semId);
  await enviar(corpo);
  const l = eventos()[0] || {};
  confere('needs_review com chave sem-id-', l.status === 'needs_review' && /^sem-id-[0-9a-f]{32}$/.test(l.transaction_id), l.transaction_id);
  const de_novo = await (await enviar(corpo)).json();
  confere('a repetição não duplica', de_novo.duplicated === true && eventos().length === 1);
});

await cenario('14. Evento pelo cabeçalho, valor fora do formato e e-mail colado no utm', async () => {
  const semEvento = { created_at: '2026-11-06T20:00:01Z', data: pedido({ amount: '27.00', tracking: { utm_content: 'AC03|99', ref: 'maria.prueba@exemplo.com', utm_source: 'FB' } }) };
  const corpo = JSON.stringify(semEvento);
  await naProducao(new Request('https://exemplo/latam-kashpay', {
    method: 'POST', headers: { 'X-KashPay-Event': 'order.paid', 'X-KashPay-Signature': assinar(corpo) }, body: corpo,
  }));
  const l = eventos()[0] || {};
  confere('evento lido do cabeçalho', l.event === 'order.paid');
  confere('valor "27.00" não vira número adivinhado', l.amount_cents === null && l.detail.includes('fora do formato'), l.detail);
  confere('e-mail no utm sai antes de gravar', l.ref === '[e-mail]' && semPessoa(eventos()).length === 0, l.ref);
});

await cenario('15. Falha passageira do banco não perde o aviso', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_kashpay_events' && method === 'POST', status: 503, vezes: 1 });
  const resposta = await enviar(aviso('order.paid', pedido()));
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('gravou na segunda tentativa', eventos().length === 1);
});

await cenario('16. Falha que não passa: 500 (a KashPay tenta de novo), e o console não leva pessoa', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_kashpay_events' && method === 'POST', status: 400 });
  let resposta;
  const ditos = await comConsole(async () => { resposta = await enviar(aviso('order.paid', pedido())); });
  confere('responde 500', resposta.status === 500, `veio ${resposta.status}`);
  confere('o console diz o que regravar (anúncio, valor)', ditos.some(d => d.includes('EVENTO_NAO_GRAVADO') && d.includes('AC07 H2') && d.includes('2700')), ditos.join(' / '));
  confere('e nenhum dado de pessoa', semPessoa(ditos).length === 0, semPessoa(ditos).join(', '));
  limparFalhas();
  const denovo = await enviar(aviso('order.paid', pedido()));
  confere('a nova tentativa da KashPay grava', denovo.status === 200 && eventos().length === 1);
});

await cenario('17. Outros métodos e JSON quebrado', async () => {
  const get = await enviar(aviso('order.paid', pedido()), { metodo: 'GET' });
  confere('GET: 405', get.status === 405);
  const quebrado = await enviar('{"event": "order.paid", ');
  confere('JSON quebrado (assinado): 400', quebrado.status === 400);
  confere('nada gravado', eventos().length === 0);
});

await cenario('18. Só tabelas latam_ (nada do Brasil); só o pedido pago e nosso cria cliente', async () => {
  await enviar(aviso('order.paid', pedido()));
  await enviar(aviso('order.refunded', pedido({ status: 'refunded' })));
  await enviar(aviso('order.paid', pedido({ id: 'g', offers: [{ id: 'x', name: '19 usd', total: 1900 }] })));
  await enviar(aviso('order.paid', pedido({ id: 'o', offers: [{ id: 'y', name: 'Lost Prayers of Jesus', total: 1900 }] })));
  const permitidas = new Set(['latam_kashpay_events', 'latam_kashpay_offers', 'latam_customers', 'latam_access']);
  const fora = [...tocadas].filter(tabela => !permitidas.has(tabela));
  confere('só latam_kashpay_events, latam_kashpay_offers, latam_customers e latam_access', fora.length === 0, fora.join(', '));
  confere('uma cliente só (a do pedido pago do 7 Amenes)', banco.latam_customers.length === 1 && banco.latam_access.length === 1);
  confere('latam_whop_events intocada', banco.latam_whop_events.length === 0);
});

// ------------------------------------------------------------ a liberação (08/11/2026)
const cliente = () => banco.latam_customers[0] || {};
const acesso = () => banco.latam_access[0] || {};
const DIA = 86_400_000;

await cenario('19. Pedido pago do principal libera o app por 12 meses', async () => {
  const resposta = await enviar(aviso('order.paid', pedido({ customer: { id: 'cus_PESSOA123', name: 'Maria Lopez Prueba', phone: '+5215512345678', email: '  Maria.Prueba@Exemplo.com ' } })));
  const corpo = await resposta.json();
  confere('responde 200 e diz que liberou', resposta.status === 200 && corpo.liberado === true, JSON.stringify(corpo));
  confere('cliente criada com o e-mail limpo e o nome', cliente().email === 'maria.prueba@exemplo.com' && cliente().name === 'Maria Lopez Prueba', JSON.stringify(cliente()));
  const a = acesso();
  confere('acesso ativo, origem kashpay, produto app', a.status === 'active' && a.source === 'kashpay' && a.product === 'app', JSON.stringify(a));
  confere('vale 12 meses a partir do pagamento', a.expires_at === new Date(Date.parse('2026-11-06T20:00:00Z') + 365 * DIA).toISOString(), a.expires_at);
  confere('guarda o pedido que liberou', a.kashpay_transaction_id === 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  const l = linha();
  confere('o pedido ganha o customer_id (o número, não o e-mail)', l.customer_id === cliente().id);
  confere('o detalhe diz até quando', l.detail.startsWith('Gravado: principal.') && l.detail.includes('App liberado: acesso até 2027-11-06'), l.detail);
  confere('telefone e cartão não estão em lugar nenhum do banco', !JSON.stringify(banco).includes('+5215512345678') && !JSON.stringify(banco).includes('MARIA L PRUEBA') && !JSON.stringify(banco).includes('4242'));
  confere('o pedido continua sem nome nem e-mail', semPessoa(eventos()).length === 0, semPessoa(eventos()).join(', '));
});

await cenario('20. O mesmo aviso 3 vezes: uma cliente, um acesso, um pedido', async () => {
  const corpo = aviso('order.paid', pedido());
  await enviar(corpo); await enviar(corpo);
  const terceira = await (await enviar(corpo)).json();
  confere('a repetição avisa duplicado e liberado', terceira.duplicated === true && terceira.liberado === true, JSON.stringify(terceira));
  confere('uma de cada', banco.latam_customers.length === 1 && banco.latam_access.length === 1 && eventos().length === 1);
});

await cenario('21. Quem já tinha acesso mais longo (pela Whop) não perde nada', async () => {
  banco.latam_customers.push({ id: 'c-antiga', email: 'maria.prueba@exemplo.com', name: '' });
  banco.latam_access.push({ customer_id: 'c-antiga', product: 'app', status: 'active', source: 'whop', expires_at: '2028-01-01T00:00:00.000Z', whop_payment_id: 'pay_1' });
  await enviar(aviso('order.paid', pedido()));
  const a = acesso();
  confere('continua whop, até 2028', a.source === 'whop' && a.expires_at === '2028-01-01T00:00:00.000Z', JSON.stringify(a));
  confere('o detalhe diz que já tinha', linha().detail.includes('já tinha acesso até 2028-01-01'), linha().detail);
  confere('o nome em branco é preenchido; nada mais muda', cliente().name === 'Maria Lopez Prueba' && banco.latam_customers.length === 1);
  confere('o pedido aponta para ela', linha().customer_id === 'c-antiga');
});

await cenario('22. Retirada à mão que compra de novo volta a ter acesso', async () => {
  banco.latam_customers.push({ id: 'c-ret', email: 'maria.prueba@exemplo.com', name: 'Maria' });
  banco.latam_access.push({ customer_id: 'c-ret', product: 'app', status: 'revoked', source: 'manual', expires_at: null, revoked_at: '2026-11-01T00:00:00Z' });
  await enviar(aviso('order.paid', pedido()));
  const a = acesso();
  confere('ativa de novo, 12 meses, sem revogação', a.status === 'active' && a.revoked_at === null && a.expires_at === new Date(Date.parse('2026-11-06T20:00:00Z') + 365 * DIA).toISOString(), JSON.stringify(a));
  confere('o nome que existia não é trocado', cliente().name === 'Maria');
});

await cenario('23. Upsell sozinho (Arcángeles D) também libera o app', async () => {
  await enviar(aviso('order.paid', pedido({ id: 'up1', offers: [{ id: 'd-up1', name: 'Oraciones a los Santos Arcángeles D', type: 'main', quantity: 1, total: 2700 }] })));
  confere('produto arcangeles', JSON.stringify(linha().produtos) === '["arcangeles"]', JSON.stringify(linha().produtos));
  confere('app liberado', acesso().status === 'active' && acesso().source === 'kashpay');
});

await cenario('24. "Cántico Angelical D" (Digistore24) é reconhecido pelo nome', async () => {
  await enviar(aviso('order.paid', pedido({ id: 'up2', offers: [{ id: 'd-up2', name: 'Cántico Angelical D', type: 'main', quantity: 1, total: 2700 }] })));
  confere('produto desatanudos (= o Cántico), sem ler o mapa', JSON.stringify(linha().produtos) === '["desatanudos"]' && !tocadas.has('latam_kashpay_offers'), JSON.stringify(linha().produtos));
  confere('recorded e liberado', linha().status === 'recorded' && acesso().status === 'active');
});

await cenario('25. Os 3 produtos da Digistore24 num pedido só', async () => {
  await enviar(aviso('order.paid', pedido({ id: 'tudo', offers: [
    { id: 'd1', name: '7 Amenes de la Madrugada D', type: 'main', quantity: 1, total: 3700 },
    { id: 'd2', name: 'Oraciones a los Santos Arcángeles D', type: 'upsell', quantity: 1, total: 2700 },
    { id: 'd3', name: 'Cántico Angelical D', type: 'upsell', quantity: 1, total: 2700 },
  ] })));
  confere('os três produtos', JSON.stringify([...linha().produtos].sort()) === '["arcangeles","desatanudos","principal"]', JSON.stringify(linha().produtos));
  confere('um acesso só', banco.latam_access.length === 1);
});

await cenario('26. Pedido pago sem e-mail: grava, NÃO libera, e avisa no detalhe e no console', async () => {
  let resposta;
  const ditos = await comConsole(async () => { resposta = await enviar(aviso('order.paid', pedido({ customer: { id: 'cus_X', name: 'Maria Lopez Prueba', phone: '+5215512345678' } }))); });
  const corpo = await resposta.json();
  confere('responde 200, gravado, não liberado', resposta.status === 200 && corpo.gravado === true && corpo.liberado === false, JSON.stringify(corpo));
  confere('nenhuma cliente criada', banco.latam_customers.length === 0 && banco.latam_access.length === 0);
  confere('o detalhe manda liberar à mão', linha().detail.includes('NÃO foi liberado') && linha().status === 'recorded', linha().detail);
  confere('o console diz os nomes dos campos, sem valores de pessoa', ditos.some(d => d.includes('SEM_EMAIL') && d.includes('phone')) && semPessoa(ditos).length === 0, ditos.join(' / '));
});

await cenario('27. Reembolso e chargeback não criam cliente nem mexem no acesso', async () => {
  await enviar(aviso('order.paid', pedido()));
  const antes = JSON.stringify(acesso());
  await enviar(aviso('order.refunded', pedido({ status: 'refunded', refunded_at: '2026-11-07T00:00:00Z' })));
  await enviar(aviso('order.chargeback', pedido({ status: 'chargeback', chargeback_at: '2026-11-08T00:00:00Z' })));
  confere('o acesso fica igual', JSON.stringify(acesso()) === antes);
  confere('os avisos de devolução ficam sem customer_id', eventos().filter(e => e.event !== 'order.paid').every(e => !('customer_id' in e) || e.customer_id === null));
  confere('uma cliente só', banco.latam_customers.length === 1);
});

await cenario('28. Oferta de nome genérico (needs_review) não libera', async () => {
  await enviar(aviso('order.paid', pedido({ id: 'gen', offers: [{ id: 'x9', name: '19 usd', total: 1900 }] })));
  confere('needs_review, sem cliente', linha().status === 'needs_review' && banco.latam_customers.length === 0);
});

await cenario('29. Falha ao liberar: 500, o pedido NÃO é gravado, e a nova tentativa resolve', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_access' && method === 'POST', status: 400 });
  const primeira = await enviar(aviso('order.paid', pedido()));
  confere('responde 500', primeira.status === 500, `veio ${primeira.status}`);
  confere('o pedido não foi gravado (senão a repetição cairia em duplicado)', eventos().length === 0);
  limparFalhas();
  const segunda = await (await enviar(aviso('order.paid', pedido()))).json();
  confere('a nova tentativa grava e libera', segunda.gravado === true && segunda.liberado === true && acesso().status === 'active', JSON.stringify(segunda));
  confere('a cliente da primeira tentativa é reaproveitada', banco.latam_customers.length === 1);
});

await cenario('30. A Whop liberou no mesmo instante (conflito ao criar o acesso): segue sem erro', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_access' && method === 'POST', status: 409, vezes: 1 });
  const resposta = await enviar(aviso('order.paid', pedido()));
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('o detalhe explica', linha().detail.includes('liberado no mesmo instante pelo aviso da Whop'), linha().detail);
});

await cenario('31. Nome que é e-mail não vira nome', async () => {
  await enviar(aviso('order.paid', pedido({ customer: { id: 'c', name: 'maria.prueba@exemplo.com', email: 'maria.prueba@exemplo.com' } })));
  confere('nome em branco', !cliente().name, JSON.stringify(cliente()));
});


await cenario('32. Las 3 Madrugadas de Intercesión (US$ 37, Dia 7): grava como tres_madrugadas', async () => {
  const r = await (await enviar(aviso('order.paid', pedido({ id: 'tm-1', amount: 3700, offers: [{ id: 'd975ef54-a29c-45da-9eeb-23745cd7d02c', name: 'Las 3 Madrugadas de Intercesión', type: 'main', total: 3700 }] })))).json();
  const l = eventos().find(e => e.transaction_id === 'tm-1') || {};
  confere('gravado como tres_madrugadas (e não como outra operação)', r.gravado === true && l.status === 'recorded' && JSON.stringify(l.produtos) === '["tres_madrugadas"]', JSON.stringify({ r, status: l.status, produtos: l.produtos }));
  confere('não vira o principal nem um extra', !(l.produtos || []).some(p => ['principal', 'arcangeles', 'desatanudos'].includes(p)));
  confere('a oferta guarda o produto', (l.offers || [])[0]?.produto === 'tres_madrugadas');
  await enviar(aviso('order.paid', pedido({ id: 'tm-2', offers: [{ id: 'x', name: 'LAS 3 MADRUGADAS DE INTERCESION', type: 'main', total: 3700 }] })));
  confere('sem acento e em maiúsculas também', JSON.stringify(eventos().find(e => e.transaction_id === 'tm-2')?.produtos) === '["tres_madrugadas"]');
});

await cenario('32b. Amenes Sagrados (os aportes do Dia 3): grava como aporte, e não como o app', async () => {
  const filaAntes = (banco.latam_emails || []).length;
  const r = await (await enviar(aviso('order.paid', pedido({ id: 'as-1', amount: 20000, offers: [{ id: 'x', name: 'Amenes Sagrados', type: 'main', total: 20000 }] })))).json();
  const l = eventos().find(e => e.transaction_id === 'as-1') || {};
  confere('gravado como aporte', r.gravado === true && l.status === 'recorded' && JSON.stringify(l.produtos) === '["aporte"]', JSON.stringify({ r, status: l.status, produtos: l.produtos }));
  confere('não vira o principal nem um extra', !(l.produtos || []).some(p => ['principal', 'arcangeles', 'desatanudos', 'tres_madrugadas'].includes(p)));
  confere('a oferta guarda o produto', (l.offers || [])[0]?.produto === 'aporte');
  await enviar(aviso('order.paid', pedido({ id: 'as-2', offers: [{ id: 'y', name: 'AMÉNES SAGRADOS', type: 'main', total: 6000 }] })));
  confere('com acento e em maiúsculas também', JSON.stringify(eventos().find(e => e.transaction_id === 'as-2')?.produtos) === '["aporte"]');
  confere('nenhum e-mail do app para o aporte', (banco.latam_emails || []).length === filaAntes, `fila: ${filaAntes} → ${(banco.latam_emails || []).length}`);
  await enviar(aviso('order.paid', pedido({ id: 'as-3' })));
  confere('o "7 Amenes de la Madrugada" continua sendo o app', JSON.stringify(eventos().find(e => e.transaction_id === 'as-3')?.produtos) === '["principal"]');
});
fechar();
