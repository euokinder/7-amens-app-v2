// A NOVENA DOS 5 NOMES — o que a cliente recebe com o novena_5_nomes, o
// Up 1 novo do funil (a venda está em painosso.net/novoup01-app; o pop-up do
// app, em supabase/popup-novena-5-nomes.sql). A entrega entrou no app em
// 25/11/2026, a pedido do Arthur.
//
// O que ela recebe, tudo dentro de um card só da home:
//   1. a Novena: nove vídeos, um por madrugada, a Maria, Rainha dos Anjos;
//   2. o Cântico dos Quatro Arcanjos: a Central dos Quatro Arcanjos que já
//      existia (arcanjos.html), que passa a abrir também para quem tem a
//      Novena (temArcanjos, em js/member.js).
//
// As duas telas leem daqui:
//   novena-5-nomes.html            os nomes, a madrugada de hoje, a lista
//   novena-5-nomes-dia.html?dia=1  uma madrugada: os nomes e o vídeo
//
// Quem pode abrir é decidido no js/member.js (temNovena). Não aqui.
// ⚠️ Não é cadeado de verdade: este arquivo é público, como o js/dias.js.
// Guia a cliente; não protege o vídeo. Não prometer "conteúdo protegido".
//
// OS NOMES (decisão do Arthur, 25/11/2026): na primeira vez que ela abre a
// Novena, a tela pede o nome dela e o de até quatro pessoas. Pode escrever
// menos, ou nenhum. ⚠️ OS NOMES FICAM SÓ NO CELULAR DELA (localStorage): não
// vão para o servidor, que guarda apenas SE ela escreveu. Em outro aparelho
// a tela pede de novo. Por isso nenhum texto das telas diz que alguém recebe
// ou lê os nomes: eles aparecem em cada madrugada, para ELA dizer em voz alta.
//
// UMA MADRUGADA POR DIA: a 1ª abre no dia em que ela abre a Novena pela
// primeira vez; cada meia-noite de Brasília abre a seguinte, até a 9ª. Não
// depende de marcar "Concluí". A âncora (`novena5.inicio`) vem da member-api.
// ⚠️ É a primeira abertura DA NOVENA, e não a primeira entrada no app (como
// nas 7 madrugadas e no Cântico): quem compra com semanas de app encontraria
// as nove abertas de uma vez.
// Rede de segurança, igual à do js/trava.js: sem o campo `novena5` (função
// antiga no ar, ou banco sem a tabela), nada tranca e o "Concluí" não aparece.
//
// bunny: o vídeo na Bunny (biblioteca do js/video.js). São vídeos só de
// entrega, então nascem na Bunny e não têm cópia na VTurb. Sem o ID, a tela
// da madrugada diz que o vídeo está sendo preparado.
// ⚠️ Foto nova = arquivo com NOME novo: tudo em assets/ fica guardado no
// celular da cliente por um ano (netlify.toml).

(() => {
  'use strict';

  const TOTAL = 9;
  // '3:4' é o vídeo em pé (como os das 7 madrugadas); '16:9', o deitado.
  const FORMATO = '3:4';

  const ORDINAIS = ['', 'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona'];
  // Na Bunny desde 25/11/2026 (biblioteca do js/video.js), enviados pela API
  // e conferidos pela duração. Os originais: "madrugada 1 br.mp4" a "9".
  const VIDEOS = {
    1: '76584570-6d3d-43db-81c8-df0c9cca939c',
    2: '2d403324-ec1b-4269-9469-d00a0d895fc4',
    3: '3cae5b51-d86c-40f9-8276-b91976d2852c',
    4: 'a3d85632-1210-4389-8aa9-097298b32efa',
    5: 'f61277c9-b479-4a6a-8371-912cf0ed9f78',
    6: '33efe8e1-ee0c-4aa6-8d21-72042a0cc55d',
    7: '0d4dee45-7238-4c33-a500-a3a7a5ac50fd',
    8: '083a43d9-47a4-42b2-b5ab-c3bb5958e5f2',
    9: '2f9ad861-dab5-4e15-baa3-19ba60c6cee9'
  };

  const madrugadas = {};
  for (let n = 1; n <= TOTAL; n++) {
    madrugadas[n] = {
      numero: n,
      titulo: `${ORDINAIS[n]} Madrugada`,
      kicker: `Novena dos 5 Nomes · Madrugada ${n} de ${TOTAL}`,
      bunny: VIDEOS[n] ? { video: VIDEOS[n], formato: FORMATO } : null,
      proximo: n < TOTAL
        ? `Amanhã: a ${ORDINAIS[n + 1]} Madrugada.`
        : 'Você chegou à última madrugada da novena. Que Nossa Senhora passe na frente de cada nome.'
    };
  }

  // ---------------------------------------------------------------- nomes
  const CHAVE_DOS_NOMES = '7amens.novena5.nomes';
  // Só para o modo "sem servidor" (rede de segurança): lembra, neste
  // aparelho, que ela já passou pela tela dos nomes.
  const CHAVE_PASSOU = '7amens.novena5.passou';
  const MAXIMO_DE_NOMES = 5;

  // O nome como ela digitou, sem espaço sobrando e sem nada que não seja
  // letra, espaço, hífen, apóstrofo ou ponto. No máximo 30 letras.
  function limparNome(texto) {
    return String(texto || '')
      .replace(/[^\p{L}\s'.-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30);
  }

  function lerNomes() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE_DOS_NOMES) || '[]');
      return Array.isArray(lista) ? lista.map(limparNome).filter(Boolean).slice(0, MAXIMO_DE_NOMES) : [];
    } catch { return []; }
  }

  function guardarNomes(lista) {
    const limpos = (Array.isArray(lista) ? lista : []).map(limparNome).filter(Boolean).slice(0, MAXIMO_DE_NOMES);
    try {
      localStorage.setItem(CHAVE_DOS_NOMES, JSON.stringify(limpos));
      localStorage.setItem(CHAVE_PASSOU, '1');
    } catch { /* celular sem espaço ou em modo privado: segue sem guardar */ }
    return limpos;
  }

  function jaPassouAqui() {
    try { return localStorage.getItem(CHAVE_PASSOU) === '1'; } catch { return false; }
  }

  // --------------------------------------------------------------- a trava
  const DIA_EM_MS = 86400000;
  function emMilissegundos(data) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data || ''));
    return partes ? Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) : NaN;
  }

  const concluidasDe = contexto => {
    const lista = contexto && contexto.novena && Array.isArray(contexto.novena.concluidas) ? contexto.novena.concluidas : [];
    return lista.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL);
  };

  // Devolve { liberados, abreAmanha }, como o js/trava.js.
  // `contexto` é o que o js/member.js entrega: { servidor, novena, hoje }.
  function calcular(contexto) {
    const aberto = { liberados: TOTAL, abreAmanha: false };
    // REDE DE SEGURANÇA: sem servidor, sem o dia de hoje ou sem a âncora,
    // nada tranca. O contrário seria cliente pagante vendo só a 1ª madrugada
    // por causa de uma publicação fora de ordem.
    if (!contexto || !contexto.servidor || !contexto.hoje || !contexto.novena || !contexto.novena.inicio) return aberto;
    const decorridos = Math.round((emMilissegundos(contexto.hoje) - emMilissegundos(contexto.novena.inicio)) / DIA_EM_MS);
    if (Number.isNaN(decorridos)) return aberto;
    const porCalendario = 1 + Math.max(0, decorridos);
    // Madrugada que ela já marcou nunca volta a ficar trancada.
    const liberados = Math.min(TOTAL, Math.max(porCalendario, ...concluidasDe(contexto), 1));
    return { liberados, abreAmanha: liberados < TOTAL && liberados === porCalendario };
  }

  const selo = (numero, trava) => (numero === trava.liberados + 1 && trava.abreAmanha ? 'Abre amanhã' : 'Em breve');

  // A madrugada que a tela põe em destaque: a primeira aberta que ela ainda
  // não concluiu. Com todas as abertas concluídas, a última aberta.
  function madrugadaDaVez(contexto, trava) {
    const feitas = concluidasDe(contexto);
    for (let n = 1; n <= trava.liberados; n++) if (!feitas.includes(n)) return n;
    return trava.liberados;
  }

  window.NOVENA5 = {
    TOTAL, MAXIMO_DE_NOMES, madrugadas,
    limparNome, lerNomes, guardarNomes, jaPassouAqui,
    calcular, selo, concluidasDe, madrugadaDaVez
  };
})();
