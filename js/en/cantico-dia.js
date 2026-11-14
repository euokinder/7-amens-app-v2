// Um dia do Angelic Canticle (/en-canticle-day?dia=1): o áudio do dia e,
// quando chegar, o texto. CÓPIA do script do cantico-dia.html do Brasil (via
// js/es/cantico-dia.js), em inglês, com o "Concluí este dia" do js/member.js
// virando "I completed this day". Enquanto a voz não chega (pendiente: true,
// em js/en/cantico.js), o quadro do tocador mostra "Audio coming soon" e o
// botão de terminar não aparece: ainda não há o que terminar. Arquivo só do
// app em inglês.
(async function () {
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const texto = new URLSearchParams(location.search).get('dia') || '';
  const n = /^[0-7]$/.test(texto) ? Number(texto) : -1;
  const dia = n >= 0 ? CANTICO[n] : null;
  const content = document.getElementById('content');
  const el = window.AMENES.el;

  // O "Concluí" do Brasil, em inglês: marca e desmarca, e diz que salvou.
  function botaoDeTerminar(retrato) {
    const secao = el('section', { class: 'member-progress', id: 'member-progress' });
    const botao = el('button', { class: 'member-button', type: 'button' });
    const mensagem = el('p', { role: 'status' });
    let atual = retrato;
    const feito = () => Boolean(atual.cantico && atual.cantico.completados.includes(n));
    const rotulo = () => { botao.textContent = feito() ? '✓ Day completed · undo' : 'I completed this day'; };
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      mensagem.textContent = 'Saving…';
      const resultado = await window.AMENES.marcarCantico(n, !feito());
      botao.disabled = false;
      if (resultado.ok) { atual = resultado.retrato; rotulo(); mensagem.textContent = 'Your progress has been saved.'; return; }
      if (resultado.error) mensagem.textContent = resultado.error;
    });
    rotulo();
    secao.append(botao, mensagem);
    // Entra logo ANTES da frase do dia seguinte; no Day 7, que não tem
    // frase, antes da faixa dourada. Como no Brasil.
    const ancora = document.getElementById('member-progress-anchor') || content.querySelector('.banner');
    ancora.before(secao);
  }

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;

  const cantico = r.cantico || { abierto: 7, completados: [] };

  if (window.AMENES_EXTRAS.trancarPagina(r, 'cantico')) {
    // trancada: o convite para conhecer já está na tela
  } else if (!diaDelCanticoVisible(dia)) {
    window.AMENES_EXTRAS.indisponible('We couldn\'t find this day. Please go back to the Angelic Canticle.', '/en-canticle', 'Back to the Canticle');
  } else if (n > cantico.abierto) {
    // Um dia aberto por link antes da vez dele (o bloquearDiaDoCanticoTravado do Brasil).
    const titulo = el('h1', { class: 'title', text: 'This day hasn\'t come yet' });
    titulo.style.fontSize = '22px';
    const voltar = el('a', { class: 'member-button', href: '/en-canticle', text: 'Back to the Canticle' });
    voltar.style.cssText = 'text-align:center;text-decoration:none;';
    content.replaceChildren(
      el('div', { class: 'heading-block' }, titulo, el('p', {
        class: 'subtext',
        text: n - cantico.abierto === 1
          ? 'It unlocks tomorrow, right after midnight. One day at a time, the way this journey was meant to be prayed.'
          : 'Each day opens the next one. This day is still waiting its turn.',
      })),
      voltar,
    );
  } else {
    document.title = `${dia.titulo} — Angelic Canticle`;

    // Enquanto a voz não chega: o aviso de que o áudio está sendo preparado e,
    // se houver PDF, o botão dele (no espanhol, o PDF da Novena em cada dia,
    // pedido do Caio em 07/11). Os dois saem quando a voz entrar.
    // ⏳ EUA: sem PDF em inglês (PDF_NOVENA = null), o aviso fica só com a
    // primeira frase, e o botão do PDF não aparece.
    const avisoDaVoz = 'We\'re finishing the audio for this day. It will be right here very soon.'
      + (PDF_NOVENA ? ' In the meantime, you can pray with the PDF of the Novena to Mary, Undoer of Knots.' : '');
    const audioHtml = dia.audioUrl
      ? TOCADOR.html(dia.audioUrl, 'Listen to the Canticle')
      : dia.pendiente
        ? window.AMENES_EXTRAS.audioEnPreparacion(avisoDaVoz, PDF_NOVENA, 'Open the Novena PDF')
        : '';

    const textoHtml = dia.oracion
      ? `<div style="display:flex;flex-direction:column;gap:14px;">
          <h2 class="section-label" style="margin:0;">The Prayer</h2>
          <div class="prayer-card">
            <p class="opening">${esc(dia.oracion.apertura)}</p>
            ${dia.oracion.bloques.map((bloque) => `<p>${esc(bloque).replace(/\n/g, '<br>')}</p>`).join('')}
            <p class="closing">${esc(dia.oracion.cierre)}</p>
          </div>
        </div>`
      : '';

    const proximoHtml = dia.proximo
      ? `<p class="subtext" id="member-progress-anchor" style="text-align:center;">${esc(dia.proximo)}</p>`
      : '';

    content.innerHTML = `
      <span class="kicker">${esc(dia.kicker)}</span>
      <div class="section-heading" style="margin-top:-8px;">
        <div class="bar"></div>
        <div class="heading-block">
          <h1 class="title" style="font-size:22px;">${esc(dia.titulo)}</h1>
          <p class="subtext">${esc(dia.subtitulo)}</p>
        </div>
      </div>

      ${audioHtml}

      ${textoHtml}

      ${proximoHtml}

      <div class="banner">
        <span>One day at a time, in the order of the journey</span>
      </div>

      <a class="member-button" href="/en-canticle" style="text-align:center;text-decoration:none;">See all the days</a>`;

    // O tocador (voltar ao início, voltar e avançar 10 s, velocidade) mora em js/en/tocador.js.
    if (dia.audioUrl) TOCADOR.ligar(content.querySelector('.audio-card'), { titulo: `${dia.titulo} — ${dia.subtitulo}`, album: 'Angelic Canticle' });
    // Só com o que entregar (áudio ou texto) há o que terminar.
    if (dia.audioUrl || dia.oracion) botaoDeTerminar(r);
  }

  window.AMENES.mostrarTela();
  window.AMENES_EFECTOS.iniciar();
})();
