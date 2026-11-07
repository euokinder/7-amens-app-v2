// O início do app em espanhol. Os cards são os do HTML (cópia do index.html do
// Brasil); aqui só entram o nome dela, o contato e o prazo do acesso.
// Arquivo só da LATAM.
(async function () {
  const soporte = window.AMENES_CONFIG.soporte;
  document.getElementById('ayuda-portao').href = soporte;
  document.getElementById('card-ayuda').href = soporte;
  document.getElementById('salir').addEventListener('click', () => window.AMENES.salir());

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  const nombre = r.cliente && r.cliente.nombre;
  if (nombre) document.getElementById('saudacao').textContent = `Hola, ${nombre}, ¡que la paz del Señor esté contigo!`;
  if (r.acceso_hasta) document.getElementById('acceso-hasta').textContent = `Tu acceso vale hasta el ${r.acceso_hasta}.`;

  // Os extras (07/11/2026): "DISPONIBLE" para quem tem, "🔒 EXTRA" para quem
  // não tem (js/es/extras.js). Antes de mostrar a tela, para não piscar.
  window.AMENES_EXTRAS.desenharCard(r, 'arcangeles', 'card-arcangeles', '/es-arcangeles');
  window.AMENES_EXTRAS.desenharCard(r, 'cantico', 'card-cantico', '/es-cantico');
  window.AMENES_EXTRAS.desenharAviso();

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
