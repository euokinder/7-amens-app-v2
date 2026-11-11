// O vídeo de cada dia do app em espanhol. CÓPIA do js/video.js do Brasil.
// Arquivo só da LATAM: mudar o player do Brasil não muda este, e vice-versa.
//
// Os vídeos ficam na mesma biblioteca da Bunny dos vídeos do Brasil
// ("7 Améns - entregas"), e NUNCA na Netlify (crédito). Dia sem vídeo aqui
// continua com a foto, como antes.
//
// Vídeo novo = uma linha em VIDEOS: { video: '<ID na Bunny>', formato: '3:4' }.
// '3:4' é o vídeo em pé (para em 400px de largura); '16:9' é o deitado.
// O ID está na Bunny, no vídeo → "Video ID" (formato 8-4-4-4-12).
//
// EXCEÇÃO, os Dias 3 e 7: ficam na VTurb, como no Brasil, porque a oferta
// deles (js/es/oferta-dia.js) aparece pelo relógio do player da VTurb. Linha
// da VTurb: { vturb: '<id do player>', formato: '3:4' } (o id do embed, sem o
// "vid-"). O script do player entra com carregar(dia), depois que a página
// desenha o vídeo.
// `reserva` (Dia 3, 09/11/2026): o vídeo da Bunny que volta para a tela
// enquanto a oferta daquele dia não estiver completa (os três links). Sem
// isso, o vídeo da VTurb diria "aquí abajo vas a ver tres opciones" sem nada
// embaixo.
(function () {
  'use strict';

  const BIBLIOTECA = '784501';
  const CONTA_VTURB = '3fe9f7a6-c604-479d-b1c4-ccd47fcf7108';

  const VIDEOS = {
    // Na Bunny, os vídeos da LATAM começam com "ES · Día N —" (renomeados em
    // 07/11/2026, para não se confundirem com os do Brasil na mesma biblioteca).
    0: { video: '48b02931-7948-4a14-a8a4-2fd3ea43e2d1', formato: '3:4' }, // ES · Día 0 — Introducción (9:20, 06/11/2026)
    1: { video: 'aec33453-7fcd-435b-815d-b0089d2442da', formato: '3:4' }, // ES · Día 1 — El Padre Nuestro Completo (5:57, 07/11/2026)
    2: { video: '2a8e429b-50f5-4b5a-8289-4dacf065a04d', formato: '3:4' }, // ES · Día 2 — La Oración del Perdón (5:28, 07/11/2026)
    // Dia 3 na VTurb (11:07, 09/11/2026): a oração do padre e, emendada nela,
    // a mensagem da segunda voz, com os três aportes aos 9:37.
    // A reserva é o vídeo só com a oração, o que estava no ar até 09/11.
    3: {
      vturb: '6af12083cbb56d66d7f008d6', formato: '3:4', // Tercer Amén + el mensaje (09/11/2026)
      reserva: { video: '4038b064-df50-4454-a512-d5b44b3b891c', formato: '3:4' }, // ES · Día 3 — La Oración de Sanación (4:48, 07/11/2026)
    },
    4: { video: '56a5efcc-ac52-4ac2-84b8-ceb4dadecaeb', formato: '3:4' }, // ES · Día 4 — La Oración de Liberación (3:02, 08/11/2026; a fala acaba em "ya no tenga poder sobre mí", aprovado pelo Caio assim)
    5: { video: '52ad9643-5ae1-4ea0-8303-037def01cd50', formato: '3:4' }, // ES · Día 5 — La Oración de la Prosperidad (5:08, 08/11/2026)
    6: { video: 'c69b1539-341f-4f6e-b299-140e2e046e45', formato: '3:4' }, // ES · Día 6 — La Oración de la Paz (3:03, 08/11/2026)
    // Dia 7 na VTurb (12:18): a oração vai até o Amén (4:51); depois, a oferta
    // de "Las 3 Madrugadas de Intercesión", com o botão aos 12:02.
    // (A cópia na Bunny, 40c47ce8-1bc4-4b99-93d4-30df8e2602a4, fica de reserva.)
    7: { vturb: '6af1013d882703ca9fa8ffd0', formato: '3:4' }, // Séptimo Amén (08/11/2026)
  };

  const FORMATOS = {
    '3:4': { altura: '133.3333%', larguraMaxima: '400px' },
    '16:9': { altura: '56.25%', larguraMaxima: '' }
  };

  const ID_DA_BUNNY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ID_DA_VTURB = /^[0-9a-f]{24}$/i;

  // ⚠️ autoplay=false é obrigatório: na Bunny, o padrão é tocar sozinho.
  // lang=es põe os botões do player em espanhol.
  const OPCOES = 'autoplay=false&preload=true&rememberPosition=true&showSpeed=true&lang=es';

  const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // O vídeo que vai para a tela: o da VTurb ou, se o dia tem `reserva` e a
  // oferta dele ainda não está completa, o da reserva (ver o topo).
  function escolher(dia) {
    const v = VIDEOS[dia];
    if (!v || !v.reserva) return v;
    const oferta = window.AMENES_OFERTA_DIA && window.AMENES_OFERTA_DIA.para(dia);
    return oferta ? v : v.reserva;
  }

  // Devolve o HTML do vídeo do dia, ou '' se o dia ainda não tem vídeo.
  // Mesma montagem em duas caixas do Brasil (a altura em % conta a largura da
  // caixa de FORA; numa caixa só, o vídeo em pé ficaria alto demais).
  function html(dia, titulo) {
    const v = escolher(dia);
    const formato = v && FORMATOS[v.formato || '3:4'];
    if (!v || !formato) return '';
    if (v.vturb) {
      // A mesma montagem do <vturb-smartplayer> que a VTurb entrega no embed.
      if (!ID_DA_VTURB.test(v.vturb)) return '';
      const largura = formato.larguraMaxima ? ` max-width: ${formato.larguraMaxima};` : '';
      const altura = v.formato === '16:9' ? '56.25%' : '133.33333333333331%';
      return `<vturb-smartplayer id="vid-${v.vturb}" style="display: block; margin: 0 auto; width: 100%;${largura}">`
        + `<div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: ${altura} 0 0; z-index: 0; background-color: black;"></div>`
        + '</vturb-smartplayer>';
    }
    if (!ID_DA_BUNNY.test(v.video || '')) return '';
    const largura = formato.larguraMaxima ? ` max-width: ${formato.larguraMaxima};` : '';
    const endereco = `https://player.mediadelivery.net/embed/${BIBLIOTECA}/${v.video}?${OPCOES}`;
    return `<div class="video-bunny" style="display: block; width: 100%;${largura} margin: 0 auto;">`
      + `<div style="position: relative; width: 100%; padding-top: ${formato.altura}; background-color: black; border-radius: 16px; overflow: hidden;">`
      + `<iframe src="${endereco}" title="${escapar(titulo || 'Video')}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>`
      + '</div></div>';
  }

  // O script do player da VTurb, uma vez só, depois que o vídeo está na tela.
  // Dia da Bunny não precisa de nada (é um iframe).
  function carregar(dia) {
    const v = escolher(dia);
    if (!v || !v.vturb || !ID_DA_VTURB.test(v.vturb)) return;
    const src = `https://scripts.converteai.net/${CONTA_VTURB}/players/${v.vturb}/v4/player.js`;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  window.AMENES_VIDEO = { html, carregar };
})();
