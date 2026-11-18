// O guia do suporte e a troca de país do /es-reembolsos (18/11/2026).
// Separado por país (Arthur, 18/11): no topo, LATAM | EUA; em cada país,
// "Pedidos de reembolso" e "Guia do suporte". Este arquivo troca o país e a
// seção e copia os links e as respostas dos guias. Não fala com servidor.
// O país fica em document.body.dataset.pais; a cada troca sai o evento
// "pais-mudou", que o reembolsos-painel.js escuta para redesenhar a lista.
// O país escolhido fica guardado neste navegador (localStorage).
// Endereços: /es-reembolsos#latam, #eua, #guia (o guia do país guardado),
// #latam-guia e #eua-guia. #<id do pedido> é da gaveta (o painel cuida).
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CHAVE = 'reembolsos.pais';
  const GUIAS = { latam: 'aba-guia', eua: 'aba-guia-eua' };
  const PAINEL_COMPLETO = { latam: '/es-admin', eua: '/en-admin' };
  const botoesPais = Array.from(document.querySelectorAll('.pais-botao'));
  const botoesTela = Array.from(document.querySelectorAll('.troca-botao'));
  if (!botoesTela.length) return;

  const lerPais = () => { try { return localStorage.getItem(CHAVE) === 'eua' ? 'eua' : 'latam'; } catch (e) { return 'latam'; } };
  const gravarPais = pais => { try { localStorage.setItem(CHAVE, pais); } catch (e) { /* sem armazenamento, segue */ } };
  let pais = lerPais();
  let tela = 'pedidos';

  function aplicar(mexerNoEndereco) {
    document.body.dataset.pais = pais;
    botoesPais.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pais === pais)));
    botoesTela.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tela === tela)));
    $('aba-pedidos').hidden = tela !== 'pedidos';
    for (const [chave, id] of Object.entries(GUIAS)) if ($(id)) $(id).hidden = !(tela === 'guia' && chave === pais);
    const marca = $('marca-pais');
    if (marca) marca.textContent = pais === 'eua' ? '.eua' : '.latam';
    const completo = $('painel-completo');
    if (completo) completo.setAttribute('href', PAINEL_COMPLETO[pais]);
    // O "Atualizar" é da fila; no guia, some.
    const atualizar = $('botao-atualizar');
    if (atualizar) atualizar.hidden = tela !== 'pedidos';
    if (mexerNoEndereco) {
      const hash = tela === 'guia' ? `#${pais}-guia` : `#${pais}`;
      try { history.replaceState(null, '', hash); } catch (e) { /* sem histórico, segue */ }
    }
    window.dispatchEvent(new CustomEvent('pais-mudou', { detail: { pais, tela } }));
  }

  function trocar(novoPais, novaTela, mexerNoEndereco = true) {
    if (novoPais && novoPais !== pais) { pais = novoPais; gravarPais(pais); }
    if (novaTela) tela = novaTela;
    aplicar(mexerNoEndereco);
  }
  // O painel usa para abrir um pedido de outro país (link com #<id>).
  window.REEMBOLSOS_PAIS = { trocar: novoPais => trocar(novoPais, 'pedidos', false), atual: () => pais };

  botoesPais.forEach(b => b.addEventListener('click', () => { trocar(b.dataset.pais, null); window.scrollTo(0, 0); }));
  botoesTela.forEach(b => b.addEventListener('click', () => { trocar(null, b.dataset.tela); window.scrollTo(0, 0); }));

  // O endereço manda mais que o país guardado.
  const doEndereco = location.hash.slice(1);
  const pedido = /^(latam|eua)(-guia)?$/.exec(doEndereco);
  if (pedido) trocar(pedido[1], pedido[2] ? 'guia' : 'pedidos', false);
  else if (doEndereco === 'guia') trocar(null, 'guia', false);
  else aplicar(false);

  let tempo;
  function avisar(texto) {
    const caixa = $('aviso-rapido');
    if (!caixa) return;
    caixa.textContent = texto;
    caixa.classList.remove('erro');
    caixa.hidden = false;
    clearTimeout(tempo);
    tempo = setTimeout(() => { caixa.hidden = true; }, 2200);
  }

  function selecionar(el) {
    try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* nada */ }
  }

  const copiarNoGuia = e => {
    const botao = e.target.closest('[data-copiar], [data-copiar-de]');
    if (!botao) return;
    const origem = botao.dataset.copiarDe ? $(botao.dataset.copiarDe) : null;
    const texto = origem ? origem.innerText.trim() : botao.dataset.copiar;
    const deuCerto = () => {
      botao.classList.add('copiado');
      setTimeout(() => botao.classList.remove('copiado'), 1500);
      avisar('Copiado');
    };
    const falhou = () => {
      if (origem) selecionar(origem);
      avisar(origem ? 'Não deu para copiar sozinho: o texto ficou selecionado, use Ctrl+C' : 'Não deu para copiar. Link: ' + texto);
    };
    try { navigator.clipboard.writeText(texto).then(deuCerto, falhou); } catch (err) { falhou(); }
  };
  // Os dois guias copiam do mesmo jeito (o dos EUA, quando for preenchido).
  Object.values(GUIAS).forEach(id => { if ($(id)) $(id).addEventListener('click', copiarNoGuia); });
})();
