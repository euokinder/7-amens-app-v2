// A lista do Angelic Canticle: introdução + 7 dias, um por dia. CÓPIA do
// script do cantico.html do Brasil (via js/es/cantico-lista.js), em inglês, no
// jeito do js/en/novena.js: foto grande, número, botão de tocar e cadeado nos
// dias que ainda não abriram. Quem decide até que dia está aberto é o servidor
// (retrato.cantico.abierto, com a mesma âncora das madrugadas). Arquivo só do
// app em inglês.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const OVERLAY = 'linear-gradient(to top, oklch(0.06 0.01 40 / 0.35) 0%, transparent 45%)';
  const lockIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--card-ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const playIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="var(--dark-on-accent)"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (!window.AMENES_EXTRAS.trancarPagina(r, 'cantico')) {
    // Sem o campo (função antiga no ar), tudo aberto: a mesma rede da trava.
    const cantico = r.cantico || { abierto: 7, completados: [] };
    const lista = document.getElementById('cantico-lista');
    for (let i = 0; i <= 7; i++) {
      const dia = CANTICO[i];
      // Dia sem nada para entregar (a Introdução, como no Brasil) não aparece.
      if (!diaDelCanticoVisible(dia)) continue;
      // A Introdução (dia 0) abre junto com o Dia 1, sempre.
      const faltan = i - cantico.abierto;
      const fechado = faltan > 0;
      const cartao = document.createElement('a');
      cartao.className = `card${fechado ? ' locked' : ''}`;
      cartao.style.height = '320px';
      cartao.style.backgroundImage = `${OVERLAY}, url(${dia.imagen})`;
      if (!fechado) cartao.href = `/en-canticle-day?dia=${i}`;

      const numero = document.createElement('div');
      numero.className = 'num-badge';
      numero.textContent = String(i);
      cartao.append(numero);
      if (fechado) {
        const selo = document.createElement('div');
        selo.className = 'pill-badge';
        selo.textContent = faltan === 1 ? 'Unlocks tomorrow' : 'Coming soon';
        cartao.append(selo);
      }
      const botao = document.createElement('div');
      botao.className = 'play-btn';
      botao.innerHTML = fechado ? lockIcon : playIcon;
      const corpo = document.createElement('div');
      corpo.className = 'card-body';
      const titulo = document.createElement('h3');
      titulo.className = 'card-title';
      titulo.textContent = dia.titulo;
      const sub = document.createElement('p');
      sub.className = 'card-sub';
      sub.textContent = dia.subtitulo;
      corpo.append(titulo, sub);
      cartao.append(botao, corpo);
      if (cantico.completados.includes(i)) {
        const feito = document.createElement('span');
        feito.className = 'member-done';
        feito.textContent = '✓ Day completed';
        cartao.append(feito);
      }
      lista.append(cartao);
    }
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
