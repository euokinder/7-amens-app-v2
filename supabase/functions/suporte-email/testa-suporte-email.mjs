// Teste local da suporte-email (os pedidos de reembolso por e-mail, 18/11/2026)
// e do robô do Gmail (suporte/gmail-leitor.gs). Não toca em banco nenhum, nem
// na IA, nem no Gmail: os três são de mentira. Os e-mails são inventados.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/suporte-email/testa-suporte-email.mjs

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { copyFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';

const aqui = dirname(fileURLToPath(import.meta.url));
const falso = pathToFileURL(resolve(aqui, 'anthropic-falso.mjs')).href;
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('npm:@anthropic-ai/sdk')) return { url: ${JSON.stringify(falso)}, shortCircuit: true };
  return next(specifier, context);
}`)}`);

// ------------------------------------------------------------------ placar
const placar = { passou: 0, falhou: 0 };
function confere(descricao, condicao, detalhe = '') {
  if (condicao) { placar.passou += 1; console.log(`  ok    ${descricao}`); }
  else { placar.falhou += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
}

// ------------------------------------------------------- o banco de mentira
// Imita só o pedaço do PostgREST que a função usa, inclusive o 409 do
// índice único em email_message_id.
const banco = {};
const tocadas = new Set();
let comprasFalsas = {};            // `${regiao}:${email}` -> [compras]
let falharBanco = false;
function zerar() {
  for (const t of ['latam_customers', 'en_customers', 'latam_refund_requests', 'en_refund_requests']) banco[t] = [];
  tocadas.clear();
  comprasFalsas = {};
  falharBanco = false;
  globalThis.__pedidosClaude = [];
  globalThis.__claudeFalso = iaPadrao;
}
const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
function bate(linha, campo, criterio) {
  const v = linha[campo];
  if (criterio.startsWith('eq.')) return String(v) === criterio.slice(3);
  if (criterio === 'is.null') return v === null || v === undefined;
  throw new Error(`filtro não suportado ${campo}=${criterio}`);
}
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const tabela = u.pathname.replace(/^\/rest\/v1\//, '');
  tocadas.add(tabela);
  if (falharBanco) return new Response('{"message":"fora"}', { status: 500 });
  const metodo = init.method || 'GET';
  const corpo = init.body ? JSON.parse(init.body) : null;
  const m = tabela.match(/^rpc\/(latam|en)_reembolso_compras$/);
  if (m) return json((comprasFalsas[`${m[1]}:${corpo.p_email}`] || []).map(c => ({ ...c })));
  if (!(tabela in banco)) return new Response(`{"message":"relation ${tabela} does not exist"}`, { status: 404 });
  const filtros = [...u.searchParams].filter(([c]) => !['select', 'order', 'limit'].includes(c));
  let linhas = banco[tabela].filter(l => filtros.every(([c, v]) => bate(l, c, v)));
  if (metodo === 'GET') {
    const ordem = u.searchParams.get('order');
    if (ordem) { const [c, s] = ordem.split('.'); linhas = [...linhas].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (s === 'desc' ? -1 : 1)); }
    const limite = u.searchParams.get('limit');
    return json(linhas.slice(0, limite ? Number(limite) : undefined).map(l => ({ ...l })));
  }
  if (metodo === 'POST') {
    for (const r of Array.isArray(corpo) ? corpo : [corpo]) {
      if (r.email_message_id && banco[tabela].some(l => l.email_message_id === r.email_message_id)) return new Response('{"code":"23505"}', { status: 409 });
      banco[tabela].push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), status: 'pendente', nota: '', itens: [], motivo: null, ...r });
    }
    return new Response(null, { status: 201 });
  }
  if (metodo === 'PATCH') {
    if (corpo.email_message_id && banco[tabela].some(l => l.email_message_id === corpo.email_message_id && !linhas.includes(l))) return new Response('{"code":"23505"}', { status: 409 });
    for (const l of linhas) Object.assign(l, corpo);
    return new Response(null, { status: 204 });
  }
  return json([]);
};

// ------------------------------------------------------- a função, em Node
let ambiente = {};
const manipuladores = [];
globalThis.Deno = { env: { get: n => ambiente[n] }, serve: h => { manipuladores.push(h); } };
async function carregar(env) {
  ambiente = env;
  const pasta = mkdtempSync(join(tmpdir(), 'suporte-'));
  const copia = join(pasta, `funcao-${manipuladores.length}.ts`);
  copyFileSync(resolve(aqui, 'index.ts'), copia);
  const modulo = await import(pathToFileURL(copia).href);
  rmSync(pasta, { recursive: true, force: true });
  return { serve: manipuladores.at(-1), modulo };
}
const PROD = 'https://lbaudlocfbjunnaoyrtz.supabase.co';
const { serve: api, modulo } = await carregar({ SUPABASE_URL: PROD, SUPABASE_SERVICE_ROLE_KEY: 'x', SUPORTE_EMAIL_TOKEN: 'token-do-teste', ANTHROPIC_API_KEY: 'sk-falsa' });
const { serve: apiSemSegredo } = await carregar({ SUPABASE_URL: PROD, SUPABASE_SERVICE_ROLE_KEY: 'x', ANTHROPIC_API_KEY: 'sk-falsa' });
const { serve: apiSemIA } = await carregar({ SUPABASE_URL: PROD, SUPABASE_SERVICE_ROLE_KEY: 'x', SUPORTE_EMAIL_TOKEN: 'token-do-teste' });
const { serve: apiTeste } = await carregar({ SUPABASE_URL: 'https://wyiqwsgfictcfkytldnu.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'x', ANTHROPIC_API_KEY: 'sk-falsa' });

async function chamar(corpo, { token = 'token-do-teste', fn = api, metodo = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-suporte-token'] = token;
  const r = await fn(new Request('https://exemplo/suporte-email', { method: metodo, headers, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined }));
  return { status: r.status, corpo: await r.json() };
}

// ------------------------------------------------------------ a IA de mentira
// Lê o e-mail no pedido e decide pelas palavras, como um classificador simples.
function respostaIA(dados) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(dados) }], usage: { input_tokens: 700, output_tokens: 80 } };
}
function iaPadrao(params) {
  const t = params.messages[0].content.toLowerCase();
  const reembolso = /reembolso|devoluci|refund|no reconozco|banco/.test(t);
  const citado = (t.match(/mi correo de compra es ([^\s<]+@[^\s<]+)/) || [])[1] || '';
  return respostaIA({
    e_reembolso: reembolso,
    tipo: !reembolso ? 'nenhum' : /banco/.test(t) ? 'amenaza_banco' : /no reconozco/.test(t) ? 'no_reconoce' : 'pedido_reembolso',
    motivo: /no pude entrar/.test(t) ? 'no_pude_entrar' : /sin querer/.test(t) ? 'extra_sin_querer' : 'otro',
    resumo: reembolso ? 'Cliente pede o dinheiro de volta.' : '-',
    email_da_compra: citado,
    produtos: /arc[áa]ngeles/.test(t) ? ['arcangeles'] : [],
  });
}

const ontem = new Date(Date.now() - 86_400_000).toISOString();
const COMPRA_PRINCIPAL = { pedido: 'pay_AAAAAA111', origem: 'whop', produto: 'principal', nombre: '7 Amenes de la Madrugada', valor_cents: 2100, moneda: 'USD', pagado_en: ontem, devuelto: false, pedido_abierto: false };
const COMPRA_ARCANJOS = { pedido: 'kashpay:tx-0001', origem: 'kashpay', produto: 'arcangeles', nombre: 'Oraciones a los Santos Arcángeles', valor_cents: 6900, moneda: 'USD', pagado_en: ontem, devuelto: false, pedido_abierto: false };
const email = (id, de, textoDoEmail, extra = {}) => ({
  id, de, assunto: 'Ayuda', texto: textoDoEmail, recebido_em: new Date().toISOString(), link: `https://mail.google.com/mail/#all/t${id}`, ...extra,
});
const todasAsLinhas = () => [...banco.latam_refund_requests, ...banco.en_refund_requests];
const soTabelasPermitidas = () => [...tocadas].every(t => /^(rpc\/)?(latam|en)_/.test(t));

async function cenario(titulo, corpo) { zerar(); console.log(`\n${titulo}`); await corpo(); }

// ======================================================================
await cenario('Portão: só o robô com o segredo entra', async () => {
  confere('sem token: 401', (await chamar({ caixa: 'soporte', emails: [] }, { token: '' })).status === 401);
  confere('token errado: 401', (await chamar({ caixa: 'soporte', emails: [] }, { token: 'outro' })).status === 401);
  confere('GET: 405', (await chamar(null, { metodo: 'GET' })).status === 405);
  confere('produção sem o segredo: desligada (503)', (await chamar({ caixa: 'soporte', emails: [] }, { fn: apiSemSegredo })).status === 503);
  confere('banco de teste sem o segredo: aceita o token de ensaio', (await chamar({ caixa: 'soporte', emails: [] }, { fn: apiTeste, token: 'ensaio-do-leitor' })).status === 200);
  confere('caixa desconhecida: 400', (await chamar({ caixa: 'brasil', emails: [] })).status === 400);
  const grande = Array.from({ length: 21 }, (_, i) => email(`msg0000${i}x`, 'a@exemplo.com', 'hola'));
  confere('lote de 21: 400', (await chamar({ caixa: 'soporte', emails: grande })).status === 400);
  confere('nada foi lido do banco', tocadas.size === 0);
});

await cenario('E-mail que não é pedido de reembolso: nada é gravado', async () => {
  const r = await chamar({ caixa: 'soporte', emails: [email('msgNaoEh01', 'ana@exemplo.com', 'Gracias por las oraciones, ¿a qué hora rezo?')] });
  confere('respondeu ignorado', r.corpo.resultados[0].situacao === 'ignorado', JSON.stringify(r.corpo));
  confere('a IA foi chamada uma vez, com o modelo barato', globalThis.__pedidosClaude.length === 1 && globalThis.__pedidosClaude[0].model === 'claude-haiku-5-5');
  confere('pediu JSON com esquema e esforço baixo', globalThis.__pedidosClaude[0].output_config?.format?.type === 'json_schema' && globalThis.__pedidosClaude[0].output_config.effort === 'low');
  confere('nenhum pedido gravado', todasAsLinhas().length === 0);
  confere('nem a cliente foi procurada', ![...tocadas].some(t => t.startsWith('rpc/')));
});

await cenario('Robô e e-mail vazio nem passam pela IA', async () => {
  const r = await chamar({ caixa: 'soporte', emails: [
    email('msgRobo001', 'no-reply@plataforma.exemplo', 'Quiero un reembolso'),
    email('msgVazio01', 'ana@exemplo.com', '', { assunto: '' }),
    { id: 'msgSemData', de: 'ana@exemplo.com', texto: 'reembolso' },
    { id: '../ruim', de: 'ana@exemplo.com', texto: 'reembolso', recebido_em: ontem },
  ] });
  confere('robô, vazio e sem data: ignorados', r.corpo.resultados.filter(x => x.situacao === 'ignorado').length === 3, JSON.stringify(r.corpo.resultados));
  confere('id inválido: fora da resposta', r.corpo.resultados.length === 3);
  confere('a IA não foi chamada', globalThis.__pedidosClaude.length === 0);
});

await cenario('Pedido na caixa LATAM, com a compra achada', async () => {
  banco.latam_customers.push({ id: 'cli-1', email: 'maria@exemplo.com' });
  comprasFalsas['latam:maria@exemplo.com'] = [COMPRA_PRINCIPAL, COMPRA_ARCANJOS];
  const corpoDoEmail = 'Quiero el reembolso, no pude entrar.\n\nEl lun, 17 nov 2026 a las 10:00, Soporte <soporte@exemplo.com> escribió:\n> Hola, ¿en qué te ayudamos?\n> Saludos';
  const r = await chamar({ caixa: 'soporte', emails: [email('msgMaria01', 'Maria@Exemplo.com', corpoDoEmail)] });
  confere('criado na LATAM', r.corpo.resultados[0].situacao === 'criado' && r.corpo.resultados[0].regiao === 'latam', JSON.stringify(r.corpo));
  const p = banco.latam_refund_requests[0];
  confere('um pedido só', todasAsLinhas().length === 1);
  confere('ligado à cliente, com o e-mail da compra', p.customer_id === 'cli-1' && p.email === 'maria@exemplo.com');
  confere('itens no formato da página (sem devuelto/pedido_abierto)', p.itens.length === 2 && p.itens[0].pedido === 'pay_AAAAAA111'
    && Object.keys(p.itens[0]).sort().join() === 'moneda,nombre,origem,pagado_en,pedido,produto,valor_cents');
  confere('o nome do produto é o da busca de compras (o mesmo que a página grava)',
    p.itens[0].nombre === '7 Amenes de la Madrugada' && p.itens[1].nombre === 'Oraciones a los Santos Arcángeles', JSON.stringify(p.itens.map(i => i.nombre)));
  confere('total e moeda', p.total_cents === 9000 && p.moneda === 'USD');
  confere('canal email, sin_compra false, motivo da IA', p.canal === 'email' && p.sin_compra === false && p.motivo === 'no_pude_entrar' && p.motivo_en);
  confere('colunas do e-mail', p.email_tipo === 'pedido_reembolso' && p.email_resumo && p.email_caixa === 'soporte'
    && p.email_message_id === 'soporte:msgMaria01' && p.email_de === 'maria@exemplo.com' && p.email_link.includes('msgMaria01') && p.email_recebido_em);
  confere('o trecho não leva a citação', p.email_trecho === 'Quiero el reembolso, no pude entrar.', JSON.stringify(p.email_trecho));
  confere('a IA também não recebeu a citação', !globalThis.__pedidosClaude[0].messages[0].content.includes('en qué te ayudamos'));
  confere('nenhuma tabela do Brasil tocada', soTabelasPermitidas(), [...tocadas].join());

  // O mesmo e-mail de novo: não chama a IA nem duplica.
  const antes = globalThis.__pedidosClaude.length;
  const de2 = await chamar({ caixa: 'soporte', emails: [email('msgMaria01', 'maria@exemplo.com', corpoDoEmail)] });
  confere('o mesmo e-mail de novo: repetido', de2.corpo.resultados[0].situacao === 'repetido');
  confere('sem chamar a IA', globalThis.__pedidosClaude.length === antes);
  confere('continua um pedido só', todasAsLinhas().length === 1);

  // Outro e-mail dela: completa o pedido aberto.
  const de3 = await chamar({ caixa: 'soporte', emails: [email('msgMaria02', 'maria@exemplo.com', 'Otra vez: quiero mi reembolso ya o voy al banco')] });
  confere('segundo e-mail: completado', de3.corpo.resultados[0].situacao === 'completado', JSON.stringify(de3.corpo));
  confere('não criou outro pedido', todasAsLinhas().length === 1);
  confere('não trocou o que já estava preenchido', p.email_message_id === 'soporte:msgMaria01' && p.email_tipo === 'pedido_reembolso' && p.motivo === 'no_pude_entrar');
  confere('acrescentou uma linha na nota, com a marca do e-mail', /ameaça de ir ao banco/.test(p.nota) && p.nota.includes('[msg msgMaria02]'), p.nota);
  const de4 = await chamar({ caixa: 'soporte', emails: [email('msgMaria02', 'maria@exemplo.com', 'Otra vez: quiero mi reembolso ya o voy al banco')] });
  confere('o segundo e-mail de novo: repetido, sem outra linha', de4.corpo.resultados[0].situacao === 'repetido' && p.nota.split('[msg msgMaria02]').length === 2);
});

await cenario('Pedido pendente sem compra é completado com a compra', async () => {
  banco.latam_customers.push({ id: 'cli-2', email: 'rosa@exemplo.com' });
  banco.latam_refund_requests.push({ id: 'p-1', created_at: ontem, email: 'rosa@exemplo.com', customer_id: 'cli-2', itens: [], total_cents: 0, moneda: 'USD',
    sin_compra: true, motivo: null, status: 'pendente', nota: 'Pedido pela página.', canal: 'pagina', email_tipo: null });
  comprasFalsas['latam:rosa@exemplo.com'] = [COMPRA_PRINCIPAL];
  const r = await chamar({ caixa: 'soporte', emails: [email('msgRosa001', 'rosa@exemplo.com', 'Quiero un reembolso')] });
  const p = banco.latam_refund_requests[0];
  confere('completado', r.corpo.resultados[0].situacao === 'completado');
  confere('itens, total e sin_compra preenchidos', p.itens.length === 1 && p.total_cents === 2100 && p.sin_compra === false);
  confere('canal continua o da página', p.canal === 'pagina');
  confere('colunas do e-mail preenchidas', p.email_message_id === 'soporte:msgRosa001' && p.email_tipo === 'pedido_reembolso');
  confere('nota antiga mantida, linha nova embaixo', p.nota.startsWith('Pedido pela página.\nE-mail '), p.nota);
});

await cenario('Caixa dos EUA: acha na LATAM; não achando nada, grava sem compra nos EUA', async () => {
  comprasFalsas['latam:lucia@exemplo.com'] = [COMPRA_PRINCIPAL];
  banco.latam_customers.push({ id: 'cli-3', email: 'lucia@exemplo.com' });
  const r = await chamar({ caixa: 'eua', emails: [
    email('msgLucia01', 'lucia@exemplo.com', 'I want a refund please'),
    email('msgJohn001', 'john@exemplo.com', 'Refund now'),
  ] });
  confere('Lucia: criado na LATAM (recurso para a outra região)', r.corpo.resultados[0].regiao === 'latam' && banco.latam_refund_requests.length === 1);
  confere('a busca começou pelos EUA', [...tocadas].indexOf('rpc/en_reembolso_compras') < [...tocadas].indexOf('rpc/latam_reembolso_compras'));
  const j = banco.en_refund_requests[0];
  confere('John: criado nos EUA, sin_compra, e-mail = remetente', r.corpo.resultados[1].regiao === 'en' && j && j.sin_compra === true && j.email === 'john@exemplo.com' && j.itens.length === 0);
  confere('caixa eua anotada', j.email_caixa === 'eua' && j.email_message_id === 'eua:msgJohn001');
});

await cenario('Ela cita outro e-mail da compra', async () => {
  comprasFalsas['latam:compra@exemplo.com'] = [COMPRA_ARCANJOS];
  const r = await chamar({ caixa: 'soporte', emails: [email('msgCita001', 'filho@exemplo.com', 'Quiero reembolso. Mi correo de compra es compra@exemplo.com')] });
  const p = banco.latam_refund_requests[0];
  confere('achou pela compra citada', r.corpo.resultados[0].situacao === 'criado' && p.email === 'compra@exemplo.com' && p.itens.length === 1);
  confere('o remetente fica em email_de', p.email_de === 'filho@exemplo.com');
  // Citou um que não tem compra: grava pelo remetente e anota na nota.
  const r2 = await chamar({ caixa: 'soporte', emails: [email('msgCita002', 'tia@exemplo.com', 'Quiero reembolso. Mi correo de compra es nada@exemplo.com')] });
  const p2 = banco.latam_refund_requests.find(x => x.email_message_id === 'soporte:msgCita002');
  confere('sem compra: e-mail = remetente, citado na nota', r2.corpo.resultados[0].situacao === 'criado' && p2.email === 'tia@exemplo.com' && p2.sin_compra && p2.nota.includes('nada@exemplo.com'));
});

await cenario('Ela pede só um produto', async () => {
  comprasFalsas['latam:paz@exemplo.com'] = [COMPRA_PRINCIPAL, COMPRA_ARCANJOS];
  await chamar({ caixa: 'soporte', emails: [email('msgPaz0001', 'paz@exemplo.com', 'Compré los arcángeles sin querer, quiero el reembolso de eso')] });
  const p = banco.latam_refund_requests[0];
  confere('só os Arcanjos no pedido', p.itens.length === 1 && p.itens[0].produto === 'arcangeles' && p.total_cents === 6900);
  confere('motivo extra_sin_querer', p.motivo === 'extra_sin_querer');
});

await cenario('Varredura inicial: o que já foi devolvido é descartado', async () => {
  comprasFalsas['latam:velha@exemplo.com'] = [{ ...COMPRA_PRINCIPAL, devuelto: true }];
  banco.latam_refund_requests.push({ id: 'p-9', created_at: ontem, resuelto_en: ontem, email: 'feita@exemplo.com', status: 'feito', itens: [], nota: '' });
  comprasFalsas['latam:feita@exemplo.com'] = [COMPRA_PRINCIPAL];
  const r = await chamar({ caixa: 'soporte', varredura_inicial: true, emails: [
    email('msgVelha01', 'velha@exemplo.com', 'Quiero reembolso', { recebido_em: ontem }),
    email('msgFeita01', 'feita@exemplo.com', 'Quiero reembolso', { recebido_em: ontem }),
    email('msgNova001', 'nova@exemplo.com', 'Quiero reembolso', { recebido_em: ontem }),
  ] });
  const s = r.corpo.resultados.map(x => x.situacao).join();
  confere('devolvida na plataforma e pedido feito: descartados; o resto entra', s === 'descartado,descartado,criado', s);
  confere('só um pedido novo', banco.latam_refund_requests.filter(x => x.canal === 'email').length === 1);
  // Fora da varredura, o já devolvido entra (o painel marca "devolvido").
  const r2 = await chamar({ caixa: 'soporte', emails: [email('msgVelha02', 'velha@exemplo.com', 'Quiero reembolso')] });
  const p = banco.latam_refund_requests.find(x => x.email_message_id === 'soporte:msgVelha02');
  confere('fora da varredura: entra com a compra', r2.corpo.resultados[0].situacao === 'criado' && p.itens.length === 1);
});

await cenario('Falhas: a IA, a chave e o banco', async () => {
  globalThis.__claudeFalso = () => { throw new (class extends Error { constructor() { super('overloaded'); this.status = 529; } })(); };
  let r = await chamar({ caixa: 'soporte', emails: [email('msgFalha01', 'ana@exemplo.com', 'reembolso')] });
  confere('IA fora: erro (o robô tenta de novo)', r.status === 200 && r.corpo.resultados[0].situacao === 'erro');
  globalThis.__claudeFalso = () => ({ stop_reason: 'refusal', content: [] });
  r = await chamar({ caixa: 'soporte', emails: [email('msgFalha02', 'ana@exemplo.com', 'reembolso')] });
  confere('IA recusou: erro', r.corpo.resultados[0].situacao === 'erro');
  globalThis.__claudeFalso = () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'não é json' }] });
  r = await chamar({ caixa: 'soporte', emails: [email('msgFalha03', 'ana@exemplo.com', 'reembolso')] });
  confere('IA respondeu fora do formato: erro', r.corpo.resultados[0].situacao === 'erro');
  r = await chamar({ caixa: 'soporte', emails: [email('msgFalha04', 'ana@exemplo.com', 'reembolso')] }, { fn: apiSemIA });
  confere('sem a chave da IA: erro, nada gravado', r.corpo.resultados[0].situacao === 'erro' && todasAsLinhas().length === 0);
  globalThis.__claudeFalso = iaPadrao;
  falharBanco = true;
  r = await chamar({ caixa: 'soporte', emails: [email('msgFalha05', 'ana@exemplo.com', 'reembolso')] });
  confere('banco fora: erro naquele e-mail, a função responde', r.status === 200 && r.corpo.resultados[0].situacao === 'erro');
});

await cenario('Lote misturado, em paralelo', async () => {
  const lote = Array.from({ length: 12 }, (_, i) => email(`msgLote${String(i).padStart(3, '0')}`, `p${i}@exemplo.com`, i % 2 ? 'Quiero reembolso' : 'Gracias'));
  const r = await chamar({ caixa: 'soporte', emails: lote });
  confere('12 respostas, na ordem', r.corpo.resultados.length === 12 && r.corpo.resultados.every((x, i) => x.id === lote[i].id));
  confere('6 criados, 6 ignorados', r.corpo.conta.criado === 6 && r.corpo.conta.ignorado === 6, JSON.stringify(r.corpo.conta));
  confere('nenhuma tabela do Brasil tocada', soTabelasPermitidas());
});

await cenario('Dois e-mails da mesma cliente no mesmo lote: um pedido só', async () => {
  comprasFalsas['latam:irma@exemplo.com'] = [COMPRA_PRINCIPAL];
  const r = await chamar({ caixa: 'soporte', emails: [
    email('msgIrma002', 'irma@exemplo.com', 'Quiero reembolso o voy al banco', { recebido_em: new Date(Date.now() - 60_000).toISOString() }),
    email('msgIrma001', 'irma@exemplo.com', 'Quiero reembolso', { recebido_em: new Date(Date.now() - 120_000).toISOString() }),
    email('msgIrma003', 'irma@exemplo.com', 'Quiero reembolso ya', { recebido_em: new Date().toISOString() }),
  ] });
  confere('um pedido só', banco.latam_refund_requests.length === 1, String(banco.latam_refund_requests.length));
  confere('o mais antigo cria, os outros completam', r.corpo.resultados.map(x => x.situacao).join() === 'completado,criado,completado', JSON.stringify(r.corpo.resultados));
  const p = banco.latam_refund_requests[0];
  confere('a etiqueta é a do primeiro e-mail; a ameaça fica na nota', p.email_message_id === 'soporte:msgIrma001' && /ameaça de ir ao banco/.test(p.nota));
});

await cenario('O corte da citação', async () => {
  const { semCitacao } = modulo;
  confere('resposta do Gmail em inglês', semCitacao('Refund please\n\nOn Mon, Nov 17, 2026 at 10:00 AM Support <s@exemplo.com> wrote:\n> old') === 'Refund please');
  confere('cabeçalho quebrado em duas linhas', semCitacao('Hola\nEl lun, 17 nov 2026, Soporte <s@exemplo.com>\nescribió:\n> viejo') === 'Hola\nEl lun, 17 nov 2026, Soporte <s@exemplo.com>');
  confere('mensagem original do Outlook', semCitacao('Hola\n-----Mensaje original-----\nDe: x') === 'Hola');
  confere('bloco De: do Outlook', semCitacao('Hola\n\nDe: Soporte <s@exemplo.com>\nEnviado: lunes') === 'Hola');
  confere('assinatura do iPhone', semCitacao('Hola\n\nEnviado desde mi iPhone') === 'Hola');
  confere('texto sem citação fica igual', semCitacao('Uno\n\nDos') === 'Uno\n\nDos');
});

// ======================================================================
// O robô do Gmail (suporte/gmail-leitor.gs), com o Google de mentira.
// ======================================================================
const codigoDoRobo = readFileSync(resolve(aqui, '../../../suporte/gmail-leitor.gs'), 'utf8');
function montarGoogle({ mensagens, eu = 'soporte@exemplo.com', props = {}, responder }) {
  const propriedades = { CAIXA: 'soporte', SUPORTE_EMAIL_TOKEN: 'token-do-teste', ...props };
  const chamadas = [];
  const gatilhos = [];
  const consultas = [];
  const sandbox = {
    Logger: { log: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in propriedades ? propriedades[k] : null), setProperty: (k, v) => { propriedades[k] = String(v); } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => eu }) },
    ScriptApp: {
      getProjectTriggers: () => gatilhos,
      newTrigger: nome => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => gatilhos.push({ getHandlerFunction: () => nome }) }) }) }),
      deleteTrigger: t => gatilhos.splice(gatilhos.indexOf(t), 1),
    },
    GmailApp: {
      getAliases: () => ['alias@exemplo.com'],
      search: (consulta, inicio) => {
        consultas.push(consulta);
        const desde = Number(consulta.match(/after:(\d+)/)[1]) * 1000;
        const porConversa = {};
        for (const m of mensagens) if (m.quando >= desde) (porConversa[m.conversa] ||= []).push(m);
        return Object.entries(porConversa).slice(inicio, inicio + 100).map(([id, lista]) => ({
          getId: () => id,
          getMessages: () => lista.map(m => ({
            getId: () => m.id, getDate: () => new Date(m.quando), getFrom: () => m.de, getSubject: () => m.assunto || 'Hola',
            getPlainBody: () => m.texto || '', getHeader: h => (m.headers || {})[h] || '',
          })),
        }));
      },
    },
    UrlFetchApp: {
      fetch: (url, opcoes) => {
        const corpo = JSON.parse(opcoes.payload);
        chamadas.push({ url, token: opcoes.headers['x-suporte-token'], corpo });
        const r = responder(corpo);
        return { getResponseCode: () => r.status, getContentText: () => JSON.stringify(r.corpo || {}) };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(codigoDoRobo, sandbox);
  return { sandbox, propriedades, chamadas, gatilhos, consultas };
}
const tudoOk = corpo => ({ status: 200, corpo: { ok: true, resultados: corpo.emails.map(e => ({ id: e.id, situacao: 'ignorado' })) } });
const MIN = 60_000;

await cenario('Robô: primeira vez lê 7 dias, pula a própria caixa e robôs, separa a varredura', async () => {
  const agora = Date.now();
  const mensagens = [
    { id: 'm1', conversa: 't1', quando: agora - 3 * 86_400_000, de: 'Ana <ana@exemplo.com>', texto: 'Quiero reembolso\n\nEl lun, X escribió:\n> viejo' },
    { id: 'm0', conversa: 't0', quando: agora - 9 * 86_400_000, de: 'velha@exemplo.com' },
    { id: 'm2', conversa: 't2', quando: agora - 2 * 86_400_000, de: 'Soporte <soporte@exemplo.com>' },
    { id: 'm3', conversa: 't3', quando: agora - 86_400_000, de: 'Whop <noreply@whop.com>' },
    { id: 'm4', conversa: 't4', quando: agora - 86_400_000, de: 'Boletim <news@exemplo.com>', headers: { 'List-Unsubscribe': '<x>' } },
    { id: 'm5', conversa: 't5', quando: agora - 86_400_000, de: 'Automação <robo@lucas.exemplo>' },
    { id: 'm6', conversa: 't6', quando: agora - 5 * MIN, de: 'alias@exemplo.com' },
  ];
  const g = montarGoogle({ mensagens, props: { IGNORAR: 'lucas.exemplo' }, responder: tudoOk });
  g.sandbox.instalar();
  confere('criou o gatilho de 10 em 10 min, uma vez', g.gatilhos.length === 1);
  g.sandbox.instalar();
  confere('instalar de novo não duplica o gatilho', g.gatilhos.length === 1);
  const primeira = g.chamadas[0];
  confere('mandou com o token, para a produção', primeira.token === 'token-do-teste' && primeira.url.includes('lbaudlocfbjunnaoyrtz'));
  confere('só a cliente foi enviada (caixa, alias, robô, boletim e IGNORAR pulados)', g.chamadas.length === 1 && primeira.corpo.emails.length === 1 && primeira.corpo.emails[0].id === 'm1', JSON.stringify(g.chamadas.map(c => c.corpo.emails.map(e => e.id))));
  confere('o e-mail de 9 dias atrás ficou de fora', !g.chamadas.some(c => c.corpo.emails.some(e => e.id === 'm0')));
  confere('marcado como varredura inicial', primeira.corpo.varredura_inicial === true && primeira.corpo.caixa === 'soporte');
  confere('remetente limpo e citação cortada', primeira.corpo.emails[0].de === 'ana@exemplo.com' && primeira.corpo.emails[0].texto === 'Quiero reembolso');
  confere('link para a conversa', primeira.corpo.emails[0].link.endsWith('#all/t1'));
  confere('a busca não inclui enviados, spam e lixeira', /-in:sent/.test(g.consultas[0]) && /-in:spam/.test(g.consultas[0]) && /-in:trash/.test(g.consultas[0]));
  confere('o token não fica no arquivo do robô', !/token-do-teste/.test(codigoDoRobo));
  g.sandbox.desinstalar();
  confere('desinstalar apaga o gatilho', g.gatilhos.length === 0);
});

await cenario('Robô: e-mail novo depois da instalação; nunca manda duas vezes', async () => {
  const agora = Date.now();
  const mensagens = [];
  const g = montarGoogle({ mensagens, props: { INSTALADO_EM: String(agora - 30 * MIN), CURSOR: String(agora - 30 * MIN) }, responder: tudoOk });
  mensagens.push({ id: 'n1', conversa: 'u1', quando: agora - 10 * MIN, de: 'nova@exemplo.com', texto: 'refund' });
  g.sandbox.ler();
  confere('mandou o novo, fora da varredura', g.chamadas.length === 1 && g.chamadas[0].corpo.varredura_inicial === false);
  g.sandbox.ler();
  confere('na volta seguinte, não manda de novo', g.chamadas.length === 1);
  mensagens.push({ id: 'n2', conversa: 'u1', quando: agora - 2 * MIN, de: 'nova@exemplo.com', texto: 'refund 2' });
  g.sandbox.ler();
  confere('a resposta nova na mesma conversa vai sozinha', g.chamadas.length === 2 && g.chamadas[1].corpo.emails.map(e => e.id).join() === 'n2');
  confere('lembrança pequena (cabe nas propriedades)', g.propriedades.VISTOS.length < 9000);
});

await cenario('Robô: falha da função e erro de um e-mail', async () => {
  const agora = Date.now();
  const mensagens = [
    { id: 'f1', conversa: 'v1', quando: agora - 20 * MIN, de: 'a@exemplo.com' },
    { id: 'f2', conversa: 'v2', quando: agora - 15 * MIN, de: 'b@exemplo.com' },
  ];
  let fora = true;
  let erroEm = 'f1';
  const g = montarGoogle({ mensagens, props: { INSTALADO_EM: String(agora - 60 * MIN), CURSOR: String(agora - 60 * MIN) }, responder: corpo => {
    if (fora) return { status: 503, corpo: { error: 'fora' } };
    return { status: 200, corpo: { ok: true, resultados: corpo.emails.map(e => ({ id: e.id, situacao: e.id === erroEm ? 'erro' : 'criado' })) } };
  } });
  const cursorAntes = g.propriedades.CURSOR;
  g.sandbox.ler();
  confere('função fora: o cursor não passa do primeiro e-mail pendente', Number(g.propriedades.CURSOR) <= agora - 20 * MIN && Number(g.propriedades.CURSOR) >= Number(cursorAntes));
  confere('função fora: nada fica marcado como visto', !JSON.parse(g.propriedades.VISTOS).f1);
  fora = false;
  g.sandbox.ler();
  confere('voltou: manda os dois', g.chamadas.at(-1).corpo.emails.length === 2);
  confere('f1 deu erro: o cursor para nele', Number(g.propriedades.CURSOR) === agora - 20 * MIN);
  g.sandbox.ler();
  confere('na volta seguinte, só o f1 vai de novo', g.chamadas.at(-1).corpo.emails.map(e => e.id).join() === 'f1');
  g.sandbox.ler();
  confere('na 3ª falha, desiste do f1 e o cursor passa dele', Number(g.propriedades.CURSOR) > agora - 20 * MIN);
  const n = g.chamadas.length;
  g.sandbox.ler();
  confere('e não manda mais nada', g.chamadas.length === n);
  confere('as falhas são esquecidas', g.propriedades.FALHAS === '{}');
});

await cenario('Robô: sem a CAIXA ou sem o token, para com aviso', async () => {
  const g = montarGoogle({ mensagens: [], props: { CAIXA: null }, responder: tudoOk });
  let erro = '';
  try { g.sandbox.instalar(); } catch (e) { erro = e.message; }
  confere('sem CAIXA: avisa e não instala', /CAIXA/.test(erro) && g.gatilhos.length === 0);
});

console.log(`\n${placar.passou} conferências ok, ${placar.falhou} falharam.`);
process.exit(placar.falhou ? 1 : 0);
