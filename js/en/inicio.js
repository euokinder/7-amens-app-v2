// O início do app em inglês. Os cards são os do HTML (cópia do index.html do
// Brasil); aqui só entram o nome dela, o contato e o prazo do acesso.
// Arquivo só do app dos EUA.
(async function () {
  const cfg = window.AMENES_CONFIG;

  // O "Contact us" (o padre fala dele no vídeo de boas-vindas: o card nunca
  // some). Com a Lucy ligada, o toque abre a conversa (js/en/lucia.js).
  // ⏳ EUA: sem e-mail nem WhatsApp, o card fica sem link; se a Lucy também
  // estiver desligada (sem `chat` no config), o toque mostra um aviso curto
  // no próprio card, em vez de não fazer nada.
  const ayuda = document.getElementById('card-ayuda');
  if (cfg.soporte) ayuda.href = cfg.soporte;
  else if (!cfg.chat) {
    ayuda.addEventListener('click', evento => {
      evento.preventDefault();
      const texto = ayuda.querySelector('.card-contato-descricao');
      if (texto) texto.textContent = 'Our support team will be available here very soon. Thank you for your patience.';
    });
  }
  // O e-mail escrito por extenso no card (⏳ EUA: some enquanto não houver).
  if (cfg.correo) {
    document.getElementById('correo-escrito').textContent = cfg.correo;
    document.getElementById('linha-correo').hidden = false;
  }

  // O WhatsApp de suporte: o cartão e o link do portão (o que aparece quando
  // a tela demora para abrir), com a mensagem já escrita.
  // ⏳ EUA: os dois nascem escondidos no en.html e só aparecem com o contato.
  const linkWhatsapp = cfg.whatsapp('Hi, I have a question about my 7 Amens Before Dawn app.');
  if (linkWhatsapp) {
    const card = document.getElementById('card-whatsapp');
    card.href = linkWhatsapp;
    card.hidden = false;
    document.getElementById('whatsapp-escrito').textContent = cfg.whatsappEscrito;
  }
  const portao = document.getElementById('ayuda-portao');
  const linkPortao = cfg.whatsapp("Hi, I can't open my 7 Amens Before Dawn app.") || cfg.soporte;
  if (portao && linkPortao) {
    portao.href = linkPortao;
    portao.hidden = false;
  }

  document.getElementById('salir').addEventListener('click', () => window.AMENES.salir());

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  const nombre = r.cliente && r.cliente.nombre;
  if (nombre) document.getElementById('saudacao').textContent = `Hello, ${nombre}! May the peace of the Lord be with you.`;
  if (r.acceso_hasta) document.getElementById('acceso-hasta').textContent = `Your access is valid through ${r.acceso_hasta}.`;

  // Os extras: "AVAILABLE" para quem tem, "🔒 EXTRA" para quem não tem
  // (js/en/extras.js). Antes de mostrar a tela, para não piscar.
  window.AMENES_EXTRAS.desenharCard(r, 'arcangeles', 'card-arcangeles', '/en-archangels');
  window.AMENES_EXTRAS.desenharCard(r, 'cantico', 'card-cantico', '/en-canticle');
  // Three Mornings (23/11/2026): o card só aparece para quem comprou.
  window.AMENES_EXTRAS.desenharCardOculto(r, 'tres_madrugadas', 'card-tres-madrugadas');
  window.AMENES_EXTRAS.desenharAviso();

  // RASTRO (js/en/rastro.js): cada card visto na tela (uma vez por página) e
  // cada toque nele. O toque só chama e segue: o registro sai por sendBeacon,
  // sem segurar a navegação. `situacao` só existe nos dois extras.
  const NOMES_DOS_CARDS = { 'card-arcangeles': 'arcangeles', 'card-cantico': 'cantico', 'card-whatsapp': 'whatsapp', 'card-ayuda': 'contato' };
  const nomeDoCard = card => NOMES_DOS_CARDS[card.id]
    || (card.getAttribute('href') === '/en-journey' ? 'jornada' : card.getAttribute('href') === '/en-materials' ? 'pdfs' : '');
  const dadosDoCard = card => (card.dataset.situacao ? { card: nomeDoCard(card), situacao: card.dataset.situacao === 'trancado' ? 'bloqueado' : card.dataset.situacao } : { card: nomeDoCard(card) });
  const cards = Array.from(document.querySelectorAll('a.card-produto, a.card-contato')).filter(nomeDoCard);
  cards.forEach(card => card.addEventListener('click', () => window.AMENES_RASTRO?.rastro('card_toque', dadosDoCard(card))));
  // Dois olhos para o mesmo fim (o navegador às vezes atrasa o IntersectionObserver
  // com a página parada): o observador e uma conferência a cada segundo.
  const vistos = new Set();
  const viu = card => {
    if (vistos.has(card)) return;
    vistos.add(card);
    window.AMENES_RASTRO?.rastro('card_visto', dadosDoCard(card));
  };
  if ('IntersectionObserver' in window) {
    const olho = new IntersectionObserver(entradas => entradas.forEach(entrada => { if (entrada.isIntersecting) viu(entrada.target); }), { threshold: 0.5 });
    cards.forEach(card => olho.observe(card));
  }
  const conferencia = setInterval(() => {
    if (vistos.size >= cards.length) { clearInterval(conferencia); return; }
    if (document.visibilityState !== 'visible') return;
    cards.forEach(card => {
      if (vistos.has(card) || card.offsetHeight === 0) return;
      const caixa = card.getBoundingClientRect();
      const visivel = Math.min(caixa.bottom, window.innerHeight) - Math.max(caixa.top, 0);
      if (visivel >= Math.min(card.offsetHeight, window.innerHeight) * 0.5) viu(card);
    });
  }, 1000);

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
