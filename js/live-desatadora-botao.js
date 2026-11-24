/* =====================================================================
   O BOTÃO DE COMPRA DA LIVE DA DESATADORA (live-desatadora.html)
   Mesmo desenho do botão das páginas de venda em vídeo (js/oferta-vsl.js),
   mas sem as etiquetas próprias do app: esta página recebe tráfego de fora,
   então as etiquetas que chegam no endereço seguem para o checkout como
   vieram, sem nada trocado.

   O que o botão diz no HTML:
     data-link      o checkout da Hubla
     data-segundos  o minuto do botão, em segundos (vazio = desde o começo)

   ⚠️ Este arquivo tem de carregar ANTES do script do player da VTurb: a VTurb
   mexe no endereço da página, e as etiquetas são lidas aqui antes disso.
   ===================================================================== */
(function () {
  'use strict';

  var botao = document.getElementById('oferta-comprar');
  if (!botao) return;

  // AS ETIQUETAS DE ORIGEM (utm_*), lidas antes de o player mexer no endereço
  var chegaram = new URLSearchParams(location.search);
  var etiquetas = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (nome) {
    var valor = (chegaram.get(nome) || '').trim();
    if (valor && valor.length <= 200) etiquetas[nome] = valor;
  });

  // O LINK, COM AS ETIQUETAS COLADAS
  var destino;
  try { destino = new URL(botao.dataset.link); } catch (e) { destino = null; }
  if (!destino) {
    botao.classList.add('sem-link');
    botao.setAttribute('aria-disabled', 'true');
  } else {
    Object.keys(etiquetas).forEach(function (nome) { destino.searchParams.set(nome, etiquetas[nome]); });
    botao.href = destino.href;
  }

  // O BOTÃO NO MINUTO CERTO
  // O próprio player da VTurb revela o que tem a classe "esconder" quando o
  // vídeo chega nesse ponto. Com persist: true, quem volta já encontra o botão.
  // ?previa=1 no fim do endereço mostra o botão na hora (só para conferir).
  var segundos = parseInt(botao.dataset.segundos, 10);
  if (chegaram.get('previa') === '1' || !(segundos >= 0)) {
    botao.classList.remove('esconder');
    return;
  }

  // Rede de segurança: se o script da VTurb não carregar, o botão aparece
  // mesmo assim (contando o tempo de página aberta). Desliga quando o player
  // assume o relógio.
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
})();
