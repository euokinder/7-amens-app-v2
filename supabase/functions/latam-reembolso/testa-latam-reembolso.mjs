// Teste do painel de reembolsos (ações admin_* da latam-reembolso, 18/11/2026)
// com o banco de mentira: nenhum banco de verdade é tocado.
// Rodar: "C:\Program Files\nodejs\node.exe" supabase/functions/latam-reembolso/testa-latam-reembolso.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { banco, tocadas, carregarFuncao, confere, cenario, fechar, rpcsDoTeste, forcarFalha } from '../../latam/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const api = await carregarFuncao(resolve(aqui, 'index.ts'), {
  SUPABASE_URL: 'https://lbaudlocfbjunnaoyrtz.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa',
  WHOP_NOVA_API_KEY: 'whop-falsa', DIGISTORE_LATAM_API_KEY: 'digi-latam-falsa', DIGISTORE_EN_API_KEY: 'digi-en-falsa',
  PAINEL_REEMBOLSO_SENHA: 'senha-do-teste',
});

// A Whop e a Digistore de mentira: tudo o que não é o banco passa por aqui.
const fetchDoBanco = globalThis.fetch;
const plataforma = { whop: [], digi: { 'digi-latam-falsa': [], 'digi-en-falsa': [] }, chamadas: [], whopFora: false, devolveuWhop: [], devolveuDigi: [] };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.hostname === 'api.whop.com') {
    plataforma.chamadas.push(`whop ${init.method || 'GET'} ${u.pathname}`);
    if (plataforma.whopFora) return new Response('{"error":{"message":"forbidden"}}', { status: 403 });
    if (init.headers?.Authorization !== 'Bearer whop-falsa') return new Response('{}', { status: 401 });
    const devolver = u.pathname.match(/^\/api\/v1\/payments\/(pay_[A-Za-z0-9]+)\/refund$/);
    if (devolver) {
      plataforma.devolveuWhop.push({ ref: devolver[1], idem: init.headers['Idempotency-Key'] });
      const p = plataforma.whop.find(x => x.id === devolver[1]);
      p.refunded_amount = { amount: p.total.amount };
      return new Response(JSON.stringify(p), { status: 200 });
    }
    const q = u.searchParams.get('query');
    return new Response(JSON.stringify({ data: plataforma.whop.filter(p => p.customer_email === q) }), { status: 200 });
  }
  if (u.hostname === 'www.digistore24.com') {
    const chave = init.headers?.['X-DS-API-KEY'];
    const funcao = u.pathname.split('/').pop();
    plataforma.chamadas.push(`digi ${funcao} ${chave}`);
    if (!(chave in plataforma.digi)) return new Response('{"result":"error","message":"Invalid api key"}', { status: 200 });
    if (funcao === 'listPurchasesOfEmail') {
      return new Response(JSON.stringify({ result: 'success', data: plataforma.digi[chave].filter(p => p.email === u.searchParams.get('email')) }), { status: 200 });
    }
    if (funcao === 'refundPurchase') {
      const p = plataforma.digi[chave].find(x => x.id === u.searchParams.get('purchase_id'));
      if (!p || p.status === 'refunded') return new Response('{"result":"error","message":"Refund not possible"}', { status: 200 });
      p.status = 'refunded';
      plataforma.devolveuDigi.push({ ref: p.id, operador: u.searchParams.get('operator') });
      return new Response('{"result":"success","data":{"modified":"Y","note":"The order has been refunded."}}', { status: 200 });
    }
  }
  return fetchDoBanco(url, init);
};
function zerarPlataformas() {
  plataforma.whop = [
    { id: 'pay_NovaFront001', status: 'paid', customer_email: 'maria@exemplo.com', total: { amount: '21.00', currency: 'usd' }, currency: 'usd',
      refunded_amount: { amount: '0' }, dispute_created_at: null, paid_at: new Date(Date.now() - 86_400_000).toISOString(),
      line_items: [{ product_title: '7 Amenes de la Madrugada' }], metadata: { kashpay_transaction_id: 'tx-0001' } },
    { id: 'pay_NovaDisputa1', status: 'paid', customer_email: 'maria@exemplo.com', total: { amount: '69.00', currency: 'usd' }, currency: 'usd',
      refunded_amount: { amount: '0' }, dispute_created_at: new Date().toISOString(), paid_at: new Date().toISOString(), line_items: [], metadata: {} },
    { id: 'pay_DeOutraPessoa', status: 'paid', customer_email: 'outra@exemplo.com', total: { amount: '21.00', currency: 'usd' }, currency: 'usd',
      refunded_amount: { amount: '0' }, paid_at: new Date().toISOString(), line_items: [], metadata: {} },
  ];
  plataforma.digi['digi-latam-falsa'] = [{ id: 'DIGI1234', email: 'maria@exemplo.com', amount: 69, currency: 'USD', status: 'completed', created_at: new Date().toISOString() }];
  plataforma.digi['digi-en-falsa'] = [];
  plataforma.chamadas = []; plataforma.whopFora = false; plataforma.devolveuWhop = []; plataforma.devolveuDigi = [];
}
zerarPlataformas();

const sha256 = valor => createHash('sha256').update(valor).digest('hex');
const TOKEN_ADMIN = 'a'.repeat(64);
const TOKEN_CLIENTE = 'b'.repeat(64);
const TOKEN_VENCIDO = 'c'.repeat(64);
const amanha = new Date(Date.now() + 86_400_000).toISOString();
const ontem = new Date(Date.now() - 86_400_000).toISOString();

async function chamar(action, corpo = {}, { token, origin = 'https://setemadrugadas.com.br', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': '200.1.2.3' };
  if (origin) headers.origin = origin;
  if (token) headers['x-latam-session'] = token;
  const resposta = await api(new Request('https://exemplo/latam-reembolso', {
    method, headers, body: method === 'POST' ? JSON.stringify({ action, ...corpo }) : undefined,
  }));
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

const COMPRAS = [
  { pedido: 'pay_AAAAAA111', origem: 'whop', produto: 'principal', nombre: '7 Amenes de la Madrugada', valor_cents: 2100, moneda: 'USD', pagado_en: ontem, devuelto: false, pedido_abierto: false },
  { pedido: 'kashpay:tx-0001', origem: 'kashpay', produto: 'arcangeles', nombre: 'Oraciones a los Santos Arcángeles', valor_cents: 6900, moneda: 'USD', pagado_en: ontem, devuelto: false, pedido_abierto: false },
];

function montar() {
  banco.latam_customers.push(
    { id: 'adm-1', email: 'equipe@exemplo.com', name: 'Equipe' },
    { id: 'cli-1', email: 'maria@exemplo.com', name: 'María' },
  );
  banco.latam_admins.push({ customer_id: 'adm-1' });
  banco.latam_sessions.push(
    { token_hash: sha256(TOKEN_ADMIN), customer_id: 'adm-1', expires_at: amanha },
    { token_hash: sha256(TOKEN_CLIENTE), customer_id: 'cli-1', expires_at: amanha },
    { token_hash: sha256(TOKEN_VENCIDO), customer_id: 'adm-1', expires_at: ontem },
  );
  banco.latam_refund_requests.push({
    id: '11111111-1111-4111-8111-111111111111', created_at: ontem, email: 'maria@exemplo.com', customer_id: 'cli-1',
    itens: [COMPRAS[0]], total_cents: 2100, moneda: 'USD', sin_compra: false, motivo: null, motivo_en: null,
    status: 'pendente', resuelto_en: null, nota: '', pais: 'MX', canal: 'pagina', valor_devolvido_cents: null, resuelto_por: null, atualizado_em: null,
  });
  rpcsDoTeste['rpc/latam_admin_reembolsos'] = async () => banco.latam_refund_requests.map(r => ({ ...r }));
  rpcsDoTeste['rpc/latam_reembolso_compras'] = async ({ p_email }) => (p_email === 'maria@exemplo.com' ? COMPRAS : []);
  rpcsDoTeste['rpc/latam_permite'] = async () => true;
}
const ID = '11111111-1111-4111-8111-111111111111';
const pedido = () => banco.latam_refund_requests.find(r => r.id === ID);
const acoes = () => banco.latam_admin_actions.map(a => a.action);

await cenario('Portão: só a equipe entra', async () => {
  montar();
  const opcoes = await chamar('', {}, { method: 'OPTIONS' });
  confere('o navegador pode mandar o cabeçalho da sessão', /x-latam-session/.test(opcoes.headers.get('access-control-allow-headers') || ''));
  confere('sem sessão: 401', (await chamar('admin_lista')).status === 401);
  confere('sessão inventada: 401', (await chamar('admin_lista', {}, { token: 'd'.repeat(64) })).status === 401);
  confere('sessão vencida: 401', (await chamar('admin_lista', {}, { token: TOKEN_VENCIDO })).status === 401);
  confere('cliente comum: 403', (await chamar('admin_lista', {}, { token: TOKEN_CLIENTE })).status === 403);
  confere('cliente comum não muda nada', (await chamar('admin_excluir', { id: ID }, { token: TOKEN_CLIENTE })).status === 403 && pedido());
  confere('origem estranha: 403', (await chamar('admin_lista', {}, { token: TOKEN_ADMIN, origin: 'https://golpe.com' })).status === 403);
  const lista = await chamar('admin_lista', {}, { token: TOKEN_ADMIN });
  confere('equipe vê a lista', lista.status === 200 && lista.corpo.pedidos.length === 1);
  confere('a lista diz quem está usando', lista.corpo.eu && lista.corpo.eu.email === 'equipe@exemplo.com');
  confere('ação desconhecida: 400', (await chamar('admin_qualquer', {}, { token: TOKEN_ADMIN })).status === 400);
});

await cenario('Marcar reembolsado, desistiu e voltar para pendente', async () => {
  montar();
  let r = await chamar('admin_atualizar', { id: ID, status: 'feito', valor_devolvido_cents: 2100 }, { token: TOKEN_ADMIN });
  confere('reembolsado: 200', r.status === 200);
  confere('grava o estado, quem e quando', pedido().status === 'feito' && pedido().resuelto_por === 'adm-1' && pedido().resuelto_en);
  confere('grava o valor devolvido', pedido().valor_devolvido_cents === 2100);
  confere('fica no histórico, com o antes e o depois', acoes().includes('refund_update')
    && banco.latam_admin_actions[0].details.de.status === 'pendente' && banco.latam_admin_actions[0].details.para.status === 'feito');
  r = await chamar('admin_atualizar', { id: ID, status: 'desistiu' }, { token: TOKEN_ADMIN });
  confere('desistiu: 200', r.status === 200 && pedido().status === 'desistiu');
  r = await chamar('admin_atualizar', { id: ID, status: 'pendente' }, { token: TOKEN_ADMIN });
  confere('voltar para pendente apaga quem resolveu', pedido().status === 'pendente' && pedido().resuelto_por === null && pedido().resuelto_en === null);
  confere('estado inventado: 400', (await chamar('admin_atualizar', { id: ID, status: 'pago' }, { token: TOKEN_ADMIN })).status === 400);
  confere('id inventado: 400', (await chamar('admin_atualizar', { id: 'abc', status: 'feito' }, { token: TOKEN_ADMIN })).status === 400);
  confere('pedido que não existe: 404', (await chamar('admin_atualizar', { id: '22222222-2222-4222-8222-222222222222', status: 'feito' }, { token: TOKEN_ADMIN })).status === 404);
});

await cenario('Editar', async () => {
  montar();
  const r = await chamar('admin_atualizar', { id: ID, nota: '  Devolvido na Whop  ', email: 'Maria.Nova@Exemplo.com', total_cents: 1500, motivo: 'otro' }, { token: TOKEN_ADMIN });
  confere('editar: 200', r.status === 200);
  confere('nota limpa', pedido().nota === 'Devolvido na Whop');
  confere('e-mail em minúsculas', pedido().email === 'maria.nova@exemplo.com');
  confere('valor e motivo', pedido().total_cents === 1500 && pedido().motivo === 'otro' && pedido().motivo_en);
  confere('editar não muda o estado', pedido().status === 'pendente' && pedido().resuelto_por === null);
  confere('marca a hora da edição', Boolean(pedido().atualizado_em));
  confere('e-mail ruim: 400', (await chamar('admin_atualizar', { id: ID, email: 'maria' }, { token: TOKEN_ADMIN })).status === 400);
  confere('valor negativo: 400', (await chamar('admin_atualizar', { id: ID, total_cents: -5 }, { token: TOKEN_ADMIN })).status === 400);
  confere('valor quebrado: 400', (await chamar('admin_atualizar', { id: ID, total_cents: 10.5 }, { token: TOKEN_ADMIN })).status === 400);
  confere('motivo inventado: 400', (await chamar('admin_atualizar', { id: ID, motivo: 'raiva' }, { token: TOKEN_ADMIN })).status === 400);
  const antes = banco.latam_admin_actions.length;
  await chamar('admin_atualizar', { id: ID }, { token: TOKEN_ADMIN });
  confere('sem mudança nenhuma, não grava histórico', banco.latam_admin_actions.length === antes);
  await chamar('admin_atualizar', { id: ID, valor_devolvido_cents: null }, { token: TOKEN_ADMIN });
  confere('o valor devolvido pode ser apagado', pedido().valor_devolvido_cents === null);
});

await cenario('Excluir apaga de vez, com a foto no histórico', async () => {
  montar();
  const r = await chamar('admin_excluir', { id: ID }, { token: TOKEN_ADMIN });
  confere('excluir: 200', r.status === 200);
  confere('o pedido sumiu', !pedido());
  const registro = banco.latam_admin_actions.find(a => a.action === 'refund_delete');
  confere('o histórico guarda o pedido inteiro e quem apagou', registro && registro.details.pedido.email === 'maria@exemplo.com' && registro.admin_customer_id === 'adm-1');
  confere('excluir de novo: 404', (await chamar('admin_excluir', { id: ID }, { token: TOKEN_ADMIN })).status === 404);
});

await cenario('Se o histórico falhar, o pedido NÃO é apagado', async () => {
  montar();
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_admin_actions' && method === 'POST', status: 400 });
  const r = await chamar('admin_excluir', { id: ID }, { token: TOKEN_ADMIN });
  confere('responde erro', r.status === 503);
  confere('o pedido continua lá', Boolean(pedido()));
});

await cenario('Registrar um pedido que chegou por e-mail ou WhatsApp', async () => {
  montar();
  const compras = await chamar('admin_compras', { email: 'maria@exemplo.con' }, { token: TOKEN_ADMIN });
  confere('acha as compras, mesmo com ".con"', compras.status === 200 && compras.corpo.email === 'maria@exemplo.com' && compras.corpo.compras.length === 2);
  confere('diz quem é a cliente', compras.corpo.cliente && compras.corpo.cliente.id === 'cli-1');
  const criado = await chamar('admin_criar', { email: 'maria@exemplo.com', pedidos: ['kashpay:tx-0001', 'pay_INVENTADO99'], nota: 'Pediu no WhatsApp' }, { token: TOKEN_ADMIN });
  confere('criar: 200', criado.status === 200 && criado.corpo.id);
  const novo = banco.latam_refund_requests.find(r => r.id === criado.corpo.id);
  confere('só entra o que é dela (o inventado fica de fora)', novo.itens.length === 1 && novo.itens[0].pedido === 'kashpay:tx-0001');
  confere('total, canal e nota', novo.total_cents === 6900 && novo.canal === 'manual' && novo.nota === 'Pediu no WhatsApp' && novo.customer_id === 'cli-1');
  confere('fica no histórico', acoes().includes('refund_create'));
  const sem = await chamar('admin_criar', { email: 'outra@exemplo.com', pedidos: [] }, { token: TOKEN_ADMIN });
  const semCompra = banco.latam_refund_requests.find(r => r.id === sem.corpo.id);
  confere('sem compra achada: grava igual, marcado "sem compra"', semCompra && semCompra.sin_compra === true && semCompra.total_cents === 0);
  confere('e-mail ruim: 400', (await chamar('admin_criar', { email: 'nada' }, { token: TOKEN_ADMIN })).status === 400);
});

await cenario('O caminho da cliente continua igual', async () => {
  montar();
  const r = await chamar('compras', { email: 'maria@exemplo.com' });
  confere('a cliente ainda vê as compras dela, sem sessão', r.status === 200 && r.corpo.compras.length === 2);
});

// ------------------------------------------- devolver pela API (18/11/2026)
const ITEM_KASHPAY = { pedido: 'kashpay:tx-0001', origem: 'kashpay', produto: 'principal', nombre: '7 Amenes de la Madrugada', valor_cents: 2100, moneda: 'USD', pagado_en: new Date(Date.now() - 86_400_000).toISOString() };
function montarComKashpay() {
  montar();
  zerarPlataformas();
  Object.assign(pedido(), { itens: [ITEM_KASHPAY, COMPRAS[0]], total_cents: 4200 });
  // O freio de verdade (latam_permite): conta em latam_login_limits.
  rpcsDoTeste['rpc/latam_permite'] = async ({ p_chave, p_maximo }) => {
    let l = banco.latam_login_limits.find(x => x.key === p_chave);
    if (!l) { l = { key: p_chave, attempts: 0, window_start: new Date().toISOString() }; banco.latam_login_limits.push(l); }
    l.attempts += 1;
    return l.attempts <= p_maximo;
  };
}

await cenario('Procurar a compra nas 3 contas (só lê)', async () => {
  montarComKashpay();
  confere('cliente comum não procura', (await chamar('admin_localizar', { id: ID }, { token: TOKEN_CLIENTE })).status === 403);
  const r = await chamar('admin_localizar', { id: ID }, { token: TOKEN_ADMIN });
  confere('procurar: 200', r.status === 200, JSON.stringify(r.corpo));
  const refs = r.corpo.achados.map(a => a.ref);
  confere('acha na Whop nova e na Digistore LATAM', refs.includes('pay_NovaFront001') && refs.includes('DIGI1234'));
  confere('não traz compra de outro e-mail', !refs.includes('pay_DeOutraPessoa'));
  const front = r.corpo.achados.find(a => a.ref === 'pay_NovaFront001');
  confere('marca a que bate com o pedido (mesma transação da KashPay)', front.bate === true && r.corpo.achados[0].ref === 'pay_NovaFront001');
  confere('valor e situação certos', front.valor_cents === 2100 && front.situacao === 'paga');
  confere('mostra a disputa', r.corpo.achados.find(a => a.ref === 'pay_NovaDisputa1').situacao === 'disputa');
  confere('avisa a cobrança da Whop antiga (sem chave)', r.corpo.whop_antiga.includes('pay_AAAAAA111'));
  confere('nada foi devolvido', !plataforma.chamadas.some(c => /refund/i.test(c)));
  plataforma.whopFora = true;
  const semWhop = await chamar('admin_localizar', { id: ID }, { token: TOKEN_ADMIN });
  confere('Whop fora do ar: as Digistores aparecem igual, com o aviso da Whop',
    semWhop.status === 200 && semWhop.corpo.achados.some(a => a.ref === 'DIGI1234') && semWhop.corpo.erros[0].conta === 'whop_nova' && /403/.test(semWhop.corpo.erros[0].erro));
});

await cenario('Devolver: a senha', async () => {
  montarComKashpay();
  const sem = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001' }, { token: TOKEN_ADMIN });
  confere('sem senha: 403', sem.status === 403);
  for (let i = 0; i < 4; i += 1) await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'errada' }, { token: TOKEN_ADMIN });
  const travou = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  confere('5 erradas: trava, mesmo com a senha certa', travou.status === 429);
  confere('travado, nada devolvido', plataforma.devolveuWhop.length === 0);
  banco.latam_login_limits[0].window_start = new Date(Date.now() - 16 * 60_000).toISOString();
  const depois = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  confere('depois de 15 min, a senha certa volta a valer', depois.status === 200, JSON.stringify(depois.corpo));
});

await cenario('Devolver na Whop nova', async () => {
  montarComKashpay();
  const r = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  confere('devolver: 200', r.status === 200, JSON.stringify(r.corpo));
  confere('chamou a devolução da Whop uma vez, com chave contra clique duplo', plataforma.devolveuWhop.length === 1 && plataforma.devolveuWhop[0].idem === `painel-${ID}-pay_NovaFront001`);
  confere('o pedido virou Reembolsado, com o valor e quem fez', pedido().status === 'feito' && pedido().valor_devolvido_cents === 2100 && pedido().resuelto_por === 'adm-1');
  confere('a anotação diz onde foi devolvido', /Whop nova pay_NovaFront001/.test(pedido().nota));
  confere('fica no registro de devoluções', banco.latam_refund_api_log.length === 1 && banco.latam_refund_api_log[0].ok === true);
  confere('fica no histórico', acoes().includes('refund_api'));
  const deNovo = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  confere('devolver de novo: recusa (já devolvida), sem chamar a Whop', deNovo.status === 409 && plataforma.devolveuWhop.length === 1);
});

await cenario('Devolver na Digistore soma ao que já foi devolvido', async () => {
  montarComKashpay();
  await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  const r = await chamar('admin_reembolsar', { id: ID, conta: 'digistore_latam', ref: 'DIGI1234', senha: 'senha-do-teste' }, { token: TOKEN_ADMIN });
  confere('devolver na Digistore: 200', r.status === 200, JSON.stringify(r.corpo));
  confere('usou a chave da conta LATAM e deixou o e-mail de quem fez', plataforma.devolveuDigi[0].ref === 'DIGI1234' && plataforma.devolveuDigi[0].operador === 'equipe@exemplo.com');
  confere('o valor devolvido soma as duas', pedido().valor_devolvido_cents === 2100 + 6900);
  confere('as duas ficam no registro de devoluções', banco.latam_refund_api_log.length === 2 && banco.latam_refund_api_log.every(l => l.ok));
});

await cenario('Devolver: o que o painel NUNCA faz', async () => {
  montarComKashpay();
  const senha = 'senha-do-teste';
  confere('compra de outra pessoa: 404', (await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_DeOutraPessoa', senha }, { token: TOKEN_ADMIN })).status === 404);
  confere('compra com disputa: 409', (await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaDisputa1', senha }, { token: TOKEN_ADMIN })).status === 409);
  confere('compra da Digistore na conta errada: 404', (await chamar('admin_reembolsar', { id: ID, conta: 'digistore_en', ref: 'DIGI1234', senha }, { token: TOKEN_ADMIN })).status === 404);
  confere('conta inventada: 400', (await chamar('admin_reembolsar', { id: ID, conta: 'paypal', ref: 'DIGI1234', senha }, { token: TOKEN_ADMIN })).status === 400);
  confere('cliente comum: 403', (await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha }, { token: TOKEN_CLIENTE })).status === 403);
  confere('nada foi devolvido', plataforma.devolveuWhop.length === 0 && plataforma.devolveuDigi.length === 0);
  confere('o pedido continua pendente', pedido().status === 'pendente');
  plataforma.whopFora = true;
  const fora = await chamar('admin_reembolsar', { id: ID, conta: 'whop_nova', ref: 'pay_NovaFront001', senha }, { token: TOKEN_ADMIN });
  confere('Whop fora do ar: não devolve e explica', fora.status === 502 && /Não deu para conferir/.test(fora.corpo.error));
});

await cenario('Nenhuma tabela do Brasil é tocada', async () => {
  montar();
  await chamar('admin_lista', {}, { token: TOKEN_ADMIN });
  await chamar('admin_atualizar', { id: ID, status: 'feito' }, { token: TOKEN_ADMIN });
  await chamar('admin_excluir', { id: ID }, { token: TOKEN_ADMIN });
  const fora = [...tocadas].filter(t => !t.startsWith('latam_') && !t.startsWith('rpc/latam_'));
  confere('só latam_', fora.length === 0, fora.join(', '));
});

fechar();
