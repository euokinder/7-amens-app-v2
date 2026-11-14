// Teste local da en-digistore: não toca em banco nenhum.
//
// Sobe a função num banco de mentira (supabase/en/testes/banco-falso.mjs) e
// manda avisos assinados no formato do guia oficial do IPN da Digistore24,
// com nome e e-mail de mentira, para provar que a liberação funciona, que
// produto fora de en_digistore_products não libera nada e que nada de pessoa
// vai para a linha do aviso. Cópia do teste da latam-digistore, adaptada.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/en-digistore/testa-en-digistore.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, limparFalhas, carregarFuncao, confere, cenario, fechar,
} from '../../en/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const SENHA = 'senha-do-ipn-de-mentira-123';
const SENHA_DE_ENSAIO = 'ds24_ensaio_somente_no_banco_de_teste_en';
const SENHA_DE_ENSAIO_LATAM = 'ds24_ensaio_somente_no_banco_de_teste_latam';
const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co';
const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co';
const env = (base, senha) => ({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa', EN_DIGISTORE_IPN_PASSWORD: senha });

const naProducao = await carregarFuncao(alvo, env(PRODUCAO, SENHA));
const producaoSemSenha = await carregarFuncao(alvo, env(PRODUCAO, ''));
const noTesteSemSenha = await carregarFuncao(alvo, env(TESTE, ''));

// Números de produto de mentira (os de verdade vêm do Arthur e vão para a
// tabela en_digistore_products, não para o código).
const P = { front: '900001', down: '900002', arcanjos: '900003', cantico: '900004', piso: '900005', tres: '900006' };
function cadastrar() {
  banco.en_digistore_products.push(
    { product_id: P.front, produto: 'principal' },
    { product_id: P.down, produto: 'principal' },
    { product_id: P.arcanjos, produto: 'arcangeles' },
    { product_id: P.cantico, produto: 'cantico' },
    { product_id: P.piso, produto: 'aporte' },
    { product_id: P.tres, produto: 'tres_madrugadas' },
  );
}

const EMAIL = 'mary.sample@exemplo.com';
const PESSOA = ['Mary', 'Sample', EMAIL];

// A assinatura do guia oficial, escrita de novo aqui, de forma independente.
function assinar(campos, senha = SENHA) {
  const chaves = Object.keys(campos).filter(k => k !== 'sha_sign' && campos[k] !== '' && campos[k] !== undefined && campos[k] !== null)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const texto = chaves.map(k => `${k}=${campos[k]}${senha}`).join('');
  return createHash('sha512').update(texto).digest('hex').toUpperCase();
}

const venda = (extra = {}) => ({
  event: 'on_payment', api_mode: 'live', ipn_version: '1.6',
  order_id: 'ZTENWWTY1', transaction_id: '78866774', payment_id: 'PAYID-1',
  product_id: P.arcanjos, product_name: 'The Four Archangels',
  amount_brutto: '27.00', currency: 'USD', pay_method: 'creditcard', country: 'us',
  email: EMAIL, address_first_name: 'Mary', address_last_name: 'Sample',
  utm_source: 'app-en', utm_medium: 'popup', utm_campaign: 'en_arcangeles_1', utm_content: 'x::fbclid',
  custom: '', billing_type: 'single_payment',
  ...extra,
});

function enviar(campos, { manipulador = naProducao, senha, assinatura, metodo = 'POST' } = {}) {
  const corpo = { ...campos };
  const valor = assinatura === undefined ? assinar(campos, senha) : assinatura;
  if (valor !== null) corpo.sha_sign = valor;
  const body = new URLSearchParams(corpo).toString();
  return manipulador(new Request('https://exemplo/en-digistore', {
    method: metodo, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: metodo === 'GET' ? undefined : body,
  }));
}
const eventos = () => banco.en_digistore_events;
const cliente = (email = EMAIL) => banco.en_customers.find(c => c.email === email);
const acesso = (produto, email = EMAIL) => banco.en_access.find(a => a.customer_id === cliente(email)?.id && a.product === produto);
const semPessoa = () => PESSOA.filter(v => JSON.stringify(eventos()).toLowerCase().includes(v.toLowerCase()));

console.log(`Testando: ${alvo}`);

await cenario('0. A assinatura bate com o exemplo do guia oficial', async () => {
  const exemplo = { buyer_email: 'claus@domain-xyz.de', payment_id: 'PAYID-39-22012', order_id: '273732', transaction_amount: '17.00', transaction_currency: 'USD' };
  const esperado = '342770076245D14ED7DF4D2E5D82216D7EDF8F9E7969B5964C9C5DCB53E962BBECD545E90422B5329C69554FD8B1A7E7410736615FCA7FB5CBB3624CC016E4BC';
  confere('o assinador do teste reproduz o guia', assinar(exemplo, 'xxxxx') === esperado);
  const resposta = await enviar({ ...exemplo, event: 'connection_test' }, { senha: 'xxxxx', manipulador: await carregarFuncao(alvo, env(PRODUCAO, 'xxxxx')) });
  confere('a função aceita a mesma assinatura', resposta.status === 200 && (await resposta.text()) === 'OK');
});

await cenario('1. Arcanjos pago: libera o app e o extra, e grava o aviso sem pessoa', async () => {
  cadastrar();
  const resposta = await enviar(venda());
  confere('responde 200 com o texto exato OK', resposta.status === 200 && (await resposta.text()) === 'OK');
  confere('criou a cliente pelo e-mail, com o nome e o país', cliente() && cliente().name === 'Mary Sample' && cliente().country === 'US');
  confere('app ativo por ~12 meses, origem checkout', acesso('app')?.status === 'active' && acesso('app')?.source === 'checkout'
    && Date.parse(acesso('app').expires_at) - Date.now() > 360 * 86_400_000 && Date.parse(acesso('app').expires_at) - Date.now() < 370 * 86_400_000);
  confere('extra arcangeles ativo, sem prazo próprio', acesso('arcangeles')?.status === 'active' && acesso('arcangeles')?.expires_at === null);
  confere('nenhum cantico liberado', !acesso('cantico'));
  const l = eventos()[0] || {};
  confere('uma linha de aviso', eventos().length === 1);
  confere('evento, transação, pedido, produto', l.event === 'on_payment' && l.transaction_id === '78866774' && l.order_id === 'ZTENWWTY1'
    && l.product_id === P.arcanjos && l.product_ids === P.arcanjos && JSON.stringify(l.produtos) === '["arcangeles"]' && l.product_name === 'The Four Archangels');
  confere('valor, moeda, meio e país', l.amount === 27 && l.currency === 'USD' && l.pay_method === 'creditcard' && l.country === 'US');
  confere('utm do app, sem o que vem depois de ::', l.utm_source === 'app-en' && l.utm_medium === 'popup' && l.utm_campaign === 'en_arcangeles_1' && l.utm_content === 'x');
  confere('ligada à cliente pelo número, não pelo e-mail', l.customer_id === cliente().id);
  confere('nenhum dado de pessoa na linha do aviso', semPessoa().length === 0, semPessoa().join(', '));
  confere('guarda os nomes dos campos', String(l.campos).includes('product_id') && !String(l.campos).includes(EMAIL));
  confere('status recorded', l.status === 'recorded', l.detail);
});

await cenario('2. O mesmo aviso 3 vezes (a Digistore repete): nada duplica', async () => {
  cadastrar();
  await enviar(venda());
  await enviar(venda());
  const terceira = await enviar(venda());
  confere('responde OK', terceira.status === 200 && (await terceira.text()) === 'OK');
  confere('uma cliente, um app, um extra, um aviso',
    banco.en_customers.length === 1 && banco.en_access.filter(a => a.product === 'app').length === 1
    && banco.en_access.filter(a => a.product === 'arcangeles').length === 1 && eventos().length === 1);
});

await cenario('3. Já tinha acesso mais longo (liberado à mão): fica como está', async () => {
  cadastrar();
  banco.en_customers.push({ id: 'c-antes', email: EMAIL, name: '', country: null });
  const longe = new Date(Date.now() + 400 * 86_400_000).toISOString();
  banco.en_access.push({ customer_id: 'c-antes', product: 'app', status: 'active', source: 'manual', expires_at: longe });
  banco.en_access.push({ customer_id: 'c-antes', product: 'arcangeles', status: 'active', source: 'manual', expires_at: null });
  await enviar(venda());
  confere('não criou outra cliente', banco.en_customers.length === 1);
  confere('o app manual continua com o prazo mais longo', acesso('app').source === 'manual' && acesso('app').expires_at === longe);
  confere('o extra manual continua manual', acesso('arcangeles').source === 'manual');
  confere('o nome e o país em branco foram preenchidos', cliente().name === 'Mary Sample' && cliente().country === 'US');
  confere('o aviso diz que já tinha', /já tinha/.test(eventos()[0].detail) && /já estava liberado/.test(eventos()[0].detail), eventos()[0].detail);
});

await cenario('4. Cliente que já existe não tem nome nem país sobrescritos', async () => {
  cadastrar();
  banco.en_customers.push({ id: 'c-2', email: EMAIL, name: 'Mary Beth', country: 'CA' });
  await enviar(venda());
  confere('nome e país continuam', cliente().name === 'Mary Beth' && cliente().country === 'CA');
});

await cenario('5. Front, downsell, Cântico, contribuição e Three Mornings', async () => {
  cadastrar();
  await enviar(venda({ product_id: P.front, product_name: '7 Amens Before Dawn', transaction_id: 't-front', amount_brutto: '37.00' }));
  confere('front: só o app', acesso('app')?.status === 'active' && !acesso('arcangeles') && !acesso('cantico'));
  await enviar(venda({ product_id: P.cantico, product_name: 'Angelic Canticle', transaction_id: 't-cantico' }));
  confere('cântico: extra cantico', acesso('cantico')?.status === 'active');
  await enviar(venda({ product_id: P.down, product_name: '7 Amens Before Dawn D', transaction_id: 't-down', email: 'down@exemplo.com' }));
  confere('downsell: o app, sem extra', acesso('app', 'down@exemplo.com')?.status === 'active' && !acesso('arcangeles', 'down@exemplo.com'));
  await enviar(venda({ product_id: P.piso, product_name: 'A section of the floor', transaction_id: 't-piso', amount_brutto: '97.00' }));
  await enviar(venda({ product_id: P.tres, product_name: 'Three Mornings of Intercession', transaction_id: 't-tres' }));
  confere('contribuição e Three Mornings: nenhum extra a mais', !acesso('arcangeles'));
  confere('cinco avisos, cada um com o seu produto',
    eventos().length === 5 && eventos().map(e => (e.produtos || []).join('+')).join() === 'principal,cantico,principal,aporte,tres_madrugadas');
  confere('todos recorded', eventos().every(e => e.status === 'recorded'));
});

await cenario('6. Produto fora da tabela: needs_review e NADA liberado (nem pelo nome)', async () => {
  cadastrar();
  await enviar(venda({ product_id: '777777', product_name: 'The Four Archangels - new offer', transaction_id: 't-novo', email: 'nova@exemplo.com' }));
  const l = eventos().find(e => e.transaction_id === 't-novo');
  confere('needs_review, sem produto, sem cliente', l?.status === 'needs_review' && l.produtos === null && !l.customer_id, l?.detail);
  confere('ninguém liberado (o nome parecido não basta)', !cliente('nova@exemplo.com') && banco.en_access.length === 0);
  confere('o aviso diz o número e o que fazer', /777777/.test(l?.detail || '') && /en_digistore_products/.test(l?.detail || ''), l?.detail);
  confere('responde OK (repetir não ajudaria)', true);
});

await cenario('7. Tabela de produtos vazia (o SQL rodou, os números não): nada liberado', async () => {
  await enviar(venda());
  confere('needs_review e ninguém liberado', eventos()[0]?.status === 'needs_review' && banco.en_customers.length === 0);
});

await cenario('8. Dois produtos no mesmo pagamento (product_id_2): os dois contam', async () => {
  cadastrar();
  await enviar(venda({ product_id: P.front, product_name: '7 Amens Before Dawn', product_id_2: P.cantico, product_name_2: 'Angelic Canticle', transaction_id: 't-dois' }));
  const l = eventos()[0] || {};
  confere('app e cântico liberados', acesso('app')?.status === 'active' && acesso('cantico')?.status === 'active');
  confere('o aviso guarda os dois', l.product_ids === `${P.front},${P.cantico}` && JSON.stringify(l.produtos) === '["principal","cantico"]' && l.status === 'recorded', l.detail);
  // Um conhecido e um desconhecido: libera o conhecido e pede revisão.
  await enviar(venda({ product_id: P.front, product_name: '7 Amens Before Dawn', product_id_2: '888888', product_name_2: 'Bump', transaction_id: 't-misto', email: 'misto@exemplo.com' }));
  const m = eventos().find(e => e.transaction_id === 't-misto') || {};
  confere('misto: o app liberado, needs_review', acesso('app', 'misto@exemplo.com')?.status === 'active' && m.status === 'needs_review' && /888888/.test(m.detail), m.detail);
  confere('misto: o desconhecido não entra em produtos', JSON.stringify(m.produtos) === '["principal"]');
});

await cenario('9. Upsell no mesmo pedido (mesmo order_id, outra transação)', async () => {
  cadastrar();
  await enviar(venda({ product_id: P.front, product_name: '7 Amens Before Dawn', transaction_id: 't-1', amount_brutto: '37.00' }));
  await enviar(venda({ transaction_id: 't-2' }));
  confere('duas linhas, o mesmo pedido', eventos().length === 2 && eventos().every(e => e.order_id === 'ZTENWWTY1'));
  confere('app e Arcanjos', acesso('app')?.status === 'active' && acesso('arcangeles')?.status === 'active');
});

await cenario('10. Extra retirado no painel volta quando ela paga de novo', async () => {
  cadastrar();
  banco.en_customers.push({ id: 'c-1', email: EMAIL, name: 'Mary Sample', country: 'US' });
  banco.en_access.push({ customer_id: 'c-1', product: 'arcangeles', status: 'revoked', source: 'manual', expires_at: null, revoked_at: '2026-11-10T00:00:00Z' });
  await enviar(venda());
  confere('voltou a ativo', acesso('arcangeles').status === 'active' && acesso('arcangeles').revoked_at === null);
});

await cenario('11. Reembolso e disputa: só registram, não tiram o acesso', async () => {
  cadastrar();
  await enviar(venda());
  const r = await enviar(venda({ event: 'on_refund', transaction_id: 't-refund', amount_brutto: '-27.00' }));
  await enviar(venda({ event: 'on_chargeback', transaction_id: 't-cb' }));
  confere('responde OK', r.status === 200);
  confere('acesso continua ativo', acesso('app').status === 'active' && acesso('arcangeles').status === 'active');
  confere('três avisos registrados', eventos().length === 3 && eventos().some(e => e.event === 'on_refund' && e.amount === -27));
  const reembolso = eventos().find(e => e.event === 'on_refund');
  confere('o reembolso não liga cliente nem libera', !reembolso.customer_id && /não tiram o acesso/.test(reembolso.detail), reembolso.detail);
});

await cenario('12. Compra de teste (Testpay) na produção: registra e não libera', async () => {
  cadastrar();
  await enviar(venda({ api_mode: 'test' }));
  confere('ninguém liberado', banco.en_customers.length === 0 && banco.en_access.length === 0);
  confere('aviso ignored', eventos()[0]?.status === 'ignored');
});

await cenario('13. No banco de TESTE, a compra de teste libera (para provar o caminho)', async () => {
  cadastrar();
  const resposta = await enviar(venda({ api_mode: 'test' }), { manipulador: noTesteSemSenha, senha: SENHA_DE_ENSAIO });
  confere('OK com a senha de ensaio', resposta.status === 200);
  confere('liberou', acesso('app')?.status === 'active' && acesso('arcangeles')?.status === 'active');
});

await cenario('14. Assinatura: errada, ausente, sem senha configurada, senha do espanhol', async () => {
  cadastrar();
  const errada = await enviar(venda(), { senha: 'outra-senha' });
  confere('senha errada: 401', errada.status === 401);
  const sem = await enviar(venda(), { assinatura: null });
  confere('sem sha_sign: 401', sem.status === 401);
  const alterado = { ...venda() };
  const assinatura = assinar(alterado);
  alterado.product_id = P.cantico;
  const trocada = await enviar(alterado, { assinatura });
  confere('campo trocado depois de assinar: 401', trocada.status === 401);
  const semSenha = await enviar(venda(), { manipulador: producaoSemSenha, senha: '' });
  confere('produção sem senha configurada: 401 (nunca a senha de ensaio)', semSenha.status === 401);
  const ensaioNaProducao = await enviar(venda(), { manipulador: producaoSemSenha, senha: SENHA_DE_ENSAIO });
  confere('a senha de ensaio não vale na produção', ensaioNaProducao.status === 401);
  const latamNoTeste = await enviar(venda(), { manipulador: noTesteSemSenha, senha: SENHA_DE_ENSAIO_LATAM });
  confere('a senha de ensaio do espanhol não vale aqui', latamNoTeste.status === 401);
  confere('nada gravado', banco.en_customers.length === 0 && eventos().length === 0);
});

await cenario('15. Teste de conexão da Digistore', async () => {
  const r = await enviar({ event: 'connection_test', ipn_version: '1.6' });
  confere('responde OK e não grava nada', r.status === 200 && (await r.text()) === 'OK' && eventos().length === 0);
});

await cenario('16. Banco fora do ar: 500 (a Digistore repete) e nada pela metade', async () => {
  cadastrar();
  forcarFalha({ quando: ({ tabela }) => tabela === 'en_access', status: 500 });
  const r = await enviar(venda());
  limparFalhas();
  confere('responde 500, sem OK', r.status === 500 && (await r.text()) !== 'OK');
  confere('o aviso não foi gravado (a repetição vai liberar)', eventos().length === 0);
  const depois = await enviar(venda());
  confere('na repetição, libera e grava', depois.status === 200 && acesso('arcangeles')?.status === 'active' && eventos().length === 1);
});

await cenario('17. A tabela de produtos fora do ar: 500, nunca "desconhecido"', async () => {
  cadastrar();
  forcarFalha({ quando: ({ tabela }) => tabela === 'en_digistore_products', status: 503 });
  const r = await enviar(venda());
  limparFalhas();
  confere('responde 500 (a Digistore repete)', r.status === 500);
  confere('nada gravado como needs_review', eventos().length === 0);
});

await cenario('18. Sem e-mail utilizável: grava e avisa, sem liberar', async () => {
  cadastrar();
  await enviar(venda({ email: 'nao-e-email' }));
  confere('ninguém liberado', banco.en_customers.length === 0);
  confere('fica needs_review (aparece na lista de quem precisa de alguém)', eventos()[0]?.status === 'needs_review');
  confere('o aviso diz para liberar à mão no /en-admin', /à mão no \/en-admin/.test(eventos()[0]?.detail || ''), eventos()[0]?.detail);
});

await cenario('19. Número de produto estranho é ignorado (não vai para a consulta)', async () => {
  cadastrar();
  await enviar(venda({ product_id: `${P.arcanjos},${P.cantico}`, transaction_id: 't-estranho' }));
  confere('nada liberado, needs_review', banco.en_customers.length === 0 && eventos()[0]?.status === 'needs_review', eventos()[0]?.detail);
});

await cenario('20. Só tabelas en_ (nada do Brasil nem da LATAM)', async () => {
  cadastrar();
  await enviar(venda());
  await enviar(venda({ event: 'on_refund', transaction_id: 't-r' }));
  const fora = [...tocadas].filter(t => !t.startsWith('en_'));
  confere('nenhuma tabela de fora', fora.length === 0, fora.join(', '));
  confere('nunca grava na visão en_pedidos_pagos', !tocadas.has('en_pedidos_pagos'));
});

await cenario('21. GET não é aceito', async () => {
  const r = await enviar(venda(), { metodo: 'GET' });
  confere('405', r.status === 405);
});

fechar();
