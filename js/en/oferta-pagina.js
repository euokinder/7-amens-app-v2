// As páginas de venda do app em inglês (en-offer-*): só o portão
// "Checking your access…", como no Brasil (que usa o js/member.js nelas).
// Sem pop-up aqui: ela está no meio de um vídeo de venda (o js/en/oferta.js
// não é carregado nestas páginas). Arquivo só do app em inglês.
(async function () {
  const ayuda = document.getElementById('ayuda-portao');
  if (ayuda) ayuda.href = window.AMENES_CONFIG.soporte;

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;
  window.AMENES.mostrarTela();
})();
