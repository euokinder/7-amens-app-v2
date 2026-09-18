(() => {
  const storageKey = '7amens.member.session.v2';
  const status = document.getElementById('admin-status');
  const dashboard = document.getElementById('admin-dashboard');
  const refreshButton = document.getElementById('admin-refresh');
  const stageLabels = {
    somente_front: 'Somente Front',
    somente_up01: 'Front + UP01',
    up01_e_up02: 'Front + UP01 + UP02',
    funil_completo: 'Funil completo',
    sem_acesso_ativo: 'Sem acesso ativo',
  };
  const answerLabels = {
    mother: 'Mãe', grandmother: 'Avó', mother_and_grandmother: 'Mãe e avó', neither: 'Não é mãe nem avó',
    married: 'Casada', relationship: 'Em relacionamento', single: 'Solteira', widowed: 'Viúva', prefer_not_to_say: 'Não respondeu',
    weekly: 'Missa semanal', monthly: 'Missa algumas vezes ao mês', occasionally: 'Missa ocasional', not_attending_but_faithful: 'Afastada, mantém a fé', reconnecting: 'Reaproximando-se da Igreja',
    children: 'Reza pelos filhos', grandchildren: 'Reza pelos netos', partner: 'Reza pelo relacionamento', whole_family: 'Reza pela família', someone_in_difficulty: 'Reza por alguém especial', self: 'Reza por si mesma',
    family_protection: 'Proteção da família', children_or_grandchildren: 'Filhos ou netos', health_and_healing: 'Saúde e cura', marriage_or_relationship: 'Relacionamento', finances_and_work: 'Finanças e trabalho', peace_and_anxiety: 'Paz e ansiedade', difficult_cause: 'Causa difícil',
    saint_michael: 'São Miguel', saint_benedict: 'São Bento', our_lady: 'Nossa Senhora', saint_joseph: 'São José', saint_rita: 'Santa Rita', saint_jude: 'São Judas', sacred_heart_or_divine_mercy: 'Sagrado Coração / Misericórdia', no_specific_devotion: 'Sem devoção específica',
  };

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  async function api() {
    const token = localStorage.getItem(storageKey) || '';
    const response = await fetch(window.MEMBER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-member-session': token },
      body: JSON.stringify({ action: 'admin_dashboard' }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o painel.');
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
    return card;
  }

  async function load() {
    refreshButton.disabled = true;
    status.className = 'admin-status';
    status.hidden = false;
    status.textContent = 'Atualizando informações…';
    try {
      const data = await api();
      document.getElementById('kpi-customers').textContent = data.summary.customers;
      document.getElementById('kpi-active').textContent = data.summary.activeCustomers;
      document.getElementById('kpi-profiles').textContent = data.summary.completedProfiles;
      document.getElementById('kpi-prayers').textContent = data.summary.completedPrayers;
      const campaigns = document.getElementById('admin-campaigns');
      campaigns.replaceChildren(...data.campaigns.map(renderCampaign));
      if (!data.campaigns.length) campaigns.append(element('p', 'admin-empty', 'Nenhuma campanha configurada.'));
      const customers = document.getElementById('admin-customers');
      customers.replaceChildren(...data.customers.map(renderCustomer));
      if (!data.customers.length) customers.append(element('p', 'admin-empty', 'Nenhuma cliente cadastrada.'));
      document.getElementById('campaign-count').textContent = data.campaigns.length;
      document.getElementById('customer-count').textContent = data.customers.length;
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

  refreshButton.addEventListener('click', load);
  load();
})();
