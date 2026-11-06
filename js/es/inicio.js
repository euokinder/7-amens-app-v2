// O início do app em espanhol: a oração de hoje, a jornada e os regalos.
// Arquivo só da LATAM.
(async function () {
  const { el } = window.AMENES;
  const D = window.AMENES_DIAS;
  const contenido = document.getElementById('contenido');

  function falla(mensaje) {
    contenido.replaceChildren(el('div', { class: 'caixa' },
      el('h2', { text: 'No pudimos cargar tu jornada' }),
      el('p', { text: mensaje }),
      el('button', { class: 'boton', type: 'button', text: 'Intentar de nuevo', onclick: () => location.reload() })));
  }

  // 1. A oração de agora (ou o descanso, ou a jornada concluída).
  function hoy(r) {
    const sugerido = window.AMENES.sugerido(r);
    if (sugerido !== null) {
      const d = D.dias[sugerido];
      return el('section', { class: 'bloco' },
        el('h2', { text: sugerido === 0 ? 'Empieza por aquí' : 'Tu oración de hoy' }),
        el('a', { class: 'card destaque', href: `/es-dia?dia=${sugerido}` },
          el('img', { src: d.imagen, alt: '' }),
          el('div', { class: 'painel' },
            el('span', { class: 'etiqueta', text: sugerido === 0 ? 'LEE PRIMERO' : `DÍA ${sugerido} DE 7` }),
            el('h3', { text: sugerido === 0 ? d.titulo : d.subtitulo }),
            el('p', { text: sugerido === 0 ? d.subtitulo : d.titulo }),
            el('span', { class: 'boton', text: sugerido === 0 ? 'Leer la guía' : 'Rezar ahora' }))));
    }
    if (window.AMENES.rezados(r) >= 7) {
      return el('section', { class: 'bloco' },
        el('h2', { text: '¡Concluiste la jornada!' }),
        el('div', { class: 'escuro' },
          el('div', { class: 'rotulo', text: 'Los 7 Amenes' }),
          el('p', { class: 'grande', text: D.dias[7].concluido })));
    }
    const proximo = D.dias[r.abierto + 1];
    return el('section', { class: 'bloco' },
      el('h2', { text: 'Por hoy, ya está' }),
      el('div', { class: 'caixa' },
        el('p', { text: 'Ya rezaste la oración que estaba abierta. Que Dios te bendiga.' }),
        el('p', { text: `Mañana se abre el ${proximo.titulo}: ${proximo.subtitulo}.` })));
  }

  // 2. Quantas já rezou, com as 7 bolinhas.
  function progreso(r) {
    const barras = [];
    for (let dia = 1; dia <= 7; dia += 1) barras.push(el('span', { class: window.AMENES.estado(r, dia).tipo }));
    const n = window.AMENES.rezados(r);
    return el('section', { class: 'bloco' },
      el('h2', { text: `Rezaste ${n} de 7` }),
      el('p', { class: 'apoio', text: 'Cada madrugada se abre una oración nueva.' }),
      el('div', { class: 'progreso', 'aria-hidden': 'true' }, ...barras));
  }

  // 3. A jornada inteira, do Comienza aquí ao Séptimo Amén.
  function jornada(r) {
    const lista = el('ul', { class: 'jornada' });
    for (const d of D.dias) {
      const estado = window.AMENES.estado(r, d.numero);
      lista.append(el('li', null,
        el('a', { class: `fila ${estado.tipo}`, href: `/es-dia?dia=${d.numero}` },
          el('img', { src: d.imagen, alt: '', loading: 'lazy' }),
          el('div', { class: 'textos' },
            el('div', { class: 'numero', text: d.numero === 0 ? 'Antes de empezar' : `Día ${d.numero} · ${d.titulo}` }),
            el('div', { class: 'titulo', text: d.numero === 0 ? d.titulo : d.subtitulo }),
            el('div', { class: 'estado', text: estado.texto })),
          el('span', { class: 'seta', 'aria-hidden': 'true', text: '›' }))));
    }
    return el('section', { class: 'bloco' },
      el('h2', { text: 'Tu jornada' }),
      el('p', { class: 'apoio', text: 'Una oración por día, en orden.' }),
      lista);
  }

  // 4. O material de regalo (os PDFs que ficam para sempre com ela).
  function regalos() {
    return el('section', { class: 'bloco' },
      el('h2', { text: 'Material de regalo' }),
      el('p', { class: 'apoio', text: 'Para rezar cuando lo necesites, también después de los 7 días.' }),
      ...D.regalos.map(regalo => el('a', { class: 'card', href: regalo.pdf, target: '_blank', rel: 'noopener' },
        el('img', { src: regalo.imagen, alt: '', loading: 'lazy' }),
        el('div', { class: 'painel' },
          el('span', { class: 'etiqueta', text: 'REGALO' }),
          el('h3', { text: regalo.titulo }),
          el('p', { text: regalo.texto }),
          el('span', { class: 'boton', text: 'Abrir el PDF' })))));
  }

  // 5. Ajuda e o pé.
  function ayuda(r) {
    return [
      el('section', { class: 'caixa' },
        el('h3', { text: '¿Necesitas ayuda?' }),
        el('p', { text: 'Escríbenos y te respondemos.' }),
        el('a', { class: 'boton linea', href: window.AMENES_CONFIG.soporte, text: 'Escríbenos' }),
        el('p', { class: 'pie' },
          '¿Prefieres imprimir? ',
          el('a', { href: '/materiales', text: 'Todos los PDF están aquí' }))),
      el('footer', { class: 'pie' },
        r.acceso_hasta ? el('p', { text: `Tu acceso vale hasta el ${r.acceso_hasta}.` }) : null,
        el('button', { class: 'enlace', type: 'button', text: 'Salir', onclick: () => window.AMENES.salir() }),
        el('span', { class: 'marca', text: D.nombre })),
    ];
  }

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { falla(erro.message); return; }
  if (!r) return;
  const nombre = r.cliente && r.cliente.nombre;
  document.getElementById('saludo').textContent = nombre ? `Hola, ${nombre}` : 'Hola';
  contenido.replaceChildren(hoy(r), progreso(r), jornada(r), regalos(), ...ayuda(r));
})();
