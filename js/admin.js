(() => {
  // AbortSignal.timeout nao existe em iOS 15 ou anterior, aparelho comum
  // no publico do app. Sem isto a chamada quebra antes de sair do celular.
  // O relogio e desligado assim que a resposta chega: sem isso cada chamada
  // deixa um despertador pendurado por 15s, gastando bateria a toa.
  const limiteDeTempo = ms => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, encerrar: () => clearTimeout(t) }; };
  const storageKey = '7amens.member.session.v2';
  const status = document.getElementById('admin-status');
  const dashboard = document.getElementById('admin-dashboard');
  const refreshButton = document.getElementById('admin-refresh');
  const search = document.getElementById('customer-search');
  const grantForm = document.getElementById('grant-form');
  const grantStatus = document.getElementById('grant-status');
  const detail = document.getElementById('customer-detail');
  const detailBody = document.getElementById('detail-body');
  const stageLabels = {
    somente_front: 'Somente Front',
    somente_up01: 'Front + UP01',
    up01_e_up02: 'Front + UP01 + UP02',
    funil_completo: 'Funil completo',
    sem_acesso_ativo: 'Sem acesso ativo',
  };
  const prayerLabels = {
    'principal:1': 'Dia 1 — Pai Nosso', 'principal:2': 'Dia 2 — Perdão', 'principal:3': 'Dia 3 — Cura',
    'principal:4': 'Dia 4 — Libertação', 'principal:5': 'Dia 5 — Prosperidade', 'principal:6': 'Dia 6 — Paz',
    'principal:7': 'Dia 7 — Aliança', 'principal:0': 'Preparação',
  };
  const eventLabels = {
    'customer.member_added': 'Acesso concedido',
    'customer.member_removed': 'Acesso removido',
    'invoice.status_updated': 'Fatura atualizada',
    'subscription.deactivated': 'Assinatura desativada',
    'subscription.expiring': 'Assinatura expirando',
  };
  const invoiceLabels = {
    unpaid: 'não paga', paid: 'paga', overdue: 'atrasada', refunded: 'reembolsada',
    disputed: 'em disputa', chargeback: 'chargeback', canceled: 'cancelada',
  };
  const actionLabels = { grant_access: 'Liberou acesso', revoke_access: 'Revogou acesso', update_email: 'Corrigiu o e-mail' };
  const answerLabels = {
    mother: 'Mãe', grandmother: 'Avó', mother_and_grandmother: 'Mãe e avó', neither: 'Não é mãe nem avó',
    married: 'Casada', relationship: 'Em relacionamento', single: 'Solteira', widowed: 'Viúva', prefer_not_to_say: 'Não respondeu',
    weekly: 'Missa semanal', monthly: 'Missa algumas vezes ao mês', occasionally: 'Missa ocasional', not_attending_but_faithful: 'Afastada, mantém a fé', reconnecting: 'Reaproximando-se da Igreja',
    children: 'Reza pelos filhos', grandchildren: 'Reza pelos netos', partner: 'Reza pelo relacionamento', whole_family: 'Reza pela família', someone_in_difficulty: 'Reza por alguém especial', self: 'Reza por si mesma',
    family_protection: 'Proteção da família', children_or_grandchildren: 'Filhos ou netos', health_and_healing: 'Saúde e cura', marriage_or_relationship: 'Relacionamento', finances_and_work: 'Finanças e trabalho', peace_and_anxiety: 'Paz e ansiedade', difficult_cause: 'Causa difícil',
    saint_michael: 'São Miguel', saint_benedict: 'São Bento', our_lady: 'Nossa Senhora', saint_joseph: 'São José', saint_rita: 'Santa Rita', saint_jude: 'São Judas', sacred_heart_or_divine_mercy: 'Sagrado Coração / Misericórdia', no_specific_devotion: 'Sem devoção específica',
  };

  let catalog = [];
  let customers = [];

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  // --- datas do painel ---------------------------------------------------
  // O painel é operado no Brasil e a Hubla informa tudo em horário de
  // Brasília. A tela precisa mostrar esse fuso sempre, nunca o relógio de
  // quem abriu a página: num computador configurado em outro fuso todos os
  // horários apareceriam deslocados, sem nenhum aviso.
  const FUSO = 'America/Sao_Paulo';

  // Uma data sem hora ("2026-09-18") é lida pelo navegador como meia-noite em
  // Londres e recua um dia ao ser convertida para cá — foi assim que uma
  // visita do dia 18 apareceu como 17. Esses campos já vêm no fuso certo do
  // banco, então são apenas reordenados, sem conversão nenhuma.
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
  // --- fim das datas do painel -------------------------------------------

  async function api(payload) {
    const token = localStorage.getItem(storageKey) || '';
    const limite = limiteDeTempo(20000);
    let response;
    try {
      response = await fetch(window.MEMBER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-member-session': token },
        body: JSON.stringify(payload),
        signal: limite.signal,
      });
    } finally { limite.encerrar(); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a ação.');
    return data;
  }

  function renderCampaign(campaign) {
    const card = element('article', 'admin-campaign');
    const top = element('div', 'admin-campaign-top');
    top.append(element('h3', '', campaign.headline));
    top.append(element('span', `admin-badge${campaign.enabled ? ' active' : ''}`, campaign.enabled ? 'Ativa' : 'Preparada'));
    const type = campaign.offer_type === 'vip' ? 'Grupo VIP' : campaign.offer_type === 'subscription' ? 'Assinatura' : 'Produto';
    const trigger = campaign.trigger_type === 'dismissal' ? 'após recusa' : 'na entrada';
    const meta = element('p', 'admin-campaign-meta', `${type} · ${trigger}`);
    const metrics = element('div', 'admin-campaign-metrics');
    [['Exibida', campaign.shown], ['Cliques', campaign.clicked], ['Recusas', campaign.dismissed], ['Compras', campaign.converted]].forEach(([label, value]) => {
      const item = element('span'); item.append(element('strong', '', String(value)), document.createTextNode(String(label))); metrics.append(item);
    });
    card.append(top, meta, metrics);
    return card;
  }

  function renderCustomer(customer) {
    const card = element('article', 'admin-customer');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const top = element('div', 'admin-customer-top');
    const displayName = customer.name?.trim() || customer.email.split('@')[0];
    const initial = element('span', 'admin-initial', displayName.charAt(0).toUpperCase());
    const main = element('div', 'admin-customer-main');
    main.append(element('h3', '', displayName), element('p', '', customer.email), element('span', 'admin-stage', stageLabels[customer.funnel_stage] || customer.funnel_stage));
    top.append(initial, main);
    const stats = element('div', 'admin-customer-stats');
    [['Dias', customer.distinct_visit_days], ['Orações', customer.completed_prayers], ['Perfil', customer.profile_completed_at ? 'Sim' : 'Não']].forEach(([label, value]) => {
      const item = element('div'); item.append(element('strong', '', String(value)), element('span', '', String(label))); stats.append(item);
    });
    card.append(top, stats);
    const profileFields = ['motherhood_status','relationship_status','church_frequency','primary_prayer_recipient','primary_intention','favorite_devotion'];
    const values = profileFields.map(field => answerLabels[customer[field]]).filter(Boolean);
    if (values.length) {
      const tags = element('div', 'admin-profile-tags');
      values.forEach(value => tags.append(element('span', '', value)));
      card.append(tags);
    }
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
    const nodes = data.entitlements.map(item => {
      const product = catalog.find(entry => entry.key === item.product_key);
      const active = item.status === 'active';
      const row = element('div', `admin-detail-line${active ? ' is-active' : ' is-off'}`);
      const origin = item.source === 'hubla' ? 'pela Hubla' : 'liberado na mão';
      row.append(element('span', '', product?.title || item.product_key));
      row.append(element('strong', '', `${active ? 'Ativo' : item.status === 'refunded' ? 'Reembolsado' : 'Revogado'} · ${origin}`));
      const button = element('button', 'admin-mini-btn', active ? 'Revogar' : 'Liberar');
      button.type = 'button';
      button.addEventListener('click', () => act(
        active ? 'admin_revoke_access' : 'admin_grant_access',
        { customer_id: data.customer.id, product_key: item.product_key },
        `${active ? 'Revogar' : 'Liberar'} "${product?.title || item.product_key}" para ${data.customer.email}?`,
        data.customer.id,
      ));
      row.append(button);
      return row;
    });

    // Products she does not have yet can be granted straight from here.
    catalog.filter(product => !data.entitlements.some(item => item.product_key === product.key)).forEach(product => {
      const row = element('div', 'admin-detail-line is-off');
      row.append(element('span', '', product.title), element('strong', '', 'Nunca teve'));
      const button = element('button', 'admin-mini-btn', 'Liberar');
      button.type = 'button';
      button.addEventListener('click', () => act(
        'admin_grant_access',
        { customer_id: data.customer.id, product_key: product.key },
        `Liberar "${product.title}" para ${data.customer.email}?`,
        data.customer.id,
      ));
      row.append(button);
      nodes.push(row);
    });
    return block('Acessos', nodes, 'Nenhum produto.');
  }

  function renderDetail(data) {
    const customer = data.customer;
    document.getElementById('detail-name').textContent = customer.name?.trim() || customer.email.split('@')[0];
    document.getElementById('detail-email').textContent = customer.email;

    const resume = block('Resumo', [
      line('Cadastrada em', day(customer.created_at)),
      line('Etapa do funil', stageLabels[customer.funnel_stage] || customer.funnel_stage),
      line('Dias de acesso ao site', String(customer.distinct_visit_days)),
      line('Última visita', day(customer.last_visit_on)),
      line('Orações concluídas', String(customer.completed_prayers)),
    ], '');

    const prayers = data.progress.filter(item => item.completed).map(item =>
      line(prayerLabels[item.prayer_key] || item.prayer_key, moment(item.updated_at)));

    const visits = data.visits.slice(0, 15).map(item =>
      line(day(item.visited_on), `${hour(item.first_seen_at)} às ${hour(item.last_seen_at)}`));

    const offers = data.offers.map(item => {
      const marks = [];
      if (item.shown_at) marks.push('exibida');
      if (item.clicked_at) marks.push('clicou');
      if (item.dismissed_at) marks.push('recusou');
      if (item.converted_at) marks.push('comprou');
      return line(item.campaign_key, marks.length ? marks.join(' · ') : 'ainda não exibida');
    });

    const profile = [];
    if (data.survey) {
      ['motherhood_status','relationship_status','church_frequency','primary_prayer_recipient','primary_intention','favorite_devotion']
        .forEach(field => { if (answerLabels[data.survey[field]]) profile.push(line(' ', answerLabels[data.survey[field]])); });
    }

    const hubla = data.hubla.map(item => {
      const parts = [eventLabels[item.event_type] || item.event_type];
      if (item.invoice_status) parts.push(invoiceLabels[item.invoice_status] || item.invoice_status);
      if (item.sandbox) parts.push('TESTE');
      return line(moment(item.received_at), `${parts.join(' · ')}${item.product ? ` — ${item.product}` : ''}`,
        item.processing_status === 'needs_reconciliation' ? 'is-off' : '');
    });

    const history = data.history.map(item =>
      line(moment(item.created_at), `${actionLabels[item.action] || item.action}${item.details?.product_title ? ` — ${item.details.product_title}` : ''}`));

    // Correcting the e-mail is the fix for the most common support case: she
    // mistyped it at checkout and cannot get in.
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
      block('Corrigir e-mail', [emailForm], ''),
      block('Orações concluídas', prayers, 'Ainda não concluiu nenhuma oração.'),
      block('Perfil respondido', profile, 'Ainda não respondeu a pesquisa de perfil.'),
      block('Campanhas enviadas', offers, 'Nenhuma campanha enviada ainda.'),
      block('Acesso ao site', visits, 'Nunca abriu o aplicativo.'),
      block('Eventos da Hubla', hubla, 'Nenhum evento da Hubla para este e-mail.'),
      block('Ações administrativas', history, 'Nenhuma ação manual registrada.'),
    );
  }

  async function openDetail(customerId) {
    detailBody.replaceChildren(element('p', 'admin-empty', 'Carregando…'));
    document.getElementById('detail-name').textContent = 'Cliente';
    document.getElementById('detail-email').textContent = '';
    detail.showModal();
    try {
      renderDetail(await api({ action: 'admin_customer_detail', customer_id: customerId }));
    } catch (error) {
      detailBody.replaceChildren(element('p', 'admin-status is-error', error.message));
    }
  }

  async function act(action, payload, confirmation, reopenId) {
    if (!window.confirm(confirmation)) return;
    try {
      await api({ action, ...payload });
      await load();
      if (reopenId) await openDetail(reopenId);
    } catch (error) {
      window.alert(error.message);
    }
  }

  function renderCustomerList() {
    const term = (search?.value || '').trim().toLowerCase();
    const visible = term
      ? customers.filter(customer => `${customer.name || ''} ${customer.email}`.toLowerCase().includes(term))
      : customers;
    const container = document.getElementById('admin-customers');
    container.replaceChildren(...visible.map(renderCustomer));
    if (!visible.length) container.append(element('p', 'admin-empty', term ? 'Nenhuma cliente encontrada.' : 'Nenhuma cliente cadastrada.'));
    document.getElementById('customer-count').textContent = visible.length;
  }

  async function load() {
    refreshButton.disabled = true;
    status.className = 'admin-status';
    status.hidden = false;
    status.textContent = 'Atualizando informações…';
    try {
      const data = await api({ action: 'admin_dashboard' });
      catalog = data.products || [];
      customers = data.customers;
      document.getElementById('kpi-customers').textContent = data.summary.customers;
      document.getElementById('kpi-active').textContent = data.summary.activeCustomers;
      document.getElementById('kpi-profiles').textContent = data.summary.completedProfiles;
      document.getElementById('kpi-prayers').textContent = data.summary.completedPrayers;
      const campaigns = document.getElementById('admin-campaigns');
      campaigns.replaceChildren(...data.campaigns.map(renderCampaign));
      if (!data.campaigns.length) campaigns.append(element('p', 'admin-empty', 'Nenhuma campanha configurada.'));
      document.getElementById('campaign-count').textContent = data.campaigns.length;
      const select = document.getElementById('grant-product');
      select.replaceChildren(...catalog.map(product => {
        const option = element('option', '', `${product.title}${product.enabled ? '' : ' (desativado no app)'}`);
        option.value = product.key;
        return option;
      }));
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
    const productKey = document.getElementById('grant-product').value;
    const product = catalog.find(entry => entry.key === productKey);
    if (!window.confirm(`Liberar "${product?.title || productKey}" para ${email}?`)) return;
    grantStatus.hidden = false;
    grantStatus.className = 'admin-form-status';
    grantStatus.textContent = 'Liberando…';
    try {
      await api({ action: 'admin_grant_access', email, product_key: productKey });
      grantStatus.textContent = `Acesso liberado para ${email}.`;
      document.getElementById('grant-email').value = '';
      await load();
    } catch (error) {
      grantStatus.className = 'admin-form-status is-error';
      grantStatus.textContent = error.message;
    }
  });

  search?.addEventListener('input', renderCustomerList);
  document.getElementById('detail-close')?.addEventListener('click', () => detail.close());
  detail?.addEventListener('click', event => { if (event.target === detail) detail.close(); });
  refreshButton.addEventListener('click', load);
  load();
})();
