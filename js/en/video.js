// O vídeo de cada dia do app em inglês. CÓPIA do js/es/video.js (que é cópia
// do js/video.js do Brasil). Arquivo só dos EUA: mudar o player do Brasil ou
// do espanhol não muda este, e vice-versa.
//
// Os vídeos ficam na Bunny, e NUNCA na Netlify (crédito). Dia sem vídeo aqui
// continua com a foto e o texto da oração.
//
// Vídeo novo = uma linha em VIDEOS: { video: '<ID na Bunny>', formato: '3:4' }.
// '3:4' é o vídeo em pé (para em 400px de largura); '16:9' é o deitado.
// O ID está na Bunny, no vídeo → "Video ID" (formato 8-4-4-4-12).
//
// EXCEÇÃO, os Dias 3 e 7 (quando tiverem vídeo com oferta): ficam na VTurb,
// como no Brasil e no espanhol, porque a oferta deles (js/en/oferta-dia.js)
// aparece pelo relógio do player da VTurb. Linha da VTurb:
// { vturb: '<id do player>', formato: '3:4' } (o id do embed, sem o "vid-").
// O script do player entra com carregar(dia), depois que a página desenha o
// vídeo. SEM o player da VTurb na tela, o js/en/dia.js não liga oferta
// nenhuma, e o dia tem o "I prayed this prayer" como os outros.
// `reserva`: o vídeo da Bunny que volta para a tela enquanto a oferta daquele
// dia não estiver completa (os três links do Dia 3). Sem isso, o vídeo da
// VTurb diria "Below this video, you'll see three options" sem nada embaixo.
(function () {
  'use strict';

  // A biblioteca da Bunny é a mesma do Brasil e do espanhol ("7 Améns -
  // entregas"), como no espanhol: todo vídeo do inglês se chama
  // "EN · Day N — <oração>" lá, para não se misturar (14/11/2026).
  // ⏳ EUA: a conta da VTurb ainda é a do Brasil e do espanhol (só os Dias 3
  // e 7, com a oferta, usam a VTurb).
  const BIBLIOTECA = '784501';
  const CONTA_VTURB = '3fe9f7a6-c604-479d-b1c4-ccd47fcf7108';

  // Os vídeos em inglês, com a voz do Father James. Dia sem linha mostra a
  // foto e o texto. Os IDs do espanhol NÃO servem aqui.
  // Os Dias 3 e 7 vêm da VTurb, com a oferta (o modelo do espanhol):
  //   3: { vturb: '<id do player>', formato: '3:4', reserva: { video: '<ID na Bunny, só a oração>', formato: '3:4' } },
  //   7: { vturb: '<id do player>', formato: '3:4' },
  // O Dia 3 com `reserva` só troca para a VTurb quando os três links de aporte
  // em js/en/oferta-dia.js estiverem preenchidos com o checkout americano.
  // ✅ EUA: os 8 vídeos do principal (Start Here e Dias 1 a 7) ligados em 18/11/2026.
  const VIDEOS = {
    0: { video: 'eb019a7f-43fc-487d-bc83-42ebde62c32e', formato: '3:4' }, // EN · Start Here — Introduction (8:01, 18/11)
    1: { video: '2a2fe00c-7984-42df-b7e4-7cdcfc25aa3d', formato: '3:4' }, // EN · Day 1 — The Complete Our Father (6:11, 14/11)
    2: { video: 'c8432043-dcb2-42dc-94cd-3419be99af92', formato: '3:4' }, // EN · Day 2 — The Prayer for Forgiveness (5:25, 14/11)
    4: { video: '17646ed9-b21f-48cf-a28c-6f1154dd1712', formato: '3:4' }, // EN · Day 4 — The Prayer for Deliverance (3:35, 14/11)
    5: { video: '41c5990e-ca7c-411f-8037-bd71f70bd339', formato: '3:4' }, // EN · Day 5 — The Prayer for Prosperity (3:53, 14/11)
    6: { video: 'f1055761-261b-4904-a395-b3d0831b1fa2', formato: '3:4' }, // EN · Day 6 — The Prayer for Peace (2:04, 18/11)
    // Dia 3 na VTurb (10:05, 18/11/2026): a oração (Amen aos 4:14) e, emendado
    // nela, o pedido de Sister Cecilia, com os três botões de contribuição
    // (js/en/oferta-dia.js).
    3: { vturb: '6afe48f3aab297248861c52f', formato: '3:4' }, // Third Amen (18/11/2026)
    // Dia 7 na VTurb (11:19, 18/11/2026): a oração e, emendada nela, a oferta
    // de "Three Mornings of Intercession" (botão em js/en/oferta-dia.js).
    7: { vturb: '6afdad97d47be1f668f1a133', formato: '3:4' }, // Seventh Amen (18/11/2026)
  };

  const FORMATOS = {
    '3:4': { altura: '133.3333%', larguraMaxima: '400px' },
    '16:9': { altura: '56.25%', larguraMaxima: '' }
  };

  const ID_DA_BUNNY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ID_DA_VTURB = /^[0-9a-f]{24}$/i;

  // ⚠️ autoplay=false é obrigatório: na Bunny, o padrão é tocar sozinho.
  // lang=en põe os botões do player em inglês.
  const OPCOES = 'autoplay=false&preload=true&rememberPosition=true&showSpeed=true&lang=en';

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
    return montar(escolher(dia), titulo);
  }

  // A montagem de um vídeo qualquer, { video | vturb, formato }. Também é usada
  // pelas telas de Three Mornings (js/en/tres-madrugadas-video.js, 23/11/2026).
  function montar(v, titulo) {
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

  // RASTRO (js/en/rastro-telas.js): play e 25/50/75/100 % do vídeo do dia, na
  // Bunny (iframe) e na VTurb. `aoTocar` é um extra chamado uma vez no play
  // (o dia com oferta o usa para o oferta_play). Chamar depois de o vídeo estar
  // na tela. Sem o ajudante, não faz nada.
  function rastrear(dia, raiz, aoTocar) {
    const R = window.AMENES_RASTRO;
    if (!R || !raiz) return;
    const onde = `dia-${dia}`;
    const ligar = (elemento, id, seguir) => seguir(
      elemento,
      () => { R.rastro('video_play', { video: id, onde }); if (typeof aoTocar === 'function') aoTocar(); },
      (pct) => R.rastro('video_progresso', { video: id, onde, pct }),
    );
    const iframe = raiz.querySelector('.video-bunny iframe');
    if (iframe) {
      const id = (iframe.getAttribute('src') || '').split('?')[0].split('/').pop();
      ligar(iframe, id, R.bunny);
    }
    const player = raiz.querySelector('vturb-smartplayer');
    if (player) ligar(player, String(player.id || '').replace(/^vid-/, ''), R.vturb);
  }

  window.AMENES_VIDEO = { html, carregar, rastrear, montar };
})();
