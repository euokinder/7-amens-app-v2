// Las 3 Madrugadas de Intercesión — o que a cliente recebe com o
// 'tres_madrugadas', a venda do fim do vídeo do Día 7 (js/es/oferta-dia.js).
// CÓPIA do js/tres-madrugadas.js do Brasil (18/10/2026), em espanhol e no "tú"
// (18/11/2026, pedido do Arthur: "igual ao Brasil, só traduzido e com os
// vídeos trocados"). Arquivo só da LATAM.
//
// As mesmas regras do Brasil:
//   - três vídeos, um por madrugada, SEMPRE abertos (o rito é POR NOME: três
//     madrugadas por uma pessoa e, terminada a Tercera, recomeça da Primera
//     com o próximo nome; uma trava atrapalharia quem está no segundo nome);
//   - sem "Terminé": o app não guarda progresso das 3 Madrugadas;
//   - o nome de quem ela carrega fica só com ela: o app não pergunta e não
//     guarda. É a promessa da venda.
//
// As duas telas leem daqui:
//   /es-tres-madrugadas              a lista das três
//   /es-tres-madrugadas-video?m=1    a madrugada: o vídeo
// Quem pode abrir vem do servidor (retrato.extras, 'tres_madrugadas'); a regra
// mora em supabase/latam/16-tres-madrugadas.sql. Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/es/dias.js.
//
// OS VÍDEOS: na Bunny, biblioteca 784501 ("7 Améns - entregas"), com o nome
// "ES · 3 Madrugadas · Primera — …" (o padrão "ES · …" de docs/app-es.md),
// nunca na Netlify. Os três em espanhol subiram em 18/11/2026 (o Arthur).
// `video: null` = a tela mostra "Video en preparación" (rede para um vídeo
// que precise sair do ar). Trocar um vídeo = o ID novo aqui. 1 build.
//
// PROVISÓRIO: as fotos (as das 7 madrugadas, como no Brasil) e os subtítulos
// (Marcos 2: "el techo se abre", "levántate", "vete a tu casa").
const TRES_MADRUGADAS = {
  nombre: 'Las 3 Madrugadas de Intercesión',
  1: {
    numero: '1',
    titulo: 'Primera Madrugada',
    subtitulo: 'El techo se abre', // PROVISÓRIO
    kicker: 'Las 3 Madrugadas · Madrugada 1',
    imagen: '/assets/images/dia-1-pai-nosso.jpg', // PROVISÓRIO
    video: { video: 'f7ab1b61-c321-47bc-840f-1d5a728abc9f', formato: '3:4' }, // ES · 3 Madrugadas · Primera (7:12, 18/11/2026)
    proximo: 'En la próxima madrugada: la Segunda Madrugada, por la misma persona.',
  },
  2: {
    numero: '2',
    titulo: 'Segunda Madrugada',
    subtitulo: 'Levántate', // PROVISÓRIO
    kicker: 'Las 3 Madrugadas · Madrugada 2',
    imagen: '/assets/images/dia-3-cura.jpg', // PROVISÓRIO
    video: { video: 'b43924e2-2066-4825-b28e-c7620a926d00', formato: '3:4' }, // ES · 3 Madrugadas · Segunda (5:42, 18/11/2026)
    proximo: 'En la próxima madrugada: la Tercera Madrugada, por la misma persona.',
  },
  3: {
    numero: '3',
    titulo: 'Tercera Madrugada',
    subtitulo: 'Vete a tu casa', // PROVISÓRIO
    kicker: 'Las 3 Madrugadas · Madrugada 3',
    imagen: '/assets/images/dia-7-alianca.jpg', // PROVISÓRIO
    video: { video: '59f387f2-d0e1-44d5-a043-5bf4453b38f3', formato: '3:4' }, // ES · 3 Madrugadas · Tercera (8:48, 18/11/2026)
    // A Tercera cierra la persona: lo que viene después es el próximo nombre.
    proximo: 'Completaste las tres madrugadas por esta persona. Cuando quieras orar por otra, comienza de nuevo por la Primera Madrugada.',
  },
};
