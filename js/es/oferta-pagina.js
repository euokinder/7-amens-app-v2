// As páginas de venda do app em espanhol (es-oferta-*): só o portão
// "Verificando tu acceso…", como no Brasil (que usa o js/member.js nelas).
// Sem pop-up aqui: ela está no meio de um vídeo de venda (o js/es/oferta.js
// não é carregado nestas páginas). Arquivo só da LATAM.
(async function () {
  const ayuda = document.getElementById('ayuda-portao');
  if (ayuda) ayuda.href = window.AMENES_CONFIG.soporte;

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;
  window.AMENES.mostrarTela();
})();
