/* =====================================================================
   App em inglês: a página de venda em vídeo — headline, VSL e botão no
   minuto do pitch. CÓPIA de js/es/oferta-vsl.js (que copia o
   js/oferta-vsl.js do Brasil), com uma diferença: quem chega sem etiqueta
   leva utm_source=app-en (no espanhol, app-es; no Brasil, "app").

   Usado por en-offer-canticle.html. O botão diz, nele mesmo:
     data-link      o checkout
     data-campanha  a etiqueta de campanha quando ela chega sem nenhuma
     data-segundos  o minuto do pitch, em segundos (vazio = desde o começo)

   Vem no <head>, antes de tudo: a VTurb mexe no endereço da página, e a
   nossa etiqueta (utm_*) precisa estar guardada antes do player carregar.
   Toda venda daqui leva utm_term=pagina-vsl.

   Sem link (data-link vazio), o botão fica ESCONDIDO e, sem href, não leva a
   lugar nenhum; com ?previa=1 ele aparece apagado, só para conferir a tela.
   Desde 14/11/2026 o link é a Digistore24 dos EUA (en-offer-canticle.html,
   produto 741401).
   ===================================================================== */
(function () {
  'use strict';

  var VERSAO_DA_PAGINA = 'pagina-vsl';

  var permitidas = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var chegaram = new URLSearchParams(location.search);
  var guardadas = {};
  permitidas.forEach(function (nome) {
    var valor = (chegaram.get(nome) || '').trim();
    if (valor && valor.length <= 80 && /^[A-Za-z0-9._-]+$/.test(valor)) guardadas[nome] = valor;
  });
  window.ETIQUETAS_DE_ORIGEM = guardadas;

  // Chamado no fim do <body>, ANTES do script que carrega o player da VTurb.
  function ligar() {
    var botao = document.getElementById('oferta-comprar');
    if (!botao) return;

    var previa = chegaram.get('previa') === '1';
    var destino;
    try { destino = new URL(botao.dataset.link); } catch (e) { destino = null; }
    if (!destino) {
      // Sem checkout: o botão fica escondido (classe "esconder") e inerte;
      // só a prévia o mostra, apagado.
      botao.style.opacity = '0.5';
      botao.setAttribute('aria-disabled', 'true');
      if (previa) botao.classList.remove('esconder');
      return;
    }

    var etiquetas = {};
    Object.keys(guardadas).forEach(function (nome) { etiquetas[nome] = guardadas[nome]; });
    if (!etiquetas.utm_source) {
      etiquetas = {
        utm_source: 'app-en',
        utm_medium: 'direto',
        utm_campaign: botao.dataset.campanha || 'sem-campanha',
        utm_content: 'sem-etiqueta'
      };
    }
    etiquetas.utm_term = VERSAO_DA_PAGINA;
    Object.keys(etiquetas).forEach(function (nome) { destino.searchParams.set(nome, etiquetas[nome]); });
    botao.href = destino.href;

    // O botão no minuto do pitch: o player da VTurb revela o que tem a classe
    // "esconder" quando o vídeo chega nesse ponto. ?previa=1 mostra na hora.
    var segundos = parseInt(botao.dataset.segundos, 10);
    if (previa || !(segundos >= 0)) {
      botao.classList.remove('esconder');
      return;
    }

    // Rede de segurança: se a VTurb não carregar, o botão aparece mesmo assim,
    // 2 minutos depois do pitch (tempo de página aberta). Desliga quando o
    // player dá sinal de vida.
    var redeDeSeguranca = setTimeout(function () {
      if (botao.offsetHeight === 0) botao.classList.remove('esconder');
    }, (segundos + 120) * 1000);

    var player = document.querySelector('vturb-smartplayer');
    if (player) {
      player.addEventListener('player:ready', function () {
        if (typeof player.displayHiddenElements === 'function') {
          player.displayHiddenElements(segundos, ['.esconder'], { persist: true });
          clearTimeout(redeDeSeguranca);
        }
      });
    }

    // Quando o botão aparece fora da tela, a página desce só o necessário.
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
