// O pedido de reembolso do app em espanhol (es-reembolso.html). Arquivo só da LATAM.
//
// A página funciona sem login: o botão já sai com o correo escrito no HTML.
// Se ela veio do app (mesma aba), este arquivo acrescenta ao correo o e-mail
// da compra, para a equipe achar a compra sem perguntar de volta.
//
// De propósito, NÃO chama o servidor nem o js/es/sesion.js: com a sessão
// vencida ou o acesso retirado, o retrato mandaria ela para a tela de entrar,
// e quem quer o dinheiro de volta não pode ficar presa num login. O e-mail sai
// só do retrato que o próprio app já guardou nesta aba (amenes-es.retrato).
(function () {
  const correo = window.AMENES_CONFIG.correo;
  const boton = document.getElementById('boton-reembolso');

  let emailDeLaCompra = '';
  try {
    const guardado = JSON.parse(sessionStorage.getItem('amenes-es.retrato') || 'null');
    const email = guardado && guardado.retrato && guardado.retrato.cliente && guardado.retrato.cliente.email;
    if (typeof email === 'string' && email.includes('@')) emailDeLaCompra = email;
  } catch { /* sem armazenamento: o campo sai em branco e ela escreve */ }

  const linhas = [
    'Hola, quiero pedir el reembolso de mi compra de 7 Amenes de la Madrugada.',
    '',
    `Correo de la compra: ${emailDeLaCompra}`,
    'Motivo (si quieres contarnos): ',
    '',
    'Gracias.',
  ];
  const assunto = 'Reembolso - 7 Amenes de la Madrugada';
  boton.href = `mailto:${correo}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(linhas.join('\n'))}`;
})();
