// Conteúdo da Central dos Quatro Arcanjos — o que a cliente recebe ao comprar
// o upsell_01 ("Oração Celestial dos Quatro Arcanjos").
//
// Quatro Arcanjos, três orações cada. As três telas leem daqui:
//   arcanjos.html                     a Central, com os quatro
//   arcanjo.html?a=miguel             as três orações de um deles
//   oracao-arcanjo.html?a=miguel&o=1  a oração: o áudio (e o texto, quando chegar)
//
// Quem pode abrir (e quem vê o cadeado) é decidido no js/member.js, não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o texto. Não prometer "conteúdo protegido".
//
// ⚠️ VERSÃO MVP (24/09/2026): as imagens são PROVISÓRIAS — procure por
// PROVISORIO. Os 12 áudios são os definitivos, em assets/audio/arcanjos/.
// Por enquanto a entrega é SÓ o áudio (decisão do Caio, 24/09): o texto das
// orações ainda não entrou.
//
// ⚠️ Ao trocar imagem ou áudio, use um NOME NOVO de arquivo. Tudo em assets/
// fica guardado no celular da cliente por um ano (netlify.toml): com o mesmo
// nome, ela continuaria vendo o provisório.
//
// audioUrl vazio = sem áudio (o tocador some da tela).
// oracao nula = sem texto na tela. Quando o texto chegar, ele entra no
// campo oracao, no formato { abertura, blocos: [...], fechamento }.
// imagem vazia na oração = usa a imagem do Arcanjo.

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
        audioUrl: 'assets/audio/arcanjos/miguel-1.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Miguel Pela Proteção da Família',
        descricao: 'Voltada para filhos, netos, marido e pessoas que vivem debaixo do mesmo teto.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/miguel-2.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Miguel Para Proteger Sua Casa',
        descricao: 'Focada no lar, conflitos, discórdias e tudo que tenta tirar a paz da família.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/miguel-3.mp3',
        oracao: null
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
        audioUrl: 'assets/audio/arcanjos/gabriel-1.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Gabriel Por Trabalho e Boas Notícias',
        descricao: 'Emprego, oportunidade, resposta esperada, dinheiro e portas que precisam se abrir.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/gabriel-2.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Gabriel Para Receber a Direção de Deus',
        descricao: 'Para os momentos em que você não sabe qual caminho seguir.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/gabriel-3.mp3',
        oracao: null
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
        audioUrl: 'assets/audio/arcanjos/rafael-1.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Rafael Pela Cura de Quem Você Ama',
        descricao: 'Mentalize ou diga o nome de quem você ama: um filho, o marido, um neto.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/rafael-2.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de São Rafael Para Restaurar Suas Forças',
        descricao: 'Para o cansaço, o abatimento e a fraqueza, do corpo e da alma.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/rafael-3.mp3',
        oracao: null
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
        audioUrl: 'assets/audio/arcanjos/uriel-1.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de Uriel Para Revelar Armadilhas',
        descricao: 'Pessoas falsas, negócios, escolhas ruins e situações que podem trazer sofrimento.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/uriel-2.mp3',
        oracao: null
      },
      {
        titulo: 'Oração de Uriel Para Iluminar Seu Caminho',
        descricao: 'Para pedir sabedoria, clareza e discernimento.',
        imagem: '',
        audioUrl: 'assets/audio/arcanjos/uriel-3.mp3',
        oracao: null
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
