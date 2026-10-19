/* =====================================================================
   A PÁGINA DE VENDA EM VÍDEO DOS EXTRAS — headline, VSL e botão no
   minuto do pitch (pedido do Caio em 19/10/2026)

   Usado por oferta-arcanjos-vsl.html (só o card da home; o pop-up continua
   em oferta-arcanjos.html) e por oferta-cantico.html. Cada página diz, no
   próprio botão, o que muda de uma para outra:
     data-link      o checkout da Hubla
     data-campanha  a etiqueta de campanha quando ela chega sem nenhuma
     data-segundos  o minuto do pitch, em segundos. Vazio = o botão aparece
                    desde o começo (é o "sem minuto ainda", não um modo).

   POR QUE ESTE ARQUIVO VEM NO <head>, ANTES DE TUDO
   O card manda a cliente para cá com utm_* no endereço, dizendo de onde ela
   veio. A VTurb mexe no endereço da página para escrever a etiqueta DELA.
   Guardada antes de o player carregar, a nossa já está salva, aconteça o
   que acontecer depois. E por isso os campos são utm_*, que a VTurb só lê.

   A ETIQUETA DA PÁGINA (utm_term)
   Toda venda que sai daqui leva utm_term=pagina-vsl. É o que separa, no
   evento da Hubla, o que esta página vendeu do que a página antiga vendia
   com a mesma etiqueta do card — e, depois, da versão em texto (TSL), que
   vai levar outro valor. A Hubla devolve o "term" no webhook (conferido
   em 19/10, em event.subscription.firstPaymentSession.utm).
   ===================================================================== */
(function () {
  'use strict';

  var VERSAO_DA_PAGINA = 'pagina-vsl';

  var permitidas = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var chegaram = new URLSearchParams(location.search);
  var guardadas = {};
  permitidas.forEach(function (nome) {
    var valor = (chegaram.get(nome) || '').trim();
    // Só segue adiante o que tem cara de etiqueta nossa, para nada estranho
    // entrar no link do checkout.
    if (valor && valor.length <= 80 && /^[A-Za-z0-9._-]+$/.test(valor)) guardadas[nome] = valor;
  });
  window.ETIQUETAS_DE_ORIGEM = guardadas;

  // Chamado no fim do <body>, ANTES do script que carrega o player da VTurb:
  // assim o "player:ready" nunca acontece antes de alguém estar ouvindo.
  function ligar() {
    var botao = document.getElementById('oferta-comprar');
    if (!botao) return;

    // O LINK, COM A ETIQUETA COLADA
    // Quando ela chega SEM etiqueta nenhuma (digitou o endereço, ou um link
    // novo esqueceu de etiquetar), mandamos "sem-etiqueta" de propósito: campo
    // vazio deixaria a dúvida entre "veio direto" e "o rastreamento quebrou".
    var destino;
    try { destino = new URL(botao.dataset.link); } catch (e) { destino = null; }
    if (!destino) {
      botao.style.opacity = '0.5';
      botao.setAttribute('aria-disabled', 'true');
    } else {
      var etiquetas = {};
      Object.keys(guardadas).forEach(function (nome) { etiquetas[nome] = guardadas[nome]; });
      if (!etiquetas.utm_source) {
        etiquetas = {
          utm_source: 'app',
          utm_medium: 'direto',
          utm_campaign: botao.dataset.campanha || 'sem-campanha',
          utm_content: 'sem-etiqueta'
        };
      }
      etiquetas.utm_term = VERSAO_DA_PAGINA;
      Object.keys(etiquetas).forEach(function (nome) { destino.searchParams.set(nome, etiquetas[nome]); });
      botao.href = destino.href;
    }

    // O BOTÃO NO MINUTO DO PITCH
    // O próprio player da VTurb revela o que tem a classe "esconder" quando o
    // vídeo chega nesse ponto (displayHiddenElements). Com persist: true a
    // VTurb lembra, e quem volta à página já encontra o botão.
    var segundos = parseInt(botao.dataset.segundos, 10);
    // ATALHO PARA CONFERIR A TELA: ?previa=1 no fim do endereço mostra o botão
    // na hora. A cliente nunca chega aqui com ele: o card manda só utm_*.
    var previa = chegaram.get('previa') === '1';
    if (previa || !(segundos >= 0)) {
      botao.classList.remove('esconder');
      return;
    }

    // Rede de segurança: se o script da VTurb não carregar (internet ruim,
    // bloqueador, serviço fora do ar), o botão não apareceria NUNCA e a venda
    // se perderia calada. ⚠️ Este relógio conta o tempo de PÁGINA ABERTA, não
    // de vídeo assistido; por isso é desligado assim que o player dá sinal de
    // vida, e dali em diante quem conta é o player, que conta certo.
    var redeDeSeguranca = setTimeout(function () {
      if (botao.offsetHeight === 0) botao.classList.remove('esconder');
    }, (segundos + 120) * 1000);

    var player = document.querySelector('vturb-smartplayer');
    if (player) {
      player.addEventListener('player:ready', function () {
        if (typeof player.displayHiddenElements === 'function') {
          player.displayHiddenElements(segundos, ['.esconder'], { persist: true });
          clearTimeout(redeDeSeguranca); // o player assumiu o relógio
        }
      });
    }

    // Quando o botão aparece, ele pode nascer logo abaixo da tela (celular
    // pequeno, vídeo em pé). No instante em que ele ganha altura, a página
    // desce só o necessário para mostrá-lo — e não mexe em nada se ele já
    // estiver à vista.
    var olho = setInterval(function () {
      if (botao.offsetHeight === 0) return;
      clearInterval(olho);
      var caixa = botao.getBoundingClientRect();
      if (caixa.bottom <= window.innerHeight && caixa.top >= 0) return;
      try { botao.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { botao.scrollIntoView(false); }
    }, 1000);
  }

  window.OFERTA_VSL = { ligar: ligar };
})();
