// Um dia da jornada: o Comienza aquí (dia 0) ou um dos sete Amenes.
// Arquivo só da LATAM.
(async function () {
  const { el } = window.AMENES;
  const D = window.AMENES_DIAS;
  const contenido = document.getElementById('contenido');
  const n = Number(new URLSearchParams(location.search).get('dia'));
  if (!Number.isInteger(n) || n < 0 || n > 7) { location.replace('/es'); return; }
  const d = D.dias[n];

  // O topo sai na hora, antes de conferir a sessão: é texto fixo.
  document.getElementById('topo').style.setProperty('--foto', `url('${d.imagen}')`);
  document.getElementById('selo').textContent = n === 0 ? 'LEE PRIMERO' : `DÍA ${n} DE 7`;
  document.getElementById('titulo').textContent = n === 0 ? d.titulo : d.subtitulo;
  document.getElementById('subtitulo').textContent = n === 0 ? d.subtitulo : d.titulo;
  document.title = `${n === 0 ? d.titulo : d.titulo + ' · ' + d.subtitulo} · ${D.nombre}`;

  const bloco = (titulo, ...filhos) => el('section', { class: 'bloco' }, titulo ? el('h2', { text: titulo }) : null, ...filhos);
  const volver = () => el('a', { class: 'boton oscuro', href: '/es', text: 'Volver a mi jornada' });

  function falla(mensaje) {
    contenido.replaceChildren(el('div', { class: 'caixa' },
      el('h2', { text: 'No pudimos cargar tu oración' }),
      el('p', { text: mensaje }),
      el('button', { class: 'boton', type: 'button', text: 'Intentar de nuevo', onclick: () => location.reload() })));
  }

  // Dia ainda fechado: explica, sem mostrar a oração. A trava é de
  // experiência (os textos são públicos), como no app brasileiro.
  function cerrada(r, estado) {
    const sugerido = window.AMENES.sugerido(r);
    contenido.replaceChildren(el('div', { class: 'caixa' },
      el('h2', { text: 'Esta oración todavía no está abierta' }),
      el('p', { text: estado.faltan === 1 ? 'Se abre mañana, a la medianoche.' : `Se abre en ${estado.faltan} días.` }),
      el('p', { text: 'Cada madrugada se abre una oración nueva. Así caminas un día a la vez, sin prisa.' }),
      sugerido !== null ? el('a', { class: 'boton', href: `/es-dia?dia=${sugerido}`, text: sugerido === 0 ? 'Leer la guía de inicio' : 'Ir a la oración de hoy' }) : null,
      volver()));
  }

  // O botão "Ya recé" e o que aparece depois de marcar.
  function zonaMarcar(r) {
    const zona = el('section', { class: 'bloco', id: 'marcar' });
    const aviso = el('p', { class: 'aviso', role: 'alert', hidden: true });
    const hecho = r.completados.includes(n);

    // Enquanto grava, o botão diz o que está acontecendo: nada de tela parada.
    async function cambiar(done, boton) {
      const texto = boton.textContent;
      boton.disabled = true;
      boton.textContent = 'Guardando…';
      aviso.hidden = true;
      const resultado = await window.AMENES.marcar(n, done);
      if (resultado.ok) { zona.replaceWith(zonaMarcar(resultado.retrato)); return; }
      boton.disabled = false;
      boton.textContent = texto;
      if (resultado.error) { aviso.textContent = resultado.error; aviso.hidden = false; }
    }

    if (!hecho) {
      const boton = el('button', { class: 'boton', type: 'button', text: n === 0 ? 'Ya la leí' : 'Ya recé este Amén' });
      boton.addEventListener('click', () => cambiar(true, boton));
      zona.append(boton, aviso);
      return zona;
    }

    const desmarcar = el('button', { class: 'enlace', type: 'button', text: 'Me equivoqué: desmarcar' });
    desmarcar.addEventListener('click', () => cambiar(false, desmarcar));
    if (n === 0) {
      const primerDia = r.completados.includes(1);
      zona.append(
        el('div', { class: 'listo' }, el('div', { class: 'marca', text: '✓ Ya leíste la guía' })),
        primerDia ? null : el('a', { class: 'boton', href: '/es-dia?dia=1', text: 'Ir al Primer Amén' }),
        desmarcar, aviso);
      return zona;
    }
    zona.append(
      el('div', { class: 'listo' },
        el('div', { class: 'marca', text: '✓ Ya rezaste este Amén' }),
        el('p', { class: 'siguiente', text: n === 7 ? d.concluido : d.proximo })),
      n < 7 ? el('p', { class: 'una-por-dia', text: 'No te saltes días. No cambies el orden. No reces más de una oración por día.' }) : null,
      desmarcar, aviso);
    return zona;
  }

  // Os sete Amenes: o mesmo roteiro do PDF.
  function amen(r) {
    const o = d.oracion;
    return [
      bloco('Cómo rezar este Amén',
        el('ul', { class: 'reglas' }, ...d.reglas.map(regla => el('li', { text: regla }))),
        d.importante ? el('p', { class: 'dica', text: `Importante: ${d.importante}` }) : null),
      bloco('Antes de empezar',
        el('p', { text: d.antes }),
        d.completar ? el('p', { class: 'completar', text: `En silencio, completa: «${d.completar.replace(/:\s*$/, '')}…»` }) : null),
      bloco('La oración',
        el('p', { class: 'apoio', text: 'En voz alta, despacio, frase por frase.' }),
        el('div', { class: 'oracion' },
          el('p', { class: 'abertura', text: o.abertura }),
          ...o.bloques.map(estrofa => el('p', { class: 'estrofa', text: estrofa })),
          el('p', { class: 'amen', text: o.cierre }))),
      bloco('Después de rezar', el('p', { text: d.despues })),
      bloco('Declaración del día', el('div', { class: 'declaracion', text: `“${d.declaracion}”` })),
      zonaMarcar(r),
      bloco(null,
        el('a', { class: 'boton linea', href: d.pdf, target: '_blank', rel: 'noopener', text: 'Descargar este día en PDF' }),
        volver()),
    ];
  }

  // O Comienza aquí: a guia de início, adaptada ao app.
  function guia(r) {
    return [
      el('div', { class: 'caixa' },
        el('p', { text: d.intro }),
        el('h2', { text: d.frase }),
        el('p', { text: d.apoyo })),
      bloco('Prepara tu madrugada',
        el('div', { class: 'pasos' }, ...d.prepara.map(p => el('div', { class: 'paso' }, el('strong', { text: p.t }), el('span', { text: p.d })))),
        el('p', { class: 'dica' }, el('strong', { text: d.si_no_puedes.t }), d.si_no_puedes.d)),
      bloco('Las 7 reglas de la jornada',
        el('div', { class: 'pasos' }, ...d.reglas.map((p, i) => el('div', { class: 'paso' }, el('strong', { text: `${i + 1}. ${p.t}` }), el('span', { text: p.d })))),
        el('div', { class: 'escuro' }, el('div', { class: 'rotulo', text: 'La regla más importante' }), el('div', { class: 'grande', text: d.regla_mayor }))),
      bloco('Dudas rápidas',
        el('div', { class: 'caixa' }, ...d.dudas.map(p => el('div', { class: 'duda' }, el('strong', { text: p.t }), el('p', { text: p.d })))),
        el('p', { class: 'salud' }, el('strong', { text: 'Importante sobre la salud' }), d.salud)),
      el('div', { class: 'escuro' }, el('div', { class: 'rotulo', text: 'Recordatorio' }), el('div', { class: 'grande', text: d.recordatorio })),
      zonaMarcar(r),
      bloco(null,
        el('a', { class: 'boton linea', href: d.pdf, target: '_blank', rel: 'noopener', text: 'Descargar la guía en PDF' }),
        volver()),
    ];
  }

  let r;
  try { r = await window.AMENES.retrato(); } catch (erro) { falla(erro.message); return; }
  if (!r) return;
  const estado = window.AMENES.estado(r, n);
  if (estado.tipo === 'cerrada') { cerrada(r, estado); return; }
  contenido.replaceChildren(...(n === 0 ? guia(r) : amen(r)));
})();
