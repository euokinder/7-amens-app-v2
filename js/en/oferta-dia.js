// A oferta emendada no vídeo do dia, no app em inglês. CÓPIA do
// js/es/oferta-dia.js (que copia a `oferta` do Dia 7 do Brasil: js/dias.js +
// dia.html). Arquivo só do app em inglês: o js/en/dias.js é gerado e não é
// tocado, por isso a oferta mora aqui.
//
// O vídeo do Dia 7 (VTurb, em js/en/video.js) é a oração e, emendada nela, a
// oferta de "Three Mornings of Intercession" (US$ 27, pagamento único, como
// diz o roteiro em inglês: "twenty-seven dollars, in one payment"). O botão de
// compra aparece em `segundosDelBoton`, pelo relógio do próprio vídeo, e a
// página desce até ele.
// Com a oferta ligada, o dia NÃO tem "I prayed this prayer" (dois botões
// disputando o dedo dela, como no Brasil): a oração se marca sozinha quando o
// vídeo passa de `finDeLaOracion`, o Amen. Quem reza sem o vídeo não é marcada.
// Desligar: os dois números em null (a tela volta a ter o "I prayed this prayer").
// ?previa-oferta=1 mostra o botão na hora (para conferir a tela).
//
// ⚠️ Não some para quem já comprou: o app não sabe dessa compra (o retrato só
// traz os extras Arcanjos e Cântico).
//
// O DIA 3: o mesmo relógio, com TRÊS botões de contribuição no lugar de um
// (como as contribuições do Dia 03 do Brasil, maior primeiro e em destaque),
// e a mesma marcação sozinha no Amen. Em inglês, quem pede é Sister Cecilia,
// para a Basilica of the Seven Prayers ("a section of the floor, a pew, a stone
// for the altar"). Uma oferta com `opciones` só liga com os três links
// preenchidos; até lá, o Dia 3 fica com a `reserva` de js/en/video.js e o
// "I prayed this prayer".
//
// ✅ EUA (18/11/2026): os Dias 3 e 7 estão ligados, com os minutos abaixo.
// O texto a seguir é o histórico de antes disso.
// ⏳ (antigo) EUA: NADA DISTO ESTÁ LIGADO AINDA, de propósito. Os vídeos em inglês não
// existem, e o checkout em inglês também não. Por isso os links estão vazios e
// os minutos (segundosDelBoton, finDeLaOracion) estão em null: `para()` devolve
// null, e os Dias 3 e 7 ficam como dias comuns, com o "I prayed this prayer".
// Os minutos do espanhol (Dia 3: Amen 4:40, botões 9:37; Dia 7: Amen 4:50,
// botão 12:02) NÃO servem: medir no vídeo em inglês. Pelo roteiro em inglês, os
// botões do Dia 3 entram na fala de Sister Cecilia "So I'm asking you, my
// sister, my brother. Take this step with me.", e o do Dia 7 na fala "Your
// contribution for the Three Mornings of Intercession is twenty-seven dollars,
// in one payment."
// Ao preencher um link, colar as etiquetas no fim dele, no mesmo molde do
// espanhol: ?utm_source=app-en&utm_medium=video-dia-3&utm_campaign=aporte
// (Dia 3) e ?utm_source=app-en&utm_medium=video-dia-7&utm_campaign=3-madrugadas
// (Dia 7). E garantir, ANTES da primeira venda, que a função que libera a venda
// em inglês reconhece cada produto.
(function () {
  'use strict';

  const OFERTAS = {
    3: {
      produto: 'aporte',
      titulo: 'Choose your contribution below. Let\'s take this step together!', // PROVISÓRIO: copy do Caio
      // Checkouts da Hubla, produto "Sacred Amens" (18/11/2026), os mesmos
      // valores do espanhol (200 / 120 / 60). Vídeo da VTurb em js/en/video.js.
      opciones: [
        { texto: 'A section of the floor · US$ 200', link: 'https://pay.hub.la/LDuZaRatXokaT8PhEOuF?utm_source=app-en&utm_medium=video-dia-3&utm_campaign=aporte', destaque: true },
        { texto: 'A pew · US$ 120', link: 'https://pay.hub.la/QjEJ0Y8CTc93PFCsUi7I?utm_source=app-en&utm_medium=video-dia-3&utm_campaign=aporte' },
        { texto: 'A stone for the altar · US$ 60', link: 'https://pay.hub.la/Fm980EKCbVoQlyDf93Yh?utm_source=app-en&utm_medium=video-dia-3&utm_campaign=aporte' },
      ],
      finDeLaOracion: 252, // 4:12: o Amen da oração de Father James (4:14) no vídeo da VTurb de 18/11; depois vem Sister Cecilia
      segundosDelBoton: 525, // 8:45: "Below this video you'll see three options" (8:44), pedido do Arthur em 18/11
    },
    7: {
      produto: 'tres_madrugadas',
      // ⏳ EUA: checkout de "Three Mornings of Intercession" (US$ 27) ainda não
      // existe (o do espanhol era da Hubla, "Las 3 Madrugadas de Intercesión":
      // NÃO usar). A entrega é fora do app.
      // Checkout da Hubla "Three Mornings of Intercession" (US$ 27, criado em 18/11/2026).
      link: 'https://pay.hub.la/Q4yKyAd7GkCQYAnHbZty?utm_source=app-en&utm_medium=video-dia-7&utm_campaign=3-madrugadas',
      titulo: 'Continue your walk with God', // PROVISÓRIO: copy do Caio
      boton: 'I want the Three Mornings of Intercession', // PROVISÓRIO: copy do Caio
      finDeLaOracion: 263, // 4:23: o Amen da oração (4:25) no vídeo da VTurb de 18/11
      segundosDelBoton: 662, // 11:02: "Tap the button below...", o mesmo ponto do pitch do espanhol (Arthur, 18/11)
    },
  };

  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // A oferta do dia, ou null (dia sem oferta, oferta desligada, ou faltando
  // algum link).
  function para(dia) {
    const o = OFERTAS[dia];
    if (!o || typeof o.segundosDelBoton !== 'number' || typeof o.finDeLaOracion !== 'number') return null;
    const links = o.opciones ? o.opciones.map((opcion) => opcion.link) : [o.link];
    if (!links.length || !links.every((link) => /^https:\/\//.test(link || ''))) return null;
    return o;
  }

  function html(o, previa) {
    const botones = o.opciones
      ? `<div class="oferta-dia__opciones">${o.opciones.map((opcion) => `
          <a class="oferta-dia__aporte${opcion.destaque ? ' oferta-dia__aporte--destaque' : ''} smartplayer-click-event" href="${esc(opcion.link)}"><strong>${esc(opcion.texto)}</strong></a>`).join('')}
        </div>`
      : `<a class="member-button oferta-dia__botao smartplayer-click-event" href="${esc(o.link)}">${esc(o.boton)}</a>`;
    return `<section class="oferta-dia${previa ? '' : ' oferta-dia--oculta'}" id="oferta-del-dia" data-produto="${esc(o.produto)}" aria-labelledby="oferta-del-dia-titulo">
        <h2 class="oferta-dia__titulo" id="oferta-del-dia-titulo">${esc(o.titulo)}</h2>
        ${botones}
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
