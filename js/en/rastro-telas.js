// Os ajudantes do rastreio nas TELAS do app em inglês. Arquivo só do app em
// inglês. Quem grava o passo é o js/en/rastro.js (window.AMENES.rastro); este
// arquivo só sabe CHAMAR com segurança e medir o que as telas precisam:
//   - rastro(nome, props)       chama o registrador; se faltar ou falhar, a tela
//                               segue igual (nada aqui pode quebrar a tela)
//   - uma(chave, nome, props)   o mesmo passo, uma vez por página
//   - seguidor(...)             play + 25/50/75/100 % de um vídeo ou áudio
//   - vturb(player, ...)        liga o seguidor ao relógio do player da VTurb
//   - bunny(iframe, ...)        liga o seguidor ao player da Bunny (player.js)
//   - audio(elemento, ...)      liga o seguidor a um <audio>
// E, por delegação (um ouvinte só no documento, que nunca impede o toque):
//   - pdf_aberto     em todo link .pdf e todo botão [data-pdf]
//   - suporte_toque  em todo link mailto: e wa.me / whatsapp
// Carrega logo depois do js/en/rastro.js. Passo pedido antes de o rastro.js
// existir fica numa fila curta e sai quando a página termina de carregar.
(function () {
  'use strict';

  const fila = [];
  const chamar = (nome, props) => {
    const registrador = window.AMENES && window.AMENES.rastro;
    if (typeof registrador !== 'function') return false;
    try { registrador.call(window.AMENES, nome, props || {}); } catch (erro) { /* o rastro nunca atrapalha a tela */ }
    return true;
  };
  const rastro = (nome, props) => {
    if (chamar(nome, props)) return;
    if (fila.length < 50) fila.push([nome, props]);
  };
  const esvaziar = () => { while (fila.length && chamar.apply(null, fila[0])) fila.shift(); };
  window.addEventListener('DOMContentLoaded', esvaziar);
  window.addEventListener('load', esvaziar);

  const feitos = new Set();
  const uma = (chave, nome, props) => {
    if (feitos.has(chave)) return false;
    feitos.add(chave);
    rastro(nome, props);
    return true;
  };

  // O play e os marcos de um vídeo ou áudio. `ver(atual, duracao)` recebe cada
  // leitura do relógio. Pular para a frente não conta: os marcos que ficaram
  // para trás do pulo são descartados em silêncio, e só vale o que passou
  // tocando de verdade.
  const MARCOS = [25, 50, 75, 100];
  function seguidor(aoTocar, aoMarco, opcoes) {
    const pulo = (opcoes && opcoes.pulo) || 8; // segundos entre duas leituras para contar como pulo
    let anterior = null;
    let tocou = false;
    let comBase = false;
    const dados = {};
    const descartar = (ate) => MARCOS.forEach((m) => { if (m <= ate) dados[m] = true; });
    return {
      ver(atual, duracao, pulou) {
        if (!(atual >= 0)) return;
        if (anterior !== null && atual > anterior && !tocou) { tocou = true; aoTocar(); }
        if (!(duracao > 0)) { anterior = atual; return; } // sem duração ainda: só o play conta
        const pct = (atual / duracao) * 100;
        if (!comBase) {
          // Primeira leitura com duração: quem volta de onde parou (ou já abre
          // adiantada) não ganha os marcos que ficaram para trás.
          comBase = true;
          if (atual > pulo) descartar(Math.floor(pct));
        } else if (pulou || atual - anterior > pulo || atual < anterior) {
          descartar(Math.floor(pct)); // pulo (para a frente ou para trás): não conta
        } else if (atual > anterior) {
          MARCOS.forEach((m) => { if (pct >= m && !dados[m]) { dados[m] = true; aoMarco(m); } });
        }
        anterior = atual;
      },
      tocou() { if (!tocou) { tocou = true; aoTocar(); } },
      fim() { if (!dados[100]) { descartar(99); dados[100] = true; aoMarco(100); } },
    };
  }

  // A VTurb: o relógio do player (currentTime) lido a cada segundo, como o
  // js/en/oferta-dia.js já faz. A duração vem do player; sem ela, só o play.
  function vturb(player, aoTocar, aoMarco) {
    if (!player || player.dataset.rastro) return;
    player.dataset.rastro = '1';
    const s = seguidor(aoTocar, aoMarco);
    let antes = null;
    const relogio = setInterval(() => {
      if (!player.isConnected) { clearInterval(relogio); return; }
      let atual = 0;
      let duracao = 0;
      try {
        atual = Number(player.currentTime) || 0;
        duracao = Number(player.duration) || Number(player.totalDuration) || 0;
      } catch (erro) { return; }
      s.ver(atual, duracao);
      if (duracao > 0 && atual >= duracao - 1 && antes !== null) s.fim();
      antes = atual;
    }, 1000);
  }

  // A Bunny (iframe): fala o protocolo player.js por mensagem. Ela avisa
  // "ready"; aí a gente pede play, timeupdate e ended.
  function bunny(iframe, aoTocar, aoMarco) {
    if (!iframe || iframe.dataset.rastro) return;
    iframe.dataset.rastro = '1';
    const s = seguidor(aoTocar, aoMarco);
    const enviar = (metodo, valor) => {
      try { iframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.10', method: metodo, value: valor, listener: valor }), '*'); } catch (erro) { /* iframe ainda não pronto */ }
    };
    window.addEventListener('message', (evento) => {
      if (!iframe.contentWindow || evento.source !== iframe.contentWindow) return;
      let dado = evento.data;
      if (typeof dado === 'string') { try { dado = JSON.parse(dado); } catch (erro) { return; } }
      if (!dado || dado.context !== 'player.js') return;
      if (dado.event === 'ready') {
        ['play', 'timeupdate', 'ended'].forEach((nome) => enviar('addEventListener', nome));
      } else if (dado.event === 'play') {
        s.tocou();
      } else if (dado.event === 'timeupdate' && dado.value) {
        let v = dado.value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (erro) { return; } }
        s.ver(Number(v.seconds), Number(v.duration));
      } else if (dado.event === 'ended') {
        s.fim();
      }
    });
    iframe.addEventListener('load', () => enviar('addEventListener', 'timeupdate'));
  }

  // Um <audio>: play uma vez; marcos pelo relógio dele. Os botões de voltar e
  // avançar do tocador mexem no tempo, então "seeking" conta como pulo.
  function audio(elemento, aoTocar, aoMarco) {
    if (!elemento || elemento.dataset.rastro) return;
    elemento.dataset.rastro = '1';
    const s = seguidor(aoTocar, aoMarco, { pulo: 4 });
    let pulou = false;
    elemento.addEventListener('play', () => s.tocou());
    elemento.addEventListener('seeking', () => { pulou = true; });
    elemento.addEventListener('timeupdate', () => {
      s.ver(elemento.currentTime, elemento.duration, pulou);
      pulou = false;
    });
    elemento.addEventListener('ended', () => s.fim());
  }

  // ---------------------------------------------------------- delegação
  const ondeEstou = () => {
    const caminho = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    if (/en-day$/.test(caminho)) return `dia-${new URLSearchParams(location.search).get('dia') || '?'}`;
    return caminho.replace(/^\/(en-)?/, '') || 'home';
  };
  const nomeDoPdf = (endereco) => {
    try { return new URL(endereco, location.href).pathname.split('/').pop().replace(/\.pdf$/i, ''); } catch (erro) { return String(endereco || '').slice(0, 80); }
  };
  document.addEventListener('click', (evento) => {
    try {
      const alvo = evento.target && evento.target.closest ? evento.target.closest('a, button') : null;
      if (!alvo) return;
      const href = alvo.getAttribute('href') || '';
      if (alvo.dataset.pdf || /\.pdf($|[?#])/i.test(href)) {
        rastro('pdf_aberto', { pdf: nomeDoPdf(alvo.dataset.pdf || href), onde: ondeEstou() });
      }
      if (evento.defaultPrevented) return; // o "Contact us" da home abre a Lucy, e não o e-mail
      if (/^mailto:/i.test(href)) rastro('suporte_toque', { canal: 'email' });
      else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(href)) rastro('suporte_toque', { canal: 'whatsapp' });
    } catch (erro) { /* o rastro nunca atrapalha o toque */ }
  });

  window.AMENES_RASTRO = { rastro, uma, seguidor, vturb, bunny, audio };
})();
