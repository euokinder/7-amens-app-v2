// Uma oração dos Arcanjos (/en-archangel-prayer?a=miguel&o=1): o áudio
// guiado e, quando chegar, o texto. CÓPIA do script do oracao-arcanjo.html do
// Brasil (via js/es/oracion-arcangel.js), em inglês. Enquanto a voz não chega
// (pendiente: true, em js/en/arcangeles.js), o quadro do tocador mostra
// "Audio coming soon". Arquivo só do app em inglês.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const params = new URLSearchParams(location.search);
  const arcangel = arcangelPorClave(params.get('a'));
  const numero = parseInt(params.get('o'), 10);
  const item = arcangel && arcangel.oraciones[numero - 1];
  const content = document.getElementById('content');

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (window.AMENES_EXTRAS.trancarPagina(r, 'arcangeles')) {
    // trancada: o convite para conhecer já está na tela
  } else if (!item) {
    window.AMENES_EXTRAS.indisponible('We couldn\'t find this prayer. Please go back to the Four Archangels.', '/en-archangels', 'Back to the Four Archangels');
  } else {
    document.title = `${item.titulo} — The Four Archangels`;
    const listaDoArcangel = `/en-archangel?a=${arcangel.clave}`;
    document.getElementById('volver').setAttribute('onclick', `history.length > 1 ? history.back() : location.href='${listaDoArcangel}'`);

    // Enquanto a voz não chega: o aviso de que o áudio está sendo preparado e,
    // se houver PDF, o botão dele (no espanhol, o PDF dos Arcanjos em todas as
    // orações, Caio, 07/11). No Uriel, que não estava no PDF, a frase não
    // promete rezar a ele.
    // ⏳ EUA: sem PDF em inglês (PDF_ARCANGELES = null), o aviso fica só com a
    // primeira frase, e o botão do PDF não aparece.
    const avisoDaVoz = 'We\'re finishing the audio for this prayer. It will be right here very soon.'
      + (!PDF_ARCANGELES
        ? ''
        : arcangel.enElPdf
          ? ` In the meantime, you can pray to ${esc(arcangel.nombre)} with your PDF.`
          : ' In the meantime, you can pray with the Archangels PDF.');
    const audioHtml = item.audioUrl
      ? TOCADOR.html(item.audioUrl, 'Listen to the Prayer')
      : item.pendiente
        ? window.AMENES_EXTRAS.audioEnPreparacion(avisoDaVoz, PDF_ARCANGELES, 'Open the Archangels PDF')
        : '';

    // Sem texto (oracion nula), a tela fica só com o áudio, como no Brasil.
    const textoHtml = item.oracion
      ? `<div style="display:flex;flex-direction:column;gap:14px;">
          <h2 class="section-label" style="margin:0;">The Prayer</h2>
          <div class="prayer-card">
            <p class="opening">${esc(item.oracion.apertura)}</p>
            ${item.oracion.bloques.map((bloque) => `<p>${esc(bloque).replace(/\n/g, '<br>')}</p>`).join('')}
            <p class="closing">${esc(item.oracion.cierre)}</p>
          </div>
        </div>`
      : '';

    content.innerHTML = `
      <span class="kicker">${esc(tituloDelArcangel(arcangel))}</span>
      <div class="section-heading" style="margin-top:-8px;">
        <div class="bar"></div>
        <div class="heading-block">
          <h1 class="title" style="font-size:22px;">${esc(item.titulo)}</h1>
          <p class="subtext">${esc(item.descripcion)}</p>
        </div>
      </div>

      ${audioHtml}

      ${textoHtml}

      <div class="banner">
        <span>Pray out loud and with faith, whenever you need to</span>
      </div>

      <a class="member-button" href="${listaDoArcangel}" style="text-align:center;text-decoration:none;">See all prayers to ${esc(arcangel.nombre)}</a>`;

    // O tocador (voltar ao início, voltar e avançar 10 s, velocidade) mora em js/en/tocador.js.
    if (item.audioUrl) TOCADOR.ligar(content.querySelector('.audio-card'), { titulo: item.titulo, album: 'The Four Archangels' });
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
