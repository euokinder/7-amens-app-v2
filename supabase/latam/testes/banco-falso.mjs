// Banco de mentira para os testes das funções da LATAM. Não toca em banco
// nenhum: imita só o pedaço do PostgREST (a API do Supabase) que as funções
// usam, inclusive o jeito de recusar repetição (409) e o on_conflict.
//
// Também anota toda tabela que as funções tentaram ler ou gravar, para o
// teste provar que nenhuma tabela do Brasil é tocada.

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// As travas de repetição de cada tabela, como em supabase/latam/01-tabelas.sql.
const TRAVAS = {
  latam_customers: [['id'], ['email']],
  // 09-resgate.sql (10/11/2026).
  latam_resgates: [['id']],
  latam_resgate_config: [['id']],
  latam_access: [['customer_id', 'product']],
  latam_progress: [['customer_id', 'day']],
  latam_cantico_progress: [['customer_id', 'day']],
  latam_sessions: [['token_hash']],
  latam_entry_links: [['customer_id'], ['token']],
  latam_login_limits: [['key']],
  latam_visit_days: [['customer_id', 'visited_on']],
  latam_whop_events: [['webhook_id']],
  latam_offer_events: [['customer_id', 'campaign_key']],
  latam_admins: [['customer_id']],
  latam_admin_actions: [['id']],
  latam_kashpay_events: [['event', 'transaction_id']],
  latam_kashpay_offers: [['offer_id']],
  // 13-digistore.sql (13/11/2026): o aviso da Digistore24.
  latam_digistore_events: [['event', 'transaction_id']],
  // 10-chat.sql (12/11/2026): a Lucía.
  latam_chat_config: [['id']],
  latam_chat_conversas: [['id']],
  latam_chat_mensagens: [['id']],
};

const PADROES = {
  latam_customers: () => ({ id: `c-${Math.random().toString(16).slice(2, 10)}`, name: '', country: null, timezone: null, first_access_on: null, whop_user_id: null, created_at: new Date().toISOString() }),
  latam_resgates: () => ({
    id: Math.floor(Math.random() * 1e9), customer_id: null, email_digitado: '', email_anterior: '', nome: '', contato: '', pais: '',
    situacao: 'resolvido', resolvido_por: null, resolvido_em: null, created_at: new Date().toISOString(),
  }),
  latam_resgate_config: () => ({ id: 1, emergencia_ligada: true, emergencias_por_dia: 2, updated_at: new Date().toISOString() }),
  latam_access: () => ({ product: 'app', status: 'active', expires_at: null, whop_payment_id: null, revoked_at: null, note: '' }),
  latam_progress: () => ({ completed_at: new Date().toISOString() }),
  latam_cantico_progress: () => ({ completed_at: new Date().toISOString() }),
  latam_entry_links: () => ({ uses: 0, last_used_at: null, created_by: '' }),
  latam_visit_days: () => ({ first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString() }),
  latam_whop_events: () => ({ status: 'received', detail: '', processed_at: null, received_at: new Date().toISOString() }),
  latam_offer_events: () => ({ claimed_at: new Date().toISOString(), shown_at: null, clicked_at: null, dismissed_at: null }),
  latam_admin_actions: () => ({ id: Math.floor(Math.random() * 1e9), details: {}, target_email: '', created_at: new Date().toISOString() }),
  latam_kashpay_events: () => ({ status: 'recorded', detail: '', offers: [], produtos: [], received_at: new Date().toISOString() }),
  latam_kashpay_offers: () => ({ offer_name: '', note: '', created_at: new Date().toISOString() }),
  latam_digistore_events: () => ({ status: 'recorded', detail: '', campos: '', customer_id: null, received_at: new Date().toISOString() }),
  latam_chat_conversas: () => ({ id: crypto.randomUUID(), pagina: 'app', pais: '', conexao: '', mensagens: 0, equipe: 'nao', equipe_motivo: '', equipe_resumo: '', equipe_contato: '', equipe_email: '', equipe_em: null, resolvido_em: null, created_at: new Date().toISOString() }),
  latam_chat_mensagens: () => ({ id: ++sequencia, modelo: '', tokens_entrada: 0, tokens_cache: 0, tokens_saida: 0, created_at: new Date().toISOString() }),
};
let sequencia = 0;

export const banco = {};
export const tocadas = new Set();
export let falhas = [];
export let freioLibera = true;
// O pop-up que a função latam_claim_offer "escolheria" (a regra mora no SQL e
// é provada no banco de teste; aqui só se confere o caminho na latam-api).
export let ofertaFalsa = null;
export const pedidosDeOferta = [];
// Os extras que a função latam_extras "acharia" pela compra (a conta da compra
// e da dúvida mora no SQL e é provada no banco de teste). O que o painel faz à
// mão (latam_access com product <> 'app') e os dias do Cántico vêm das tabelas
// falsas, como no SQL. semFuncaoDeExtras imita o banco sem 05-extras.sql.
export const comprasFalsas = {};
export let semFuncaoDeExtras = false;
export const tirarFuncaoDeExtras = () => { semFuncaoDeExtras = true; };

export function zerarBanco() {
  for (const tabela of Object.keys(TRAVAS)) banco[tabela] = [];
  tocadas.clear();
  falhas = [];
  freioLibera = true;
  ofertaFalsa = null;
  pedidosDeOferta.length = 0;
  for (const chave of Object.keys(comprasFalsas)) delete comprasFalsas[chave];
  semFuncaoDeExtras = false;
}
export const oferecer = oferta => { ofertaFalsa = oferta; };
export const forcarFalha = falha => falhas.push(falha);
export const limparFalhas = () => { falhas = []; };
export const travarFreio = () => { freioLibera = false; };

function confereLinha(linha, campo, criterio) {
  const valor = linha[campo];
  if (criterio.startsWith('eq.')) return String(valor) === decodeURIComponent(criterio.slice(3));
  if (criterio.startsWith('neq.')) return String(valor) !== decodeURIComponent(criterio.slice(4));
  if (criterio.startsWith('in.(')) return criterio.slice(4, -1).split(',').map(decodeURIComponent).includes(String(valor));
  if (criterio === 'is.null') return valor === null || valor === undefined;
  if (criterio === 'is.true') return valor === true;
  if (criterio.startsWith('gt.')) return valor !== null && valor !== undefined && Date.parse(valor) > Date.parse(decodeURIComponent(criterio.slice(3)));
  throw new Error(`banco falso: filtro não suportado ${campo}=${criterio}`);
}

const RESERVADOS = ['select', 'limit', 'order', 'on_conflict', 'offset'];
const filtrar = (linhas, params) =>
  linhas.filter(linha => params.every(([campo, criterio]) => RESERVADOS.includes(campo) || confereLinha(linha, campo, criterio)));

const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET';
  const prefer = (init.headers && init.headers.Prefer) || '';
  const caminho = String(url).replace(/^https?:\/\/[^/]+\/rest\/v1\//, '');
  const [tabela, consulta = ''] = caminho.split('?');
  const params = [...new URLSearchParams(consulta)].map(([campo, valor]) => [campo, encodeURIComponent(valor).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')')]);
  tocadas.add(tabela);

  const falha = falhas.find(f => (f.vezes === undefined || f.vezes > 0) && f.quando({ tabela, method, prefer, caminho }));
  if (falha) {
    if (falha.vezes !== undefined) falha.vezes -= 1;
    return new Response('{"message":"falha forçada"}', { status: falha.status });
  }

  if (tabela === 'rpc/latam_allow_login') return json(freioLibera);
  // Funções do banco que um teste imita por conta própria (rpcsDoTeste).
  if (rpcsDoTeste[tabela]) return json(await rpcsDoTeste[tabela](init.body ? JSON.parse(init.body) : {}));
  if (tabela === 'rpc/latam_claim_offer') {
    pedidosDeOferta.push(init.body ? JSON.parse(init.body) : null);
    return json(ofertaFalsa ? [ofertaFalsa] : []);
  }
  if (tabela === 'rpc/latam_extras') {
    if (semFuncaoDeExtras) return new Response('{"message":"function public.latam_extras does not exist"}', { status: 404 });
    const { p_customer_id: id } = JSON.parse(init.body || '{}');
    if (!banco.latam_customers.some(c => c.id === id)) return json(null);
    const origem = {};
    for (const produto of comprasFalsas[id] || []) origem[produto] = 'compra';
    for (const a of banco.latam_access.filter(a => a.customer_id === id && a.product !== 'app')) {
      if (a.status === 'active') origem[a.product] = origem[a.product] || 'manual';
      else origem[a.product] = 'retirado';
    }
    return json({
      extras: Object.keys(origem).filter(k => origem[k] !== 'retirado').sort(),
      origem,
      cantico_hechos: banco.latam_cantico_progress.filter(p => p.customer_id === id).map(p => Number(p.day)).sort((a, b) => a - b),
    });
  }
  // As listas do painel: as contas moram no SQL (provadas no banco de teste);
  // aqui elas só devolvem o que as tabelas falsas têm.
  if (tabela === 'rpc/latam_admin_customers') return json((banco.latam_customers || []).map(c => ({ ...c, products: [], payments: 0, unknown_payments: 0 })));
  if (tabela === 'rpc/latam_admin_offers') return json([]);
  if (!(tabela in banco)) return new Response(`{"message":"relation ${tabela} does not exist"}`, { status: 404 });

  const linhas = banco[tabela];
  const corpo = init.body ? JSON.parse(init.body) : null;
  const minimal = prefer.includes('return=minimal');

  if (method === 'GET') {
    let achadas = filtrar(linhas, params).map(linha => ({ ...linha }));
    const ordem = params.find(([c]) => c === 'order');
    if (ordem) {
      const [campo, sentido] = decodeURIComponent(ordem[1]).split('.');
      achadas.sort((a, b) => (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (sentido === 'desc' ? -1 : 1));
    }
    const limite = params.find(([c]) => c === 'limit');
    if (limite) achadas = achadas.slice(0, Number(limite[1]));
    return json(achadas);
  }

  if (method === 'POST') {
    const travas = TRAVAS[tabela];
    const pedida = (params.find(([c]) => c === 'on_conflict') || [])[1];
    const salvas = [];
    for (const registro of Array.isArray(corpo) ? corpo : [corpo]) {
      const nova = { ...(PADROES[tabela] ? PADROES[tabela]() : {}), ...registro };
      let existente = null;
      let travaBatida = null;
      for (const trava of travas) {
        existente = linhas.find(l => trava.every(coluna => l[coluna] === nova[coluna]));
        if (existente) { travaBatida = trava; break; }
      }
      if (existente) {
        const bate = pedida && travaBatida.join(',') === decodeURIComponent(pedida);
        if (bate && prefer.includes('merge-duplicates')) { Object.assign(existente, registro); salvas.push({ ...existente }); continue; }
        if (bate && prefer.includes('ignore-duplicates')) continue;
        return new Response('{"code":"23505","message":"duplicate key"}', { status: 409 });
      }
      linhas.push(nova);
      salvas.push({ ...nova });
    }
    return minimal ? new Response(null, { status: 201 }) : json(salvas, 201);
  }

  if (method === 'PATCH') {
    const alvos = filtrar(linhas, params);
    for (const linha of alvos) Object.assign(linha, corpo);
    return minimal ? new Response(null, { status: 204 }) : json(alvos.map(l => ({ ...l })));
  }

  if (method === 'DELETE') {
    const alvos = new Set(filtrar(linhas, params));
    banco[tabela] = linhas.filter(l => !alvos.has(l));
    return minimal ? new Response(null, { status: 204 }) : json([...alvos]);
  }

  return json([], 200);
};

// O imitador do Deno: as funções do Supabase rodam em Deno; aqui, em Node.
// Cada carga registra um manipulador (Deno.serve) com o ambiente do momento.
let ambiente = {};
const manipuladores = [];
globalThis.Deno = {
  env: { get: nome => ambiente[nome] },
  serve: manipulador => { manipuladores.push(manipulador); },
};

export async function carregarFuncao(arquivo, env) {
  ambiente = env;
  const pasta = mkdtempSync(join(tmpdir(), 'latam-'));
  const copia = join(pasta, `funcao-${manipuladores.length}.ts`);
  copyFileSync(arquivo, copia);
  await import(pathToFileURL(copia).href);
  rmSync(pasta, { recursive: true, force: true });
  const manipulador = manipuladores.at(-1);
  if (!manipulador) throw new Error('A função não registrou um manipulador com Deno.serve.');
  return manipulador;
}

// As funções do banco que um teste imita por conta própria (ex.:
// 'rpc/latam_resgate_cartao' no teste da latam-api). A regra de verdade mora
// no SQL e é provada no banco de teste; aqui só se confere o caminho na função.
export const rpcsDoTeste = {};

// Placar.
export const placar = { passou: 0, falhou: 0 };
export function confere(descricao, condicao, detalhe = '') {
  if (condicao) { placar.passou += 1; console.log(`  ok    ${descricao}`); }
  else { placar.falhou += 1; console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`); }
}
export async function cenario(titulo, corpo) {
  zerarBanco();
  console.log(`\n${titulo}`);
  await corpo();
}
export function fechar() {
  console.log(`\n${placar.passou} conferências ok, ${placar.falhou} falharam.`);
  process.exit(placar.falhou ? 1 : 0);
}
