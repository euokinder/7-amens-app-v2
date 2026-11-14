// O reembolso em um toque do app em inglês (en-refund.html). Cópia do
// js/es/reembolso.js, traduzida. Arquivo só do app dos EUA.
//
// Passos: 1. o e-mail -> 2. as compras (marca uma ou várias) -> 3. pronto.
// Sem compra achada: "Fix my email" ou "Request my refund anyway".
// Servidor fora: o caminho de sempre (WhatsApp e e-mail do suporte;
// ⏳ EUA: vazios em js/en/config.js até o Arthur mandar).
//
// De propósito, NÃO carrega o js/en/sesion.js: com a sessão vencida, ele
// mandaria para a tela de entrar, e quem quer o dinheiro de volta não pode
// ficar presa num login. O e-mail vem, nesta ordem: do link (?correo=), do
// retrato que o próprio app guardou nesta aba (amens-en.retrato) ou ela
// escreve. Com o e-mail conhecido, ela cai direto na lista.
//
// Nada aqui devolve dinheiro: o pedido fica na fila (en_refund_requests)
// e a equipe devolve em até 24 horas.
(function () {
  const config = window.AMENES_CONFIG;
  const $ = id => document.getElementById(id);
  const pasos = ['paso-correo', 'paso-compras', 'paso-nada', 'paso-listo', 'paso-error'];

  let correo = '';
  let compras = [];
  let pedidoId = null;

  function mostrar(paso) {
    pasos.forEach(id => { $(id).hidden = id !== paso; });
    window.scrollTo(0, 0);
  }

  // $27 ou $28.62 (ponto, como se lê nos EUA). Outra moeda: "28.62 EUR".
  function dinero(centavos, moneda) {
    const valor = (centavos || 0) / 100;
    const texto = Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
    return !moneda || moneda === 'USD' ? `$${texto}` : `${texto} ${moneda}`;
  }

  // "November 13", como se lê nos EUA.
  const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fecha(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${MESES[d.getMonth()]} ${d.getDate()}`;
  }

  async function llamar(cuerpo) {
    const respuesta = await fetch(config.reembolso, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch { /* sem corpo */ }
    if (!respuesta.ok) {
      const erro = new Error(datos.error || 'error');
      erro.status = respuesta.status;
      erro.mensaje = datos.error || '';
      throw erro;
    }
    return datos;
  }

  // ⏳ EUA: o botão do WhatsApp e o e-mail só aparecem se existirem em
  // js/en/config.js. Sem nenhum dos dois, a tela pede para tentar de novo.
  function caminoDeSiempre() {
    const texto = `Hi, I'd like to request a refund for my 7 Amens Before Dawn purchase.${correo ? `\nPurchase email: ${correo}` : ''}`;
    const whatsapp = config.whatsapp(texto);
    $('boton-whatsapp').hidden = !whatsapp;
    if (whatsapp) $('boton-whatsapp').href = whatsapp;
    $('linha-correo').hidden = !config.correo;
    $('correo-escrito').textContent = config.correo || '';
    $('correo-rotulo').textContent = whatsapp ? 'Or email us at' : 'Email us at';
    $('texto-error').textContent = config.temSuporte
      ? "Your request matters to us. Write to us, and we'll still refund your money within 24 hours."
      : 'Your request matters to us. Please try again in a few minutes.';
    mostrar('paso-error');
  }

  // ------------------------------------------------------------ a lista
  const marcadas = () => compras.filter(c => c.marcada);

  function atualizarTotal() {
    const escolhidas = marcadas();
    const total = escolhidas.reduce((soma, c) => soma + (c.valor_cents || 0), 0);
    $('caja-total').hidden = !escolhidas.length;
    $('total').textContent = dinero(total, escolhidas[0] && escolhidas[0].moneda);
    if (escolhidas.length) $('error-compras').textContent = '';
  }

  function desenharLista() {
    const lista = $('lista-compras');
    lista.textContent = '';
    compras.forEach(compra => {
      const item = document.createElement('li');
      const quieta = compra.devuelto || compra.pedido_abierto;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'es-r-compra' + (compra.marcada ? ' marcada' : '') + (quieta ? ' quieta' : '');
      botao.disabled = quieta;
      botao.setAttribute('aria-pressed', compra.marcada ? 'true' : 'false');

      const caixa = document.createElement('span');
      caixa.className = 'es-r-caixa';
      caixa.setAttribute('aria-hidden', 'true');
      caixa.textContent = compra.marcada ? '✓' : '';

      const textos = document.createElement('span');
      textos.className = 'es-r-textos';
      const nome = document.createElement('strong');
      nome.textContent = compra.nombre;
      const detalhe = document.createElement('span');
      const partes = [dinero(compra.valor_cents, compra.moneda), fecha(compra.fecha)].filter(Boolean);
      if (compra.devuelto) partes.push('Already refunded');
      else if (compra.pedido_abierto) partes.push('Already requested');
      detalhe.textContent = partes.join(' · ');
      textos.append(nome, detalhe);
      botao.setAttribute('aria-label', `${compra.nombre}, ${partes.join(', ')}`);

      botao.append(textos, caixa);
      botao.addEventListener('click', () => {
        compra.marcada = !compra.marcada;
        desenharLista();
        atualizarTotal();
      });
      item.append(botao);
      lista.append(item);
    });
  }

  function abrirLista(datos) {
    correo = datos.email || correo;
    // As que ela ainda pode pedir vêm primeiro; as já pedidas ou devolvidas, no fim.
    compras = (datos.compras || []).map(c => ({ ...c, marcada: false }))
      .sort((a, b) => Number(a.devuelto || a.pedido_abierto) - Number(b.devuelto || b.pedido_abierto));
    if (!compras.length) {
      $('correo-nada').textContent = correo;
      $('error-nada').textContent = '';
      mostrar('paso-nada');
      return;
    }
    const livres = compras.filter(c => !c.devuelto && !c.pedido_abierto);
    // Uma compra só: já vem marcada. Várias: nenhuma, para ninguém devolver
    // tudo sem querer quando só queria os Archangels.
    if (livres.length === 1) livres[0].marcada = true;
    $('correo-usado').hidden = !datos.corrigido;
    $('correo-usado').textContent = datos.corrigido ? `We found your purchases under: ${datos.corrigido}` : '';
    const nadaLivre = !livres.length;
    $('texto-compras').textContent = nadaLivre
      ? "You already asked for a refund of all your purchases. We'll email you when it's done."
      : livres.length === 1
        ? 'This is your purchase. Tap the button to ask for your money back.'
        : "Tap what you'd like us to refund. You can choose more than one.";
    $('boton-pedir').hidden = nadaLivre;
    $('error-compras').textContent = '';
    desenharLista();
    atualizarTotal();
    mostrar('paso-compras');
  }

  async function buscar(valor) {
    const boton = $('boton-ver');
    boton.disabled = true;
    boton.textContent = 'Searching…';
    $('error-correo').textContent = '';
    try {
      correo = valor;
      abrirLista(await llamar({ action: 'compras', email: valor }));
    } catch (erro) {
      if (erro.status === 400 || erro.status === 429) {
        mostrar('paso-correo');
        $('error-correo').textContent = erro.mensaje || 'Please check your email and try again.';
      } else {
        caminoDeSiempre();
      }
    } finally {
      boton.disabled = false;
      boton.textContent = 'See my purchases';
    }
  }

  function listo(datos) {
    pedidoId = datos.id || null;
    $('texto-listo').textContent = datos.total_cents
      ? `Within 24 hours, we'll refund ${dinero(datos.total_cents, datos.moneda)} to the same card you paid with. We'll email you when it's done.`
      : "Within 24 hours, we'll find your purchase and refund your money to the same card you paid with. We'll email you.";
    $('caja-motivo').hidden = !pedidoId;
    $('gracias-motivo').hidden = true;
    mostrar('paso-listo');
  }

  async function pedir(cuerpo, boton, campoError) {
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Sending…';
    try {
      listo(await llamar({ action: 'pedir', email: correo, ...cuerpo }));
    } catch (erro) {
      if (erro.status === 400 || erro.status === 429) $(campoError).textContent = erro.mensaje || 'Please try again.';
      else caminoDeSiempre();
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }

  // ---------------------------------------------------------- os botões
  $('form-correo').addEventListener('submit', evento => {
    evento.preventDefault();
    const valor = $('correo').value.trim();
    if (!valor || !valor.includes('@')) {
      $('error-correo').textContent = 'Please type the full email you used for your purchase (for example: mary@gmail.com).';
      return;
    }
    buscar(valor);
  });

  $('boton-pedir').addEventListener('click', () => {
    const escolhidas = marcadas();
    if (!escolhidas.length) {
      $('error-compras').textContent = "Choose what you'd like us to refund.";
      return;
    }
    pedir({ pedidos: escolhidas.map(c => c.pedido) }, $('boton-pedir'), 'error-compras');
  });

  $('boton-igual').addEventListener('click', () => pedir({ sin_compra: true }, $('boton-igual'), 'error-nada'));

  document.querySelectorAll('[data-volver]').forEach(boton => boton.addEventListener('click', () => {
    $('correo').value = correo;
    mostrar('paso-correo');
    $('correo').focus();
  }));

  document.querySelectorAll('[data-motivo]').forEach(boton => boton.addEventListener('click', async () => {
    $('caja-motivo').hidden = true;
    $('gracias-motivo').hidden = false;
    if (!pedidoId) return;
    try { await llamar({ action: 'motivo', id: pedidoId, motivo: boton.dataset.motivo }); } catch { /* o motivo nunca atrapalha */ }
  }));

  // ------------------------------------------------- o e-mail já conhecido
  // (?correo= é o nome do parâmetro no link do e-mail de entrega: não traduzir.)
  let conocido = '';
  try {
    const delLink = new URLSearchParams(location.search).get('correo') || '';
    if (delLink.includes('@')) conocido = delLink.trim();
  } catch { /* sem parâmetro */ }
  if (!conocido) {
    try {
      const guardado = JSON.parse(sessionStorage.getItem('amens-en.retrato') || 'null');
      const email = guardado && guardado.retrato && guardado.retrato.cliente && guardado.retrato.cliente.email;
      if (typeof email === 'string' && email.includes('@')) conocido = email;
    } catch { /* sem armazenamento: ela escreve */ }
  }
  if (conocido) {
    $('correo').value = conocido;
    buscar(conocido);
  }
})();
