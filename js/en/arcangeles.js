// Conteúdo de The Four Archangels (a "Central dos 4 Arcanjos" do Brasil) — o
// que a cliente americana recebe com o extra dos Arcanjos.
// CÓPIA TRADUZIDA do js/es/arcangeles.js (que é a cópia do js/arcanjos.js do
// Brasil): os mesmos quatro arcanjos e as mesmas 12 orações. Os títulos em
// inglês são os dos roteiros aprovados (Drive "7 Améns [EUA - Inglês]", doc dos
// áudios dos 4 Arcanjos), na voz de Father James Brennan.
// Arquivo só do app em inglês: nenhuma página do Brasil nem do espanhol carrega
// este arquivo.
//
// As três telas leem daqui:
//   /en-archangels                       a lista, com os quatro
//   /en-archangel?a=miguel                as três orações de um deles
//   /en-archangel-prayer?a=miguel&o=1    a oração: o áudio (e o texto, quando chegar)
//
// Quem pode abrir é decidido pela en-api (retrato.extras) e pelo
// js/en/extras.js, não aqui. ⚠️ Não é cadeado de verdade: este arquivo é
// público. Guia a cliente; não protege o conteúdo.
//
// ✅ AS VOZES EM INGLÊS CHEGARAM (19/11/2026): os 12 áudios, convertidos em
// mono 96 kbps (originais e convertidos FORA do repositório, em
// "7 Améns EUA/Arcanjos - audios convertidos"), moram no armazenamento PRÓPRIO
// do inglês na Bunny: Storage Zone e Pull Zone "setemadrugadas-en"
// (setemadrugadas-en.b-cdn.net/arcangeles/). Conferidos pela transcrição do
// começo de cada um. As vozes em espanhol moram na Bunny da LATAM
// (setemadrugadas-latam.b-cdn.net): NÃO usar aqui.
// Áudio novo: armazenamento próprio do inglês na Bunny (nunca na Netlify, e
// nunca na zona "setemadrugadas", que é do Brasil e puxa do site), escrever o
// endereço COMPLETO em audioUrl e apagar o pendiente. Mono, 96 kbps, como no
// Brasil. Arquivo novo = NOME novo: o celular guarda os áudios por 30 dias.
//
// oracion nula = sem texto na tela (como no Brasil, por enquanto só o áudio).
// Quando o texto chegar: { apertura, bloques: [...], cierre }.
// enElPdf = o arcanjo está no PDF dos Arcanjos. O PDF em inglês (13/11/2026)
// tem os mesmos três do espanhol: Michael, Gabriel e Raphael (Uriel não está).
// As imagens são as mesmas do Brasil (sem texto escrito nelas).

const ARCANGELES = [
  {
    clave: 'miguel',
    nombre: 'Saint Michael',
    tema: 'Protection',
    resumen: 'Protection for you, your family, and your home.',
    imagen: '/assets/images/arcanjos/provisorio-miguel.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Prayer to Saint Michael for Protection Against All Evil',
        descripcion: 'Protection for you against attacks, envy, and ill will.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/miguel-1.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Michael for the Protection of Your Family',
        descripcion: 'For your children, your grandchildren, your husband, and everyone who lives under your roof.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/miguel-2.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Michael for the Protection of Your Home',
        descripcion: 'For your home, for conflicts and arguments, and for everything that tries to take away your family\'s peace.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/miguel-3.mp3', oracion: null,
      },
    ],
  },
  {
    clave: 'gabriel',
    nombre: 'Saint Gabriel',
    tema: 'New Paths',
    resumen: 'New paths, work, and God\'s guidance.',
    imagen: '/assets/images/arcanjos/provisorio-gabriel.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Prayer to Saint Gabriel to Open New Paths',
        descripcion: 'For when life feels stuck and you can\'t see a way forward.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/gabriel-1.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Gabriel for Work and Good News',
        descripcion: 'A job, new opportunities, an answer you\'ve been waiting for, money, and doors that need to open.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/gabriel-2.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Gabriel for God\'s Guidance',
        descripcion: 'For the times when you don\'t know which way to go.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/gabriel-3.mp3', oracion: null,
      },
    ],
  },
  {
    clave: 'rafael',
    nombre: 'Saint Raphael',
    tema: 'Healing and Restoration',
    resumen: 'Healing for your body, for those you love, and for your strength.',
    imagen: '/assets/images/arcanjos/provisorio-rafael.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Prayer to Saint Raphael for Physical Healing',
        descripcion: 'Bring your illness, your pain, or your worries about your health before God.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/rafael-1.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Raphael for the Healing of Someone You Love',
        descripcion: 'Think of the name of someone you love, or say it out loud: a child, your husband, a grandchild.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/rafael-2.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Saint Raphael to Renew Your Strength',
        descripcion: 'For weariness, discouragement, and weakness, in body and in soul.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/rafael-3.mp3', oracion: null,
      },
    ],
  },
  {
    // Sem "Saint" de propósito, como no Brasil e nos roteiros em inglês: a
    // Igreja só reconhece pelo nome Miguel, Gabriel e Rafael. Não "corrigir".
    clave: 'uriel',
    nombre: 'Uriel',
    tema: 'Wisdom',
    resumen: 'Wisdom to make decisions and to see hidden traps.',
    imagen: '/assets/images/arcanjos/provisorio-uriel.svg',
    enElPdf: false,
    oraciones: [
      {
        titulo: 'Prayer to Uriel for a Difficult Decision',
        descripcion: 'When there are two paths and you don\'t know what to do.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/uriel-1.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Uriel to Reveal Hidden Traps',
        descripcion: 'Dishonest people, bad deals, poor decisions, and situations that could bring you suffering.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/uriel-2.mp3', oracion: null,
      },
      {
        titulo: 'Prayer to Uriel to Light Your Path',
        descripcion: 'To ask for wisdom, clarity, and discernment.',
        audioUrl: 'https://setemadrugadas-en.b-cdn.net/arcangeles/uriel-3.mp3', oracion: null,
      },
    ],
  },
];

// O PDF dos Arcanjos em inglês (13/11/2026; feito em "7 Améns EUA/_montagem",
// extras_en.py). null = sem botão de PDF (js/en/extras.js, audioEnPreparacion)
// e sem frase sobre o PDF no aviso (js/en/oracion-arcangel.js).
const PDF_ARCANGELES = '/assets/en/pdf/prayers-to-the-holy-archangels.pdf';

// "Saint Michael — Protection", do jeito que aparece nos títulos.
function tituloDelArcangel(arcangel) {
  return `${arcangel.nombre} — ${arcangel.tema}`;
}

function arcangelPorClave(clave) {
  return ARCANGELES.find((arcangel) => arcangel.clave === clave) || null;
}
