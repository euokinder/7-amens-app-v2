// As 3 Madrugadas — o que a cliente recebe com o tres_madrugadas, o produto
// vendido no fim do vídeo do Dia 7 (a oferta emendada, 13/10/2026). O
// entregável, em vídeo, entrou no app em 18/10/2026.
//
// Três vídeos, um por madrugada. O rito é POR NOME (modelo do Caio, 15/10):
// ela reza as três madrugadas por uma pessoa e, terminada a Terceira,
// recomeça da Primeira com o próximo nome, no mesmo vídeo. Por isso as três
// ficam SEMPRE abertas (Caio, 18/10): uma trava de um dia por vez atrapalharia
// quem já está no segundo ou no terceiro nome.
//
// O nome de quem ela carrega fica só com ela: o app não pergunta e não guarda.
// É a promessa da venda.
//
// As duas telas leem daqui:
//   tres-madrugadas.html              a lista das três
//   tres-madrugadas-video.html?m=1    a madrugada: o vídeo
//
// Quem pode abrir é decidido no js/member.js (temTresMadrugadas). Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o vídeo. Não prometer "conteúdo protegido".
//
// video: o código de incorporação da VTurb, exatamente como o Caio mandou em
// 18/10/2026, no mesmo formato do videoEmbed do js/dias.js. Os três são EM PÉ
// (3:4) e param em 400px, como os das 7 madrugadas. Nulo = sem vídeo (a tela
// da madrugada diz "Conteúdo indisponível").
//
// PROVISORIO: as fotos (são as das 7 madrugadas) e os subtítulos, tirados do
// roteiro de 15/10 ("o telhado se abre", "levanta-te", "vai para tua casa").
// ⚠️ Ao trocar uma foto, use um NOME NOVO de arquivo: tudo em assets/ fica
// guardado no celular da cliente por um ano (netlify.toml).

const TRES_MADRUGADAS = {
  1: {
    numero: '1',
    titulo: 'Primeira Madrugada',
    subtitulo: 'O telhado se abre', // PROVISORIO
    kicker: 'As 3 Madrugadas · Madrugada 1',
    imagem: 'assets/images/dia-1-pai-nosso.jpg', // PROVISORIO
    video: {
      html: '<vturb-smartplayer id="vid-6ad4fe8cff942efd73ed0258" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6ad4fe8cff942efd73ed0258/v4/player.js'
    },
    bunny: { video: 'ddcbb3cb-1b06-4dc5-b30b-6aad5293868a', formato: '3:4' }, // na Bunny desde 20/10/2026: apagar esta linha volta para a VTurb (js/video.js)
    proximo: 'Na próxima madrugada: a Segunda Madrugada, pela mesma pessoa.'
  },
  2: {
    numero: '2',
    titulo: 'Segunda Madrugada',
    subtitulo: 'Levanta-te', // PROVISORIO
    kicker: 'As 3 Madrugadas · Madrugada 2',
    imagem: 'assets/images/dia-3-cura.jpg', // PROVISORIO
    video: {
      html: '<vturb-smartplayer id="vid-6ad5031184ff5e9c27000fd4" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6ad5031184ff5e9c27000fd4/v4/player.js'
    },
    bunny: { video: 'd1f90277-3308-455b-8b52-b30fd7cca91a', formato: '3:4' }, // na Bunny desde 20/10/2026: apagar esta linha volta para a VTurb (js/video.js)
    proximo: 'Na próxima madrugada: a Terceira Madrugada, pela mesma pessoa.'
  },
  3: {
    numero: '3',
    titulo: 'Terceira Madrugada',
    subtitulo: 'Vai para tua casa', // PROVISORIO
    kicker: 'As 3 Madrugadas · Madrugada 3',
    imagem: 'assets/images/dia-7-alianca.jpg', // PROVISORIO
    video: {
      html: '<vturb-smartplayer id="vid-6ad506eeeb8fcb3d90d4893d" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6ad506eeeb8fcb3d90d4893d/v4/player.js'
    },
    bunny: { video: '4b5ddc45-90f4-440f-882f-510d119230a4', formato: '3:4' }, // na Bunny desde 20/10/2026: apagar esta linha volta para a VTurb (js/video.js)
    // A Terceira fecha a pessoa: o que vem depois é o próximo nome, do início.
    proximo: 'Você completou as três madrugadas por esta pessoa. Quando quiser rezar por outra, comece de novo pela Primeira Madrugada.'
  }
};
