// O painel do app em inglês (/en-admin). CÓPIA do js/es/admin.js (que é cópia
// adaptada do js/admin.js do Brasil): o mesmo desenho e as mesmas funções,
// com os dados dos EUA e os textos em inglês. Fala só com a en-api (ações
// admin_*), que lê e grava só tabelas en_. Arquivo só do app dos EUA.
//
// O que muda em relação ao Brasil:
//   - o produto que dá acesso é um só, o app ('app' em en_access), por 12
//     meses;
//   - os extras (Four Archangels e Angelic Canticle). Quem tem cada um sai da
//     compra (o pedido do checkout) ou da dúvida (venda sem pedido: libera os
//     dois). A ficha mostra a origem e tem "Unlock" e "Remove", que mandam
//     por cima da compra (supabase/en/05-extras.sql);
//   - quem comprou o quê sai dos pedidos do checkout. ⏳ EUA: o checkout
//     americano vem por último; até lá, os nomes de campo e de origem
//     ('whop', pedidos/orders) são os herdados do espanhol (KashPay + Whop);
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

  // As chaves internas dos extras: 'arcangeles' (UP01) e 'cantico' (UP02), as
  // mesmas da en-api e de supabase/en/ (no espanhol o UP02 era 'desatanudos').
  const EXTRAS = [
    { key: 'arcangeles', codigo: 'UP01', title: 'The Four Archangels' },
    { key: 'cantico', codigo: 'UP02', title: 'Angelic Canticle' },
  ];
  const nomeDoProduto = { principal: 'App (7 Amens)', arcangeles: 'UP01 · Four Archangels', cantico: 'UP02 · Angelic Canticle' };
  const dayLabels = [
    'Start Here',
    'First Amen · The Complete Our Father',
    'Second Amen · The Prayer for Forgiveness',
    'Third Amen · The Prayer for Healing',
    'Fourth Amen · The Prayer for Deliverance',
    'Fifth Amen · The Prayer for Prosperity',
    'Sixth Amen · The Prayer for Peace',
    'Seventh Amen · The Covenant Prayer',
  ];
  const actionLabels = {
    grant_access: 'Granted access', revoke_access: 'Revoked access', update_email: 'Fixed the email',
    entry_link: 'Created the sign-in link', renew_entry_link: 'Replaced the sign-in link',
    grant_extra: 'Unlocked an extra in the app', revoke_extra: 'Removed an extra from the app',
  };
  // Os extras dentro do app (en-api: admin_grant_extra / admin_revoke_extra).
  const EXTRAS_NO_APP = [
    { key: 'arcangeles', title: 'UP01 · The Four Archangels' },
    { key: 'cantico', title: 'UP02 · Angelic Canticle' },
  ];
  const origemLabels = {
    compra: 'Has it · from the purchase',
    duvida: 'Has it · sale with no product record (unlocked to be safe)',
    manual: 'Has it · unlocked manually',
    retirado: 'Removed manually',
  };
  const nomeDoExtra = { arcangeles: 'Four Archangels', cantico: 'Angelic Canticle' };
  // 'whop' é o valor de origem herdado do espanhol (⏳ EUA: checkout por vir).
  const sourceLabels = { checkout: 'from the purchase', whop: 'from the purchase', import: 'from the initial import', manual: 'granted manually', emergencia: 'through the emergency sign-in (check the purchase)' };
  // O resgate na entrada (supabase/en/09-resgate.sql).
  const metodoLabels = {
    corrigido: 'Typed the email with a mistake and got in (fixed automatically)',
    gemeo: 'The purchase email was wrong: she got in and it was fixed',
    parecido: 'Typed the email with one different letter and got in',
    cartao: 'Found the purchase by the last card digits and the name',
    emergencia: 'Came in through the emergency sign-in, purchase not found',
  };

  let customers = [];
  let resgates = null;
  let soOsQueEsperam = true;

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  // --- datas do painel ---------------------------------------------------
  // Sempre no horário de Brasília (quem opera é a equipe brasileira), nunca no
  // relógio de quem abriu a página; no formato americano (mês/dia/ano). Data
  // sem hora ("2026-11-06") só é reordenada: convertida, ela recuaria um dia.
  const FUSO = 'America/Sao_Paulo';
  const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  const day = value => {
    if (!value) return '—';
    const partes = SO_DATA.exec(String(value));
    if (partes) return `${partes[2]}/${partes[3]}/${partes[1]}`;
    return new Date(value).toLocaleDateString('en-US', { timeZone: FUSO });
  };
  const moment = value => (value
    ? new Date(value).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO })
    : '—');
  const hour = value => (value
    ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
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
    const bruto = `${parte} of ${base}`;
    if (!base) return { destaque: '—', apoio: 'no base', fraca: true, pct: null };
    const pct = 100 * parte / base;
    const texto = `${pct.toFixed(1)}%`;
    if (base >= BASE_CONFIAVEL) return { destaque: texto, apoio: bruto, fraca: false, pct };
    if (base >= BASE_MINIMA) return { destaque: bruto, apoio: `${texto} — small base`, fraca: true, pct };
    return { destaque: bruto, apoio: 'too few customers to tell', fraca: true, pct: null };
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
      `${base.length} ${base.length === 1 ? 'customer has' : 'customers have'} the app active today. Every percentage on this page is based on them, unless stated otherwise.`));

    const topo = element('div', 'admin-funnel');
    topo.append(
      contadorCard('Customers with access', base.length, 'with the app active'),
      funnelCard('Signed in to the app', base.filter(entrou).length, base.length, 'customers'),
      funnelCard('Bought an extra', comRegistro.filter(c => EXTRAS.some(e => temProduto(c, e.key))).length, comRegistro.length, 'customers'),
    );
    blocos.push(topo);

    // Os extras, sobre quem tem o produto registrado: quem comprou sem o
    // produto registrado não tem como entrar na conta, nem para mais nem para menos.
    const extras = bloco('The extras', 'Of the customers with the app (and a recorded purchase), how many bought each extra?');
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
    extras.append(element('p', 'admin-block-foot', `${levaramOs2} bought both extras.`));
    const fora = base.length - comRegistro.length;
    // ⏳ EUA: no espanhol, esta nota falava das vendas de antes de a KashPay
    // mandar o produto. Aqui fica genérica até o checkout americano existir.
    if (fora) extras.append(nota(`${fora} ${fora === 1 ? 'customer has' : 'customers have'} a purchase with no product record. They are left out of this count, and the pop-up does not show for them.`));
    blocos.push(extras);

    // De onde elas são (o país do cartão, como o checkout mandou).
    const paises = new Map();
    base.forEach(c => { const p = c.country || '—'; paises.set(p, (paises.get(p) || 0) + 1); });
    const ordem = [...paises.entries()].sort((a, b) => b[1] - a[1]);
    if (ordem.length) {
      const pais = bloco('Where they are from', 'Card country of the customers with the app active.');
      ordem.slice(0, 12).forEach(([sigla, n]) => {
        const t = taxa(n, base.length);
        pais.append(linhaMatriz([
          chip(sigla),
          element('span', 'admin-matrix-nome', `${n} ${n === 1 ? 'customer' : 'customers'}`),
          element('strong', 'admin-matrix-num', String(n)),
          element('span', 'admin-matrix-pct', t.fraca ? '' : t.destaque),
          barra(t.pct, t.fraca),
        ]));
      });
      blocos.push(pais);
    }

    area.replaceChildren(...blocos);
  }

  // Número ordinal em inglês: 1st, 2nd, 3rd, 4th, 11th, 21st…
  const ordinal = n => {
    const resto100 = n % 100;
    if (resto100 >= 11 && resto100 <= 13) return `${n}th`;
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
  };

  function renderCampaign(campaign) {
    const card = element('article', 'admin-campaign');
    const top = element('div', 'admin-campaign-top');
    top.append(element('h3', '', campaign.headline));
    top.append(element('span', `admin-badge${campaign.enabled ? ' active' : ''}`, campaign.enabled ? 'On' : 'Off'));
    const produto = nomeDoProduto[campaign.offered_product] || 'Product';
    const quando = campaign.min_journey_day ? `from the ${ordinal(campaign.min_journey_day)} day in the app` : 'at sign-in';
    const chamada = String(campaign.eyebrow || '').split('\n').slice(-1)[0];
    const meta = element('p', 'admin-campaign-meta', `${produto} · ${quando}${chamada ? ` · ${chamada}` : ''} · ${campaign.key}`);
    const metrics = element('div', 'admin-campaign-metrics');
    [['Shown', campaign.shown], ['Clicks', campaign.clicked], ['Dismissed', campaign.dismissed], ['Purchases', campaign.purchases]].forEach(([label, value]) => {
      const item = element('span'); item.append(element('strong', '', String(value)), document.createTextNode(String(label))); metrics.append(item);
    });
    card.append(top, meta, metrics);
    return card;
  }

  function etapa(c) {
    if (!ativa(c)) return c.access_status === 'revoked' ? 'Access revoked' : c.access_status ? 'Access expired' : 'No access';
    if (c.is_admin) return 'Admin';
    if (semRegistro(c) && !(c.products || []).length) return 'App · purchase with no product record';
    const extras = EXTRAS.filter(e => temProduto(c, e.key)).map(e => e.codigo);
    return extras.length ? `App · ${extras.join(' · ')}` : 'App only';
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
    [['Days', customer.visit_days || 0], ['Prayers', customer.days_prayed || 0], ['Country', customer.country || '—']].forEach(([label, value]) => {
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
    const situacao = !access ? 'Never had it'
      : access.status === 'revoked' ? `Revoked on ${moment(access.revoked_at)}`
      : !ativo ? `Expired on ${day(access.expires_at)}`
      : `Active ${access.expires_at ? `until ${day(access.expires_at)}` : 'with no end date'} · ${sourceLabels[access.source] || access.source}`;
    row.append(element('span', '', 'English app'), element('strong', '', situacao));
    const button = element('button', 'admin-mini-btn', ativo ? 'Revoke' : 'Grant');
    button.type = 'button';
    button.addEventListener('click', () => act(
      ativo ? 'admin_revoke_access' : 'admin_grant_access',
      { customer_id: customer.id },
      ativo ? `Revoke ${customer.email}'s access to the English app? She will be locked out right away.`
        : `Grant the English app to ${customer.email} for 12 months?`,
      customer.id,
    ));
    row.append(button);
    return block('Access', [row], '');
  }

  // --- os extras dentro do app --------------------------------------------
  // "Unlock" e "Remove" mandam por cima da compra: remover tira até de quem
  // comprou; liberar de novo devolve. Sem prazo próprio: vale enquanto o app
  // valer. Não mexe no e-mail de entrega do checkout.
  function renderExtras(data) {
    const customer = data.customer;
    if (!data.extras) return block('Extras in the app', [], "Couldn't read the extras right now (is 05-extras.sql missing from the database?).");
    const linhas = EXTRAS_NO_APP.map(extra => {
      const origem = data.extras.origem[extra.key];
      const tem = Boolean(origem) && origem !== 'retirado';
      const row = element('div', `admin-detail-line${tem ? ' is-active' : ' is-off'}`);
      row.append(element('span', '', extra.title), element('strong', '', origem ? origemLabels[origem] || origem : "Doesn't have it"));
      const button = element('button', 'admin-mini-btn', tem ? 'Remove' : 'Unlock');
      button.type = 'button';
      button.addEventListener('click', () => act(
        tem ? 'admin_revoke_extra' : 'admin_grant_extra',
        { customer_id: customer.id, product: extra.key },
        tem ? `Remove ${extra.title} from ${customer.email}'s app? The card will show the lock again the next time she opens the app.`
          : `Unlock ${extra.title} in the app for ${customer.email}?`,
        customer.id,
      ));
      row.append(button);
      return row;
    });
    const dias = data.extras.cantico_hechos || [];
    linhas.push(line('Canticle days finished', dias.length ? dias.join(', ') : 'none'));
    return block('Extras in the app', linhas, '');
  }

  // --- link de entrada ---------------------------------------------------
  // Para quem não consegue digitar o e-mail: o suporte copia e manda; ela toca
  // e entra direto. Copiar de novo devolve o MESMO link; só "Replace link"
  // mata o antigo. A mensagem vai para a cliente e não usa o nome dela: o
  // cadastro pode estar no nome de quem pagou.
  const mensagemDoLink = endereco => 'Hi! Here is your link to open the 7 Amens Before Dawn app. Just tap it:\n\n'
    + `${endereco}\n\n`
    + 'Save this message. Whenever the app asks for your email, just tap the link again.';

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
    botao.textContent = copiou ? 'Copied!' : "Didn't copy: select the link and copy it";
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
    if (!ativo) nodes.push(element('p', 'admin-status is-error', "She doesn't have active access. The link only opens the app after access is granted."));
    if (!link) {
      nodes.push(element('p', 'admin-empty', "For someone who can't type her email: she taps the link and goes straight into her app."));
      const criar = element('button', 'admin-mini-btn', 'Create sign-in link');
      criar.type = 'button';
      criar.addEventListener('click', () => pedirLink(customer.id, false));
      nodes.push(criar);
      return block('Sign-in link', nodes, '');
    }
    const endereco = `${location.origin}/en-login#${link.token}`;
    const campo = element('input');
    campo.readOnly = true; campo.value = endereco; campo.setAttribute('aria-label', 'Sign-in link');
    campo.addEventListener('focus', () => campo.select());
    const copiarLink = element('button', '', 'Copy link');
    copiarLink.type = 'button';
    copiarLink.addEventListener('click', () => copiar(endereco, copiarLink));
    const copiarMensagem = element('button', '', 'Copy ready-made message');
    copiarMensagem.type = 'button';
    copiarMensagem.addEventListener('click', () => copiar(mensagemDoLink(endereco), copiarMensagem));
    const linha = element('div', 'admin-form admin-form-inline');
    linha.append(campo, copiarLink, copiarMensagem);
    const trocar = element('button', 'admin-mini-btn', 'Replace link');
    trocar.type = 'button';
    trocar.addEventListener('click', () => {
      if (window.confirm(`Replace ${customer.email}'s link? The old link stops working right away, including the one already sent to her.`)) pedirLink(customer.id, true);
    });
    nodes.push(
      linha,
      line('Created on', moment(link.created_at)),
      line('Has she tapped the link?', link.uses
        ? `Yes · ${link.uses} ${link.uses === 1 ? 'time' : 'times'} · last on ${moment(link.last_used_at)}`
        : 'Not yet'),
      trocar,
    );
    return block('Sign-in link', nodes, '');
  }

  function renderDetail(data) {
    const customer = data.customer;
    const resumo = customers.find(c => c.id === customer.id) || {};
    document.getElementById('detail-name').textContent = customer.name?.trim() || customer.email.split('@')[0];
    document.getElementById('detail-email').textContent = customer.email;

    const resume = block('Summary', [
      line('Registered on', day(customer.created_at)),
      line('Card country', customer.country || '—'),
      line('Phone time zone', customer.timezone || '—'),
      line('What she has today', etapa(resumo)),
      line('First time in the app', day(customer.first_access_on)),
      line('Days in the app', String(data.visits.length)),
      line('Last visit', day(data.visits[0]?.visited_on)),
      line('Prayers prayed', String(data.progress.filter(item => item.day >= 1).length)),
    ], '');

    const prayers = data.progress.map(item => line(dayLabels[item.day] || `Day ${item.day}`, moment(item.completed_at)));
    const visits = data.visits.slice(0, 15).map(item =>
      line(day(item.visited_on), `${hour(item.first_seen_at)} to ${hour(item.last_seen_at)}`));
    const offers = data.offers.map(item => {
      const marks = [];
      if (item.shown_at) marks.push('shown');
      if (item.clicked_at) marks.push('clicked');
      if (item.dismissed_at) marks.push('dismissed');
      return line(item.campaign_key, marks.length ? marks.join(' · ') : 'not shown yet');
    });

    // As compras: cada pagamento, com o produto do pedido do checkout.
    // ⏳ EUA: os campos (payments, orders) são os herdados do espanhol.
    const pedidos = new Map((data.orders || []).map(o => [o.transaction_id, o]));
    const compras = data.payments.map(p => {
      const pedido = p.tx ? pedidos.get(p.tx) : null;
      const produtos = pedido && Array.isArray(pedido.produtos) && pedido.produtos.length
        ? pedido.produtos.map(k => nomeDoProduto[k] || k).join(' + ')
        : 'no product record';
      const valor = pedido && pedido.amount_cents ? ` · ${(pedido.amount_cents / 100).toFixed(2)} ${pedido.currency || ''}` : '';
      const origem = pedido && pedido.utm_medium === 'popup' ? ` · from the pop-up (${pedido.utm_content || ''})` : '';
      const estado = p.status === 'processed' ? '' : ` · ${p.status}`;
      return line(moment(p.received_at), `${produtos}${valor}${origem}${estado}`, p.status === 'processed' ? '' : 'is-off');
    });

    const history = data.history.map(item => {
      const extra = item.action === 'update_email' && item.details?.from ? ` — from ${item.details.from}`
        : item.details?.product ? ` — ${nomeDoExtra[item.details.product] || item.details.product}` : '';
      return line(moment(item.created_at), `${actionLabels[item.action] || item.action}${extra}`);
    });

    // Corrigir o e-mail é a solução do caso mais comum: digitou errado na
    // compra e não consegue entrar. As compras dela vão junto (na en-api).
    const emailForm = element('form', 'admin-form admin-form-inline');
    const input = element('input');
    input.type = 'email'; input.required = true; input.value = customer.email; input.setAttribute('aria-label', 'New email');
    const submit = element('button', '', 'Fix email'); submit.type = 'submit';
    emailForm.append(input, submit);
    emailForm.addEventListener('submit', event => {
      event.preventDefault();
      act('admin_update_email', { customer_id: customer.id, email: input.value },
        `Change ${customer.email}'s email to ${input.value.trim().toLowerCase()}? She will have to sign in again.`, customer.id);
    });

    const resgatesDela = (data.resgates || []).map(r => line(moment(r.created_at),
      `${metodoLabels[r.metodo] || r.metodo}${r.situacao === 'por_confirmar' ? ' · waiting for the team' : ''}`,
      r.situacao === 'por_confirmar' ? 'is-off' : ''));

    detailBody.replaceChildren(
      resume,
      renderAccess(data),
      renderExtras(data),
      renderEntryLink(data),
      block('Sign-in rescue', resgatesDela, 'Got in without needing a rescue.'),
      block('Fix email', [emailForm], ''),
      block('Purchases', compras, 'No payment recorded for this email.'),
      block('Prayers prayed', prayers, "Hasn't marked any prayer yet."),
      block('Pop-ups', offers, 'No pop-up for her yet.'),
      block('Visits to the app', visits, 'Has never opened the app.'),
      block('Admin actions', history, 'No manual action recorded.'),
    );
  }

  // --- o resgate na entrada --------------------------------------------
  function renderResgate(resgate) {
    const espera = resgate.situacao === 'por_confirmar';
    const card = element('article', `admin-resgate${espera ? ' is-pendente' : ''}`);
    card.append(
      element('p', 'admin-resgate-quando', `${moment(resgate.created_at)}${resgate.pais ? ` · ${resgate.pais}` : ''}${espera ? ' · waiting for the team' : ''}`),
      element('h3', '', metodoLabels[resgate.metodo] || resgate.metodo),
    );
    if (resgate.nome) card.append(line('Name she typed', resgate.nome));
    if (resgate.contato) card.append(line(resgate.metodo === 'cartao' ? 'Email she chose' : 'Contact she gave', resgate.contato));
    if (resgate.email_digitado) card.append(line('What she tried at sign-in', resgate.email_digitado));
    if (resgate.email_anterior) card.append(line('Purchase email, before', resgate.email_anterior));
    if (!espera && resgate.resolvido_em) card.append(line('Resolved', moment(resgate.resolvido_em)));
    const acoes = element('div', 'admin-resgate-acoes');
    if (resgate.customer_id) {
      const ficha = element('button', 'admin-mini-btn', 'Open profile');
      ficha.type = 'button';
      ficha.addEventListener('click', () => openDetail(resgate.customer_id));
      acoes.append(ficha);
    }
    if (espera) {
      const resolver = element('button', 'admin-mini-btn admin-resgate-ok', 'Mark as resolved');
      resolver.type = 'button';
      resolver.addEventListener('click', () => act('admin_resolver_resgate', { id: resgate.id },
        'Mark as resolved? Do this after you find her purchase (or decide what to do).'));
      acoes.append(resolver);
    }
    card.append(acoes);
    return card;
  }

  function renderResgates() {
    const secao = document.getElementById('secao-resgates');
    if (!Array.isArray(resgates)) { secao.hidden = true; return; }
    secao.hidden = false;
    const esperam = resgates.filter(r => r.situacao === 'por_confirmar');
    document.getElementById('resgate-count').textContent = String(esperam.length);
    document.getElementById('filtro-resgates').replaceChildren(
      chipDeFiltro('Waiting for the team', esperam.length, soOsQueEsperam, () => { soOsQueEsperam = true; renderResgates(); }),
      chipDeFiltro('All rescues', resgates.length, !soOsQueEsperam, () => { soOsQueEsperam = false; renderResgates(); }),
    );
    const lista = soOsQueEsperam ? esperam : resgates;
    const area = document.getElementById('admin-resgates');
    area.replaceChildren(...lista.map(renderResgate));
    if (!lista.length) area.append(element('p', 'admin-empty', soOsQueEsperam ? 'Nobody is waiting for the team.' : 'No rescues yet.'));
  }

  async function openDetail(customerId) {
    detailBody.replaceChildren(element('p', 'admin-empty', 'Loading…'));
    document.getElementById('detail-name').textContent = 'Customer';
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
      { id: '0', rotulo: 'Never signed in', testa: c => diasDe(c) === 0 },
      { id: '1', rotulo: '1 day', testa: c => diasDe(c) === 1 },
      { id: '2', rotulo: '2 days', testa: c => diasDe(c) === 2 },
      { id: '3', rotulo: '3 days', testa: c => diasDe(c) === 3 },
      { id: '4+', rotulo: '4 days or more', testa: c => diasDe(c) >= 4 },
    ],
    oracoes: [
      { id: '0', rotulo: 'None', testa: c => oracoesDe(c) === 0 },
      { id: '1-3', rotulo: '1 to 3', testa: c => oracoesDe(c) >= 1 && oracoesDe(c) <= 3 },
      { id: '4-6', rotulo: '4 to 6', testa: c => oracoesDe(c) >= 4 && oracoesDe(c) <= 6 },
      { id: '7', rotulo: 'All 7', testa: c => oracoesDe(c) >= 7 },
    ],
  };
  // Dentro de "Bought" a soma é E: marcar UP01 e UP02 mostra quem tem os dois.
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
    if (!visible.length) container.append(element('p', 'admin-empty', filtrando ? 'No customers match these filters.' : 'No customers registered.'));
    if (visible.length > LIMITE_NA_TELA) container.append(element('p', 'admin-empty', `Showing ${LIMITE_NA_TELA} of ${visible.length}. Use the search to find a customer.`));
    document.getElementById('customer-count').textContent = filtrando ? `${visible.length} of ${customers.length}` : String(visible.length);
  }

  async function load() {
    refreshButton.disabled = true;
    status.className = 'admin-status';
    status.hidden = false;
    status.textContent = 'Refreshing…';
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
      if (!campaigns.length) area.append(element('p', 'admin-empty', 'No pop-ups set up.'));
      document.getElementById('campaign-count').textContent = campaigns.length;
      resgates = Array.isArray(data.resgates) ? data.resgates : null;
      renderResgates();
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
    if (!window.confirm(`Grant the English app to ${email} for 12 months?`)) return;
    grantStatus.hidden = false;
    grantStatus.className = 'admin-form-status';
    grantStatus.textContent = 'Granting…';
    try {
      await api('admin_grant_access', { email });
      grantStatus.textContent = `Access granted to ${email}. She signs in at setemadrugadas.com.br/en with this email.`;
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

  // O portão: sem sessão, vai para o login do app em inglês; com sessão,
  // a tela abre e o próprio painel diz se ela é administradora ou não.
  (async () => {
    let r;
    try { r = await window.AMENES.retrato(); } catch (erro) { window.AMENES.falhaNoPortao(erro.message); return; }
    if (!r) return;
    window.AMENES.mostrarTela();
    await load();
  })();
})();
