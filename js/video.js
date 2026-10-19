// O PLAYER DE VÍDEO DO APP — decide, vídeo a vídeo, entre a Bunny e a VTurb.
//   dia.html                     as 7 madrugadas e os materiais (Pai Nosso)
//   tres-madrugadas-video.html   As 3 Madrugadas
//   live-rafael.html             a Live do São Rafael
//
// Decisão do Caio em 19/10/2026: os vídeos que são SÓ ENTREGA passam para a
// Bunny, que cobra pelo volume entregue (a VTurb cobra por play). Os vídeos
// que têm venda continuam na VTurb. O plano inteiro, com a configuração da
// biblioteca e a rotina do saldo: docs/bunny-videos-de-entrega.md.
//
// Como um vídeo passa para a Bunny: ao lado do videoEmbed da VTurb (que
// CONTINUA no arquivo, porque é a volta atrás), acrescenta-se
//   bunny: { video: '<ID do vídeo na Bunny>', formato: '3:4' }
// '3:4' é o vídeo em pé das madrugadas (para em 400px); '16:9' é o deitado,
// como o da Live. Sem o campo, ou com um ID que não seja o da Bunny, o vídeo
// toca pela VTurb, como sempre.
//
// ⚠️ O Dia 3 e o Dia 7 ficam na VTurb: as contribuições e a oferta aparecem
// pelo relógio do player dela, e o Dia 7 se marca sozinho por ele. O dia.html
// ignora o campo `bunny` nesses dois dias de propósito.
//
// Uso, em cada tela:
//   VIDEO.escolher({ bunny, vturb, titulo })  devolve { html, scriptSrc, origem }
//                                             (ou null, se não houver vídeo)
//   VIDEO.carregarScript(scriptSrc)           carrega o script da VTurb; o da
//                                             Bunny não precisa de script
(function () {
  'use strict';

  // A biblioteca "7 Améns - entregas" (criada em 19/10/2026). O número é
  // público: vai no endereço de todo vídeo.
  const BIBLIOTECA = '784501';

  // A chave geral: false manda TODOS os vídeos de volta para a VTurb, mesmo os
  // que têm o campo `bunny`. É a volta atrás de tudo de uma vez (custa 1 build;
  // voltar o deploy anterior na Netlify não custa nenhum).
  const BUNNY_LIGADA = true;

  const FORMATOS = {
    '3:4': { altura: '133.3333%', larguraMaxima: '400px' },
    '16:9': { altura: '56.25%', larguraMaxima: '' }
  };

  // O ID de um vídeo na Bunny tem o formato 8-4-4-4-12 (letras e números).
  const ID_DA_BUNNY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ⚠️ autoplay=false é obrigatório: na Bunny, o padrão é TOCAR SOZINHO, e o
  // painel não tem essa opção. O resto repete o que a biblioteca já tem
  // (português, velocidade, continuar de onde parou), para valer mesmo se
  // alguém mexer lá.
  const OPCOES = 'autoplay=false&preload=true&rememberPosition=true&showSpeed=true&lang=pt';

  const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function usaBunny(bunny) {
    return Boolean(BUNNY_LIGADA && bunny && ID_DA_BUNNY.test(bunny.video || '') && FORMATOS[bunny.formato || '3:4']);
  }

  // A mesma caixa do <vturb-smartplayer>: largura cheia, no máximo 400px no
  // vídeo em pé, fundo preto enquanto carrega e a altura pela proporção.
  function htmlDaBunny(bunny, titulo) {
    const formato = FORMATOS[bunny.formato || '3:4'];
    const largura = formato.larguraMaxima ? ` max-width: ${formato.larguraMaxima};` : '';
    const endereco = `https://player.mediadelivery.net/embed/${BIBLIOTECA}/${bunny.video}?${OPCOES}`;
    return `<div class="video-bunny" style="position: relative; width: 100%;${largura} margin: 0 auto; padding-top: ${formato.altura}; background-color: black;">`
      + `<iframe src="${endereco}" title="${escapar(titulo)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>`
      + '</div>';
  }

  function escolher({ bunny, vturb, titulo } = {}) {
    if (usaBunny(bunny)) {
      return { html: htmlDaBunny(bunny, titulo || 'Vídeo'), scriptSrc: '', origem: 'bunny' };
    }
    if (vturb && vturb.html) {
      return { html: vturb.html, scriptSrc: vturb.scriptSrc || '', origem: 'vturb' };
    }
    return null;
  }

  function carregarScript(src) {
    if (!src) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }

  window.VIDEO = { escolher, carregarScript };
})();
