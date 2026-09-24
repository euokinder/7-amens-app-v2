// Conteúdo do Cântico Angelical — o que a cliente recebe ao comprar o
// upsell_02. Na Hubla e no banco o produto ainda se chama "Músicas dos Anjos":
// é o MESMO produto, só com nome novo (Caio, 24/09/2026).
//
// Introdução + 7 dias, um por dia. As duas telas leem daqui:
//   cantico.html              a lista, com os oito cartões
//   cantico-dia.html?dia=1    o dia: vídeo da VTurb e texto
//
// Quem pode abrir (e quem vê o cadeado) é decidido no js/member.js. Quando
// cada dia abre é decidido no js/trava.js (calcularCantico). Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o texto. Não prometer "conteúdo protegido".
//
// ⚠️ VERSÃO MVP (24/09/2026): vídeos, textos e artes são PROVISÓRIOS — o Caio
// envia os definitivos. Procure por PROVISORIO.
//
// ⚠️ Ao trocar uma arte, use um NOME NOVO de arquivo. Tudo em assets/ fica
// guardado no celular da cliente por um ano (netlify.toml): com o mesmo nome,
// ela continuaria vendo a provisória.
//
// videoEmbed nulo = ainda sem vídeo (a tela mostra o quadro vazio, com o
// botão de play). Para colocar o vídeo, cole os dois pedaços do código da
// VTurb, exatamente como no js/dias.js: o <vturb-smartplayer ...> inteiro em
// `html` e o endereço do player.js em `scriptSrc`.

// PROVISORIO: o mesmo texto de mentira nos oito, no tamanho de um texto de
// verdade, para ver como a tela fica com ele inteiro.
const TEXTO_PROVISORIO_DO_CANTICO = {
  abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
  blocos: [
    '[TEXTO PROVISÓRIO — o texto definitivo deste dia ainda vai ser enviado.]',
    'Este espaço mostra como o texto vai aparecer na tela: em letras grandes, com respiro entre os parágrafos, para ser lido com calma e em voz alta.',
    'Cada parágrafo do texto verdadeiro entra aqui, um depois do outro, na ordem em que deve ser lido.',
    'As linhas que pedem uma pausa podem ser quebradas assim,\ne continuam no mesmo parágrafo,\numa embaixo da outra.'
  ],
  fechamento: 'Amém.'
};

const CANTICO = {
  0: {
    numero: '0',
    titulo: 'Introdução',
    subtitulo: 'Comece aqui antes do 1º dia',
    kicker: 'Cântico Angelical · Comece Aqui',
    imagem: 'assets/images/cantico/provisorio-introducao.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
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
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Segundo Dia — Paz para o coração.',
    disponivel: true
  },
  2: {
    numero: '2',
    titulo: 'Segundo Dia',
    subtitulo: 'Paz para o coração',
    kicker: 'Cântico Angelical · Dia 02',
    imagem: 'assets/images/cantico/provisorio-dia-2.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Terceiro Dia — Saúde.',
    disponivel: true
  },
  3: {
    numero: '3',
    titulo: 'Terceiro Dia',
    subtitulo: 'Saúde',
    kicker: 'Cântico Angelical · Dia 03',
    imagem: 'assets/images/cantico/provisorio-dia-3.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Quarto Dia — Trabalho e finanças.',
    disponivel: true
  },
  4: {
    numero: '4',
    titulo: 'Quarto Dia',
    subtitulo: 'Trabalho e finanças',
    kicker: 'Cântico Angelical · Dia 04',
    imagem: 'assets/images/cantico/provisorio-dia-4.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Quinto Dia — Família.',
    disponivel: true
  },
  5: {
    numero: '5',
    titulo: 'Quinto Dia',
    subtitulo: 'Família',
    kicker: 'Cântico Angelical · Dia 05',
    imagem: 'assets/images/cantico/provisorio-dia-5.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Sexto Dia — Novos caminhos.',
    disponivel: true
  },
  6: {
    numero: '6',
    titulo: 'Sexto Dia',
    subtitulo: 'Novos caminhos',
    kicker: 'Cântico Angelical · Dia 06',
    imagem: 'assets/images/cantico/provisorio-dia-6.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: 'Amanhã: Sétimo Dia — Gratidão e entrega.',
    disponivel: true
  },
  7: {
    numero: '7',
    titulo: 'Sétimo Dia',
    subtitulo: 'Gratidão e entrega',
    kicker: 'Cântico Angelical · Dia 07',
    imagem: 'assets/images/cantico/provisorio-dia-7.svg', // PROVISORIO
    videoEmbed: null, // PROVISORIO
    oracao: TEXTO_PROVISORIO_DO_CANTICO, // PROVISORIO
    proximo: '',
    disponivel: true
  }
};
