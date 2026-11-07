// O vídeo de cada dia do app em espanhol. CÓPIA do js/video.js do Brasil, só
// com a parte da Bunny (a LATAM não usa a VTurb). Arquivo só da LATAM: mudar o
// player do Brasil não muda este, e vice-versa.
//
// Os vídeos ficam na mesma biblioteca da Bunny dos vídeos do Brasil
// ("7 Améns - entregas"), e NUNCA na Netlify (crédito). Dia sem vídeo aqui
// continua com a foto, como antes.
//
// Vídeo novo = uma linha em VIDEOS: { video: '<ID na Bunny>', formato: '3:4' }.
// '3:4' é o vídeo em pé (para em 400px de largura); '16:9' é o deitado.
// O ID está na Bunny, no vídeo → "Video ID" (formato 8-4-4-4-12).
(function () {
  'use strict';

  const BIBLIOTECA = '784501';

  const VIDEOS = {
    0: { video: '48b02931-7948-4a14-a8a4-2fd3ea43e2d1', formato: '3:4' }, // Comienza aquí (INTRO_esp, 9:20, 06/11/2026)
  };

  const FORMATOS = {
    '3:4': { altura: '133.3333%', larguraMaxima: '400px' },
    '16:9': { altura: '56.25%', larguraMaxima: '' }
  };

  const ID_DA_BUNNY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ⚠️ autoplay=false é obrigatório: na Bunny, o padrão é tocar sozinho.
  // lang=es põe os botões do player em espanhol.
  const OPCOES = 'autoplay=false&preload=true&rememberPosition=true&showSpeed=true&lang=es';

  const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Devolve o HTML do vídeo do dia, ou '' se o dia ainda não tem vídeo.
  // Mesma montagem em duas caixas do Brasil (a altura em % conta a largura da
  // caixa de FORA; numa caixa só, o vídeo em pé ficaria alto demais).
  function html(dia, titulo) {
    const v = VIDEOS[dia];
    const formato = v && FORMATOS[v.formato || '3:4'];
    if (!v || !formato || !ID_DA_BUNNY.test(v.video || '')) return '';
    const largura = formato.larguraMaxima ? ` max-width: ${formato.larguraMaxima};` : '';
    const endereco = `https://player.mediadelivery.net/embed/${BIBLIOTECA}/${v.video}?${OPCOES}`;
    return `<div class="video-bunny" style="display: block; width: 100%;${largura} margin: 0 auto;">`
      + `<div style="position: relative; width: 100%; padding-top: ${formato.altura}; background-color: black; border-radius: 16px; overflow: hidden;">`
      + `<iframe src="${endereco}" title="${escapar(titulo || 'Video')}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>`
      + '</div></div>';
  }

  window.AMENES_VIDEO = { html };
})();
