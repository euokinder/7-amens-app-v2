// O painel de reembolsos do suporte (/es-reembolsos, 18/11/2026).
// Pedido do Arthur: guardar e mostrar os pedidos da /es-reembolso, para o
// suporte marcar o que foi reembolsado, o que a cliente desistiu ou foi
// recusado, editar e excluir; e, sem sair daqui, liberar ou retirar produtos.
//
// O painel NÃO devolve dinheiro. O suporte devolve à mão, na Whop ou na
// Digistore, e marca aqui. Quem guarda é a latam-reembolso (ações admin_*);
// liberar e retirar produtos usa a latam-api (as mesmas ações do /es-admin).
// A sessão é a do app em espanhol (amenes-es.sesion), e só entra quem está
// em latam_admins.
//
// Desde 18/11 (SQL 17) a lista junta LATAM e EUA, com etiqueta de região e
// filtro, e traz os pedidos que o leitor de e-mails cria (canal 'email', SQL
// 16): resumo, assunto, trecho e o botão "Abrir no Gmail". O prazo de 24 h
// conta da hora do e-mail: amarelo a menos de 6 h do fim, vermelho depois.
// Toda ação sobre um pedido manda a regiao, para a função achar a tabela.
//
// Sem atualização sozinha de tempos em tempos (economia da cota do Supabase):
// a lista vem ao abrir, no botão "Atualizar" e depois de cada ação.
//
// Texto sempre por textContent (nunca innerHTML): nome e e-mail vêm da
// cliente e não podem virar código na página.
(() => {
  const CONFIG = window.AMENES_CONFIG;
  const CLAVE = 'amenes-es.sesion';
  const PRAZO_HORAS = 24;
  const GARANTIA_DIAS = 7;
  const SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.';

  const $ = id => document.getElementById(id);
  const ler = () => { try { return localStorage.getItem(CLAVE) || ''; } catch { return ''; } };
  const gravar = valor => { try { if (valor) localStorage.setItem(CLAVE, valor); else localStorage.removeItem(CLAVE); } catch { /* sem armazenamento */ } };

  // ------------------------------------------------------------ conversa
  async function chamar(url, action, dados) {
    const headers = { 'Content-Type': 'application/json' };
    const token = ler();
    if (token) headers['x-latam-session'] = token;
    let resposta;
    try {
      resposta = await fetch(url, { method: 'POST', headers, body: JSON.stringify(Object.assign({ action }, dados || {})) });
    } catch {
      return { ok: false, status: 0, erro: SEM_CONEXAO };
    }
    let corpo = null;
    try { corpo = await resposta.json(); } catch { /* sem corpo */ }
    if (resposta.status === 401) { sair(corpo && corpo.error); return { ok: false, status: 401, erro: '' }; }
    if (!resposta.ok) return { ok: false, status: resposta.status, erro: (corpo && corpo.error) || SEM_CONEXAO };
    return { ok: true, corpo };
  }
  const reembolso = (action, dados) => chamar(CONFIG.reembolso, action, dados);
  const api = (action, dados) => chamar(CONFIG.api, action, dados);

  // ------------------------------------------------------------ desenho
  function h(tag, atributos, ...filhos) {
    const no = document.createElement(tag);
    for (const [chave, valor] of Object.entries(atributos || {})) {
      if (valor === null || valor === undefined || valor === false) continue;
      if (chave === 'text') no.textContent = valor;
      else if (chave === 'class') no.className = valor;
      else if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
      else no.setAttribute(chave, valor === true ? '' : valor);
    }
    for (const filho of filhos.flat()) if (filho !== null && filho !== undefined && filho !== false && filho !== '') no.append(filho);
    return no;
  }

  const ROTULO_STATUS = { pendente: 'Pendente', feito: 'Reembolsado', desistiu: 'Desistiu', recusado: 'Recusado' };
  const ROTULO_MOTIVO = {
    no_pude_entrar: 'Não conseguiu entrar no app',
    no_era_lo_que_esperaba: 'Não era o que esperava',
    no_reconozco: 'Não reconhece a cobrança',
    cobro_de_mas: 'Foi cobrada a mais',
    extra_sin_querer: 'Comprou o extra sem querer',
    otro: 'Outro motivo',
  };
  // O que o leitor de e-mails entendeu do e-mail (SQL 16, 18/11/2026).
  // Ameaça de banco em vermelho: é a que vira disputa se demorar.
  const ROTULO_TIPO = {
    pedido_reembolso: ['Pede reembolso', 'azul'],
    cobro_doble: ['Cobrança em dobro', 'amarelo'],
    no_reconoce: ['Não reconhece a compra', 'amarelo'],
    amenaza_banco: ['Ameaça ir ao banco', 'perigo'],
  };
  const tipoDe = chave => ROTULO_TIPO[chave] || [chave, 'amarelo'];
  // LATAM e EUA no mesmo painel (SQL 17). O pedido sem região é da LATAM.
  const REGIAO = { latam: 'LATAM', eua: 'EUA' };
  const regiaoDe = p => (p.regiao === 'eua' ? 'eua' : 'latam');
  const CAIXA = { soporte: 'soporte@ (LATAM)', eua: 'caixa dos EUA' };
  // Só um link do próprio Gmail vira botão (o texto vem de fora).
  const linkDoGmail = link => (typeof link === 'string' && /^https:\/\/mail\.google\.com\//.test(link) ? link : '');
  const NOME_PAIS = (() => {
    try { const nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); return codigo => (codigo ? nomes.of(codigo) || codigo : ''); }
    catch { return codigo => codigo || ''; }
  })();

  const dinheiro = (centavos, moeda) => {
    const valor = (Number(centavos) || 0) / 100;
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: (moeda || 'USD').toUpperCase() }).format(valor); }
    catch { return `${moeda || 'US$'} ${valor.toFixed(2)}`; }
  };
  const BRASILIA = { timeZone: 'America/Sao_Paulo' };
  const dataHora = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { ...BRASILIA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const data = iso => (iso ? new Date(iso).toLocaleDateString('pt-BR', { ...BRASILIA, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const horasDesde = iso => (Date.now() - Date.parse(iso)) / 3_600_000;
  const diasDesde = iso => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  const duracao = horas => {
    const h = Math.abs(horas);
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
    if (h < 48) return `${Math.floor(h)} h`;
    return `${Math.floor(h / 24)} dias`;
  };
  // O relógio das 24 h começa quando ELA pediu: o que veio por e-mail conta
  // da hora do e-mail (na estreia, o leitor traz e-mails de até 7 dias atrás).
  const inicio = p => {
    const datas = [p.created_at, p.email_recebido_em].filter(Boolean).map(Date.parse).filter(Number.isFinite);
    return new Date(datas.length ? Math.min(...datas) : Date.now()).toISOString();
  };
  const horasDoPedido = p => horasDesde(inicio(p));
  const atrasado = p => p.status === 'pendente' && horasDoPedido(p) >= PRAZO_HORAS;
  // Amarelo: faltam menos de 6 h para o prazo de 24 h.
  const AVISO_HORAS = 18;
  const perto = p => p.status === 'pendente' && !atrasado(p) && horasDoPedido(p) >= AVISO_HORAS;
  const classeEstado = p => (atrasado(p) ? 'atrasado' : p.status);
  const prazo = p => (atrasado(p) ? 'atrasado' : perto(p) ? 'perto' : '');

  function avisar(texto, erro) {
    const caixa = $('aviso-rapido');
    caixa.textContent = texto;
    caixa.classList.toggle('erro', Boolean(erro));
    caixa.hidden = false;
    clearTimeout(avisar.tempo);
    avisar.tempo = setTimeout(() => { caixa.hidden = true; }, erro ? 5000 : 2600);
  }
  async function copiar(texto, rotulo) {
    try { await navigator.clipboard.writeText(texto); avisar(`${rotulo || 'Copiado'} ✓`); }
    catch { window.prompt('Copie com Ctrl+C:', texto); }
  }
  // O ícone do copiar (SVG precisa de createElementNS).
  function iconeCopiar() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '12'); svg.setAttribute('height', '12'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2'); svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M9 9h11v11H9z', 'M5 15H4V4h11v1']) {
      const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      caminho.setAttribute('d', d); svg.append(caminho);
    }
    return svg;
  }
  const copia = (texto, rotulo) => h('button', { type: 'button', class: 'copiavel', title: 'Copiar', onclick: () => copiar(texto, rotulo) },
    h('span', { text: texto }), iconeCopiar());

  // ------------------------------------------------------------ estado
  let pedidos = [];
  let aba = 'pendente';
  let aberto = '';
  let carregando = false;
  // O país vem da escolha do topo (LATAM | EUA, js/es/guia-suporte.js):
  // cada país só vê os pedidos dele. Sem o script, LATAM.
  const paisAtual = () => (document.body.dataset.pais === 'eua' ? 'eua' : 'latam');
  // Os filtros de cima (tipo do e-mail, motivo). Vazio = todos.
  const filtros = { tipo: '', motivo: '' };
  const passaNosFiltros = (p, f = filtros) => {
    if (regiaoDe(p) !== paisAtual()) return false;
    if (f.tipo === 'email' && !p.email_tipo) return false;
    if (f.tipo === 'pagina' && p.email_tipo) return false;
    if (f.tipo && !['email', 'pagina'].includes(f.tipo) && p.email_tipo !== f.tipo) return false;
    if (f.motivo === 'nenhum' && p.motivo) return false;
    if (f.motivo && f.motivo !== 'nenhum' && p.motivo !== f.motivo) return false;
    return true;
  };
  const filtrados = () => pedidos.filter(p => passaNosFiltros(p));

  const ABAS = [
    { chave: 'pendente', rotulo: 'Pendentes', filtro: p => p.status === 'pendente' },
    { chave: 'perto', rotulo: 'Vencendo', filtro: perto },
    { chave: 'atrasado', rotulo: 'Atrasados', filtro: atrasado },
    { chave: 'semcompra', rotulo: 'Sem compra', filtro: p => p.status === 'pendente' && p.sin_compra },
    { chave: 'feito', rotulo: 'Reembolsados', filtro: p => p.status === 'feito' },
    { chave: 'desistiu', rotulo: 'Desistiu', filtro: p => p.status === 'desistiu' },
    { chave: 'recusado', rotulo: 'Recusados', filtro: p => p.status === 'recusado' },
    { chave: 'todos', rotulo: 'Todos', filtro: () => true },
  ];

  // ------------------------------------------------------------ entrar / sair
  function mostrarEntrar(mensagem) {
    $('tela-painel').hidden = true;
    fecharGaveta();
    $('tela-entrar').hidden = false;
    const erro = $('entrar-erro');
    erro.hidden = !mensagem;
    erro.textContent = mensagem || '';
    setTimeout(() => $('entrar-email').focus(), 50);
  }
  function sair(mensagem) {
    gravar('');
    mostrarEntrar(mensagem || '');
  }

  $('form-entrar').addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = $('entrar-botao');
    const email = $('entrar-email').value.trim();
    if (!email) return;
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    let zona = '';
    try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* sem fuso */ }
    const r = await chamar(CONFIG.api, 'login', { email, tz: zona });
    botao.disabled = false;
    botao.textContent = 'Entrar';
    if (!r.ok) {
      $('entrar-erro').hidden = false;
      $('entrar-erro').textContent = r.status === 403 || r.status === 404
        ? 'Esse e-mail não tem acesso. Peça ao Arthur para incluir você na equipe.'
        : r.erro;
      return;
    }
    gravar(r.corpo.token);
    abrirPainel();
  });

  $('botao-sair').addEventListener('click', async () => {
    await api('logout');
    sair();
  });

  // ------------------------------------------------------------ carregar
  async function carregar() {
    if (carregando) return;
    carregando = true;
    $('estado').hidden = false;
    $('estado').textContent = 'Carregando…';
    $('botao-atualizar').disabled = true;
    const r = await reembolso('admin_lista');
    carregando = false;
    $('botao-atualizar').disabled = false;
    if (!r.ok) {
      if (r.status === 403) { sair(r.erro); return; }
      if (r.status !== 401) $('estado').textContent = r.erro;
      return;
    }
    pedidos = r.corpo.pedidos || [];
    const eu = r.corpo.eu;
    $('quem').textContent = eu ? eu.email : '';
    $('estado').hidden = true;
    desenhar();
    if (aberto) {
      const p = pedidos.find(x => x.id === aberto);
      if (p) desenharGaveta(p); else fecharGaveta();
    }
  }

  async function abrirPainel() {
    $('tela-entrar').hidden = true;
    $('tela-painel').hidden = false;
    await carregar();
    const doEndereco = decodeURIComponent(location.hash.slice(1));
    if (doEndereco && pedidos.some(p => p.id === doEndereco)) abrirGaveta(doEndereco);
  }

  // ------------------------------------------------------------ números
  function desenharNumeros() {
    const base = filtrados();
    const pendentes = base.filter(p => p.status === 'pendente');
    const atrasados = pendentes.filter(atrasado);
    const vencendo = pendentes.filter(perto);
    const semCompra = pendentes.filter(p => p.sin_compra);
    const trintaDias = Date.now() - 30 * 86_400_000;
    const resolvidosNoMes = base.filter(p => p.resuelto_en && Date.parse(p.resuelto_en) >= trintaDias);
    const feitos = resolvidosNoMes.filter(p => p.status === 'feito');
    const devolvido = feitos.reduce((soma, p) => soma + (p.valor_devolvido_cents ?? p.total_cents ?? 0), 0);
    const aDevolver = pendentes.reduce((soma, p) => soma + (p.total_cents || 0), 0);
    const maisVelho = pendentes.reduce((velho, p) => Math.max(velho, horasDoPedido(p)), 0);
    const numero = (rotulo, valor, nota, classe, ponto, irPara) => h(irPara ? 'button' : 'div', {
      class: `numero vidro${classe ? ` ${classe}` : ''}${irPara ? ' numero-botao' : ''}`,
      type: irPara ? 'button' : null,
      onclick: irPara ? () => { aba = irPara; desenhar(); } : null,
    },
    h('div', { class: 'numero-rotulo' }, ponto ? h('span', { class: `ponto ${ponto}` }) : null, rotulo),
    h('div', { class: 'numero-valor', text: valor }),
    h('div', { class: 'numero-nota', text: nota }));
    $('numeros').replaceChildren(
      numero('Pendentes', String(pendentes.length), pendentes.length ? `o mais antigo há ${duracao(maisVelho)}` : 'fila zerada', '', 'pendente', 'pendente'),
      numero('Vencendo', String(vencendo.length), `faltam menos de ${PRAZO_HORAS - AVISO_HORAS} h`, vencendo.length ? 'aviso' : '', vencendo.length ? 'perto' : null, 'perto'),
      numero('Atrasados', String(atrasados.length), `passaram de ${PRAZO_HORAS} h`, atrasados.length ? 'alerta' : '', atrasados.length ? 'atrasado' : null, 'atrasado'),
      numero('Sem compra', String(semCompra.length), 'procurar a compra', semCompra.length ? 'procurar' : '', null, 'semcompra'),
      numero('A devolver', dinheiro(aDevolver, 'USD'), 'soma dos pendentes'),
      numero('Reembolsado', dinheiro(devolvido, 'USD'), `${feitos.length} pedido${feitos.length === 1 ? '' : 's'} em 30 dias`, '', 'feito', 'feito'),
    );
  }

  // O contador por motivo (para análise): pedidos dos últimos 30 dias, com
  // os filtros de região e de tipo. Tocar num motivo filtra a lista por ele.
  function desenharMotivos() {
    const trintaDias = Date.now() - 30 * 86_400_000;
    const semMotivo = Object.assign({}, filtros, { motivo: '' });
    const base = pedidos.filter(p => Date.parse(inicio(p)) >= trintaDias && passaNosFiltros(p, semMotivo));
    const conta = {};
    for (const p of base) conta[p.motivo || 'nenhum'] = (conta[p.motivo || 'nenhum'] || 0) + 1;
    const chaves = [...Object.keys(ROTULO_MOTIVO), 'nenhum'].filter(c => conta[c]).sort((a, b) => conta[b] - conta[a]);
    const rotulo = c => (c === 'nenhum' ? 'Não disse' : ROTULO_MOTIVO[c]);
    $('motivos').replaceChildren(
      h('div', { class: 'motivos-titulo' },
        h('b', { text: 'Motivos' }),
        h('span', { class: 'apagado', text: ` · ${base.length} pedido${base.length === 1 ? '' : 's'} nos últimos 30 dias (${REGIAO[paisAtual()]})` })),
      chaves.length
        ? h('div', { class: 'motivos-lista' }, ...chaves.map(c => {
          const parte = Math.round((conta[c] / base.length) * 100);
          return h('button', {
            type: 'button', class: `motivo${filtros.motivo === c ? ' ativo' : ''}`, 'aria-pressed': String(filtros.motivo === c),
            onclick: () => { filtros.motivo = filtros.motivo === c ? '' : c; aba = 'todos'; desenhar(); },
          },
          h('span', { class: 'motivo-nome', text: rotulo(c) }),
          h('span', { class: 'motivo-barra', style: `--parte:${parte}%` }),
          h('span', { class: 'motivo-conta', text: `${conta[c]} · ${parte}%` }));
        }))
        : h('p', { class: 'apagado', style: 'margin:6px 0 0', text: 'Nenhum pedido nos últimos 30 dias.' }));
  }

  // ------------------------------------------------------------ filtros
  function desenharFiltros() {
    const seletor = (rotulo, chave, opcoes) => h('label', { class: 'filtro' },
      h('span', { text: rotulo }),
      h('select', { onchange: e => { filtros[chave] = e.target.value; desenhar(); } },
        ...opcoes.map(([valor, texto]) => h('option', { value: valor, text: texto, selected: filtros[chave] === valor }))));
    $('filtros').replaceChildren(...[
      seletor('Tipo', 'tipo', [['', 'Todos'], ['email', 'Veio por e-mail'], ['pagina', 'Pela página ou equipe'],
        ...Object.keys(ROTULO_TIPO).map(c => [c, `E-mail: ${tipoDe(c)[0]}`])]),
      seletor('Motivo', 'motivo', [['', 'Todos'], ...Object.entries(ROTULO_MOTIVO), ['nenhum', 'Não disse']]),
      filtros.tipo || filtros.motivo
        ? h('button', { type: 'button', class: 'botao botao-fantasma botao-pequeno', onclick: () => { filtros.tipo = ''; filtros.motivo = ''; desenhar(); } }, 'Limpar filtros')
        : null,
    ].filter(Boolean));
    // O que muda com o país: o título e o "Novo pedido" (só LATAM).
    $('sobre-pedidos').textContent = `Suporte · ${REGIAO[paisAtual()]}`;
    $('botao-novo').hidden = paisAtual() !== 'latam';
  }

  // A troca de país no topo (js/es/guia-suporte.js): redesenha a lista e
  // fecha a gaveta se o pedido aberto é do outro país.
  window.addEventListener('pais-mudou', () => {
    if (!pedidos.length && carregando) return;
    const p = aberto && pedidos.find(x => x.id === aberto);
    if (p && regiaoDe(p) !== paisAtual()) fecharGaveta();
    desenhar();
  });

  // ------------------------------------------------------------ abas e lista
  function desenharAbas() {
    const base = filtrados();
    $('abas').replaceChildren(...ABAS.map(a => h('button', {
      type: 'button', class: 'aba', role: 'tab', 'aria-selected': String(a.chave === aba),
      onclick: () => { aba = a.chave; desenhar(); },
    }, a.rotulo, h('span', { class: 'aba-conta', text: String(base.filter(a.filtro).length) }))));
  }

  const nomeDe = p => p.nome || p.email.split('@')[0];
  function produtosResumo(p) {
    if (p.sin_compra) return [h('span', { class: 'etiqueta procurar', text: '🔎 Sem compra: procurar' })];
    return (p.itens || []).map(i => {
      const marca = i.na_plataforma === 'disputa' ? 'perigo' : i.na_plataforma === 'devolvido' ? 'ok' : '';
      return h('span', { class: `etiqueta ${marca}`, text: i.nombre || i.produto || 'Compra' });
    });
  }
  // As etiquetas do cartão: região, se veio por e-mail (com o tipo) e o motivo.
  const etiquetasDoPedido = p => [
    p.email_tipo ? h('span', { class: 'etiqueta email', text: '✉ E-mail' }) : null,
    p.email_tipo ? h('span', { class: `etiqueta ${tipoDe(p.email_tipo)[1]}`, text: tipoDe(p.email_tipo)[0] }) : null,
    p.motivo ? h('span', { class: 'etiqueta motivo-etiqueta', text: ROTULO_MOTIVO[p.motivo] || p.motivo }) : null,
  ];

  function desenharLista() {
    const filtro = ABAS.find(a => a.chave === aba).filtro;
    const termo = $('busca').value.trim().toLowerCase();
    let visiveis = filtrados().filter(filtro);
    if (termo) {
      visiveis = visiveis.filter(p => [p.email, p.nome, p.nota, p.email_de, p.email_assunto, ...(p.itens || []).map(i => i.pedido)]
        .some(campo => (campo || '').toLowerCase().includes(termo)));
    }
    // Pendentes: o mais antigo primeiro (é o que está mais perto de estourar).
    if (['pendente', 'perto', 'atrasado', 'semcompra'].includes(aba)) visiveis.sort((a, b) => Date.parse(inicio(a)) - Date.parse(inicio(b)));
    if (!visiveis.length) {
      $('lista').replaceChildren(h('div', { class: 'vazio' },
        termo ? 'Nada encontrado com essa busca.' : aba === 'pendente' ? 'Nenhum pedido esperando. Fila zerada ✓' : 'Nenhum pedido aqui.'));
      return;
    }
    $('lista').replaceChildren(...visiveis.map(p => {
      const classe = classeEstado(p);
      const horas = horasDoPedido(p);
      const tempo = p.status === 'pendente'
        ? (atrasado(p) ? `passou ${duracao(horas - PRAZO_HORAS)} do prazo` : `faltam ${duracao(PRAZO_HORAS - horas)}`)
        : `${ROTULO_STATUS[p.status].toLowerCase()} ${dataHora(p.resuelto_en || p.atualizado_em)}`;
      const marca = prazo(p);
      return h('button', {
        type: 'button', class: `cartao vidro${marca ? ` prazo-${marca}` : ''}${p.sin_compra && p.status === 'pendente' ? ' sem-compra' : ''}${p.id === aberto ? ' aberto' : ''}`,
        onclick: () => abrirGaveta(p.id),
        'aria-label': `Pedido de ${nomeDe(p)}`,
      },
      h('span', { class: `ponto ${marca === 'perto' ? 'perto' : classe}` }),
      h('div', { class: 'cartao-quem' },
        h('div', { class: 'cartao-nome', text: nomeDe(p) }),
        h('div', { class: 'cartao-email', text: p.email }),
        h('div', { class: 'cartao-etiquetas' }, etiquetasDoPedido(p))),
      h('div', { class: 'cartao-itens' }, produtosResumo(p)),
      h('div', { class: 'cartao-valor', text: dinheiro(p.total_cents, p.moneda) }),
      h('div', { class: 'cartao-tempo' },
        h('span', { class: `etiqueta ${marca === 'perto' ? 'perto' : classe}`, text: atrasado(p) ? 'Atrasado' : marca === 'perto' ? 'Vencendo' : ROTULO_STATUS[p.status] }),
        h('div', { class: `tempo${marca ? ` tempo-${marca}` : ''}`, text: tempo })));
    }));
  }

  function desenhar() {
    desenharFiltros();
    desenharNumeros();
    desenharMotivos();
    desenharAbas();
    desenharLista();
  }
  $('busca').addEventListener('input', desenharLista);
  $('botao-atualizar').addEventListener('click', carregar);

  // ------------------------------------------------------------ a gaveta
  function abrirGaveta(id) {
    const p = pedidos.find(x => x.id === id);
    if (!p) return;
    // Link de um pedido do outro país: troca o país antes de abrir.
    if (regiaoDe(p) !== paisAtual() && window.REEMBOLSOS_PAIS) window.REEMBOLSOS_PAIS.trocar(regiaoDe(p));
    aberto = id;
    history.replaceState(null, '', `#${id}`);
    $('gaveta').hidden = false;
    $('fundo-gaveta').hidden = false;
    desenharGaveta(p);
    desenharLista();
    $('gaveta-corpo').scrollTop = 0;
  }
  function fecharGaveta() {
    aberto = '';
    $('gaveta').hidden = true;
    $('fundo-gaveta').hidden = true;
    // Sai o #<id> do pedido e volta o país (#latam ou #eua).
    if (/^#[0-9a-f-]{36}$/.test(location.hash)) history.replaceState(null, '', `${location.pathname}#${paisAtual()}`);
    if (pedidos.length) desenharLista();
  }
  $('fechar-gaveta').addEventListener('click', fecharGaveta);
  // Link com #pedido colado na mesma aba: abre o pedido.
  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && id !== aberto && pedidos.some(p => p.id === id)) abrirGaveta(id);
  });
  $('fundo-gaveta').addEventListener('click', fecharGaveta);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('janela').open && !$('gaveta').hidden) fecharGaveta(); });

  async function mudar(p, dados, mensagem) {
    const r = await reembolso('admin_atualizar', Object.assign({ id: p.id, regiao: regiaoDe(p) }, dados));
    if (!r.ok) { if (r.erro) avisar(r.erro, true); return false; }
    avisar(mensagem || 'Salvo ✓');
    carregar(); // sem esperar: a janela fecha já, e a lista chega logo depois
    return true;
  }

  function blocoCabeca(p) {
    const classe = classeEstado(p);
    const horas = horasDoPedido(p);
    const relogio = p.status === 'pendente'
      ? h('div', { class: `relogio${atrasado(p) ? ' atrasado' : perto(p) ? ' perto' : ''}` }, h('span', { class: `ponto ${perto(p) ? 'perto' : classe}` }),
        atrasado(p)
          ? h('span', {}, 'Pedido há ', h('b', { text: duracao(horas) }), ` · passou ${duracao(horas - PRAZO_HORAS)} do prazo de 24 h`)
          : h('span', {}, 'Pedido há ', h('b', { text: duracao(horas) }), ` · faltam ${duracao(PRAZO_HORAS - horas)} para o prazo de 24 h`))
      : h('div', { class: 'relogio' }, h('span', { class: `ponto ${classe}` }),
        h('span', {}, h('b', { text: ROTULO_STATUS[p.status] }), ` em ${dataHora(p.resuelto_en || p.atualizado_em)}`,
          p.resuelto_por ? ` por ${p.resuelto_por}` : ''));
    return h('div', {},
      h('h2', { text: nomeDe(p) }),
      h('div', { class: 'linha-etiquetas' },
        h('span', { class: `etiqueta ${classe}`, text: atrasado(p) ? 'Atrasado' : ROTULO_STATUS[p.status] }),
        h('span', { class: `etiqueta regiao-${regiaoDe(p)}`, text: REGIAO[regiaoDe(p)] }),
        p.canal === 'manual' ? h('span', { class: 'etiqueta azul', text: 'Registrado pela equipe' })
          : p.canal === 'email' ? h('span', { class: 'etiqueta email', text: '✉ Veio por e-mail' })
            : h('span', { class: 'etiqueta', text: 'Pela página' }),
        p.canal !== 'email' && p.email_tipo ? h('span', { class: 'etiqueta email', text: '✉ Também mandou e-mail' }) : null,
        p.outros_pedidos ? h('span', { class: 'etiqueta azul', text: `${p.outros_pedidos} outro${p.outros_pedidos > 1 ? 's' : ''} pedido${p.outros_pedidos > 1 ? 's' : ''} deste e-mail` }) : null),
      relogio);
  }

  // O que chegou na caixa de suporte (o leitor de e-mails, SQL 16). A
  // resposta à cliente é da automação do Lucas: daqui, só ler e abrir.
  function blocoEmailRecebido(p) {
    if (!p.email_tipo && !p.email_resumo && !p.email_trecho) return null;
    const [tipo, cor] = tipoDe(p.email_tipo);
    const link = linkDoGmail(p.email_link);
    const trecho = p.email_trecho
      ? h('details', { class: 'trecho' }, h('summary', { text: 'Ler o que ela escreveu' }), h('pre', { class: 'modelo-email', text: p.email_trecho }))
      : null;
    return h('section', { class: 'bloco bloco-email' },
      h('h3', { text: 'Veio por e-mail' }),
      h('div', { class: 'linha-etiquetas', style: 'margin:0 0 12px' },
        p.email_tipo ? h('span', { class: `etiqueta ${cor}`, text: tipo }) : null,
        p.motivo ? h('span', { class: 'etiqueta motivo-etiqueta', text: ROTULO_MOTIVO[p.motivo] || p.motivo }) : null),
      p.email_resumo ? h('p', { class: 'resumo', text: p.email_resumo }) : null,
      h('dl', { class: 'fatos', style: 'margin-bottom:12px' },
        h('dt', { text: 'Assunto' }), h('dd', { text: p.email_assunto || '—' }),
        h('dt', { text: 'De' }), h('dd', {}, p.email_de ? copia(p.email_de, 'E-mail copiado') : '—',
          p.email_de && p.email_de !== p.email ? h('span', { class: 'apagado', style: 'display:block;font-size:13px', text: 'É diferente do e-mail da compra.' }) : null),
        h('dt', { text: 'Recebido' }), h('dd', { text: p.email_recebido_em ? `${dataHora(p.email_recebido_em)} (Brasília)` : '—' }),
        h('dt', { text: 'Caixa' }), h('dd', { text: CAIXA[p.email_caixa] || p.email_caixa || '—' })),
      trecho,
      link ? h('div', { class: 'acoes', style: 'margin-top:12px' },
        h('a', { class: 'botao botao-claro botao-pequeno', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir no Gmail')) : null);
  }

  function blocoItens(p) {
    const bloco = h('section', { class: 'bloco' }, h('h3', { text: 'O que devolver' }));
    const eua = regiaoDe(p) === 'eua';
    if (p.sin_compra) {
      bloco.append(h('div', { class: 'alerta-caixa procurar' },
        h('b', { text: '🔎 Sem compra: procure. ' }),
        p.canal === 'email'
          ? 'O e-mail não bateu com nenhuma compra. Ela pode ter pago com outro e-mail. '
          : 'A página não achou compra com este e-mail. ',
        eua ? 'Use "Procurar a compra nas contas" (abaixo) ou procure na Digistore dos EUA pelo nome. '
          : 'Use "Procurar a compra nas contas" (abaixo) ou procure na Whop e na Digistore pelo nome. ',
        'Se precisar, peça o e-mail usado na compra ou os 4 últimos números do cartão.'));
    }
    const temDisputa = (p.itens || []).some(i => i.na_plataforma === 'disputa');
    if (temDisputa) {
      bloco.append(h('div', { class: 'alerta-caixa perigo' },
        h('b', { text: 'Disputa aberta no banco. ' }),
        `Ela já foi ao banco por esta cobrança. Não devolva por fora: o dinheiro pode sair duas vezes. Responda a disputa na ${eua ? 'Digistore' : 'Whop'} e anote aqui.`));
    }
    for (const i of p.itens || []) {
      const dias = i.pagado_en ? diasDesde(i.pagado_en) : null;
      const naWhop = i.origem === 'whop';
      const naDigi = i.origem === 'digistore';
      const codigo = naWhop || naDigi ? String(i.pedido || '') : String(i.pedido || '').replace(/^kashpay:/, '');
      const onde = naWhop ? 'Devolver na Whop (conta antiga)' : naDigi ? 'Digistore (EUA)' : 'Whop nova ou Digistore: conferir';
      const quemRegistrou = naWhop ? 'A Whop' : naDigi ? 'A Digistore' : 'A KashPay';
      const rotuloCodigo = naWhop ? 'ID do pagamento:' : naDigi ? 'Transação da Digistore:' : 'Transação da KashPay:';
      bloco.append(h('div', { class: 'item' },
        h('div', { class: 'item-topo' },
          h('span', { class: 'item-nome', text: i.nombre || i.produto || 'Compra' }),
          h('span', { class: 'item-valor', text: dinheiro(i.valor_cents, i.moneda) })),
        h('div', { class: 'item-detalhes' },
          h('span', { text: `Comprado em ${data(i.pagado_en)}` }),
          dias === null ? null : h('span', {
            class: `etiqueta ${dias <= GARANTIA_DIAS ? 'ok' : 'perigo'}`,
            text: dias <= GARANTIA_DIAS ? `dentro dos 7 dias (${dias} d)` : `fora da garantia (${dias} dias)`,
          }),
          h('span', { class: 'etiqueta azul', text: onde }),
          i.na_plataforma === 'devolvido' ? h('span', { class: 'etiqueta ok', text: `${quemRegistrou} já registrou a devolução` }) : null,
          i.na_plataforma === 'disputa' ? h('span', { class: 'etiqueta perigo', text: 'Disputa no banco' }) : null),
        h('div', { class: 'item-detalhes' },
          h('span', { text: rotuloCodigo }),
          copia(codigo, 'ID copiado'))));
    }
    if (!p.sin_compra) {
      bloco.append(h('div', { class: 'total' }, h('span', { text: 'Total pedido' }), h('b', { text: dinheiro(p.total_cents, p.moneda) })));
    }
    const todosRegistrados = (p.itens || []).length && p.itens.every(i => i.na_plataforma === 'devolvido');
    if (p.status === 'pendente' && todosRegistrados) {
      bloco.append(h('div', { class: 'alerta-caixa ok' },
        'A plataforma já registrou a devolução de tudo. Falta só marcar como reembolsado e avisar a cliente.'));
    }
    return bloco;
  }

  function blocoComoFazer(p) {
    if (p.status !== 'pendente') return null;
    const eua = regiaoDe(p) === 'eua';
    const temWhop = (p.itens || []).some(i => i.origem === 'whop');
    const temDigi = (p.itens || []).some(i => i.origem !== 'whop');
    return h('section', { class: 'bloco' }, h('h3', { text: 'Como fazer' }),
      h('ol', { class: 'passos' },
        h('li', {}, 'Use ', h('b', { text: 'Devolver pela API' }), ' (acima): procure, confira que é deste pedido e devolva com a senha. O pedido vira "Reembolsado" sozinho.'),
        eua
          ? h('li', {}, 'Se não achar, devolva à mão na ', h('b', { text: 'Digistore dos EUA' }), ': procure pelo e-mail dela e devolva o valor total.')
          : h('li', {}, 'Se não achar, ou se a compra for da Whop antiga, devolva à mão:'),
        !eua && (temWhop || p.sin_compra) ? h('li', {}, 'Na ', h('b', { text: 'Whop' }), ': Payments → cole o ID do pagamento na busca → Refund, valor total.') : null,
        // Desde 13/11 a Whop antiga está travada e as vendas novas passam pela
        // Whop nova ou pela Digistore, que ainda não avisam o app: a venda só
        // chega pela KashPay, que não diz quem cobrou.
        !eua && temDigi ? h('li', {}, 'Venda pela KashPay: procure pelo e-mail dela na ', h('b', { text: 'Whop nova' }), ' e nas ', h('b', { text: '2 contas da Digistore' }), ', e devolva o valor total onde achar.') : null,
        h('li', {}, 'Volte aqui e toque em ', h('b', { text: 'Reembolsado' }), '. Confira o valor devolvido.'),
        p.email_tipo
          ? h('li', {}, 'Ela pediu por e-mail: a resposta automática já disse "em até 24 h". Se quiser avisar que foi feito, use o ', h('b', { text: 'e-mail pronto' }), ' (mais abaixo) na mesma conversa do Gmail.')
          : h('li', {}, 'Copie o ', h('b', { text: 'e-mail pronto' }), ` (mais abaixo) e envie pela ${eua ? 'caixa dos EUA' : 'soporte@'}.`),
        h('li', {}, 'Se ela mudar de ideia, toque em ', h('b', { text: 'Desistiu' }), ' e anote o porquê.')));
  }

  function blocoCliente(p) {
    const acesso = p.acesso;
    const textoAcesso = !acesso ? 'Sem acesso registrado'
      : acesso.status === 'active' ? (acesso.expires_at ? `Ativo até ${data(acesso.expires_at)}` : 'Ativo, sem prazo')
        : 'Retirado';
    return h('section', { class: 'bloco' }, h('h3', { text: 'A cliente' }),
      h('dl', { class: 'fatos' },
        h('dt', { text: 'E-mail' }), h('dd', {}, copia(p.email, 'E-mail copiado')),
        h('dt', { text: 'Nome' }), h('dd', { text: p.nome || '—' }),
        h('dt', { text: 'País' }), h('dd', { text: NOME_PAIS(p.pais) || '—' }),
        h('dt', { text: 'Motivo' }), h('dd', { text: p.motivo ? ROTULO_MOTIVO[p.motivo] : 'Não disse' }),
        h('dt', { text: 'Pediu em' }), h('dd', { text: `${dataHora(p.created_at)} (Brasília)` }),
        h('dt', { text: 'Acesso ao app' }), h('dd', { text: textoAcesso }),
        h('dt', { text: 'Cliente desde' }), h('dd', { text: data(p.cliente_desde) })),
      !p.customer_id ? h('p', { class: 'apagado', style: 'margin:12px 0 0;font-size:13px', text: 'Este e-mail não tem cadastro no app.' })
        // O app dos EUA tem painel próprio (/en-admin): o "Acesso e produtos"
        // daqui fala com a latam-api e só serve para a LATAM.
        : regiaoDe(p) === 'eua' ? h('div', { class: 'acoes', style: 'margin-top:14px' },
          h('a', { class: 'botao botao-fantasma botao-pequeno', href: '/en-admin', target: '_blank', rel: 'noopener' }, 'Acesso no painel dos EUA'))
          : h('div', { class: 'acoes', style: 'margin-top:14px' },
            h('button', { type: 'button', class: 'botao botao-fantasma botao-pequeno', onclick: e => abrirProdutos(p, e.currentTarget) }, 'Acesso e produtos')));
  }

  function blocoEstado(p) {
    const botao = (status, rotulo, classe) => h('button', {
      type: 'button', class: `botao ${classe} botao-pequeno`, disabled: p.status === status,
      onclick: async e => {
        if (status === 'feito') return confirmarReembolso(p);
        e.currentTarget.disabled = true;
        await mudar(p, { status }, `Marcado: ${ROTULO_STATUS[status]} ✓`);
      },
    }, rotulo);
    return h('section', { class: 'bloco' }, h('h3', { text: 'Marcar como' }),
      h('div', { class: 'acoes' },
        botao('feito', '✓ Reembolsado', 'botao-verde'),
        botao('desistiu', 'Desistiu', 'botao-amarelo'),
        botao('recusado', 'Recusado', 'botao-fantasma'),
        p.status !== 'pendente' ? botao('pendente', 'Voltar para pendente', 'botao-fantasma') : null),
      p.status === 'feito' && p.valor_devolvido_cents !== null && p.valor_devolvido_cents !== p.total_cents
        ? h('p', { class: 'apagado', style: 'margin:12px 0 0;font-size:13px', text: `Devolvido: ${dinheiro(p.valor_devolvido_cents, p.moneda)} (de ${dinheiro(p.total_cents, p.moneda)} pedidos)` })
        : null);
  }

  function blocoEmail(p) {
    const primeiro = (p.nome || '').trim().split(/\s+/)[0] || '';
    if (regiaoDe(p) === 'eua') return blocoEmailIngles(p, primeiro);
    const ola = primeiro ? `Hola, ${primeiro}:` : 'Hola:';
    let assunto;
    let texto;
    if (p.status === 'feito') {
      const valor = dinheiro(p.valor_devolvido_cents ?? p.total_cents, p.moneda);
      assunto = 'Listo: te devolvimos tu dinero';
      texto = `${ola}\n\nYa hicimos tu reembolso de ${valor}. El dinero vuelve al mismo medio de pago que usaste. El plazo para verlo en tu cuenta depende de tu banco (normalmente de 5 a 10 días hábiles).\n\nNo necesitas hacer nada más.\n\nSi tienes cualquier duda, responde este correo.\n\nUn abrazo,\nEquipo 7 Amenes de la Madrugada`;
    } else if (p.sin_compra) {
      assunto = 'Tu pedido de reembolso';
      texto = `${ola}\n\nRecibimos tu pedido de reembolso, pero no encontramos una compra con este correo.\n\n¿Nos puedes enviar el correo que usaste al pagar, o los 4 últimos números de la tarjeta? Así lo resolvemos rápido.\n\nUn abrazo,\nEquipo 7 Amenes de la Madrugada`;
    } else if (p.status === 'pendente') {
      assunto = 'Recibimos tu pedido de reembolso';
      texto = `${ola}\n\nRecibimos tu pedido de reembolso de ${dinheiro(p.total_cents, p.moneda)}. Lo estamos procesando y te avisamos en cuanto esté listo, en hasta 24 horas.\n\nNo necesitas hacer nada más.\n\nUn abrazo,\nEquipo 7 Amenes de la Madrugada`;
    } else {
      return null;
    }
    return modeloDeEmail(p, 'E-mail pronto (espanhol)', assunto, texto);
  }

  // O e-mail pronto dos EUA, em inglês (a cliente de lá lê inglês).
  function blocoEmailIngles(p, primeiro) {
    const ola = primeiro ? `Hi ${primeiro},` : 'Hi,';
    const assinatura = 'With care,\n7 Amens Before Dawn team';
    // O valor no jeito americano ($69.00), não no brasileiro (US$ 69,00).
    const dinheiro = (centavos, moeda) => {
      try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (moeda || 'USD').toUpperCase() }).format((Number(centavos) || 0) / 100); }
      catch { return `$${((Number(centavos) || 0) / 100).toFixed(2)}`; }
    };
    let assunto;
    let texto;
    if (p.status === 'feito') {
      assunto = 'Done: your refund is on its way';
      texto = `${ola}\n\nWe have refunded ${dinheiro(p.valor_devolvido_cents ?? p.total_cents, p.moneda)}. The money goes back to the same card you paid with. How long it takes to show up depends on your bank (usually 5 to 10 business days).\n\nYou don't need to do anything else.\n\nIf you have any questions, just reply to this email.\n\n${assinatura}`;
    } else if (p.sin_compra) {
      assunto = 'Your refund request';
      texto = `${ola}\n\nWe received your refund request, but we couldn't find a purchase with this email.\n\nCould you send us the email you used to pay, or the last 4 digits of the card? That way we can sort it out quickly.\n\n${assinatura}`;
    } else if (p.status === 'pendente') {
      assunto = 'We received your refund request';
      texto = `${ola}\n\nWe received your refund request for ${dinheiro(p.total_cents, p.moneda)}. We're processing it and will let you know as soon as it's done, within 24 hours.\n\nYou don't need to do anything else.\n\n${assinatura}`;
    } else {
      return null;
    }
    return modeloDeEmail(p, 'E-mail pronto (inglês)', assunto, texto);
  }

  function modeloDeEmail(p, titulo, assunto, texto) {
    const mailto = `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
    return h('section', { class: 'bloco' }, h('h3', { text: titulo }),
      h('p', { class: 'apagado', style: 'margin:0 0 8px;font-size:13px' }, 'Assunto: ', h('span', { style: 'color:var(--texto)', text: assunto })),
      h('pre', { class: 'modelo-email', text: texto }),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'botao botao-claro botao-pequeno', onclick: () => copiar(texto, 'E-mail copiado') }, 'Copiar texto'),
        h('button', { type: 'button', class: 'botao botao-fantasma botao-pequeno', onclick: () => copiar(assunto, 'Assunto copiado') }, 'Copiar assunto'),
        h('a', { class: 'botao botao-fantasma botao-pequeno', href: mailto }, 'Abrir no e-mail')));
  }

  function blocoEditar(p) {
    const emReais = c => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
    const form = h('form', { class: 'form-editar', novalidate: true },
      h('label', { class: 'campo' }, h('span', { text: 'E-mail da cliente' }),
        h('input', { type: 'email', name: 'email', value: p.email, required: true })),
      h('div', { class: 'duas-colunas' },
        h('label', { class: 'campo' }, h('span', { text: `Valor pedido (${p.moneda})` }),
          h('input', { type: 'text', inputmode: 'decimal', name: 'total', value: emReais(p.total_cents) })),
        h('label', { class: 'campo' }, h('span', { text: `Valor devolvido (${p.moneda})` }),
          h('input', { type: 'text', inputmode: 'decimal', name: 'devolvido', value: emReais(p.valor_devolvido_cents), placeholder: 'igual ao pedido' }))),
      h('label', { class: 'campo' }, h('span', { text: 'Motivo' }),
        h('select', { name: 'motivo' },
          h('option', { value: '', text: 'Não disse' }),
          ...Object.entries(ROTULO_MOTIVO).map(([valor, rotulo]) => h('option', { value: valor, text: rotulo, selected: p.motivo === valor })))),
      h('label', { class: 'campo' }, h('span', { text: 'Anotação da equipe' }),
        h('textarea', { name: 'nota', maxlength: 2000, placeholder: 'Ex.: devolvido na Whop; ela pediu pelo WhatsApp…', text: p.nota || '' })),
      h('div', { class: 'acoes' },
        h('button', { type: 'submit', class: 'botao botao-claro botao-pequeno' }, 'Salvar alterações'),
        h('button', { type: 'button', class: 'botao botao-perigo botao-pequeno', onclick: () => confirmarExclusao(p) }, 'Excluir pedido')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const campos = form.elements;
      const total = paraCentavos(campos.total.value);
      const devolvido = campos.devolvido.value.trim() === '' ? null : paraCentavos(campos.devolvido.value);
      if (total === undefined || devolvido === undefined) { avisar('Valor inválido. Use só números, ex.: 21,00', true); return; }
      const dados = {};
      if (campos.email.value.trim().toLowerCase() !== p.email) dados.email = campos.email.value.trim();
      if (total !== p.total_cents) dados.total_cents = total;
      if (devolvido !== (p.valor_devolvido_cents ?? null)) dados.valor_devolvido_cents = devolvido;
      if ((campos.motivo.value || null) !== (p.motivo || null)) dados.motivo = campos.motivo.value || null;
      if (campos.nota.value.trim() !== (p.nota || '')) dados.nota = campos.nota.value;
      if (!Object.keys(dados).length) { avisar('Nada mudou.'); return; }
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true;
      await mudar(p, dados, 'Alterações salvas ✓');
      botao.disabled = false;
    });
    return h('section', { class: 'bloco' }, h('h3', { text: 'Editar' }), form);
  }

  // "21,00", "21.00", "21" -> 2100. Inválido -> undefined.
  function paraCentavos(texto) {
    const limpo = String(texto || '').trim().replace(/[^\d.,]/g, '');
    if (!limpo) return 0;
    const normal = /,\d{1,2}$/.test(limpo) ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '');
    const valor = Number(normal);
    if (!Number.isFinite(valor) || valor < 0 || valor > 100000) return undefined;
    return Math.round(valor * 100);
  }

  // ------------------------------------------------ devolver pela API (18/11)
  // Procura a compra pelo e-mail na Whop nova e nas 2 Digistores e devolve com
  // a senha do painel. O servidor confere tudo de novo antes de devolver.
  const SITUACAO = {
    paga: ['ok', 'Paga'], devolvida: ['', 'Já devolvida'], disputa: ['perigo', 'Disputa no banco'], outra: ['', ''],
  };
  function blocoApi(p) {
    const anterior = $('api-reembolso');
    if (anterior && anterior.dataset.pedido === p.id) return anterior;
    const caixa = h('section', { class: 'bloco', id: 'api-reembolso' });
    caixa.dataset.pedido = p.id;
    caixa.append(
      h('h3', { text: 'Devolver pela API' }),
      h('p', { class: 'apagado', style: 'margin:0 0 12px;font-size:14px', text: 'Procura as compras deste e-mail na Whop nova e nas 2 contas da Digistore (LATAM e EUA). Nada é devolvido sem você confirmar com a senha.' }),
      h('button', { type: 'button', class: 'botao botao-claro botao-pequeno', onclick: e => procurarNaApi(p, e.currentTarget) }, 'Procurar a compra nas contas'));
    return caixa;
  }

  async function procurarNaApi(p, botao) {
    const caixa = $('api-reembolso');
    if (botao) { botao.disabled = true; botao.textContent = 'Procurando…'; }
    const r = await reembolso('admin_localizar', { id: p.id, regiao: regiaoDe(p) });
    if (botao) { botao.disabled = false; botao.textContent = 'Procurar de novo'; }
    const resultado = h('div', { class: 'produtos', style: 'margin-top:14px' });
    if (!r.ok) {
      resultado.append(h('div', { class: 'alerta-caixa perigo', text: r.erro || 'Não deu para procurar.' }));
    } else {
      const { achados, erros, whop_antiga: antiga, tentativas } = r.corpo;
      for (const erro of erros) {
        resultado.append(h('div', { class: 'alerta-caixa perigo' }, h('b', { text: `${erro.conta_nome}: ` }), erro.erro));
      }
      if (antiga.length) {
        resultado.append(h('div', { class: 'alerta-caixa info' },
          'Cobrança da Whop antiga (travada desde 13/11): o painel não tem chave dela. Devolva à mão e marque como reembolsado.'));
      }
      if (!achados.length) {
        resultado.append(h('div', { class: 'vazio', style: 'padding:18px', text: `Nenhuma compra com ${r.corpo.email} nas contas que responderam.` }));
      }
      for (const a of achados) {
        const [classe, texto] = SITUACAO[a.situacao] || ['', a.situacao_texto];
        resultado.append(h('div', { class: 'compra-api' },
          h('div', { class: 'item-topo' },
            h('span', { class: 'item-nome', text: a.produto || a.conta_nome }),
            h('span', { class: 'item-valor', text: dinheiro(a.valor_cents, a.moeda) })),
          h('div', { class: 'item-detalhes' },
            h('span', { class: 'etiqueta azul', text: a.conta_nome }),
            a.bate ? h('span', { class: 'etiqueta ok', text: '✓ É deste pedido' }) : null,
            h('span', { class: `etiqueta ${classe}`, text: texto || a.situacao_texto || '—' }),
            h('span', { text: data(a.data) }),
            copia(a.ref, 'ID copiado')),
          a.situacao === 'paga'
            ? h('div', { class: 'acoes', style: 'margin-top:4px' },
              h('button', { type: 'button', class: `botao ${a.bate ? 'botao-verde' : 'botao-fantasma'} botao-pequeno`, onclick: () => confirmarApi(p, a) },
                `Devolver ${dinheiro(a.valor_cents, a.moeda)}`))
            : a.situacao === 'disputa'
              ? h('p', { class: 'apagado', style: 'margin:0;font-size:13px', text: 'Com disputa aberta, não devolva por fora: responda a disputa.' })
              : null));
      }
      if (tentativas && tentativas.length) {
        resultado.append(h('div', { style: 'margin-top:6px' },
          h('h3', { text: 'Tentativas deste pedido' }),
          ...tentativas.map(t => h('div', { class: 'item-detalhes', style: 'margin-bottom:4px' },
            h('span', { class: `etiqueta ${t.ok ? 'ok' : 'perigo'}`, text: t.ok ? 'Devolvida' : 'Falhou' }),
            h('span', { text: `${dataHora(t.created_at)} · ${dinheiro(t.valor_cents, t.moeda)} · ${t.resposta}` })))));
      }
    }
    const velho = caixa.querySelector('.produtos');
    if (velho) velho.replaceWith(resultado); else caixa.append(resultado);
  }

  function confirmarApi(p, a) {
    const senha = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Senha do painel' });
    const erro = h('p', { class: 'aviso-erro', role: 'alert', hidden: true });
    const devolver = h('button', { type: 'button', class: 'botao botao-perigo-cheio', onclick: async () => {
      if (!senha.value) { senha.focus(); return; }
      devolver.disabled = true;
      devolver.textContent = 'Devolvendo…';
      const r = await reembolso('admin_reembolsar', { id: p.id, regiao: regiaoDe(p), conta: a.conta, ref: a.ref, senha: senha.value });
      devolver.disabled = false;
      devolver.textContent = `Devolver ${dinheiro(a.valor_cents, a.moeda)}`;
      if (!r.ok) {
        erro.hidden = false;
        erro.textContent = r.erro || 'Não devolveu.';
        senha.value = '';
        senha.focus();
        return;
      }
      fecharJanela();
      avisar(`Devolvido: ${dinheiro(r.corpo.valor_cents, r.corpo.moeda)} ✓`);
      await procurarNaApi(p);
      carregar();
    } }, `Devolver ${dinheiro(a.valor_cents, a.moeda)}`);
    senha.addEventListener('keydown', e => { if (e.key === 'Enter') devolver.click(); });
    abrirJanela(
      h('h2', { text: 'Devolver o dinheiro agora?' }),
      h('dl', { class: 'fatos', style: 'margin-bottom:14px' },
        h('dt', { text: 'Cliente' }), h('dd', { text: p.email }),
        h('dt', { text: 'Onde' }), h('dd', { text: a.conta_nome }),
        h('dt', { text: 'Compra' }), h('dd', { text: `${a.produto || '—'} · ${data(a.data)}` }),
        h('dt', { text: 'ID' }), h('dd', { class: 'mono', text: a.ref }),
        h('dt', { text: 'Valor' }), h('dd', {}, h('b', { text: dinheiro(a.valor_cents, a.moeda) }))),
      a.bate ? null : h('div', { class: 'alerta-caixa perigo', text: 'Esta compra não bate com o pedido (outro valor ou outra data). Confira antes de devolver.' }),
      h('p', { text: 'O dinheiro volta para o cartão dela e não dá para desfazer. O pedido vira "Reembolsado" sozinho.' }),
      h('label', { class: 'campo' }, h('span', { text: 'Senha do painel' }), senha),
      erro,
      h('div', { class: 'janela-acoes' },
        h('button', { type: 'button', class: 'botao botao-fantasma', onclick: fecharJanela }, 'Cancelar'),
        devolver));
    senha.focus();
  }

  function desenharGaveta(p) {
    $('gaveta-id').textContent = `#${p.id.slice(0, 8)}`;
    $('gaveta-corpo').replaceChildren(...[
      blocoCabeca(p),
      blocoEmailRecebido(p),
      blocoItens(p),
      blocoApi(p),
      blocoComoFazer(p),
      blocoEstado(p),
      blocoEmail(p),
      blocoCliente(p),
      // O bloco de produtos, se já aberto para este pedido, fica como está
      // (redesenhar pediria a ficha de novo ao servidor).
      (() => {
        const anterior = $('produtos-cliente');
        return anterior && anterior.dataset.pedido === p.id ? anterior : h('div', { id: 'produtos-cliente' });
      })(),
      blocoEditar(p),
    ].filter(Boolean));
  }

  // ------------------------------------------------------------ janelas
  function abrirJanela(...filhos) {
    const janela = $('janela');
    janela.replaceChildren(...filhos.filter(Boolean));
    if (!janela.open) janela.showModal();
    return janela;
  }
  const fecharJanela = () => $('janela').close();

  function confirmarReembolso(p) {
    const valor = h('input', { type: 'text', inputmode: 'decimal', value: ((p.valor_devolvido_cents ?? p.total_cents) / 100).toFixed(2).replace('.', ',') });
    const nota = h('textarea', { maxlength: 2000, placeholder: 'Opcional: ex.: devolvido na Whop às 14h', text: p.nota || '' });
    const confirmar = h('button', { type: 'button', class: 'botao botao-verde', onclick: async () => {
      const centavos = paraCentavos(valor.value);
      if (centavos === undefined) { avisar('Valor inválido.', true); return; }
      confirmar.disabled = true;
      const dados = { status: 'feito', valor_devolvido_cents: centavos };
      if (nota.value.trim() !== (p.nota || '')) dados.nota = nota.value;
      const ok = await mudar(p, dados, 'Marcado como reembolsado ✓');
      confirmar.disabled = false;
      if (ok) fecharJanela();
    } }, '✓ Confirmar reembolso');
    abrirJanela(
      h('h2', { text: 'Marcar como reembolsado' }),
      h('p', { text: `Confirme que você já devolveu o dinheiro de ${p.email} na ${regiaoDe(p) === 'eua' ? 'Digistore dos EUA' : (p.itens || []).length && (p.itens || []).every(i => i.origem === 'whop') ? 'Whop' : 'Whop ou na Digistore'}. Este botão só marca; quem devolve pelo painel é o "Devolver pela API".` }),
      h('label', { class: 'campo' }, h('span', { text: `Valor devolvido (${p.moneda})` }), valor),
      h('label', { class: 'campo', style: 'margin-top:12px' }, h('span', { text: 'Anotação' }), nota),
      h('div', { class: 'janela-acoes' },
        h('button', { type: 'button', class: 'botao botao-fantasma', onclick: fecharJanela }, 'Cancelar'),
        confirmar));
    valor.focus();
  }

  function confirmarExclusao(p) {
    const apagar = h('button', { type: 'button', class: 'botao botao-perigo-cheio', onclick: async () => {
      apagar.disabled = true;
      const r = await reembolso('admin_excluir', { id: p.id, regiao: regiaoDe(p) });
      apagar.disabled = false;
      if (!r.ok) { if (r.erro) avisar(r.erro, true); return; }
      fecharJanela();
      fecharGaveta();
      avisar('Pedido excluído');
      await carregar();
    } }, 'Excluir de vez');
    abrirJanela(
      h('h2', { text: 'Excluir este pedido?' }),
      h('p', { text: `O pedido de ${p.email} (${dinheiro(p.total_cents, p.moneda)}) some da lista para sempre. Fica anotado no histórico quem excluiu e quando.` }),
      h('p', { text: 'Para registrar que ela mudou de ideia, use "Desistiu" em vez de excluir.' }),
      h('div', { class: 'janela-acoes' },
        h('button', { type: 'button', class: 'botao botao-fantasma', onclick: fecharJanela }, 'Cancelar'),
        apagar));
  }

  // Novo pedido: o que chegou por e-mail ou WhatsApp.
  $('botao-novo').addEventListener('click', () => {
    const email = h('input', { type: 'email', inputmode: 'email', placeholder: 'e-mail da compra', autocomplete: 'off' });
    const compras = h('div', { class: 'produtos', style: 'margin-top:12px' });
    const nota = h('textarea', { maxlength: 2000, placeholder: 'Ex.: pediu pelo WhatsApp às 10h' });
    let achado = null;
    const buscarBotao = h('button', { type: 'submit', class: 'botao botao-fantasma' }, 'Buscar compras');
    const salvar = h('button', { type: 'button', class: 'botao botao-claro', disabled: true, onclick: async () => {
      if (!achado) return;
      const marcados = [...compras.querySelectorAll('input:checked')].map(c => c.value);
      salvar.disabled = true;
      const r = await reembolso('admin_criar', { email: achado.email, pedidos: marcados, nota: nota.value });
      salvar.disabled = false;
      if (!r.ok) { if (r.erro) avisar(r.erro, true); return; }
      fecharJanela();
      avisar('Pedido registrado ✓');
      aba = 'pendente';
      await carregar();
      abrirGaveta(r.corpo.id);
    } }, 'Registrar pedido');
    const form = h('form', { novalidate: true }, h('div', { style: 'display:flex;gap:8px;align-items:end' },
      h('label', { class: 'campo', style: 'flex:1' }, h('span', { text: 'E-mail da cliente' }), email), buscarBotao));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      buscarBotao.disabled = true;
      const r = await reembolso('admin_compras', { email: email.value });
      buscarBotao.disabled = false;
      if (!r.ok) { if (r.erro) avisar(r.erro, true); return; }
      achado = r.corpo;
      salvar.disabled = false;
      const lista = achado.compras || [];
      compras.replaceChildren(
        h('p', { style: 'margin:0', text: lista.length
          ? `${achado.cliente && achado.cliente.name ? achado.cliente.name + ' · ' : ''}${achado.email}: marque o que ela quer devolver.`
          : `Nenhuma compra com ${achado.email}. Dá para registrar mesmo assim (fica como "compra não encontrada").` }),
        ...lista.map(c => h('label', { class: `compra-marcar${c.devuelto ? ' devolvida' : ''}` },
          h('input', { type: 'checkbox', value: c.pedido, checked: lista.length === 1 && !c.devuelto, disabled: c.devuelto }),
          h('span', {},
            h('b', { text: `${c.nombre} · ${dinheiro(c.valor_cents, c.moneda)}` }),
            h('br'),
            h('span', { class: 'apagado', text: `${data(c.pagado_en)} · ${c.origem === 'whop' ? 'Whop' : 'KashPay/Digistore'}${c.devuelto ? ' · já devolvida' : ''}${c.pedido_abierto ? ' · já tem pedido aberto' : ''}` })))));
    });
    abrirJanela(
      h('h2', { text: 'Registrar pedido de reembolso (LATAM)' }),
      h('p', { text: 'Para quem pediu pelo WhatsApp ou num e-mail que não entrou sozinho. Busque pelo e-mail, marque as compras e registre. Só para a LATAM.' }),
      form, compras,
      h('label', { class: 'campo', style: 'margin-top:12px' }, h('span', { text: 'Anotação' }), nota),
      h('div', { class: 'janela-acoes' },
        h('button', { type: 'button', class: 'botao botao-fantasma', onclick: fecharJanela }, 'Cancelar'),
        salvar));
    email.focus();
  });

  // ------------------------------------------------------------ produtos
  // Usa a latam-api, como o /es-admin: liberar ou retirar o app e os extras,
  // e copiar o link de entrada. Só quando a equipe pede (é a consulta mais
  // pesada do painel).
  const EXTRAS = [
    { chave: 'arcangeles', nome: 'Arcángeles (UP01)' },
    { chave: 'cantico', nome: 'Cántico Angelical (UP02)' },
  ];
  const ORIGEM_EXTRA = { compra: 'Tem · pela compra', duvida: 'Tem · liberado na dúvida', manual: 'Tem · liberado na mão', retirado: 'Retirado na mão' };

  async function abrirProdutos(p, botao) {
    const lugar = $('produtos-cliente');
    lugar.dataset.pedido = p.id;
    if (botao) botao.disabled = true;
    lugar.replaceChildren(h('section', { class: 'bloco' }, h('h3', { text: 'Acesso e produtos' }), h('p', { class: 'apagado', text: 'Carregando…' })));
    const r = await api('admin_customer_detail', { customer_id: p.customer_id });
    if (botao) botao.disabled = false;
    if (!r.ok) {
      lugar.replaceChildren(h('section', { class: 'bloco' }, h('h3', { text: 'Acesso e produtos' }),
        h('p', { class: 'aviso-erro', text: r.status === 403 ? 'Sua conta não tem permissão de painel na latam-api.' : r.erro })));
      return;
    }
    const ficha = r.corpo;
    const acesso = ficha.access;
    const ativo = acesso && acesso.status === 'active' && (!acesso.expires_at || Date.parse(acesso.expires_at) > Date.now());
    const origem = (ficha.extras && ficha.extras.origem) || {};
    const acao = (rotulo, classe, action, dados, mensagem, pergunta) => h('button', {
      type: 'button', class: `botao ${classe} botao-pequeno`,
      onclick: async e => {
        if (pergunta && !window.confirm(pergunta)) return;
        e.currentTarget.disabled = true;
        const resposta = await api(action, Object.assign({ customer_id: p.customer_id }, dados));
        if (!resposta.ok) { if (resposta.erro) avisar(resposta.erro, true); e.currentTarget.disabled = false; return; }
        avisar(mensagem);
        await abrirProdutos(p);
        carregar();
      },
    }, rotulo);
    const linhaExtra = extra => {
      const tem = origem[extra.chave] && origem[extra.chave] !== 'retirado';
      return h('div', { class: 'produto-linha' },
        h('span', {}, h('b', { text: extra.nome }), h('br'), h('span', { class: 'apagado', text: ORIGEM_EXTRA[origem[extra.chave]] || 'Não tem' })),
        tem
          ? acao('Retirar', 'botao-perigo', 'admin_revoke_extra', { product: extra.chave }, `${extra.nome}: retirado`, `Retirar ${extra.nome} de ${p.email}?`)
          : acao('Liberar', 'botao-verde', 'admin_grant_extra', { product: extra.chave }, `${extra.nome}: liberado ✓`));
    };
    lugar.replaceChildren(h('section', { class: 'bloco' }, h('h3', { text: 'Acesso e produtos' }),
      h('div', { class: 'produtos' },
        h('div', { class: 'produto-linha' },
          h('span', {}, h('b', { text: 'App 7 Amenes' }), h('br'),
            h('span', { class: 'apagado', text: !acesso ? 'Sem acesso' : ativo ? (acesso.expires_at ? `Ativo até ${data(acesso.expires_at)}` : 'Ativo') : 'Sem acesso (retirado ou vencido)' })),
          ativo
            ? acao('Retirar acesso', 'botao-perigo', 'admin_revoke_access', {}, 'Acesso retirado', `Retirar o acesso ao app de ${p.email}? Ela deixa de entrar.`)
            : acao('Liberar 12 meses', 'botao-verde', 'admin_grant_access', {}, 'Acesso liberado ✓')),
        ...EXTRAS.map(linhaExtra),
        h('div', { class: 'produto-linha' },
          h('span', {}, h('b', { text: 'Link de entrada' }), h('br'), h('span', { class: 'apagado', text: 'Entra no app sem digitar o e-mail' })),
          h('button', { type: 'button', class: 'botao botao-fantasma botao-pequeno', onclick: async () => {
            const resposta = await api('admin_entry_link', { customer_id: p.customer_id });
            if (!resposta.ok) { if (resposta.erro) avisar(resposta.erro, true); return; }
            copiar(`${location.origin}/es-entrar#${resposta.corpo.entry_link.token}`, 'Link copiado');
          } }, 'Copiar link'))),
      h('p', { class: 'apagado', style: 'margin:12px 0 0;font-size:13px', text: 'Reembolso não tira o acesso sozinho (regra de 05/11). Retire só se a equipe decidir.' })));
  }

  // ------------------------------------------------------------ começo
  if (ler()) abrirPainel(); else mostrarEntrar();
})();
