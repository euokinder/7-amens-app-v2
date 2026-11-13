// Teste local da latam-chat (a Lucía): não toca em banco nenhum nem na IA.
//
// O banco é o de mentira da LATAM (supabase/latam/testes/banco-falso.mjs) e a
// IA é a de mentira (anthropic-falso.mjs), que responde o que cada cenário
// manda. Confere o interruptor, quem é ela (com e sem sessão), o retrato que a
// Lucía recebe (a trava, os extras, os presentes das 50 primeiras), a conversa
// que continua, o pedido à equipe (o e-mail para o soporte), os freios, as
// falhas e que nenhuma tabela do Brasil é tocada.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/latam-chat/testa-latam-chat.mjs

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const aqui = dirname(fileURLToPath(import.meta.url));
const falso = pathToFileURL(resolve(aqui, 'anthropic-falso.mjs')).href;
// O `npm:@anthropic-ai/sdk@...` do Deno vira a IA de mentira.
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('npm:@anthropic-ai/sdk')) return { url: ${JSON.stringify(falso)}, shortCircuit: true };
  return next(specifier, context);
}`)}`);

const { banco, tocadas, carregarFuncao, confere, cenario, fechar, rpcsDoTeste, forcarFalha } =
  await import('../../latam/testes/banco-falso.mjs');

const alvo = resolve(aqui, 'index.ts');
const ENV = { SUPABASE_URL: 'https://lbaudlocfbjunnaoyrtz.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa', LATAM_POSTMARK_TOKEN: 'token-falso' };
const chat = await carregarFuncao(alvo, { ...ENV, ANTHROPIC_API_KEY: 'sk-falsa' });
const chatSemChave = await carregarFuncao(alvo, ENV);

// O Postmark de mentira, por cima do banco de mentira.
const fetchDoBanco = globalThis.fetch;
const emails = [];
let postmarkStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith('https://api.postmarkapp.com/')) {
    tocadas.add('postmark');
    emails.push({ headers: init.headers, corpo: JSON.parse(init.body) });
    return new Response('{}', { status: postmarkStatus });
  }
  return fetchDoBanco(url, init);
};

const sha256 = valor => createHash('sha256').update(valor).digest('hex');
const hojeEm = zona => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
const diasAntes = (zona, n) => {
  const [a, m, d] = hojeEm(zona).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10);
};
const daquiA = dias => new Date(Date.now() + dias * 86_400_000).toISOString();

// A IA de mentira: uma fila de respostas por cenário.
let fila = [];
globalThis.__pedidosClaude = [];
globalThis.__claudeFalso = async () => {
  const proxima = fila.shift();
  if (!proxima) throw new Error('A IA de mentira não tinha resposta na fila.');
  if (proxima instanceof Error) throw proxima;
  return proxima;
};
const texto = (t, uso = { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 5000 }) =>
  ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }], usage: uso });
const pedeEquipe = input => ({ stop_reason: 'tool_use', content: [{ type: 'text', text: 'Un momento.' }, { type: 'tool_use', id: 'tu_1', name: 'pasar_a_la_equipo', input }], usage: { input_tokens: 200, output_tokens: 60 } });

let freios = {};
function preparar({ ligado = true, modelo = 'claude-sonnet-5-5', manual = 'MANUAL DE LUCÍA (teste)', posicao = 80 } = {}) {
  banco.latam_chat_config.push({ id: 1, ligado, modelo, manual, mensagens_por_dia: 40, conversas_por_hora: 6, presentes_ate: 50, presentes_margem: 10 });
  freios = {};
  rpcsDoTeste['rpc/latam_permite'] = ({ p_chave, p_maximo }) => { freios[p_chave] = (freios[p_chave] || 0) + 1; return freios[p_chave] <= p_maximo; };
  rpcsDoTeste['rpc/latam_chat_posicao'] = () => posicao;
  fila = [];
  globalThis.__pedidosClaude = [];
  emails.length = 0;
  postmarkStatus = 200;
}

function cliente({ id = 'c1', email = 'maria@ejemplo.com', name = 'María López', timezone = 'America/Bogota', first_access_on = diasAntes('America/Bogota', 2), acesso = { status: 'active', expires_at: daquiA(300) } } = {}) {
  banco.latam_customers.push({ id, email, name, country: 'CO', timezone, first_access_on, whop_user_id: null });
  if (acesso) banco.latam_access.push({ customer_id: id, product: 'app', source: 'whop', ...acesso });
  const token = createHash('sha256').update(`token-${id}`).digest('hex');
  banco.latam_sessions.push({ token_hash: sha256(token), customer_id: id, expires_at: daquiA(100) });
  return token;
}

async function falar(mensaje, { token, conversa, pagina = 'app', funcao = chat, ip = '200.1.2.3', origin = 'https://setemadrugadas.com.br', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip };
  if (origin) headers.origin = origin;
  if (token) headers['x-latam-session'] = token;
  const resposta = await funcao(new Request('https://exemplo/latam-chat', {
    method, headers, body: method === 'POST' ? JSON.stringify({ mensaje, conversa, pagina }) : undefined,
  }));
  const t = await resposta.text();
  return { status: resposta.status, corpo: t ? JSON.parse(t) : null, headers: resposta.headers };
}
const sistemaDo = pedido => pedido.system.map(b => b.text).join('\n');

console.log(`Testando: ${alvo}`);

await cenario('1. Quem pode chamar (CORS)', async () => {
  preparar();
  const site = await falar('', { method: 'OPTIONS' });
  confere('o site: 204', site.status === 204);
  confere('aceita o cabeçalho de sessão da LATAM', (site.headers.get('access-control-allow-headers') || '').includes('x-latam-session'));
  const local = await falar('', { method: 'OPTIONS', origin: 'http://localhost:3000' });
  confere('o teste local: 204', local.status === 204);
  const outro = await falar('hola', { origin: 'https://golpe.example' });
  confere('outro site: 403', outro.status === 403);
});

await cenario('2. O interruptor', async () => {
  preparar({ ligado: false });
  const r = await falar('hola');
  confere('desligado no banco: { desligado: true }', r.corpo && r.corpo.desligado === true);
  confere('desligado: a IA não é chamada', globalThis.__pedidosClaude.length === 0);
  confere('desligado: nenhuma conversa gravada', banco.latam_chat_conversas.length === 0);

  banco.latam_chat_config = [];
  preparar({ manual: '   ' });
  confere('sem manual: desligado', (await falar('hola')).corpo.desligado === true);

  banco.latam_chat_config = [];
  preparar();
  confere('sem a chave da Anthropic: desligado', (await falar('hola', { funcao: chatSemChave })).corpo.desligado === true);

  banco.latam_chat_config = [];
  forcarFalha({ quando: ({ tabela }) => tabela === 'latam_chat_config', status: 404 });
  confere('sem a tabela (SQL não rodou): desligado', (await falar('hola')).corpo.desligado === true);
});

await cenario('3. Mensagem inválida', async () => {
  preparar();
  confere('vazia: 400', (await falar('   ')).status === 400);
  const longa = await falar('a'.repeat(5000));
  confere('corpo grande demais: 400', longa.status === 400);
  fila.push(texto('ok'));
  await falar('b'.repeat(900));
  const guardada = banco.latam_chat_mensagens.find(m => m.papel === 'cliente');
  confere('mensagem longa é cortada em 600 letras', guardada && guardada.texto.length === 600);
});

await cenario('4. Dentro do app (com sessão): o retrato dela', async () => {
  preparar({ posicao: 80 });
  const token = cliente({ first_access_on: diasAntes('America/Bogota', 2) });
  banco.latam_progress.push({ customer_id: 'c1', day: 0 }, { customer_id: 'c1', day: 1 });
  fila.push(texto('¡Hola, María! Tu Cuarto Amén se abre esta noche 🙏'));
  const r = await falar('¿Cuándo se abre la próxima?', { token });
  confere('200 com a resposta', r.status === 200 && r.corpo.resposta.includes('Cuarto Amén'));
  confere('devolve o número da conversa', typeof r.corpo.conversa === 'string' && r.corpo.conversa.length === 36);
  confere('sem pedido à equipe, sem botão do WhatsApp', !r.corpo.equipe);
  const pedido = globalThis.__pedidosClaude[0];
  const sistema = sistemaDo(pedido);
  confere('as regras fixas vão primeiro, com cache', pedido.system[0].cache_control && pedido.system[0].text.startsWith('Eres Lucía'));
  confere('o manual do banco vai junto, no bloco com cache', pedido.system[0].text.includes('MANUAL DE LUCÍA (teste)'));
  confere('o retrato vai DEPOIS do cache (não estraga o cache)', !pedido.system[1].cache_control && pedido.system[1].text.includes('DATOS DE LA CLIENTA'));
  confere('o retrato tem o nome e o e-mail dela', sistema.includes('Nombre: María') && sistema.includes('maria@ejemplo.com'));
  confere('o retrato diz até que dia está aberto (3.º dia de app = dia 3)', sistema.includes('hasta el día 3'));
  confere('o retrato diz qual é a próxima', sistema.includes('día 4: Cuarto Amén'));
  confere('o retrato diz o que ela marcou', sistema.includes('"Ya recé": 0, 1'));
  confere('posição 80: fora das 50, pode dizer com carinho', sistema.includes('NO está entre las primeras 50'));
  confere('a conversa começa pela mensagem dela', pedido.messages.length === 1 && pedido.messages[0].role === 'user');
  confere('Sonnet: com a troca automática se o filtro recusar', pedido.fallbacks === 'default' && pedido.betas.includes('server-side-fallback-2026-07-01'));
  confere('esforço baixo (resposta curta e barata)', pedido.output_config.effort === 'low');
  confere('a ferramenta da equipe é oferecida', pedido.tools.length === 1 && pedido.tools[0].name === 'pasar_a_la_equipo');
  const conversa = banco.latam_chat_conversas[0];
  confere('a conversa é dela', conversa.customer_id === 'c1' && conversa.pagina === 'app');
  const [dela, lucia] = banco.latam_chat_mensagens;
  confere('grava a mensagem dela e a da Lucía', dela.papel === 'cliente' && lucia.papel === 'lucia');
  confere('grava os tokens (para saber o gasto)', lucia.tokens_cache === 5000 && lucia.tokens_saida === 40 && lucia.modelo === 'claude-sonnet-5-5');
  confere('não grava visita nem muda a jornada', banco.latam_visit_days.length === 0 && banco.latam_customers[0].first_access_on === diasAntes('America/Bogota', 2));
});

await cenario('5. A conversa continua (e é só dela)', async () => {
  preparar();
  const token = cliente();
  const outra = cliente({ id: 'c2', email: 'ana@ejemplo.com', name: 'Ana' });
  fila.push(texto('Primera respuesta'), texto('Segunda respuesta'));
  const primeira = await falar('Hola', { token });
  await falar('Gracias', { token, conversa: primeira.corpo.conversa });
  const segundo = globalThis.__pedidosClaude[1];
  confere('a segunda leva o histórico: ela, Lucía, ela', segundo.messages.map(m => m.role).join(',') === 'user,assistant,user');
  confere('o histórico é só texto (sem blocos de raciocínio antigos)', segundo.messages.every(m => typeof m.content === 'string'));
  confere('uma conversa só', banco.latam_chat_conversas.length === 1 && banco.latam_chat_conversas[0].mensagens === 4);
  fila.push(texto('Para Ana'));
  const roubo = await falar('Hola', { token: outra, conversa: primeira.corpo.conversa });
  confere('outra cliente com o número da conversa: ganha uma conversa NOVA', roubo.corpo.conversa !== primeira.corpo.conversa);
  confere('e não vê o histórico da primeira', globalThis.__pedidosClaude[2].messages.length === 1);
});

await cenario('6. Na tela de entrada (sem sessão)', async () => {
  preparar();
  fila.push(texto('Tranquila, te ayudo 🙏'));
  const r = await falar('No puedo entrar', { pagina: 'entrar' });
  confere('responde', r.status === 200 && r.corpo.resposta.startsWith('Tranquila'));
  const sistema = sistemaDo(globalThis.__pedidosClaude[0]);
  confere('a Lucía sabe que não sabe quem é', sistema.includes('TODAVÍA NO ENTRÓ EN LA APP') && !sistema.includes('DATOS DE LA CLIENTA'));
  confere('e não confirma e-mail de ninguém', sistema.includes('Nunca confirmes ni niegues si un correo tiene compra'));
  const conversa = banco.latam_chat_conversas[0];
  confere('a conversa fica sem cliente, marcada como "entrar"', conversa.customer_id === null && conversa.pagina === 'entrar');
  confere('guarda só a impressão digital da conexão', conversa.conexao.length === 64 && !conversa.conexao.includes('200.1.2.3'));
  fila.push(texto('Sigue'));
  const outraConexao = await falar('Hola', { conversa: r.corpo.conversa, ip: '201.9.9.9', pagina: 'entrar' });
  confere('outra conexão sem sessão não continua a conversa', outraConexao.corpo.conversa !== r.corpo.conversa);
  // Entrou no app depois: a conversa da entrada passa a ser dela.
  const token = cliente();
  fila.push(texto('¡Ya entraste!'));
  const depois = await falar('Ya entré', { token, conversa: r.corpo.conversa });
  confere('entrou no meio: a mesma conversa, agora dela', depois.corpo.conversa === r.corpo.conversa && banco.latam_chat_conversas[0].customer_id === 'c1');
});

await cenario('7. Sessão vencida ou acesso fechado = sem sessão', async () => {
  preparar();
  const token = cliente({ acesso: { status: 'revoked', expires_at: daquiA(100) } });
  fila.push(texto('ok'));
  await falar('Hola', { token });
  confere('acesso fechado: a Lucía não recebe dados da conta', !sistemaDo(globalThis.__pedidosClaude[0]).includes('DATOS DE LA CLIENTA'));
  confere('e a conversa fica sem cliente', banco.latam_chat_conversas[0].customer_id === null);
});

await cenario('8. Os presentes das 50 primeiras', async () => {
  for (const [posicao, espera, rotulo] of [
    [12, 'NO le digas que no', 'posição 12 (dentro das 50): vai para a equipe'],
    [55, 'NO le digas que no', 'posição 55 (na margem de 10): vai para a equipe'],
    [61, 'NO está entre las primeras 50', 'posição 61: fora, pode dizer'],
    [null, 'NO SE PUEDE CONFIRMAR', 'sem posição (não é compradora): vai para a equipe'],
  ]) {
    banco.latam_chat_config = []; banco.latam_customers = []; banco.latam_access = []; banco.latam_sessions = [];
    preparar({ posicao });
    const token = cliente();
    fila.push(texto('ok'));
    await falar('¿Y mi rosario?', { token });
    confere(rotulo, sistemaDo(globalThis.__pedidosClaude[0]).includes(espera));
  }
});

await cenario('9. Passar para a equipe (WhatsApp + e-mail da própria cliente)', async () => {
  preparar();
  const token = cliente();
  fila.push(
    pedeEquipe({ motivo: 'cobro', resumen: 'Dice que le cobraron dos veces 27 dólares el 9 de noviembre.', contacto: 'maria@ejemplo.com' }),
    texto('Listo, María: tu caso ya quedó con el equipo 🙏'),
  );
  const r = await falar('Me cobraron dos veces', { token });
  confere('a resposta final é a da Lucía', r.corpo.resposta.startsWith('Listo, María'));
  confere('mostra os botões da equipe', r.corpo.equipe && r.corpo.equipe.whatsapp === true);
  const pronto = r.corpo.equipe.texto || '';
  confere('a mensagem pronta nunca vai vazia: leva o resumo', pronto.includes('cobraron dos veces 27'));
  confere('leva o nome e o e-mail da compra', pronto.includes('María López') && pronto.includes('Mi correo de la compra: maria@ejemplo.com'));
  const conversa = banco.latam_chat_conversas[0];
  confere('leva o número curto do caso (o começo da conversa)', pronto.includes(`Caso: ${conversa.id.slice(0, 8)}`));
  confere('a conversa fica pendente para a equipe', conversa.equipe === 'pendente' && conversa.equipe_motivo === 'cobro' && conversa.equipe_resumo.includes('dos veces'));
  confere('nenhum serviço de e-mail é chamado', emails.length === 0 && ![...tocadas].includes('postmark'));
  const segunda = globalThis.__pedidosClaude[1];
  confere('o modelo recebe o resultado da ferramenta', segunda.messages.at(-1).content[0].type === 'tool_result');
  confere('e o resultado fala dos dois botões', segunda.messages.at(-1).content[0].content.includes('WhatsApp y correo'));
  confere('e o turno dele volta inteiro, sem mexer', segunda.messages.at(-2).role === 'assistant' && segunda.messages.at(-2).content[1].type === 'tool_use');
  confere('a mensagem da Lucía soma os tokens das duas voltas', banco.latam_chat_mensagens.at(-1).tokens_saida === 100);
});

await cenario('10. Sem login: a mensagem pronta leva o contato que ela deu', async () => {
  preparar();
  fila.push(pedeEquipe({ motivo: 'acceso', resumen: 'Rosa no encuentra su compra.', contacto: '+52 55 1234 5678' }), texto('Listo.'));
  const r = await falar('No puedo entrar', { pagina: 'entrar' });
  const pronto = r.corpo.equipe.texto || '';
  confere('sem conta: "clienta de 7 Amenes" e o contato dela', pronto.includes('clienta de 7 Amenes') && pronto.includes('Mi contacto: +52 55 1234 5678'));
  confere('o caso fica guardado com o contato', banco.latam_chat_conversas[0].equipe_contato === '+52 55 1234 5678');
});

await cenario('11. A IA falha ou recusa', async () => {
  preparar();
  const token = cliente();
  fila.push(new Error('caiu'));
  const r = await falar('Hola', { token });
  confere('falha: resposta de "fale com a equipe" + WhatsApp', r.status === 200 && r.corpo.resposta.includes('WhatsApp') && r.corpo.equipe.whatsapp === true);
  confere('a resposta de falha fica gravada', banco.latam_chat_mensagens.at(-1).texto.includes('WhatsApp'));
  fila.push({ stop_reason: 'refusal', content: [], usage: {} });
  const recusa = await falar('Hola', { token, conversa: r.corpo.conversa });
  confere('recusa: a mesma resposta segura', recusa.corpo.resposta.includes('WhatsApp') && recusa.corpo.equipe.whatsapp === true);
});

await cenario('12. Os freios', async () => {
  preparar();
  banco.latam_chat_config[0].mensagens_por_dia = 2;
  const token = cliente();
  fila.push(texto('1'), texto('2'));
  await falar('a', { token });
  await falar('b', { token });
  const terceira = await falar('c', { token });
  confere('passou do limite do dia: aviso + WhatsApp, sem IA', terceira.corpo.resposta.includes('WhatsApp') && globalThis.__pedidosClaude.length === 2);
  banco.latam_chat_config[0].mensagens_por_dia = 40;
  banco.latam_chat_config[0].conversas_por_hora = 1;
  freios = {};
  fila.push(texto('x'));
  await falar('a', { ip: '9.9.9.9', pagina: 'entrar' });
  const nova = await falar('b', { ip: '9.9.9.9', pagina: 'entrar' });
  confere('conversas novas demais na mesma conexão: aviso', nova.corpo.resposta.includes('WhatsApp') && banco.latam_chat_conversas.filter(c => !c.customer_id).length === 1);
});

await cenario('13. Haiku em vez de Sonnet', async () => {
  preparar({ modelo: 'claude-haiku-5-5' });
  fila.push(texto('ok'));
  await falar('Hola');
  const pedido = globalThis.__pedidosClaude[0];
  confere('o modelo do banco é usado', pedido.model === 'claude-haiku-5-5');
  confere('Haiku: sem a troca automática (não existe nele)', pedido.fallbacks === undefined && pedido.betas === undefined);
});

await cenario('14. Nenhuma tabela do Brasil', async () => {
  preparar();
  const token = cliente();
  fila.push(pedeEquipe({ motivo: 'otro', resumen: 'x', contacto: 'maria@ejemplo.com' }), texto('ok'));
  await falar('Hola', { token });
  const fora = [...tocadas].filter(t => !t.startsWith('latam_') && !t.startsWith('rpc/latam_') && t !== 'postmark');
  confere('só latam_ (e o Postmark)', fora.length === 0, fora.join(', '));
});

fechar();
