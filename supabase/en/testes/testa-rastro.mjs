// Teste local do js/en/rastro.js (o registrador de passos da tela) e da
// parte do js/en/sesion.js que ele usa. Não toca em banco nem em rede: o
// navegador é de mentira (window, document, localStorage, fetch, sendBeacon).
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/en/testes/testa-rastro.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RASTRO = readFileSync(resolve(raiz, 'js/en/rastro.js'), 'utf8');
const SESION = readFileSync(resolve(raiz, 'js/en/sesion.js'), 'utf8');
const TOKEN = 'a1b2c3d4'.repeat(8);
const API = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/en-api';

let passou = 0;
let falhou = 0;
const confere = (nome, ok, extra = '') => {
  if (ok) passou += 1; else falhou += 1;
  console.log(`  ${ok ? 'ok   ' : 'FALHA'} ${nome}${!ok && extra ? ` — ${extra}` : ''}`);
};

// Um navegador de mentira, novo a cada página. `disco` é o que sobrevive de
// uma página para a outra (localStorage e sessionStorage).
function navegador({ url = 'https://setemadrugadas.com.br/en', referrer = '', disco = { local: {}, sessao: {} }, ua = 'Mozilla/5.0 (Linux; Android 14) Mobile', beacon = true, resposta = { status: 200 }, semRede = false } = {}) {
  const endereco = new URL(url);
  const armazem = caixa => ({
    getItem: k => (k in caixa ? caixa[k] : null),
    setItem: (k, v) => { caixa[k] = String(v); },
    removeItem: k => { delete caixa[k]; },
  });
  const ouvintes = { document: {}, window: {} };
  const relogios = [];
  const enviados = [];   // { via: 'beacon' | 'fetch', url, corpo, headers }
  const document = {
    referrer,
    visibilityState: 'visible',
    addEventListener: (tipo, fn) => { (ouvintes.document[tipo] ||= []).push(fn); },
    querySelectorAll: () => [],
    documentElement: { classList: { remove() {} } },
    getElementById: () => null,
  };
  const window = {
    document,
    location: endereco,
    localStorage: armazem(disco.local),
    sessionStorage: armazem(disco.sessao),
    navigator: {
      userAgent: ua,
      maxTouchPoints: 5,
      standalone: false,
      sendBeacon: beacon ? (destino, corpo) => { enviados.push({ via: 'beacon', url: destino, corpo: JSON.parse(corpo), headers: {} }); return true; } : undefined,
    },
    matchMedia: () => ({ matches: false }),
    AMENES_CONFIG: { api: API, soporte: 'mailto:x' },
    addEventListener: (tipo, fn) => { (ouvintes.window[tipo] ||= []).push(fn); },
    setTimeout: (fn, ms) => { relogios.push({ fn, ms }); return relogios.length; },
    fetch: (destino, opcoes) => {
      enviados.push({ via: 'fetch', url: destino, corpo: JSON.parse(opcoes.body), headers: opcoes.headers || {}, keepalive: opcoes.keepalive });
      return semRede ? Promise.reject(new Error('sem rede')) : Promise.resolve({ ok: resposta.status < 400, status: resposta.status, json: async () => ({}) });
    },
    console: { debug() {}, info() {} },
    URL, URLSearchParams, Intl, JSON, Date, Math, Promise, Object, Array, Boolean, isFinite,
  };
  window.window = window;
  const contexto = vm.createContext(window);
  return {
    window, disco, enviados, relogios,
    carregar: codigo => vm.runInContext(codigo, contexto),
    esconder: () => { document.visibilityState = 'hidden'; (ouvintes.document.visibilitychange || []).forEach(fn => fn()); },
    sairDaPagina: () => (ouvintes.window.pagehide || []).forEach(fn => fn()),
    voltarDoCache: () => (ouvintes.window.pageshow || []).forEach(fn => fn({ persisted: true })),
    passarTempo: async () => { const r = relogios.shift(); if (r) { r.fn(); await new Promise(resolve => setImmediate(resolve)); } return r; },
  };
}
const comSessao = () => ({ local: { 'amens-en.sesion': TOKEN }, sessao: {} });

console.log('1. Sem sessão (a tela de entrar): nada guardado, nada enviado, nenhum erro');
{
  const n = navegador({ url: 'https://setemadrugadas.com.br/en-login#Abc123Def456Ghi7' });
  n.carregar(RASTRO);
  n.window.AMENES.rastro('card_toque', { card: 'arcangeles' });
  n.esconder();
  confere('a função existe', typeof n.window.AMENES.rastro === 'function');
  confere('nada enviado', n.enviados.length === 0);
  confere('nada guardado no navegador', !('amens-en.rastro' in n.disco.local));
}

console.log('\n2. Abrir a página e sair: UMA chamada, na saída, com o passo `pagina`');
{
  const n = navegador({ url: 'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en&utm_medium=popup&utm_campaign=arcangeles&email=maria@x.com&utm_content=a@b.com#segredo', referrer: 'https://setemadrugadas.com.br/en?x=1', disco: comSessao() });
  n.carregar(RASTRO);
  confere('só abrir a página NÃO liga o relógio', n.relogios.length === 0);
  confere('nada enviado enquanto ela está na página', n.enviados.length === 0);
  n.esconder();
  confere('ao esconder: uma chamada, por sendBeacon', n.enviados.length === 1 && n.enviados[0].via === 'beacon');
  const { corpo, url } = n.enviados[0];
  confere('vai para a en-api do AMENES_CONFIG', url === API);
  confere('ação eventos, com a sessão no corpo (o beacon não manda cabeçalho)', corpo.action === 'eventos' && corpo.s === TOKEN);
  const [pagina] = corpo.passos;
  confere('o passo é `pagina`, com o caminho SEM ? nem #', corpo.passos.length === 1 && pagina.n === 'pagina' && pagina.pg === '/en-offer-archangels', JSON.stringify(pagina));
  confere('as utm da página (só utm_*, e sem valor com @)', JSON.stringify(pagina.o) === '{"utm_source":"app-en","utm_medium":"popup","utm_campaign":"arcangeles"}', JSON.stringify(pagina.o));
  confere('de onde veio: só o caminho, do mesmo site', pagina.p.de === '/en');
  confere('nada do pacote carrega e-mail nem o que vem depois do #', !JSON.stringify(corpo).includes('maria@') && !JSON.stringify(corpo).includes('segredo'));
  confere('o aparelho: celular, android, não instalado', corpo.aparelho === 'mobile' && corpo.sistema === 'android' && corpo.instalado === false);
  confere('"há quantos segundos" é um número pequeno (não a hora do celular)', Number.isInteger(pagina.ha) && pagina.ha >= 0 && pagina.ha < 5);
  n.sairDaPagina();
  confere('pagehide logo depois NÃO manda de novo', n.enviados.length === 1);
  confere('a fila guardada fica vazia', !('amens-en.rastro' in n.disco.local));
}

console.log('\n3. Passos da tela: fila, relógio de 10 s, depois de minuto em minuto');
{
  const n = navegador({ disco: comSessao() });
  n.carregar(RASTRO);
  n.window.AMENES.rastro('card_visto', { card: 'arcangeles', situacao: 'bloqueado' });
  n.window.AMENES.rastro('card_visto', { card: 'cantico', situacao: 'bloqueado' });
  confere('o primeiro passo da tela liga UM relógio de 10 segundos', n.relogios.length === 1 && n.relogios[0].ms === 10000);
  confere('a fila fica guardada no navegador (se o celular matar a página)', JSON.parse(n.disco.local['amens-en.rastro']).q.length === 3);
  await n.passarTempo();
  confere('aos 10 s: um pacote com os 3 passos, por fetch', n.enviados.length === 1 && n.enviados[0].via === 'fetch' && n.enviados[0].corpo.passos.map(p => p.n).join() === 'pagina,card_visto,card_visto');
  confere('"text/plain" e sem cabeçalho próprio (o navegador não faz a pergunta prévia, OPTIONS)', Object.keys(n.enviados[0].headers).join() === 'Content-Type' && n.enviados[0].headers['Content-Type'].startsWith('text/plain') && n.enviados[0].keepalive === true);
  n.window.AMENES.rastro('card_toque', { card: 'arcangeles', situacao: 'bloqueado' });
  confere('o envio seguinte espera 1 minuto', n.relogios.length === 1 && n.relogios[0].ms === 60000);
  n.esconder();
  confere('mas ao sair da página vai na hora', n.enviados.length === 2 && n.enviados[1].via === 'beacon' && n.enviados[1].corpo.passos.map(p => p.n).join() === 'card_toque');
  n.window.AMENES.rastro('Nome Feio');
  n.window.AMENES.rastro('');
  n.window.AMENES.rastro(null, null);
  n.window.AMENES.rastro('video_play', { video: 'dia-1', dentro: { a: 1 }, lista: [1], n: 3, sim: true, vazio: '' });
  n.sairDaPagina();
  const ultimo = n.enviados.at(-1).corpo.passos;
  confere('nome fora do padrão é ignorado, sem erro', ultimo.length === 1 && ultimo[0].n === 'video_play');
  confere('props: só texto, número e sim/não', JSON.stringify(ultimo[0].p) === '{"video":"dia-1","n":3,"sim":true}', JSON.stringify(ultimo[0].p));
}

console.log('\n4. Muitos passos: pacotes de 20');
{
  const n = navegador({ disco: comSessao() });
  n.carregar(RASTRO);
  for (let i = 0; i < 18; i += 1) n.window.AMENES.rastro('card_visto', { card: `c${i}` });
  confere('antes de 20, nada enviado', n.enviados.length === 0);
  n.window.AMENES.rastro('card_visto', { card: 'c18' });
  await new Promise(resolve => setImmediate(resolve));
  confere('ao chegar a 20 (com o `pagina`), sai um pacote de 20 na hora', n.enviados.length === 1 && n.enviados[0].corpo.passos.length === 20);
}

console.log('\n5. Sem rede, erro do servidor e página morta: nada se perde, nada trava');
{
  const disco = comSessao();
  const n = navegador({ disco, semRede: true });
  n.carregar(RASTRO);
  n.window.AMENES.rastro('dia_aberto', { dia: 1 });
  await n.passarTempo();
  confere('sem rede: os passos voltam para a fila guardada', JSON.parse(disco.local['amens-en.rastro']).q.map(p => p.n).join() === 'pagina,dia_aberto');
  // O celular mata a página sem avisar. Ela abre outra página depois.
  const seguinte = navegador({ url: 'https://setemadrugadas.com.br/en-day', disco });
  seguinte.carregar(RASTRO);
  confere('a página seguinte herda os passos que sobraram e liga o relógio', seguinte.relogios.length === 1);
  seguinte.esconder();
  const passos = seguinte.enviados[0].corpo.passos;
  confere('e manda tudo junto, cada passo com a página em que aconteceu', passos.map(p => `${p.n}@${p.pg}`).join() === 'pagina@/en,dia_aberto@/en,pagina@/en-day', passos.map(p => `${p.n}@${p.pg}`).join());

  const n500 = navegador({ disco: comSessao(), resposta: { status: 503 } });
  n500.carregar(RASTRO);
  n500.window.AMENES.rastro('pdf_aberto', { pdf: 'guia' });
  await n500.passarTempo();
  confere('servidor com erro passageiro (503): volta para a fila', JSON.parse(n500.disco.local['amens-en.rastro']).q.length === 2);
  const n401 = navegador({ disco: comSessao(), resposta: { status: 401 } });
  n401.carregar(RASTRO);
  n401.window.AMENES.rastro('pdf_aberto', { pdf: 'guia' });
  await n401.passarTempo();
  confere('sessão recusada (401): descarta, não fica tentando', !('amens-en.rastro' in n401.disco.local));

  const semBeacon = navegador({ disco: comSessao(), beacon: false });
  semBeacon.carregar(RASTRO);
  semBeacon.esconder();
  confere('navegador sem sendBeacon: sai por fetch com keepalive', semBeacon.enviados.length === 1 && semBeacon.enviados[0].via === 'fetch' && semBeacon.enviados[0].keepalive === true);

  const outra = navegador({ disco: { local: { 'amens-en.sesion': 'f'.repeat(64), 'amens-en.rastro': JSON.stringify({ de: TOKEN.slice(0, 8), q: [{ n: 'pagina', p: {}, pg: '/en', t: Date.now(), o: {} }] }) }, sessao: {} } });
  outra.carregar(RASTRO);
  outra.esconder();
  confere('fila de OUTRA pessoa neste aparelho: não vai na conta de quem entrou', outra.enviados[0].corpo.passos.length === 1 && outra.enviados[0].corpo.s === 'f'.repeat(64));

  const quebrado = navegador({ disco: comSessao() });
  quebrado.window.localStorage.setItem = () => { throw new Error('cheio'); };
  quebrado.window.navigator.sendBeacon = () => { throw new Error('bloqueado'); };
  quebrado.window.fetch = () => { throw new Error('bloqueado'); };
  let erro = null;
  try { quebrado.carregar(RASTRO); quebrado.window.AMENES.rastro('card_toque', { card: 'x' }); quebrado.esconder(); quebrado.sairDaPagina(); } catch (e) { erro = e; }
  confere('armazenamento cheio e rede bloqueada: nenhum erro chega à tela', erro === null, String(erro));
}

console.log('\n6. Voltar pelo botão do navegador conta como página aberta de novo');
{
  const n = navegador({ disco: comSessao() });
  n.carregar(RASTRO);
  n.esconder();
  n.voltarDoCache();
  n.sairDaPagina();
  confere('um `pagina` novo, marcado como volta', n.enviados.length === 2 && n.enviados[1].corpo.passos[0].n === 'pagina' && n.enviados[1].corpo.passos[0].p.volta === true);
}

console.log('\n7. O aparelho');
{
  const iphone = navegador({ disco: comSessao(), ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari' });
  iphone.window.navigator.standalone = true;
  iphone.carregar(RASTRO); iphone.esconder();
  confere('iPhone aberto pelo ícone da tela inicial: mobile, ios, instalado', iphone.enviados[0].corpo.aparelho === 'mobile' && iphone.enviados[0].corpo.sistema === 'ios' && iphone.enviados[0].corpo.instalado === true);
  const pc = navegador({ disco: comSessao(), ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130' });
  pc.window.navigator.maxTouchPoints = 0;
  pc.carregar(RASTRO); pc.esconder();
  confere('computador com Windows: desktop, windows', pc.enviados[0].corpo.aparelho === 'desktop' && pc.enviados[0].corpo.sistema === 'windows');
}

console.log('\n8. Com o js/en/sesion.js: qualquer ordem de carregar, e a versão do teste A/B');
{
  const retrato = { en: Date.now(), retrato: { abierto: 1, completados: [], testes: { card_arcanjos_titulo: 'b' } } };
  const antes = navegador({ disco: { local: { 'amens-en.sesion': TOKEN }, sessao: { 'amens-en.retrato': JSON.stringify(retrato) } } });
  antes.carregar(RASTRO);
  const funcao = antes.window.AMENES.rastro;
  antes.carregar(SESION);
  confere('rastro.js ANTES do sesion.js: a função de verdade continua lá', antes.window.AMENES.rastro === funcao && typeof antes.window.AMENES.retrato === 'function');
  const depois = navegador({ disco: { local: { 'amens-en.sesion': TOKEN }, sessao: { 'amens-en.retrato': JSON.stringify(retrato) } } });
  depois.carregar(SESION);
  let erro = null;
  try { depois.window.AMENES.rastro('card_toque', { card: 'x' }); } catch (e) { erro = e; }
  confere('só o sesion.js (sem o rastro.js): a tela chama rastro() sem erro', erro === null && depois.enviados.length === 0);
  depois.carregar(RASTRO);
  depois.window.AMENES.rastro('card_toque', { card: 'x' });
  depois.esconder();
  confere('rastro.js DEPOIS do sesion.js: passa a gravar', depois.enviados.length === 1 && depois.enviados[0].corpo.passos.map(p => p.n).join() === 'pagina,card_toque');
  confere('variante(chave): a versão dela', depois.window.AMENES.variante('card_arcanjos_titulo') === 'b');
  confere('variante de teste que não existe: null (a tela mostra o padrão)', depois.window.AMENES.variante('nao_existe') === null && depois.window.AMENES.variante() === null);
  const semRetrato = navegador({ disco: comSessao() });
  semRetrato.carregar(SESION);
  confere('variante antes do retrato chegar: null, sem erro', semRetrato.window.AMENES.variante('card_arcanjos_titulo') === null);
}

console.log('\n9. O freio de mão: o teste `rastro` = `off` faz a tela parar de mandar');
{
  const retrato = { en: Date.now(), retrato: { testes: { rastro: 'off' } } };
  const n = navegador({ disco: { local: { 'amens-en.sesion': TOKEN }, sessao: { 'amens-en.retrato': JSON.stringify(retrato) } } });
  n.carregar(RASTRO);
  n.window.AMENES.rastro('card_toque', { card: 'x' });
  await n.passarTempo();
  n.esconder();
  confere('nenhuma chamada sai', n.enviados.length === 0);
  confere('e a fila é esvaziada', !('amens-en.rastro' in n.disco.local));
}

console.log(`\n${passou} conferências ok, ${falhou} falharam.`);
process.exit(falhou ? 1 : 0);
