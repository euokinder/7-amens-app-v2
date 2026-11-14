// The Four Archangels (a "Central dos 4 Arcanjos" do Brasil): os quatro, em
// cartões com foto. CÓPIA do script do arcanjos.html do Brasil (via
// js/es/arcangeles-lista.js), em inglês. Quem não comprou vê o convite para
// conhecer (js/en/extras.js). Arquivo só do app em inglês.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const OVERLAY = 'linear-gradient(to top, oklch(0.06 0.01 40 / 0.35) 0%, transparent 45%)';

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (!window.AMENES_EXTRAS.trancarPagina(r, 'arcangeles')) {
    const el = window.AMENES.el;
    const lista = document.getElementById('arcangeles-lista');
    // Desenhado ANTES dos efeitos (js/en/app.js): o foco ao rolar só enxerga
    // os cartões que já existem quando ele começa.
    for (const arcangel of ARCANGELES) {
      const cartao = el('a', { class: 'card', href: `/en-archangel?a=${arcangel.clave}` },
        el('div', { class: 'pill-badge', text: `${arcangel.oraciones.length} PRAYERS` }),
        el('div', { class: 'card-body' },
          el('h3', { class: 'card-title', text: tituloDelArcangel(arcangel) }),
          el('p', { class: 'card-sub', text: arcangel.resumen }),
          // Um <button> de verdade, como no arcanjos.html do Brasil: o estilo
          // .cta-btn conta com isso para centralizar o texto (com <span>, o
          // texto ficava no canto, visto pelo Caio em 07/11).
          el('button', { class: 'cta-btn', type: 'button', tabindex: '-1', text: 'See the prayers' })));
      cartao.style.height = '300px';
      cartao.style.backgroundImage = `${OVERLAY}, url(${arcangel.imagen})`;
      lista.append(cartao);
    }
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
