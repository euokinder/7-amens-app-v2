/* =====================================================================
   O NÚMERO DE "ASSISTINDO" DA LIVE DA DESATADORA (live-desatadora.html)
   Começa no número escrito na página (1.247) e, a cada 2 a 5 segundos,
   sobe ou desce um pouco, com leve tendência a subir. Os dois lugares
   marcados com data-assistindo (o cabeçalho e o selo em cima do vídeo)
   mostram sempre o mesmo número.

   Para mudar: MINIMO e MAXIMO são os limites; PASSO_PARA_BAIXO e
   PASSO_PARA_CIMA, o quanto ele anda de cada vez.
   ===================================================================== */
(function () {
  'use strict';

  var MINIMO = 1180;
  var MAXIMO = 1650;
  var PASSO_PARA_BAIXO = 6;   // desce até 6 de uma vez
  var PASSO_PARA_CIMA = 9;    // sobe até 9 de uma vez

  var lugares = document.querySelectorAll('[data-assistindo]');
  if (!lugares.length) return;

  var atual = parseInt(lugares[0].textContent.replace(/\D/g, ''), 10) || 1247;
  var formato = new Intl.NumberFormat('pt-BR');

  function mostrar() {
    var texto = formato.format(atual);
    for (var i = 0; i < lugares.length; i++) lugares[i].textContent = texto;
  }

  function andar() {
    var passo = Math.floor(Math.random() * (PASSO_PARA_BAIXO + PASSO_PARA_CIMA + 1)) - PASSO_PARA_BAIXO;
    atual = Math.min(MAXIMO, Math.max(MINIMO, atual + passo));
    mostrar();
    setTimeout(andar, 2000 + Math.random() * 3000);
  }

  setTimeout(andar, 2000 + Math.random() * 3000);
})();
