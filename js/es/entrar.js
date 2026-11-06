// A entrada do app em espanhol: pelo e-mail da compra ou pelo link de entrada.
// No desenho da tela de entrar do Brasil (login.html). Arquivo só da LATAM.
(function () {
  const form = document.getElementById('form-entrar');
  const campo = document.getElementById('correo');
  const boton = form.querySelector('button');
  const aviso = document.getElementById('aviso');
  const TEXTO_DO_BOTAO = boton.textContent;
  document.getElementById('boton-ayuda').href = window.AMENES_CONFIG.soporte;

  function mostrar(texto, tipo) {
    aviso.textContent = texto || '';
    aviso.classList.toggle('es-info', tipo === 'info');
  }

  const pendiente = window.AMENES.mensajePendiente();
  if (pendiente) mostrar(pendiente);

  // Link de entrada: /es-entrar#CÓDIGO (16 letras e números). O código vem
  // depois do "#" de propósito: essa parte nunca sai do celular para o
  // servidor do site nem para o "de onde veio" da página seguinte.
  // Também quando o link é tocado com esta página já aberta: aí o navegador
  // só troca o "#", sem recarregar.
  function probarEnlace() {
    const codigo = location.hash.slice(1);
    if (!/^[A-Za-z0-9]{16}$/.test(codigo)) return false;
    history.replaceState(null, '', location.pathname);
    boton.disabled = true;
    mostrar('Entrando con tu enlace…', 'info');
    window.AMENES.entrarConEnlace(codigo).then(r => {
      if (r.ok) { location.replace('/es'); return; }
      boton.disabled = false;
      mostrar(r.error);
    });
    return true;
  }
  window.addEventListener('hashchange', probarEnlace);
  if (!probarEnlace() && !pendiente && window.AMENES.tieneSesion()) location.replace('/es');

  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const email = campo.value.trim();
    if (!email) {
      mostrar('Escribe el correo que usaste en la compra.');
      campo.focus();
      return;
    }
    boton.disabled = true;
    boton.textContent = 'Entrando…';
    mostrar('');
    const r = await window.AMENES.entrar(email);
    if (r.ok) { location.replace('/es'); return; }
    boton.disabled = false;
    boton.textContent = TEXTO_DO_BOTAO;
    mostrar(r.error);
  });
})();
