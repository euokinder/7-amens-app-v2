// Three Mornings of Intercession — o que a cliente recebe com o
// 'tres_madrugadas', a venda do fim do vídeo do Day 7 (js/en/oferta-dia.js).
// CÓPIA do js/es/tres-madrugadas.js (que copia o js/tres-madrugadas.js do
// Brasil), em inglês (23/11/2026). Arquivo só do app em inglês.
//
// As mesmas regras do Brasil e do espanhol:
//   - três vídeos, um por madrugada, SEMPRE abertos (o rito é POR NOME: três
//     madrugadas por uma pessoa e, terminada a Third, recomeça da First com o
//     próximo nome; uma trava atrapalharia quem está no segundo nome);
//   - sem "I prayed": o app não guarda progresso das 3 Madrugadas;
//   - o nome de quem ela carrega fica só com ela: o app não pergunta e não
//     guarda. É a promessa da venda.
//
// As duas telas leem daqui:
//   /en-three-mornings              a lista das três
//   /en-three-mornings-video?m=1    a madrugada: o vídeo
// Quem pode abrir vem do servidor (retrato.extras, 'tres_madrugadas'); a regra
// mora em supabase/en/18-tres-madrugadas.sql. Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/en/dias.js.
//
// OS VÍDEOS: na Bunny, biblioteca 784501 ("7 Améns - entregas"), nunca na
// Netlify. Os três em inglês subiram em 23/11/2026 (o Arthur), com os nomes
// "3 MADRUGADAS H1 (GT).mp4", "H2" e "H3" (H1 = First, H2 = Second, H3 = Third).
// `video: null` = a tela mostra "Video coming soon". Trocar um vídeo = o ID
// novo aqui. 1 build.
//
// PROVISÓRIO: as fotos (as das 7 madrugadas, como no Brasil) e os subtítulos
// (Marcos 2: "the roof opens", "rise up", "go to your home").
const TRES_MADRUGADAS = {
  nombre: 'Three Mornings of Intercession',
  1: {
    numero: '1',
    titulo: 'The First Morning',
    subtitulo: 'The roof opens', // PROVISÓRIO
    kicker: 'Three Mornings · Morning 1',
    imagen: '/assets/images/dia-1-pai-nosso.jpg', // PROVISÓRIO
    video: { video: 'f9ef0728-2c68-4708-8cc8-b0ac882bff4e', formato: '3:4' }, // First (H1, 8:17, 23/11/2026)
    proximo: 'On the next morning: the Second Morning, for the same person.',
  },
  2: {
    numero: '2',
    titulo: 'The Second Morning',
    subtitulo: 'Rise up', // PROVISÓRIO
    kicker: 'Three Mornings · Morning 2',
    imagen: '/assets/images/dia-3-cura.jpg', // PROVISÓRIO
    video: { video: '10fc478b-3669-4e56-a552-b06b6725d976', formato: '3:4' }, // Second (H2, 6:09, 23/11/2026)
    proximo: 'On the next morning: the Third Morning, for the same person.',
  },
  3: {
    numero: '3',
    titulo: 'The Third Morning',
    subtitulo: 'Go to your home', // PROVISÓRIO
    kicker: 'Three Mornings · Morning 3',
    imagen: '/assets/images/dia-7-alianca.jpg', // PROVISÓRIO
    video: { video: 'aeacb24c-e308-4ea0-b4f7-89497bbcf0d6', formato: '3:4' }, // Third (H3, 9:23, 23/11/2026)
    // A Third fecha a pessoa: o que vem depois é o próximo nome.
    proximo: 'You have completed the three mornings for this person. Whenever you want to pray for someone else, start again with the First Morning.',
  },
};
