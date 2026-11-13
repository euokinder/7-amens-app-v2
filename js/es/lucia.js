// A Lucía, o chat de suporte do app em espanhol (12/11/2026).
// Arquivo só da LATAM: nenhuma página do Brasil carrega este arquivo.
//
// Quem conversa é a função latam-chat (supabase/functions/latam-chat). Aqui
// fica só a tela: o botão "¿Dudas? Habla con Lucía", a conversa em tela
// cheia (no celular), os pontinhos de "escribiendo", os atalhos para quem não
// gosta de digitar e o botão do WhatsApp quando ela passa o caso à equipe.
//
// Toma o lugar do botão "Escríbenos" (que abria o e-mail do celular e chegava
// VAZIO ao suporte). Se a função responder { desligado: true } (interruptor
// desligado no banco), a Lucía avisa e mostra o WhatsApp e o e-mail.
//
// Chaves do navegador: amenes-es.lucia (a conversa das últimas 24 h).
(function () {
  const CFG = window.AMENES_CONFIG || {};
  if (!CFG.chat) return;

  const CLAVE = 'amenes-es.lucia';
  const SESION = 'amenes-es.sesion';
  const VIDA = 24 * 60 * 60 * 1000;
  const MAX = 600;
  const pagina = /es-entrar/.test(location.pathname) ? 'entrar' : 'app';

  const leer = (almacen, clave) => { try { return almacen.getItem(clave) || ''; } catch { return ''; } };
  const guardarEstado = estado => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sem armazenamento */ } };
  function cargarEstado() {
    try {
      const estado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (estado && Date.now() - estado.en < VIDA && Array.isArray(estado.mensajes)) return estado;
    } catch { /* nada guardado */ }
    return { en: Date.now(), conversa: '', mensajes: [] };
  }
  let estado = cargarEstado();

  function nombre() {
    try {
      const guardado = JSON.parse(sessionStorage.getItem('amenes-es.retrato') || 'null');
      return (guardado && guardado.retrato && guardado.retrato.cliente && guardado.retrato.cliente.nombre) || '';
    } catch { return ''; }
  }

  const ATALHOS = pagina === 'entrar'
    ? ['No puedo entrar', 'No sé qué correo usé', 'Tengo una duda con un cobro', 'Otra duda']
    : ['¿Cuándo se abre la próxima oración?', '¿Dónde está el Padre Nuestro?', 'Tengo una duda con un cobro', 'Otra duda'];

  // ------------------------------------------------------------- a tela
  const foto = grande => CFG.luciaFoto
    ? `<img class="lucia-foto${grande ? ' grande' : ''}" src="${CFG.luciaFoto}" alt="">`
    : `<span class="lucia-foto${grande ? ' grande' : ''}" aria-hidden="true">L</span>`;

  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'lucia-abrir';
  abrir.innerHTML = `${foto(false)}<span>¿Dudas? Habla con Lucía</span>`;

  const painel = document.createElement('div');
  painel.className = 'lucia-painel';
  painel.hidden = true;
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-modal', 'true');
  painel.setAttribute('aria-label', 'Conversación con Lucía');
  painel.innerHTML = `
    <div class="lucia-topo">
      ${foto(true)}
      <div class="lucia-topo-texto">
        <div class="lucia-nome">Lucía</div>
        <div class="lucia-papel">Asistente del equipo de 7 Amenes</div>
      </div>
      <button type="button" class="lucia-fechar">Cerrar</button>
    </div>
    <div class="lucia-mensagens" aria-live="polite"></div>
    <form class="lucia-escrever">
      <textarea class="lucia-campo" rows="1" maxlength="${MAX}" placeholder="Escribe tu duda aquí" aria-label="Tu mensaje"></textarea>
      <button type="submit" class="lucia-enviar">Enviar</button>
    </form>
    <p class="lucia-rodape">Personas del equipo leen cada conversación.</p>`;

  const lista = painel.querySelector('.lucia-mensagens');
  const form = painel.querySelector('.lucia-escrever');
  const campo = painel.querySelector('.lucia-campo');
  const enviar = painel.querySelector('.lucia-enviar');
  let ocupada = false;

  function rolar() { lista.scrollTop = lista.scrollHeight; }

  // Texto puro (nunca HTML), com os endereços do site viram link.
  function balao(texto, quem) {
    const div = document.createElement('div');
    div.className = `lucia-msg ${quem}`;
    const partes = String(texto).split(/((?:https?:\/\/)?setemadrugadas\.com\.br\/[\w\-/#.]*)/g);
    partes.forEach((parte, i) => {
      if (i % 2 === 1) {
        const a = document.createElement('a');
        a.href = parte.startsWith('http') ? parte : `https://${parte}`;
        a.textContent = parte.replace(/^https?:\/\//, '');
        div.appendChild(a);
      } else if (parte) {
        div.appendChild(document.createTextNode(parte));
      }
    });
    lista.appendChild(div);
    rolar();
  }

  // Os dois botões para falar com a equipe: WhatsApp e e-mail, os dois com a
  // mensagem JÁ ESCRITA (o resumo que a Lucía fez, quando ela passou o caso).
  // Sem serviço de e-mail (decisão do Arthur, 13/11): quem envia é o celular
  // dela. E o e-mail nunca sai vazio, porque o corpo já vem preenchido.
  function botoesEquipe(textoPronto) {
    const quem = nombre();
    const texto = textoPronto || `Hola, soy ${quem || 'clienta de 7 Amenes de la Madrugada'}. Estaba hablando con Lucía en la app y necesito ayuda del equipo.`;
    const aviso = document.createElement('p');
    aviso.className = 'lucia-aviso-equipe';
    aviso.textContent = 'Toca uno de los botones para enviar tu mensaje al equipo. Ya está escrito.';
    lista.appendChild(aviso);
    const zap = document.createElement('a');
    zap.className = 'lucia-whatsapp';
    zap.href = CFG.whatsapp ? CFG.whatsapp(texto) : '#';
    zap.target = '_blank';
    zap.rel = 'noopener';
    zap.textContent = 'Enviar por WhatsApp';
    lista.appendChild(zap);
    const correo = document.createElement('a');
    correo.className = 'lucia-correo';
    correo.href = `mailto:${CFG.correo || 'soporte@pkscale.com'}?subject=${encodeURIComponent('Ayuda - 7 Amenes de la Madrugada (Lucía)')}&body=${encodeURIComponent(texto)}`;
    correo.textContent = 'Enviar por correo';
    lista.appendChild(correo);
    rolar();
  }

  function atalhos() {
    const caixa = document.createElement('div');
    caixa.className = 'lucia-atalhos';
    ATALHOS.forEach(texto => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lucia-atalho';
      b.textContent = texto;
      b.addEventListener('click', () => {
        caixa.remove();
        if (texto === 'Otra duda') { campo.focus(); return; }
        mandar(texto);
      });
      caixa.appendChild(b);
    });
    lista.appendChild(caixa);
    rolar();
  }

  function digitando(liga) {
    let el = lista.querySelector('.lucia-digitando');
    if (liga && !el) {
      el = document.createElement('div');
      el.className = 'lucia-digitando';
      el.innerHTML = '<span class="lucia-pontos" aria-hidden="true"><i></i><i></i><i></i></span><span>Lucía está escribiendo…</span>';
      lista.appendChild(el);
      rolar();
    } else if (!liga && el) {
      el.remove();
    }
  }

  function saudacao() {
    const quem = nombre();
    return `¡Hola${quem ? `, ${quem}` : ''}! Soy Lucía, del equipo de 7 Amenes 🙏 Estoy aquí para ayudarte. ¿En qué te puedo ayudar?`;
  }

  function desenhar() {
    lista.innerHTML = '';
    balao(saudacao(), 'lucia');
    estado.mensajes.forEach(m => {
      if (m.tipo === 'equipe' || m.tipo === 'whatsapp') botoesEquipe(m.texto || '');
      else balao(m.texto, m.quem);
    });
    if (!estado.mensajes.length) atalhos();
  }

  function guardar(mensaje) {
    estado.mensajes.push(mensaje);
    estado.mensajes = estado.mensajes.slice(-40);
    estado.en = Date.now();
    guardarEstado(estado);
  }

  // ------------------------------------------------------- a conversa
  const FORA = 'Ahora mismo no puedo responder por aquí 🙏. Escríbenos por WhatsApp o por correo, con los botones de abajo, y una persona del equipo te ayuda.';
  const SEM_INTERNET = 'No pude enviar tu mensaje. Revisa tu internet y vuelve a intentarlo 🙏';

  async function mandar(texto) {
    const mensagem = String(texto || '').trim().slice(0, MAX);
    if (!mensagem || ocupada) return;
    ocupada = true;
    enviar.disabled = true;
    lista.querySelector('.lucia-atalhos')?.remove();
    balao(mensagem, 'dela');
    guardar({ quem: 'dela', texto: mensagem });
    digitando(true);
    const headers = { 'Content-Type': 'application/json' };
    const token = leer(localStorage, SESION);
    if (token) headers['x-latam-session'] = token;
    let cuerpo = null;
    try {
      const resposta = await fetch(CFG.chat, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mensaje: mensagem, conversa: estado.conversa || undefined, pagina }),
      });
      cuerpo = await resposta.json().catch(() => null);
    } catch { cuerpo = null; }
    digitando(false);
    if (!cuerpo) {
      balao(SEM_INTERNET, 'lucia');
    } else if (cuerpo.desligado) {
      balao(FORA, 'lucia');
      guardar({ quem: 'lucia', texto: FORA });
      botoesEquipe('');
      guardar({ tipo: 'equipe', texto: '' });
    } else {
      if (cuerpo.conversa) estado.conversa = cuerpo.conversa;
      const respuesta = cuerpo.resposta || cuerpo.error || SEM_INTERNET;
      balao(respuesta, 'lucia');
      guardar({ quem: 'lucia', texto: respuesta });
      if (cuerpo.equipe && cuerpo.equipe.whatsapp) {
        const texto = typeof cuerpo.equipe.texto === 'string' ? cuerpo.equipe.texto : '';
        botoesEquipe(texto);
        guardar({ tipo: 'equipe', texto });
      }
    }
    ocupada = false;
    enviar.disabled = false;
  }

  function abrirConversa() {
    estado = cargarEstado();
    desenhar();
    painel.hidden = false;
    abrir.hidden = true;
    document.body.classList.add('lucia-aberta');
    setTimeout(() => campo.focus({ preventScroll: true }), 50);
  }
  function fecharConversa() {
    painel.hidden = true;
    abrir.hidden = false;
    document.body.classList.remove('lucia-aberta');
    abrir.focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const texto = campo.value;
    campo.value = '';
    campo.style.height = '';
    mandar(texto);
  });
  campo.addEventListener('input', () => {
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, 140)}px`;
  });
  campo.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  abrir.addEventListener('click', abrirConversa);
  painel.querySelector('.lucia-fechar').addEventListener('click', fecharConversa);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !painel.hidden) fecharConversa(); });

  // O cartão "Escríbenos" da home passa a abrir a Lucía (e não o e-mail vazio).
  function ligarCartao() {
    const cartao = document.getElementById('card-ayuda');
    if (!cartao) return;
    cartao.addEventListener('click', event => { event.preventDefault(); abrirConversa(); });
  }

  function montar() {
    document.body.appendChild(abrir);
    document.body.appendChild(painel);
    document.body.classList.add('lucia-com-botao');
    ligarCartao();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  // Para outras telas abrirem a Lucía (ex.: o "No encontramos" da entrada).
  window.LUCIA = { abrir: abrirConversa };
})();
