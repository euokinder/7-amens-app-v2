// Conteúdo do Cântico Angelical — o que a cliente recebe ao comprar o
// upsell_02. Na Hubla e no banco o produto ainda se chama "Músicas dos Anjos":
// é o MESMO produto, só com nome novo (Caio, 24/09/2026).
//
// Introdução + 7 dias, um por dia. As duas telas leem daqui:
//   cantico.html              a lista dos dias
//   cantico-dia.html?dia=1    o dia: o áudio (e o texto, quando chegar)
//
// Quem pode abrir (e quem vê o cadeado) é decidido no js/member.js. Quando
// cada dia abre é decidido no js/trava.js (calcularCantico). Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o texto. Não prometer "conteúdo protegido".
//
// ⚠️ VERSÃO MVP (24/09/2026): as artes são PROVISÓRIAS — procure por
// PROVISORIO. Os 7 áudios são os definitivos, em assets/audio/cantico/.
// O áudio tomou o lugar do vídeo, e por enquanto a entrega é SÓ o áudio
// (decisões do Caio, 24/09): o texto de cada dia ainda não entrou.
//
// ⚠️ Ao trocar uma arte, use um NOME NOVO de arquivo. Tudo em assets/ fica
// guardado no celular da cliente por um ano (netlify.toml): com o mesmo nome,
// ela continuaria vendo a provisória.
//
// audioUrl vazio = sem áudio (o tocador some da tela).
//
// oracao nula = sem texto na tela. Quando o texto chegar, ele entra no campo
// oracao, no formato { abertura, blocos: [...], fechamento }.
//
// Dia sem áudio e sem texto (hoje, a Introdução) não tem o que entregar: o
// cartão some da lista, e o dia aberto pelo link diz "Conteúdo indisponível".

const CANTICO = {
  0: {
    numero: '0',
    titulo: 'Introdução',
    subtitulo: 'Comece aqui antes do 1º dia',
    kicker: 'Cântico Angelical · Comece Aqui',
    imagem: 'assets/images/cantico/provisorio-introducao.svg', // PROVISORIO
    audioUrl: '', // a Introdução não tem áudio
    oracao: null,
    // A Introdução abre junto com o Dia 1, no mesmo dia: por isso "em
    // seguida", e não "amanhã".
    proximo: 'Em seguida: Primeiro Dia — Entregue aquilo que mais pesa.',
    disponivel: true
  },
  1: {
    numero: '1',
    titulo: 'Primeiro Dia',
    subtitulo: 'Entregue aquilo que mais pesa',
    kicker: 'Cântico Angelical · Dia 01',
    imagem: 'assets/images/cantico/provisorio-dia-1.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-1.mp3',
    oracao: null,
    proximo: 'Amanhã: Segundo Dia — Paz para o coração.',
    disponivel: true
  },
  2: {
    numero: '2',
    titulo: 'Segundo Dia',
    subtitulo: 'Paz para o coração',
    kicker: 'Cântico Angelical · Dia 02',
    imagem: 'assets/images/cantico/provisorio-dia-2.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-2.mp3',
    oracao: null,
    proximo: 'Amanhã: Terceiro Dia — Saúde.',
    disponivel: true
  },
  3: {
    numero: '3',
    titulo: 'Terceiro Dia',
    subtitulo: 'Saúde',
    kicker: 'Cântico Angelical · Dia 03',
    imagem: 'assets/images/cantico/provisorio-dia-3.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-3.mp3',
    oracao: null,
    proximo: 'Amanhã: Quarto Dia — Trabalho e finanças.',
    disponivel: true
  },
  4: {
    numero: '4',
    titulo: 'Quarto Dia',
    subtitulo: 'Trabalho e finanças',
    kicker: 'Cântico Angelical · Dia 04',
    imagem: 'assets/images/cantico/provisorio-dia-4.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-4.mp3',
    oracao: null,
    proximo: 'Amanhã: Quinto Dia — Família.',
    disponivel: true
  },
  5: {
    numero: '5',
    titulo: 'Quinto Dia',
    subtitulo: 'Família',
    kicker: 'Cântico Angelical · Dia 05',
    imagem: 'assets/images/cantico/provisorio-dia-5.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-5.mp3',
    oracao: null,
    proximo: 'Amanhã: Sexto Dia — Novos caminhos.',
    disponivel: true
  },
  6: {
    numero: '6',
    titulo: 'Sexto Dia',
    subtitulo: 'Novos caminhos',
    kicker: 'Cântico Angelical · Dia 06',
    imagem: 'assets/images/cantico/provisorio-dia-6.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-6.mp3',
    oracao: null,
    proximo: 'Amanhã: Sétimo Dia — Gratidão e entrega.',
    disponivel: true
  },
  7: {
    numero: '7',
    titulo: 'Sétimo Dia',
    subtitulo: 'Gratidão e entrega',
    kicker: 'Cântico Angelical · Dia 07',
    imagem: 'assets/images/cantico/provisorio-dia-7.svg', // PROVISORIO
    audioUrl: 'assets/audio/cantico/dia-7.mp3',
    oracao: null,
    proximo: '',
    disponivel: true
  }
};
