// Uma oração dos Arcángeles (/es-oracion-arcangel?a=miguel&o=1): o áudio
// guiado e, quando chegar, o texto. CÓPIA do script do oracao-arcanjo.html do
// Brasil, em espanhol. Enquanto a voz não chega (pendiente: true, em
// js/es/arcangeles.js), o quadro do tocador mostra "Audio en preparación".
// Arquivo só da LATAM.
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
    window.AMENES_EXTRAS.indisponible('No encontramos esta oración. Vuelve a la Central de los Cuatro Arcángeles.', '/es-arcangeles', 'Volver a la Central');
  } else {
    document.title = `${item.titulo} — Central de los Cuatro Arcángeles`;
    const listaDoArcangel = `/es-arcangel?a=${arcangel.clave}`;
    document.getElementById('volver').setAttribute('onclick', `history.length > 1 ? history.back() : location.href='${listaDoArcangel}'`);

    // Enquanto a voz não chega: o aviso de que o áudio está sendo ajustado e o
    // PDF dos Arcángeles em todas as orações, para nenhuma ficar sem nada
    // (Caio, 07/11). No Uriel, que não está no PDF, a frase não promete rezar a ele.
    const avisoDaVoz = 'Ya estamos ajustando el audio de esta oración: muy pronto estará aquí mismo. '
      + (arcangel.enElPdf ? `Mientras tanto, puedes rezar a ${esc(arcangel.nombre)} con tu PDF.` : 'Mientras tanto, puedes rezar con el PDF de los Arcángeles.');
    const audioHtml = item.audioUrl
      ? TOCADOR.html(item.audioUrl, 'Escucha la Oración en Audio')
      : item.pendiente
        ? window.AMENES_EXTRAS.audioEnPreparacion(avisoDaVoz, PDF_ARCANGELES, 'Abrir el PDF de los Arcángeles')
        : '';

    // Sem texto (oracion nula), a tela fica só com o áudio, como no Brasil.
    const textoHtml = item.oracion
      ? `<div style="display:flex;flex-direction:column;gap:14px;">
          <h2 class="section-label" style="margin:0;">La oración</h2>
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
        <span>Reza con fe y en voz alta, siempre que lo necesites</span>
      </div>

      <a class="member-button" href="${listaDoArcangel}" style="text-align:center;text-decoration:none;">Ver las oraciones de ${esc(arcangel.nombre)}</a>`;

    // O tocador (volver al inicio, retroceder, adelantar, velocidad) mora em js/es/tocador.js.
    if (item.audioUrl) TOCADOR.ligar(content.querySelector('.audio-card'), { titulo: item.titulo, album: 'Central de los Cuatro Arcángeles' });
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
