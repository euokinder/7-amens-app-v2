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

  // ⏳ EUA: a biblioteca da Bunny e a conta da VTurb são as do Brasil e do
  // espanhol. O plano (docs/app-en.md, bloco 5) fala em armazenamento próprio
  // do inglês: conferir e trocar aqui quando os vídeos em inglês chegarem.
  const BIBLIOTECA = '784501';
  const CONTA_VTURB = '3fe9f7a6-c604-479d-b1c4-ccd47fcf7108';

  // ⏳ EUA: os vídeos em inglês ainda não existem (roteiros aprovados, em
  // produção). Por isso NENHUM dia tem linha aqui: todos mostram a foto e o
  // texto, e os Dias 3 e 7 ficam sem oferta e com o "I prayed this prayer"
  // (a oferta só liga com o player da VTurb na tela; ver js/en/dia.js).
  // Os IDs do espanhol NÃO servem aqui: o padre fala em espanhol.
  // Quando chegarem, o modelo das linhas (o mesmo do espanhol):
  //   0: { video: '<ID na Bunny>', formato: '3:4' }, // EN · Day 0 — Start Here
  //   1: { video: '<ID na Bunny>', formato: '3:4' }, // EN · Day 1 — The Complete Our Father
  //   ...
  //   3: { vturb: '<id do player>', formato: '3:4', reserva: { video: '<ID na Bunny, só a oração>', formato: '3:4' } },
  //   7: { vturb: '<id do player>', formato: '3:4' },
  // O Dia 3 com `reserva` só troca para a VTurb quando os três links de aporte
  // em js/en/oferta-dia.js estiverem preenchidos com o checkout americano.
  const VIDEOS = {};

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
