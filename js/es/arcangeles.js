// Conteúdo da Central de los Cuatro Arcángeles — o que a cliente da LATAM
// recebe com o UP01 ("Oraciones a los Santos Arcángeles", na KashPay).
// CÓPIA TRADUZIDA do js/arcanjos.js do Brasil (07/11/2026): os mesmos quatro
// arcanjos e as mesmas 12 orações (decisão do Caio: 4, igual ao Brasil; o PDF
// em espanhol, que só tem Miguel, Gabriel e Rafael, entra como material extra).
// Arquivo só da LATAM: nenhuma página do Brasil carrega este arquivo.
//
// As três telas leem daqui:
//   /es-arcangeles                       a Central, com os quatro
//   /es-arcangel?a=miguel                as três orações de um deles
//   /es-oracion-arcangel?a=miguel&o=1    a oração: o áudio (e o texto, quando chegar)
//
// Quem pode abrir é decidido pela latam-api (retrato.extras) e pelo
// js/es/extras.js, não aqui. ⚠️ Não é cadeado de verdade: este arquivo é
// público. Guia a cliente; não protege o conteúdo.
//
// ✅ AS VOZES chegaram em 08/11/2026 (Padre Santiago, voz de IA, com música de
// fundo). Moram na Bunny, no armazenamento SÓ da LATAM "setemadrugadas-latam"
// (Nova York, sem réplica), entregue pela zona "setemadrugadas-latam.b-cdn.net".
// Nunca na Netlify, e nunca na zona "setemadrugadas", que é do Brasil e puxa do
// site: ligar o armazenamento a ela trocaria a origem dos áudios do Brasil.
// Convertidas como as do Brasil: mono, 96 kbps.
// Enquanto audioUrl estiver vazio e pendiente: true, a tela mostra "Audio en
// preparación" (com o PDF). Áudio novo: subir na pasta arcangeles/ de lá,
// escrever o endereço COMPLETO em audioUrl e apagar o pendiente.
// Arquivo novo = NOME novo: o celular guarda os áudios por 30 dias.
//
// oracion nula = sem texto na tela (como no Brasil, por enquanto só o áudio).
// Quando o texto chegar: { apertura, bloques: [...], cierre }.
// enElPdf = o arcanjo está no PDF "Oraciones a los Santos Arcángeles" (Uriel
// não está). Enquanto a voz não chega, TODAS as orações mostram o botão do
// PDF (Caio, 07/11); o enElPdf só muda a frase do aviso.
// As imagens são as mesmas do Brasil (sem texto escrito nelas).

const ARCANGELES = [
  {
    clave: 'miguel',
    nombre: 'San Miguel',
    tema: 'Protección',
    resumen: 'Protección para ti, tu familia y tu casa.',
    imagen: '/assets/images/arcanjos/provisorio-miguel.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Oración de San Miguel Contra Todo Mal',
        descripcion: 'Protección personal contra ataques, envidia y negatividad.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/miguel-1.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Miguel por la Protección de la Familia',
        descripcion: 'Por los hijos, los nietos, el esposo y las personas que viven bajo el mismo techo.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/miguel-2.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Miguel para Proteger tu Casa',
        descripcion: 'Por el hogar, los conflictos, las peleas y todo lo que intenta quitarle la paz a la familia.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/miguel-3.mp3', oracion: null,
      },
    ],
  },
  {
    clave: 'gabriel',
    nombre: 'San Gabriel',
    tema: 'Caminos',
    resumen: 'Nuevos caminos, trabajo y la dirección de Dios.',
    imagen: '/assets/images/arcanjos/provisorio-gabriel.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Oración de San Gabriel para Abrir Nuevos Caminos',
        descripcion: 'Para quien siente la vida estancada o sin salida.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/gabriel-1.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Gabriel por Trabajo y Buenas Noticias',
        descripcion: 'Empleo, oportunidades, una respuesta esperada, dinero y puertas que necesitan abrirse.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/gabriel-2.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Gabriel para Recibir la Dirección de Dios',
        descripcion: 'Para los momentos en que no sabes qué camino seguir.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/gabriel-3.mp3', oracion: null,
      },
    ],
  },
  {
    clave: 'rafael',
    nombre: 'San Rafael',
    tema: 'Sanación y Restauración',
    resumen: 'Sanación del cuerpo, de quienes amas y de tus fuerzas.',
    imagen: '/assets/images/arcanjos/provisorio-rafael.svg',
    enElPdf: true,
    oraciones: [
      {
        titulo: 'Oración de San Rafael por la Sanación del Cuerpo',
        descripcion: 'Presenta a Dios tu enfermedad, tu dolor o tu preocupación por la salud.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/rafael-1.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Rafael por la Sanación de Quien Amas',
        descripcion: 'Piensa en el nombre de quien amas, o dilo en voz alta: un hijo, el esposo, un nieto.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/rafael-2.mp3', oracion: null,
      },
      {
        titulo: 'Oración de San Rafael para Restaurar tus Fuerzas',
        descripcion: 'Para el cansancio, el desánimo y la debilidad, del cuerpo y del alma.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/rafael-3.mp3', oracion: null,
      },
    ],
  },
  {
    // Sem "San" de propósito, como no Brasil: a Igreja só reconhece pelo nome
    // Miguel, Gabriel e Rafael. Não "corrigir".
    clave: 'uriel',
    nombre: 'Uriel',
    tema: 'Sabiduría',
    resumen: 'Sabiduría para decidir y para ver las trampas.',
    imagen: '/assets/images/arcanjos/provisorio-uriel.svg',
    enElPdf: false,
    oraciones: [
      {
        titulo: 'Oración de Uriel para una Decisión Difícil',
        descripcion: 'Cuando hay dos caminos y no sabes qué hacer.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/uriel-1.mp3', oracion: null,
      },
      {
        titulo: 'Oración de Uriel para Revelar las Trampas',
        descripcion: 'Personas falsas, negocios, malas decisiones y situaciones que pueden traer sufrimiento.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/uriel-2.mp3', oracion: null,
      },
      {
        titulo: 'Oración de Uriel para Iluminar tu Camino',
        descripcion: 'Para pedir sabiduría, claridad y discernimiento.',
        audioUrl: 'https://setemadrugadas-latam.b-cdn.net/arcangeles/uriel-3.mp3', oracion: null,
      },
    ],
  },
];

// O PDF dos Arcángeles (Miguel, Gabriel e Rafael, mais a oração aos três).
const PDF_ARCANGELES = '/assets/latam/pdf/oraciones-santos-arcangeles.pdf';

// "San Miguel — Protección", do jeito que aparece nos títulos.
function tituloDelArcangel(arcangel) {
  return `${arcangel.nombre} — ${arcangel.tema}`;
}

function arcangelPorClave(clave) {
  return ARCANGELES.find((arcangel) => arcangel.clave === clave) || null;
}
