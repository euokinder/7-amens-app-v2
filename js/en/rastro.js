// O rastreamento do app em inglês: o que a cliente faz dentro do app.
// Arquivo só do app dos EUA: nenhuma página do Brasil nem do espanhol carrega
// este arquivo. O plano inteiro está em docs/rastreio-en.md.
//
// Para a tela, é uma função só:
//   window.AMENES.rastro('card_toque', { card: 'arcangeles', situacao: 'bloqueado' });
// Os nomes dos passos são um contrato (docs/rastreio-en.md): não inventar
// nome novo sem anotar lá. O passo `pagina` este arquivo grava sozinho, ao
// carregar.
//
// COMO ECONOMIZA CHAMADAS (a cota do Supabase é dividida com o Brasil e a LATAM)
// Os passos ficam numa fila e saem em PACOTE (até 20 por vez):
//   - quando a página some (ela troca de página, de aba ou fecha o app);
//   - 10 segundos depois do primeiro passo que a tela mandar (uma vez por
//     página; depois disso, de minuto em minuto, e só se houver passo novo);
//   - na hora, se a fila chegar a 20.
// Abrir uma página e sair, sem mais nada, custa UMA chamada (na saída).
// A fila também fica guardada no navegador: se o celular matar a página antes
// do envio, os passos vão junto com os da página seguinte, com a hora certa
// (cada passo leva "há quantos segundos aconteceu"; o relógio do celular não
// entra na conta).
//
// REGRAS
//   - Nunca lança erro e nunca espera resposta: falhar aqui não pode
//     atrapalhar a tela.
//   - Sem sessão (a tela de entrar), nada é guardado nem enviado.
//   - Nada de dado de pessoa: só o caminho da página (sem o que vem depois
//     de ? ou #: o código do link de entrada mora no #), as utm e o que a
//     tela mandar no props (o servidor ainda descarta texto com @).
//   - Chaves do navegador: "amens-en.*", que o Brasil nunca lê.
//   - Pode carregar antes ou depois do js/en/sesion.js.
(function () {
  'use strict';

  var AMENES = (window.AMENES = window.AMENES || {});

  try {
    var SESION = 'amens-en.sesion';   // a mesma chave do js/en/sesion.js
    var FILA = 'amens-en.rastro';
    var PACOTE = 20;                  // o máximo que o servidor aceita por vez
    var MAX_FILA = 60;                // acima disso, os mais antigos saem
    var PRIMEIRO_ENVIO = 10 * 1000;
    var ENVIO_SEGUINTE = 60 * 1000;
    var NOME = /^[a-z0-9_]{1,40}$/;
    var CAMINHO = /^\/[A-Za-z0-9\/_.-]{0,79}$/;
    var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

    var ler = function (clave) { try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; } };
    var guardar = function (clave, valor) {
      try { if (valor) localStorage.setItem(clave, valor); else localStorage.removeItem(clave); } catch (e) { /* sem armazenamento */ }
    };
    var token = function () { var t = ler(SESION); return /^[a-f0-9]{64}$/.test(t) ? t : ''; };
    var api = function () { return (window.AMENES_CONFIG && window.AMENES_CONFIG.api) || ''; };
    var zona = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };
    var noComputador = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    // O FREIO DE MÃO (sem publicar nada): um teste chamado `rastro`, ligado,
    // com a versão única `off`, faz toda tela parar de mandar passos em até 5
    // minutos (o tempo que o retrato fica guardado). O SQL está em
    // docs/rastreio-en.md. O retrato é o que o js/en/sesion.js guarda.
    var desligado = function () {
      try {
        var guardado = JSON.parse(sessionStorage.getItem('amens-en.retrato') || 'null');
        return Boolean(guardado && guardado.retrato && guardado.retrato.testes && guardado.retrato.testes.rastro === 'off');
      } catch (e) { return false; }
    };

    // A página: só o caminho. E as utm com que ela chegou a esta página.
    var pagina = CAMINHO.test(location.pathname) ? location.pathname : '';
    var origem = (function () {
      var utm = {};
      try {
        var params = new URLSearchParams(location.search);
        UTM.forEach(function (clave) {
          var valor = (params.get(clave) || '').trim().slice(0, 80);
          if (valor && valor.indexOf('@') < 0) utm[clave] = valor;
        });
      } catch (e) { /* navegador antigo */ }
      return utm;
    })();
    // De que página do app ela veio (só o caminho, e só se for do mesmo site).
    var vindaDe = (function () {
      try {
        if (!document.referrer) return '';
        var antes = new URL(document.referrer);
        return antes.origin === location.origin && CAMINHO.test(antes.pathname) ? antes.pathname : '';
      } catch (e) { return ''; }
    })();

    // O aparelho: celular ou computador, o sistema, e se abriu pelo ícone da
    // tela inicial. Vai uma vez por pacote.
    var ua = navigator.userAgent || '';
    var iPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    var sistema = /iPhone|iPad|iPod/.test(ua) || iPad ? 'ios'
      : /Android/.test(ua) ? 'android'
        : /Windows/.test(ua) ? 'windows'
          : /Macintosh|Mac OS X/.test(ua) ? 'mac' : 'other';
    var aparelho = sistema === 'ios' || sistema === 'android' || /Mobi/.test(ua) ? 'mobile' : 'desktop';
    var instalado = false;
    try {
      instalado = navigator.standalone === true
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch (e) { /* sem matchMedia */ }

    // ------------------------------------------------------------ a fila
    // Guardada com as 8 primeiras letras da sessão: se outra pessoa entrar
    // neste aparelho, os passos da anterior não vão na conta dela.
    var dona = function () { return token().slice(0, 8); };
    var fila = (function () {
      try {
        var guardada = JSON.parse(ler(FILA) || 'null');
        guardar(FILA, '');
        if (guardada && guardada.de && guardada.de === dona() && Array.isArray(guardada.q)) return guardada.q.slice(-MAX_FILA);
      } catch (e) { /* guardado estragado */ }
      return [];
    })();
    var persistir = function () {
      guardar(FILA, fila.length ? JSON.stringify({ de: dona(), q: fila }) : '');
    };

    // Só valores simples no props (o servidor confere de novo).
    var limpar = function (props) {
      var limpo = {};
      if (!props || typeof props !== 'object') return limpo;
      Object.keys(props).slice(0, 8).forEach(function (clave) {
        var valor = props[clave];
        if (typeof valor === 'string') { if (valor) limpo[clave] = valor.slice(0, 80); }
        else if ((typeof valor === 'number' && isFinite(valor)) || typeof valor === 'boolean') limpo[clave] = valor;
      });
      return limpo;
    };

    var corpoDe = function (lote, sesion) {
      var agora = Date.now();
      return JSON.stringify({
        action: 'eventos',
        tz: zona(),
        s: sesion,
        aparelho: aparelho,
        sistema: sistema,
        instalado: instalado,
        passos: lote.map(function (e) {
          return { n: e.n, p: e.p, pg: e.pg, ha: Math.max(0, Math.round((agora - e.t) / 1000)), o: e.o };
        }),
      });
    };

    // ------------------------------------------------------------ o envio
    // "text/plain" e nenhum cabeçalho próprio, de propósito: assim o navegador
    // não faz a pergunta prévia (OPTIONS) e cada pacote é UMA ida ao servidor.
    // A sessão vai dentro do corpo (campo `s`).
    var emVoo = false;
    var jaEnviou = false;
    var relogio = null;

    function enviar(saindo) {
      try {
        var sesion = token();
        var destino = api();
        if (!sesion || !destino || desligado()) { fila = []; persistir(); return; }
        if (!fila.length) return;

        if (saindo) {
          // A página está sumindo: o navegador garante a entrega do sendBeacon.
          for (var volta = 0; volta < 3 && fila.length; volta += 1) {
            var lote = fila.slice(0, PACOTE);
            var corpo = corpoDe(lote, sesion);
            var foi = false;
            try { foi = Boolean(navigator.sendBeacon && navigator.sendBeacon(destino, corpo)); } catch (e) { foi = false; }
            if (!foi) {
              try {
                fetch(destino, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: corpo })
                  .catch(function () { /* sem rede */ });
                foi = true;
              } catch (e) { foi = false; }
            }
            if (!foi) break;
            fila.splice(0, lote.length);
          }
          persistir();
          return;
        }

        if (emVoo) return;
        var pacote = fila.splice(0, PACOTE);
        persistir();
        emVoo = true;
        jaEnviou = true;
        fetch(destino, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: corpoDe(pacote, sesion) })
          .then(function (respuesta) {
            // Recusado pelo servidor (sessão vencida, pacote torto): descarta.
            // Erro passageiro (5xx): volta para a fila e vai no próximo envio.
            if (respuesta.status >= 500) { fila = pacote.concat(fila).slice(-MAX_FILA); persistir(); }
          })
          .catch(function () { fila = pacote.concat(fila).slice(-MAX_FILA); persistir(); })
          .then(function () { emVoo = false; });
      } catch (e) { emVoo = false; }
    }

    function armar() {
      if (relogio) return;
      relogio = setTimeout(function () { relogio = null; enviar(false); }, jaEnviou ? ENVIO_SEGUINTE : PRIMEIRO_ENVIO);
    }

    // ------------------------------------------------------------ a função
    function rastro(nome, props) {
      try {
        if (typeof nome !== 'string' || !NOME.test(nome)) return;
        if (!token()) return;
        fila.push({ n: nome, p: limpar(props), pg: pagina, t: Date.now(), o: origem });
        if (fila.length > MAX_FILA) fila.splice(0, fila.length - MAX_FILA);
        persistir();
        if (noComputador) { try { console.debug('[rastro]', nome, props || {}); } catch (e) { /* sem console */ } }
        if (fila.length >= PACOTE) enviar(false);
        // Só a página aberta não liga o relógio: ela sai na saída, de carona.
        else if (nome !== 'pagina') armar();
      } catch (e) { /* nunca atrapalha a tela */ }
    }
    AMENES.rastro = rastro;

    // A página some: troca de página, de aba, ou o app vai para o fundo.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') enviar(true);
    });
    window.addEventListener('pagehide', function () { enviar(true); });
    // Voltou pelo botão "voltar" do navegador, com a página guardada: conta
    // como página aberta de novo.
    window.addEventListener('pageshow', function (evento) {
      if (evento && evento.persisted) rastro('pagina', vindaDe ? { de: vindaDe, volta: true } : { volta: true });
    });

    // O passo `pagina`, sozinho, ao carregar.
    rastro('pagina', vindaDe ? { de: vindaDe } : {});
    // Sobrou passo de uma página que o celular matou antes do envio: sai logo.
    if (fila.length > 1) armar();
  } catch (e) {
    // Qualquer problema ao montar: a tela continua podendo chamar, sem efeito.
    if (typeof AMENES.rastro !== 'function') AMENES.rastro = function () {};
  }
})();
