// O pop-up de oferta do app em inglês. CÓPIA do js/es/oferta.js (que copia o
// setupMemberOffer do js/member.js do Brasil: o mesmo desenho e o mesmo
// comportamento), traduzida. Arquivo só do app em inglês.
//
// Quem escolhe o pop-up é o banco (en_claim_offer, em
// supabase/en/03-popups.sql); ele chega em `oferta`, junto com o retrato,
// e o js/en/sesion.js chama AMENES_POPUP.mostrar quando a página abre.
// Os textos de cada pop-up (eyebrow, headline, body, botões) moram no banco;
// aqui ficam só os de reserva, para quando a campanha vier sem eles.
// ⏳ EUA: os pop-ups levam às páginas de venda (en-offer-*), que ainda não têm
// checkout em inglês: lá a compra fica escondida até o link existir.
// Carregado só no início, na lista e no dia: nunca nas páginas de venda
// (en-offer-*), onde ela está no meio de um vídeo.
(function () {
  'use strict';

  // A campanha guarda o endereço COMPLETO. Quando é uma página do próprio app,
  // troca-se o domínio pelo de agora: sem isto, tocar no pop-up em localhost
  // levaria quem está testando ao site das clientes reais.
  const NOSSOS_SITES = /^(?:www\.)?setemadrugadas\.com\.br$|--7madrugadas\.netlify\.app$/;
  function mesmoApp(url) {
    if (!NOSSOS_SITES.test(url.hostname)) return url;
    try { return new URL(url.pathname + url.search + url.hash, location.href); } catch { return url; }
  }

  const el = (tag, clase, texto) => {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  };

  function mostrar(oferta) {
    if (!oferta || document.getElementById('member-offer-dialog')) return;
    let destino;
    try { destino = new URL(oferta.target_url); } catch { return; }
    if (destino.protocol !== 'https:') return;
    destino = mesmoApp(destino);
    const registrar = evento => window.AMENES.registrarOferta(oferta.campaign_key, evento);

    const dialog = el('dialog', 'member-offer-dialog');
    dialog.id = 'member-offer-dialog';
    dialog.dataset.offerType = oferta.offer_type || 'product';
    dialog.setAttribute('aria-labelledby', 'member-offer-title');
    const hoja = el('div', 'member-offer-sheet');
    // A chamada aceita duas linhas: a primeira vira alerta, a segunda o rótulo
    // dourado de sempre.
    const chamadas = String(oferta.eyebrow || 'An opportunity for you').split('\n').map(l => l.trim()).filter(Boolean);
    const eyebrow = el('div', 'member-offer-eyebrow');
    chamadas.forEach((linha, indice) => {
      eyebrow.append(el('span', chamadas.length > 1 && indice === 0 ? 'member-offer-alert' : '', linha));
    });
    const titulo = el('h2', '', oferta.headline);
    titulo.id = 'member-offer-title';
    // Cada linha da copy vira um parágrafo; a última é a que leva ao clique.
    const paragrafos = String(oferta.body || '').split('\n').map(l => l.trim()).filter(Boolean);
    const copy = el('div', 'member-offer-copy');
    paragrafos.forEach((linha, indice) => {
      copy.append(el('p', indice === paragrafos.length - 1 && paragrafos.length > 1 ? 'member-offer-lead' : '', linha));
    });
    const cta = el('button', 'member-button member-offer-cta', oferta.cta_label || 'See it now');
    cta.type = 'button';
    const cerrar = el('button', 'member-offer-dismiss', oferta.dismiss_label || 'Not now');
    cerrar.type = 'button';

    let saliendo = false;
    cta.addEventListener('click', async () => {
      if (saliendo) return;
      saliendo = true;
      cta.disabled = true;
      cta.textContent = 'Opening…';
      await Promise.race([registrar('clicked'), new Promise(resolve => setTimeout(resolve, 900))]);
      location.assign(destino.href);
    });
    cerrar.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', evento => { if (evento.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (saliendo) return;
      registrar('dismissed');
      dialog.remove();
    });

    hoja.append(eyebrow, titulo, copy, cta, cerrar);
    dialog.append(hoja);
    document.body.append(dialog);
    dialog.showModal();
    window.AMENES.quitarOferta();
    registrar('shown');
  }

  window.AMENES_POPUP = { mostrar };
})();
