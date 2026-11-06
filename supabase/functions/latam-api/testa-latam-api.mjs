// Teste local da latam-api: não toca em banco nenhum.
//
// Sobe a função num banco de mentira e confere o login pelo e-mail, o link de
// entrada, a sessão, a trava de uma oração por dia (no fuso dela) e o "Ya
// recé". Também prova que nenhuma tabela do Brasil é tocada.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/latam-api/testa-latam-api.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  banco, tocadas, forcarFalha, travarFreio, carregarFuncao, confere, cenario, fechar,
} from '../../latam/testes/banco-falso.mjs';

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
  if (token) headers['x-latam-session'] = token;
  const resposta = await api(new Request('https://exemplo/latam-api', {
    method, headers, body: method === 'POST' ? JSON.stringify({ action, ...corpo }) : undefined,
  }));
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

function cliente({ id = 'c1', email = 'maria@ejemplo.com', name = 'María López', timezone = null, first_access_on = null, acesso = { status: 'active', expires_at: daquiA(300) } } = {}) {
  banco.latam_customers.push({ id, email, name, country: 'MX', timezone, first_access_on, whop_user_id: null });
  if (acesso) banco.latam_access.push({ customer_id: id, product: 'app', source: 'whop', ...acesso });
}
async function entrar(email = 'maria@ejemplo.com', tz = 'America/Bogota') {
  const { corpo } = await chamar('login', { email, tz });
  return corpo.token;
}

console.log(`Testando: ${alvo}`);

await cenario('1. Quem pode chamar (CORS)', async () => {
  const site = await chamar('', {}, { method: 'OPTIONS' });
  confere('o site: 204', site.status === 204);
  confere('devolve a origem do site', site.headers.get('access-control-allow-origin') === 'https://setemadrugadas.com.br');
  confere('aceita o cabeçalho de sessão da LATAM', (site.headers.get('access-control-allow-headers') || '').includes('x-latam-session'));
  const local = await chamar('', {}, { method: 'OPTIONS', origin: 'http://localhost:3000' });
  confere('o teste local: 204', local.status === 204);
  const deploy = await chamar('', {}, { method: 'OPTIONS', origin: 'https://6aece0118531e61c70fce54c--7madrugadas.netlify.app' });
  confere('o link permanente de um deploy: 204', deploy.status === 204);
  const estranho = await chamar('', {}, { method: 'OPTIONS', origin: 'https://site-estranho.com' });
  confere('site estranho: 403', estranho.status === 403);
});

await cenario('2. Login que não entra, com a explicação em espanhol', async () => {
  const ruim = await chamar('login', { email: 'maria@' });
  confere('e-mail incompleto: 400', ruim.status === 400 && ruim.corpo.error.includes('correo'), ruim.corpo?.error);
  const ninguem = await chamar('login', { email: 'nadie@ejemplo.com' });
  confere('e-mail sem compra: 403', ninguem.status === 403 && ninguem.corpo.error.includes('No encontramos'));
  cliente({ id: 'sem', email: 'sin.acceso@ejemplo.com', acesso: null });
  confere('cliente sem acesso: 403', (await chamar('login', { email: 'sin.acceso@ejemplo.com' })).status === 403);
  cliente({ id: 'tirada', email: 'retirada@ejemplo.com', acesso: { status: 'revoked', expires_at: daquiA(100) } });
  confere('acesso retirado: 403', (await chamar('login', { email: 'retirada@ejemplo.com' })).status === 403);
  cliente({ id: 'vencida', email: 'vencida@ejemplo.com', timezone: 'America/Mexico_City', acesso: { status: 'active', expires_at: '2026-01-15T18:00:00.000Z' } });
  const vencida = await chamar('login', { email: 'vencida@ejemplo.com' });
  confere('acesso vencido: 403 com a data', vencida.status === 403 && vencida.corpo.error.includes('15/01/2026'), vencida.corpo?.error);
  confere('nenhuma sessão criada', banco.latam_sessions.length === 0);
});

await cenario('3. Login certo: sessão, primeiro acesso e o dia de hoje no fuso dela', async () => {
  cliente();
  const { status, corpo } = await chamar('login', { email: '  MARIA@Ejemplo.com ', tz: 'America/Bogota' });
  confere('200', status === 200, `veio ${status}`);
  confere('código de sessão de 64 letras', /^[a-f0-9]{64}$/.test(corpo.token || ''));
  confere('o banco guarda só a impressão digital', banco.latam_sessions[0]?.token_hash === sha256(corpo.token) && banco.latam_sessions[0]?.token_hash !== corpo.token);
  confere('sessão de 90 dias', Math.abs(Date.parse(banco.latam_sessions[0].expires_at) - Date.parse(daquiA(90))) < 60_000);
  confere('saúda pelo primeiro nome', corpo.cliente?.nombre === 'María');
  confere('fuso do celular dela', corpo.zona === 'America/Bogota');
  confere('hoje no fuso dela', corpo.hoy === hojeEm('America/Bogota'));
  confere('primeiro dia: abre o Comienza aquí e o Primer Amén', corpo.abierto === 1);
  confere('nada marcado ainda', Array.isArray(corpo.completados) && corpo.completados.length === 0);
  confere('mostra até quando vale o acesso', /^\d{2}\/\d{2}\/\d{4}$/.test(corpo.acceso_hasta || ''), corpo.acceso_hasta);
  confere('grava o primeiro acesso e o fuso', banco.latam_customers[0].first_access_on === corpo.hoy && banco.latam_customers[0].timezone === 'America/Bogota');
  confere('grava o dia de visita', banco.latam_visit_days.length === 1 && banco.latam_visit_days[0].visited_on === corpo.hoy);
  const campos = Object.keys(corpo).sort().join(',');
  confere('não devolve nada além do retrato', campos === 'abierto,acceso_hasta,cliente,completados,hoy,token,zona', campos);
});

await cenario('4. Fuso inválido vira Cidade do México; fuso já gravado não muda', async () => {
  cliente({ id: 'nova', email: 'nova@ejemplo.com' });
  const nova = await chamar('login', { email: 'nova@ejemplo.com', tz: 'Mexico City; DROP' });
  confere('fuso estranho: America/Mexico_City', nova.corpo.zona === 'America/Mexico_City');
  cliente({ id: 'antiga', email: 'antigua@ejemplo.com', timezone: 'America/Lima', first_access_on: diasAntes('America/Lima', 1) });
  const antiga = await chamar('login', { email: 'antigua@ejemplo.com', tz: 'Asia/Tokyo' });
  confere('quem já tem fuso fica com o dela', antiga.corpo.zona === 'America/Lima');
  confere('a âncora não muda', banco.latam_customers.find(c => c.id === 'antiga').first_access_on === diasAntes('America/Lima', 1));
});

await cenario('5. Muitas tentativas seguidas: 429', async () => {
  cliente();
  travarFreio();
  const resposta = await chamar('login', { email: 'maria@ejemplo.com' });
  confere('429 com explicação', resposta.status === 429 && resposta.corpo.error.includes('intentos'));
});

await cenario('6. A trava: uma oração por dia, contando do primeiro acesso, no fuso dela', async () => {
  cliente({ id: 'tres', email: 'tres@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 3) });
  confere('3 dias depois do primeiro acesso: abre até o Cuarto Amén', (await chamar('login', { email: 'tres@ejemplo.com' })).corpo.abierto === 4);
  cliente({ id: 'vinte', email: 'veinte@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 20) });
  confere('passou da semana: as 7 abertas, nunca mais que 7', (await chamar('login', { email: 'veinte@ejemplo.com' })).corpo.abierto === 7);
  cliente({ id: 'marcou', email: 'marco@ejemplo.com', timezone: 'America/Guatemala', first_access_on: diasAntes('America/Guatemala', 0) });
  banco.latam_progress.push({ customer_id: 'marcou', day: 5 });
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
  confere('várias visitas no mesmo dia contam um dia só', banco.latam_visit_days.length === 1);
  banco.latam_sessions[0].expires_at = daquiA(-1);
  confere('sessão vencida: 401', (await chamar('session', {}, { token })).status === 401);
});

await cenario('8. "Ya recé": marcar, desmarcar, e o dia fechado', async () => {
  cliente();
  const token = await entrar();
  const marcou = await chamar('progress', { day: 1, done: true }, { token });
  confere('marca o Primer Amén', marcou.status === 200 && marcou.corpo.completados.join() === '1');
  const intro = await chamar('progress', { day: 0, done: true }, { token });
  confere('marca o Comienza aquí', intro.corpo.completados.join() === '0,1');
  const fechado = await chamar('progress', { day: 4, done: true }, { token });
  confere('dia ainda fechado: 409 com explicação', fechado.status === 409 && fechado.corpo.error.includes('todavía no está abierto'));
  confere('e nada gravado para o dia fechado', !banco.latam_progress.some(p => p.day === 4));
  const repetiu = await chamar('progress', { day: 1, done: true }, { token });
  confere('marcar de novo não duplica', repetiu.status === 200 && banco.latam_progress.length === 2);
  const desmarcou = await chamar('progress', { day: 1, done: false }, { token });
  confere('desmarca', desmarcou.corpo.completados.join() === '0');
  confere('dia 8 não existe: 400', (await chamar('progress', { day: 8, done: true }, { token })).status === 400);
  confere('"done" que não é sim/não: 400', (await chamar('progress', { day: 1, done: 'si' }, { token })).status === 400);
  confere('ação desconhecida: 400', (await chamar('borrar_todo', {}, { token })).status === 400);
});

await cenario('9. Acesso retirado depois do login: a sessão para de abrir', async () => {
  cliente();
  const token = await entrar();
  banco.latam_access[0].status = 'revoked';
  confere('403', (await chamar('session', {}, { token })).status === 403);
});

await cenario('10. Sair encerra a sessão', async () => {
  cliente();
  const token = await entrar();
  confere('logout: 200', (await chamar('logout', {}, { token })).status === 200);
  confere('a sessão some do banco', banco.latam_sessions.length === 0);
  confere('o código antigo não abre mais: 401', (await chamar('session', {}, { token })).status === 401);
});

await cenario('11. Link de entrada (para quem não consegue digitar o e-mail)', async () => {
  cliente();
  banco.latam_entry_links.push({ customer_id: 'c1', token: 'Abc123Def456Ghi7', uses: 0, last_used_at: null });
  confere('código incompleto: 400', (await chamar('entry', { code: 'Abc123' })).status === 400);
  confere('código que não existe: 404', (await chamar('entry', { code: 'Zzz999Yyy888Xxx7' })).status === 404);
  const certo = await chamar('entry', { code: 'Abc123Def456Ghi7', tz: 'America/Santiago' });
  confere('código certo: entra', certo.status === 200 && /^[a-f0-9]{64}$/.test(certo.corpo.token || ''));
  confere('conta o uso do link', banco.latam_entry_links[0].uses === 1 && banco.latam_entry_links[0].last_used_at);
  confere('grava o fuso do celular dela', banco.latam_customers[0].timezone === 'America/Santiago');
  banco.latam_access[0].status = 'revoked';
  confere('sem acesso ativo, o link não abre', (await chamar('entry', { code: 'Abc123Def456Ghi7' })).status === 403);
});

await cenario('12. Falha passageira do banco não derruba; falha de verdade avisa em espanhol', async () => {
  cliente();
  forcarFalha({ quando: ({ tabela, method }) => tabela === 'latam_customers' && method === 'GET', status: 503, vezes: 1 });
  confere('falha passageira: entra mesmo assim', (await chamar('login', { email: 'maria@ejemplo.com' })).status === 200);
  forcarFalha({ quando: ({ tabela }) => tabela === 'latam_customers', status: 500 });
  const caiu = await chamar('login', { email: 'maria@ejemplo.com' });
  confere('banco fora: 503 com explicação', caiu.status === 503 && caiu.corpo.error.includes('No pudimos conectar'));
});

await cenario('13. Nenhuma tabela do Brasil é tocada', async () => {
  cliente();
  banco.latam_entry_links.push({ customer_id: 'c1', token: 'Abc123Def456Ghi7', uses: 0 });
  const token = await entrar();
  await chamar('session', {}, { token });
  await chamar('progress', { day: 1, done: true }, { token });
  await chamar('entry', { code: 'Abc123Def456Ghi7' });
  await chamar('logout', {}, { token });
  const fora = [...tocadas].filter(tabela => !tabela.startsWith('latam_') && tabela !== 'rpc/latam_allow_login');
  confere('só tabelas latam_ e o freio da LATAM', fora.length === 0, fora.join(', '));
});

fechar();
