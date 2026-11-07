// O painel do app em espanhol (/es-admin, 07/11/2026). CÓPIA ADAPTADA do
// js/admin.js do Brasil: o mesmo desenho e as mesmas funções, com os dados da
// LATAM. Fala só com a latam-api (ações admin_*), que lê e grava só tabelas
// latam_. Arquivo só da LATAM.
//
// O que muda em relação ao Brasil:
//   - o produto que dá acesso é um só, o app ('app' em latam_access), por 12
//     meses;
//   - os extras (Arcángeles e Cántico) entraram no app em 07/11/2026. Quem tem
//     cada um sai da compra (o pedido da KashPay) ou da dúvida (venda sem
//     pedido: libera os dois). A ficha mostra a origem e tem "Liberar" e
//     "Retirar", que mandam por cima da compra (supabase/latam/05-extras.sql);
//   - quem comprou o quê sai dos pedidos da KashPay. Venda de antes de 06/11,
//     22:54 não tem pedido: aparece como "sem registro do produto";
//   - não há formulário de perfil.
(() => {
  const status = document.getElementById('admin-status');
  const dashboard = document.getElementById('admin-dashboard');
  const refreshButton = document.getElementById('admin-refresh');
  const search = document.getElementById('customer-search');
  const grantForm = document.getElementById('grant-form');
  const grantStatus = document.getElementById('grant-status');
  const detail = document.getElementById('customer-detail');
  const detailBody = document.getElementById('detail-body');

  // 'desatanudos' é a chave interna do UP02, que é o Cántico Angelical (o nome
  // antigo da oferta na KashPay; ver supabase/latam/03-popups.sql).
  const EXTRAS = [
    { key: 'arcangeles', codigo: 'UP01', title: 'Oraciones a los Santos Arcángeles' },
    { key: 'desatanudos', codigo: 'UP02', title: 'Cántico Angelical' },
  ];
  const nomeDoProduto = { principal: 'App (7 Amenes)', arcangeles: 'UP01 · Arcángeles', desatanudos: 'UP02 · Cántico Angelical' };
  const dayLabels = ['Comienza aquí', 'Dia 1 — Pai Nosso', 'Dia 2 — Perdão', 'Dia 3 — Cura', 'Dia 4 — Libertação', 'Dia 5 — Prosperidade', 'Dia 6 — Paz', 'Dia 7 — Aliança'];
  const actionLabels = {
    grant_access: 'Liberou o acesso', revoke_access: 'Revogou o acesso', update_email: 'Corrigiu o e-mail',
    entry_link: 'Criou o link de entrada', renew_entry_link: 'Trocou o link de entrada',
    grant_extra: 'Liberou um extra no app', revoke_extra: 'Retirou um extra do app',
  };
  // Os extras dentro do app (latam-api: admin_grant_extra / admin_revoke_extra).
  const EXTRAS_NO_APP = [
    { key: 'arcangeles', title: 'UP01 · Central de los Cuatro Arcángeles' },
    { key: 'cantico', title: 'UP02 · Cántico Angelical' },
  ];
  const origemLabels = {
    compra: 'Tem · pela compra',
    duvida: 'Tem · venda sem registro do produto (liberado na dúvida)',
    manual: 'Tem · liberado na mão',
    retirado: 'Retirado na mão',
  };
  const nomeDoExtra = { arcangeles: 'Arcángeles', cantico: 'Cántico' };
  const sourceLabels = { whop: 'pela compra', import: 'pela carga inicial', manual: 'liberado na mão' };

  let customers = [];

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  // --- datas do painel ---------------------------------------------------
  // Sempre no horário de Brasília (quem opera é a equipe brasileira), nunca no
  // relógio de quem abriu a página. Data sem hora ("2026-11-06") só é
  // reordenada: convertida, ela recuaria um dia.
  const FUSO = 'America/Sao_Paulo';
  const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  const day = value => {
    if (!value) return '—';
    const partes = SO_DATA.exec(String(value));
    if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`;
    return new Date(value).toLocaleDateString('pt-BR', { timeZone: FUSO });
  };
  const moment = value => (value
    ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO })
    : '—');
  const hour = value => (value
    ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
    : '—');

  const api = (action, payload = {}) => window.AMENES.admin(action, payload);

  // --- quem conta --------------------------------------------------------
  // As administradoras ficam fora de toda conta: são da equipe.
  const ativa = c => c.access_status === 'active' && (!c.expires_at || Date.parse(c.expires_at) > Date.now());
  const temProduto = (c, key) => Array.isArray(c.products) && c.products.includes(key);
  const semRegistro = c => (c.unknown_payments || 0) > 0;
  const entrou = c => (c.visit_days || 0) > 0 || Boolean(c.first_access_on);
  const clientes = () => customers.filter(c => !c.is_admin);

  // --- a mesma regra do Brasil: PORCENTAGEM COM BASE PEQUENA MENTE --------
  const BASE_CONFIAVEL = 30;
  const BASE_MINIMA = 10;
  function taxa(parte, base) {
    const bruto = `${parte} de ${base}`;
    if (!base) return { destaque: '—', apoio: 'sem base', fraca: true, pct: null };
    const pct = 100 * parte / base;
    const texto = `${pct.toFixed(1).replace('.', ',')}%`;
    if (base >= BASE_CONFIAVEL) return { destaque: texto, apoio: bruto, fraca: false, pct };
    if (base >= BASE_MINIMA) return { destaque: bruto, apoio: `${texto} — base pequena`, fraca: true, pct };
    return { destaque: bruto, apoio: 'poucas clientes para concluir', fraca: true, pct: null };
  }

  const chip = texto => element('span', 'admin-chip-up', texto);
  function barra(pct, fraca) {
    const trilho = element('div', `admin-bar${fraca ? ' is-thin' : ''}`);
    const cheio = element('div', 'admin-bar-fill');
    cheio.style.width = `max(3px, ${Math.max(0, pct || 0)}%)`;
    trilho.append(cheio);
    return trilho;
  }
  function bloco(titulo, pergunta) {
    const secao = element('section', 'admin-block');
    secao.append(element('h3', '', titulo));
    if (pergunta) secao.append(element('p', 'admin-block-q', pergunta));
    return secao;
  }
  const nota = texto => element('p', 'admin-note', texto);
  function linhaMatriz(colunas) {
    const linha = element('div', 'admin-matrix-row');
    colunas.forEach(coluna => linha.append(coluna));
    return linha;
  }
  function contadorCard(label, valor, apoio) {
    const card = element('article', 'admin-kpi');
    card.append(element('span', '', label), element('strong', '', String(valor)), element('small', '', apoio));
    return card;
  }
  function funnelCard(label, parte, total, unidade) {
    const card = element('article', 'admin-kpi');
    const t = taxa(parte, total);
    card.append(element('span', '', label), element('strong', '', t.destaque),
      element('small', '', t.fraca ? t.apoio : `${t.apoio} ${unidade}`));
    return card;
  }

  function renderFunnel() {
    const area = document.getElementById('admin-analise');
    const base = clientes().filter(ativa);
    const comRegistro = base.filter(c => !semRegistro(c));
    const blocos = [];

    blocos.push(element('p', 'admin-baseline',
      `${base.length} clientes com o app ativo hoje. Toda porcentagem desta página é sobre elas, menos onde estiver dito.`));

    const topo = element('div', 'admin-funnel');
    topo.append(
      contadorCard('Clientes com acesso', base.length, 'com o app ativo'),
      funnelCard('Entraram no app', base.filter(entrou).length, base.length, 'clientes'),
      funnelCard('Levaram algum extra', comRegistro.filter(c => EXTRAS.some(e => temProduto(c, e.key))).length, comRegistro.length, 'clientes'),
    );
    blocos.push(topo);

    // Os extras, sobre quem tem o produto registrado: quem comprou antes de a
    // KashPay avisar não tem como entrar na conta, nem para mais nem para menos.
    const extras = bloco('Os extras', 'De quem tem o app (com a compra registrada), quantas levaram cada extra?');
    extras.append(element('p', 'admin-legend', EXTRAS.map(e => `${e.codigo} = ${e.title}`).join(' · ')));
    EXTRAS.forEach(extra => {
      const n = comRegistro.filter(c => temProduto(c, extra.key)).length;
      const t = taxa(n, comRegistro.length);
      extras.append(linhaMatriz([
        chip(extra.codigo),
        element('span', 'admin-matrix-nome', extra.title),
        element('strong', 'admin-matrix-num', String(n)),
        element('span', 'admin-matrix-pct', t.fraca ? '' : t.destaque),
        barra(t.pct, t.fraca),
      ]));
    });
    const levaramOs2 = comRegistro.filter(c => EXTRAS.every(e => temProduto(c, e.key))).length;
    extras.append(element('p', 'admin-block-foot', `${levaramOs2} levaram os dois extras.`));
    const fora = base.length - comRegistro.length;
    if (fora) extras.append(nota(`${fora} ${fora === 1 ? 'cliente comprou' : 'clientes compraram'} antes de 06/11, às 22:54, quando a KashPay ainda não avisava o produto. Elas ficam fora desta conta, e o pop-up não aparece para elas.`));
    blocos.push(extras);

    // De onde elas são (o país do cartão, como a Whop mandou).
    const paises = new Map();
    base.forEach(c => { const p = c.country || '—'; paises.set(p, (paises.get(p) || 0) + 1); });
    const ordem = [...paises.entries()].sort((a, b) => b[1] - a[1]);
    if (ordem.length) {
      const pais = bloco('De onde elas são', 'O país do cartão de quem tem o app ativo.');
      ordem.slice(0, 12).forEach(([sigla, n]) => {
        const t = taxa(n, base.length);
        pais.append(linhaMatriz([
          chip(sigla),
          element('span', 'admin-matrix-nome', `${n} ${n === 1 ? 'cliente' : 'clientes'}`),
          element('strong', 'admin-matrix-num', String(n)),
          element('span', 'admin-matrix-pct', t.fraca ? '' : t.destaque),
          barra(t.pct, t.fraca),
        ]));
      });
      blocos.push(pais);
    }

    area.replaceChildren(...blocos);
  }

  function renderCampaign(campaign) {
    const card = element('article', 'admin-campaign');
    const top = element('div', 'admin-campaign-top');
    top.append(element('h3', '', campaign.headline));
    top.append(element('span', `admin-badge${campaign.enabled ? ' active' : ''}`, campaign.enabled ? 'Ativa' : 'Desligada'));
    const produto = nomeDoProduto[campaign.offered_product] || 'Produto';
    const quando = campaign.min_journey_day ? `a partir do ${campaign.min_journey_day}º dia de app` : 'na entrada';
    const chamada = String(campaign.eyebrow || '').split('\n').slice(-1)[0];
    const meta = element('p', 'admin-campaign-meta', `${produto} · ${quando}${chamada ? ` · ${chamada}` : ''} · ${campaign.key}`);
    const metrics = element('div', 'admin-campaign-metrics');
    [['Exibida', campaign.shown], ['Cliques', campaign.clicked], ['Recusas', campaign.dismissed], ['Compras', campaign.purchases]].forEach(([label, value]) => {
      const item = element('span'); item.append(element('strong', '', String(value)), document.createTextNode(String(label))); metrics.append(item);
    });
    card.append(top, meta, metrics);
    return card;
  }

  function etapa(c) {
    if (!ativa(c)) return c.access_status === 'revoked' ? 'Acesso revogado' : c.access_status ? 'Acesso vencido' : 'Sem acesso';
    if (c.is_admin) return 'Administradora';
    if (semRegistro(c) && !(c.products || []).length) return 'App · compra sem registro do produto';
    const extras = EXTRAS.filter(e => temProduto(c, e.key)).map(e => e.codigo);
    return extras.length ? `App · ${extras.join(' · ')}` : 'Só o app';
  }

  function renderCustomer(customer) {
    const card = element('article', 'admin-customer');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const top = element('div', 'admin-customer-top');
    const displayName = customer.name?.trim() || customer.email.split('@')[0];
    const initial = element('span', 'admin-initial', displayName.charAt(0).toUpperCase());
    const main = element('div', 'admin-customer-main');
    main.append(element('h3', '', displayName), element('p', '', customer.email), element('span', 'admin-stage', etapa(customer)));
    top.append(initial, main);
    const stats = element('div', 'admin-customer-stats');
    [['Dias', customer.visit_days || 0], ['Orações', customer.days_prayed || 0], ['País', customer.country || '—']].forEach(([label, value]) => {
      const item = element('div'); item.append(element('strong', '', String(value)), element('span', '', String(label))); stats.append(item);
    });
    card.append(top, stats);
    const open = () => openDetail(customer.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    return card;
  }

  function block(title, nodes, emptyText) {
    const section = element('section', 'admin-detail-block');
    section.append(element('h3', '', title));
    if (!nodes.length) section.append(element('p', 'admin-empty', emptyText));
    else nodes.forEach(node => section.append(node));
    return section;
  }
  function line(label, value, variant = '') {
    const row = element('div', `admin-detail-line${variant ? ` ${variant}` : ''}`);
    row.append(element('span', '', label), element('strong', '', value));
    return row;
  }

  function renderAccess(data) {
    const customer = data.customer;
    const access = data.access;
    const ativo = access && access.status === 'active' && (!access.expires_at || Date.parse(access.expires_at) > Date.now());
    const row = element('div', `admin-detail-line${ativo ? ' is-active' : ' is-off'}`);
    const situacao = !access ? 'Nunca teve'
      : access.status === 'revoked' ? `Revogado em ${moment(access.revoked_at)}`
      : !ativo ? `Venceu em ${day(access.expires_at)}`
      : `Ativo ${access.expires_at ? `até ${day(access.expires_at)}` : 'sem prazo'} · ${sourceLabels[access.source] || access.source}`;
    row.append(element('span', '', 'App em espanhol'), element('strong', '', situacao));
    const button = element('button', 'admin-mini-btn', ativo ? 'Revogar' : 'Liberar');
    button.type = 'button';
    button.addEventListener('click', () => act(
      ativo ? 'admin_revoke_access' : 'admin_grant_access',
      { customer_id: customer.id },
      ativo ? `Revogar o acesso de ${customer.email} ao app em espanhol? Ela deixa de entrar na hora.`
        : `Liberar o app em espanhol para ${customer.email} por 12 meses?`,
      customer.id,
    ));
    row.append(button);
    return block('Acesso', [row], '');
  }

  // --- os extras dentro do app (07/11/2026) -------------------------------
  // "Liberar" e "Retirar" mandam por cima da compra: retirar tira até de quem
  // comprou; liberar de novo devolve. Sem prazo próprio: vale enquanto o app
  // valer. Não mexe no e-mail de entrega da KashPay.
  function renderExtras(data) {
    const customer = data.customer;
    if (!data.extras) return block('Extras no app', [], 'Não foi possível ler os extras agora (o banco ainda sem 05-extras.sql?).');
    const linhas = EXTRAS_NO_APP.map(extra => {
      const origem = data.extras.origem[extra.key];
      const tem = Boolean(origem) && origem !== 'retirado';
      const row = element('div', `admin-detail-line${tem ? ' is-active' : ' is-off'}`);
      row.append(element('span', '', extra.title), element('strong', '', origem ? origemLabels[origem] || origem : 'Não tem'));
      const button = element('button', 'admin-mini-btn', tem ? 'Retirar' : 'Liberar');
      button.type = 'button';
      button.addEventListener('click', () => act(
        tem ? 'admin_revoke_extra' : 'admin_grant_extra',
        { customer_id: customer.id, product: extra.key },
        tem ? `Retirar ${extra.title} do app de ${customer.email}? O card volta a mostrar o cadeado na próxima vez que ela abrir o app.`
          : `Liberar ${extra.title} no app para ${customer.email}?`,
        customer.id,
      ));
      row.append(button);
      return row;
    });
    const dias = data.extras.cantico_hechos || [];
    linhas.push(line('Dias do Cántico terminados', dias.length ? dias.join(', ') : 'nenhum'));
    return block('Extras no app', linhas, '');
  }

  // --- link de entrada ---------------------------------------------------
  // Para quem não consegue digitar o e-mail: o suporte copia e manda; ela toca
  // e entra direto. Copiar de novo devolve o MESMO link; só "Trocar link"
  // mata o antigo. A mensagem é em espanhol (vai para a cliente) e não usa o
  // nome dela: o cadastro pode estar no nome de quem pagou.
  const mensagemDoLink = endereco => '¡Hola! Este es tu enlace para entrar en la aplicación 7 Amenes de la Madrugada. Solo tócalo:\n\n'
    + `${endereco}\n\n`
    + 'Guarda este mensaje. Siempre que la aplicación te pida tu correo, toca el enlace otra vez.';

  async function copiar(texto, botao) {
    const original = botao.textContent;
    let copiou = false;
    try { await navigator.clipboard.writeText(texto); copiou = true; } catch {}
    if (!copiou) {
      const caixa = element('textarea');
      caixa.value = texto; caixa.readOnly = true; caixa.style.position = 'fixed'; caixa.style.opacity = '0';
      detailBody.append(caixa);
      caixa.select();
      try { copiou = document.execCommand('copy'); } catch {}
      caixa.remove();
    }
    botao.textContent = copiou ? 'Copiado!' : 'Não copiou: selecione o link e copie';
    setTimeout(() => { botao.textContent = original; }, 2500);
  }

  async function pedirLink(customerId, renew) {
    try {
      await api('admin_entry_link', { customer_id: customerId, renew });
      await openDetail(customerId);
    } catch (error) {
      window.alert(error.message);
    }
  }

  function renderEntryLink(data) {
    const customer = data.customer;
    const link = data.entry_link;
    const nodes = [];
    const access = data.access;
    const ativo = access && access.status === 'active' && (!access.expires_at || Date.parse(access.expires_at) > Date.now());
    if (!ativo) nodes.push(element('p', 'admin-status is-error', 'Ela não tem o acesso ativo. O link só abre o app depois que o acesso for liberado.'));
    if (!link) {
      nodes.push(element('p', 'admin-empty', 'Para quem não consegue digitar o e-mail: ela toca no link e entra direto no app dela.'));
      const criar = element('button', 'admin-mini-btn', 'Criar link de entrada');
      criar.type = 'button';
      criar.addEventListener('click', () => pedirLink(customer.id, false));
      nodes.push(criar);
      return block('Link de entrada', nodes, '');
    }
    const endereco = `${location.origin}/es-entrar#${link.token}`;
    const campo = element('input');
    campo.readOnly = true; campo.value = endereco; campo.setAttribute('aria-label', 'Link de entrada');
    campo.addEventListener('focus', () => campo.select());
    const copiarLink = element('button', '', 'Copiar link');
    copiarLink.type = 'button';
    copiarLink.addEventListener('click', () => copiar(endereco, copiarLink));
    const copiarMensagem = element('button', '', 'Copiar mensagem pronta (em espanhol)');
    copiarMensagem.type = 'button';
    copiarMensagem.addEventListener('click', () => copiar(mensagemDoLink(endereco), copiarMensagem));
    const linha = element('div', 'admin-form admin-form-inline');
    linha.append(campo, copiarLink, copiarMensagem);
    const trocar = element('button', 'admin-mini-btn', 'Trocar link');
    trocar.type = 'button';
    trocar.addEventListener('click', () => {
      if (window.confirm(`Trocar o link de ${customer.email}? O link antigo para de funcionar na hora, inclusive o que já foi mandado para ela.`)) pedirLink(customer.id, true);
    });
    nodes.push(
      linha,
      line('Criado em', moment(link.created_at)),
      line('Ela já tocou no link?', link.uses
        ? `Sim · ${link.uses} ${link.uses === 1 ? 'vez' : 'vezes'} · a última em ${moment(link.last_used_at)}`
        : 'Ainda não'),
      trocar,
    );
    return block('Link de entrada', nodes, '');
  }

  function renderDetail(data) {
    const customer = data.customer;
    const resumo = customers.find(c => c.id === customer.id) || {};
    document.getElementById('detail-name').textContent = customer.name?.trim() || customer.email.split('@')[0];
    document.getElementById('detail-email').textContent = customer.email;

    const resume = block('Resumo', [
      line('Cadastrada em', day(customer.created_at)),
      line('País do cartão', customer.country || '—'),
      line('Fuso do celular', customer.timezone || '—'),
      line('O que ela tem hoje', etapa(resumo)),
      line('Primeiro acesso ao app', day(customer.first_access_on)),
      line('Dias de acesso', String(data.visits.length)),
      line('Última visita', day(data.visits[0]?.visited_on)),
      line('Orações rezadas', String(data.progress.filter(item => item.day >= 1).length)),
    ], '');

    const prayers = data.progress.map(item => line(dayLabels[item.day] || `Dia ${item.day}`, moment(item.completed_at)));
    const visits = data.visits.slice(0, 15).map(item =>
      line(day(item.visited_on), `${hour(item.first_seen_at)} às ${hour(item.last_seen_at)}`));
    const offers = data.offers.map(item => {
      const marks = [];
      if (item.shown_at) marks.push('exibido');
      if (item.clicked_at) marks.push('clicou');
      if (item.dismissed_at) marks.push('recusou');
      return line(item.campaign_key, marks.length ? marks.join(' · ') : 'ainda não exibido');
    });

    // As compras: cada pagamento da Whop, com o produto do pedido da KashPay.
    const pedidos = new Map((data.orders || []).map(o => [o.transaction_id, o]));
    const compras = data.payments.map(p => {
      const pedido = p.tx ? pedidos.get(p.tx) : null;
      const produtos = pedido && Array.isArray(pedido.produtos) && pedido.produtos.length
        ? pedido.produtos.map(k => nomeDoProduto[k] || k).join(' + ')
        : 'produto sem registro';
      const valor = pedido && pedido.amount_cents ? ` · ${(pedido.amount_cents / 100).toFixed(2).replace('.', ',')} ${pedido.currency || ''}` : '';
      const origem = pedido && pedido.utm_medium === 'popup' ? ` · pelo pop-up (${pedido.utm_content || ''})` : '';
      const estado = p.status === 'processed' ? '' : ` · ${p.status}`;
      return line(moment(p.received_at), `${produtos}${valor}${origem}${estado}`, p.status === 'processed' ? '' : 'is-off');
    });

    const history = data.history.map(item => {
      const extra = item.action === 'update_email' && item.details?.from ? ` — de ${item.details.from}`
        : item.details?.product ? ` — ${nomeDoExtra[item.details.product] || item.details.product}` : '';
      return line(moment(item.created_at), `${actionLabels[item.action] || item.action}${extra}`);
    });

    // Corrigir o e-mail é a solução do caso mais comum: digitou errado na
    // compra e não consegue entrar. As compras dela vão junto (na latam-api).
    const emailForm = element('form', 'admin-form admin-form-inline');
    const input = element('input');
    input.type = 'email'; input.required = true; input.value = customer.email; input.setAttribute('aria-label', 'Novo e-mail');
    const submit = element('button', '', 'Corrigir e-mail'); submit.type = 'submit';
    emailForm.append(input, submit);
    emailForm.addEventListener('submit', event => {
      event.preventDefault();
      act('admin_update_email', { customer_id: customer.id, email: input.value },
        `Trocar o e-mail de ${customer.email} para ${input.value.trim().toLowerCase()}? Ela terá que entrar de novo.`, customer.id);
    });

    detailBody.replaceChildren(
      resume,
      renderAccess(data),
      renderExtras(data),
      renderEntryLink(data),
      block('Corrigir e-mail', [emailForm], ''),
      block('Compras', compras, 'Nenhum pagamento registrado para este e-mail.'),
      block('Orações rezadas', prayers, 'Ainda não marcou nenhuma oração.'),
      block('Pop-ups', offers, 'Nenhum pop-up para ela ainda.'),
      block('Acesso ao app', visits, 'Nunca abriu o aplicativo.'),
      block('Ações administrativas', history, 'Nenhuma ação manual registrada.'),
    );
  }

  async function openDetail(customerId) {
    detailBody.replaceChildren(element('p', 'admin-empty', 'Carregando…'));
    document.getElementById('detail-name').textContent = 'Cliente';
    document.getElementById('detail-email').textContent = '';
    if (!detail.open) detail.showModal();
    try {
      renderDetail(await api('admin_customer_detail', { customer_id: customerId }));
    } catch (error) {
      detailBody.replaceChildren(element('p', 'admin-status is-error', error.message));
    }
  }

  async function act(action, payload, confirmation, reopenId) {
    if (!window.confirm(confirmation)) return;
    try {
      await api(action, payload);
      await load();
      if (reopenId) await openDetail(reopenId);
    } catch (error) {
      window.alert(error.message);
    }
  }

  // --- filtros da lista (no navegador, sem consulta nova) -----------------
  const filtros = { produto: new Set(), dias: new Set(), oracoes: new Set() };
  const diasDe = c => c.visit_days || 0;
  const oracoesDe = c => c.days_prayed || 0;
  const FAIXAS = {
    dias: [
      { id: '0', rotulo: 'Nunca entrou', testa: c => diasDe(c) === 0 },
      { id: '1', rotulo: '1 dia', testa: c => diasDe(c) === 1 },
      { id: '2', rotulo: '2 dias', testa: c => diasDe(c) === 2 },
      { id: '3', rotulo: '3 dias', testa: c => diasDe(c) === 3 },
      { id: '4+', rotulo: '4 dias ou mais', testa: c => diasDe(c) >= 4 },
    ],
    oracoes: [
      { id: '0', rotulo: 'Nenhuma', testa: c => oracoesDe(c) === 0 },
      { id: '1-3', rotulo: '1 a 3', testa: c => oracoesDe(c) >= 1 && oracoesDe(c) <= 3 },
      { id: '4-6', rotulo: '4 a 6', testa: c => oracoesDe(c) >= 4 && oracoesDe(c) <= 6 },
      { id: '7', rotulo: 'As 7', testa: c => oracoesDe(c) >= 7 },
    ],
  };
  // Dentro de "Comprou" a soma é E: marcar UP01 e UP02 mostra quem tem os dois.
  const passaNoProduto = c => [...filtros.produto].every(key => temProduto(c, key));
  const passaNaFaixa = (c, grupo) => !filtros[grupo].size || FAIXAS[grupo].some(f => filtros[grupo].has(f.id) && f.testa(c));

  function filtradas(exceto = null) {
    const term = (search?.value || '').trim().toLowerCase();
    return customers.filter(c => {
      if (term && !`${c.name || ''} ${c.email}`.toLowerCase().includes(term)) return false;
      if (exceto !== 'produto' && !passaNoProduto(c)) return false;
      for (const grupo of ['dias', 'oracoes']) if (exceto !== grupo && !passaNaFaixa(c, grupo)) return false;
      return true;
    });
  }

  function chipDeFiltro(rotulo, quantos, marcado, aoTocar) {
    const botao = element('button', 'admin-filter-chip', rotulo);
    botao.type = 'button';
    botao.setAttribute('aria-pressed', marcado ? 'true' : 'false');
    if (marcado) botao.classList.add('is-on');
    botao.append(element('span', 'admin-filter-chip-n', String(quantos)));
    botao.addEventListener('click', aoTocar);
    return botao;
  }

  const temFiltroLigado = () => Object.values(filtros).some(conjunto => conjunto.size > 0);
  function alternar(conjunto, valor) {
    if (conjunto.has(valor)) conjunto.delete(valor); else conjunto.add(valor);
    renderCustomerList();
  }

  function renderFiltros() {
    const baseProduto = filtradas();
    document.getElementById('filter-produto').replaceChildren(...EXTRAS.map(extra => chipDeFiltro(
      extra.codigo,
      baseProduto.filter(c => temProduto(c, extra.key)).length,
      filtros.produto.has(extra.key),
      () => alternar(filtros.produto, extra.key),
    )));
    for (const grupo of ['dias', 'oracoes']) {
      const base = filtradas(grupo);
      document.getElementById(`filter-${grupo}`).replaceChildren(...FAIXAS[grupo].map(faixa => chipDeFiltro(
        faixa.rotulo, base.filter(faixa.testa).length, filtros[grupo].has(faixa.id), () => alternar(filtros[grupo], faixa.id),
      )));
    }
    document.getElementById('filter-clear').hidden = !temFiltroLigado();
  }

  // Mostra no máximo 200 cartões de uma vez: a busca acha qualquer uma.
  const LIMITE_NA_TELA = 200;
  function renderCustomerList() {
    const visible = filtradas();
    renderFiltros();
    const container = document.getElementById('admin-customers');
    container.replaceChildren(...visible.slice(0, LIMITE_NA_TELA).map(renderCustomer));
    const filtrando = temFiltroLigado() || !!(search?.value || '').trim();
    if (!visible.length) container.append(element('p', 'admin-empty', filtrando ? 'Nenhuma cliente com esses filtros.' : 'Nenhuma cliente cadastrada.'));
    if (visible.length > LIMITE_NA_TELA) container.append(element('p', 'admin-empty', `Mostrando ${LIMITE_NA_TELA} de ${visible.length}. Use a busca para achar uma cliente.`));
    document.getElementById('customer-count').textContent = filtrando ? `${visible.length} de ${customers.length}` : String(visible.length);
  }

  async function load() {
    refreshButton.disabled = true;
    status.className = 'admin-status';
    status.hidden = false;
    status.textContent = 'Atualizando informações…';
    try {
      const data = await api('admin_dashboard');
      customers = Array.isArray(data.customers) ? data.customers : [];
      const lista = clientes();
      document.getElementById('kpi-customers').textContent = lista.length;
      document.getElementById('kpi-active').textContent = lista.filter(ativa).length;
      document.getElementById('kpi-entered').textContent = lista.filter(entrou).length;
      document.getElementById('kpi-prayers').textContent = lista.reduce((total, c) => total + (c.days_prayed || 0), 0);
      renderFunnel();
      const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
      const area = document.getElementById('admin-campaigns');
      area.replaceChildren(...campaigns.map(renderCampaign));
      if (!campaigns.length) area.append(element('p', 'admin-empty', 'Nenhum pop-up configurado.'));
      document.getElementById('campaign-count').textContent = campaigns.length;
      renderCustomerList();
      status.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      dashboard.hidden = true;
      status.className = 'admin-status is-error';
      status.textContent = error.message;
    } finally {
      refreshButton.disabled = false;
    }
  }

  grantForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('grant-email').value.trim().toLowerCase();
    if (!window.confirm(`Liberar o app em espanhol para ${email} por 12 meses?`)) return;
    grantStatus.hidden = false;
    grantStatus.className = 'admin-form-status';
    grantStatus.textContent = 'Liberando…';
    try {
      await api('admin_grant_access', { email });
      grantStatus.textContent = `Acesso liberado para ${email}. Ela entra em setemadrugadas.com.br/es com esse e-mail.`;
      document.getElementById('grant-email').value = '';
      await load();
    } catch (error) {
      grantStatus.className = 'admin-form-status is-error';
      grantStatus.textContent = error.message;
    }
  });

  search?.addEventListener('input', renderCustomerList);
  document.getElementById('filter-clear')?.addEventListener('click', () => {
    Object.values(filtros).forEach(conjunto => conjunto.clear());
    renderCustomerList();
  });
  document.getElementById('detail-close')?.addEventListener('click', () => detail.close());
  detail?.addEventListener('click', event => { if (event.target === detail) detail.close(); });
  refreshButton.addEventListener('click', load);

  // O portão: sem sessão, vai para o login do app em espanhol; com sessão,
  // a tela abre e o próprio painel diz se ela é administradora ou não.
  (async () => {
    let r;
    try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
    if (!r) return;
    window.AMENES.mostrarTela();
    await load();
  })();
})();
