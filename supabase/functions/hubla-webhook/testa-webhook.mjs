// Teste local do webhook da Hubla — não toca em banco nenhum.
//
// Sobe a função num banco de mentira e força as falhas que já aconteceram de
// verdade, para garantir que nenhum evento volte a sumir sem deixar rastro.
// O caso que originou este arquivo: em 18/09/2026 um erro de um instante na
// hora de gravar fez o evento de uma cliente de R$ 197 desaparecer.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" supabase/functions/hubla-webhook/testa-webhook.mjs
//
// Para comparar com uma versão antiga da função, passe o caminho dela:
//   ... testa-webhook.mjs caminho/para/index.ts

import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2] ? resolve(process.argv[2]) : resolve(aqui, 'index.ts');

const BASE = 'http://banco-falso';
const TOKEN = 'token-de-teste';

// ---------------------------------------------------------------- banco falso

const banco = {};
let falhas = [];      // {quando(url, method, prefer) -> bool, status, vezes}
let chamadas = [];    // registro de tudo que a função pediu ao banco

function zerarBanco() {
  banco.hubla_events = [];
  banco.customers = [];
  banco.entitlements = [];
  banco.hubla_product_map = [
    { hubla_id: 'bniYICXEzykgw1PzEyme', product_key: 'principal' },
    { hubla_id: 'ODOZxlF1tfhee2TkZikI', product_key: 'upsell_01' },
  ];
  banco.products = [
    { key: 'principal', unlocks_app: true },
    { key: 'upsell_01', unlocks_app: false },
  ];
  falhas = [];
  chamadas = [];
}

const uuid = () => 'id-' + Math.random().toString(16).slice(2, 10);

// Filtro no estilo PostgREST, só o suficiente para o que a função usa.
function filtrar(linhas, params) {
  return linhas.filter(linha => {
    for (const [campo, criterio] of params) {
      if (['select', 'limit', 'order', 'on_conflict'].includes(campo)) continue;
      if (criterio.startsWith('eq.')) {
        if (String(linha[campo]) !== criterio.slice(3)) return false;
      } else if (criterio.startsWith('in.(')) {
        const valores = criterio.slice(4, -1).split(',').map(decodeURIComponent);
        if (!valores.includes(String(linha[campo]))) return false;
      } else if (criterio === 'is.true') {
        if (linha[campo] !== true) return false;
      } else if (criterio === 'is.false') {
        if (linha[campo] !== false) return false;
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
  const caminho = String(url).replace(`${BASE}/rest/v1/`, '');
  const [tabela, consulta = ''] = caminho.split('?');
  const params = [...new URLSearchParams(consulta)];
  chamadas.push({ tabela, method, prefer, caminho });

  const falha = falhas.find(f => (f.vezes === undefined || f.vezes > 0) && f.quando({ tabela, method, prefer, caminho }));
  if (falha) {
    if (falha.vezes !== undefined) falha.vezes -= 1;
    if (falha.status === 'rede') throw new Error('conexão recusada');
    if (falha.vazio) return respostaJson([]);   // responde bem, mas não acha a linha
    return new Response('{"message":"Invalid API key"}', { status: falha.status });
  }

  const linhas = banco[tabela] || [];
  const corpo = init.body ? JSON.parse(init.body) : null;

  if (method === 'GET') {
    let achadas = filtrar(linhas, params);
    const limite = params.find(([c]) => c === 'limit');
    if (limite) achadas = achadas.slice(0, Number(limite[1]));
    return respostaJson(achadas);
  }

  if (method === 'POST') {
    const registros = Array.isArray(corpo) ? corpo : [corpo];
    const conflito = (params.find(([c]) => c === 'on_conflict') || [])[1];
    const salvas = [];
    for (const registro of registros) {
      const chave = conflito || (tabela === 'hubla_events' ? 'idempotency_key' : null);
      const existente = chave ? linhas.find(l => l[chave] === registro[chave]) : null;
      if (existente) {
        if (prefer.includes('merge-duplicates')) {
          Object.assign(existente, registro);
          salvas.push(existente);
        }
        // ignore-duplicates: não devolve nada, exatamente como o PostgREST.
        continue;
      }
      const nova = { id: uuid(), processing_status: 'received', ...registro };
      linhas.push(nova);
      salvas.push(nova);
    }
    if (prefer.includes('return=minimal')) return new Response(null, { status: 204 });
    return respostaJson(salvas, 201);
  }

  if (method === 'PATCH') {
    const alvos = filtrar(linhas, params);
    for (const linha of alvos) Object.assign(linha, corpo);
    return respostaJson(alvos);
  }

  return respostaJson([], 200);
};

// ---------------------------------------------------------------- shim do Deno

const manipuladores = [];
globalThis.Deno = {
  env: {
    get: chave => ({
      SUPABASE_URL: BASE,
      SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico-falsa',
      HUBLA_WEBHOOK_TOKEN: TOKEN,
    })[chave],
  },
  serve: manipulador => { manipuladores.push(manipulador); },
};

await import(pathToFileURL(alvo).href);
const atender = manipuladores[0];
if (!atender) throw new Error('A função não registrou um manipulador com Deno.serve.');

// ---------------------------------------------------------------- utilitários

const venda = (extra = {}) => ({
  version: '2.0.0',
  type: 'customer.member_added',
  event: {
    user: { id: 'u-bolivar', email: 'cliente@exemplo.com', firstName: 'Maria', lastName: 'Silva', phone: '11999990000' },
    product: { id: 'bniYICXEzykgw1PzEyme' },
    subscription: { id: 'sub-1', version: 1, modifiedAt: '2026-09-18T23:16:00Z' },
    ...extra,
  },
});

function enviar(payload, cabecalhos = {}) {
  return atender(new Request('https://exemplo/webhook', {
    method: 'POST',
    headers: { 'x-hubla-token': TOKEN, 'x-hubla-idempotency': 'evt-001', 'Content-Type': 'application/json', ...cabecalhos },
    body: JSON.stringify(payload),
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

// ---------------------------------------------------------------- cenários

console.log(`Testando: ${alvo}`);

await cenario('1. Venda normal: grava o evento e libera o acesso', async () => {
  const resposta = await enviar(venda());
  confere('responde 200', resposta.status === 200, `veio ${resposta.status}`);
  confere('gravou 1 evento', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('evento marcado como processado', banco.hubla_events[0]?.processing_status === 'processed',
    banco.hubla_events[0]?.processing_status);
  confere('criou a cliente', banco.customers.length === 1);
  confere('liberou o principal', banco.entitlements.some(e => e.product_key === 'principal' && e.status === 'active'));
});

await cenario('2. O 401 de um instante (o caso de 18/09): a gravação falha na primeira tentativa', async () => {
  falhas.push({ quando: c => c.tabela === 'hubla_events' && c.method === 'POST', status: 401, vezes: 1 });
  const resposta = await enviar(venda());
  confere('responde 200 — a tentativa seguinte deu certo', resposta.status === 200, `veio ${resposta.status}`);
  confere('o evento NÃO sumiu', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('evento processado', banco.hubla_events[0]?.processing_status === 'processed',
    banco.hubla_events[0]?.processing_status);
  confere('acesso liberado', banco.entitlements.length === 1);
});

await cenario('3. A gravação falha nas três tentativas e o banco só volta depois', async () => {
  falhas.push({
    quando: c => c.tabela === 'hubla_events' && c.method === 'POST' && c.prefer.includes('ignore-duplicates'),
    status: 401,
  });
  const resposta = await enviar(venda());
  confere('responde 500, pedindo reenvio à Hubla', resposta.status === 500, `veio ${resposta.status}`);
  confere('mesmo assim o evento ficou gravado', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('marcado como failed', banco.hubla_events[0]?.processing_status === 'failed',
    banco.hubla_events[0]?.processing_status);
  confere('o payload inteiro foi preservado',
    banco.hubla_events[0]?.payload?.event?.user?.email === 'cliente@exemplo.com');
  confere('o motivo da falha ficou registrado', /401/.test(banco.hubla_events[0]?.error || ''),
    banco.hubla_events[0]?.error);
});

await cenario('4. O banco diz "já existe" mas não devolve a linha', async () => {
  // Reproduz a corrida em que o insert é ignorado como duplicado e a leitura
  // seguinte volta vazia. No código antigo isso estourava em stored.id.
  falhas.push({
    quando: c => c.tabela === 'hubla_events' && c.method === 'POST' && c.prefer.includes('ignore-duplicates'),
    status: 409,
  });
  const resposta = await enviar(venda());
  confere('responde 500, pedindo reenvio à Hubla', resposta.status === 500, `veio ${resposta.status}`);
  confere('o evento ficou gravado assim mesmo', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('marcado como failed', banco.hubla_events[0]?.processing_status === 'failed',
    banco.hubla_events[0]?.processing_status);
});

await cenario('5. Reenvio da Hubla não duplica nada', async () => {
  await enviar(venda());
  const repetido = await enviar(venda());
  const corpo = await repetido.json();
  confere('responde 200', repetido.status === 200);
  confere('reconhece como repetido', corpo.duplicated === true);
  confere('continua com 1 evento', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('continua com 1 acesso', banco.entitlements.length === 1, `tem ${banco.entitlements.length}`);
});

await cenario('6. Evento de sandbox não encosta em acesso real', async () => {
  const resposta = await enviar(venda(), { 'x-hubla-sandbox': 'true' });
  confere('responde 200', resposta.status === 200);
  confere('evento ignorado', banco.hubla_events[0]?.processing_status === 'ignored',
    banco.hubla_events[0]?.processing_status);
  confere('nenhum acesso liberado', banco.entitlements.length === 0);
});

await cenario('7. Produto desconhecido não inventa acesso', async () => {
  const payload = venda();
  payload.event.product.id = 'codigo-que-ninguem-cadastrou';
  const resposta = await enviar(payload);
  confere('responde 200 para a Hubla parar de reenviar', resposta.status === 200);
  confere('fica para conferência manual', banco.hubla_events[0]?.processing_status === 'needs_reconciliation',
    banco.hubla_events[0]?.processing_status);
  confere('nenhum acesso liberado', banco.entitlements.length === 0);
});

await cenario('8. Erro definitivo não fica repetindo à toa', async () => {
  falhas.push({ quando: c => c.tabela === 'hubla_events' && c.method === 'POST' && c.prefer.includes('ignore-duplicates'), status: 400 });
  await enviar(venda());
  const tentativas = chamadas.filter(c => c.tabela === 'hubla_events' && c.method === 'POST' && c.prefer.includes('ignore-duplicates')).length;
  confere('tentou uma vez só um erro que não se cura sozinho', tentativas === 1, `tentou ${tentativas}x`);
});

await cenario('9. O evento existe mas a leitura volta vazia', async () => {
  // Atraso de réplica: o insert é recusado como duplicado e a consulta seguinte
  // ainda não enxerga a linha. Sem a guarda, o código morre em stored.id.
  banco.hubla_events.push({ id: 'ja-existia', idempotency_key: 'evt-001', processing_status: 'received', payload: {} });
  falhas.push({ quando: c => c.tabela === 'hubla_events' && c.method === 'GET', vazio: true, status: 200 });
  const resposta = await enviar(venda());
  confere('responde 500, pedindo reenvio à Hubla', resposta.status === 500, `veio ${resposta.status}`);
  confere('não criou linha duplicada', banco.hubla_events.length === 1, `tem ${banco.hubla_events.length}`);
  confere('a linha existente foi marcada como failed',
    banco.hubla_events[0]?.processing_status === 'failed', banco.hubla_events[0]?.processing_status);
  confere('e o payload foi preenchido no resgate',
    banco.hubla_events[0]?.payload?.event?.user?.email === 'cliente@exemplo.com');
});

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
