// A oferta emendada no vídeo do Dia 7 do app em espanhol (Caio, 08/11/2026).
// CÓPIA da `oferta` do Dia 7 do Brasil (js/dias.js + dia.html). Arquivo só da
// LATAM: o js/es/dias.js é gerado e não é tocado, por isso a oferta mora aqui.
//
// O vídeo do Dia 7 (VTurb, em js/es/video.js) é a oração e, emendada nela, a
// oferta de "Las 3 Madrugadas de Intercesión" (US$ 37, pagamento único, Whop,
// checkout da KashPay). O botão de compra aparece em `segundosDelBoton`, pelo
// relógio do próprio vídeo, e a página desce até ele.
// Com a oferta ligada, o dia NÃO tem "Recé esta oración" (dois botões
// disputando o dedo dela, como no Brasil): a oração se marca sozinha quando o
// vídeo passa de `finDeLaOracion`, o Amén. Quem reza sem o vídeo não é marcada.
// Desligar: os dois números em null (a tela volta a ter o "Recé esta oración").
// ?previa-oferta=1 mostra o botão na hora (para conferir a tela).
//
// ⚠️ Ainda não some para quem já comprou: o app em espanhol não sabe dessa
// compra (o retrato só traz os extras Arcángeles e Cántico).
(function () {
  'use strict';

  const OFERTAS = {
    7: {
      produto: 'tres_madrugadas',
      // Checkout da KashPay "Las 3 Madrugadas de Intercesión" (produto
      // 7a982b31-…, oferta d975ef54-…, US$ 37, Whop). Depois de pagar, ela volta
      // para /es. As UTM chegam ao aviso da KashPay (latam_kashpay_events).
      link: 'https://pay.setemadrugadas.com.br/checkout/checkout-1794181343516?utm_source=app&utm_medium=video-dia-7&utm_campaign=3-madrugadas',
      titulo: 'Continúa tu camino con Dios', // PROVISÓRIO: copy do Caio
      boton: 'Quiero Las 3 Madrugadas de Intercesión', // PROVISÓRIO: copy do Caio
      finDeLaOracion: 290, // 4:50: o Amén da oração (4:51)
      segundosDelBoton: 722, // 12:02, pedido do Caio
    },
  };

  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // A oferta do dia, ou null (dia sem oferta, ou oferta desligada).
  function para(dia) {
    const o = OFERTAS[dia];
    if (!o || typeof o.segundosDelBoton !== 'number' || typeof o.finDeLaOracion !== 'number') return null;
    if (!/^https:\/\//.test(o.link || '')) return null;
    return o;
  }

  function html(o, previa) {
    return `<section class="oferta-dia${previa ? '' : ' oferta-dia--oculta'}" id="oferta-del-dia" data-produto="${esc(o.produto)}" aria-labelledby="oferta-del-dia-titulo">
        <h2 class="oferta-dia__titulo" id="oferta-del-dia-titulo">${esc(o.titulo)}</h2>
        <a class="member-button oferta-dia__botao smartplayer-click-event" href="${esc(o.link)}">${esc(o.boton)}</a>
      </section>`;
  }

  // Liga o relógio: revela o botão no minuto do pitch e avisa uma vez quando a
  // oração termina (alTerminar). Igual ao dia.html do Brasil.
  function ligar(content, o, previa, alTerminar) {
    const bloco = document.getElementById('oferta-del-dia');
    if (!bloco) return;
    const player = content.querySelector('vturb-smartplayer');

    if (!previa) {
      // O relógio principal é o próprio vídeo (pausar o vídeo pausa a espera;
      // persist: quem volta já encontra o botão). O timer comum é só a rede de
      // segurança para o script da VTurb que não carrega.
      const rede = setTimeout(() => bloco.classList.remove('oferta-dia--oculta'), (o.segundosDelBoton + 120) * 1000);
      if (player) {
        player.addEventListener('player:ready', () => {
          if (typeof player.displayHiddenElements !== 'function') return;
          player.displayHiddenElements(o.segundosDelBoton, ['.oferta-dia--oculta'], { persist: true });
          clearTimeout(rede);
        });
      }
    }

    // O botão nasce abaixo do vídeo em pé, quase sempre fora da tela do
    // celular. Quando ele aparece, a página desce só o necessário.
    const olho = setInterval(() => {
      if (!bloco.isConnected) return clearInterval(olho);
      if (bloco.offsetHeight === 0) return;
      clearInterval(olho);
      const caixa = bloco.getBoundingClientRect();
      if (caixa.bottom <= window.innerHeight && caixa.top >= 0) return;
      try { bloco.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { bloco.scrollIntoView(false); }
    }, 1000);

    // O fim da oração, para marcar o dia sozinho.
    const relogio = setInterval(() => {
      if (!content.isConnected) return clearInterval(relogio);
      let segundos = 0;
      try { segundos = Number(player && player.currentTime) || 0; } catch (e) { /* player ainda carregando */ }
      if (segundos < o.finDeLaOracion) return;
      clearInterval(relogio);
      if (typeof alTerminar === 'function') alTerminar();
    }, 1000);
  }

  window.AMENES_OFERTA_DIA = { para, html, ligar };
})();
