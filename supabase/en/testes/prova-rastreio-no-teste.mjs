// Prova do RASTREAMENTO do app em inglês, de ponta a ponta, na en-api
// publicada no projeto de TESTE (wyiqwsgfictcfkytldnu): o pacote de passos é
// gravado, o pacote sujo é limpo, o envio "ao sair da página" (sem cabeçalho)
// funciona, o pop-up e o "rezou" viram passos pelo servidor, e cada cliente
// cai SEMPRE na mesma versão do teste A/B. O login e a jornada seguem iguais.
// NUNCA aponta para a produção: o endereço está fixo e o script recusa outro.
//
// ANTES e DEPOIS (no banco de TESTE, pelo SQL Editor ou pelo agente): o
// arquivo irmão, prova-rastreio-no-teste.sql.
//   1. bloco PREPARAR   cria 6 clientes de mentira e 2 testes A/B
//   2. este script      (28 chamadas, uma depois da outra)
//   3. bloco CONFERIR   lê o que ficou gravado, roda o resumo e o funil
//   4. bloco LIMPAR     apaga tudo o que a prova criou
//
// Como rodar:
//   "C:\Program Files\nodejs\node.exe" supabase/en/testes/prova-rastreio-no-teste.mjs

const BASE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/en-api';
if (!BASE.includes('wyiqwsgfictcfkytldnu')) throw new Error('Só o banco de TESTE.');
const ORIGIN = 'http://localhost:3500';
const CLIENTES = [1, 2, 3, 4, 5, 6].map(n => `prova.rastreio.${n}@exemplo.com`);

let falhas = 0;
let chamadas = 0;
const confere = (nome, ok, extra = '') => {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}${extra ? ` | ${extra}` : ''}`);
};

// Como a tela chama: JSON, com a sessão no cabeçalho.
async function api(corpo, sessao, { origin = ORIGIN } = {}) {
  chamadas += 1;
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (sessao) headers['x-en-session'] = sessao;
  const r = await fetch(BASE, { method: 'POST', headers, body: JSON.stringify({ tz: 'America/Chicago', ...corpo }) });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { bruto: texto.slice(0, 200) }; }
  return { status: r.status, json };
}
// Como o js/en/rastro.js manda o pacote: "text/plain", SEM cabeçalho de
// sessão (o sendBeacon não manda cabeçalho), com a sessão no campo `s`.
async function pacote(sessao, passos, extra = {}) {
  chamadas += 1;
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ action: 'eventos', tz: 'America/Chicago', s: sessao, aparelho: 'mobile', sistema: 'android', instalado: false, passos, ...extra }),
  });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { bruto: texto.slice(0, 200) }; }
  return { status: r.status, json };
}

console.log(`Prova do rastreamento em ${BASE}\n`);

// ---------------------------------------------------------------- 1. o login
const sessoes = [];
const versoes = [];
for (const email of CLIENTES) {
  const r = await api({ action: 'login', email });
  sessoes.push(r.json?.token || '');
  versoes.push(r.json?.testes || null);
}
confere('as 6 clientes de mentira entram (rodou o bloco PREPARAR?)', sessoes.every(s => /^[a-f0-9]{64}$/.test(s)));
if (!sessoes.every(Boolean)) { console.log('\nSem as clientes da prova, não dá para continuar.'); process.exit(1); }
confere('o retrato traz `testes`, com uma versão do teste ligado', versoes.every(v => v && ['a', 'b'].includes(v.prova_rastreio)), JSON.stringify(versoes.map(v => v?.prova_rastreio)));
confere('teste DESLIGADO não vem no retrato', versoes.every(v => v && !('prova_rastreio_desligado' in v)));
const dasDuas = new Set(versoes.map(v => v?.prova_rastreio));
console.log(`     (versões sorteadas: ${versoes.map(v => v?.prova_rastreio).join(' ')})`);
confere('entre 6 clientes saem as duas versões', dasDuas.size === 2);
// Teste só para quem NÃO tem o Cântico: a cliente 6 tem (liberado no PREPARAR).
confere('público "nao_tem cantico": quem tem o Cântico fica fora do teste', versoes[5] && !('prova_rastreio_publico' in versoes[5]) && versoes.slice(0, 5).every(v => v && 'prova_rastreio_publico' in v), JSON.stringify(versoes.map(v => v?.prova_rastreio_publico || '-')));

// ------------------------------------------------- 2. a mesma versão, sempre
const deNovo = [];
for (const email of CLIENTES.slice(0, 3)) deNovo.push((await api({ action: 'login', email })).json?.testes);
confere('entrar de novo (outra sessão, "outro celular"): a MESMA versão', deNovo.every((v, i) => JSON.stringify(v) === JSON.stringify(versoes[i])), JSON.stringify(deNovo));
const sessao1 = sessoes[0];
const retrato = await api({ action: 'session' }, sessao1);
confere('abrir a página (session): a mesma versão, e a jornada igual', retrato.status === 200 && JSON.stringify(retrato.json.testes) === JSON.stringify(versoes[0]) && typeof retrato.json.abierto === 'number' && Array.isArray(retrato.json.completados));

// ------------------------------------------------------ 3. o pacote de passos
// A cliente 1 percorre o funil dos Arcanjos inteiro.
const funil = await pacote(sessao1, [
  { n: 'pagina', p: {}, pg: '/en', ha: 300 },
  { n: 'card_visto', p: { card: 'arcangeles', situacao: 'bloqueado' }, pg: '/en', ha: 295 },
  { n: 'card_visto', p: { card: 'cantico', situacao: 'bloqueado' }, pg: '/en', ha: 295 },
  { n: 'card_toque', p: { card: 'arcangeles', situacao: 'bloqueado' }, pg: '/en', ha: 280 },
  { n: 'pagina', p: { de: '/en' }, pg: '/en-offer-archangels', ha: 278, o: { utm_source: 'app-en', utm_medium: 'card', utm_campaign: 'arcangeles' } },
  { n: 'oferta_play', p: { oferta: 'arcangeles' }, pg: '/en-offer-archangels', ha: 270, o: { utm_source: 'app-en', utm_medium: 'card', utm_campaign: 'arcangeles' } },
  { n: 'oferta_pitch', p: { oferta: 'arcangeles' }, pg: '/en-offer-archangels', ha: 90 },
  { n: 'oferta_checkout_toque', p: { oferta: 'arcangeles', nivel: 'complete' }, pg: '/en-offer-archangels', ha: 60 },
  { n: 'dia_aberto', p: { dia: 1 }, pg: '/en-day', ha: 30 },
  { n: 'video_play', p: { video: 'dia-1', onde: 'dia' }, pg: '/en-day', ha: 25 },
  { n: 'video_progresso', p: { video: 'dia-1', onde: 'dia', pct: 25 }, pg: '/en-day', ha: 10 },
  { n: 'pdf_aberto', p: { pdf: 'guia', onde: 'materials' }, pg: '/en-materials', ha: 5 },
  { n: 'lucy_aberta', p: {}, pg: '/en', ha: 2 },
  { n: 'suporte_toque', p: { canal: 'email' }, pg: '/en', ha: 1 },
]);
confere('pacote da cliente 1 (14 passos, sem cabeçalho, sessão no corpo): gravados', funil.status === 200 && funil.json?.ok === true && funil.json?.gravados === 14, JSON.stringify(funil.json));

// As clientes 2 a 5: viram o card; a 2 e a 3 tocaram; só a 2 deu play.
for (const [i, passos] of [
  [1, ['pagina', 'card_visto', 'card_toque', 'pagina_oferta', 'oferta_play']],
  [2, ['pagina', 'card_visto', 'card_toque', 'pagina_oferta']],
  [3, ['pagina', 'card_visto']],
  [4, ['pagina', 'card_visto']],
]) {
  const r = await pacote(sessoes[i], passos.map(nome => (
    nome === 'pagina' ? { n: 'pagina', pg: '/en', ha: 50 }
      : nome === 'pagina_oferta' ? { n: 'pagina', pg: '/en-offer-archangels', ha: 20 }
        : nome.startsWith('card_') ? { n: nome, p: { card: 'arcangeles', situacao: 'bloqueado' }, pg: '/en', ha: 40 }
          : { n: nome, p: { oferta: 'arcangeles' }, pg: '/en-offer-archangels', ha: 10 })));
  confere(`pacote da cliente ${i + 1}: ${passos.length} gravados`, r.json?.gravados === passos.length, JSON.stringify(r.json));
}
// A cliente 6 TEM os dois extras: o card dela é "liberado" e não entra no funil.
const liberado = await pacote(sessoes[5], [
  { n: 'pagina', pg: '/en' },
  { n: 'card_visto', p: { card: 'arcangeles', situacao: 'liberado' }, pg: '/en' },
  { n: 'audio_play', p: { extra: 'arcangeles', faixa: 'miguel-1' }, pg: '/en-archangel-prayer' },
]);
confere('pacote da cliente 6 (card liberado + áudio): 3 gravados', liberado.json?.gravados === 3);

// --------------------------------------------------------- 4. o pacote sujo
const sujo = await pacote(sessao1, [
  { n: 'rezou', p: { dia: 7 } },                      // só o servidor grava
  { n: 'popup_visto', p: { campanha: 'x' } },         // idem
  { n: 'Nome Feio!' },
  { n: 'pdf_aberto', p: { pdf: 'sujo', contato: 'alguem@exemplo.com', lista: [1], dentro: { a: 1 } }, pg: '/en-login?x=1#Abc123Def456Ghi7' },
]);
confere('pacote sujo: só 1 passo passa (os do servidor e o nome torto ficam fora)', sujo.status === 200 && sujo.json?.gravados === 1, JSON.stringify(sujo.json));
const vazio = await pacote(sessao1, []);
confere('pacote vazio: 200, nada gravado', vazio.status === 200 && vazio.json?.gravados === 0);
const semSessao = await pacote('f'.repeat(64), [{ n: 'pagina', pg: '/en' }]);
confere('sessão que não existe: 401 (a tela descarta a fila)', semSessao.status === 401);
const estranho = await api({ action: 'eventos', passos: [{ n: 'pagina' }] }, sessao1, { origin: 'https://site-estranho.com' });
confere('site estranho: 403', estranho.status === 403);
const comCabecalho = await api({ action: 'eventos', passos: [{ n: 'lucy_mensagem', pg: '/en' }] }, sessao1);
confere('com a sessão no cabeçalho (JSON) também grava', comCabecalho.status === 200 && comCabecalho.json?.gravados === 1);

// ------------------------------------------- 5. os passos que o SERVIDOR grava
const rezou = await api({ action: 'progress', day: 1, done: true, pagina: '/en-day' }, sessao1);
confere('"I prayed this prayer" continua funcionando (200, dia 1 marcado)', rezou.status === 200 && rezou.json.completados.includes(1), JSON.stringify(rezou.json?.completados));
confere('o retrato depois de marcar ainda traz a versão do teste', JSON.stringify(rezou.json.testes) === JSON.stringify(versoes[0]));
const popup = await api({ action: 'oferta', campaign_key: 'en_arcangeles_novas_1', event: 'shown', pagina: '/en' }, sessoes[4]);
confere('o pop-up (apareceu) continua respondendo 200', popup.status === 200 && popup.json?.ok === true);
const tocou = await api({ action: 'oferta', campaign_key: 'en_arcangeles_novas_1', event: 'clicked', pagina: '/en' }, sessoes[4]);
confere('o pop-up (tocou): 200', tocou.status === 200);

// ----------------------------------------------- 6. o que já existia, igual
const desconhecida = await api({ action: 'borrar_todo' }, sessao1);
confere('ação desconhecida: 400 "Invalid request." (a /en-login reconhece por este texto)', desconhecida.status === 400 && desconhecida.json?.error === 'Invalid request.');
const saiu = await api({ action: 'logout' }, deNovo.length ? sessoes[3] : '');
confere('logout: 200', saiu.status === 200);
const depois = await pacote(sessoes[3], [{ n: 'pagina', pg: '/en' }]);
confere('depois do logout, a sessão não grava mais passo: 401', depois.status === 401);

console.log(`\n${chamadas} chamadas. ${falhas ? `${falhas} FALHA(S).` : 'Tudo certo.'}`);
console.log('Agora: o bloco CONFERIR de supabase/en/testes/prova-rastreio-no-teste.sql (depois de 1 minuto, por causa do funil).');
process.exit(falhas ? 1 : 0);
