// Conteúdo do Cántico Angelical — o que a cliente da LATAM recebe com o UP02
// (na KashPay ele se chamava "Novena a la Virgen Desatanudos" por engano, e no
// banco a chave antiga é 'desatanudos'). CÓPIA TRADUZIDA do js/cantico.js do
// Brasil (07/11/2026). Arquivo só da LATAM.
//
// Introdução + 7 dias, um por dia. As duas telas leem daqui:
//   /es-cantico             a lista dos dias (e o PDF da Novena, de regalo)
//   /es-cantico-dia?dia=1   o dia: o áudio (e o texto, quando chegar)
//
// Quem pode abrir é decidido pela latam-api (retrato.extras). Quando cada dia
// abre também: retrato.cantico.abierto, com a mesma âncora das madrugadas (o
// primeiro acesso ao app), como no Brasil. Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público.
//
// ✅ OS ÁUDIOS chegaram em 08/11/2026, na Bunny da LATAM (ver o aviso em
// js/es/arcangeles.js). Cada dia é MONTADO (Caio, 08/11: "você consegue
// juntar?"): a edição mandou só a fala em espanhol (25 a 49 s, com uma música
// própria por baixo) e, depois dela, entra uma CÓPIA da parte só instrumental
// do áudio do mesmo dia do Brasil (de 0:35 em diante; Dia 6 de 0:38, Dia 7 de
// 0:58, sempre depois que a fala em português acaba), subindo em 3 s.
// A música de baixo da voz não é a mesma do Brasil: perto de 0:30 ela muda.
// Se a edição mandar o dia inteiro, é só trocar o arquivo (com NOME novo).
// Estéreo, 128 kbps, como no Brasil. Mexer no áudio do Brasil não muda nada aqui.
// Sem áudio e com pendiente: true, a tela volta a mostrar "Audio en
// preparación", sem o botão "Terminé este día".
//
// oracion nula = sem texto na tela. Quando chegar: { apertura, bloques: [...], cierre }.
// Dia sem áudio, sem texto e sem pendiente (a Introdução, como no Brasil) não
// tem o que entregar: o cartão some da lista.
// As imagens são as mesmas do Brasil (sem texto escrito nelas).

const CANTICO = {
  0: {
    titulo: 'Introducción',
    subtitulo: 'Comienza aquí, antes del 1.er día',
    kicker: 'Cántico Angelical · Comienza aquí',
    imagen: '/assets/images/cantico/provisorio-introducao.svg',
    audioUrl: '', pendiente: false, oracion: null, // como no Brasil, a Introdução não tem áudio
    proximo: 'Enseguida: Primer Día — Entrega lo que más te pesa.',
  },
  1: {
    titulo: 'Primer Día',
    subtitulo: 'Entrega lo que más te pesa',
    kicker: 'Cántico Angelical · Día 01',
    imagen: '/assets/images/cantico/provisorio-dia-1.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-1.mp3', oracion: null,
    proximo: 'Mañana: Segundo Día — Paz para el corazón.',
  },
  2: {
    titulo: 'Segundo Día',
    subtitulo: 'Paz para el corazón',
    kicker: 'Cántico Angelical · Día 02',
    imagen: '/assets/images/cantico/provisorio-dia-2.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-2.mp3', oracion: null,
    proximo: 'Mañana: Tercer Día — Salud.',
  },
  3: {
    titulo: 'Tercer Día',
    subtitulo: 'Salud',
    kicker: 'Cántico Angelical · Día 03',
    imagen: '/assets/images/cantico/provisorio-dia-3.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-3.mp3', oracion: null,
    proximo: 'Mañana: Cuarto Día — Trabajo y finanzas.',
  },
  4: {
    titulo: 'Cuarto Día',
    subtitulo: 'Trabajo y finanzas',
    kicker: 'Cántico Angelical · Día 04',
    imagen: '/assets/images/cantico/provisorio-dia-4.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-4.mp3', oracion: null,
    proximo: 'Mañana: Quinto Día — Familia.',
  },
  5: {
    titulo: 'Quinto Día',
    subtitulo: 'Familia',
    kicker: 'Cántico Angelical · Día 05',
    imagen: '/assets/images/cantico/provisorio-dia-5.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-5.mp3', oracion: null,
    proximo: 'Mañana: Sexto Día — Nuevos caminos.',
  },
  6: {
    titulo: 'Sexto Día',
    subtitulo: 'Nuevos caminos',
    kicker: 'Cántico Angelical · Día 06',
    imagen: '/assets/images/cantico/provisorio-dia-6.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-6.mp3', oracion: null,
    proximo: 'Mañana: Séptimo Día — Gratitud y entrega.',
  },
  7: {
    titulo: 'Séptimo Día',
    subtitulo: 'Gratitud y entrega',
    kicker: 'Cántico Angelical · Día 07',
    imagen: '/assets/images/cantico/provisorio-dia-7.svg',
    audioUrl: 'https://setemadrugadas-latam.b-cdn.net/cantico/dia-7.mp3', oracion: null,
    proximo: '',
  },
};

// O PDF que vai junto, de regalo: a Novena a la Virgen Desatanudos. Quem
// comprou o UP02 até 07/11 recebeu este PDF por e-mail, porque o checkout
// tinha esse nome (decisão do Caio, 07/11: ele fica dentro do Cántico).
const PDF_NOVENA = '/assets/latam/pdf/novena-virgen-desatanudos.pdf';

// Tem o que entregar na tela: o áudio, o texto, ou o aviso de que a voz vem.
const diaDelCanticoVisible = (dia) => Boolean(dia && (dia.audioUrl || dia.oracion || dia.pendiente));
