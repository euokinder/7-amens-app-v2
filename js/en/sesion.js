// A sessão e a conversa com o servidor (en-api) do app em inglês.
// Arquivo só do app dos EUA: nenhuma página do Brasil nem do espanhol carrega
// este arquivo.
//
// O domínio é o mesmo do app brasileiro, então o armazenamento do navegador
// também é: tudo aqui usa chaves "amens-en.*", que o Brasil nunca lê.
//
// Economia da cota do Supabase (dividida com o Brasil): o servidor só é
// chamado ao abrir uma página, nunca de tempos em tempos. E, na mesma aba,
// o retrato da jornada que chegou há menos de 5 minutos é reaproveitado.
(function () {
  const CLAVE = 'amens-en.sesion';
  const RETRATO = 'amens-en.retrato';
  const MENSAJE = 'amens-en.mensaje';
  const VIDA_DEL_RETRATO = 5 * 60 * 1000;
  const SIN_CONEXION = "We couldn't connect. Please check your internet and try again.";

  // ⏳ EUA: sem contato de suporte (js/en/config.js), o link "Need help?" do
  // portão não teria para onde ir. As páginas (dia, lista, extras, ofertas)
  // põem nele o AMENES_CONFIG.soporte; vazio, ele fica escondido aqui, em vez
  // de recarregar a página. O início (js/en/inicio.js) decide o dele.
  if (!(window.AMENES_CONFIG && window.AMENES_CONFIG.soporte)) {
    document.querySelectorAll('.member-gate-help').forEach(link => { link.hidden = true; });
  }

  const leer = (almacen, clave) => { try { return almacen.getItem(clave) || ''; } catch { return ''; } };
  const guardar = (almacen, clave, valor) => {
    try { if (valor) almacen.setItem(clave, valor); else almacen.removeItem(clave); } catch { /* navegador sem armazenamento */ }
  };
  // O fuso do celular dela ("America/Chicago"). O servidor usa só no primeiro acesso.
  const zona = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };

  async function llamar(action, datos) {
    const token = leer(localStorage, CLAVE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-en-session'] = token;
    let respuesta;
    try {
      respuesta = await fetch(window.AMENES_CONFIG.api, {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.assign({ action, tz: zona() }, datos || {})),
      });
    } catch {
      return { ok: false, status: 0, error: SIN_CONEXION };
    }
    let cuerpo = null;
    try { cuerpo = await respuesta.json(); } catch { /* sem corpo */ }
    if (!respuesta.ok) return { ok: false, status: respuesta.status, error: (cuerpo && cuerpo.error) || SIN_CONEXION, cuerpo };
    return { ok: true, status: respuesta.status, cuerpo };
  }

  // O último retrato que esta página recebeu: é dele que sai o pop-up.
  let ultimo = null;
  const recordar = retrato => { ultimo = retrato; guardar(sessionStorage, RETRATO, JSON.stringify({ en: Date.now(), retrato })); };
  const olvidar = () => { guardar(localStorage, CLAVE, ''); guardar(sessionStorage, RETRATO, ''); };
  const soloRetrato = cuerpo => {
    const copia = Object.assign({}, cuerpo);
    delete copia.token;
    delete copia.error;
    delete copia.compra; // o resgate pelo cartão: só a tela de entrar usa
    return copia;
  };

  function irAEntrar(mensaje) {
    olvidar();
    if (mensaje) guardar(sessionStorage, MENSAJE, mensaje);
    location.replace('/en-login');
  }

  async function entrarCon(action, datos) {
    const r = await llamar(action, datos);
    if (r.ok) {
      guardar(localStorage, CLAVE, r.cuerpo.token);
      recordar(soloRetrato(r.cuerpo));
    }
    return r;
  }

  window.AMENES = {
    tieneSesion: () => Boolean(leer(localStorage, CLAVE)),
    entrar: email => entrarCon('login', { email }),
    entrarConEnlace: code => entrarCon('entry', { code }),
    // O resgate na entrada (js/en/entrar.js): pelo final do cartão + o nome,
    // e a entrada de emergência.
    buscarCompra: datos => entrarCon('buscar_compra', datos),
    entradaDeEmergencia: datos => entrarCon('entrada_emergencia', datos),
    // Logo depois de achar a compra pelo cartão, ela troca o e-mail gravado
    // (que tinha o erro) pelo dela.
    async corregirCorreo(email) {
      const r = await llamar('corregir_correo', { email });
      if (r.ok) recordar(soloRetrato(r.cuerpo));
      return r;
    },

    // O retrato da jornada: nome, hoje, até que dia está aberto, o que já rezou.
    async retrato(opciones) {
      if (!leer(localStorage, CLAVE)) { irAEntrar(); return null; }
      if (!(opciones && opciones.fresco)) {
        try {
          const guardado = JSON.parse(leer(sessionStorage, RETRATO) || 'null');
          if (guardado && Date.now() - guardado.en < VIDA_DEL_RETRATO) { ultimo = guardado.retrato; return guardado.retrato; }
        } catch { /* ignora o guardado estragado */ }
      }
      const r = await llamar('session');
      if (r.ok) { recordar(r.cuerpo); return r.cuerpo; }
      if (r.status === 401 || r.status === 403) { irAEntrar(r.error); return null; }
      throw new Error(r.error);
    },

    // "I prayed this prayer": marca (done = true) ou desmarca um dia.
    async marcar(dia, done) {
      const r = await llamar('progress', { day: dia, done });
      if (r.ok) { recordar(r.cuerpo); return { ok: true, retrato: r.cuerpo }; }
      if (r.status === 401 || r.status === 403) { irAEntrar(r.error); return { ok: false }; }
      if (r.status === 409 && r.cuerpo) recordar(soloRetrato(r.cuerpo));
      return { ok: false, error: r.error };
    },

    // O "terminei este dia" do Angelic Canticle. O mesmo caminho do "I prayed
    // this prayer", com journey: 'cantico' (a en-api grava em en_cantico_progress).
    async marcarCantico(dia, done) {
      const r = await llamar('progress', { day: dia, done, journey: 'cantico' });
      if (r.ok) { recordar(r.cuerpo); return { ok: true, retrato: r.cuerpo }; }
      if (r.status === 401 || r.status === 403) { irAEntrar(r.error); return { ok: false }; }
      if (r.status === 409 && r.cuerpo) recordar(soloRetrato(r.cuerpo));
      return { ok: false, error: r.error };
    },

    async salir() {
      await llamar('logout');
      olvidar();
      location.replace('/en-login');
    },

    // O painel do app em inglês (/en-admin): uma ação admin_* da en-api.
    // Devolve a resposta ou lança o erro do servidor, para a tela mostrar.
    async admin(action, datos) {
      const r = await llamar(action, datos);
      if (r.ok) return r.cuerpo;
      if (r.status === 401) { irAEntrar(r.error); throw new Error(r.error); }
      throw new Error(r.error || 'Could not complete this action.');
    },

    // O pop-up (js/en/oferta.js): "apareceu", "tocou" ou "fechou". Só conta,
    // não muda nada dela; falhar não atrapalha.
    registrarOferta(campaign_key, event) {
      return llamar('oferta', { campaign_key, event }).catch(() => null);
    },
    // Depois que o pop-up aparece, ele sai do retrato guardado: sem isto, a
    // próxima página aberta nos 5 minutos seguintes mostraria o mesmo pop-up.
    quitarOferta() {
      if (ultimo) ultimo.oferta = null;
      try {
        const guardado = JSON.parse(leer(sessionStorage, RETRATO) || 'null');
        if (guardado && guardado.retrato && guardado.retrato.oferta) {
          guardado.retrato.oferta = null;
          guardar(sessionStorage, RETRATO, JSON.stringify(guardado));
        }
      } catch { /* sem armazenamento */ }
    },

    mensajePendiente() {
      const mensaje = leer(sessionStorage, MENSAJE);
      guardar(sessionStorage, MENSAJE, '');
      return mensaje;
    },

    // ----------------------------------------------------- a trava, para a tela
    // Quem decide o que está aberto é o servidor (retrato.abierto). Aqui só se
    // traduz isso em palavras. "Unlocks tomorrow" é a frase que o padre diz no
    // vídeo de boas-vindas: não mudar.
    estado(retrato, dia) {
      if (retrato.completados.includes(dia)) return { tipo: 'hecho', texto: dia === 0 ? '✓ You already read this' : '✓ You already prayed this Amen' };
      if (dia <= retrato.abierto) return { tipo: 'abierta', texto: dia === 0 ? 'Read this first' : 'Open: you can pray it now' };
      const faltan = dia - retrato.abierto;
      return { tipo: 'cerrada', texto: faltan === 1 ? '🔒 Unlocks tomorrow' : `🔒 Unlocks in ${faltan} days`, faltan };
    },

    // A oração sugerida para agora: o Start Here enquanto ela não começou;
    // depois, o primeiro dia aberto que ela ainda não marcou.
    sugerido(retrato) {
      const hechos = retrato.completados;
      const empezo = hechos.some(dia => dia >= 1);
      if (!empezo && !hechos.includes(0)) return 0;
      for (let dia = 1; dia <= retrato.abierto; dia += 1) if (!hechos.includes(dia)) return dia;
      return null;
    },

    rezados: retrato => retrato.completados.filter(dia => dia >= 1).length,

    // O portão "Checking your access…", como no app brasileiro: a página fica
    // escondida (html.member-checking) até a sessão responder.
    mostrarTela() {
      document.documentElement.classList.remove('member-checking');
      const portao = document.getElementById('member-gate');
      if (portao) portao.remove();
      // O pop-up de oferta, como no Brasil. Só nas páginas que carregam
      // js/en/oferta.js (início, lista e dia); nunca nas páginas de venda.
      if (window.AMENES_POPUP && ultimo && ultimo.oferta) window.AMENES_POPUP.mostrar(ultimo.oferta);
    },
    falhaNoPortao(mensaje) {
      const portao = document.getElementById('member-gate');
      if (!portao) return;
      const texto = portao.querySelector('p');
      if (texto) texto.textContent = mensaje;
      if (!portao.querySelector('.member-button')) {
        const boton = document.createElement('button');
        boton.className = 'member-button';
        boton.type = 'button';
        boton.textContent = 'Try again';
        boton.addEventListener('click', () => location.reload());
        portao.insertBefore(boton, portao.querySelector('.member-gate-help'));
      }
    },

    // Monta um pedaço da tela. Texto sempre por textContent, nunca innerHTML:
    // o nome dela vem do cadastro da compra e não pode virar código na página.
    el(tag, atributos, ...filhos) {
      const nodo = document.createElement(tag);
      for (const [clave, valor] of Object.entries(atributos || {})) {
        if (valor === null || valor === undefined || valor === false) continue;
        if (clave === 'text') nodo.textContent = valor;
        else if (clave === 'class') nodo.className = valor;
        else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
        else nodo.setAttribute(clave, valor === true ? '' : valor);
      }
      for (const filho of filhos) if (filho !== null && filho !== undefined && filho !== false && filho !== '') nodo.append(filho);
      return nodo;
    },
  };
})();
