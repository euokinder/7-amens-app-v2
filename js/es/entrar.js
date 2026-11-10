// A entrada do app em espanhol: pelo e-mail da compra ou pelo link de entrada.
// No desenho da tela de entrar do Brasil (login.html). Arquivo só da LATAM.
//
// Desde 10/11/2026, O RESGATE, para quem não acha o e-mail da compra. O
// público é idoso, e a decisão do Caio é que nenhuma fique sem saída. Os
// passos (cada um é uma <section data-paso> do es-entrar.html):
//   correo     o e-mail. A latam-api já corrige sozinha os erros comuns
//              (gmial.com, .con) e acha a compra gravada com erro (gmsil.com)
//   nombre     não achou: "Tranquila, tu compra está segura". Pede o nome
//   tarjeta    os 4 últimos números do cartão (buscar_compra)
//   encontrada achou pelo cartão: mostra o e-mail da compra e oferece trocar
//   emergencia nada achou: nome + e-mail ou WhatsApp, e ela entra na hora
// Uma pergunta por tela, nada em vermelho, sempre um próximo passo. O botão
// "voltar" do celular volta um passo (history), em vez de sair da página.
(function () {
  const pasos = Array.from(document.querySelectorAll('[data-paso]'));
  const porId = id => document.getElementById(id);
  const SOPORTE = `Escríbenos por WhatsApp (${window.AMENES_CONFIG.whatsappEscrito}) o a ${window.AMENES_CONFIG.correo} y te ayudamos hoy mismo.`;
  const conLetras = texto => /[A-Za-zÀ-ÿ]{2,}/.test(texto);
  const limpo = texto => String(texto || '').replace(/\s+/g, ' ').trim();

  // O que ela já contou, para não perguntar de novo em outro passo.
  const ella = { correos: [], nombre: '', contacto: '' };

  function mostrar(aviso, texto) {
    aviso.textContent = texto || '';
  }
  function ocupado(boton, texto) {
    if (!boton.dataset.texto) boton.dataset.texto = boton.textContent;
    boton.disabled = Boolean(texto);
    boton.textContent = texto || boton.dataset.texto;
  }

  // Abre um passo. Antes, preenche o que ela já disse.
  function abrir(paso, { guardar = true } = {}) {
    if (paso === 'nombre') {
      const nota = porId('nota-correo');
      const ultimo = ella.correos[ella.correos.length - 1];
      nota.hidden = !ultimo;
      nota.textContent = ultimo ? `No encontramos una compra con el correo ${ultimo}.` : '';
      if (ella.nombre && !porId('nombre').value) porId('nombre').value = ella.nombre;
    }
    if (paso === 'tarjeta') {
      const primero = limpo(ella.nombre).split(' ')[0];
      porId('titulo-tarjeta').textContent = primero && conLetras(primero)
        ? `${primero.charAt(0).toUpperCase()}${primero.slice(1)}, vamos a encontrar tu compra`
        : 'Vamos a encontrar tu compra';
    }
    if (paso === 'emergencia') {
      if (!porId('nombre-emergencia').value) porId('nombre-emergencia').value = ella.nombre;
      if (!porId('contacto').value) porId('contacto').value = ella.contacto || ella.correos[ella.correos.length - 1] || '';
    }
    pasos.forEach(seccion => { seccion.hidden = seccion.dataset.paso !== paso; });
    if (guardar) history.pushState({ paso }, '');
    window.scrollTo(0, 0);
    // O título recebe o foco: o leitor de tela começa por ele, e o teclado do
    // celular não cobre a explicação antes de ela ler.
    const seccion = pasos.find(item => item.dataset.paso === paso);
    const titulo = seccion && seccion.querySelector('h1');
    if (titulo) titulo.focus({ preventScroll: true });
  }
  window.addEventListener('popstate', evento => {
    abrir((evento.state && evento.state.paso) || 'correo', { guardar: false });
  });
  document.querySelectorAll('[data-ir]').forEach(boton => boton.addEventListener('click', () => abrir(boton.dataset.ir)));

  // O WhatsApp do suporte (10/11/2026), com a mensagem já escrita com o que
  // ela contou até aqui: a equipe já sabe quem é e o que ela tentou. O link é
  // refeito no toque, porque o nome e o e-mail chegam depois de a página abrir.
  const botonWhatsapp = porId('boton-whatsapp');
  porId('whatsapp-escrito').textContent = window.AMENES_CONFIG.whatsappEscrito;
  function mensajeDeAyuda() {
    const partes = ['Hola, necesito ayuda para entrar a mi app 7 Amenes de la Madrugada.'];
    if (ella.nombre) partes.push(`Me llamo ${ella.nombre}.`);
    if (ella.correos.length) partes.push(`Probé con el correo ${ella.correos[ella.correos.length - 1]}.`);
    return partes.join(' ');
  }
  botonWhatsapp.href = window.AMENES_CONFIG.whatsapp(mensajeDeAyuda());
  botonWhatsapp.addEventListener('click', () => { botonWhatsapp.href = window.AMENES_CONFIG.whatsapp(mensajeDeAyuda()); });

  // ------------------------------------------------------- 1. o e-mail
  const form = porId('form-entrar');
  const campo = porId('correo');
  const boton = form.querySelector('button');
  const aviso = porId('aviso');

  const pendiente = window.AMENES.mensajePendiente();
  if (pendiente) mostrar(aviso, pendiente);

  // Link de entrada: /es-entrar#CÓDIGO (16 letras e números). O código vem
  // depois do "#" de propósito: essa parte nunca sai do celular para o
  // servidor do site nem para o "de onde veio" da página seguinte.
  // Também quando o link é tocado com esta página já aberta: aí o navegador
  // só troca o "#", sem recarregar.
  function probarEnlace() {
    const codigo = location.hash.slice(1);
    if (!/^[A-Za-z0-9]{16}$/.test(codigo)) return false;
    history.replaceState(null, '', location.pathname);
    ocupado(boton, 'Entrando…');
    mostrar(aviso, 'Entrando con tu enlace…');
    window.AMENES.entrarConEnlace(codigo).then(r => {
      if (r.ok) { location.replace('/es'); return; }
      ocupado(boton, '');
      mostrar(aviso, r.error);
    });
    return true;
  }
  window.addEventListener('hashchange', probarEnlace);
  if (!probarEnlace() && !pendiente && window.AMENES.tieneSesion()) location.replace('/es');

  porId('boton-ayuda').addEventListener('click', () => abrir('nombre'));

  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const valor = campo.value.trim();
    if (!valor) {
      mostrar(aviso, 'Escribe el correo que usaste en la compra.');
      campo.focus();
      return;
    }
    // Escreveu o nome ou o telefone no lugar do e-mail: segue para o resgate,
    // com o que ela escreveu já guardado.
    if (!valor.includes('@')) {
      if (valor.replace(/\D/g, '').length >= 7) ella.contacto = valor;
      else if (conLetras(valor)) ella.nombre = limpo(valor);
      abrir('nombre');
      return;
    }
    ocupado(boton, 'Entrando…');
    mostrar(aviso, '');
    const r = await window.AMENES.entrar(valor);
    if (r.ok) { location.replace('/es'); return; }
    ocupado(boton, '');
    // Não achou a compra: segue para o resgate. (Sem o campo `siguiente`, a
    // latam-api ainda é a de antes; o "terminó" é o acesso vencido.)
    const naoAchou = r.status === 403 && ((r.cuerpo && r.cuerpo.siguiente === 'nombre') || !/terminó/.test(r.error || ''));
    if (naoAchou) {
      ella.correos = [...ella.correos.filter(correo => correo !== valor), valor].slice(-3);
      abrir('nombre');
      return;
    }
    mostrar(aviso, r.error);
  });

  // -------------------------------------------------------- 2. o nome
  porId('form-nombre').addEventListener('submit', evento => {
    evento.preventDefault();
    const nombre = limpo(porId('nombre').value);
    if (!conLetras(nombre)) {
      mostrar(porId('aviso-nombre'), 'Escribe tu nombre para seguir.');
      porId('nombre').focus();
      return;
    }
    mostrar(porId('aviso-nombre'), '');
    ella.nombre = nombre;
    abrir('tarjeta');
  });

  // ------------------------------------------------ 3. o final do cartão
  const digitos = porId('digitos');
  const avisoTarjeta = porId('aviso-tarjeta');
  let intentos = 0;
  digitos.addEventListener('input', () => {
    const soNumeros = digitos.value.replace(/\D/g, '').slice(0, 4);
    if (soNumeros !== digitos.value) digitos.value = soNumeros;
  });
  porId('form-tarjeta').addEventListener('submit', async evento => {
    evento.preventDefault();
    const final = digitos.value.replace(/\D/g, '');
    const buscar = evento.target.querySelector('button');
    if (final.length !== 4) {
      mostrar(avisoTarjeta, 'Escribe solo los 4 últimos números de la tarjeta.');
      digitos.focus();
      return;
    }
    ocupado(buscar, 'Buscando tu compra…');
    mostrar(avisoTarjeta, '');
    // O mais recente primeiro: é o que a tela oferece para trocar.
    const r = await window.AMENES.buscarCompra({ nombre: ella.nombre, final, correos: ella.correos.slice().reverse() });
    ocupado(buscar, '');
    if (r.ok) {
      digitos.value = '';
      const compra = r.cuerpo && r.cuerpo.compra;
      if (compra && compra.correo) mostrarEncontrada(compra);
      else location.replace('/es');
      return;
    }
    if (r.status === 404) {
      intentos += 1;
      mostrar(avisoTarjeta, intentos >= 2
        ? 'Tampoco la encontramos esta vez. Toca «Prefiero no usar mi tarjeta» y entra ahora mismo.'
        : 'No encontramos una compra con esa tarjeta y ese nombre. Revisa los números, o toca «Prefiero no usar mi tarjeta» para entrar ahora.');
      return;
    }
    if (r.status === 429) {
      mostrar(avisoTarjeta, 'Hubo muchos intentos seguidos. Toca «Prefiero no usar mi tarjeta» para entrar ahora.');
      return;
    }
    // Sem internet, ou a busca ainda não está no ar.
    mostrar(avisoTarjeta, r.status === 0 ? r.error : 'No pudimos buscar ahora. Toca «Prefiero no usar mi tarjeta» para entrar.');
  });

  // ------------------------------------------ 4. achou pelo cartão
  const botonCorregir = porId('boton-corregir');
  const botonEntrarYa = porId('boton-entrar-ya');
  function mostrarEncontrada(compra) {
    // A conta criada só com WhatsApp não tem e-mail de verdade para mostrar.
    porId('correo-guardado').textContent = /@sin-correo\.invalid$/.test(compra.correo) ? '(sin correo)' : compra.correo;
    const sugerido = compra.sugerido || '';
    porId('bloque-corregir').hidden = !sugerido;
    porId('correo-sugerido').textContent = sugerido;
    botonCorregir.dataset.correo = sugerido;
    // Com a troca oferecida, o "Sí" é o botão principal, e entrar sem trocar
    // vira o botão de borda.
    botonEntrarYa.classList.toggle('es-boton-borde', Boolean(sugerido));
    botonEntrarYa.textContent = sugerido ? 'No, entrar así' : 'Entrar a mis oraciones';
    abrir('encontrada');
  }
  botonCorregir.addEventListener('click', async () => {
    ocupado(botonCorregir, 'Cambiando…');
    const r = await window.AMENES.corregirCorreo(botonCorregir.dataset.correo || '');
    if (r.ok) { location.replace('/es'); return; }
    ocupado(botonCorregir, '');
    mostrar(porId('aviso-encontrada'), `${r.error} Puedes entrar igual.`);
  });
  botonEntrarYa.addEventListener('click', () => location.replace('/es'));

  // ------------------------------------- 5. a entrada de emergência
  porId('form-emergencia').addEventListener('submit', async evento => {
    evento.preventDefault();
    const nombre = limpo(porId('nombre-emergencia').value);
    const contacto = porId('contacto').value.trim();
    const avisoEmergencia = porId('aviso-emergencia');
    const entrar = evento.target.querySelector('button');
    if (!conLetras(nombre)) {
      mostrar(avisoEmergencia, 'Escribe tu nombre.');
      porId('nombre-emergencia').focus();
      return;
    }
    if (!contacto.includes('@') && contacto.replace(/\D/g, '').length < 7) {
      mostrar(avisoEmergencia, 'Escribe tu correo o tu número de WhatsApp.');
      porId('contacto').focus();
      return;
    }
    ocupado(entrar, 'Entrando…');
    mostrar(avisoEmergencia, '');
    const r = await window.AMENES.entradaDeEmergencia({ nombre, contacto, correos: ella.correos });
    if (r.ok) { location.replace('/es'); return; }
    ocupado(entrar, '');
    // 401 ou "Solicitud inválida" = a latam-api ainda é a de antes do resgate
    // (ela não conhece esta ação): manda escrever ao suporte.
    const funcaoAntiga = r.status === 401 || (r.status === 400 && /inválida/.test(r.error || ''));
    mostrar(avisoEmergencia, funcaoAntiga ? SOPORTE : r.error);
  });

  history.replaceState({ paso: 'correo' }, '');
})();
