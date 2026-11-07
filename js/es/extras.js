// Os extras dentro do app em espanhol (07/11/2026): a Central de los Cuatro
// Arcángeles (UP01) e o Cántico Angelical (UP02). CÓPIA da lógica do
// js/member.js do Brasil (desenharCardArcanjos, trancarPaginaDosArcanjos e os
// do Cântico), em espanhol. Arquivo só da LATAM.
//
// Quem tem cada um vem do servidor, em retrato.extras (['arcangeles',
// 'cantico']; a regra mora em supabase/latam/05-extras.sql). Duas telas
// obedecem, como no Brasil: o card da home e as páginas de cada extra, para
// quem chega por link.
//
// REDE DE SEGURANÇA, a mesma da trava do Brasil: sem o campo extras (função
// antiga no ar, ou o banco falhou), os dois ABREM. Trancar por engano quem
// pagou é pior do que abrir por engano para quem não pagou.
// ⚠️ Não é cadeado de verdade: os textos são arquivos públicos.
(function () {
  // A etiqueta separa, no pedido da KashPay, a venda que veio do card da que
  // veio do pop-up (utm_medium=popup).
  const PAGINAS_DE_VENDA = { arcangeles: '/es-oferta-arcangeles', cantico: '/es-oferta-cantico' };
  const oferta = (clave, origem) =>
    `${PAGINAS_DE_VENDA[clave]}?utm_source=app-es&utm_medium=card&utm_campaign=${clave}&utm_content=${origem}`;

  const TRANCADA = {
    arcangeles: {
      titulo: 'Central de los Cuatro Arcángeles',
      texto: 'Estas oraciones forman parte de las Oraciones de los Cuatro Arcángeles, que todavía no están en tu acceso. Toca abajo para conocerlas.',
      boton: 'Conocer los Cuatro Arcángeles',
    },
    cantico: {
      titulo: 'Cántico Angelical',
      texto: 'Esta jornada forma parte del Cántico Angelical, que todavía no está en tu acceso. Toca abajo para conocerlo.',
      boton: 'Conocer el Cántico Angelical',
    },
  };

  const tiene = (retrato, clave) => !retrato || !Array.isArray(retrato.extras) || retrato.extras.includes(clave);

  // O card da home: "DISPONIBLE" e "Acceder al contenido" para quem tem;
  // "🔒 EXTRA" e "Adquirir" (que leva à página de venda) para quem não tem.
  // As duas versões do texto moram no es.html (data-liberado / data-trancado).
  // O endereço escrito no HTML é o de quem comprou, de propósito: se o JS
  // falhar, o card abre o conteúdo em vez de trancar uma cliente que pagou.
  function desenharCard(retrato, clave, idDoCard, destino) {
    const card = document.getElementById(idDoCard);
    if (!card) return;
    const liberado = tiene(retrato, clave);
    const situacao = liberado ? 'liberado' : 'trancado';
    card.dataset.situacao = situacao;
    card.href = liberado ? destino : oferta(clave, 'card-home');
    card.querySelectorAll('[data-liberado]').forEach((texto) => {
      texto.textContent = texto.dataset[situacao] || texto.textContent;
    });
  }

  // "Los contenidos con 🔒 son extras..." só faz sentido se houver um 🔒.
  function desenharAviso() {
    const aviso = document.getElementById('aviso-extras');
    if (aviso) aviso.hidden = !document.querySelector('[data-situacao="trancado"]');
  }

  // A página de um extra aberta por quem não o tem: o convite para conhecer,
  // no lugar do conteúdo. Devolve true quando trancou.
  function trancarPagina(retrato, clave) {
    if (tiene(retrato, clave)) return false;
    const t = TRANCADA[clave];
    const el = window.AMENES.el;
    const conhecer = el('a', { class: 'member-button', href: oferta(clave, 'link-directo'), text: t.boton });
    conhecer.style.cssText = 'text-align:center;text-decoration:none;';
    const voltar = el('a', { class: 'member-button secondary', href: '/es', text: 'Volver al inicio' });
    voltar.style.cssText = 'text-align:center;text-decoration:none;color:var(--ink);';
    const titulo = el('h1', { class: 'title', text: t.titulo });
    titulo.style.fontSize = '22px';
    document.querySelector('.content').replaceChildren(
      el('div', { class: 'heading-block' }, titulo, el('p', { class: 'subtext', text: t.texto })),
      conhecer,
      voltar,
    );
    return true;
  }

  // "Contenido no disponible": link quebrado ou dia que ainda não tem o que
  // entregar. Volta para a lista do extra.
  function indisponible(texto, volverA, volverTexto) {
    const el = window.AMENES.el;
    const titulo = el('h1', { class: 'title', text: 'Contenido no disponible' });
    titulo.style.fontSize = '22px';
    const voltar = el('a', { class: 'member-button', href: volverA, text: volverTexto });
    voltar.style.cssText = 'text-align:center;text-decoration:none;';
    document.querySelector('.content').replaceChildren(
      el('div', { class: 'heading-block' }, titulo, el('p', { class: 'subtext', text: texto })),
      voltar,
    );
  }

  // O quadro do tocador enquanto a voz não chega (Caio, 07/11: os extras vão
  // ao ar com os PDFs, e as vozes entram depois). pdf vazio = sem botão.
  const ICONE_MUSICA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const ICONE_PDF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13m0 0 4-4m-4 4-4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>';
  function audioEnPreparacion(texto, pdf, pdfTexto) {
    return `<div class="audio-card">
      <div class="audio-card-label">${ICONE_MUSICA}<span>Audio en preparación</span></div>
      <p class="audio-card-aviso">${texto}</p>
      ${pdf ? `<a class="material-btn" href="${pdf}" target="_blank" rel="noopener">${ICONE_PDF} ${pdfTexto}</a>` : ''}
    </div>`;
  }

  window.AMENES_EXTRAS = { tiene, desenharCard, desenharAviso, trancarPagina, indisponible, audioEnPreparacion };
})();
