// Uma das 3 Madrugadas: o vídeo. CÓPIA do script do tres-madrugadas-video.html
// do Brasil, em espanhol (18/11/2026). Arquivo só da LATAM.
// Enquanto o vídeo em espanhol não existe (video: null, em
// js/es/tres-madrugadas.js), a tela mostra "Video en preparación".
// PROVISÓRIO: os textos em volta do vídeo (a copy é do Arthur).
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.whatsapp('Hola, no puedo abrir Las 3 Madrugadas en mi app.');
  const content = document.getElementById('content');
  const numero = new URLSearchParams(location.search).get('m');
  const madrugada = /^[1-3]$/.test(numero || '') ? TRES_MADRUGADAS[numero] : null;
  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const check = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.2 2.2L15.5 9.5"/></svg>';
  const iconeVideo = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>';

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (!window.AMENES_EXTRAS.trancarPagina(r, 'tres_madrugadas')) {
    if (!madrugada) {
      window.AMENES_EXTRAS.indisponible('No encontramos esta madrugada. Vuelve a Las 3 Madrugadas.', '/es-tres-madrugadas', 'Volver a Las 3 Madrugadas');
    } else {
      document.title = `${madrugada.titulo} · ${TRES_MADRUGADAS.nombre}`;
      const video = madrugada.video && window.AMENES_VIDEO ? window.AMENES_VIDEO.montar(madrugada.video, madrugada.titulo) : '';
      const topo = video || `<div class="audio-card">
          <div class="audio-card-label">${iconeVideo}<span>Video en preparación</span></div>
          <p class="audio-card-aviso">Estamos terminando el video de esta madrugada. Muy pronto aparecerá aquí, en este mismo lugar.</p>
        </div>`;

      content.innerHTML = `
        <span class="kicker">${esc(madrugada.kicker)}</span>
        <div class="section-heading" style="margin-top:-8px;">
          <div class="bar"></div>
          <div class="heading-block">
            <h1 class="title" style="font-size:22px;">${esc(madrugada.titulo)}</h1>
            <p class="subtext">${esc(madrugada.subtitulo)}</p>
          </div>
        </div>

        ${topo}

        <div>
          <h2 class="section-label" style="margin-bottom:14px;">Cómo orar</h2>
          <div class="modal-checklist">
            <div class="item">${check}<p>Toca el video para comenzar. Sube el volumen del celular o usa audífonos.</p></div>
            <div class="item">${check}<p>Cuando el video te lo pida, di el nombre de la persona en voz alta.</p></div>
            <!-- O player da Bunny volta SOZINHO para o ponto onde ela parou
                 (rememberPosition, em js/es/video.js), como no Brasil. -->
            <div class="item">${check}<p>Si necesitas parar, puedes salir. Cuando vuelvas, el video sigue solo desde donde te quedaste.</p></div>
          </div>
        </div>

        <p class="subtext" style="text-align:center;">${esc(madrugada.proximo)}</p>

        <div class="banner">
          <span>Tres madrugadas por cada nombre</span>
        </div>

        <a class="member-button" href="/es-tres-madrugadas" style="text-align:center;text-decoration:none;">Ver las 3 madrugadas</a>
      `;
    }
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
