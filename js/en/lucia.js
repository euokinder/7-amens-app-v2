// A Lucy (nome provisório; no espanhol, Lucía), o chat de suporte do app em
// inglês. Arquivo só do app dos EUA: nenhuma página do Brasil nem do espanhol
// carrega este arquivo.
//
// Quem conversa é a função en-chat (supabase/functions/en-chat). Aqui
// fica só a tela: o botão "Questions? Talk to Lucy", a conversa em tela
// cheia (no celular), os pontinhos de "typing", os atalhos para quem não
// gosta de digitar e os botões do WhatsApp e do e-mail quando ela passa o
// caso à equipe.
//
// O card "Contact us" do início abre a Lucy (em vez de um e-mail vazio). Se a
// função responder { desligado: true } (interruptor desligado no banco), a
// Lucy avisa e mostra o WhatsApp e o e-mail.
//
// ⏳ EUA: o suporte americano (e-mail e WhatsApp) ainda não existe
// (js/en/config.js). Enquanto isso:
//   - quando ela passa o caso à equipe, a en-chat já guardou o caso, com o
//     contato que a cliente confirmou; a tela diz isso, sem botões;
//   - com o chat desligado, a Lucy pede para tentar de novo mais tarde.
//
// Chaves do navegador: amens-en.lucia (a conversa das últimas 24 h).
(function () {
  const CFG = window.AMENES_CONFIG || {};
  if (!CFG.chat) return;

  const CLAVE = 'amens-en.lucia';
  const SESION = 'amens-en.sesion';
  const VIDA = 24 * 60 * 60 * 1000;
  const MAX = 600;
  // 'entrar' e 'app' são valores que a en-chat lê: não traduzir.
  const pagina = /en-login/.test(location.pathname) ? 'entrar' : 'app';

  // Os contatos da equipe (⏳ EUA: vazios até o Arthur mandar).
  const linkWhatsapp = texto => (typeof CFG.whatsapp === 'function' ? CFG.whatsapp(texto) : '');
  const temWhatsapp = Boolean(linkWhatsapp(''));
  const temCorreo = Boolean(CFG.correo);
  const temEquipe = temWhatsapp || temCorreo;

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
      const guardado = JSON.parse(sessionStorage.getItem('amens-en.retrato') || 'null');
      return (guardado && guardado.retrato && guardado.retrato.cliente && guardado.retrato.cliente.nombre) || '';
    } catch { return ''; }
  }

  // O atalho que só põe o cursor no campo (sem mandar nada).
  const OUTRA = 'Something else';
  const ATALHOS = pagina === 'entrar'
    ? ["I can't get in", "I don't know which email I used", 'I have a question about a charge', OUTRA]
    : ['When does the next prayer unlock?', 'Where is the Our Father?', 'I have a question about a charge', OUTRA];

  // ------------------------------------------------------------- a tela
  const foto = grande => CFG.luciaFoto
    ? `<img class="lucia-foto${grande ? ' grande' : ''}" src="${CFG.luciaFoto}" alt="">`
    : `<span class="lucia-foto${grande ? ' grande' : ''}" aria-hidden="true">L</span>`;

  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.className = 'lucia-abrir';
  abrir.innerHTML = `${foto(false)}<span>Questions? Talk to Lucy</span>`;

  const painel = document.createElement('div');
  painel.className = 'lucia-painel';
  painel.hidden = true;
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-modal', 'true');
  painel.setAttribute('aria-label', 'Chat with Lucy');
  painel.innerHTML = `
    <div class="lucia-topo">
      ${foto(true)}
      <div class="lucia-topo-texto">
        <div class="lucia-nome">Lucy</div>
        <div class="lucia-papel">Assistant from the 7 Amens team</div>
      </div>
      <button type="button" class="lucia-fechar">Close</button>
    </div>
    <div class="lucia-mensagens" aria-live="polite"></div>
    <form class="lucia-escrever">
      <textarea class="lucia-campo" rows="1" maxlength="${MAX}" placeholder="Type your question here" aria-label="Your message"></textarea>
      <button type="submit" class="lucia-enviar">Send</button>
    </form>
    <p class="lucia-rodape">Real people on our team read every conversation.</p>`;

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

  // Os botões para falar com a equipe: WhatsApp e e-mail, os dois com a
  // mensagem JÁ ESCRITA (o resumo que a Lucy fez, quando ela passou o caso).
  // Sem serviço de e-mail (decisão do Arthur): quem envia é o celular dela.
  // E o e-mail nunca sai vazio, porque o corpo já vem preenchido.
  // ⏳ EUA: sem contato nenhum no config, não há botão para mostrar. Se a
  // Lucy passou o caso (textoPronto preenchido), a en-chat já o guardou com o
  // contato dela, e a tela só confirma isso.
  function botoesEquipe(textoPronto) {
    if (!temEquipe) {
      if (textoPronto) {
        const guardado = document.createElement('p');
        guardado.className = 'lucia-aviso-equipe';
        guardado.textContent = 'Your message has been saved for our team. Someone will get back to you soon 🙏';
        lista.appendChild(guardado);
        rolar();
      }
      return;
    }
    const quem = nombre();
    const texto = textoPronto || `Hi, ${quem ? `my name is ${quem}` : "I'm a 7 Amens Before Dawn customer"}. I was talking with Lucy in the app and I need help from the team.`;
    const aviso = document.createElement('p');
    aviso.className = 'lucia-aviso-equipe';
    aviso.textContent = temWhatsapp && temCorreo
      ? 'Tap one of the buttons to send your message to our team. It is already written for you.'
      : 'Tap the button to send your message to our team. It is already written for you.';
    lista.appendChild(aviso);
    if (temWhatsapp) {
      const zap = document.createElement('a');
      zap.className = 'lucia-whatsapp';
      zap.href = linkWhatsapp(texto);
      zap.target = '_blank';
      zap.rel = 'noopener';
      zap.textContent = 'Send on WhatsApp';
      lista.appendChild(zap);
    }
    if (temCorreo) {
      const correo = document.createElement('a');
      correo.className = 'lucia-correo';
      correo.href = `mailto:${CFG.correo}?subject=${encodeURIComponent('Help - 7 Amens Before Dawn (Lucy)')}&body=${encodeURIComponent(texto)}`;
      correo.textContent = 'Send by email';
      lista.appendChild(correo);
    }
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
        if (texto === OUTRA) { campo.focus(); return; }
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
      el.innerHTML = '<span class="lucia-pontos" aria-hidden="true"><i></i><i></i><i></i></span><span>Lucy is typing…</span>';
      lista.appendChild(el);
      rolar();
    } else if (!liga && el) {
      el.remove();
    }
  }

  function saudacao() {
    const quem = nombre();
    return `Hi${quem ? `, ${quem}` : ''}! I'm Lucy, from the 7 Amens team 🙏 I'm here to help. What can I help you with?`;
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
  // ⏳ EUA: sem contato de suporte, o "chat desligado" não tem botões para
  // indicar; a Lucy pede para tentar de novo mais tarde.
  const FORA = temEquipe
    ? `I can't answer here right now 🙏. Please contact us with the ${temWhatsapp && temCorreo ? 'buttons' : 'button'} below, and someone from our team will help you.`
    : "I can't answer here right now 🙏. Please try again a little later.";
  const SEM_INTERNET = "I couldn't send your message. Please check your internet and try again 🙏";

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
    if (token) headers['x-en-session'] = token;
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

  // O card "Contact us" do início abre a Lucy (e não o e-mail vazio).
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

  // Para outras telas abrirem a Lucy (ex.: o "We couldn't find" da entrada).
  window.LUCIA = { abrir: abrirConversa };
})();
