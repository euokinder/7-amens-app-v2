// Teste local da latam-whop: não toca em banco nenhum.
//
// Sobe a função num banco de mentira e manda avisos assinados no formato da
// Whop, imitando a venda da KashPay como ela chegou de verdade em 05/11/2026
// (product_id nulo, plan_ que muda a cada checkout, e-mail em customer_email).
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/latam-whop/testa-latam-whop.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, limparFalhas, carregarFuncao, confere, cenario, fechar,
} from '../../latam/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const SEGREDO = 'ws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SEGREDO_DE_ENSAIO = 'ws_ensaio_somente_no_banco_de_teste_latam';
const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co';
const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co';
const env = (base, segredo) => ({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa', LATAM_WHOP_SECRET: segredo });

const naProducao = await carregarFuncao(alvo, env(PRODUCAO, SEGREDO));
const producaoSemSegredo = await carregarFuncao(alvo, env(PRODUCAO, ''));
const noTesteSemSegredo = await carregarFuncao(alvo, env(TESTE, ''));

let numero = 0;
const novoId = () => `msg_${++numero}`;

function assinar(corpo, { id, segundos = Math.floor(Date.now() / 1000), chave = Buffer.from(SEGREDO, 'utf8') } = {}) {
  const assinatura = createHmac('sha256', chave).update(`${id}.${segundos}.${corpo}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(segundos), 'webhook-signature': `v1,${assinatura}` };
}

// Como a venda da KashPay chegou na Whop em 05/11/2026 (lida pela API).
const pagamento = (extra = {}) => ({
  id: 'pay_TESTE1',
  status: 'paid',
  substatus: 'succeeded',
  account_id: 'biz_aTBX1NJKGf65tH',
  product_id: null,
  variant_id: 'plan_BUHbiP8IE5fLt',
  line_items: [{ id: 'li_1', variant_id: 'plan_BUHbiP8IE5fLt', product_id: null, label: 'Purchase' }],
  customer_email: ' Maria.Lopez@Gmail.com ',
  user: { id: 'user_1', username: 'mlopez', name: null },
  billing_address: { name: 'María  López', country: 'MX' },
  total: { currency: 'usd', amount: '27.00' },
  paid_at: '2026-11-05T21:40:23.025Z',
  created_at: '2026-11-05T21:40:21.599Z',
  ...extra,
});
const aviso = (tipo, data) => ({ id: 'evt_x', type: tipo, api_version: 'v1', data });

function enviar(payload, { manipulador = naProducao, id = novoId(), assinatura = {}, headers } = {}) {
  const corpo = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return manipulador(new Request('https://exemplo/latam-whop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? assinar(corpo, { id, ...assinatura })) },
    body: corpo,
  }));
}
const cliente = () => banco.latam_customers[0] || {};
const acesso = () => banco.latam_access[0] || {};
const evento = id => banco.latam_whop_events.find(e => e.webhook_id === id) || {};

console.log(`Testando: ${alvo}`);

await cenario('1. Venda da KashPay (sem código de produto) libera o app', async () => {
  const resposta = await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_venda' });
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('cria a cliente com o e-mail limpo', cliente().email === 'maria.lopez@gmail.com', cliente().email);
  confere('guarda o nome sem espaço sobrando', cliente().name === 'María López', cliente().name);
  confere('guarda o país do cartão', cliente().country === 'MX');
  confere('guarda a conta da Whop', cliente().whop_user_id === 'user_1');
  confere('acesso ativo, origem whop', acesso().status === 'active' && acesso().source === 'whop');
  confere('acesso por 12 meses a partir do pagamento', String(acesso().expires_at).startsWith('2027-11-05'), acesso().expires_at);
  confere('guarda o código do pagamento', acesso().whop_payment_id === 'pay_TESTE1');
  confere('aviso processado', evento('msg_venda').status === 'processed', evento('msg_venda').detail);
  confere('o registro diz qual leitura da chave conferiu', evento('msg_venda').detail.includes('chave: texto'));
  confere('aviso inteiro guardado', evento('msg_venda').payload?.data?.id === 'pay_TESTE1');
});

await cenario('2. O mesmo aviso de novo (a Whop repete o webhook-id) não duplica nada', async () => {
  await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_rep' });
  const resposta = await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_rep' });
  const corpo = await resposta.json();
  confere('responde 200', resposta.status === 200);
  confere('avisa que é repetido', corpo.duplicated === true);
  confere('uma cliente, um acesso, um aviso', banco.latam_customers.length === 1 && banco.latam_access.length === 1 && banco.latam_whop_events.length === 1);
});

await cenario('3. Segunda compra da mesma cliente estica o prazo e não cria outra', async () => {
  await enviar(aviso('payment.succeeded', pagamento()));
  await enviar(aviso('payment.succeeded', pagamento({ id: 'pay_TESTE2', paid_at: '2026-12-20T10:00:00.000Z' })));
  confere('continua uma cliente', banco.latam_customers.length === 1);
  confere('prazo novo: 12 meses da segunda compra', String(acesso().expires_at).startsWith('2027-12-20'), acesso().expires_at);
  await enviar(aviso('payment.succeeded', pagamento({ id: 'pay_VELHO', paid_at: '2026-10-01T10:00:00.000Z' })));
  confere('aviso atrasado de compra antiga não encurta o prazo', String(acesso().expires_at).startsWith('2027-12-20'));
});

await cenario('4. Cliente que já existe: o aviso só preenche o que está em branco', async () => {
  banco.latam_customers.push({ id: 'c1', email: 'maria.lopez@gmail.com', name: 'Mari', country: null, whop_user_id: null, timezone: 'America/Bogota', first_access_on: '2026-11-01' });
  await enviar(aviso('payment.succeeded', pagamento()));
  confere('não cria outra cliente', banco.latam_customers.length === 1);
  confere('não troca o nome que já existe', cliente().name === 'Mari');
  confere('preenche o país em branco', cliente().country === 'MX');
  confere('não mexe no fuso nem no primeiro acesso', cliente().timezone === 'America/Bogota' && cliente().first_access_on === '2026-11-01');
});

await cenario('5. Retirada à mão + compra nova: ela pagou de novo, volta a entrar', async () => {
  banco.latam_customers.push({ id: 'c1', email: 'maria.lopez@gmail.com', name: 'María', country: 'MX', whop_user_id: 'user_1' });
  banco.latam_access.push({ customer_id: 'c1', product: 'app', status: 'revoked', source: 'manual', expires_at: '2026-12-01T00:00:00.000Z', revoked_at: '2026-11-10T00:00:00.000Z' });
  await enviar(aviso('payment.succeeded', pagamento({ paid_at: '2026-11-20T10:00:00.000Z' })));
  confere('acesso ativo de novo', acesso().status === 'active' && acesso().revoked_at === null);
  confere('prazo de 12 meses da compra nova', String(acesso().expires_at).startsWith('2027-11-20'));
});

await cenario('6. Assinatura errada ou velha: não libera nada', async () => {
  const errada = await enviar(aviso('payment.succeeded', pagamento()), { assinatura: { chave: Buffer.from('ws_outro_segredo', 'utf8') } });
  confere('assinatura errada: 401', errada.status === 401);
  const velha = await enviar(aviso('payment.succeeded', pagamento()), { assinatura: { segundos: Math.floor(Date.now() / 1000) - 600 } });
  confere('horário de 10 minutos atrás: 401', velha.status === 401);
  const sem = await enviar(aviso('payment.succeeded', pagamento()), { headers: {} });
  confere('sem cabeçalhos: 401', sem.status === 401);
  confere('na produção, nada guardado nem liberado', banco.latam_whop_events.length === 0 && banco.latam_customers.length === 0);
});

await cenario('7. Produção sem o segredo configurado recusa tudo', async () => {
  const resposta = await enviar(aviso('payment.succeeded', pagamento()), { manipulador: producaoSemSegredo });
  confere('401', resposta.status === 401);
  confere('nada liberado', banco.latam_access.length === 0);
});

await cenario('8. Banco de TESTE: segredo de ensaio funciona, e o recusado fica guardado', async () => {
  const ensaio = await enviar(aviso('payment.succeeded', pagamento()), { manipulador: noTesteSemSegredo, id: 'msg_ensaio', assinatura: { chave: Buffer.from(SEGREDO_DE_ENSAIO, 'utf8') } });
  confere('assinado com o segredo de ensaio: 200', ensaio.status === 200, `veio ${ensaio.status}`);
  confere('libera no banco de teste', acesso().status === 'active');
  const recusado = await enviar(aviso('payment.succeeded', pagamento()), { manipulador: noTesteSemSegredo, id: 'msg_recusado' });
  confere('assinatura de outro segredo: 401', recusado.status === 401);
  confere('o recusado fica guardado como ignorado, só no teste', evento('msg_recusado').status === 'ignored');
});

await cenario('9. A outra leitura da chave (hex) também confere', async () => {
  const resposta = await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_hex', assinatura: { chave: Buffer.from(SEGREDO.slice(3), 'hex') } });
  confere('200', resposta.status === 200);
  confere('o registro diz "hex"', evento('msg_hex').detail.includes('chave: hex'));
});

await cenario('10. Produto de outra porta (As 3 Madrugadas, do Brasil) não libera', async () => {
  const resposta = await enviar(aviso('payment.succeeded', pagamento({ product_id: 'prod_5j3iKMwnWInbK', line_items: [{ product_id: 'prod_5j3iKMwnWInbK' }] })), { id: 'msg_br' });
  confere('200 (a Whop não precisa insistir)', resposta.status === 200);
  confere('ignorado', evento('msg_br').status === 'ignored');
  confere('nenhum acesso nem cliente', banco.latam_access.length === 0 && banco.latam_customers.length === 0);
});

await cenario('11. Pagamento de outra empresa da Whop não libera', async () => {
  await enviar(aviso('payment.succeeded', pagamento({ account_id: 'biz_OUTRA' })), { id: 'msg_outra' });
  confere('ignorado', evento('msg_outra').status === 'ignored');
  confere('nenhum acesso', banco.latam_access.length === 0);
});

await cenario('12. Compra sem e-mail fica para conferir, e a nova tentativa resolve', async () => {
  const sem = pagamento({ customer_email: null });
  await enviar(aviso('payment.succeeded', sem), { id: 'msg_sem_email' });
  confere('needs_review', evento('msg_sem_email').status === 'needs_review');
  confere('nenhum acesso adivinhado', banco.latam_access.length === 0);
  await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_sem_email' });
  confere('a mesma mensagem, corrigida, é refeita', evento('msg_sem_email').status === 'processed');
});

await cenario('13. Reembolso e disputa ficam registrados, e o acesso fica', async () => {
  await enviar(aviso('payment.succeeded', pagamento()));
  await enviar(aviso('refund.created', { id: 'rf_1', status: 'succeeded', payment: pagamento() }), { id: 'msg_reembolso' });
  await enviar(aviso('dispute.created', { id: 'dspt_1', payment: pagamento() }), { id: 'msg_disputa' });
  confere('reembolso ignorado', evento('msg_reembolso').status === 'ignored');
  confere('disputa ignorada', evento('msg_disputa').status === 'ignored');
  confere('acesso continua ativo', acesso().status === 'active');
});

await cenario('14. Outros avisos e pagamento que não está de pé: nada muda', async () => {
  await enviar(aviso('membership.activated', { id: 'mem_1' }), { id: 'msg_outro' });
  await enviar(aviso('payment.succeeded', pagamento({ status: 'void' })), { id: 'msg_void' });
  confere('outro tipo: ignorado', evento('msg_outro').status === 'ignored');
  confere('pagamento anulado: ignorado', evento('msg_void').status === 'ignored');
  confere('nenhum acesso', banco.latam_access.length === 0);
});

await cenario('15. Falha passageira do banco não custa a venda', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_access' && method === 'POST', status: 503, vezes: 1 });
  const resposta = await enviar(aviso('payment.succeeded', pagamento()));
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('libera na segunda tentativa', acesso().status === 'active');
});

await cenario('16. Falha que não passa: 500 (a Whop tenta de novo) e fica o rastro', async () => {
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_access' && method === 'POST', status: 400 });
  const resposta = await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_falha' });
  confere('responde 500', resposta.status === 500, `veio ${resposta.status}`);
  confere('aviso marcado failed', evento('msg_falha').status === 'failed');
  limparFalhas();
  const denovo = await enviar(aviso('payment.succeeded', pagamento()), { id: 'msg_falha' });
  confere('a nova tentativa da Whop libera', denovo.status === 200 && acesso().status === 'active');
  confere('e o aviso vira processed', evento('msg_falha').status === 'processed');
});

await cenario('17. Nome que é e-mail não vira nome', async () => {
  await enviar(aviso('payment.succeeded', pagamento({ billing_address: { name: 'alguem@gmail.com', country: 'BR' } })));
  confere('nome fica em branco', cliente().name === undefined || cliente().name === '', String(cliente().name));
});

await cenario('18. Nenhuma tabela do Brasil é tocada', async () => {
  await enviar(aviso('payment.succeeded', pagamento()));
  await enviar(aviso('refund.created', { status: 'succeeded', payment: pagamento() }));
  const fora = [...tocadas].filter(tabela => !tabela.startsWith('latam_'));
  confere('só tabelas latam_', fora.length === 0, fora.join(', '));
});

fechar();
