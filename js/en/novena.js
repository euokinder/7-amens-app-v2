// A lista das 7 madrugadas ("7 mornings"), no mesmo desenho do novena.html do
// Brasil: foto grande, número, botão de tocar e cadeado nos dias que ainda
// não abriram. Quem decide o que está aberto é o servidor (retrato.abierto).
// Arquivo só dos EUA (cópia traduzida do js/es/novena.js).
(async function () {
  const D = window.AMENES_DIAS;
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;

  // As fotos dos cards são as mesmas do app brasileiro (sem texto embutido).
  const FOTOS = [
    '/assets/images/dia-0-introducao.jpg',
    '/assets/images/dia-1-pai-nosso.jpg',
    '/assets/images/dia-2-perdao.jpg',
    '/assets/images/dia-3-cura.jpg',
    '/assets/images/dia-4-libertacao.jpg',
    '/assets/images/dia-5-prosperidade.jpg',
    '/assets/images/dia-6-paz.jpg',
    '/assets/images/dia-7-alianca.jpg',
  ];
  const OVERLAY = 'linear-gradient(to top, oklch(0.06 0.01 40 / 0.35) 0%, transparent 45%)';
  // Como no Brasil: do Dia 2 em diante, um "Before you continue, please confirm".
  const PEDE_CONFIRMACAO = new Set([2, 3, 4, 5, 6, 7]);
  const lockIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--card-ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const playIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="var(--dark-on-accent)"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  const lista = document.getElementById('dias-list');
  for (let i = 0; i <= 7; i++) {
    const d = D.dias[i];
    const estado = window.AMENES.estado(r, i);
    const fechado = estado.tipo === 'cerrada';
    const cartao = document.createElement('a');
    cartao.className = `card${fechado ? ' locked' : ''}`;
    cartao.style.height = '320px';
    cartao.style.backgroundImage = `${OVERLAY}, url(${FOTOS[i]})`;
    if (!fechado) cartao.href = `/en-day?dia=${i}`;
    if (!fechado && PEDE_CONFIRMACAO.has(i) && estado.tipo !== 'hecho') cartao.dataset.confirm = 'true';

    const numero = document.createElement('div');
    numero.className = 'num-badge';
    numero.textContent = String(i);
    cartao.append(numero);
    if (fechado) {
      const selo = document.createElement('div');
      selo.className = 'pill-badge';
      selo.textContent = estado.faltan === 1 ? 'Unlocks tomorrow' : 'Coming soon';
      cartao.append(selo);
    }
    const botao = document.createElement('div');
    botao.className = 'play-btn';
    botao.innerHTML = fechado ? lockIcon : playIcon;
    const corpo = document.createElement('div');
    corpo.className = 'card-body';
    const titulo = document.createElement('h3');
    titulo.className = 'card-title';
    titulo.textContent = i === 0 ? 'Start Here' : d.titulo;
    const sub = document.createElement('p');
    sub.className = 'card-sub';
    sub.textContent = i === 0 ? 'Read this before your first morning' : d.subtitulo;
    corpo.append(titulo, sub);
    cartao.append(botao, corpo);
    if (estado.tipo === 'hecho') {
      const feito = document.createElement('span');
      feito.className = 'member-done';
      feito.textContent = i === 0 ? '✓ Read' : '✓ Prayed';
      cartao.append(feito);
    }
    lista.append(cartao);
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
