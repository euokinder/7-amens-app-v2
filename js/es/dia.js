// Um dia da jornada, no desenho do dia.html do Brasil: kicker, título com a
// barra, e a oração completa nos blocos do "Material de Apoio" brasileiro
// (como rezar, antes, a oração, depois, declaração). O Dia 0 é a guia de
// início, no desenho da guia brasileira. Arquivo só da LATAM.
(async function () {
  const D = window.AMENES_DIAS;
  const content = document.getElementById('content');
  document.getElementById('ayuda-portao').href = window.AMENES_CONFIG.soporte;
  const n = Number(new URLSearchParams(location.search).get('dia'));
  if (!Number.isInteger(n) || n < 0 || n > 7) { location.replace('/es-novena'); return; }
  const d = D.dias[n];

  // Os textos são nossos (js/es/dias.js), mas tudo passa por aqui antes de
  // virar HTML: nenhum caractere vira código por engano.
  const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const comQuebras = (texto) => esc(texto).replace(/\n/g, '<br>');

  const FOTOS = [
    '/assets/images/dia-0-introducao.jpg', '/assets/images/dia-1-pai-nosso.jpg', '/assets/images/dia-2-perdao.jpg',
    '/assets/images/dia-3-cura.jpg', '/assets/images/dia-4-libertacao.jpg', '/assets/images/dia-5-prosperidade.jpg',
    '/assets/images/dia-6-paz.jpg', '/assets/images/dia-7-alianca.jpg',
  ];
  const checkIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.2 2.2L15.5 9.5"/></svg>';
  const pdfIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13m0 0 4-4m-4 4-4-4"/><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>';
  const numBadge = (i) => `<div style="flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--dark-on-accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">${i}</div>`;
  const numItem = (i, titulo, texto) => `
    <div style="display:flex;gap:12px;align-items:flex-start;">
      ${numBadge(i)}
      <div>
        <p style="margin:0;font-size:15px;font-weight:700;color:var(--ink);">${esc(titulo)}</p>
        <p class="subtext" style="margin:2px 0 0;">${esc(texto)}</p>
      </div>
    </div>`;
  const kicker = n === 0 ? '7 Amenes de la Madrugada · Comienza aquí' : `7 Amenes de la Madrugada · Día ${String(n).padStart(2, '0')}`;
  const titulo = n === 0 ? 'Introducción' : d.titulo;
  const subtitulo = n === 0 ? 'Comienza aquí, antes de la 1.ª madrugada' : d.subtitulo;
  document.title = `${titulo} · ${D.nombre}`;

  const cabecalho = `
    <span class="kicker">${esc(kicker)}</span>
    <div class="section-heading" style="margin-top:-8px;">
      <div class="bar"></div>
      <div class="heading-block">
        <h1 class="title" style="font-size:22px;">${esc(titulo)}</h1>
        <p class="subtext">${esc(subtitulo)}</p>
      </div>
    </div>
    <img src="${FOTOS[n]}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:16px;display:block;">`;
  const botaoPdf = `<button class="material-btn lg" type="button" data-pdf="${esc(d.pdf)}">${pdfIcon} Descargar el PDF para guardar o imprimir</button>`;
  const faixa = (texto) => `<div class="banner"><span>${esc(texto)}</span></div>`;

  // Um dia que ainda não abriu: como no Brasil, sem a oração.
  function fechado(estado) {
    content.innerHTML = `${cabecalho}
      <div class="heading-block">
        <h2 class="title" style="font-size:20px;">Esta oración todavía no está abierta</h2>
        <p class="subtext">${estado.faltan === 1 ? 'Se abre mañana, a la medianoche.' : `Se abre en ${estado.faltan} días.`} Cada madrugada se abre una oración nueva.</p>
      </div>
      <a class="member-button" href="/es-novena" style="text-align:center;text-decoration:none;">Volver a las oraciones</a>`;
  }

  // Os sete Amenes: a oração completa, nos blocos do Material de Apoio do Brasil.
  function amen() {
    const o = d.oracion;
    const pedido = d.completar ? `
      <div class="es-pedido">
        <label class="kicker" for="pedido" style="text-transform:none;letter-spacing:0;">${esc(d.completar)}</label>
        <input type="text" id="pedido" class="material-input" placeholder="Escribe aquí, si quieres guardarlo...">
      </div>` : '';
    return `${cabecalho}
      <div>
        <h2 class="section-label" style="margin-bottom:14px;">Cómo rezar este Amén</h2>
        <div class="modal-checklist">${d.reglas.map((regla) => `<div class="item">${checkIcon}<p>${esc(regla)}</p></div>`).join('')}</div>
        ${d.importante ? `<p class="subtext" style="margin-top:14px;font-size:13px;line-height:1.6;"><i>Importante:</i> ${esc(d.importante)}</p>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <h2 class="section-label" style="margin:0;">Antes de empezar</h2>
        <p class="subtext" style="font-size:15px;color:var(--ink);">${esc(d.antes)}</p>
        ${pedido}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <h2 class="section-label" style="margin:0;">La oración</h2>
        <div class="prayer-card">
          <p class="opening">${esc(o.abertura)}</p>
          ${o.bloques.map((estrofa) => `<p>${comQuebras(estrofa)}</p>`).join('')}
          <p class="closing">${esc(o.cierre)}</p>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <h2 class="section-label" style="margin:0;">Después de rezar</h2>
        <p class="subtext" style="font-size:15px;color:var(--ink);">${esc(d.despues)}</p>
      </div>
      <div class="declaration-card">
        <span class="kicker" style="color:var(--card-muted);">Declaración del día</span>
        <p>“${esc(d.declaracion)}”</p>
      </div>
      ${faixa('No te saltes días. No cambies el orden. No reces más de una oración por día.')}
      <div id="member-progress-anchor" style="display:flex;flex-direction:column;align-items:center;gap:10px;">${botaoPdf}</div>
      ${d.proximo || d.concluido ? `<p class="subtext" style="text-align:center;">${comQuebras(n === 7 ? d.concluido : d.proximo)}</p>` : ''}
      ${faixa('Haz las oraciones en orden y en el horario correcto')}`;
  }

  // O Dia 0: a guia de início, no desenho da guia do Brasil.
  function guia() {
    return `${cabecalho}
      ${botaoPdf}
      <div class="declaration-card">
        <p style="font-size:17px;">No necesitas memorizar nada.</p>
        <p class="subtext" style="color:var(--card-muted);font-style:normal;font-size:14px;">${esc(d.intro.replace(/^No necesitas memorizar nada\.\s*/, ''))}</p>
      </div>
      <div>
        <h2 class="section-label" style="margin-bottom:8px;">Tu jornada en una frase</h2>
        <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:var(--ink);">${esc(d.frase)}</p>
        <p class="subtext">${esc(d.apoyo)}</p>
      </div>
      <div style="border:1px solid var(--surface-alt); border-radius:16px; padding:16px 18px; display:flex; flex-direction:column; gap:4px;">
        <span class="kicker" style="color:var(--accent-strong);">Tu primera oración ya está abierta</span>
        <p style="margin:0;font-size:16px;font-weight:700;color:var(--ink);">${esc(D.dias[1].titulo)}: ${esc(D.dias[1].subtitulo)}</p>
        <p class="subtext" style="margin-top:4px;">Cada madrugada se abre la oración siguiente, a la medianoche.</p>
      </div>
      <div>
        <h2 class="section-label" style="margin-bottom:14px;">Prepara tu primera madrugada</h2>
        <div class="modal-checklist">${d.prepara.map((p, i) => numItem(i + 1, p.t, p.d)).join('')}</div>
      </div>
      <p class="subtext" style="font-size:13px;line-height:1.6;"><i>${esc(d.si_no_puedes.t)}:</i> ${esc(d.si_no_puedes.d)}</p>
      <div>
        <h2 class="section-label" style="margin-bottom:14px;">Las 7 reglas de la jornada</h2>
        <div class="modal-checklist">${d.reglas.map((p, i) => numItem(i + 1, p.t, p.d)).join('')}</div>
      </div>
      <div class="declaration-card">
        <span class="kicker" style="color:var(--card-muted);">La regla más importante</span>
        <p>${esc(d.regla_mayor)}</p>
      </div>
      <div>
        <h2 class="section-label" style="margin-bottom:14px;">Dudas rápidas</h2>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${d.dudas.map((qa) => `<div><p style="margin:0;font-size:15px;font-weight:700;color:var(--ink);">${esc(qa.t)}</p><p class="subtext" style="margin-top:2px;">${esc(qa.d)}</p></div>`).join('')}
        </div>
      </div>
      <p class="subtext" style="font-size:13px;line-height:1.6;"><i>Importante sobre la salud:</i> ${esc(d.salud)}</p>
      <div class="declaration-card">
        <span class="kicker" style="color:var(--card-muted);">Recordatorio</span>
        <p>${esc(d.recordatorio)}</p>
      </div>
      <div id="member-progress-anchor"></div>
      ${faixa('Haz las oraciones en orden y en el horario correcto')}`;
  }

  // O "Concluí" do Brasil, em espanhol: marca e desmarca, e diz que salvou.
  function botaoDeConcluir(retrato) {
    const secao = document.createElement('section');
    secao.className = 'member-progress';
    secao.id = 'member-progress';
    const botao = document.createElement('button');
    botao.className = 'member-button';
    botao.type = 'button';
    const mensagem = document.createElement('p');
    mensagem.setAttribute('role', 'status');
    const irAoPrimeiro = document.createElement('a');
    irAoPrimeiro.className = 'member-button secondary';
    irAoPrimeiro.href = '/es-dia?dia=1';
    irAoPrimeiro.textContent = 'Ir a la Primera Madrugada';
    irAoPrimeiro.style.cssText = 'text-align:center;text-decoration:none;color:var(--ink);';

    let atual = retrato;
    const rotulo = () => {
      const feito = atual.completados.includes(n);
      botao.textContent = n === 0
        ? (feito ? '✓ Introducción leída · deshacer' : 'Ya leí la introducción')
        : (feito ? '✓ Oración rezada · deshacer' : 'Recé esta oración');
      irAoPrimeiro.hidden = !(n === 0 && feito && !atual.completados.includes(1));
    };
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      mensagem.textContent = n === 0 ? 'Guardando…' : 'Guardando tu oración…';
      const resultado = await window.AMENES.marcar(n, !atual.completados.includes(n));
      botao.disabled = false;
      if (resultado.ok) { atual = resultado.retrato; rotulo(); mensagem.textContent = 'Tu progreso quedó guardado.'; return; }
      if (resultado.error) mensagem.textContent = resultado.error;
    });
    rotulo();
    secao.append(botao, mensagem, irAoPrimeiro);
    const ancora = document.getElementById('member-progress-anchor');
    ancora.before(secao);
  }

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
  if (!r) return;
  window.AMENES.mostrarTela();

  const estado = window.AMENES.estado(r, n);
  if (estado.tipo === 'cerrada') { fechado(estado); window.AMENES_EFECTOS.iniciar(); return; }

  content.innerHTML = n === 0 ? guia() : amen();
  content.querySelectorAll('[data-pdf]').forEach((botao) => botao.addEventListener('click', () => window.open(botao.dataset.pdf, '_blank')));

  // O pedido do dia fica só no celular dela, como no Brasil.
  const pedido = document.getElementById('pedido');
  if (pedido) {
    const chave = `amenes-es.pedido-dia-${n}`;
    try { pedido.value = localStorage.getItem(chave) || ''; } catch { /* sem armazenamento */ }
    pedido.addEventListener('input', () => { try { localStorage.setItem(chave, pedido.value); } catch { /* sem armazenamento */ } });
  }

  botaoDeConcluir(r);
  window.AMENES_EFECTOS.iniciar();
})();
