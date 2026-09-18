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

// Popup "importante reforçar": aparece ao clicar em dias que pedem confirmação
// antes de continuar (dias 2 a 4 no MVP). SIM -> segue para o dia clicado.
// NÃO -> volta para a Introdução.
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
    window.location.href = scrim.dataset.noHref || 'dia.html?dia=0';
  });

  // Se a página for restaurada do cache do navegador (ex: ao clicar "Voltar"),
  // garante que o popup não fique preso aberto de uma visita anterior.
  window.addEventListener('pageshow', () => {
    scrim.classList.remove('open');
  });
}

// Botão flutuante "voltar ao topo": aparece depois de rolar um pouco a página
// e leva de volta ao topo com rolagem suave.
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Voltar ao topo');
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

document.addEventListener('DOMContentLoaded', () => {
  initScrollFocus();
  initConfirmModal();
  initBackToTop();
});
