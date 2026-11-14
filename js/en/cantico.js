// Conteúdo do Angelic Canticle (o "Cântico Angelical" do Brasil) — o que a
// cliente americana recebe com o extra do Cântico. CÓPIA TRADUZIDA do
// js/es/cantico.js (que é a cópia do js/cantico.js do Brasil). Os títulos dos
// dias são os do roteiro aprovado (Drive "7 Améns [EUA - Inglês]", doc
// "[EUA] Cântico Angelical (7 dias)"). Arquivo só do app em inglês.
// (A chave 'cantico' e os nomes de campo continuam os do espanhol, de
// propósito: a en-api é a mesma cópia.)
//
// Introdução + 7 dias, um por dia. As duas telas leem daqui:
//   /en-canticle             a lista dos dias
//   /en-canticle-day?dia=1   o dia: o áudio (e o texto, quando chegar)
//
// Quem pode abrir é decidido pela en-api (retrato.extras). Quando cada dia
// abre também: retrato.cantico.abierto, com a mesma âncora das madrugadas (o
// primeiro acesso ao app), como no Brasil. Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público.
//
// ⏳ EUA: OS ÁUDIOS EM INGLÊS AINDA NÃO EXISTEM. Todo audioUrl está vazio e com
// pendiente: true: a tela mostra "Audio coming soon", sem o botão de terminar
// o dia (o mesmo caminho do espanhol antes de as vozes chegarem). Os áudios em
// espanhol moram na Bunny da LATAM (setemadrugadas-latam.b-cdn.net): NÃO usar.
//
// ⏳ EUA: CADA DIA PRECISA SER MONTADO, como foi no espanhol. Lá (Caio, 08/11),
// a edição mandou só a fala (25 a 49 s, com uma música própria por baixo) e,
// depois dela, entrou uma CÓPIA da parte só instrumental do áudio do MESMO dia
// do Brasil (de 0:35 em diante; Dia 6 de 0:38, Dia 7 de 0:58, sempre depois
// que a fala em português acaba), subindo em 3 s. No inglês será igual: a
// abertura falada por Father James Brennan (texto no roteiro do Drive) e, em
// seguida, o instrumental do Brasil. Se a edição mandar o dia inteiro, é só
// usar o arquivo. Estéreo, 128 kbps, como no Brasil, no armazenamento do
// inglês na Bunny (nunca na Netlify). Arquivo novo = NOME novo. Áudio novo:
// endereço COMPLETO em audioUrl e apagar o pendiente.
//
// oracion nula = sem texto na tela. Quando chegar: { apertura, bloques: [...], cierre }.
// Dia sem áudio, sem texto e sem pendiente (a Introdução, como no Brasil) não
// tem o que entregar: o cartão some da lista.
// As imagens são as mesmas do Brasil (sem texto escrito nelas).

const CANTICO = {
  0: {
    titulo: 'Start Here',
    subtitulo: 'Before Day 1',
    kicker: 'Angelic Canticle · Start Here',
    imagen: '/assets/images/cantico/provisorio-introducao.svg',
    audioUrl: '', pendiente: false, oracion: null, // como no Brasil, a Introdução não tem áudio
    proximo: 'Next: Day 1 — Give God What Weighs Heaviest.',
  },
  1: {
    titulo: 'Day 1',
    subtitulo: 'Give God What Weighs Heaviest',
    kicker: 'Angelic Canticle · Day 01',
    imagen: '/assets/images/cantico/provisorio-dia-1.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 2 — Peace for Your Heart.',
  },
  2: {
    titulo: 'Day 2',
    subtitulo: 'Peace for Your Heart',
    kicker: 'Angelic Canticle · Day 02',
    imagen: '/assets/images/cantico/provisorio-dia-2.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 3 — Health.',
  },
  3: {
    titulo: 'Day 3',
    subtitulo: 'Health',
    kicker: 'Angelic Canticle · Day 03',
    imagen: '/assets/images/cantico/provisorio-dia-3.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 4 — Work and Finances.',
  },
  4: {
    titulo: 'Day 4',
    subtitulo: 'Work and Finances',
    kicker: 'Angelic Canticle · Day 04',
    imagen: '/assets/images/cantico/provisorio-dia-4.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 5 — Family.',
  },
  5: {
    titulo: 'Day 5',
    subtitulo: 'Family',
    kicker: 'Angelic Canticle · Day 05',
    imagen: '/assets/images/cantico/provisorio-dia-5.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 6 — New Paths.',
  },
  6: {
    titulo: 'Day 6',
    subtitulo: 'New Paths',
    kicker: 'Angelic Canticle · Day 06',
    imagen: '/assets/images/cantico/provisorio-dia-6.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: 'Tomorrow: Day 7 — Gratitude and Surrender.',
  },
  7: {
    titulo: 'Day 7',
    subtitulo: 'Gratitude and Surrender',
    kicker: 'Angelic Canticle · Day 07',
    imagen: '/assets/images/cantico/provisorio-dia-7.svg',
    audioUrl: '', pendiente: true, oracion: null, // ⏳ EUA: áudio em inglês ainda não montado
    proximo: '',
  },
};

// O PDF que vai junto, de presente. No espanhol era a Novena a la Virgen
// Desatanudos (/assets/latam/pdf/novena-virgen-desatanudos.pdf), porque o
// checkout de lá tinha esse nome. Em inglês: Novena to Mary, Undoer of Knots
// (13/11/2026; "7 Améns EUA/_montagem", extras_en.py). null = sem botão de PDF
// no aviso do dia (js/en/extras.js, audioEnPreparacion), e o cartão "Bonus
// material" do en-canticle.html leva ao mesmo arquivo.
const PDF_NOVENA = '/assets/en/pdf/novena-mary-undoer-of-knots.pdf';

// Tem o que entregar na tela: o áudio, o texto, ou o aviso de que a voz vem.
const diaDelCanticoVisible = (dia) => Boolean(dia && (dia.audioUrl || dia.oracion || dia.pendiente));
