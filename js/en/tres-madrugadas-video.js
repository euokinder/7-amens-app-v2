// Uma das Three Mornings: o vídeo. CÓPIA do js/es/tres-madrugadas-video.js
// (que copia o script do tres-madrugadas-video.html do Brasil), em inglês
// (23/11/2026). Arquivo só do app em inglês.
// Sem vídeo (video: null, em js/en/tres-madrugadas.js), a tela mostra
// "Video coming soon".
// PROVISÓRIO: os textos em volta do vídeo (a copy é do Arthur).
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
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
      window.AMENES_EXTRAS.indisponible('We couldn\'t find this morning. Please go back to the Three Mornings.', '/en-three-mornings', 'Back to the Three Mornings');
    } else {
      document.title = `${madrugada.titulo} · ${TRES_MADRUGADAS.nombre}`;
      const video = madrugada.video && window.AMENES_VIDEO ? window.AMENES_VIDEO.montar(madrugada.video, madrugada.titulo) : '';
      const topo = video || `<div class="audio-card">
          <div class="audio-card-label">${iconeVideo}<span>Video coming soon</span></div>
          <p class="audio-card-aviso">We are finishing the video for this morning. It will appear here very soon, in this same place.</p>
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
          <h2 class="section-label" style="margin-bottom:14px;">How to pray</h2>
          <div class="modal-checklist">
            <div class="item">${check}<p>Tap the video to begin. Turn up your phone's volume or use headphones.</p></div>
            <div class="item">${check}<p>When the video asks you, say the person's name out loud.</p></div>
            <!-- O player da Bunny volta SOZINHO para o ponto onde ela parou
                 (rememberPosition, em js/en/video.js), como no Brasil. -->
            <div class="item">${check}<p>If you need to stop, you can leave. When you come back, the video picks up right where you left off.</p></div>
          </div>
        </div>

        <p class="subtext" style="text-align:center;">${esc(madrugada.proximo)}</p>

        <div class="banner">
          <span>Three mornings for each name</span>
        </div>

        <a class="member-button" href="/en-three-mornings" style="text-align:center;text-decoration:none;">See the three mornings</a>
      `;
      // RASTRO: play e progresso do vídeo, como nos dias (js/en/video.js).
      window.AMENES_VIDEO.rastrear(`tres-madrugadas-${numero}`, content);
    }
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
