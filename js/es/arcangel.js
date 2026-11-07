// As três orações de um Arcángel (/es-arcangel?a=miguel), uma embaixo da
// outra. CÓPIA do script do arcanjo.html do Brasil, em espanhol. Arquivo só
// da LATAM.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const OVERLAY = 'linear-gradient(to top, oklch(0.06 0.01 40 / 0.35) 0%, transparent 45%)';
  const seta = '<svg class="chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const arcangel = arcangelPorClave(new URLSearchParams(location.search).get('a'));
  const content = document.getElementById('content');

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (window.AMENES_EXTRAS.trancarPagina(r, 'arcangeles')) {
    // trancada: o convite para conhecer já está na tela
  } else if (!arcangel) {
    window.AMENES_EXTRAS.indisponible('No encontramos este Arcángel. Vuelve a la Central de los Cuatro Arcángeles.', '/es-arcangeles', 'Volver a la Central');
  } else {
    document.title = `${tituloDelArcangel(arcangel)} — Central de los Cuatro Arcángeles`;
    const cartoes = arcangel.oraciones.map((item, indice) => `
      <a href="/es-oracion-arcangel?a=${arcangel.clave}&o=${indice + 1}" class="card" style="height:240px;background-image:${OVERLAY}, url(${arcangel.imagen});">
        <div class="card-body row">
          <div style="display:flex;flex-direction:column;gap:6px;">
            <h3 class="card-title">${esc(item.titulo)}</h3>
            <p class="card-sub">${esc(item.descripcion)}</p>
          </div>
          ${seta}
        </div>
      </a>`).join('');
    // Desenhado ANTES dos efeitos (js/es/app.js), como no Brasil.
    content.innerHTML = `
      <span class="kicker">Central de los Cuatro Arcángeles</span>
      <div class="section-heading" style="margin-top:-8px;">
        <div class="bar"></div>
        <div class="heading-block">
          <h1 class="title" style="font-size:22px;">${esc(tituloDelArcangel(arcangel))}</h1>
          <p class="subtext">Elige la oración que necesitas en este momento.</p>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px;">${cartoes}</div>`;
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
