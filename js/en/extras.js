// Os extras dentro do app em inglês: The Four Archangels (os Arcanjos) e o
// Angelic Canticle (o Cântico). CÓPIA do js/es/extras.js (que copia a lógica
// do js/member.js do Brasil: desenharCardArcanjos, trancarPaginaDosArcanjos e
// os do Cântico), em inglês. Arquivo só do app em inglês.
//
// Quem tem cada um vem do servidor, em retrato.extras (['arcangeles',
// 'cantico']; a regra mora no SQL do inglês, em supabase/en/). Duas telas
// obedecem, como no Brasil: o card da home e as páginas de cada extra, para
// quem chega por link.
//
// REDE DE SEGURANÇA, a mesma da trava do Brasil: sem o campo extras (função
// antiga no ar, ou o banco falhou), os dois ABREM. Trancar por engano quem
// pagou é pior do que abrir por engano para quem não pagou.
// ⚠️ Não é cadeado de verdade: os textos são arquivos públicos.
(function () {
  // A etiqueta separa, na venda, a que veio do card da que veio do pop-up
  // (utm_medium=popup). ⏳ EUA: o checkout em inglês ainda não existe; as
  // páginas de venda guardam a etiqueta e só a colam no link quando ele existir.
  // utm_source=app-en (no espanhol, app-es): conferir que os links dos pop-ups
  // em supabase/en/03-popups.sql usam o mesmo valor.
  const PAGINAS_DE_VENDA = { arcangeles: '/en-offer-archangels', cantico: '/en-offer-canticle' };
  const oferta = (clave, origem) =>
    `${PAGINAS_DE_VENDA[clave]}?utm_source=app-en&utm_medium=card&utm_campaign=${clave}&utm_content=${origem}`;

  const TRANCADA = {
    arcangeles: {
      titulo: 'The Four Archangels',
      texto: 'These prayers are part of the Four Archangels, which isn\'t included in your access yet. Tap below to learn more.',
      boton: 'Discover the Four Archangels',
    },
    cantico: {
      titulo: 'Angelic Canticle',
      texto: 'This journey is part of the Angelic Canticle, which isn\'t included in your access yet. Tap below to learn more.',
      boton: 'Discover the Angelic Canticle',
    },
  };

  const tiene = (retrato, clave) => !retrato || !Array.isArray(retrato.extras) || retrato.extras.includes(clave);

  // THREE MORNINGS (23/11/2026), como no Brasil e no espanhol: o card SÓ
  // aparece para quem comprou (sem cadeado e sem "Learn more": a venda é o
  // próprio vídeo do Day 7). Aqui não vale a rede de segurança: sem o campo
  // extras, o card fica escondido (abrir para todas mostraria a entrega a quem
  // não comprou). A página, aberta por link, segue a regra dos outros (tiene).
  function desenharCardOculto(retrato, clave, idDoCard) {
    const card = document.getElementById(idDoCard);
    if (card) card.hidden = !(retrato && Array.isArray(retrato.extras) && retrato.extras.includes(clave));
  }

  // O card da home: a versão "liberado" para quem tem; "🔒 EXTRA" e a versão
  // "trancado" (que leva à página de venda) para quem não tem.
  // As duas versões do texto moram no en.html (data-liberado / data-trancado).
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

  // O aviso dos extras com 🔒 (no en.html) só faz sentido se houver um 🔒.
  function desenharAviso() {
    const aviso = document.getElementById('aviso-extras');
    if (aviso) aviso.hidden = !document.querySelector('[data-situacao="trancado"]');
  }

  // A página de um extra aberta por quem não o tem: o convite para conhecer,
  // no lugar do conteúdo. Devolve true quando trancou.
  function trancarPagina(retrato, clave) {
    if (tiene(retrato, clave)) return false;
    const el = window.AMENES.el;
    // Three Mornings, como no Brasil e no espanhol: quem chega aqui sem o
    // produto quase sempre é quem PAGOU e não foi liberada. O aviso oferece a
    // equipe, e não a venda.
    if (clave === 'tres_madrugadas') {
      const titulo = el('h1', { class: 'title', text: 'Three Mornings of Intercession' });
      titulo.style.fontSize = '22px';
      const filhos = [el('div', { class: 'heading-block' }, titulo, el('p', {
        class: 'subtext',
        text: 'The Three Mornings are for those who got them at the end of the Seventh Amen, and they don\'t show in your access yet. If you already got them, contact us and we\'ll fix it.',
      }))];
      const contato = window.AMENES_CONFIG.soporte;
      if (contato) {
        const ajuda = el('a', { class: 'member-button', href: contato, text: 'Contact our team' });
        ajuda.target = '_blank';
        ajuda.rel = 'noopener';
        ajuda.style.cssText = 'text-align:center;text-decoration:none;';
        filhos.push(ajuda);
      }
      const voltar = el('a', { class: 'member-button secondary', href: '/en', text: 'Back to home' });
      voltar.style.cssText = 'text-align:center;text-decoration:none;color:var(--ink);';
      filhos.push(voltar);
      document.querySelector('.content').replaceChildren(...filhos);
      return true;
    }
    const t = TRANCADA[clave];
    const conhecer = el('a', { class: 'member-button', href: oferta(clave, 'link-directo'), text: t.boton });
    conhecer.style.cssText = 'text-align:center;text-decoration:none;';
    const voltar = el('a', { class: 'member-button secondary', href: '/en', text: 'Back to home' });
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

  // "Content not available": link quebrado ou dia que ainda não tem o que
  // entregar. Volta para a lista do extra.
  function indisponible(texto, volverA, volverTexto) {
    const el = window.AMENES.el;
    const titulo = el('h1', { class: 'title', text: 'Content not available' });
    titulo.style.fontSize = '22px';
    const voltar = el('a', { class: 'member-button', href: volverA, text: volverTexto });
    voltar.style.cssText = 'text-align:center;text-decoration:none;';
    document.querySelector('.content').replaceChildren(
      el('div', { class: 'heading-block' }, titulo, el('p', { class: 'subtext', text: texto })),
      voltar,
    );
  }

  // O quadro do tocador enquanto a voz não chega ("Audio coming soon").
  // pdf vazio ou null = sem botão.
  const ICONE_MUSICA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const ICONE_PDF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13m0 0 4-4m-4 4-4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>';
  function audioEnPreparacion(texto, pdf, pdfTexto) {
    return `<div class="audio-card">
      <div class="audio-card-label">${ICONE_MUSICA}<span>Audio coming soon</span></div>
      <p class="audio-card-aviso">${texto}</p>
      ${pdf ? `<a class="material-btn" href="${pdf}" target="_blank" rel="noopener">${ICONE_PDF} ${pdfTexto}</a>` : ''}
    </div>`;
  }

  window.AMENES_EXTRAS = { tiene, desenharCard, desenharCardOculto, desenharAviso, trancarPagina, indisponible, audioEnPreparacion };
})();
