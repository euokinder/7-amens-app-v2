// A TRAVA DAS MADRUGADAS — uma oração por dia
//
// A jornada é de 7 madrugadas, uma por dia. Sem trava, a cliente abre o app e
// vê as sete de uma vez: parte delas faz tudo numa tarde só e o produto perde
// o sentido que foi vendido. Com trava, o app caminha junto com ela.
//
// A REGRA, decidida pelo Caio em 20/09/2026:
//
//   · No dia em que ela entra no app pela primeira vez, ela tem a Introdução
//     e o Dia 1.
//   · Na meia-noite de Brasília abre o Dia 2. Na seguinte, o Dia 3. Até o 7.
//   · A abertura NÃO depende de ela marcar "Concluí esta oração". É calendário,
//     não botão. Quem reza e esquece de marcar não fica presa — e com senhoras
//     de 45+ esquecer o botão ia virar ligação no WhatsApp todo dia.
//   · Quem JÁ estava no meio do caminho quando a trava subiu abre com o Dia 3
//     pronto e segue de um em um a partir dali. É a rede para não tirar nada
//     de ninguém.
//
// ⚠️ ISTO É TRAVA DE EXPERIÊNCIA, NÃO DE SEGURANÇA. Os textos das orações
// moram em js/dias.js, arquivo público: quem souber abrir o código do site lê
// tudo sem esperar dia nenhum. É o mesmo desenho já decidido para o login.
// Não prometer "liberado aos poucos" como se fosse cadeado em peça de venda.

(() => {
  'use strict';

  const TOTAL_DE_DIAS = 7;

  // O dia em que a trava entrou no ar. Quem já andava no app ANTES desta data é
  // "antiga" e encontra o Dia 3 aberto de saída.
  //
  // Por que 20/09 e não 21/09: conferido na produção às 02h25 daquele dia, 344
  // clientes já tinham entrado no app antes dele e 10 estrearam nele — e
  // nenhuma dessas 10 tinha concluído oração nenhuma. Cortar em 20/09 dá os 3
  // dias às 344 que realmente começaram e deixa a jornada inteira valendo já
  // para quem comprar hoje. Cortar em 21/09 custaria um dia inteiro de vendas
  // novas entrando direto no Dia 3.
  //
  // ⚠️ Se a publicação escorregar para outra data, troque aqui. Atrasar não
  // estraga nada — oração já concluída nunca volta a ficar trancada, e é a
  // linha do `concluidas` mais abaixo que garante isso.
  const ENTROU_NO_AR = '2026-09-20';

  // Quantos dias a cliente antiga encontra abertos no dia em que a trava sobe.
  const PISO_DAS_ANTIGAS = 3;

  const DIA_EM_MS = 86400000;

  // As datas chegam como "2026-09-20", já na conta de Brasília — é assim que o
  // banco grava. Lidas com Date.UTC elas não passam pelo fuso do celular: um
  // aparelho em Portugal, ou com o relógio torto, dá exatamente o mesmo
  // resultado. Quem decide que dia é hoje é o servidor, nunca o aparelho dela.
  function emMilissegundos(data) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data || ''));
    if (!partes) return NaN;
    return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  }

  function diasEntre(de, ate) {
    const inicio = emMilissegundos(de);
    const fim = emMilissegundos(ate);
    if (Number.isNaN(inicio) || Number.isNaN(fim)) return NaN;
    return Math.round((fim - inicio) / DIA_EM_MS);
  }

  function somarDias(data, quantidade) {
    const base = emMilissegundos(data);
    if (Number.isNaN(base)) return '';
    return new Date(base + quantidade * DIA_EM_MS).toISOString().slice(0, 10);
  }

  // A maior madrugada que ela já marcou como concluída. Serve de piso: oração
  // que ela já rezou nunca volta a ficar trancada.
  function maiorDiaConcluido(progresso) {
    let maior = 0;
    for (const item of Array.isArray(progresso) ? progresso : []) {
      if (!item || !item.completed) continue;
      const numero = /^principal:([0-7])$/.exec(String(item.prayer_key || ''));
      if (numero) maior = Math.max(maior, Number(numero[1]));
    }
    return maior;
  }

  // Devolve { liberados, abreAmanha }.
  //   liberados  — até qual madrugada ela pode entrar hoje (1 a 7). A
  //                Introdução (Dia 0) está sempre aberta.
  //   abreAmanha — se a próxima abre mesmo na próxima meia-noite, para o selo
  //                do card não prometer o que não vai acontecer.
  function calcular(state) {
    // REDE DE SEGURANÇA, e é a linha mais importante deste arquivo.
    //
    // `state.hoje` é campo novo da member-api. Se o site subir antes da função
    // — ou se a função voltar para uma versão anterior — ele chega vazio, e aí
    // NÃO trancamos nada: as sete aparecem, exatamente como antes da trava
    // existir. O contrário seria centenas de clientes pagantes vendo só o Dia 1
    // por causa de um deploy fora de ordem, sem ninguém perceber pela tela.
    if (!state || !state.hoje) return { liberados: TOTAL_DE_DIAS, abreAmanha: false };

    const primeiroAcesso = state.primeiroAcesso || null;
    const concluidas = maiorDiaConcluido(state.progress);

    // "Antiga" é quem já pisou no app antes de a trava subir. Quem comprou em
    // agosto e nunca abriu NÃO é antiga: a jornada dela começa no dia em que
    // ela entra, que é justamente o desenho que o Caio pediu. Já quem não tem
    // visita registrada mas tem oração concluída é antiga — a contagem de
    // visitas só nasceu em 18/09/2026 e não enxerga quem rezou antes disso.
    const antiga = primeiroAcesso ? primeiroAcesso < ENTROU_NO_AR : concluidas > 0;

    // Para a antiga, a jornada é contada como se tivesse começado cedo o
    // bastante para o Dia 3 já estar aberto no dia em que a trava sobe. Daí em
    // diante ela anda de um em um, igual a todo mundo. Sem este deslocamento
    // ela ficaria parada no 3 esperando o calendário alcançá-la.
    const comeco = antiga
      ? somarDias(ENTROU_NO_AR, -(PISO_DAS_ANTIGAS - 1))
      : (primeiroAcesso || state.hoje);

    const decorridos = diasEntre(comeco, state.hoje);
    // Data estranha vinda do servidor não pode trancar ninguém.
    if (Number.isNaN(decorridos)) return { liberados: TOTAL_DE_DIAS, abreAmanha: false };

    const porCalendario = 1 + Math.max(0, decorridos);
    let liberados = porCalendario;
    if (antiga) liberados = Math.max(liberados, PISO_DAS_ANTIGAS);
    // As nove clientes que rezaram duas no mesmo dia antes de a trava existir
    // não podem ver cadeado em cima de uma oração que elas já fizeram.
    liberados = Math.max(liberados, concluidas);
    liberados = Math.min(TOTAL_DE_DIAS, liberados);

    // Só promete "abre amanhã" quando é o calendário que está segurando. Se ela
    // está adiantada pelo piso, a próxima meia-noite ainda não basta, e o selo
    // precisa dizer "em breve" em vez de mentir na tela dela.
    const abreAmanha = liberados < TOTAL_DE_DIAS && liberados === porCalendario;

    return { liberados, abreAmanha };
  }

  // O que o selo do card diz. "Indisponível" é palavra de sistema fora do ar;
  // aqui a oração não está quebrada, está esperando a vez dela chegar.
  function selo(numeroDoDia, trava) {
    return numeroDoDia === trava.liberados + 1 && trava.abreAmanha ? 'Abre amanhã' : 'Em breve';
  }

  window.TRAVA = { calcular, selo, TOTAL_DE_DIAS };
})();
