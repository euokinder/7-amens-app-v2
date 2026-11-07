// O TOCADOR DE ÁUDIO DO APP EM ESPANHOL. CÓPIA do js/tocador.js do Brasil
// (07/11/2026), com os rótulos em espanhol. Arquivo só da LATAM: nenhuma
// página do Brasil carrega este arquivo, e mudar o Brasil não muda este.
//
// Quem usa: es-oracion-arcangel (as 12 orações dos Arcángeles) e
// es-cantico-dia (os 7 dias do Cántico Angelical).
//
// Os controles, os mesmos do Brasil (pensados para quem tem 45+ e está no
// celular): volver al inicio · retroceder 10 s · tocar/pausar · adelantar
// 10 s · velocidad (1x, 1.5x, 2x, guardada no aparelho). Na tela bloqueada do
// celular, o áudio aparece com o nome da oração (Media Session).
//
// O áudio vem da Bunny, pelo endereço completo escrito em js/es/arcangeles.js
// e js/es/cantico.js. Diferente do Brasil, não existe cópia no site: os áudios
// em espanhol nunca passam pela Netlify (crédito).
//
// Uso, em cada tela:
//   TOCADOR.html(endereco, rotulo)            devolve o quadro pronto
//   TOCADOR.ligar(quadro, { titulo, album })  liga os botões, depois que o
//                                             quadro já está na tela
(function () {
  'use strict';

  const PASSO = 10; // segundos de "voltar" e "avançar"
  const VELOCIDADES = [1, 1.5, 2];
  const CHAVE_DA_VELOCIDADE = 'amenes-es.tocador.velocidade';

  const svg = (conteudo, tamanho = 24) =>
    `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${conteudo}</svg>`;
  const numeroDoPasso = `<text x="12" y="15.6" text-anchor="middle" font-size="7.5" font-weight="800" fill="currentColor" stroke="none">${PASSO}</text>`;

  const ICONE = {
    musica: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', 18),
    recomecar: svg('<path d="M18 5 9 12l9 7Z"/><path d="M6 5v14"/>'),
    voltar: svg(`<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5v4h4"/>${numeroDoPasso}`, 28),
    avancar: svg(`<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5v4h-4"/>${numeroDoPasso}`, 28),
    tocar: '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>',
    pausar: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
  };

  const escrever = (velocidade) => `${velocidade}x`;

  function lerVelocidade() {
    try {
      const guardada = Number(localStorage.getItem(CHAVE_DA_VELOCIDADE));
      return VELOCIDADES.includes(guardada) ? guardada : 1;
    } catch (e) {
      return 1;
    }
  }

  function guardarVelocidade(velocidade) {
    try { localStorage.setItem(CHAVE_DA_VELOCIDADE, String(velocidade)); } catch (e) { /* sem espaço ou bloqueado: fica só nesta visita */ }
  }

  function formatar(segundos) {
    if (!isFinite(segundos) || segundos < 0) return '0:00';
    const minutos = Math.floor(segundos / 60);
    const resto = Math.floor(segundos % 60).toString().padStart(2, '0');
    return `${minutos}:${resto}`;
  }

  function html(endereco, rotulo) {
    return `<div class="audio-card">
      <div class="audio-card-label">${ICONE.musica}<span>${rotulo}</span></div>
      <div class="audio-progress-wrap">
        <div class="audio-progress-track" role="slider" tabindex="0" aria-label="Posición del audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="audio-progress-fill"></div>
          <div class="audio-progress-thumb"></div>
        </div>
        <div class="audio-time-row"><span class="audio-tempo-atual">0:00</span><span class="audio-tempo-total">0:00</span></div>
      </div>
      <div class="audio-botoes">
        <button class="audio-botao" type="button" data-acao="recomecar" aria-label="Volver al inicio">${ICONE.recomecar}</button>
        <button class="audio-botao" type="button" data-acao="voltar" aria-label="Retroceder ${PASSO} segundos">${ICONE.voltar}</button>
        <button class="audio-play-btn" type="button" data-acao="tocar" aria-label="Reproducir"><svg class="audio-play-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONE.tocar}</svg></button>
        <button class="audio-botao" type="button" data-acao="avancar" aria-label="Adelantar ${PASSO} segundos">${ICONE.avancar}</button>
        <button class="audio-botao audio-velocidade" type="button" data-acao="velocidade">1x</button>
      </div>
      <audio preload="metadata" src="${endereco}"></audio>
    </div>`;
  }

  function ligar(quadro, opcoes = {}) {
    if (!quadro) return;
    const audio = quadro.querySelector('audio');
    const botaoTocar = quadro.querySelector('[data-acao="tocar"]');
    const iconeTocar = quadro.querySelector('.audio-play-icon');
    const botaoVelocidade = quadro.querySelector('[data-acao="velocidade"]');
    const trilho = quadro.querySelector('.audio-progress-track');
    const preenchido = quadro.querySelector('.audio-progress-fill');
    const bolinha = quadro.querySelector('.audio-progress-thumb');
    const tempoAtual = quadro.querySelector('.audio-tempo-atual');
    const tempoTotal = quadro.querySelector('.audio-tempo-total');

    const desenharBarra = () => {
      const proporcao = audio.duration ? audio.currentTime / audio.duration : 0;
      preenchido.style.width = `${proporcao * 100}%`;
      bolinha.style.left = `${proporcao * 100}%`;
      tempoAtual.textContent = formatar(audio.currentTime);
      trilho.setAttribute('aria-valuenow', String(Math.round(proporcao * 100)));
      trilho.setAttribute('aria-valuetext', `${formatar(audio.currentTime)} de ${formatar(audio.duration)}`);
    };

    // O ícone segue o áudio, e não o toque no botão: assim ele fica certo
    // também quando quem pausa é a tela bloqueada ou o fone de ouvido.
    const desenharBotao = () => {
      const tocando = !audio.paused;
      iconeTocar.innerHTML = tocando ? ICONE.pausar : ICONE.tocar;
      botaoTocar.setAttribute('aria-label', tocando ? 'Pausar' : 'Reproducir');
    };

    const irPara = (segundos) => {
      if (!isFinite(audio.duration)) {
        if (segundos <= 0) audio.currentTime = 0;
        return;
      }
      audio.currentTime = Math.min(Math.max(0, segundos), audio.duration);
      desenharBarra();
    };

    // A VELOCIDADE. O navegador volta para 1x quando o áudio carrega, a não
    // ser que a escolha também esteja em defaultPlaybackRate.
    let velocidade = lerVelocidade();
    const aplicarVelocidade = () => {
      audio.defaultPlaybackRate = velocidade;
      audio.playbackRate = velocidade;
      botaoVelocidade.textContent = escrever(velocidade);
      botaoVelocidade.setAttribute('aria-label', `Velocidad ${velocidade === 1 ? 'normal' : escrever(velocidade)}. Toca para cambiar`);
    };
    aplicarVelocidade();
    audio.addEventListener('loadedmetadata', aplicarVelocidade);
    botaoVelocidade.addEventListener('click', () => {
      velocidade = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
      guardarVelocidade(velocidade);
      aplicarVelocidade();
    });

    audio.addEventListener('loadedmetadata', () => {
      tempoTotal.textContent = formatar(audio.duration);
      desenharBarra();
    });
    audio.addEventListener('timeupdate', desenharBarra);
    audio.addEventListener('play', desenharBotao);
    audio.addEventListener('pause', desenharBotao);
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      desenharBarra();
      desenharBotao();
    });

    // A REDE DE SEGURANÇA do Brasil (trocar para a cópia do site se a Bunny
    // falhar). Na LATAM não há cópia no site (data-copia-do-site vazio), então
    // este trecho não faz nada; ficou para a cópia continuar igual à original.
    const copiaDoSite = audio.dataset.copiaDoSite;
    audio.addEventListener('error', () => {
      if (!copiaDoSite || audio.getAttribute('src') === copiaDoSite) return;
      const ponto = audio.currentTime;
      const estavaTocando = !audio.paused;
      audio.src = copiaDoSite;
      if (ponto > 0) audio.addEventListener('loadedmetadata', () => irPara(ponto), { once: true });
      if (estavaTocando) {
        const tentativa = audio.play();
        if (tentativa && tentativa.catch) tentativa.catch(() => desenharBotao());
      } else {
        desenharBotao();
      }
    });

    botaoTocar.addEventListener('click', () => {
      if (audio.paused) {
        const tentativa = audio.play();
        if (tentativa && tentativa.catch) tentativa.catch(() => desenharBotao());
      } else {
        audio.pause();
      }
    });
    quadro.querySelector('[data-acao="recomecar"]').addEventListener('click', () => irPara(0));
    quadro.querySelector('[data-acao="voltar"]').addEventListener('click', () => irPara(audio.currentTime - PASSO));
    quadro.querySelector('[data-acao="avancar"]').addEventListener('click', () => irPara(audio.currentTime + PASSO));

    // A barra: arrastar com o dedo ou tocar num ponto; no teclado, as setas.
    let arrastando = false;
    const irParaOToque = (evento) => {
      const caixa = trilho.getBoundingClientRect();
      const proporcao = Math.min(1, Math.max(0, (evento.clientX - caixa.left) / caixa.width));
      if (audio.duration) irPara(proporcao * audio.duration);
    };
    trilho.addEventListener('pointerdown', (evento) => {
      arrastando = true;
      trilho.setPointerCapture(evento.pointerId);
      irParaOToque(evento);
    });
    trilho.addEventListener('pointermove', (evento) => { if (arrastando) irParaOToque(evento); });
    trilho.addEventListener('pointerup', () => { arrastando = false; });
    trilho.addEventListener('pointercancel', () => { arrastando = false; });
    trilho.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') { evento.preventDefault(); irPara(audio.currentTime - PASSO); }
      if (evento.key === 'ArrowRight') { evento.preventDefault(); irPara(audio.currentTime + PASSO); }
    });

    // A TELA BLOQUEADA. Na primeira vez que o áudio toca, o celular passa a
    // mostrar o nome da oração e os botões de voltar e avançar ali.
    audio.addEventListener('play', () => {
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: opcoes.titulo || document.title,
          artist: '7 Amenes de la Madrugada',
          album: opcoes.album || '',
          artwork: [{ src: '/assets/images/icon-180.png', sizes: '180x180', type: 'image/png' }]
        });
      } catch (e) { /* aparelho sem suporte: segue sem */ }
      const acoes = {
        play: () => audio.play(),
        pause: () => audio.pause(),
        seekbackward: () => irPara(audio.currentTime - PASSO),
        seekforward: () => irPara(audio.currentTime + PASSO),
        seekto: (detalhe) => irPara(detalhe.seekTime)
      };
      Object.keys(acoes).forEach((acao) => {
        try { navigator.mediaSession.setActionHandler(acao, acoes[acao]); } catch (e) { /* ação que o aparelho não conhece */ }
      });
    }, { once: true });
  }

  window.TOCADOR = { html, ligar };
})();
