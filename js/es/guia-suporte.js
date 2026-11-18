// O guia do suporte, a segunda aba do /es-reembolsos (18/11/2026).
// Só troca entre a fila e o guia e copia os links e as respostas.
// Não fala com servidor nenhum e não mexe no reembolsos-painel.js.
// Abrir direto no guia: /es-reembolsos#guia
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const botoes = Array.from(document.querySelectorAll('.troca-botao'));
  if (!botoes.length) return;

  function mostrar(tela) {
    botoes.forEach(b => {
      const ativo = b.dataset.tela === tela;
      b.setAttribute('aria-pressed', String(ativo));
      $(b.dataset.tela).hidden = !ativo;
    });
    // O "Novo pedido" e o "Atualizar" são da fila; no guia, somem.
    const atualizar = $('botao-atualizar');
    if (atualizar) atualizar.hidden = tela !== 'aba-pedidos';
    try { history.replaceState(null, '', tela === 'aba-guia' ? '#guia' : location.pathname); } catch (e) { /* sem histórico, segue */ }
  }
  botoes.forEach(b => b.addEventListener('click', () => { mostrar(b.dataset.tela); window.scrollTo(0, 0); }));
  if (location.hash === '#guia') mostrar('aba-guia');

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

  $('aba-guia').addEventListener('click', e => {
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
  });
})();
