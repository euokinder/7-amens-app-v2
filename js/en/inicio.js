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
  window.AMENES_EXTRAS.desenharAviso();

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
