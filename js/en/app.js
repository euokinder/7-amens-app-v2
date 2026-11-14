// App em inglês: os efeitos de tela do app brasileiro, COPIADOS de js/app.js
// (via js/es/app.js), com os textos em inglês. É cópia de propósito:
// nenhuma página do Brasil nem do espanhol carrega este arquivo.
//
// Diferença para o original: no Brasil a lista de dias já existe quando a
// página termina de carregar; aqui ela só é desenhada depois que a sessão
// responde. Por isso quem liga os efeitos é a própria página, chamando
// AMENES_EFECTOS.iniciar() depois de desenhar (e não o DOMContentLoaded).
(function () {
  // Efeito de foco ao rolar: o card mais visível fica nítido, os outros ficam apagados.
  function initScrollFocus() {
    const scrollArea = document.querySelector('.content');
    const cards = document.querySelectorAll('.card:not(.static)');
    if (!scrollArea || !cards.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'scale(1)';
        } else {
          entry.target.style.opacity = '0.5';
          entry.target.style.transform = 'scale(0.96)';
        }
      });
    }, { root: null, threshold: [0, 0.6, 1] });
    cards.forEach((c) => io.observe(c));
  }

  // A confirmação antes de continuar: nos dias que pedem confirmação (2 a 4,
  // como no Brasil). Sim -> segue para o dia. Não -> volta para o Start Here.
  function initConfirmModal() {
    const scrim = document.getElementById('confirm-modal');
    if (!scrim) return;
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    let pendingHref = null;

    document.querySelectorAll('[data-confirm="true"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        pendingHref = link.getAttribute('href');
        scrim.classList.add('open');
      });
    });

    yesBtn.addEventListener('click', () => {
      scrim.classList.remove('open');
      if (pendingHref) window.location.href = pendingHref;
    });

    noBtn.addEventListener('click', () => {
      scrim.classList.remove('open');
      window.location.href = scrim.dataset.noHref || '/en-day?dia=0';
    });

    window.addEventListener('pageshow', () => {
      scrim.classList.remove('open');
    });
  }

  // Botão flutuante "Back to top".
  function initBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(btn);

    const toggle = () => {
      btn.classList.toggle('visible', window.scrollY > 400);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Luz de fundo nos cards do início: acende no card que ela está olhando.
  function initDestaqueDosCards() {
    const cards = [...document.querySelectorAll('.card-produto, .card-contato')];
    if (!cards.length) return;
    let sobMouse = null;
    let agendado = false;

    const maisPertoDoMeio = () => {
      const meio = window.innerHeight / 2;
      let escolhido = null;
      let menor = Infinity;
      cards.forEach((card) => {
        const caixa = card.getBoundingClientRect();
        if (!caixa.height) return;
        const distancia = Math.abs((caixa.top + caixa.bottom) / 2 - meio);
        if (distancia < menor) { menor = distancia; escolhido = card; }
      });
      return escolhido;
    };
    const acender = () => {
      agendado = false;
      const alvo = sobMouse || maisPertoDoMeio();
      cards.forEach((card) => card.classList.toggle('em-destaque', card === alvo));
    };
    const agendar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(acender);
    };

    window.addEventListener('scroll', () => { sobMouse = null; agendar(); }, { passive: true });
    window.addEventListener('resize', agendar);
    window.addEventListener('pageshow', agendar);
    cards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || sobMouse === card) return;
        sobMouse = card;
        agendar();
      });
      card.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'mouse' || sobMouse !== card) return;
        sobMouse = null;
        agendar();
      });
    });
    acender();
  }

  let iniciado = false;
  window.AMENES_EFECTOS = {
    iniciar() {
      if (iniciado) return;
      iniciado = true;
      initScrollFocus();
      initConfirmModal();
      initBackToTop();
      initDestaqueDosCards();
    },
  };
})();
