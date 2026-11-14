// Teste local da en-api (o app em inglês): não toca em banco nenhum.
//
// Sobe a função num banco de mentira e confere o login pelo e-mail, o link de
// entrada, a sessão, a trava de uma oração por dia (no fuso dela) e o "I
// prayed this prayer". Confere também que as mensagens que a cliente lê são em
// inglês, que a compra é lida só da visão en_pedidos_pagos (vazia até o
// checkout) e que nenhuma tabela do Brasil nem da LATAM (latam_*) é tocada.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/en-api/testa-en-api.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, travarFreio, carregarFuncao, confere, cenario, fechar,
  oferecer, pedidosDeOferta, comprasFalsas, tirarFuncaoDeExtras, rpcsDoTeste, tentativasDeGravarVisao,
} from '../../en/testes/banco-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = resolve(aqui, 'index.ts');
const api = await carregarFuncao(alvo, { SUPABASE_URL: 'https://lbaudlocfbjunnaoyrtz.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa' });

const sha256 = valor => createHash('sha256').update(valor).digest('hex');
const hojeEm = zona => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
const diasAntes = (zona, n) => {
  const [a, m, d] = hojeEm(zona).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10);
};
const daquiA = dias => new Date(Date.now() + dias * 86_400_000).toISOString();

async function chamar(action, corpo = {}, { token, origin = 'https://setemadrugadas.com.br', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': '200.1.2.3' };
  if (origin) headers.origin = origin;
  if (token) headers['x-en-session'] = token;
  const resposta = await api(new Request('https://exemplo/en-api', {
    method, headers, body: method === 'POST' ? JSON.stringify({ action, ...corpo }) : undefined,
  }));
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

function cliente({ id = 'c1', email = 'maria@ejemplo.com', name = 'María López', timezone = null, first_access_on = null, acesso = { status: 'active', expires_at: daquiA(300) } } = {}) {
  banco.en_customers.push({ id, email, name, country: 'US', timezone, first_access_on });
  if (acesso) banco.en_access.push({ customer_id: id, product: 'app', source: 'checkout', ...acesso });
}
// Uma compra na visão en_pedidos_pagos (02-compras.sql), como o checkout vai
// deixar quando existir. Hoje a visão de verdade vem vazia.
const compra = (campos = {}) => banco.en_pedidos_pagos.push({
  pedido: `pay_${Math.random().toString(16).slice(2, 12)}`, origem: 'checkout', customer_id: null, email: null, produtos: ['principal'],
  nome_produto: null, valor_cents: 2700, moneda: 'USD', pagado_en: new Date().toISOString(), devuelto: false,
  final_cartao: null, nome_cartao: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, ...campos,
});
// Mensagem em inglês: sem acento nem pontuação do espanhol, e sem as palavras
// que o espanhol usava.
const emIngles = texto => typeof texto === 'string' && texto.length > 0
  && !/[áéíóúñ¿¡]/i.test(texto)
  // o endereço do e-mail de suporte (provisório desde 14/11/2026, o da LATAM) não conta como espanhol
  && !/\b(correo|compra|acceso|intentos|enlace|soporte|Escr[ií]benos)\b/i.test(texto.replace('soporte@pkscale.com', ''));
async function entrar(email = 'maria@ejemplo.com', tz = 'America/Bogota') {
  const { corpo } = await chamar('login', { email, tz });
  return corpo.token;
}

console.log(`Testando: ${alvo}`);

await cenario('1. Quem pode chamar (CORS)', async () => {
  const site = await chamar('', {}, { method: 'OPTIONS' });
  confere('o site: 204', site.status === 204);
  confere('devolve a origem do site', site.headers.get('access-control-allow-origin') === 'https://setemadrugadas.com.br');
  confere('aceita o cabeçalho de sessão do app em inglês', (site.headers.get('access-control-allow-headers') || '').includes('x-en-session'));
  const local = await chamar('', {}, { method: 'OPTIONS', origin: 'http://localhost:3000' });
  confere('o teste local: 204', local.status === 204);
  const deploy = await chamar('', {}, { method: 'OPTIONS', origin: 'https://6aece0118531e61c70fce54c--7madrugadas.netlify.app' });
  confere('o link permanente de um deploy: 204', deploy.status === 204);
  const estranho = await chamar('', {}, { method: 'OPTIONS', origin: 'https://site-estranho.com' });
  confere('site estranho: 403, em inglês', estranho.status === 403 && estranho.corpo.error === 'Origin not allowed.', estranho.corpo?.error);
});

await cenario('2. Login que não entra, com a explicação em inglês', async () => {
  const ruim = await chamar('login', { email: 'maria@' });
  confere('e-mail incompleto: 400, em inglês', ruim.status === 400 && ruim.corpo.error.includes('email') && emIngles(ruim.corpo.error), ruim.corpo?.error);
  const ninguem = await chamar('login', { email: 'nadie@ejemplo.com' });
  confere('e-mail sem compra: 403, em inglês', ninguem.status === 403 && ninguem.corpo.error.includes('could not find') && emIngles(ninguem.corpo.error), ninguem.corpo?.error);
  confere('e-mail sem compra: a tela segue para o resgate (siguiente: nombre)', ninguem.corpo.siguiente === 'nombre');
  cliente({ id: 'sem', email: 'sin.acceso@ejemplo.com', acesso: null });
  const sem = await chamar('login', { email: 'sin.acceso@ejemplo.com' });
  confere('cliente sem acesso: 403 e segue para o resgate', sem.status === 403 && sem.corpo.siguiente === 'nombre');
  cliente({ id: 'tirada', email: 'retirada@ejemplo.com', acesso: { status: 'revoked', expires_at: daquiA(100) } });
  const tirada = await chamar('login', { email: 'retirada@ejemplo.com' });
  confere('acesso retirado: 403 e segue para o resgate (como no espanhol)', tirada.status === 403 && tirada.corpo.siguiente === 'nombre');
  cliente({ id: 'vencida', email: 'vencida@ejemplo.com', timezone: 'America/New_York', acesso: { status: 'active', expires_at: '2026-01-15T18:00:00.000Z' } });
  const vencida = await chamar('login', { email: 'vencida@ejemplo.com' });
  confere('acesso vencido: 403 com a data por extenso (EUA)', vencida.status === 403 && vencida.corpo.error.includes('January 15, 2026') && emIngles(vencida.corpo.error), vencida.corpo?.error);
  confere('acesso vencido: SEM siguiente (a tela mostra a data, não o resgate)', vencida.corpo.siguiente === undefined);
  // Desde 14/11/2026 o e-mail de suporte é, provisoriamente, o da LATAM (SUPPORT_EMAIL);
  // as mensagens do servidor nunca falam em WhatsApp.
  confere('acesso vencido: sem WhatsApp na mensagem', !/whatsapp/i.test(vencida.corpo.error), vencida.corpo.error);
  confere('nenhuma sessão criada', banco.en_sessions.length === 0);
});

await cenario('3. Login certo: sessão, primeiro acesso e o dia de hoje no fuso dela', async () => {
  cliente();
  const { status, corpo } = await chamar('login', { email: '  MARIA@Ejemplo.com ', tz: 'America/Bogota' });
  confere('200', status === 200, `veio ${status}`);
  confere('código de sessão de 64 letras', /^[a-f0-9]{64}$/.test(corpo.token || ''));
  confere('o banco guarda só a impressão digital', banco.en_sessions[0]?.token_hash === sha256(corpo.token) && banco.en_sessions[0]?.token_hash !== corpo.token);
  confere('sessão de 1 ano (era 90 dias até 10/11/2026)', Math.abs(Date.parse(banco.en_sessions[0].expires_at) - Date.parse(daquiA(365))) < 60_000);
  confere('saúda pelo primeiro nome', corpo.cliente?.nombre === 'María');
  confere('fuso do celular dela', corpo.zona === 'America/Bogota');
  confere('hoje no fuso dela', corpo.hoy === hojeEm('America/Bogota'));
  confere('primeiro dia: abre o Start Here e o First Amen', corpo.abierto === 1);
  confere('nada marcado ainda', Array.isArray(corpo.completados) && corpo.completados.length === 0);
  confere('mostra até quando vale o acesso, com o mês por extenso ("November 5, 2027")', /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(corpo.acceso_hasta || ''), corpo.acceso_hasta);
  confere('grava o primeiro acesso e o fuso', banco.en_customers[0].first_access_on === corpo.hoy && banco.en_customers[0].timezone === 'America/Bogota');
  confere('grava o dia de visita', banco.en_visit_days.length === 1 && banco.en_visit_days[0].visited_on === corpo.hoy);
  const campos = Object.keys(corpo).sort().join(',');
  confere('não devolve nada além do retrato (do pop-up e dos extras)', campos === 'abierto,acceso_hasta,cantico,cliente,completados,extras,hoy,oferta,token,zona', campos);
});

await cenario('4. Fuso inválido vira Nova York; fuso já gravado não muda', async () => {
  cliente({ id: 'nova', email: 'nova@ejemplo.com' });
  const nova = await chamar('login', { email: 'nova@ejemplo.com', tz: 'Mexico City; DROP' });
  confere('fuso estranho: America/New_York', nova.corpo.zona === 'America/New_York');
  cliente({ id: 'antiga', email: 'antigua@ejemplo.com', timezone: 'America/Lima', first_access_on: diasAntes('America/Lima', 1) });
  const antiga = await chamar('login', { email: 'antigua@ejemplo.com', tz: 'Asia/Tokyo' });
  confere('quem já tem fuso fica com o dela', antiga.corpo.zona === 'America/Lima');
  confere('a âncora não muda', banco.en_customers.find(c => c.id === 'antiga').first_access_on === diasAntes('America/Lima', 1));
});

await cenario('5. Muitas tentativas seguidas: 429', async () => {
  cliente();
  travarFreio();
  const resposta = await chamar('login', { email: 'maria@ejemplo.com' });
  confere('429 com explicação em inglês', resposta.status === 429 && resposta.corpo.error.includes('attempts') && emIngles(resposta.corpo.error), resposta.corpo?.error);
});

await cenario('6. A trava: uma oração por dia, contando do primeiro acesso, no fuso dela', async () => {
  cliente({ id: 'tres', email: 'tres@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 3) });
  confere('3 dias depois do primeiro acesso: abre até o Fourth Amen', (await chamar('login', { email: 'tres@ejemplo.com' })).corpo.abierto === 4);
  cliente({ id: 'vinte', email: 'veinte@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 20) });
  confere('passou da semana: as 7 abertas, nunca mais que 7', (await chamar('login', { email: 'veinte@ejemplo.com' })).corpo.abierto === 7);
  cliente({ id: 'marcou', email: 'marco@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 0) });
  banco.en_progress.push({ customer_id: 'marcou', day: 5 });
  confere('dia já marcado nunca volta a trancar', (await chamar('login', { email: 'marco@ejemplo.com' })).corpo.abierto === 5);
});

await cenario('7. Sessão: abre a página, confere e devolve a jornada', async () => {
  cliente();
  confere('sem código: 401', (await chamar('session')).status === 401);
  confere('código inventado: 401', (await chamar('session', {}, { token: 'a'.repeat(64) })).status === 401);
  const token = await entrar();
  const primeira = await chamar('session', {}, { token });
  confere('200 com a jornada', primeira.status === 200 && primeira.corpo.abierto === 1);
  confere('sem novo código de sessão', primeira.corpo.token === undefined);
  await chamar('session', {}, { token });
  confere('várias visitas no mesmo dia contam um dia só', banco.en_visit_days.length === 1);
  banco.en_sessions[0].expires_at = daquiA(-1);
  confere('sessão vencida: 401', (await chamar('session', {}, { token })).status === 401);
});

await cenario('8. "I prayed this prayer": marcar, desmarcar, e o dia fechado', async () => {
  cliente();
  const token = await entrar();
  const marcou = await chamar('progress', { day: 1, done: true }, { token });
  confere('marca o First Amen', marcou.status === 200 && marcou.corpo.completados.join() === '1');
  const intro = await chamar('progress', { day: 0, done: true }, { token });
  confere('marca o Start Here', intro.corpo.completados.join() === '0,1');
  const fechado = await chamar('progress', { day: 4, done: true }, { token });
  confere('dia ainda fechado: 409 com explicação em inglês', fechado.status === 409 && fechado.corpo.error.includes('not open yet') && emIngles(fechado.corpo.error), fechado.corpo?.error);
  confere('e nada gravado para o dia fechado', !banco.en_progress.some(p => p.day === 4));
  const repetiu = await chamar('progress', { day: 1, done: true }, { token });
  confere('marcar de novo não duplica', repetiu.status === 200 && banco.en_progress.length === 2);
  const desmarcou = await chamar('progress', { day: 1, done: false }, { token });
  confere('desmarca', desmarcou.corpo.completados.join() === '0');
  confere('dia 8 não existe: 400', (await chamar('progress', { day: 8, done: true }, { token })).status === 400);
  confere('"done" que não é sim/não: 400', (await chamar('progress', { day: 1, done: 'si' }, { token })).status === 400);
  const desconhecida = await chamar('borrar_todo', {}, { token });
  confere('ação desconhecida: 400 "Invalid request." (a /en-login reconhece por este texto)', desconhecida.status === 400 && desconhecida.corpo.error === 'Invalid request.', desconhecida.corpo?.error);
  confere('ação desconhecida sem sessão: 401', (await chamar('borrar_todo')).status === 401);
});

await cenario('9. Acesso retirado depois do login: a sessão para de abrir', async () => {
  cliente();
  const token = await entrar();
  banco.en_access[0].status = 'revoked';
  confere('403', (await chamar('session', {}, { token })).status === 403);
});

await cenario('10. Sair encerra a sessão', async () => {
  cliente();
  const token = await entrar();
  confere('logout: 200', (await chamar('logout', {}, { token })).status === 200);
  confere('a sessão some do banco', banco.en_sessions.length === 0);
  confere('o código antigo não abre mais: 401', (await chamar('session', {}, { token })).status === 401);
});

await cenario('11. Link de entrada (para quem não consegue digitar o e-mail)', async () => {
  cliente();
  banco.en_entry_links.push({ customer_id: 'c1', token: 'Abc123Def456Ghi7', uses: 0, last_used_at: null });
  confere('código incompleto: 400', (await chamar('entry', { code: 'Abc123' })).status === 400);
  confere('código que não existe: 404', (await chamar('entry', { code: 'Zzz999Yyy888Xxx7' })).status === 404);
  const certo = await chamar('entry', { code: 'Abc123Def456Ghi7', tz: 'America/Santiago' });
  confere('código certo: entra', certo.status === 200 && /^[a-f0-9]{64}$/.test(certo.corpo.token || ''));
  confere('conta o uso do link', banco.en_entry_links[0].uses === 1 && banco.en_entry_links[0].last_used_at);
  confere('grava o fuso do celular dela', banco.en_customers[0].timezone === 'America/Santiago');
  banco.en_access[0].status = 'revoked';
  confere('sem acesso ativo, o link não abre', (await chamar('entry', { code: 'Abc123Def456Ghi7' })).status === 403);
});

await cenario('12. Falha passageira do banco não derruba; falha de verdade avisa em inglês', async () => {
  cliente();
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'en_customers' && method === 'GET', status: 503, vezes: 1 });
  confere('falha passageira: entra mesmo assim', (await chamar('login', { email: 'maria@ejemplo.com' })).status === 200);
  forcarFalha({ quando: ({ tabela }) => tabela === 'en_customers', status: 500 });
  const caiu = await chamar('login', { email: 'maria@ejemplo.com' });
  confere('banco fora: 503 com explicação em inglês', caiu.status === 503 && caiu.corpo.error.includes('could not connect') && emIngles(caiu.corpo.error), caiu.corpo?.error);
});

await cenario('13. Dia além do calendário que ela já tinha marcado continua marcável', async () => {
  cliente({ timezone: 'America/Lima', first_access_on: diasAntes('America/Lima', 0) });
  banco.en_progress.push({ customer_id: 'c1', day: 5 });
  const token = await entrar();
  const remarcar = await chamar('progress', { day: 5, done: true }, { token });
  confere('remarcar o dia 5 (já marcado): 200', remarcar.status === 200 && remarcar.corpo.abierto === 5, `veio ${remarcar.status}`);
  confere('o dia 6 continua fechado: 409', (await chamar('progress', { day: 6, done: true }, { token })).status === 409);
});

await cenario('14. Nenhuma tabela do Brasil nem da LATAM é tocada', async () => {
  cliente();
  banco.en_entry_links.push({ customer_id: 'c1', token: 'Abc123Def456Ghi7', uses: 0 });
  const token = await entrar();
  await chamar('session', {}, { token });
  await chamar('progress', { day: 1, done: true }, { token });
  comprasFalsas.c1 = ['cantico'];
  await chamar('progress', { day: 1, done: true, journey: 'cantico' }, { token });
  await chamar('entry', { code: 'Abc123Def456Ghi7' });
  await chamar('logout', {}, { token });
  await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'shown' }, { token: await entrar() });
  // O painel também (a ficha lê a visão das compras).
  cliente({ id: '44444444-4444-4444-8444-444444444444', email: 'jefa@ejemplo.com', acesso: { status: 'active', expires_at: null } });
  banco.en_admins.push({ customer_id: '44444444-4444-4444-8444-444444444444' });
  const admin = await entrar('jefa@ejemplo.com');
  await chamar('admin_dashboard', {}, { token: admin });
  await chamar('admin_customer_detail', { customer_id: '44444444-4444-4444-8444-444444444444' }, { token: admin });
  await chamar('admin_update_email', { customer_id: '44444444-4444-4444-8444-444444444444', email: 'jefa2@ejemplo.com' }, { token: admin });
  const fora = [...tocadas].filter(tabela => !tabela.startsWith('en_') && !tabela.startsWith('rpc/en_'));
  confere('só objetos en_ (tabelas, a visão e as funções rpc/en_*)', fora.length === 0, fora.join(', '));
  confere('nenhum objeto latam_ nem de pagamento (whop, kashpay, digistore)', ![...tocadas].some(t => /latam|whop|kashpay|digistore/.test(t)), [...tocadas].join(', '));
  confere('a visão das compras nunca é gravada', tentativasDeGravarVisao.length === 0, tentativasDeGravarVisao.join(', '));
});

const POPUP = {
  campaign_key: 'en_arcangeles_novas_1', eyebrow: '🚨 Please read carefully!\nBefore your first early morning',
  headline: 'The enemy does not need to stop your prayer.', body: 'Line 1\nLine 2',
  cta_label: 'Understand before I begin', dismiss_label: "I'd rather take the risk alone",
  target_url: 'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en', offer_type: 'product',
};

await cenario('15. O pop-up vem junto com o retrato, ao abrir a página', async () => {
  cliente();
  oferecer(POPUP);
  const login = await chamar('login', { email: 'maria@ejemplo.com', tz: 'America/Bogota' });
  confere('no login: vem a oferta', login.corpo.oferta?.campaign_key === 'en_arcangeles_novas_1', JSON.stringify(login.corpo.oferta));
  confere('o banco recebe o fuso dela', pedidosDeOferta[0]?.p_zone === 'America/Bogota' && pedidosDeOferta[0]?.p_customer_id === 'c1', JSON.stringify(pedidosDeOferta[0]));
  const token = login.corpo.token;
  const sessao = await chamar('session', {}, { token });
  confere('ao abrir a página: vem a oferta, com o texto inteiro', sessao.corpo.oferta?.headline === POPUP.headline && sessao.corpo.oferta?.body === POPUP.body && sessao.corpo.oferta?.dismiss_label === POPUP.dismiss_label);
  const antes = pedidosDeOferta.length;
  const marcar = await chamar('progress', { day: 1, done: true }, { token });
  confere('ao marcar um dia: sem oferta e sem perguntar ao banco', marcar.status === 200 && marcar.corpo.oferta === null && pedidosDeOferta.length === antes);
  oferecer(null);
  confere('sem pop-up para ela: oferta null', (await chamar('session', {}, { token })).corpo.oferta === null);
  oferecer({ ...POPUP, campaign_key: 'X; drop' });
  confere('nome de campanha estranho: descartado', (await chamar('session', {}, { token })).corpo.oferta === null);
});

await cenario('16. Pop-up com defeito nunca derruba o app', async () => {
  cliente();
  const token = await entrar();
  forcarFalha({ quando: ({ tabela }) => tabela === 'rpc/en_claim_offer', status: 404, vezes: 1 });
  const semFuncao = await chamar('session', {}, { token });
  confere('função ainda não criada no banco (404): 200 e oferta null', semFuncao.status === 200 && semFuncao.corpo.oferta === null && semFuncao.corpo.abierto === 1, `veio ${semFuncao.status}`);
  forcarFalha({ quando: ({ tabela }) => tabela === 'rpc/en_claim_offer', status: 500, vezes: 3 });
  const erro = await chamar('session', {}, { token });
  confere('erro no banco (500, três vezes): 200 e oferta null', erro.status === 200 && erro.corpo.oferta === null, `veio ${erro.status}`);
});

await cenario('17. "oferta": apareceu, tocou, fechou', async () => {
  cliente();
  const token = await entrar();
  banco.en_offer_events.push({ customer_id: 'c1', campaign_key: 'en_arcangeles_novas_1', claimed_at: new Date().toISOString(), shown_at: null, clicked_at: null, dismissed_at: null });
  banco.en_offer_events.push({ customer_id: 'c2', campaign_key: 'en_arcangeles_novas_1', claimed_at: new Date().toISOString(), shown_at: null, clicked_at: null, dismissed_at: null });
  const mostrou = await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'shown' }, { token });
  const dela = banco.en_offer_events.find(l => l.customer_id === 'c1');
  const outra = banco.en_offer_events.find(l => l.customer_id === 'c2');
  confere('apareceu: 200 e a hora gravada', mostrou.status === 200 && Boolean(dela.shown_at));
  confere('a linha de outra cliente não muda', outra.shown_at === null);
  dela.shown_at = '2026-01-01T00:00:00.000Z';
  await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'shown' }, { token });
  confere('a segunda vez não muda a hora da primeira', dela.shown_at === '2026-01-01T00:00:00.000Z', dela.shown_at);
  await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'clicked' }, { token });
  confere('tocou: hora gravada', Boolean(dela.clicked_at));
  confere('evento inventado: 400', (await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'comprou' }, { token })).status === 400);
  confere('campanha com nome estranho: 400', (await chamar('oferta', { campaign_key: 'x&shown_at=is.null', event: 'shown' }, { token })).status === 400);
  confere('sem sessão: 401', (await chamar('oferta', { campaign_key: 'en_arcangeles_novas_1', event: 'shown' })).status === 401);
});

// ------------------------------------------------------------ o painel
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const CLIENTE_ID = '22222222-2222-4222-8222-222222222222';
function cenarioDoPainel() {
  cliente({ id: ADMIN_ID, email: 'admin@ejemplo.com', name: 'Ana Admin', acesso: { status: 'active', expires_at: null } });
  cliente({ id: CLIENTE_ID, email: 'maria@ejemplo.com', name: 'María López' });
  banco.en_admins.push({ customer_id: ADMIN_ID });
}

await cenario('18. Painel: só quem está em en_admins', async () => {
  cenarioDoPainel();
  const naoAdmin = await entrar('maria@ejemplo.com');
  const recusa = await chamar('admin_dashboard', {}, { token: naoAdmin });
  confere('cliente comum: 403', recusa.status === 403, `veio ${recusa.status}`);
  confere('sem sessão: 401', (await chamar('admin_dashboard')).status === 401);
  const token = await entrar('admin@ejemplo.com');
  const painel = await chamar('admin_dashboard', {}, { token });
  confere('administradora: 200 com a lista', painel.status === 200 && Array.isArray(painel.corpo.customers) && painel.corpo.customers.length === 2, `veio ${painel.status}`);
  confere('ação de painel inventada: 400', (await chamar('admin_apagar_tudo', {}, { token })).status === 400);
});

await cenario('19. Painel: liberar, revogar e liberar e-mail novo', async () => {
  cenarioDoPainel();
  const token = await entrar('admin@ejemplo.com');
  await chamar('admin_revoke_access', { customer_id: CLIENTE_ID }, { token });
  const dela = () => banco.en_access.find(a => a.customer_id === CLIENTE_ID);
  confere('revogar: status revoked', dela().status === 'revoked');
  await chamar('admin_grant_access', { customer_id: CLIENTE_ID }, { token });
  confere('liberar de novo: active, sem perder o prazo maior', dela().status === 'active' && Date.parse(dela().expires_at) > Date.now() + 299 * 86_400_000);
  const nova = await chamar('admin_grant_access', { email: ' Nueva@Ejemplo.com ' }, { token });
  const criada = banco.en_customers.find(c => c.email === 'nueva@ejemplo.com');
  const acesso = criada && banco.en_access.find(a => a.customer_id === criada.id);
  confere('e-mail novo: cria a cliente em minúsculas', nova.status === 200 && Boolean(criada));
  confere('e-mail novo: acesso manual por ~12 meses', acesso && acesso.source === 'manual' && acesso.status === 'active'
    && Math.abs(Date.parse(acesso.expires_at) - (Date.now() + 365 * 86_400_000)) < 60_000);
  confere('revogar quem não existe: 404', (await chamar('admin_revoke_access', { email: 'nadie@ejemplo.com' }, { token })).status === 404);
  confere('histórico: 3 ações com quem fez', banco.en_admin_actions.length === 3 && banco.en_admin_actions.every(a => a.admin_customer_id === ADMIN_ID));
});

await cenario('20. Painel: corrigir e-mail', async () => {
  cenarioDoPainel();
  cliente({ id: '33333333-3333-4333-8333-333333333333', email: 'ocupado@ejemplo.com' });
  compra({ pedido: 'pay_w1', customer_id: CLIENTE_ID, email: 'maria@ejemplo.com' });
  const sessaoDela = await entrar('maria@ejemplo.com');
  const token = await entrar('admin@ejemplo.com');
  confere('e-mail de outra cliente: 409', (await chamar('admin_update_email', { customer_id: CLIENTE_ID, email: 'ocupado@ejemplo.com' }, { token })).status === 409);
  const troca = await chamar('admin_update_email', { customer_id: CLIENTE_ID, email: 'maria.nueva@ejemplo.com' }, { token });
  confere('troca: 200 e o e-mail novo gravado', troca.status === 200 && banco.en_customers.find(c => c.id === CLIENTE_ID).email === 'maria.nueva@ejemplo.com');
  confere('a visão das compras não é gravada (é só leitura)', tentativasDeGravarVisao.length === 0, tentativasDeGravarVisao.join(', '));
  const ficha = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  confere('a compra continua na ficha dela (achada pela cliente, não pelo e-mail)', ficha.corpo.payments?.length === 1 && ficha.corpo.payments[0].tx === 'pay_w1', JSON.stringify(ficha.corpo.payments));
  confere('a sessão dela cai (o e-mail é o login)', (await chamar('session', {}, { token: sessaoDela })).status === 401);
  confere('a da administradora continua', (await chamar('session', {}, { token })).status === 200);
});

await cenario('21. Painel: link de entrada', async () => {
  cenarioDoPainel();
  const token = await entrar('admin@ejemplo.com');
  const primeiro = await chamar('admin_entry_link', { customer_id: CLIENTE_ID }, { token });
  const codigo = primeiro.corpo.entry_link?.token;
  confere('cria um código de 16 letras e números', /^[A-Za-z0-9]{16}$/.test(codigo || ''), codigo);
  const deNovo = await chamar('admin_entry_link', { customer_id: CLIENTE_ID }, { token });
  confere('pedir de novo devolve o MESMO link', deNovo.corpo.entry_link?.token === codigo);
  const trocado = await chamar('admin_entry_link', { customer_id: CLIENTE_ID, renew: true }, { token });
  confere('"Trocar link" sorteia outro', trocado.corpo.entry_link?.token && trocado.corpo.entry_link.token !== codigo);
  confere('o link antigo para de abrir', (await chamar('entry', { code: codigo })).status === 404);
  confere('o novo abre o app dela', (await chamar('entry', { code: trocado.corpo.entry_link.token })).corpo?.cliente?.email === 'maria@ejemplo.com');
});

// ------------------------------------------------- os extras (07/11/2026)
await cenario('22. Extras no retrato: compra, nada, e banco sem a função', async () => {
  cliente();
  const token = await entrar();
  const nada = await chamar('session', {}, { token });
  confere('sem compra de extra: extras vazio', Array.isArray(nada.corpo.extras) && nada.corpo.extras.length === 0, JSON.stringify(nada.corpo.extras));
  confere('o Cântico vem com o calendário (1º acesso hoje = dia 1)', nada.corpo.cantico?.abierto === 1 && nada.corpo.cantico.completados.length === 0, JSON.stringify(nada.corpo.cantico));
  comprasFalsas.c1 = ['arcangeles'];
  const comprou = await chamar('session', {}, { token });
  confere('comprou os Arcángeles: extras = [arcangeles]', JSON.stringify(comprou.corpo.extras) === '["arcangeles"]', JSON.stringify(comprou.corpo.extras));
  tirarFuncaoDeExtras();
  const semFuncao = await chamar('session', {}, { token });
  confere('banco sem en_extras: a jornada continua (200)', semFuncao.status === 200 && semFuncao.corpo.abierto === 1);
  confere('banco sem en_extras: extras = null (a tela abre os dois)', semFuncao.corpo.extras === null);
});

await cenario('23. Cântico: marcar o dia, trava e dono', async () => {
  cliente({ timezone: 'America/Bogota', first_access_on: diasAntes('America/Bogota', 2) });
  const token = await entrar();
  const semCantico = await chamar('progress', { day: 1, done: true, journey: 'cantico' }, { token });
  confere('sem o Cântico: 409 com a explicação', semCantico.status === 409 && semCantico.corpo.error.includes('access'), semCantico.corpo?.error);
  confere('a recusa traz o retrato junto (a tela guarda)', semCantico.corpo.abierto === 3 && Array.isArray(semCantico.corpo.completados));
  confere('a recusa vem em inglês', emIngles(semCantico.corpo.error), semCantico.corpo.error);
  confere('nada gravado', banco.en_cantico_progress.length === 0);
  comprasFalsas.c1 = ['cantico'];
  const marca = await chamar('progress', { day: 3, done: true, journey: 'cantico' }, { token });
  confere('dia 3 (aberto, 3º dia de app): 200', marca.status === 200 && JSON.stringify(marca.corpo.cantico.completados) === '[3]', JSON.stringify(marca.corpo?.cantico));
  confere('as madrugadas não mudam', banco.en_progress.length === 0 && marca.corpo.completados.length === 0);
  const cedo = await chamar('progress', { day: 5, done: true, journey: 'cantico' }, { token });
  confere('dia 5, ainda fechado: 409', cedo.status === 409 && cedo.corpo.error.includes('Canticle') && emIngles(cedo.corpo.error), cedo.corpo?.error);
  const repete = await chamar('progress', { day: 3, done: true, journey: 'cantico' }, { token });
  confere('marcar de novo não duplica', repete.status === 200 && banco.en_cantico_progress.length === 1);
  const desfaz = await chamar('progress', { day: 3, done: false, journey: 'cantico' }, { token });
  confere('desfazer: 200 e some', desfaz.status === 200 && desfaz.corpo.cantico.completados.length === 0 && banco.en_cantico_progress.length === 0);
  confere('jornada inventada: 400', (await chamar('progress', { day: 1, done: true, journey: 'novena' }, { token })).status === 400);
  tirarFuncaoDeExtras();
  confere('banco sem en_extras: 503, nada gravado', (await chamar('progress', { day: 1, done: true, journey: 'cantico' }, { token })).status === 503
    && banco.en_cantico_progress.length === 0);
});

await cenario('24. Painel: liberar e retirar um extra', async () => {
  cenarioDoPainel();
  comprasFalsas[CLIENTE_ID] = ['arcangeles'];
  const token = await entrar('admin@ejemplo.com');
  const libera = await chamar('admin_grant_extra', { customer_id: CLIENTE_ID, product: 'cantico' }, { token });
  const linha = produto => banco.en_access.find(a => a.customer_id === CLIENTE_ID && a.product === produto);
  confere('liberar o Cântico: linha manual, ativa, sem prazo', libera.status === 200 && linha('cantico')?.status === 'active'
    && linha('cantico').source === 'manual' && linha('cantico').expires_at === null);
  await chamar('admin_revoke_extra', { customer_id: CLIENTE_ID, product: 'arcangeles' }, { token });
  confere('retirar os Arcángeles comprados: linha revoked', linha('arcangeles')?.status === 'revoked');
  confere('o app dela não muda', linha('app')?.status === 'active');
  const dela = await chamar('session', {}, { token: await entrar('maria@ejemplo.com') });
  confere('no retrato dela: só o Cântico', JSON.stringify(dela.corpo.extras) === '["cantico"]', JSON.stringify(dela.corpo.extras));
  const ficha = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  confere('a ficha mostra a origem de cada extra', ficha.corpo.extras?.origem?.cantico === 'manual' && ficha.corpo.extras.origem.arcangeles === 'retirado', JSON.stringify(ficha.corpo.extras));
  confere('extra inventado: 400', (await chamar('admin_grant_extra', { customer_id: CLIENTE_ID, product: 'app' }, { token })).status === 400);
  confere('sem cliente: 400', (await chamar('admin_grant_extra', { product: 'cantico' }, { token })).status === 400);
  const naoAdmin = await entrar('maria@ejemplo.com');
  confere('cliente comum não libera: 403', (await chamar('admin_grant_extra', { customer_id: CLIENTE_ID, product: 'arcangeles' }, { token: naoAdmin })).status === 403);
  const historico = banco.en_admin_actions.map(a => `${a.action}:${a.details?.product}`).join(',');
  confere('histórico: grant_extra e revoke_extra, com o produto', historico === 'grant_extra:cantico,revoke_extra:arcangeles', historico);
});

// ---------------------------------------------------------------------------
// O RESGATE (supabase/en/09-resgate.sql). As três funções do
// banco são imitadas aqui com a mesma regra do SQL (que é provada no banco de
// teste); o que se confere é o caminho na en-api.
// ---------------------------------------------------------------------------
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const ativa = id => banco.en_access.some(a => a.customer_id === id && a.product === 'app' && a.status === 'active'
  && (a.expires_at === null || Date.parse(a.expires_at) > Date.now()));
const ehAdmin = id => banco.en_admins.some(a => a.customer_id === id);
// O freio conta por chave, como en_permite no SQL; freioDoResgate = false
// fecha tudo.
let freioDoResgate = true;
const pedidosAoFreio = [];
const contagemDoFreio = new Map();
rpcsDoTeste['rpc/en_permite'] = corpo => {
  pedidosAoFreio.push(corpo);
  if (!freioDoResgate) return false;
  const vezes = (contagemDoFreio.get(corpo.p_chave) || 0) + 1;
  contagemDoFreio.set(corpo.p_chave, vezes);
  return vezes <= corpo.p_maximo;
};
rpcsDoTeste['rpc/en_resgate_candidatos'] = ({ p_local: local, p_dominio: dominio }) => banco.en_customers
  .filter(c => ativa(c.id) && !ehAdmin(c.id))
  .map(c => ({ c, loc: c.email.split('@')[0], dom: c.email.split('@')[1] }))
  .flatMap(({ c, loc, dom }) => {
    const entrou = banco.en_sessions.some(s => s.customer_id === c.id);
    if (loc === local && dom !== dominio) return [{ customer_id: c.id, email: c.email, tipo: 'gemeo', entrou }];
    if (dom === dominio && loc !== local && local.length >= 6 && Math.abs(loc.length - local.length) <= 1 && distancia(loc, local) === 1) {
      return [{ customer_id: c.id, email: c.email, tipo: 'parecido', entrou }];
    }
    return [];
  });
// Como en_resgate_cartao no SQL: lê a visão en_pedidos_pagos (final_cartao e
// nome_cartao). ⏳ EUA: checkout — na produção ela vem vazia até o checkout.
rpcsDoTeste['rpc/en_resgate_cartao'] = ({ p_final: final }) => (/^\d{4}$/.test(final) ? banco.en_pedidos_pagos : [])
  .filter(p => p.final_cartao === final)
  .flatMap(p => {
    const c = banco.en_customers.find(x => x.id === p.customer_id || (!p.customer_id && x.email === String(p.email).toLowerCase()));
    return c && ativa(c.id) && !ehAdmin(c.id)
      ? [{ customer_id: c.id, email: c.email, nome_cliente: c.name, nome_cartao: p.nome_cartao || '' }]
      : [];
  });
const pagamento = (id, email, final, nomeNoCartao) => compra({
  pedido: `pay_${id}`, email, final_cartao: final, nome_cartao: nomeNoCartao,
});
const ligarEmergencia = (campos = {}) => banco.en_resgate_config.push({ id: 1, emergencia_ligada: true, emergencias_por_dia: 2, ...campos });
const resgates = () => banco.en_resgates;
const zerarResgate = () => { freioDoResgate = true; pedidosAoFreio.length = 0; contagemDoFreio.clear(); };

await cenario('25. Resgate pelo e-mail: os erros comuns de quem digita', async () => {
  zerarResgate();
  cliente({ id: 'r1', email: 'maria@gmail.com' });
  for (const digitado of ['maria@gmial.com', 'Maria @Gmail,com ', 'maria@gmail.con', 'maria@gmail', 'maria@hotmail.com'.replace('hotmail', 'gmsil'), 'maria@gmail.com.te', 'MARÍA@gmail.com']) {
    const r = await chamar('login', { email: digitado });
    confere(`"${digitado}" entra na conta de maria@gmail.com`, r.status === 200 && r.corpo.cliente?.email === 'maria@gmail.com', `veio ${r.status} ${r.corpo?.error || ''}`);
  }
  const registro = resgates().filter(x => x.metodo === 'corrigido');
  confere('cada correção fica registrada (corrigido), com o que ela digitou', registro.length >= 5 && registro.every(x => x.customer_id === 'r1' && x.email_digitado), String(registro.length));
  confere('o e-mail gravado não muda (ela é que digitou errado)', banco.en_customers.find(c => c.id === 'r1').email === 'maria@gmail.com');
  cliente({ id: 'r2', email: 'otra@empresa.com' });
  const empresa = await chamar('login', { email: 'otra@empresa.con' });
  confere('domínio desconhecido com ".con": vira ".com"', empresa.status === 200 && empresa.corpo.cliente?.email === 'otra@empresa.com');
  const real = await chamar('login', { email: 'maria@hotmail.com' });
  confere('domínio de verdade diferente NÃO é corrigido: 403', real.status === 403 && real.corpo.siguiente === 'nombre', `veio ${real.status}`);
  const mail = await chamar('login', { email: 'maria@mail.com' });
  confere('mail.com (provedor de verdade) não vira gmail.com: 403', mail.status === 403);
  cliente({ id: 'r3', email: 'luisa@hotmail.com' });
  confere('"hotmail.co" é ".com" cortado: entra em hotmail.com', (await chamar('login', { email: 'luisa@hotmail.co' })).corpo?.cliente?.email === 'luisa@hotmail.com');
  cliente({ id: 'r4', email: 'paz@yahoo.com.mx' });
  confere('"yajoo.com.mx" vira yahoo.com.mx (o do país, que existe)', (await chamar('login', { email: 'paz@yajoo.com.mx' })).corpo?.cliente?.email === 'paz@yahoo.com.mx');
  cliente({ id: 'r5', email: 'sol@hotmail.es' });
  confere('"hotmial.es" vira hotmail.es', (await chamar('login', { email: 'sol@hotmial.es' })).corpo?.cliente?.email === 'sol@hotmail.es');
});

await cenario('26. Resgate pelo e-mail: o gêmeo (o e-mail GRAVADO tinha o erro)', async () => {
  zerarResgate();
  cliente({ id: 'g1', email: 'rosa.lopez@gmsil.com', name: 'Rosa López' });
  compra({ pedido: 'pay_wg1', customer_id: 'g1', email: 'rosa.lopez@gmsil.com' });
  const r = await chamar('login', { email: 'rosa.lopez@gmail.com' });
  confere('o e-mail certo entra na conta do e-mail com erro', r.status === 200 && r.corpo.cliente?.nombre === 'Rosa', `veio ${r.status}`);
  confere('o e-mail gravado é corrigido', banco.en_customers.find(c => c.id === 'g1').email === 'rosa.lopez@gmail.com');
  confere('a visão das compras não é gravada (a compra é achada pela cliente)', tentativasDeGravarVisao.length === 0, tentativasDeGravarVisao.join(', '));
  const registro = resgates()[0];
  confere('registro: gemeo, com o e-mail de antes', registro?.metodo === 'gemeo' && registro.email_anterior === 'rosa.lopez@gmsil.com' && registro.customer_id === 'g1', JSON.stringify(registro));
  confere('da próxima vez entra direto, sem resgate', (await chamar('login', { email: 'rosa.lopez@gmail.com' })).status === 200 && resgates().length === 1);
  cliente({ id: 'g2', email: 'carmen@hotmail.com.como' });
  confere('hotmail.com.como também', (await chamar('login', { email: 'carmen@hotmail.com' })).status === 200
    && banco.en_customers.find(c => c.id === 'g2').email === 'carmen@hotmail.com');
  cliente({ id: 'g3', email: 'ines@iclod.con' });
  confere('iclod.con também, e com ela digitando errado do outro jeito', (await chamar('login', { email: 'ines@icloud.co' })).status === 200
    && banco.en_customers.find(c => c.id === 'g3').email === 'ines@icloud.com');
});

await cenario('27. Resgate pelo e-mail: o parecido (uma letra), só em conta que nunca entrou', async () => {
  zerarResgate();
  cliente({ id: 'p1', email: 'mariagarcia@gmail.com' });
  const r = await chamar('login', { email: 'mariagarsia@gmail.com' });
  confere('uma letra trocada: entra', r.status === 200 && r.corpo.cliente?.email === 'mariagarcia@gmail.com', `veio ${r.status}`);
  confere('registro: parecido, sem mudar o e-mail gravado', resgates()[0]?.metodo === 'parecido' && banco.en_customers.find(c => c.id === 'p1').email === 'mariagarcia@gmail.com');
  confere('agora que ela entrou, o parecido não vale mais: 403', (await chamar('login', { email: 'mariagarsia@gmail.com' })).status === 403);
  cliente({ id: 'p2', email: 'anapaula@gmail.com' });
  cliente({ id: 'p3', email: 'anapaul@gmail.com' });
  confere('dois parecidos: não adivinha, 403', (await chamar('login', { email: 'anapaulo@gmail.com' })).status === 403);
  cliente({ id: 'p4', email: 'luz@gmail.com' });
  confere('antes do @ curto (menos de 6 letras): 403', (await chamar('login', { email: 'lux@gmail.com' })).status === 403);
});

await cenario('28. Resgate nunca entra em conta de administradora nem em acesso fechado', async () => {
  zerarResgate();
  cliente({ id: 'adm', email: 'jefa.equipo@gmsil.com', acesso: { status: 'active', expires_at: null } });
  banco.en_admins.push({ customer_id: 'adm' });
  confere('gêmeo de administradora: 403', (await chamar('login', { email: 'jefa.equipo@gmail.com' })).status === 403);
  cliente({ id: 'adm2', email: 'directora@gmail.com', acesso: { status: 'active', expires_at: null } });
  banco.en_admins.push({ customer_id: 'adm2' });
  confere('parecido de administradora: 403', (await chamar('login', { email: 'directore@gmail.com' })).status === 403);
  cliente({ id: 'fech', email: 'cerrada@gmsil.com', acesso: { status: 'revoked', expires_at: daquiA(100) } });
  confere('gêmeo com acesso fechado: 403', (await chamar('login', { email: 'cerrada@gmail.com' })).status === 403);
  confere('nada corrigido, nada registrado', banco.en_customers.find(c => c.id === 'adm').email === 'jefa.equipo@gmsil.com' && resgates().length === 0);
  freioDoResgate = false;
  cliente({ id: 'fr', email: 'frenada@gmsil.com' });
  confere('freio do resgate fechado: 403 e o gêmeo não é procurado', (await chamar('login', { email: 'frenada@gmail.com' })).status === 403
    && banco.en_customers.find(c => c.id === 'fr').email === 'frenada@gmsil.com');
  confere('o freio usa a impressão digital do IP, nunca o IP', pedidosAoFreio.every(p => /^[a-f0-9]{64}$/.test(p.p_chave)) && !JSON.stringify(pedidosAoFreio).includes('200.1.2.3'));
});

await cenario('29. Resgate pelo cartão: os 4 últimos números + o nome', async () => {
  zerarResgate();
  cliente({ id: 'k1', email: 'rosa@gmsil.com', name: 'Rosa' });
  pagamento('k1', 'rosa@gmsil.com', '4821', 'JUAN PEREZ GOMEZ');
  const r = await chamar('buscar_compra', { nombre: 'Rosa María Pérez', final: '4821', correos: ['rosa@gmail.com'] });
  confere('o sobrenome do marido no cartão basta: entra', r.status === 200 && /^[a-f0-9]{64}$/.test(r.corpo.token || ''), `veio ${r.status} ${r.corpo?.error || ''}`);
  confere('a tela recebe o e-mail gravado e a sugestão (o que ela tentou)', r.corpo.compra?.correo === 'rosa@gmsil.com' && r.corpo.compra.sugerido === 'rosa@gmail.com', JSON.stringify(r.corpo.compra));
  const registro = resgates()[0];
  confere('registro: cartao, com o nome que ela escreveu', registro?.metodo === 'cartao' && registro.nome === 'Rosa María Pérez' && registro.customer_id === 'k1');
  confere('os 4 números não ficam em lugar nenhum novo', !JSON.stringify(resgates()).includes('4821') && !JSON.stringify(banco.en_sessions).includes('4821'));
  const acento = await chamar('buscar_compra', { nombre: '  perez ', final: ' 4 8 2 1 ' });
  confere('sem acento, minúscula e espaço: entra também', acento.status === 200);
  const outroNome = await chamar('buscar_compra', { nombre: 'Lucía', final: '4821' });
  confere('nome que não bate: 404, e a tela segue para a emergência', outroNome.status === 404 && outroNome.corpo.siguiente === 'emergencia');
  confere('e a explicação vem em inglês', emIngles(outroNome.corpo.error), outroNome.corpo.error);
  confere('final que não existe: 404', (await chamar('buscar_compra', { nombre: 'Rosa', final: '1111' })).status === 404);
  confere('sem nome ou sem os 4 números: 400', (await chamar('buscar_compra', { nombre: 'Rosa', final: '48' })).status === 400
    && (await chamar('buscar_compra', { nombre: '', final: '4821' })).status === 400);
  cliente({ id: 'k2', email: 'rosa.dos@gmail.com', name: 'Rosa Pérez' });
  pagamento('k2', 'rosa.dos@gmail.com', '4821', 'ROSA PEREZ');
  confere('duas clientes com o mesmo final e o mesmo nome: não adivinha, 404', (await chamar('buscar_compra', { nombre: 'Rosa Pérez', final: '4821' })).status === 404);
  confere('o nome desempata: "Juan" acha só a primeira', (await chamar('buscar_compra', { nombre: 'Juan', final: '4821' })).status === 200);
  freioDoResgate = false;
  confere('freio fechado: 429', (await chamar('buscar_compra', { nombre: 'Rosa', final: '4821' })).status === 429);
});

await cenario('30. Depois do cartão, ela troca o e-mail gravado pelo dela', async () => {
  zerarResgate();
  cliente({ id: 'k1', email: 'rosa@gmsil.com', name: 'Rosa' });
  pagamento('k1', 'rosa@gmsil.com', '4821', 'ROSA LOPEZ');
  const semResgate = await entrar('rosa@gmsil.com');
  confere('sem resgate pelo cartão: não troca (403)', (await chamar('corregir_correo', { email: 'rosa@gmail.com' }, { token: semResgate })).status === 403);
  const achou = await chamar('buscar_compra', { nombre: 'Rosa', final: '4821', correos: ['rosa@gmial.com'] });
  confere('a sugestão já vem corrigida (gmial -> gmail)', achou.corpo.compra?.sugerido === 'rosa@gmail.com', JSON.stringify(achou.corpo.compra));
  const troca = await chamar('corregir_correo', { email: 'rosa@gmail.com' }, { token: achou.corpo.token });
  confere('troca: 200, e o retrato já com o e-mail novo', troca.status === 200 && troca.corpo.cliente?.email === 'rosa@gmail.com', `veio ${troca.status}`);
  confere('gravado: o e-mail novo (e a visão das compras não é gravada)', banco.en_customers.find(c => c.id === 'k1').email === 'rosa@gmail.com'
    && tentativasDeGravarVisao.length === 0);
  confere('a sessão dela continua (quem trocou foi ela)', (await chamar('session', {}, { token: achou.corpo.token })).status === 200);
  const registro = resgates().find(x => x.metodo === 'cartao');
  confere('o registro do resgate guarda o e-mail de antes', registro?.email_anterior === 'rosa@gmsil.com' && registro.contato === 'rosa@gmail.com');
  confere('trocar de novo: 403 (uma vez só)', (await chamar('corregir_correo', { email: 'rosa.otra@gmail.com' }, { token: achou.corpo.token })).status === 403);
  cliente({ id: 'k3', email: 'ines@gmsil.com', name: 'Inés' });
  cliente({ id: 'k4', email: 'ines@gmail.com', name: 'Otra Inés' });
  pagamento('k3', 'ines@gmsil.com', '7310', 'INES PRUEBA');
  const outra = await chamar('buscar_compra', { nombre: 'Inés', final: '7310', correos: ['ines@gmail.com'] });
  confere('e-mail que já é de outra cliente: sem sugestão', outra.status === 200 && outra.corpo.compra?.sugerido === '');
  confere('e trocar para ele: 409', (await chamar('corregir_correo', { email: 'ines@gmail.com' }, { token: outra.corpo.token })).status === 409);
});

await cenario('31. A entrada de emergência', async () => {
  zerarResgate();
  confere('sem o interruptor no banco: 503 (manda escrever ao suporte)', (await chamar('entrada_emergencia', { nombre: 'Rosa', contacto: 'rosa@gmail.com' })).status === 503);
  ligarEmergencia();
  const r = await chamar('entrada_emergencia', { nombre: 'Rosa López', contacto: 'Rosa@Gmial.com', correos: ['rosa@yahoo.com'] }, {});
  confere('nome + e-mail: entra na hora', r.status === 200 && /^[a-f0-9]{64}$/.test(r.corpo.token || ''), `veio ${r.status} ${r.corpo?.error || ''}`);
  const criada = banco.en_customers.find(c => c.email === 'rosa@gmail.com');
  confere('a conta nasce com o e-mail corrigido e o nome', Boolean(criada) && criada.name === 'Rosa López');
  const acesso = criada && banco.en_access.find(a => a.customer_id === criada.id);
  confere('acesso de emergência: 12 meses, origem emergencia', acesso?.source === 'emergencia' && acesso.status === 'active'
    && Math.abs(Date.parse(acesso.expires_at) - (Date.now() + 365 * 86_400_000)) < 60_000);
  confere('sem os extras', Array.isArray(r.corpo.extras) && r.corpo.extras.length === 0, JSON.stringify(r.corpo.extras));
  confere('saúda pelo nome', r.corpo.cliente?.nombre === 'Rosa');
  const registro = resgates()[0];
  confere('registro: emergencia, por confirmar, com o contato e o que ela tentou', registro?.metodo === 'emergencia' && registro.situacao === 'por_confirmar'
    && registro.contato === 'Rosa@Gmial.com' && registro.email_digitado === 'rosa@yahoo.com', JSON.stringify(registro));
  const whats = await chamar('entrada_emergencia', { nombre: 'Carmen', contacto: '+52 1 55 1234 5678' });
  confere('nome + telefone: entra, numa conta sem e-mail de verdade', whats.status === 200
    && banco.en_customers.some(c => c.email === 'whatsapp-5215512345678@no-email.invalid'));
  const limite = await chamar('entrada_emergencia', { nombre: 'Ana', contacto: 'ana@gmail.com' });
  confere('3ª emergência da mesma conexão no dia: 429, em inglês e sem contato do espanhol', limite.status === 429 && emIngles(limite.corpo.error)
    && !/whatsapp/i.test(limite.corpo.error), limite.corpo?.error);
});

await cenario('32. Emergência com um e-mail que já existe', async () => {
  zerarResgate();
  ligarEmergencia({ emergencias_por_dia: 10 });
  cliente({ id: 'e1', email: 'compradora@gmail.com', name: 'Lucía' });
  const dela = await chamar('entrada_emergencia', { nombre: 'Lucía', contacto: 'compradora@gmail.com' });
  confere('a conta é dela e tem o app: entra, sem acesso novo', dela.status === 200 && banco.en_access.filter(a => a.customer_id === 'e1').length === 1
    && banco.en_access.find(a => a.customer_id === 'e1').source === 'checkout');
  confere('e o registro já nasce resolvido', resgates()[0]?.situacao === 'resolvido');
  cliente({ id: 'e2', email: 'cerrada@gmail.com', acesso: { status: 'revoked', expires_at: daquiA(100) } });
  confere('acesso fechado pela equipe: não reabre (403)', (await chamar('entrada_emergencia', { nombre: 'Marta', contacto: 'cerrada@gmail.com' })).status === 403
    && banco.en_access.find(a => a.customer_id === 'e2').status === 'revoked');
  cliente({ id: 'e3', email: 'sinacceso@gmail.com', acesso: null });
  confere('cadastrada sem acesso nenhum: libera', (await chamar('entrada_emergencia', { nombre: 'Elena', contacto: 'sinacceso@gmail.com' })).status === 200
    && banco.en_access.find(a => a.customer_id === 'e3')?.source === 'emergencia');
  confere('sem nome: 400', (await chamar('entrada_emergencia', { nombre: '', contacto: 'x@gmail.com' })).status === 400);
  confere('contato que não é e-mail nem telefone: 400', (await chamar('entrada_emergencia', { nombre: 'Elena', contacto: 'no sé' })).status === 400);
  banco.en_resgate_config[0].emergencia_ligada = false;
  const desligada = await chamar('entrada_emergencia', { nombre: 'Elena', contacto: 'nueva@gmail.com' });
  confere('interruptor desligado: 503, em inglês e sem contato do espanhol', desligada.status === 503 && emIngles(desligada.corpo.error)
    && !/whatsapp/i.test(desligada.corpo.error), desligada.corpo?.error);
});

await cenario('33. Painel: a lista de resgates e "Marcar como resolvido"', async () => {
  zerarResgate();
  cenarioDoPainel();
  ligarEmergencia();
  await chamar('entrada_emergencia', { nombre: 'Rosa', contacto: 'rosa@gmail.com' });
  const token = await entrar('admin@ejemplo.com');
  const painel = await chamar('admin_dashboard', {}, { token });
  const lista = painel.corpo.resgates;
  confere('o painel traz os resgates', Array.isArray(lista) && lista.length === 1 && lista[0].situacao === 'por_confirmar', JSON.stringify(lista));
  const resolve = await chamar('admin_resolver_resgate', { id: lista[0].id }, { token });
  confere('marcar como resolvido: 200, com quem e quando', resolve.status === 200 && resgates()[0].situacao === 'resolvido'
    && resgates()[0].resolvido_por === ADMIN_ID && Boolean(resgates()[0].resolvido_em));
  confere('id inválido: 400', (await chamar('admin_resolver_resgate', { id: 'x' }, { token })).status === 400);
  confere('id que não existe: 404', (await chamar('admin_resolver_resgate', { id: 999 }, { token })).status === 404);
  const naoAdmin = await entrar('maria@ejemplo.com');
  confere('cliente comum não resolve: 403', (await chamar('admin_resolver_resgate', { id: lista[0].id }, { token: naoAdmin })).status === 403);
  pagamento('maria', 'maria@ejemplo.com', '5544', 'MARIA LOPEZ');
  await chamar('buscar_compra', { nombre: 'María', final: '5544' });
  const ficha = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  confere('a ficha dela mostra o resgate pelo cartão', Array.isArray(ficha.corpo.resgates) && ficha.corpo.resgates.length === 1
    && ficha.corpo.resgates[0].metodo === 'cartao', JSON.stringify(ficha.corpo.resgates));
});

await cenario('34. Sem o SQL do resgate no banco: tudo como antes', async () => {
  zerarResgate();
  const guardadas = { ...rpcsDoTeste };
  for (const nome of Object.keys(rpcsDoTeste)) delete rpcsDoTeste[nome];
  delete banco.en_resgates;
  delete banco.en_resgate_config;
  cliente({ id: 'v1', email: 'vieja@gmsil.com' });
  cliente({ id: 'v2', email: 'normal@gmail.com' });
  confere('login normal: 200', (await chamar('login', { email: 'normal@gmail.com' })).status === 200);
  confere('com erro de digitação comum: ainda entra (a correção não depende do banco)', (await chamar('login', { email: 'normal@gmial.com' })).status === 200);
  confere('gêmeo: 403 (sem as funções, não procura)', (await chamar('login', { email: 'vieja@gmail.com' })).status === 403);
  confere('cartão: 503 (a tela manda escrever ao suporte)', (await chamar('buscar_compra', { nombre: 'Rosa', final: '4821' })).status === 503);
  confere('emergência: 503 (manda escrever ao suporte)', (await chamar('entrada_emergencia', { nombre: 'Rosa', contacto: 'rosa@gmail.com' })).status === 503);
  const token = await entrar('normal@gmail.com');
  cenarioDoPainel();
  const admin = await entrar('admin@ejemplo.com');
  const painel = await chamar('admin_dashboard', {}, { token: admin });
  confere('painel abre, sem a seção de resgates', painel.status === 200 && painel.corpo.resgates === null, `veio ${painel.status}`);
  confere('sessão comum continua', (await chamar('session', {}, { token })).status === 200);
  Object.assign(rpcsDoTeste, guardadas);
});

await cenario('35. A ficha do painel: as compras vêm da visão en_pedidos_pagos', async () => {
  cenarioDoPainel();
  const token = await entrar('admin@ejemplo.com');
  const vazia = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  confere('sem compra (a visão vazia, como hoje): 200 e listas vazias', vazia.status === 200
    && Array.isArray(vazia.corpo.payments) && vazia.corpo.payments.length === 0 && Array.isArray(vazia.corpo.orders) && vazia.corpo.orders.length === 0);
  compra({ pedido: 'pay_a1', customer_id: CLIENTE_ID, email: 'maria@ejemplo.com', produtos: ['principal'], pagado_en: '2026-11-01T10:00:00.000Z' });
  compra({ pedido: 'pay_a2', customer_id: null, email: 'maria@ejemplo.com', produtos: ['arcangeles'], valor_cents: 2921,
    devuelto: true, utm_medium: 'popup', utm_content: 'novas-1a-exibicao', pagado_en: '2026-11-02T10:00:00.000Z' });
  compra({ pedido: 'pay_x9', customer_id: 'outra', email: 'outra@ejemplo.com' });
  const ficha = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  const ids = (ficha.corpo.payments || []).map(p => p.tx).join(',');
  confere('acha pela cliente e pelo e-mail, sem repetir e sem a de outra', ids === 'pay_a2,pay_a1', ids);
  const devolvida = ficha.corpo.payments.find(p => p.tx === 'pay_a2');
  confere('cobrança devolvida aparece como devolvido', devolvida?.status === 'devolvido');
  const pedido = (ficha.corpo.orders || []).find(o => o.transaction_id === 'pay_a2');
  confere('orders no formato que o painel já lê (produto, valor, etiqueta)', pedido && pedido.produtos[0] === 'arcangeles' && pedido.amount_cents === 2921
    && pedido.currency === 'USD' && pedido.utm_medium === 'popup', JSON.stringify(pedido));
  forcarFalha({ quando: ({ tabela }) => tabela === 'en_pedidos_pagos', status: 404 });
  const semVisao = await chamar('admin_customer_detail', { customer_id: CLIENTE_ID }, { token });
  confere('banco sem a visão (02-compras.sql não rodou): a ficha abre igual, sem compras', semVisao.status === 200 && semVisao.corpo.payments.length === 0);
});

await cenario('36. Toda mensagem que a cliente lê vem em inglês', async () => {
  zerarResgate();
  const erros = [];
  const pega = r => { if (r.corpo && typeof r.corpo.error === 'string') erros.push(r.corpo.error); };
  pega(await chamar('login', { email: 'x' }));
  pega(await chamar('login', { email: 'nadie@ejemplo.com' }));
  pega(await chamar('entry', { code: 'curto' }));
  pega(await chamar('entry', { code: 'Zzz999Yyy888Xxx7' }));
  pega(await chamar('session'));
  pega(await chamar('buscar_compra', { nombre: '', final: '1' }));
  pega(await chamar('buscar_compra', { nombre: 'Rosa', final: '9999' }));
  pega(await chamar('entrada_emergencia', { nombre: '', contacto: '' }));
  pega(await chamar('entrada_emergencia', { nombre: 'Rosa', contacto: 'rosa@gmail.com' }));
  cliente({ id: 'z1', email: 'zz@ejemplo.com', acesso: { status: 'revoked', expires_at: daquiA(10) } });
  ligarEmergencia();
  pega(await chamar('entrada_emergencia', { nombre: 'Zoe', contacto: 'zz@ejemplo.com' }));
  cliente({ id: 'z2', email: 'yy@ejemplo.com' });
  const token = await entrar('yy@ejemplo.com');
  pega(await chamar('corregir_correo', { email: 'yy2@ejemplo.com' }, { token }));
  pega(await chamar('corregir_correo', { email: 'nada' }, { token }));
  pega(await chamar('progress', { day: 9, done: true }, { token }));
  travarFreio();
  pega(await chamar('login', { email: 'yy@ejemplo.com' }));
  const ruins = erros.filter(e => !emIngles(e));
  confere(`${erros.length} mensagens de erro, todas em inglês`, erros.length >= 12 && ruins.length === 0, ruins.join(' | '));
  confere('nenhuma cita WhatsApp, e o e-mail citado é só o SUPPORT_EMAIL', !erros.some(e => /whatsapp/i.test(e) || (/@/.test(e.replace('mary@gmail.com', '')) && !e.includes('soporte@pkscale.com'))), erros.join(' | '));
});

fechar();
