// A sessão e a conversa com o servidor (latam-api) do app em espanhol.
// Arquivo só da LATAM: nenhuma página do Brasil carrega este arquivo.
//
// O domínio é o mesmo do app brasileiro, então o armazenamento do navegador
// também é: tudo aqui usa chaves "amenes-es.*", que o Brasil nunca lê.
//
// Economia da cota do Supabase (dividida com o Brasil): o servidor só é
// chamado ao abrir uma página, nunca de tempos em tempos. E, na mesma aba,
// o retrato da jornada que chegou há menos de 5 minutos é reaproveitado.
(function () {
  const CLAVE = 'amenes-es.sesion';
  const RETRATO = 'amenes-es.retrato';
  const MENSAJE = 'amenes-es.mensaje';
  const VIDA_DEL_RETRATO = 5 * 60 * 1000;
  const SIN_CONEXION = 'No pudimos conectar. Revisa tu internet y vuelve a intentarlo.';

  const leer = (almacen, clave) => { try { return almacen.getItem(clave) || ''; } catch { return ''; } };
  const guardar = (almacen, clave, valor) => {
    try { if (valor) almacen.setItem(clave, valor); else almacen.removeItem(clave); } catch { /* navegador sem armazenamento */ }
  };
  // O fuso do celular dela ("America/Bogota"). O servidor usa só no primeiro acesso.
  const zona = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };

  async function llamar(action, datos) {
    const token = leer(localStorage, CLAVE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-latam-session'] = token;
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

  const recordar = retrato => guardar(sessionStorage, RETRATO, JSON.stringify({ en: Date.now(), retrato }));
  const olvidar = () => { guardar(localStorage, CLAVE, ''); guardar(sessionStorage, RETRATO, ''); };
  const soloRetrato = cuerpo => {
    const copia = Object.assign({}, cuerpo);
    delete copia.token;
    delete copia.error;
    return copia;
  };

  function irAEntrar(mensaje) {
    olvidar();
    if (mensaje) guardar(sessionStorage, MENSAJE, mensaje);
    location.replace('/es-entrar');
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

    // O retrato da jornada: nome, hoje, até que dia está aberto, o que já rezou.
    async retrato(opciones) {
      if (!leer(localStorage, CLAVE)) { irAEntrar(); return null; }
      if (!(opciones && opciones.fresco)) {
        try {
          const guardado = JSON.parse(leer(sessionStorage, RETRATO) || 'null');
          if (guardado && Date.now() - guardado.en < VIDA_DEL_RETRATO) return guardado.retrato;
        } catch { /* ignora o guardado estragado */ }
      }
      const r = await llamar('session');
      if (r.ok) { recordar(r.cuerpo); return r.cuerpo; }
      if (r.status === 401 || r.status === 403) { irAEntrar(r.error); return null; }
      throw new Error(r.error);
    },

    // "Ya recé": marca (done = true) ou desmarca um dia.
    async marcar(dia, done) {
      const r = await llamar('progress', { day: dia, done });
      if (r.ok) { recordar(r.cuerpo); return { ok: true, retrato: r.cuerpo }; }
      if (r.status === 401 || r.status === 403) { irAEntrar(r.error); return { ok: false }; }
      if (r.status === 409 && r.cuerpo) recordar(soloRetrato(r.cuerpo));
      return { ok: false, error: r.error };
    },

    async salir() {
      await llamar('logout');
      olvidar();
      location.replace('/es-entrar');
    },

    mensajePendiente() {
      const mensaje = leer(sessionStorage, MENSAJE);
      guardar(sessionStorage, MENSAJE, '');
      return mensaje;
    },

    // ----------------------------------------------------- a trava, para a tela
    // Quem decide o que está aberto é o servidor (retrato.abierto). Aqui só se
    // traduz isso em palavras.
    estado(retrato, dia) {
      if (retrato.completados.includes(dia)) return { tipo: 'hecho', texto: dia === 0 ? '✓ Ya la leíste' : '✓ Ya rezaste este Amén' };
      if (dia <= retrato.abierto) return { tipo: 'abierta', texto: dia === 0 ? 'Léela primero' : 'Abierta: puedes rezarla' };
      const faltan = dia - retrato.abierto;
      return { tipo: 'cerrada', texto: faltan === 1 ? '🔒 Se abre mañana' : `🔒 Se abre en ${faltan} días`, faltan };
    },

    // A oração sugerida para agora: o Comienza aquí enquanto ela não começou;
    // depois, o primeiro dia aberto que ela ainda não marcou.
    sugerido(retrato) {
      const hechos = retrato.completados;
      const empezo = hechos.some(dia => dia >= 1);
      if (!empezo && !hechos.includes(0)) return 0;
      for (let dia = 1; dia <= retrato.abierto; dia += 1) if (!hechos.includes(dia)) return dia;
      return null;
    },

    rezados: retrato => retrato.completados.filter(dia => dia >= 1).length,

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
