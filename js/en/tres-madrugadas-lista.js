// A lista de Three Mornings of Intercession. CÓPIA do js/es/tres-madrugadas-lista.js
// (que copia o script do tres-madrugadas.html do Brasil), em inglês
// (23/11/2026), no jeito do js/en/cantico-lista.js: foto grande, número e
// botão de tocar. As três sempre abertas (o rito é por nome). Arquivo só do
// app em inglês.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const OVERLAY = 'linear-gradient(to top, oklch(0.06 0.01 40 / 0.35) 0%, transparent 45%)';
  const playIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="var(--dark-on-accent)"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  if (!window.AMENES_EXTRAS.trancarPagina(r, 'tres_madrugadas')) {
    const lista = document.getElementById('tres-madrugadas-lista');
    for (let i = 1; i <= 3; i++) {
      const madrugada = TRES_MADRUGADAS[i];
      const cartao = document.createElement('a');
      cartao.className = 'card';
      cartao.style.height = '320px';
      cartao.style.backgroundImage = `${OVERLAY}, url(${madrugada.imagen})`;
      cartao.href = `/en-three-mornings-video?m=${i}`;

      const numero = document.createElement('div');
      numero.className = 'num-badge';
      numero.textContent = madrugada.numero;
      cartao.append(numero);
      // Vídeo ainda não pronto: o cartão abre, e a tela da madrugada avisa.
      if (!madrugada.video) {
        const selo = document.createElement('div');
        selo.className = 'pill-badge';
        selo.textContent = 'Coming soon';
        cartao.append(selo);
      }
      const botao = document.createElement('div');
      botao.className = 'play-btn';
      botao.innerHTML = playIcon;
      const corpo = document.createElement('div');
      corpo.className = 'card-body';
      const titulo = document.createElement('h3');
      titulo.className = 'card-title';
      titulo.textContent = madrugada.titulo;
      const sub = document.createElement('p');
      sub.className = 'card-sub';
      sub.textContent = madrugada.subtitulo;
      corpo.append(titulo, sub);
      cartao.append(botao, corpo);
      lista.append(cartao);
    }
  }

  // Os cartões já existem quando o efeito de foco começa (o único que tira o
  // cartão de opacity: 0.5): desenhados uma vez, nunca redesenhados depois.
  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
