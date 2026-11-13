// O reembolso em um toque do app em espanhol (es-reembolso.html, 13/11/2026).
// Arquivo só da LATAM.
//
// Passos: 1. o e-mail -> 2. as compras (marca uma ou várias) -> 3. pronto.
// Sem compra achada: "Corregir mi correo" ou "Pedir mi reembolso igual".
// Servidor fora: o caminho de sempre (WhatsApp e soporte@).
//
// De propósito, NÃO carrega o js/es/sesion.js: com a sessão vencida, ele
// mandaria para a tela de entrar, e quem quer o dinheiro de volta não pode
// ficar presa num login. O e-mail vem, nesta ordem: do link (?correo=), do
// retrato que o próprio app guardou nesta aba (amenes-es.retrato) ou ela
// escreve. Com o e-mail conhecido, ela cai direto na lista.
//
// Nada aqui devolve dinheiro: o pedido fica na fila (latam_refund_requests)
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

  // US$ 27 ou US$ 28,62 (vírgula, como se lê na América Latina).
  function dinero(centavos, moneda) {
    const valor = (centavos || 0) / 100;
    const texto = Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace('.', ',');
    const simbolo = !moneda || moneda === 'USD' ? 'US$' : moneda;
    return `${simbolo} ${texto}`;
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fecha(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} de ${MESES[d.getMonth()]}`;
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

  function caminoDeSiempre() {
    const texto = `Hola, quiero pedir el reembolso de mi compra de 7 Amenes de la Madrugada.${correo ? `\nCorreo de la compra: ${correo}` : ''}`;
    $('boton-whatsapp').href = config.whatsapp(texto);
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
      if (compra.devuelto) partes.push('Ya devuelto');
      else if (compra.pedido_abierto) partes.push('Ya lo pediste');
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
    // tudo sem querer quando só queria os Arcángeles.
    if (livres.length === 1) livres[0].marcada = true;
    $('correo-usado').hidden = !datos.corrigido;
    $('correo-usado').textContent = datos.corrigido ? `Encontramos tus compras con: ${datos.corrigido}` : '';
    const nadaLivre = !livres.length;
    $('texto-compras').textContent = nadaLivre
      ? 'Ya pediste el reembolso de todas tus compras. Te avisamos por correo cuando esté hecho.'
      : livres.length === 1
        ? 'Esta es tu compra. Toca el botón para pedir tu dinero de vuelta.'
        : 'Toca lo que quieres que te devolvamos. Puedes marcar más de una.';
    $('boton-pedir').hidden = nadaLivre;
    $('error-compras').textContent = '';
    desenharLista();
    atualizarTotal();
    mostrar('paso-compras');
  }

  async function buscar(valor) {
    const boton = $('boton-ver');
    boton.disabled = true;
    boton.textContent = 'Buscando…';
    $('error-correo').textContent = '';
    try {
      correo = valor;
      abrirLista(await llamar({ action: 'compras', email: valor }));
    } catch (erro) {
      if (erro.status === 400 || erro.status === 429) {
        mostrar('paso-correo');
        $('error-correo').textContent = erro.mensaje || 'Revisa tu correo y vuelve a intentarlo.';
      } else {
        caminoDeSiempre();
      }
    } finally {
      boton.disabled = false;
      boton.textContent = 'Ver mis compras';
    }
  }

  function listo(datos) {
    pedidoId = datos.id || null;
    $('texto-listo').textContent = datos.total_cents
      ? `En hasta 24 horas te devolvemos ${dinero(datos.total_cents, datos.moneda)} en la misma tarjeta con la que pagaste. Te avisamos por correo cuando esté hecho.`
      : 'En hasta 24 horas buscamos tu compra y te devolvemos el dinero en la misma tarjeta con la que pagaste. Te avisamos por correo.';
    $('caja-motivo').hidden = !pedidoId;
    $('gracias-motivo').hidden = true;
    mostrar('paso-listo');
  }

  async function pedir(cuerpo, boton, campoError) {
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      listo(await llamar({ action: 'pedir', email: correo, ...cuerpo }));
    } catch (erro) {
      if (erro.status === 400 || erro.status === 429) $(campoError).textContent = erro.mensaje || 'Inténtalo de nuevo.';
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
      $('error-correo').textContent = 'Escribe el correo que usaste en la compra, completo (por ejemplo: maria@gmail.com).';
      return;
    }
    buscar(valor);
  });

  $('boton-pedir').addEventListener('click', () => {
    const escolhidas = marcadas();
    if (!escolhidas.length) {
      $('error-compras').textContent = 'Marca lo que quieres que te devolvamos.';
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
  let conocido = '';
  try {
    const delLink = new URLSearchParams(location.search).get('correo') || '';
    if (delLink.includes('@')) conocido = delLink.trim();
  } catch { /* sem parâmetro */ }
  if (!conocido) {
    try {
      const guardado = JSON.parse(sessionStorage.getItem('amenes-es.retrato') || 'null');
      const email = guardado && guardado.retrato && guardado.retrato.cliente && guardado.retrato.cliente.email;
      if (typeof email === 'string' && email.includes('@')) conocido = email;
    } catch { /* sem armazenamento: ela escreve */ }
  }
  if (conocido) {
    $('correo').value = conocido;
    buscar(conocido);
  }
})();
