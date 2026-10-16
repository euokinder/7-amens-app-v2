// Teste local do webhook da Payt — não toca em banco nenhum.
//
// Sobe a função num banco de mentira e manda avisos no formato do "Guia do
// Postback PayT": venda, upsell do funil, reembolso, chargeback, código
// desconhecido, aviso repetido, corrida entre dois avisos e as falhas que já
// custaram uma venda na Hubla.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/payt-webhook/testa-webhook.mjs

import { pathToFileURL } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2] ? resolve(process.argv[2]) : resolve(aqui, 'index.ts');

const PRODUCAO = 'http://banco-falso-producao';
const TESTE = 'http://banco-falso-wyiqwsgfictcfkytldnu';
const CHAVE = 'chave-unica-de-teste';

// ---------------------------------------------------------------- banco falso

const banco = {};
let falhas = [];
let chamadas = [];

// O que cada tabela não aceita repetido: a chave principal e as outras travas
// "unique". Como no banco de verdade, o "ignorar repetido" (resolution) só
// vale para a trava que o on_conflict nomeia — sem ele, só para a chave
// principal; repetição em outra trava é 409. Foi exatamente isso que o
// primeiro aviso de verdade da Payt mostrou, em 16/10/2026.
const TRAVAS = {
  payt_events: { principal: ['id'], outras: [['idempotency_key']] },
  customers: { principal: ['id'], outras: [['email']] },
  entitlements: { principal: ['customer_id', 'product_key'], outras: [] },
};

function zerarBanco() {
  banco.payt_events = [];
  banco.customers = [];
  banco.entitlements = [];
  banco.payt_product_map = [
    { payt_code: '4Z3WGM', product_key: 'principal' },
    { payt_code: 'RKBQN6', product_key: 'upsell_01' },
    { payt_code: 'R6VDGP', product_key: 'upsell_01' },
    { payt_code: 'LP39N8', product_key: 'upsell_02' },
  ];
  banco.products = [
    { key: 'principal', unlocks_app: true },
    { key: 'upsell_01', unlocks_app: false },
    { key: 'upsell_02', unlocks_app: false },
  ];
  falhas = [];
  chamadas = [];
}

const uuid = () => 'id-' + Math.random().toString(16).slice(2, 10);

function filtrar(linhas, params) {
  return linhas.filter(linha => {
    for (const [campo, criterio] of params) {
      if (['select', 'limit', 'order', 'on_conflict'].includes(campo)) continue;
      if (criterio.startsWith('eq.')) {
        if (String(linha[campo]) !== criterio.slice(3)) return false;
      } else if (criterio.startsWith('neq.')) {
        if (String(linha[campo]) === criterio.slice(4)) return false;
      } else if (criterio.startsWith('in.(')) {
        const valores = criterio.slice(4, -1).split(',').map(decodeURIComponent);
        if (!valores.includes(String(linha[campo]))) return false;
      } else if (criterio === 'is.true') {
        if (linha[campo] !== true) return false;
      }
    }
    return true;
  });
}

function respostaJson(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET';
  const prefer = (init.headers && init.headers.Prefer) || '';
  const caminho = String(url).replace(/^http:\/\/[^/]+\/rest\/v1\//, '');
  const [tabela, consulta = ''] = caminho.split('?');
  const params = [...new URLSearchParams(consulta)];
  chamadas.push({ tabela, method, prefer, caminho });

  const falha = falhas.find(f => (f.vezes === undefined || f.vezes > 0) && f.quando({ tabela, method, prefer, caminho }));
  if (falha) {
    if (falha.vezes !== undefined) falha.vezes -= 1;
    if (falha.antes) falha.antes();
    if (falha.status === 'rede') throw new Error('conexão recusada');
    return new Response('{"message":"falha forcada"}', { status: falha.status });
  }

  if (!(tabela in banco)) return new Response('{"message":"relation does not exist"}', { status: 404 });
  const linhas = banco[tabela];
  const corpo = init.body ? JSON.parse(init.body) : null;

  if (method === 'GET') {
    let achadas = filtrar(linhas, params);
    const limite = params.find(([c]) => c === 'limit');
    if (limite) achadas = achadas.slice(0, Number(limite[1]));
    return respostaJson(achadas.map(linha => ({ ...linha })));
  }

  if (method === 'POST') {
    const registros = Array.isArray(corpo) ? corpo : [corpo];
    const salvas = [];
    const travas = TRAVAS[tabela] || { principal: ['id'], outras: [] };
    const alvo = ((params.find(([c]) => c === 'on_conflict') || [])[1] || travas.principal.join(',')).split(',');
    for (const registro of registros) {
      let existente = null;
      let travaBatida = null;
      for (const trava of [travas.principal, ...travas.outras]) {
        if (trava.some(coluna => registro[coluna] === undefined)) continue;
        existente = linhas.find(l => trava.every(coluna => l[coluna] === registro[coluna]));
        if (existente) { travaBatida = trava; break; }
      }
      if (existente) {
        const nomeada = travaBatida.join(',') === alvo.join(',');
        if (nomeada && prefer.includes('merge-duplicates')) { Object.assign(existente, registro); salvas.push(existente); continue; }
        if (nomeada && prefer.includes('ignore-duplicates')) continue;
        return new Response('{"code":"23505","message":"duplicate key value violates unique constraint"}', { status: 409 });
      }
      const nova = { id: uuid(), ...(tabela === 'payt_events' ? { processing_status: 'received' } : {}), ...registro };
      if (tabela === 'customers') nova.name ??= '', nova.first_name ??= '', nova.last_name ??= '', nova.phone ??= '', nova.cpf_hash ??= null;
      linhas.push(nova);
      salvas.push(nova);
    }
    if (prefer.includes('return=minimal')) return new Response(null, { status: 201 });
    return respostaJson(salvas, 201);
  }

  if (method === 'PATCH') {
    const alvos = filtrar(linhas, params);
    for (const linha of alvos) Object.assign(linha, corpo);
    if (prefer.includes('return=minimal')) return new Response(null, { status: 204 });
    return respostaJson(alvos);
  }

  return respostaJson([], 200);
};

// ---------------------------------------------------------------- shim do Deno

let baseAtual = PRODUCAO;
let chaveAtual = CHAVE;
const manipuladores = [];
globalThis.Deno = {
  env: {
    get: nome => ({
      SUPABASE_URL: baseAtual,
      SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico-falsa',
      PAYT_INTEGRATION_KEY: chaveAtual,
    })[nome],
  },
  serve: manipulador => { manipuladores.push(manipulador); },
};

// A função lê o ambiente ao carregar. Três cópias: produção, banco de teste
// e produção sem a chave configurada. O Node guarda o arquivo pelo nome (o
// "?outra-versao" no endereço não basta), então cada cópia vai para um
// arquivo temporário próprio.
const pasta = mkdtempSync(join(tmpdir(), 'payt-webhook-'));
const carregar = async nome => {
  const copia = join(pasta, `${nome}.ts`);
  copyFileSync(alvo, copia);
  await import(pathToFileURL(copia).href);
};
await carregar('producao');
baseAtual = TESTE;
await carregar('teste');
baseAtual = PRODUCAO;
chaveAtual = '';
await carregar('sem-chave');
rmSync(pasta, { recursive: true, force: true });
const [atenderProducao, atenderTeste, atenderSemChave] = manipuladores;
if (!atenderSemChave) throw new Error('A função não registrou um manipulador com Deno.serve.');

// ---------------------------------------------------------------- avisos

const cliente = (extra = {}) => ({
  name: 'Maria  da Silva Souza', fake_email: false, email: 'Cliente@Exemplo.com ', doc: '67415765095',
  phone: '5511999999999', code: 'BLJORW', ...extra,
});

// Compra aprovada do principal no checkout.
const venda = (extra = {}) => ({
  integration_key: CHAVE,
  cart_id: 'RW3NPR',
  seller_id: 'AR6D4X',
  test: false,
  status: 'paid',
  type: 'order',
  tangible: false,
  transaction_id: 'TX-PRINCIPAL',
  customer: cliente(),
  product: { code: '4Z3WGM', type: 'digital', name: 'Os 7 Amens da Madrugada', quantity: 1, price: 3700 },
  link: { title: 'Checkout', url: 'https://checkout.payt.com.br/abc', sources: [] },
  transaction: { payment_method: 'credit_card', payment_status: 'paid', total_price: 3700, paid_at: '2026-10-16 20:00:00' },
  started_at: '2026-10-16 19:58:00',
  updated_at: '2026-10-16 20:00:00',
  ...extra,
});

// O UP01 do funil (1 clique), minutos depois.
const upsell = (extra = {}) => venda({
  type: 'upsell',
  upsell_code: 'R6VDGP',
  transaction_id: 'TX-UP01',
  product: { code: 'RKBQN6', type: 'digital', name: 'Oracao Celestial dos Quatro Arcanjos', quantity: 1, price: 13700 },
  transaction: { payment_method: 'credit_card', payment_status: 'paid', total_price: 13700, upsell_from: 'TX-PRINCIPAL' },
  ...extra,
});

const devolucao = (pagamento, base = venda()) => ({
  ...base,
  status: 'canceled',
  updated_at: '2026-10-17 10:00:00',
  transaction: { ...base.transaction, payment_status: pagamento, error_message: 'estorno' },
});

function enviar(payload, atender = atenderProducao) {
  return atender(new Request('https://exemplo/payt-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }));
}

let passou = 0;
let falhou = 0;

function confere(descricao, condicao, detalhe = '') {
  if (condicao) { passou += 1; console.log(`  ok   ${descricao}`); }
  else { falhou += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
}

async function cenario(titulo, corpo) {
  zerarBanco();
  console.log(`\n${titulo}`);
  await corpo();
}

const acesso = chave => banco.entitlements.find(e => e.product_key === chave);
const evento = (indice = 0) => banco.payt_events[indice] || {};

// ---------------------------------------------------------------- cenários

console.log(`Testando: ${alvo}`);

await cenario('1. Venda do principal: grava o aviso, cria a cliente e libera o app', async () => {
  const resposta = await enviar(venda());
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('gravou 1 aviso', banco.payt_events.length === 1);
  confere('aviso processado', evento().processing_status === 'processed', `${evento().processing_status} ${evento().error}`);
  confere('a chave secreta NÃO foi para o banco', !('integration_key' in (evento().payload || {})));
  confere('guardou o e-mail, a transação e o código', evento().customer_email === 'cliente@exemplo.com'
    && evento().transaction_id === 'TX-PRINCIPAL' && evento().product_code === '4Z3WGM');
  const pessoa = banco.customers[0] || {};
  confere('criou 1 cliente, com o e-mail em minúsculas', banco.customers.length === 1 && pessoa.email === 'cliente@exemplo.com', pessoa.email);
  confere('nome, primeiro nome e sobrenome', pessoa.name === 'Maria da Silva Souza' && pessoa.first_name === 'Maria'
    && pessoa.last_name === 'da Silva Souza', JSON.stringify([pessoa.name, pessoa.first_name, pessoa.last_name]));
  confere('CPF guardado só embaralhado', /^[a-f0-9]{64}$/.test(pessoa.cpf_hash || '') && pessoa.cpf_ultimos3 === '095'
    && !JSON.stringify(pessoa).includes('67415765095'));
  const principal = acesso('principal') || {};
  confere('principal ativo, com origem payt e o número da compra', principal.status === 'active' && principal.source === 'payt'
    && principal.external_reference === 'TX-PRINCIPAL', JSON.stringify(principal));
  confere('liberou só o principal', banco.entitlements.length === 1);
  confere('nunca encostou em tabela da Hubla', !chamadas.some(c => c.tabela.startsWith('hubla')));
});

await cenario('2. Chave errada, sem chave ou servidor sem a chave configurada: recusa e não grava nada', async () => {
  const errada = await enviar(venda({ integration_key: 'chave-errada-de-teste' }));
  const ausente = await enviar((({ integration_key, ...resto }) => resto)(venda()));
  const semConfig = await enviar(venda(), atenderSemChave);
  const vazia = await enviar(venda({ integration_key: '' }), atenderSemChave);
  confere('chave errada = 401', errada.status === 401, `veio ${errada.status}`);
  confere('sem chave = 401', ausente.status === 401, `veio ${ausente.status}`);
  confere('servidor sem a chave configurada recusa tudo (401)', semConfig.status === 401 && vazia.status === 401);
  confere('nada foi gravado nem liberado', chamadas.length === 0 && banco.entitlements.length === 0);
});

await cenario('3. O mesmo aviso chega duas vezes: o segundo não duplica nada', async () => {
  await enviar(venda());
  const segunda = await enviar(venda());
  const corpo = await segunda.json();
  confere('responde 200 dizendo que é repetido', segunda.status === 200 && corpo.duplicated === true, JSON.stringify(corpo));
  confere('1 aviso, 1 cliente, 1 acesso', banco.payt_events.length === 1 && banco.customers.length === 1 && banco.entitlements.length === 1);
});

await cenario('4. Principal e depois o UP01 do funil: mesma cliente, dois acessos', async () => {
  await enviar(venda());
  const resposta = await enviar(upsell());
  confere('responde 200', resposta.status === 200);
  confere('2 avisos processados', banco.payt_events.length === 2 && banco.payt_events.every(e => e.processing_status === 'processed'));
  confere('continua 1 cliente só', banco.customers.length === 1);
  confere('Arcanjos ativo, origem payt, número da compra do upsell',
    acesso('upsell_01')?.status === 'active' && acesso('upsell_01')?.source === 'payt' && acesso('upsell_01')?.external_reference === 'TX-UP01');
  confere('o principal continua com a compra original', acesso('principal')?.external_reference === 'TX-PRINCIPAL');
});

await cenario('5. Reembolso do principal: registrado, e o acesso FICA (decisão do Caio, 16/10)', async () => {
  await enviar(venda());
  const resposta = await enviar(devolucao('refunded'));
  confere('responde 200', resposta.status === 200);
  confere('aviso de reembolso guardado e marcado', evento(1).processing_status === 'ignored'
    && evento(1).payment_status === 'refunded' && /acesso fica/.test(evento(1).error || ''), evento(1).error);
  confere('o app continua liberado', acesso('principal')?.status === 'active');
});

await cenario('6. Chargeback, estorno do upsell de 1 clique e reembolso parcial: nada é tirado', async () => {
  await enviar(venda());
  await enviar(upsell());
  for (const pagamento of ['chargeback_presented', 'chargeback', 'peding_refund', 'refunded_partial']) await enviar(devolucao(pagamento));
  for (const pagamento of ['one_click_buy_refunded', 'one_click_buy_refunded_partial']) await enviar(devolucao(pagamento, upsell()));
  confere('8 avisos guardados', banco.payt_events.length === 8, `tem ${banco.payt_events.length}`);
  confere('as 6 devoluções ficaram só registradas', banco.payt_events.filter(e => e.processing_status === 'ignored').length === 6);
  confere('principal e Arcanjos continuam ativos', acesso('principal')?.status === 'active' && acesso('upsell_01')?.status === 'active');
});

await cenario('7. Código que não conhecemos: guarda, não libera, não cria ninguém', async () => {
  const resposta = await enviar(venda({ product: { code: 'XXX999', name: 'Outro produto' } }));
  confere('responde 200 (a Payt não precisa insistir)', resposta.status === 200);
  confere('fica para conferir, com o código no recado', evento().processing_status === 'needs_reconciliation'
    && /XXX999/.test(evento().error || ''), evento().error);
  confere('ninguém criado, nada liberado', banco.customers.length === 0 && banco.entitlements.length === 0);
  const deNovo = await enviar(venda({ product: { code: 'XXX999', name: 'Outro produto' } }));
  confere('reenviado sem o código cadastrado, continua para conferir', deNovo.status === 200
    && evento().processing_status === 'needs_reconciliation' && banco.entitlements.length === 0);
  banco.payt_product_map.push({ payt_code: 'XXX999', product_key: 'principal' });
  const cadastrado = await enviar(venda({ product: { code: 'XXX999', name: 'Outro produto' } }));
  confere('código cadastrado e a Payt reenvia: a venda libera sozinha', cadastrado.status === 200
    && evento().processing_status === 'processed' && acesso('principal')?.status === 'active', evento().error);
  confere('continua 1 aviso só', banco.payt_events.length === 1);
});

await cenario('8. Cartão recusado, Pix gerado, upsell recusado, carrinho abandonado: só registra', async () => {
  await enviar(venda({ status: 'canceled', transaction: { payment_status: 'refused' } }));
  await enviar(venda({ status: 'waiting_payment', transaction: { payment_method: 'pix', payment_status: 'waiting_payment' } }));
  await enviar(upsell({ status: 'canceled', transaction: { payment_status: 'one_click_buy_refused' } }));
  await enviar(venda({ status: 'lost_cart', type: 'abandoned-cart', transaction: undefined }));
  confere('4 avisos guardados, todos só registrados', banco.payt_events.length === 4
    && banco.payt_events.every(e => e.processing_status === 'ignored'));
  confere('ninguém criado, nada liberado', banco.customers.length === 0 && banco.entitlements.length === 0);
});

await cenario('9. Aviso de teste da Payt: na produção só guarda; no banco de teste libera', async () => {
  const naProducao = await enviar(venda({ test: true }));
  confere('produção: 200 e só registrado', naProducao.status === 200 && evento().processing_status === 'ignored' && evento().sandbox === true);
  confere('produção: nada liberado', banco.entitlements.length === 0);
  zerarBanco();
  const noTeste = await enviar(venda({ test: true }), atenderTeste);
  confere('banco de teste: processado e liberado', noTeste.status === 200 && evento().processing_status === 'processed'
    && acesso('principal')?.status === 'active', evento().error);
});

await cenario('10. Cliente que já existe (veio da Hubla): a Payt não pisa em nada', async () => {
  banco.customers.push({ id: 'c-hubla', email: 'cliente@exemplo.com', name: 'Maria Hubla', first_name: 'Maria', last_name: 'Hubla',
    phone: '', hubla_user_id: 'u-1', cpf_hash: null, cpf_ultimos3: null });
  banco.entitlements.push({ customer_id: 'c-hubla', product_key: 'principal', status: 'active', source: 'hubla',
    hubla_subscription_id: 'sub-1', external_reference: 'sub-1' });
  await enviar(venda());
  await enviar(upsell());
  const pessoa = banco.customers[0];
  confere('continua 1 cliente', banco.customers.length === 1);
  confere('o nome da Hubla ficou', pessoa.name === 'Maria Hubla' && pessoa.last_name === 'Hubla', pessoa.name);
  confere('só o que estava em branco foi preenchido (telefone, CPF)', pessoa.phone === '5511999999999' && Boolean(pessoa.cpf_hash));
  const principal = acesso('principal');
  confere('o principal da Hubla ficou intocado', principal.source === 'hubla' && principal.external_reference === 'sub-1'
    && principal.hubla_subscription_id === 'sub-1', JSON.stringify(principal));
  confere('o recado diz que ela já tinha', /já tinha, hubla/.test(evento(0).error || ''), evento(0).error);
  confere('o extra novo veio da Payt', acesso('upsell_01')?.source === 'payt');
});

await cenario('11. Acesso retirado antes (no painel) e nova compra paga: volta a valer', async () => {
  banco.customers.push({ id: 'c-1', email: 'cliente@exemplo.com', name: '', first_name: '', last_name: '', phone: '', cpf_hash: null });
  banco.entitlements.push({ customer_id: 'c-1', product_key: 'upsell_01', status: 'revoked', source: 'manual', revoked_at: '2026-10-01' });
  await enviar(upsell());
  const extra = acesso('upsell_01');
  confere('Arcanjos ativo de novo, origem payt', extra.status === 'active' && extra.source === 'payt' && extra.revoked_at === null);
  confere('sem linha duplicada', banco.entitlements.length === 1);
});

await cenario('12. A corrida: dois avisos da mesma cliente nova criam o cadastro juntos (409)', async () => {
  falhas.push({
    quando: c => c.tabela === 'customers' && c.method === 'POST', status: 409, vezes: 1,
    // O outro aviso ganhou a corrida e criou o cadastro um instante antes.
    antes: () => banco.customers.push({ id: 'c-vencedor', email: 'cliente@exemplo.com', name: 'Maria', first_name: 'Maria',
      last_name: '', phone: '', cpf_hash: null }),
  });
  const resposta = await enviar(venda());
  confere('responde 200, sem erro', resposta.status === 200, `veio ${resposta.status}`);
  confere('usou o cadastro que já existia', banco.customers.length === 1 && acesso('principal')?.customer_id === 'c-vencedor');
  confere('aviso processado', evento().processing_status === 'processed', evento().error);
});

await cenario('13. O banco pisca (401 de um instante) na hora de gravar: tenta de novo', async () => {
  falhas.push({ quando: c => c.tabela === 'payt_events' && c.method === 'POST', status: 401, vezes: 1 });
  const resposta = await enviar(venda());
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('o aviso não sumiu e foi processado', banco.payt_events.length === 1 && evento().processing_status === 'processed');
  confere('acesso liberado', acesso('principal')?.status === 'active');
});

await cenario('14. O banco cai no meio: responde 500 e o aviso fica guardado como falha', async () => {
  falhas.push({ quando: c => c.tabela === 'entitlements', status: 503, vezes: 3 });
  const resposta = await enviar(venda());
  confere('responde 500 (a Payt avisa o erro)', resposta.status === 500, `veio ${resposta.status}`);
  confere('o aviso ficou guardado como falha, com o motivo', evento().processing_status === 'failed' && /503/.test(evento().error || ''));
  const denovo = await enviar(venda());
  confere('reenviado depois, é processado (não fica preso)', denovo.status === 200 && evento().processing_status === 'processed'
    && banco.payt_events.length === 1);
  confere('e libera o acesso', acesso('principal')?.status === 'active');
});

await cenario('15. "Não tenho e-mail" ou e-mail quebrado: fica para conferir, sem cadastro', async () => {
  await enviar(venda({ customer: cliente({ fake_email: true }) }));
  await enviar(venda({ customer: cliente({ email: 'sem-arroba' }), transaction_id: 'TX-2' }));
  confere('os dois para conferir', banco.payt_events.length === 2 && banco.payt_events.every(e => e.processing_status === 'needs_reconciliation'));
  confere('ninguém criado', banco.customers.length === 0 && banco.entitlements.length === 0);
});

await cenario('16. Order bump (produto extra no próprio checkout): libera os dois', async () => {
  await enviar(venda({ order_bumps: [{ name: 'Musicas', code: 'BMP001', product: { code: 'LP39N8' } }] }));
  confere('principal e Músicas dos Anjos ativos', acesso('principal')?.status === 'active' && acesso('upsell_02')?.status === 'active');
  confere('o código sem mapa ficou anotado', /BMP001/.test(evento().error || ''), evento().error);
});

await cenario('17. Extra que abre o app? Não: o UP01 sozinho não dá o principal', async () => {
  await enviar(upsell());
  confere('só o Arcanjos', banco.entitlements.length === 1 && acesso('upsell_01')?.status === 'active');
});

await cenario('18. Corpo que não é JSON e pedido que não é POST', async () => {
  const lixo = await enviar('integration_key=x&status=paid');
  const get = await atenderProducao(new Request('https://exemplo/payt-webhook'));
  confere('não-JSON = 400', lixo.status === 400, `veio ${lixo.status}`);
  confere('GET = 405', get.status === 405, `veio ${get.status}`);
  confere('nada gravado', chamadas.length === 0);
});

// O formato do aviso que o "Testar URL" da Payt mandou em 16/10/2026 (dados
// de mentira da própria Payt, encurtados): produto agrupado, dois order bumps,
// campanha de origem. É o primeiro aviso REAL que chegou.
const avisoDeTesteDaPayt = () => ({
  integration_key: CHAVE,
  link: { url: 'https://payt.site/YoMCA71', title: 'Checkout teste', sources: { utm_source: 'CampanhaSourceLink' }, query_params: { site: 'meusitebr' } },
  test: true,
  type: 'order',
  origin: { code: 'LJV33L', name: 'campanha Teste', query_params: { site: 'meusitebr' } },
  status: 'paid',
  cart_id: '26DM9XD',
  product: {
    sku: '793269e47eb75', code: '4O9J39', name: 'Produto Agrupado', type: 'grouped', price: 133299, quantity: 1,
    items: [
      { sku: '2c26392e0a73c', code: 'R28BKV', name: 'Produto Digital Membros', type: 'digital', price: 99933, quantity: 1 },
      { sku: '444d2d5275152', code: '45PK73', name: 'Produto Fisico Frasco', type: 'physical', price: 33366, quantity: 1 },
    ],
  },
  customer: { doc: '12345678909', code: 'M5PJMA', name: 'Solaire of Astora M Walter White', email: 'yoda@testsuser.com',
    phone: '11999999999', fake_email: false },
  tangible: true,
  seller_id: 'LGAJ2Y',
  started_at: '2024-11-22 15:20:28',
  updated_at: '2024-11-22 15:20:45',
  order_bumps: [
    { code: 'R3A674', name: 'Produto Order Bump', product: { code: 'R6DAPD', name: 'Ebook 1', type: 'digital', price: 66633, quantity: 1 } },
    { code: '47ZMAL', name: 'OBump | Produto 2', product: { code: 'LX9BQZ', name: 'Fisico (Auto)', type: 'physical', price: 33399, quantity: 1 } },
  ],
  transaction: { paid_at: '2024-11-22 15:20:45', quantity: 1, total_price: 296616, installments: 12,
    payment_method: 'credit_card', payment_status: 'paid' },
  transaction_id: 'PAYTS2',
});

await cenario('19. O aviso de teste de verdade da Payt (16/10): só códigos da Payt, nenhum nosso', async () => {
  const resposta = await enviar(avisoDeTesteDaPayt(), atenderTeste);
  confere('responde 200', resposta.status === 200);
  confere('para conferir, com os 7 códigos no recado', evento().processing_status === 'needs_reconciliation'
    && evento().error === 'Produto não mapeado: 4O9J39, R28BKV, 45PK73, R3A674, R6DAPD, 47ZMAL, LX9BQZ', evento().error);
  confere('marcado como teste, sem cliente', evento().sandbox === true && banco.customers.length === 0);
  // Um item do agrupado vira "principal" só neste teste: reenviado, libera.
  banco.payt_product_map.push({ payt_code: 'R28BKV', product_key: 'principal' });
  await enviar(avisoDeTesteDaPayt(), atenderTeste);
  const pessoa = banco.customers[0] || {};
  confere('reenviado com um código cadastrado: libera', evento().processing_status === 'processed'
    && acesso('principal')?.status === 'active' && acesso('principal')?.external_reference === 'PAYTS2', evento().error);
  confere('cliente com o primeiro nome certo', pessoa.email === 'yoda@testsuser.com' && pessoa.first_name === 'Solaire');
  confere('anota os outros 6 códigos sem mapa', /código sem mapa: 4O9J39, 45PK73, R3A674, R6DAPD, 47ZMAL, LX9BQZ/.test(evento().error || ''), evento().error);
  confere('na produção, o mesmo aviso de teste não libera nada', await (async () => {
    zerarBanco();
    banco.payt_product_map.push({ payt_code: 'R28BKV', product_key: 'principal' });
    await enviar(avisoDeTesteDaPayt());
    return evento().processing_status === 'ignored' && banco.entitlements.length === 0;
  })());
});

console.log(`\n${passou} conferências passaram, ${falhou} falharam.`);
process.exit(falhou ? 1 : 0);
