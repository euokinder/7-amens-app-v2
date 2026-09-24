// Conteúdo da Central dos Quatro Arcanjos — o que a cliente recebe ao comprar
// o upsell_01 ("Oração Celestial dos Quatro Arcanjos").
//
// Quatro Arcanjos, três orações cada. As três telas leem daqui:
//   arcanjos.html                     a Central, com os quatro
//   arcanjo.html?a=miguel             as três orações de um deles
//   oracao-arcanjo.html?a=miguel&o=1  a oração, com áudio e texto
//
// Quem pode abrir (e quem vê o cadeado) é decidido no js/member.js, não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o texto. Não prometer "conteúdo protegido".
//
// ⚠️ VERSÃO MVP (24/09/2026): textos das orações, áudios e imagens são
// PROVISÓRIOS — o Caio envia os definitivos. Procure por PROVISORIO.
//
// ⚠️ Ao trocar imagem ou áudio, use um NOME NOVO de arquivo. Tudo em assets/
// fica guardado no celular da cliente por um ano (netlify.toml): com o mesmo
// nome, ela continuaria vendo o provisório.
//
// audioUrl vazio = sem áudio (o tocador some da tela).
// imagem vazia na oração = usa a imagem do Arcanjo.

// PROVISORIO: o áudio do Dia 1, só para a tela mostrar o tocador funcionando.
const AUDIO_PROVISORIO = 'assets/audio/dia-01-oracao.mp3';

// PROVISORIO: o mesmo texto de mentira nas doze, no tamanho de uma oração
// de verdade, para ver como a tela fica com ela inteira.
const ORACAO_PROVISORIA = {
  abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
  blocos: [
    '[TEXTO PROVISÓRIO — o texto definitivo desta oração ainda vai ser enviado.]',
    'Este espaço mostra como a oração vai aparecer na tela: em letras grandes, com respiro entre os parágrafos, para ser rezada com calma e em voz alta.',
    'Cada parágrafo da oração verdadeira entra aqui, um depois do outro, na ordem em que deve ser rezado.',
    'As linhas que pedem uma pausa podem ser quebradas assim,\ne continuam no mesmo parágrafo,\numa embaixo da outra.'
  ],
  fechamento: 'Amém.'
};

const ARCANJOS = [
  {
    chave: 'miguel',
    nome: 'São Miguel',
    tema: 'Proteção',
    resumo: 'Proteção para você, sua família e sua casa.',
    imagem: 'assets/images/arcanjos/provisorio-miguel.svg', // PROVISORIO
    oracoes: [
      {
        titulo: 'Oração de São Miguel Contra Todo Mal',
        descricao: 'Proteção pessoal contra ataques, inveja e negatividade.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Miguel Pela Proteção da Família',
        descricao: 'Voltada para filhos, netos, marido e pessoas que vivem debaixo do mesmo teto.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Miguel Para Proteger Sua Casa',
        descricao: 'Focada no lar, conflitos, discórdias e tudo que tenta tirar a paz da família.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      }
    ]
  },
  {
    chave: 'gabriel',
    nome: 'São Gabriel',
    tema: 'Caminhos',
    resumo: 'Novos caminhos, trabalho e a direção de Deus.',
    imagem: 'assets/images/arcanjos/provisorio-gabriel.svg', // PROVISORIO
    oracoes: [
      {
        titulo: 'Oração de São Gabriel Para Abrir Novos Caminhos',
        descricao: 'Para quem sente a vida parada ou sem saída.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Gabriel Por Trabalho e Boas Notícias',
        descricao: 'Emprego, oportunidade, resposta esperada, dinheiro e portas que precisam se abrir.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Gabriel Para Receber a Direção de Deus',
        descricao: 'Para os momentos em que você não sabe qual caminho seguir.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      }
    ]
  },
  {
    chave: 'rafael',
    nome: 'São Rafael',
    tema: 'Cura e Restauração',
    resumo: 'Cura do corpo, de quem você ama e das suas forças.',
    imagem: 'assets/images/arcanjos/provisorio-rafael.svg', // PROVISORIO
    oracoes: [
      {
        titulo: 'Oração de São Rafael Pela Cura do Corpo',
        descricao: 'Apresente a Deus a sua enfermidade, a sua dor ou a sua preocupação com a saúde.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Rafael Pela Cura de Quem Você Ama',
        descricao: 'Mentalize ou diga o nome de quem você ama: um filho, o marido, um neto.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de São Rafael Para Restaurar Suas Forças',
        descricao: 'Para o cansaço, o abatimento e a fraqueza, do corpo e da alma.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      }
    ]
  },
  {
    // Sem "São" de propósito: a Igreja só reconhece pelo nome Miguel, Gabriel
    // e Rafael. Escrito assim pelo Caio em 24/09/2026 — não "corrigir".
    chave: 'uriel',
    nome: 'Uriel',
    tema: 'Sabedoria',
    resumo: 'Sabedoria para decidir e enxergar as armadilhas.',
    imagem: 'assets/images/arcanjos/provisorio-uriel.svg', // PROVISORIO
    oracoes: [
      {
        titulo: 'Oração de Uriel Para Uma Decisão Difícil',
        descricao: 'Quando existem dois caminhos e você não sabe o que fazer.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de Uriel Para Revelar Armadilhas',
        descricao: 'Pessoas falsas, negócios, escolhas ruins e situações que podem trazer sofrimento.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      },
      {
        titulo: 'Oração de Uriel Para Iluminar Seu Caminho',
        descricao: 'Para pedir sabedoria, clareza e discernimento.',
        imagem: '',
        audioUrl: AUDIO_PROVISORIO,
        oracao: ORACAO_PROVISORIA
      }
    ]
  }
];

// "São Miguel — Proteção", do jeito que aparece nos títulos.
function tituloDoArcanjo(arcanjo) {
  return `${arcanjo.nome} — ${arcanjo.tema}`;
}

function arcanjoPelaChave(chave) {
  return ARCANJOS.find((arcanjo) => arcanjo.chave === chave) || null;
}
