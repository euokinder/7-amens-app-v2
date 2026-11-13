// Teste local da latam-digistore: não toca em banco nenhum.
//
// Sobe a função num banco de mentira e manda avisos assinados no formato do
// guia oficial do IPN da Digistore24 (lido em 13/11/2026), com nome e e-mail
// de mentira, para provar que a liberação funciona e que nada de pessoa vai
// para a linha do aviso.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/latam-digistore/testa-latam-digistore.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, limparFalhas, carregarFuncao, confere, cenario, fechar,
} from '../../latam/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const SENHA = 'senha-do-ipn-de-mentira-123';
const SENHA_DE_ENSAIO = 'ds24_ensaio_somente_no_banco_de_teste_latam';
const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co';
const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co';
const env = (base, senha) => ({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa', LATAM_DIGISTORE_IPN_PASSWORD: senha });

const naProducao = await carregarFuncao(alvo, env(PRODUCAO, SENHA));
const producaoSemSenha = await carregarFuncao(alvo, env(PRODUCAO, ''));
const noTesteSemSenha = await carregarFuncao(alvo, env(TESTE, ''));

const EMAIL = 'maria.prueba@exemplo.com';
const PESSOA = ['Maria', 'Prueba', EMAIL];

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
  product_id: '742832', product_name: 'Oraciones a los Santos Arcángeles',
  amount_brutto: '27.00', currency: 'USD', pay_method: 'creditcard', country: 'mx',
  email: EMAIL, address_first_name: 'Maria', address_last_name: 'Prueba',
  utm_source: 'app-es', utm_medium: 'popup', utm_campaign: 'es_arcangeles_novas_1', utm_content: 'x::fbclid',
  custom: '', billing_type: 'single_payment',
  ...extra,
});

function enviar(campos, { manipulador = naProducao, senha, assinatura, metodo = 'POST' } = {}) {
  const corpo = { ...campos };
  const valor = assinatura === undefined ? assinar(campos, senha) : assinatura;
  if (valor !== null) corpo.sha_sign = valor;
  const body = new URLSearchParams(corpo).toString();
  return manipulador(new Request('https://exemplo/latam-digistore', {
    method: metodo, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: metodo === 'GET' ? undefined : body,
  }));
}
const eventos = () => banco.latam_digistore_events;
const cliente = () => banco.latam_customers.find(c => c.email === EMAIL);
const acesso = produto => banco.latam_access.find(a => a.customer_id === cliente()?.id && a.product === produto);
const semPessoa = () => PESSOA.filter(v => JSON.stringify(eventos()).includes(v));

console.log(`Testando: ${alvo}`);

await cenario('0. A assinatura bate com o exemplo do guia oficial', async () => {
  const exemplo = { buyer_email: 'claus@domain-xyz.de', payment_id: 'PAYID-39-22012', order_id: '273732', transaction_amount: '17.00', transaction_currency: 'USD' };
  const esperado = '342770076245D14ED7DF4D2E5D82216D7EDF8F9E7969B5964C9C5DCB53E962BBECD545E90422B5329C69554FD8B1A7E7410736615FCA7FB5CBB3624CC016E4BC';
  confere('o assinador do teste reproduz o guia', assinar(exemplo, 'xxxxx') === esperado);
  const resposta = await enviar({ ...exemplo, event: 'connection_test' }, { senha: 'xxxxx', manipulador: await carregarFuncao(alvo, env(PRODUCAO, 'xxxxx')) });
  confere('a função aceita a mesma assinatura', resposta.status === 200 && (await resposta.text()) === 'OK');
});

await cenario('1. Arcángeles pago: libera o app e o extra, e grava o aviso sem pessoa', async () => {
  const resposta = await enviar(venda());
  confere('responde 200 com o texto exato OK', resposta.status === 200 && (await resposta.text()) === 'OK');
  confere('criou a cliente pelo e-mail, com o nome', cliente() && cliente().name === 'Maria Prueba');
  confere('app ativo por ~12 meses, origem digistore', acesso('app')?.status === 'active' && acesso('app')?.source === 'digistore'
    && Date.parse(acesso('app').expires_at) - Date.now() > 360 * 86_400_000);
  confere('extra arcangeles ativo, sem prazo próprio', acesso('arcangeles')?.status === 'active' && acesso('arcangeles')?.expires_at === null);
  confere('nenhum cantico liberado', !acesso('cantico'));
  const l = eventos()[0] || {};
  confere('uma linha de aviso', eventos().length === 1);
  confere('evento, transação, pedido, produto', l.event === 'on_payment' && l.transaction_id === '78866774' && l.order_id === 'ZTENWWTY1' && l.product_id === '742832' && l.produto === 'arcangeles');
  confere('valor, moeda, meio e país', l.amount === 27 && l.currency === 'USD' && l.pay_method === 'creditcard' && l.country === 'MX');
  confere('utm do app, sem o que vem depois de ::', l.utm_source === 'app-es' && l.utm_medium === 'popup' && l.utm_campaign === 'es_arcangeles_novas_1' && l.utm_content === 'x');
  confere('ligada à cliente pelo número, não pelo e-mail', l.customer_id === cliente().id);
  confere('nenhum dado de pessoa na linha do aviso', semPessoa().length === 0, semPessoa().join(', '));
  confere('guarda os nomes dos campos', String(l.campos).includes('product_id') && !String(l.campos).includes(EMAIL));
  confere('status recorded', l.status === 'recorded', l.detail);
});

await cenario('2. O mesmo aviso 3 vezes (a Digistore repete): nada duplica', async () => {
  await enviar(venda());
  await enviar(venda());
  const terceira = await enviar(venda());
  confere('responde OK', terceira.status === 200 && (await terceira.text()) === 'OK');
  confere('uma cliente, um app, um extra, um aviso',
    banco.latam_customers.length === 1 && banco.latam_access.filter(a => a.product === 'app').length === 1
    && banco.latam_access.filter(a => a.product === 'arcangeles').length === 1 && eventos().length === 1);
});

await cenario('3. A automação do Pedro chegou antes (acesso "manual"): fica como está', async () => {
  banco.latam_customers.push({ id: 'c-pedro', email: EMAIL, name: '' });
  const longe = new Date(Date.now() + 400 * 86_400_000).toISOString();
  banco.latam_access.push({ customer_id: 'c-pedro', product: 'app', status: 'active', source: 'manual', expires_at: longe });
  banco.latam_access.push({ customer_id: 'c-pedro', product: 'arcangeles', status: 'active', source: 'manual', expires_at: null });
  await enviar(venda());
  confere('não criou outra cliente', banco.latam_customers.length === 1);
  confere('o app manual continua com o prazo mais longo', acesso('app').source === 'manual' && acesso('app').expires_at === longe);
  confere('o extra manual continua manual', acesso('arcangeles').source === 'manual');
  confere('o nome em branco foi preenchido', cliente().name === 'Maria Prueba');
  confere('o aviso diz que já tinha', /já tinha/.test(eventos()[0].detail) && /já estava liberado/.test(eventos()[0].detail), eventos()[0].detail);
});

await cenario('4. Front e Cántico', async () => {
  await enviar(venda({ product_id: '742807', product_name: '7 Amenes de la Madrugada', transaction_id: 't-front', amount_brutto: '37.00' }));
  confere('front: só o app', acesso('app')?.status === 'active' && !acesso('arcangeles') && !acesso('cantico'));
  await enviar(venda({ product_id: '742816', product_name: 'Cántico Angelical', transaction_id: 't-cantico' }));
  confere('cántico: extra cantico', acesso('cantico')?.status === 'active');
  confere('dois avisos', eventos().length === 2 && eventos().map(e => e.produto).join() === 'principal,cantico');
});

await cenario('5. Extra retirado no painel volta quando ela paga de novo', async () => {
  banco.latam_customers.push({ id: 'c-1', email: EMAIL, name: 'Maria Prueba' });
  banco.latam_access.push({ customer_id: 'c-1', product: 'arcangeles', status: 'revoked', source: 'manual', expires_at: null, revoked_at: '2026-11-10T00:00:00Z' });
  await enviar(venda());
  confere('voltou a ativo', acesso('arcangeles').status === 'active' && acesso('arcangeles').revoked_at === null);
});

await cenario('6. Produto novo pelo nome; produto desconhecido não libera', async () => {
  await enviar(venda({ product_id: '999001', product_name: 'Cántico Angelical - Oferta', transaction_id: 't-nome' }));
  confere('reconheceu pelo nome', acesso('cantico')?.status === 'active');
  await enviar(venda({ product_id: '742835', product_name: 'Rice on the Back Burner', transaction_id: 't-outro', email: 'outra@exemplo.com' }));
  const l = eventos().find(e => e.transaction_id === 't-outro');
  confere('desconhecido: needs_review, sem produto', l?.status === 'needs_review' && l.produto === null, l?.detail);
  confere('desconhecido: ninguém liberado', !banco.latam_customers.some(c => c.email === 'outra@exemplo.com'));
});

await cenario('7. Reembolso e estorno: só registram, não tiram o acesso', async () => {
  await enviar(venda());
  const r = await enviar(venda({ event: 'on_refund', transaction_id: 't-refund', amount_brutto: '-27.00' }));
  await enviar(venda({ event: 'on_chargeback', transaction_id: 't-cb' }));
  confere('responde OK', r.status === 200);
  confere('acesso continua ativo', acesso('app').status === 'active' && acesso('arcangeles').status === 'active');
  confere('três avisos registrados', eventos().length === 3 && eventos().some(e => e.event === 'on_refund' && e.amount === -27));
});

await cenario('8. Compra de teste (Testpay) na produção: registra e não libera', async () => {
  await enviar(venda({ api_mode: 'test' }));
  confere('ninguém liberado', banco.latam_customers.length === 0 && banco.latam_access.length === 0);
  confere('aviso ignored', eventos()[0]?.status === 'ignored');
});

await cenario('9. No banco de TESTE, a compra de teste libera (para provar o caminho)', async () => {
  const resposta = await enviar(venda({ api_mode: 'test' }), { manipulador: noTesteSemSenha, senha: SENHA_DE_ENSAIO });
  confere('OK com a senha de ensaio', resposta.status === 200);
  confere('liberou', acesso('app')?.status === 'active' && acesso('arcangeles')?.status === 'active');
});

await cenario('10. Assinatura: errada, ausente, sem senha configurada', async () => {
  const errada = await enviar(venda(), { senha: 'outra-senha' });
  confere('senha errada: 401', errada.status === 401);
  const sem = await enviar(venda(), { assinatura: null });
  confere('sem sha_sign: 401', sem.status === 401);
  const alterado = { ...venda() };
  const assinatura = assinar(alterado);
  alterado.product_id = '742816';
  const trocada = await enviar(alterado, { assinatura });
  confere('campo trocado depois de assinar: 401', trocada.status === 401);
  const semSenha = await enviar(venda(), { manipulador: producaoSemSenha, senha: '' });
  confere('produção sem senha configurada: 401 (nunca a senha de ensaio)', semSenha.status === 401);
  const ensaioNaProducao = await enviar(venda(), { manipulador: producaoSemSenha, senha: SENHA_DE_ENSAIO });
  confere('a senha de ensaio não vale na produção', ensaioNaProducao.status === 401);
  confere('nada gravado', banco.latam_customers.length === 0 && eventos().length === 0);
});

await cenario('11. Teste de conexão da Digistore', async () => {
  const r = await enviar({ event: 'connection_test', ipn_version: '1.6' });
  confere('responde OK e não grava nada', r.status === 200 && (await r.text()) === 'OK' && eventos().length === 0);
});

await cenario('12. Banco fora do ar: 500 (a Digistore repete) e nada pela metade', async () => {
  forcarFalha({ quando: ({ tabela }) => tabela === 'latam_access', status: 500 });
  const r = await enviar(venda());
  limparFalhas();
  confere('responde 500, sem OK', r.status === 500 && (await r.text()) !== 'OK');
  confere('o aviso não foi gravado (a repetição vai liberar)', eventos().length === 0);
  const depois = await enviar(venda());
  confere('na repetição, libera e grava', depois.status === 200 && acesso('arcangeles')?.status === 'active' && eventos().length === 1);
});

await cenario('13. Sem e-mail utilizável: grava e avisa, sem liberar', async () => {
  await enviar(venda({ email: 'nao-e-email' }));
  confere('ninguém liberado', banco.latam_customers.length === 0);
  confere('o aviso diz para liberar à mão', /à mão/.test(eventos()[0]?.detail || ''));
});

await cenario('14. Só tabelas da LATAM', async () => {
  await enviar(venda());
  const fora = [...tocadas].filter(t => !t.startsWith('latam_'));
  confere('nenhuma tabela do Brasil', fora.length === 0, fora.join(', '));
});

await cenario('15. GET não é aceito', async () => {
  const r = await enviar(venda(), { metodo: 'GET' });
  confere('405', r.status === 405);
});

fechar();
