// A entrada do app em inglês: pelo e-mail da compra ou pelo link de entrada.
// No desenho da tela de entrar do Brasil (login.html). Arquivo só do app dos EUA.
//
// O RESGATE, para quem não acha o e-mail da compra. O público é idoso, e a
// decisão do Caio é que nenhuma fique sem saída. Os passos (cada um é uma
// <section data-paso> do en-login.html):
//   correo     o e-mail. A en-api já corrige sozinha os erros comuns
//              (gmial.com, .con) e acha a compra gravada com erro (gmsil.com)
//   nombre     não achou: "Don't worry, your purchase is safe". Pede o nome
//   tarjeta    os 4 últimos números do cartão (buscar_compra)
//   encontrada achou pelo cartão: mostra o e-mail da compra e oferece trocar
//   emergencia nada achou: nome + e-mail ou telefone, e ela entra na hora
// Uma pergunta por tela, nada em vermelho, sempre um próximo passo. O botão
// "voltar" do celular volta um passo (history), em vez de sair da página.
(function () {
  const pasos = Array.from(document.querySelectorAll('[data-paso]'));
  const porId = id => document.getElementById(id);
  const cfg = window.AMENES_CONFIG;
  const conLetras = texto => /[A-Za-zÀ-ÿ]{2,}/.test(texto);
  const limpo = texto => String(texto || '').replace(/\s+/g, ' ').trim();
  const BOTON_SIN_TARJETA = '“I\'d rather not use my card”';

  // A saída quando a en-api não conhece a ação (ver o passo 5).
  // ⏳ EUA: sem contato de suporte no config, pede para tentar de novo.
  function textoDeSoporte() {
    if (cfg.whatsappEscrito && cfg.correo) return `Message us on WhatsApp (${cfg.whatsappEscrito}) or email ${cfg.correo}, and we'll help you today.`;
    if (cfg.whatsappEscrito) return `Message us on WhatsApp (${cfg.whatsappEscrito}) and we'll help you today.`;
    if (cfg.correo) return `Email us at ${cfg.correo} and we'll help you today.`;
    return "We couldn't let you in right now. Please try again in a few minutes.";
  }

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
      nota.textContent = ultimo ? `We couldn't find a purchase with the email ${ultimo}.` : '';
      if (ella.nombre && !porId('nombre').value) porId('nombre').value = ella.nombre;
    }
    if (paso === 'tarjeta') {
      const primero = limpo(ella.nombre).split(' ')[0];
      porId('titulo-tarjeta').textContent = primero && conLetras(primero)
        ? `${primero.charAt(0).toUpperCase()}${primero.slice(1)}, let's find your purchase`
        : "Let's find your purchase";
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

  // O suporte, em todos os passos: o WhatsApp, com a mensagem já escrita com
  // o que ela contou até aqui (a equipe já sabe quem é e o que ela tentou), e
  // o e-mail escrito. O link é refeito no toque, porque o nome e o e-mail
  // chegam depois de a página abrir.
  // ⏳ EUA: o bloco nasce escondido no en-login.html; aqui só aparece o que
  // existir em js/en/config.js. Sem nenhum contato, o bloco fica escondido.
  const botonWhatsapp = porId('boton-whatsapp');
  function mensajeDeAyuda() {
    const partes = ['Hi, I need help getting into my 7 Amens Before Dawn app.'];
    if (ella.nombre) partes.push(`My name is ${ella.nombre}.`);
    if (ella.correos.length) partes.push(`I tried the email ${ella.correos[ella.correos.length - 1]}.`);
    return partes.join(' ');
  }
  const temWhatsapp = Boolean(cfg.whatsapp(''));
  if (temWhatsapp) {
    botonWhatsapp.href = cfg.whatsapp(mensajeDeAyuda());
    botonWhatsapp.hidden = false;
    botonWhatsapp.addEventListener('click', () => { botonWhatsapp.href = cfg.whatsapp(mensajeDeAyuda()); });
    porId('whatsapp-escrito').textContent = cfg.whatsappEscrito;
    porId('whatsapp-escrito').hidden = !cfg.whatsappEscrito;
  }
  if (cfg.correo) {
    porId('correo-escrito').textContent = cfg.correo;
    if (!temWhatsapp) porId('correo-rotulo').textContent = 'Email us at:';
    porId('linha-correo').hidden = false;
  }
  porId('bloque-suporte').hidden = !(temWhatsapp || cfg.correo);

  // ------------------------------------------------------- 1. o e-mail
  const form = porId('form-entrar');
  const campo = porId('correo');
  const boton = form.querySelector('button');
  const aviso = porId('aviso');

  const pendiente = window.AMENES.mensajePendiente();
  if (pendiente) mostrar(aviso, pendiente);

  // Link de entrada: /en-login#CÓDIGO (16 letras e números). O código vem
  // depois do "#" de propósito: essa parte nunca sai do celular para o
  // servidor do site nem para o "de onde veio" da página seguinte.
  // Também quando o link é tocado com esta página já aberta: aí o navegador
  // só troca o "#", sem recarregar.
  function probarEnlace() {
    const codigo = location.hash.slice(1);
    if (!/^[A-Za-z0-9]{16}$/.test(codigo)) return false;
    history.replaceState(null, '', location.pathname);
    ocupado(boton, 'Signing in…');
    mostrar(aviso, 'Signing you in with your link…');
    window.AMENES.entrarConEnlace(codigo).then(r => {
      if (r.ok) { location.replace('/en'); return; }
      ocupado(boton, '');
      mostrar(aviso, r.error);
    });
    return true;
  }
  window.addEventListener('hashchange', probarEnlace);
  if (!probarEnlace() && !pendiente && window.AMENES.tieneSesion()) location.replace('/en');

  porId('boton-ayuda').addEventListener('click', () => abrir('nombre'));

  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const valor = campo.value.trim();
    if (!valor) {
      mostrar(aviso, 'Please type the email you used for your purchase.');
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
    ocupado(boton, 'Signing in…');
    mostrar(aviso, '');
    const r = await window.AMENES.entrar(valor);
    if (r.ok) { location.replace('/en'); return; }
    ocupado(boton, '');
    // Não achou a compra: segue para o resgate. A en-api manda
    // `siguiente: 'nombre'` nesse caso; o acesso vencido vem sem ele e mostra
    // a mensagem do servidor. (No espanhol havia também uma conferência pelo
    // texto, /terminó/, para a função antiga sem `siguiente`; a en-api já
    // nasceu com o campo, e o texto vai ser traduzido, então ela saiu.)
    const naoAchou = r.status === 403 && Boolean(r.cuerpo) && r.cuerpo.siguiente === 'nombre';
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
      mostrar(porId('aviso-nombre'), 'Please type your name to continue.');
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
      mostrar(avisoTarjeta, 'Please type only the last 4 digits of your card.');
      digitos.focus();
      return;
    }
    ocupado(buscar, 'Looking for your purchase…');
    mostrar(avisoTarjeta, '');
    // O mais recente primeiro: é o que a tela oferece para trocar.
    const r = await window.AMENES.buscarCompra({ nombre: ella.nombre, final, correos: ella.correos.slice().reverse() });
    ocupado(buscar, '');
    if (r.ok) {
      digitos.value = '';
      const compra = r.cuerpo && r.cuerpo.compra;
      if (compra && compra.correo) mostrarEncontrada(compra);
      else location.replace('/en');
      return;
    }
    if (r.status === 404) {
      intentos += 1;
      mostrar(avisoTarjeta, intentos >= 2
        ? `We couldn't find it this time either. Tap ${BOTON_SIN_TARJETA} and come in right now.`
        : `We couldn't find a purchase with that card and that name. Check the digits, or tap ${BOTON_SIN_TARJETA} to come in now.`);
      return;
    }
    if (r.status === 429) {
      mostrar(avisoTarjeta, `There were too many tries in a row. Tap ${BOTON_SIN_TARJETA} to come in now.`);
      return;
    }
    // Sem internet, ou a busca ainda não está no ar.
    mostrar(avisoTarjeta, r.status === 0 ? r.error : `We couldn't search right now. Tap ${BOTON_SIN_TARJETA} to come in.`);
  });

  // ------------------------------------------ 4. achou pelo cartão
  const botonCorregir = porId('boton-corregir');
  const botonEntrarYa = porId('boton-entrar-ya');
  function mostrarEncontrada(compra) {
    // A conta criada só com telefone não tem e-mail de verdade para mostrar
    // (a en-api grava um endereço falso, @sin-correo.invalid).
    porId('correo-guardado').textContent = /@sin-correo\.invalid$/.test(compra.correo) ? '(no email)' : compra.correo;
    const sugerido = compra.sugerido || '';
    porId('bloque-corregir').hidden = !sugerido;
    porId('correo-sugerido').textContent = sugerido;
    botonCorregir.dataset.correo = sugerido;
    // Com a troca oferecida, o "Yes" é o botão principal, e entrar sem trocar
    // vira o botão de borda.
    botonEntrarYa.classList.toggle('es-boton-borde', Boolean(sugerido));
    botonEntrarYa.textContent = sugerido ? 'No, just sign me in' : 'Open my prayers';
    abrir('encontrada');
  }
  botonCorregir.addEventListener('click', async () => {
    ocupado(botonCorregir, 'Updating…');
    const r = await window.AMENES.corregirCorreo(botonCorregir.dataset.correo || '');
    if (r.ok) { location.replace('/en'); return; }
    ocupado(botonCorregir, '');
    mostrar(porId('aviso-encontrada'), `${r.error} You can still come in.`);
  });
  botonEntrarYa.addEventListener('click', () => location.replace('/en'));

  // ------------------------------------- 5. a entrada de emergência
  porId('form-emergencia').addEventListener('submit', async evento => {
    evento.preventDefault();
    const nombre = limpo(porId('nombre-emergencia').value);
    const contacto = porId('contacto').value.trim();
    const avisoEmergencia = porId('aviso-emergencia');
    const entrar = evento.target.querySelector('button');
    if (!conLetras(nombre)) {
      mostrar(avisoEmergencia, 'Please type your name.');
      porId('nombre-emergencia').focus();
      return;
    }
    if (!contacto.includes('@') && contacto.replace(/\D/g, '').length < 7) {
      mostrar(avisoEmergencia, 'Please type your email or phone number.');
      porId('contacto').focus();
      return;
    }
    ocupado(entrar, 'Signing in…');
    mostrar(avisoEmergencia, '');
    const r = await window.AMENES.entradaDeEmergencia({ nombre, contacto, correos: ella.correos });
    if (r.ok) { location.replace('/en'); return; }
    ocupado(entrar, '');
    // 401 ou "Invalid request" = a en-api não conhece esta ação (função
    // antiga): manda falar com o suporte. Aceita o texto em espanhol e em
    // inglês, enquanto a en-api não for traduzida.
    const funcaoAntiga = r.status === 401 || (r.status === 400 && /inválida|invalid request/i.test(r.error || ''));
    mostrar(avisoEmergencia, funcaoAntiga ? textoDeSoporte() : r.error);
  });

  history.replaceState({ paso: 'correo' }, '');
})();
