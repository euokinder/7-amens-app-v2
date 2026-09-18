// Materiais complementares da tela "7 Orações Sagradas".
const MATERIAIS = {
  'guia-rapido': {
    kicker: '7 Améns da Madrugada · Material Complementar',
    titulo: 'Guia Rápido',
    subtitulo: 'As regras da jornada, antes de começar',
    descricao: 'Este é o mesmo guia disponível na Introdução: as sete regras da jornada e a lista dos 7 Améns, para você consultar ou imprimir sempre que quiser.',
    materialPdf: 'assets/pdfs/7-amens-comece-aqui-premium-revisado.pdf',
    materialLabel: 'Abrir Guia Rápido (PDF)',
  },
  // Mesma oração e vídeo do Dia 1, mas com material de apoio próprio
  // (o PDF "Pai Nosso Completo" é exclusivo desse acesso avulso).
  'pai-nosso': {
    kicker: '7 Améns da Madrugada · Material Complementar',
    titulo: 'Pai Nosso Completo',
    subtitulo: 'A oração completa, pra acessar quando quiser',
    temVideo: true,
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aab6a53529335352865b504" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aab6a53529335352865b504/v4/player.js'
    },
    materialPdf: 'assets/pdfs/pai-nosso-completo-premium.pdf',
    materialLabel: 'Acessar Material de Apoio',
    audioUrl: 'assets/audio/dia-01-oracao.mp3',
    materialExtraPdf: 'assets/pdfs/traducao-lado-a-lado.pdf',
    materialExtraLabel: 'Manuscrito Digital em Aramaico',
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Pai Nosso, que estais no Céu,\nsantificado seja o vosso nome;',
        'venha a nós o vosso Reino;\nseja feita a vossa vontade,\nassim na Terra como no Céu.',
        'O pão nosso de cada dia nos dai hoje;\nperdoai as nossas ofensas,',
        'assim como nós perdoamos\na quem nos tem ofendido;',
        'e não nos deixeis cair em tentação,\nmas livrai-nos do mal.',
        'Porque vosso é o Reino, o poder e a glória, agora e sempre.',
        'Eu recebo, Senhor, as bênçãos que já preparastes para mim.\nAbro o meu coração para tudo aquilo que vem do Teu amor.\nHoje eu não peço mais pela metade — eu recebo por inteiro.',
        'Que a Tua paz habite em mim, hoje e todos os dias da minha vida.\nEu me entrego. Eu confio. Eu recebo.'
      ],
      fechamento: 'Amém.'
    },
  },
};
