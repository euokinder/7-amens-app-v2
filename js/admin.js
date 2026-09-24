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
  // A etapa saía de `funnel_stage`, uma cascata do banco que classifica errado
  // quem pula degrau: uma cliente com principal + UP02 e SEM UP01 é impressa
  // como "Somente Front". Hoje ninguém pula, mas esse rótulo é lido pelo
  // atendimento todos os dias e vira mentira no primeiro caso. Montado a partir
  // de `active_products` ele nunca erra — e fala o mesmo vocabulário da análise.
  const etapaDaCliente = customer => {
    const tem = Array.isArray(customer.active_products) ? customer.active_products : [];
    if (!tem.includes('principal')) return 'Sem acesso ativo';
    const extras = tem.filter(key => key !== 'principal').sort().map(codigo);
    return extras.length ? `Front · ${extras.join(' · ')}` : 'Só o Front';
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
  // Estes rótulos valem para homem E mulher: o formulário troca o texto na
  // tela ("Sou casada" / "Sou casado"), mas grava o mesmo valor. Escrever
  // "Casada" aqui faria o painel mentir sobre metade das pessoas.
  const answerLabels = {
    mother: 'Mãe', grandmother: 'Avó', mother_and_grandmother: 'Mãe e avó', neither: 'Sem filhos nem netos',
    father: 'Pai', grandfather: 'Avô', father_and_grandfather: 'Pai e avô',
    married: 'Casado(a)', relationship: 'Em relacionamento', single: 'Solteiro(a)', widowed: 'Viúvo(a)', prefer_not_to_say: 'Preferiu não dizer',
    weekly: 'Missa semanal', monthly: 'Missa algumas vezes ao mês', occasionally: 'Missa ocasional', not_attending_but_faithful: 'Afastado(a), mantém a fé', reconnecting: 'Reaproximando-se da Igreja',
    children: 'Reza pelos filhos', grandchildren: 'Reza pelos netos', partner: 'Reza pelo relacionamento', whole_family: 'Reza pela família', someone_in_difficulty: 'Reza por alguém especial', self: 'Reza por si',
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

  // --- análise do funil ----------------------------------------------------
  // Uma regra atravessa esta seção inteira: PORCENTAGEM COM BASE PEQUENA MENTE.
  // Com 26 clientes no UP02 e 13 no UP03, uma pessoa a mais move 8 pontos. Por
  // isso a taxa é calculada num lugar só, e ela mesma decide se pode ou não
  // aparecer em destaque. Não existe como contornar: quem chama, obedece.
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

  // upsell_01 -> UP01. O Caio pediu para chamá-los assim, e o código curto é o
  // que deixa o olho varrer a coluna. O nome comercial anda sempre junto, senão
  // o atendimento perde o fio quando a cliente fala do produto pelo nome.
  const codigo = key => key.replace(/^upsell_0?/, 'UP0').toUpperCase();

  function chip(texto) { return element('span', 'admin-chip-up', texto); }

  function barra(pct, fraca) {
    const trilho = element('div', `admin-bar${fraca ? ' is-thin' : ''}`);
    const cheio = element('div', 'admin-bar-fill');
    // Piso de 3px: 2,2% em tela larga some, e uma barra invisível ao lado de
    // outra invisível faz 2,2% e 4,4% parecerem iguais.
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

  // Contagem pura: não tem denominador, então não tem taxa. Comparar a base
  // com ela mesma e imprimir "100,0%" é ruído que ensina o olho a ignorar.
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

  const nomeDoPagamento = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto' };

  function renderFunnel(funnel) {
    const area = document.getElementById('admin-analise');
    if (!funnel) { area.replaceChildren(); return; }
    const base = funnel.base || 0;
    const blocos = [];

    // ---------------------------------------------------------------- contexto
    // O denominador declarado UMA vez. Antes ele era repetido em cada linha
    // ("de 589" seis vezes na tela) e mesmo assim ninguém sabia de quem era.
    blocos.push(element('p', 'admin-baseline',
      `${base} clientes com o produto principal ativo hoje. Toda porcentagem desta página é sobre elas.`));

    // ---------------------------------------------------------------- topo
    const topo = element('div', 'admin-funnel');
    topo.append(
      contadorCard('Clientes com acesso', base, 'com o principal ativo'),
      funnelCard('Entraram no app', funnel.enteredApp, base, 'clientes'),
      funnelCard('Levaram algum extra', funnel.anyAddonBuyers, base, 'clientes'),
    );
    blocos.push(topo);

    // ---------------------------------------------------------------- a escada
    const escada = bloco('A escada dos extras', 'De quem levou um, quantas levaram o seguinte?');
    escada.append(element('p', 'admin-legend', (funnel.byProduct || [])
      .map(item => `${codigo(item.key)} = ${item.title}`).join(' · ')));

    (funnel.steps || []).forEach((passo, i) => {
      const item = (funnel.byProduct || [])[i];
      const t = taxa(passo.n, passo.base);
      const degrau = element('div', 'admin-step');
      degrau.append(
        element('span', 'admin-step-de', `Das ${passo.base} com ${passo.de}`),
        element('strong', '', `${passo.n} também têm ${passo.para}`),
        element('span', `admin-step-pct${t.fraca ? ' is-thin' : ''}`, t.fraca ? t.apoio : t.destaque),
      );
      escada.append(degrau);
      if (!item) return;
      // A barra é SEMPRE proporcional ao total, nunca ao degrau anterior. Se
      // usasse a taxa condicional, o UP02 (28,6% de 91) ficaria quase o dobro
      // do UP01 (15,4% de 591) — e a forma afirmaria que o UP02 é maior,
      // quando são 26 contra 91. A taxa condicional vive no texto acima.
      const sobreTotal = taxa(item.buyers, base);
      escada.append(linhaMatriz([
        chip(codigo(item.key)),
        element('span', 'admin-matrix-nome', item.title),
        element('strong', 'admin-matrix-num', String(item.buyers)),
        element('span', 'admin-matrix-pct', sobreTotal.fraca ? '' : sobreTotal.destaque),
        barra(sobreTotal.pct, sobreTotal.fraca),
      ]));
    });

    const pulou = (funnel.outOfOrder || []).filter(item => item.pessoas > 0);
    escada.append(element('p', 'admin-block-foot', pulou.length
      ? `Fora de ordem: ${pulou.map(i => `${i.pessoas} têm ${i.produto} sem ${i.semOAnterior}`).join(' · ')}.`
      : 'Ninguém pulou degrau: quem tem um extra tem também o anterior.'));

    escada.append(nota('Conta quem TEM hoje, não quem já comprou: assinatura cancelada e reembolso saem da conta. '
      + 'E a ordem é imposta pela esteira de vendas — o extra seguinte só é oferecido a quem levou o anterior. '
      + 'Por isso estas taxas dizem "quantas aceitaram quando foi oferecido", não "quantas escolheram entre tudo".'));
    blocos.push(escada);

    // ---------------------------------------------------------------- pagamento
    const formas = funnel.byPaymentMethod || [];
    if (formas.length) {
      const pagamento = bloco('Como ela pagou o principal', 'A forma de pagamento muda a chance de levar o UP01?');
      formas.forEach(forma => {
        const t = taxa(forma.upsell_buyers, forma.front_buyers);
        pagamento.append(linhaMatriz([
          chip(String(forma.front_buyers)),
          element('span', 'admin-matrix-nome',
            `${nomeDoPagamento[forma.payment_method] || forma.payment_method} — ${t.fraca ? t.apoio : `${forma.upsell_buyers} levaram o UP01`}`),
          element('strong', 'admin-matrix-num', String(forma.upsell_buyers)),
          element('span', 'admin-matrix-pct', t.fraca ? '' : t.destaque),
          barra(t.pct, t.fraca),
        ]));
      });
      pagamento.append(nota('Só conta vendas que passaram pelo webhook — a base histórica e as liberações feitas '
        + 'na mão não têm fatura, então não têm forma de pagamento. Este é o único bloco da página cujo total '
        + 'não bate com os de cima.'));
      blocos.push(pagamento);
    }

    area.replaceChildren(...blocos);
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
    // NÃO dividir `comprou` por `clicou`. Os cliques são contados desde sempre;
    // as compras, só desde 19/09 às 00:59, quando a etiqueta que prova a origem
    // subiu. A razão entre os dois mistura duas janelas de tempo e sai menor que
    // a realidade — em qualquer nível da tela.
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
    main.append(element('h3', '', displayName), element('p', '', customer.email), element('span', 'admin-stage', etapaDaCliente(customer)));
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
      // 'manual' é quem mexeu por último pelo painel — liberando ou, desde
      // 24/09/2026, revogando. 'hubla' e 'hubla_import' vieram da Hubla.
      const origin = item.source !== 'manual' ? 'pela Hubla' : active ? 'liberado na mão' : 'no painel';
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
      line('O que ela tem hoje', etapaDaCliente(customer)),
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

  // --- filtros da lista de clientes --------------------------------------
  // Tudo acontece no navegador, em cima da lista que o painel já carregou no
  // admin_dashboard: filtrar não faz consulta nova e não custa nada a mais.
  //
  // Dentro de "Produto" a soma é E, não OU: marcar UP01 e UP02 mostra quem
  // tem os DOIS. Foi a regra pedida — é ela que responde "quem subiu a escada
  // inteira". Nos outros grupos as faixas se excluem por natureza (ninguém
  // tem 1 e 2 dias ao mesmo tempo), então ali marcar duas soma as duas.
  //
  // ⚠️ O filtro de produto lê active_products, NUNCA funnel_stage: o
  // estágio classifica errado quem pula degrau (compra o UP02 sem o UP01).
  const filtros = { produto: new Set(), dias: new Set(), oracoes: new Set(), formulario: new Set() };

  const diasDe = customer => customer.distinct_visit_days || 0;
  // ⚠️ completed_prayers soma as DUAS jornadas: prayer_key aceita
  // principal:0-7 E desatadora:1-9. Por isso a última faixa é "7 ou mais" e
  // não "as 7 madrugadas" — o número não sabe separar uma coisa da outra.
  const oracoesDe = customer => customer.completed_prayers || 0;

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
      { id: '7+', rotulo: '7 ou mais', testa: c => oracoesDe(c) >= 7 },
    ],
    formulario: [
      { id: 'sim', rotulo: 'Respondeu', testa: c => !!c.profile_completed_at },
      { id: 'nao', rotulo: 'Não respondeu', testa: c => !c.profile_completed_at },
    ],
  };

  const passaNoProduto = customer => [...filtros.produto]
    .every(key => Array.isArray(customer.active_products) && customer.active_products.includes(key));
  const passaNaFaixa = (customer, grupo) => !filtros[grupo].size
    || FAIXAS[grupo].some(faixa => filtros[grupo].has(faixa.id) && faixa.testa(customer));

  // Recebe o nome do grupo que está sendo desenhado e ignora justamente ele:
  // é o que faz o número do chip dizer "quantas eu ganho se marcar isto", em
  // vez de um total solto que pode prometer 30 e entregar 0.
  function filtradas(exceto = null) {
    const term = (search?.value || '').trim().toLowerCase();
    return customers.filter(customer => {
      if (term && !`${customer.name || ''} ${customer.email}`.toLowerCase().includes(term)) return false;
      if (exceto !== 'produto' && !passaNoProduto(customer)) return false;
      for (const grupo of ['dias', 'oracoes', 'formulario']) {
        if (exceto !== grupo && !passaNaFaixa(customer, grupo)) return false;
      }
      return true;
    });
  }

  // chipDeFiltro, e não chip: já existe um chip() neste arquivo (lá em cima)
  // que desenha o código UP01/UP02 do funil. Duas funções com o mesmo nome no
  // mesmo escopo não dão erro nenhum — a de baixo simplesmente substitui a de
  // cima. O funil passou a imprimir "UP01 undefined" sem derrubar a tela, e só
  // apareceu abrindo o painel no navegador.
  function chipDeFiltro(rotulo, quantos, marcado, aoTocar) {
    const botao = element('button', 'admin-filter-chip', rotulo);
    botao.type = 'button';
    botao.setAttribute('aria-pressed', marcado ? 'true' : 'false');
    if (marcado) botao.classList.add('is-on');
    botao.append(element('span', 'admin-filter-chip-n', String(quantos)));
    botao.addEventListener('click', aoTocar);
    return botao;
  }

  function renderFiltros() {
    // O catálogo manda na lista de produtos: quando entrar uma novena nova, o
    // filtro dela aparece sozinho, sem ninguém lembrar de editar isto.
    // Aqui NÃO se exclui o próprio grupo, ao contrário dos outros: como a soma
    // de produtos é E, o número útil é "quantas sobram se eu somar este ao que
    // já está marcado". Excluindo o grupo, o chip prometia o total solto do
    // produto e podia entregar menos depois do clique.
    const baseProduto = filtradas();
    document.getElementById('filter-produto').replaceChildren(...catalog.map(product => chipDeFiltro(
      product.key === 'principal' ? 'Principal' : product.key.replace(/^upsell_0?/, 'UP0').toUpperCase(),
      baseProduto.filter(c => Array.isArray(c.active_products) && c.active_products.includes(product.key)).length,
      filtros.produto.has(product.key),
      () => alternar(filtros.produto, product.key),
    )));
    for (const grupo of ['dias', 'oracoes', 'formulario']) {
      const base = filtradas(grupo);
      document.getElementById(`filter-${grupo}`).replaceChildren(...FAIXAS[grupo].map(faixa => chipDeFiltro(
        faixa.rotulo,
        base.filter(faixa.testa).length,
        filtros[grupo].has(faixa.id),
        () => alternar(filtros[grupo], faixa.id),
      )));
    }
    document.getElementById('filter-clear').hidden = !temFiltroLigado();
  }

  const temFiltroLigado = () => Object.values(filtros).some(conjunto => conjunto.size > 0);

  function alternar(conjunto, valor) {
    if (conjunto.has(valor)) conjunto.delete(valor); else conjunto.add(valor);
    renderCustomerList();
  }
  // --- perfil do grupo que está na tela -----------------------------------
  // As respostas já vêm dentro de admin_customer_overview, uma coluna por
  // pergunta — então este resumo não custa consulta nenhuma. Ele obedece aos
  // filtros de propósito: é o que responde "quem são as que compraram o
  // UP01?" em vez de só "quem são as clientes?".
  //
  // A ordem das opções espelha perfil.html. Está escrita à mão, e não tirada
  // dos dados, porque opção que ninguém escolheu também informa — sumir com
  // ela esconderia justamente o "ninguém pediu isso". Ao mexer no
  // formulário, mexa aqui junto.
  const PERGUNTAS_DO_PERFIL = [
    { campo: 'motherhood_status', titulo: 'Filhos e netos', opcoes: ['mother', 'father', 'grandmother', 'grandfather', 'mother_and_grandmother', 'father_and_grandfather', 'neither'] },
    { campo: 'relationship_status', titulo: 'Vida amorosa', opcoes: ['married', 'relationship', 'single', 'widowed', 'prefer_not_to_say'] },
    { campo: 'church_frequency', titulo: 'Presença na Missa', opcoes: ['weekly', 'monthly', 'occasionally', 'not_attending_but_faithful', 'reconnecting'] },
    { campo: 'primary_prayer_recipient', titulo: 'Por quem reza', opcoes: ['children', 'grandchildren', 'partner', 'whole_family', 'someone_in_difficulty', 'self'] },
    { campo: 'primary_intention', titulo: 'Intenção principal', opcoes: ['family_protection', 'children_or_grandchildren', 'health_and_healing', 'marriage_or_relationship', 'finances_and_work', 'peace_and_anxiety', 'difficult_cause'] },
    { campo: 'favorite_devotion', titulo: 'Devoção', opcoes: ['saint_michael', 'saint_benedict', 'our_lady', 'saint_joseph', 'saint_rita', 'saint_jude', 'sacred_heart_or_divine_mercy', 'no_specific_devotion'] },
  ];

  function renderPerfil(visible) {
    const area = document.getElementById('admin-perfil');
    if (!area) return;
    // A base é quem RESPONDEU, nunca o total do grupo. Dividir por quem não
    // respondeu daria uma foto achatada de um formulário que a maioria ainda
    // não viu, e todo percentual sairia menor do que é.
    const responderam = visible.filter(customer => !!customer.profile_completed_at);
    area.hidden = !responderam.length;
    if (!responderam.length) { area.replaceChildren(); return; }

    const cabeca = element('section', 'admin-block');
    cabeca.append(element('h3', '', 'Quem respondeu'));
    // A frase concorda com quem RESPONDEU, não com o tamanho do grupo: com uma
    // resposta só, "1 de 15 clientes responderam" sai errado nas duas pontas.
    const total = visible.length;
    const quantas = responderam.length;
    cabeca.append(element('p', 'admin-block-q', quantas === 1
      ? `1 de ${total} ${total === 1 ? 'cliente' : 'clientes'} respondeu o formulário. As porcentagens abaixo são sobre ela.`
      : `${quantas} de ${total} clientes responderam o formulário. Toda porcentagem abaixo é sobre essas ${quantas} respostas.`));

    const blocos = PERGUNTAS_DO_PERFIL.map(pergunta => {
      const secao = bloco(pergunta.titulo, null);
      const linhas = pergunta.opcoes
        .map(opcao => ({ opcao, quantas: responderam.filter(c => c[pergunta.campo] === opcao).length }))
        // Da mais escolhida para a menos: o painel é lido para decidir, e
        // quem decide quer o topo da lista, não a ordem do formulário.
        .sort((a, b) => b.quantas - a.quantas);
      linhas.forEach(({ opcao, quantas }) => {
        // taxa() é a mesma do funil, e é ela que decide sozinha se a base
        // aguenta virar porcentagem. Base pequena mente — a regra vale aqui
        // igual, e ninguém pode contorná-la escrevendo a conta na mão.
        const conta = taxa(quantas, responderam.length);
        // is-perfil tira a primeira coluna da grade. A linha do funil reserva
        // 44px para o chip UP01, e sem esse ajuste o nome da resposta cai
        // dentro dos 44px e quebra em quatro linhas ("Não é / mãe / nem / avó").
        const linha = element('div', 'admin-matrix-row is-perfil');
        linha.append(element('span', 'admin-matrix-nome', answerLabels[opcao] || opcao));
        linha.append(element('strong', 'admin-matrix-num', String(quantas)));
        linha.append(element('span', `admin-matrix-pct${conta.fraca ? ' is-thin' : ''}`, conta.fraca ? '' : conta.destaque));
        linha.append(barra(conta.pct, conta.fraca));
        secao.append(linha);
      });
      return secao;
    });

    area.replaceChildren(cabeca, ...blocos);
  }
  function renderCustomerList() {
    const visible = filtradas();
    renderFiltros();
    renderPerfil(visible);
    const container = document.getElementById('admin-customers');
    container.replaceChildren(...visible.map(renderCustomer));
    const filtrando = temFiltroLigado() || !!(search?.value || '').trim();
    if (!visible.length) container.append(element('p', 'admin-empty', filtrando ? 'Nenhuma cliente com esses filtros.' : 'Nenhuma cliente cadastrada.'));
    // "47 de 663" em vez de só "47": sem o total, dá para achar que a base
    // encolheu quando na verdade há filtro ligado.
    document.getElementById('customer-count').textContent = filtrando
      ? `${visible.length} de ${customers.length}`
      : String(visible.length);
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
      renderFunnel(data.funnel);
      const campaigns = document.getElementById('admin-campaigns');
      campaigns.replaceChildren(...data.campaigns.map(renderCampaign));
      if (!data.campaigns.length) campaigns.append(element('p', 'admin-empty', 'Nenhuma campanha configurada.'));
      document.getElementById('campaign-count').textContent = data.campaigns.length;
      renderBanners(data.banners);
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

  // --- banners do destaque da home ---------------------------------------
  // Esta seção é a única do painel que ESCREVE conteúdo que a cliente vê.
  // Por isso ela salva um banner de cada vez, com confirmação na tela, em
  // vez de salvar tudo junto: um engano aqui aparece na home de 577 pessoas
  // em cinco minutos, sem passar por deploy nenhum.
  const bannerSection = document.getElementById('banner-section');
  const bannerStatus = document.getElementById('banner-status');
  const IMAGEM_DE_ESPERA = 'assets/images/icon-96.png';

  function avisoDoBanner(texto, erro = false) {
    bannerStatus.hidden = false;
    bannerStatus.className = erro ? 'admin-form-status is-error' : 'admin-form-status';
    bannerStatus.textContent = texto;
  }

  // O endereço guardado é sempre o de produção. Aqui no painel ele é
  // mostrado como está — mas a MINIATURA precisa do endereço local quando
  // a gente testa em localhost, senão ela busca a imagem no site das
  // clientes e some quando o arquivo ainda não subiu.
  function paraMiniatura(endereco) {
    try {
      const url = new URL(endereco, location.href);
      if (/(?:^|[.-])(?:setemadrugadas\.com\.br|7-amens-app-v2\.netlify\.app|7madrugadas\.netlify\.app)$/.test(url.hostname)) {
        return new URL(url.pathname + url.search, location.href).href;
      }
      return url.href;
    } catch { return IMAGEM_DE_ESPERA; }
  }

  function campoDoBanner(rotulo, valor, dica) {
    const bloco = element('div', 'admin-banner-campo');
    const label = element('label', '', rotulo);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor || '';
    input.placeholder = dica;
    input.autocomplete = 'off';
    input.spellcheck = false;
    const id = `banner-campo-${Math.random().toString(36).slice(2, 9)}`;
    input.id = id;
    label.htmlFor = id;
    bloco.append(label, input);
    return { bloco, input };
  }

  function renderBanner(banner, novo = false) {
    const card = element('article', `admin-banner${novo ? ' is-novo' : ''}`);
    // Estas duas marcas são o que impede o painel de apagar trabalho.
    // Qualquer ação recarrega o painel inteiro e redesenha os cartões; sem
    // saber quais estão "sujos" (mexidos e não salvos), o redesenho varreria
    // o que o Caio acabou de digitar em OUTRO cartão, sem uma palavra.
    card.dataset.chave = banner.key || '';
    if (novo) card.dataset.sujo = '1';
    const sujar = () => { card.dataset.sujo = '1'; };

    const topo = element('div', 'admin-banner-top');
    const mini = document.createElement('img');
    mini.className = 'admin-banner-thumb';
    mini.alt = '';
    mini.src = banner.image_url ? paraMiniatura(banner.image_url) : IMAGEM_DE_ESPERA;
    mini.addEventListener('error', () => { mini.src = IMAGEM_DE_ESPERA; mini.classList.add('is-quebrada'); });
    const identidade = element('div', 'admin-banner-id');
    identidade.append(
      element('strong', '', novo ? 'Banner novo' : banner.key),
      element('span', `admin-badge${banner.enabled ? ' active' : ''}`, banner.enabled ? 'Na home' : 'Desligado'),
    );
    topo.append(mini, identidade);

    if (!novo) {
      const ordem = element('div', 'admin-banner-ordem');
      [['up', '↑', 'Subir este banner'], ['down', '↓', 'Descer este banner']].forEach(([direcao, seta, rotulo]) => {
        const botao = element('button', 'admin-mini-btn', seta);
        botao.type = 'button';
        botao.title = rotulo;
        botao.setAttribute('aria-label', rotulo);
        botao.addEventListener('click', async () => {
          botao.disabled = true;
          // O aviso vem ANTES do load(). Recarregar o painel puxa a lista
          // inteira de clientes e leva alguns segundos; sem uma palavra na
          // tela, quem tocou acha que o botão não funcionou e toca de novo.
          avisoDoBanner('Mudando a ordem…');
          try { await api({ action: 'admin_move_banner', key: banner.key, direction: direcao }); avisoDoBanner('Ordem alterada.'); await load(); }
          catch (erro) { avisoDoBanner(erro.message, true); botao.disabled = false; }
        });
        ordem.append(botao);
      });
      topo.append(ordem);
    }

    const nome = campoDoBanner('Nome (só você vê)', banner.title, 'Novena de Maio');
    const imagem = campoDoBanner('Endereço da imagem — 1200×900', banner.image_url, 'https://setemadrugadas.com.br/assets/images/banner-1.jpg');
    const destino = campoDoBanner('Para onde leva ao tocar', banner.target_url, 'https://setemadrugadas.com.br/novena.html');
    // A miniatura acompanha o que está sendo digitado: é o jeito de
    // descobrir que o endereço está errado ANTES de salvar.
    imagem.input.addEventListener('change', () => {
      mini.classList.remove('is-quebrada');
      mini.src = imagem.input.value.trim() ? paraMiniatura(imagem.input.value.trim()) : IMAGEM_DE_ESPERA;
    });
    [nome, imagem, destino].forEach(campo => campo.input.addEventListener('input', sujar));

    const ligado = element('label', 'admin-banner-check');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = Boolean(banner.enabled);
    caixa.addEventListener('change', sujar);
    ligado.append(caixa, document.createTextNode('Aparecendo na home'));

    const acoes = element('div', 'admin-banner-acoes');
    const salvar = element('button', 'admin-banner-salvar', 'Salvar');
    salvar.type = 'button';
    salvar.addEventListener('click', async () => {
      salvar.disabled = true;
      salvar.textContent = 'Salvando…';
      try {
        const resposta = await api({
          action: 'admin_save_banner',
          key: banner.key || undefined,
          title: nome.input.value.trim(),
          image_url: imagem.input.value.trim(),
          target_url: destino.input.value.trim(),
          enabled: caixa.checked,
        });
        // Guardar a chave que o servidor devolveu é o que impede o banner
        // em dobro: sem isto, um segundo toque em Salvar num cartão NOVO
        // manda "sem chave" de novo e nasce outro banner na home.
        if (!banner.key && resposta && resposta.key) {
          banner.key = resposta.key;
          card.dataset.chave = resposta.key;
        }
        // Salvo: este cartão deixa de ser "trabalho em aberto" e pode ser
        // substituído pela versão que vem do banco.
        card.dataset.sujo = '';
        card.classList.remove('is-novo');
        avisoDoBanner(caixa.checked
          ? 'Banner salvo e no ar. As clientes veem em até 5 minutos.'
          : 'Banner salvo e desligado — ele não aparece na home.');
        await load();
      } catch (erro) {
        // A mensagem NÃO convida a tocar de novo. Se o pedido chegou no
        // banco e só a resposta se perdeu, salvar outra vez criaria um
        // banner duplicado na home de todo mundo.
        avisoDoBanner(`${erro.message} Toque em ↻ no alto da página e confira se o banner já entrou antes de salvar de novo.`, true);
        salvar.disabled = false;
        salvar.textContent = 'Salvar';
      }
    });

    const remover = element('button', 'admin-banner-remover', novo ? 'Descartar' : 'Remover');
    remover.type = 'button';
    remover.addEventListener('click', async () => {
      if (novo) { card.remove(); return; }
      if (!window.confirm(`Remover o banner "${banner.title || banner.key}" da home? Não dá para desfazer.`)) return;
      remover.disabled = true;
      try { await api({ action: 'admin_delete_banner', key: banner.key }); avisoDoBanner('Banner removido.'); await load(); }
      catch (erro) { avisoDoBanner(erro.message, true); remover.disabled = false; }
    });
    acoes.append(salvar, remover);

    card.append(topo, nome.bloco, imagem.bloco, destino.bloco, ligado, acoes);
    return card;
  }

  function renderBanners(banners) {
    const area = document.getElementById('admin-banners');
    // `null` quer dizer que a tabela ainda não existe neste banco — é
    // diferente de lista vazia. Nesse caso a seção inteira some, em vez de
    // oferecer um botão que só daria erro.
    if (!Array.isArray(banners)) { bannerSection.hidden = true; return; }
    bannerSection.hidden = false;

    // Cartão "sujo" é um que o Caio mexeu e ainda não salvou. Qualquer ação
    // no painel roda load(), que passa por aqui — e antes disto o redesenho
    // varria o que ele tinha acabado de digitar, sem uma palavra. Agora o
    // cartão sujo fica onde está, com o texto dele; só os limpos são
    // trocados pela versão do banco.
    const abertos = [...area.querySelectorAll('.admin-banner')].filter(c => c.dataset.sujo === '1');
    const mexidos = new Map(abertos.filter(c => c.dataset.chave).map(c => [c.dataset.chave, c]));
    const novosEmAberto = abertos.filter(c => !c.dataset.chave);

    area.replaceChildren(
      ...banners.map(banner => mexidos.get(banner.key) || renderBanner(banner)),
      ...novosEmAberto,
    );
    if (!banners.length && !novosEmAberto.length) area.append(element('p', 'admin-empty', 'Nenhum banner ainda. A home está mostrando os três de reserva que vêm no próprio app.'));
    document.getElementById('banner-count').textContent = banners.length;
  }

  document.getElementById('banner-add')?.addEventListener('click', () => {
    const area = document.getElementById('admin-banners');
    area.querySelector('.admin-empty')?.remove();
    const card = renderBanner({ key: '', title: '', image_url: '', target_url: '', enabled: false }, true);
    area.append(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.querySelector('input')?.focus();
  });

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
  document.getElementById('filter-clear')?.addEventListener('click', () => {
    Object.values(filtros).forEach(conjunto => conjunto.clear());
    renderCustomerList();
  });
  document.getElementById('detail-close')?.addEventListener('click', () => detail.close());
  detail?.addEventListener('click', event => { if (event.target === detail) detail.close(); });
  refreshButton.addEventListener('click', load);
  load();
})();
