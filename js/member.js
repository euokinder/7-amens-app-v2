(() => {
  'use strict';
  const storageKey = '7amens.member.session.v2';
  // A Terceira Madrugada e a unica que conclui pela contribuicao, nao pelo
  // botao. Ver o bloco de doacao em dia.html e a decisao de 22/09/2026.
  const CHAVE_DIA_03 = 'principal:3';
  const AJUDA = 'https://wa.me/5591980159224?text=Preciso%20de%20ajuda%20para%20entrar%20no%20app%207%20Am%C3%A9ns.';
  const readToken = () => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } };
  let token = readToken();
  let state = null;
  let refreshing = false;
  let surveyRedirecting = false;
  const login = /\/login(?:\.html)?\/?$/.test(location.pathname);
  const entrada = /\/entrar(?:\.html)?\/?$/.test(location.pathname);
  function remember(value) { token = value; try { value ? localStorage.setItem(storageKey, value) : localStorage.removeItem(storageKey); } catch {} }
  // AbortSignal.timeout não existe em iPhone com iOS 15 ou anterior, aparelho
  // comum no público do app. Com ele, a chamada quebrava antes de sair do
  // celular e a cliente lia "confira sua internet" com a internet perfeita.
  function limiteDeTempo(ms) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), ms);
    return { signal: controle.signal, encerrar: () => clearTimeout(relogio) };
  }
  async function api(action, values = {}) {
    const limite = limiteDeTempo(15000);
    try {
      const response = await fetch(window.MEMBER_API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-member-session': token }, body: JSON.stringify({ action, ...values }), signal: limite.signal });
      // Um 502 do gateway volta em HTML, nao em JSON. Sem isto, o erro que a
      // cliente le e uma mensagem tecnica de leitura, e nao o que aconteceu.
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || 'Não foi possível conectar. Tente novamente.'); error.status = response.status; throw error; }
      return data;
    } finally { limite.encerrar(); }
  }
  function returnPath() {
    const next = new URLSearchParams(location.search).get('next');
    return next && /^(index|novena|desatadora|dia|dia-desatadora|perfil|admin|oferta-arcanjos|arcanjos|arcanjo|oracao-arcanjo|cantico|cantico-dia|oferta-cantico)\.html(\?[^#]*)?$/.test(next) ? next : 'index.html';
  }
  function toLogin(message = '') {
    remember('');
    if (message) { try { sessionStorage.setItem('member-message', message); } catch {} }
    const current = location.pathname.split('/').pop() || 'index.html';
    const page = current.endsWith('.html') ? current : `${current}.html`;
    location.replace(`login.html?next=${encodeURIComponent(page + location.search)}`);
  }
  function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; }
  const completed = key => Boolean(state?.progress.find(item => item.prayer_key === key)?.completed);
  function closeMemberMenu() {
    const dialog = document.getElementById('member-account-dialog');
    if (dialog?.open) dialog.close();
  }
  function setupMemberMenu() {
    let trigger = document.getElementById('member-menu-trigger');
    const avatar = document.querySelector('.header .avatar');
    if ((!avatar && !trigger) || !state) return;
    if (!trigger) {
      trigger = node('button', 'member-menu-trigger');
      trigger.id = 'member-menu-trigger';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Abrir minha conta');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      const emoji = node('span', 'member-menu-emoji', '👤');
      emoji.setAttribute('aria-hidden', 'true');
      trigger.append(emoji);
      avatar.replaceWith(trigger);
    }
    let dialog = document.getElementById('member-account-dialog');
    if (!dialog) {
      dialog = node('dialog', 'member-account-dialog');
      dialog.id = 'member-account-dialog';
      dialog.setAttribute('aria-labelledby', 'member-account-title');
      const sheet = node('div', 'member-account-sheet');
      const heading = node('div', 'member-account-heading');
      const titleBlock = node('div', '');
      const eyebrow = node('span', 'member-account-eyebrow', 'Minha conta');
      const title = node('h2', '', 'Acesso ao aplicativo');
      title.id = 'member-account-title';
      titleBlock.append(eyebrow, title);
      const close = node('button', 'member-menu-close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', 'Fechar minha conta');
      close.addEventListener('click', closeMemberMenu);
      heading.append(titleBlock, close);
      const details = node('div', 'member-account-details');
      details.append(
        node('span', 'member-account-label', 'E-mail de acesso'),
        node('p', 'member-account-email', ''),
        node('p', 'member-sync', '')
      );
      details.querySelector('.member-sync').setAttribute('role', 'status');
      const logout = node('button', 'member-button member-logout', 'Sair / trocar e-mail');
      logout.type = 'button';
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        logout.textContent = 'Saindo…';
        try { await api('logout'); } catch {}
        toLogin();
      });
      const hint = node('p', 'member-account-hint', 'Você poderá entrar novamente usando o e-mail da compra.');
      sheet.append(heading, details, logout, hint);
      dialog.append(sheet);
      dialog.addEventListener('close', () => {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      });
      dialog.addEventListener('click', event => {
        if (event.target === dialog) closeMemberMenu();
      });
      document.body.append(dialog);
      trigger.addEventListener('click', () => {
        trigger.setAttribute('aria-expanded', 'true');
        dialog.showModal();
      });
    }
    dialog.querySelector('.member-account-email').textContent = state.customer.email;
    dialog.querySelector('.member-sync').textContent = `${state.progress.filter(item => item.completed).length} orações concluídas · progresso salvo`;
  }
  // Pré-visualização da oferta, para revisar o desenho: abre sempre, só para
  // admin, sem gravar exibição e sem consumir as aparições reais da cliente.
  // ?previa-oferta=1 mostra a primeira ativa; ?previa-oferta=<chave> mostra
  // uma campanha específica, mesmo desativada, para revisar antes de ligar.
  const previaPedida = new URLSearchParams(location.search).get('previa-oferta');
  const previaDaOferta = previaPedida !== null;
  async function mostrarPreviaDaOferta() {
    if (document.getElementById('member-offer-dialog')) return;
    try {
      const chave = /^[a-z0-9_-]+$/.test(previaPedida) && previaPedida !== '1' ? previaPedida : '';
      const resposta = await api('offer_preview', chave ? { campaign_key: chave } : {});
      if (resposta.offer) setupMemberOffer(resposta.offer);
    } catch {}
  }
  // Os endereços do próprio app, em todas as roupas que ele veste: o
  // domínio de verdade, o site de validação e os links de cada deploy.
  const nossosSites = /(?:^|[.-])(?:setemadrugadas\.com\.br|7-amens-app-v2\.netlify\.app|7madrugadas\.netlify\.app)$/;
  // A campanha guarda o endereço COMPLETO (o banco só aceita https). Quando
  // esse endereço é uma página do próprio app, trocamos o domínio pelo de
  // agora. Sem isto, clicar no pop-up em localhost jogaria quem está
  // testando direto no site das clientes reais.
  function mesmoApp(url) {
    if (!nossosSites.test(url.hostname)) return url;
    try { return new URL(url.pathname + url.search + url.hash, location.href); } catch { return url; }
  }
  function setupMemberOffer(nextOffer = null) {
    const offer = nextOffer || state?.offer;
    if (!offer || document.getElementById('member-offer-dialog')) return;
    // Na própria página de oferta o pop-up não aparece: ela já está lá dentro.
    if (/\/oferta-arcanjos(?:\.html)?$/.test(location.pathname)) return;
    let target;
    try { target = new URL(offer.target_url); } catch { return; }
    if (target.protocol !== 'https:') return;
    target = mesmoApp(target);
    const dialog = node('dialog', 'member-offer-dialog');
    dialog.id = 'member-offer-dialog';
    dialog.dataset.offerType = offer.offer_type || 'product';
    dialog.setAttribute('aria-labelledby', 'member-offer-title');
    const sheet = node('div', 'member-offer-sheet');
    // A chamada aceita duas linhas: a primeira vira alerta, a segunda o rótulo
    // dourado de sempre. Uma linha só continua se comportando como antes.
    const chamadas = String(offer.eyebrow || 'Uma oportunidade para você').split('\n').map(l => l.trim()).filter(Boolean);
    const eyebrow = node('div', 'member-offer-eyebrow');
    chamadas.forEach((linha, indice) => {
      eyebrow.append(node('span', chamadas.length > 1 && indice === 0 ? 'member-offer-alert' : '', linha));
    });
    const title = node('h2', '', offer.headline);
    title.id = 'member-offer-title';
    // Cada linha da copy vira um parágrafo: blocos curtos são bem mais fáceis
    // de ler para o público do app, e a última frase é a que leva ao clique.
    const paragrafos = String(offer.body || '').split('\n').map(linha => linha.trim()).filter(Boolean);
    const copy = node('div', 'member-offer-copy');
    paragrafos.forEach((linha, indice) => {
      copy.append(node('p', indice === paragrafos.length - 1 && paragrafos.length > 1 ? 'member-offer-lead' : '', linha));
    });
    const cta = node('button', 'member-button member-offer-cta', offer.cta_label || 'Assistir agora');
    cta.type = 'button';
    const dismiss = node('button', 'member-offer-dismiss', offer.dismiss_label || 'Agora não');
    dismiss.type = 'button';
    let leaving = false;
    const record = event => offer.preview
      ? Promise.resolve()
      : api('offer_event', { campaign_key: offer.campaign_key, event }).catch(() => {});
    cta.addEventListener('click', async () => {
      if (leaving) return;
      leaving = true;
      cta.disabled = true;
      cta.textContent = 'Abrindo…';
      await Promise.race([record('clicked'), new Promise(resolve => setTimeout(resolve, 900))]);
      location.assign(target.href);
    });
    dismiss.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', async () => {
      if (leaving) return;
      if (state?.offer?.campaign_key === offer.campaign_key) state.offer = null;
      await record('dismissed');
      dialog.remove();
      if (offer.preview) return;
      try {
        const followup = await api('offer_claim', {
          trigger_type: 'dismissal',
          source_campaign_key: offer.campaign_key,
        });
        if (followup.offer) setupMemberOffer(followup.offer);
      } catch {}
    });
    sheet.append(eyebrow, title, copy, cta, dismiss);
    dialog.append(sheet);
    document.body.append(dialog);
    dialog.showModal();
    record('shown');
  }
  function setupMemberSurvey() {
    const survey = state?.survey;
    // A pesquisa de perfil não interrompe a página de oferta. Ela chegou ali
    // por um pop-up, está no meio de um vídeo de venda: arrancá-la para
    // responder um formulário mata a oferta e ainda perde o vídeo já assistido.
    if (!survey || surveyRedirecting || /\/(perfil|oferta-arcanjos)(?:\.html)?$/.test(location.pathname)) return false;
    if (!/^[a-z0-9_-]+$/.test(survey.campaign_key || '') || !/^[a-z0-9-]+[.]html$/.test(survey.target_path || '')) return false;
    surveyRedirecting = true;
    try { sessionStorage.setItem('7amens.member.survey.return', `${location.pathname.split('/').pop() || 'index.html'}${location.search}`); } catch {}
    const target = new URL(survey.target_path, location.href);
    target.searchParams.set('campaign', survey.campaign_key);
    // Quem registra que o formulário apareceu é o BANCO, na mesma operação em
    // que ele decide entregá-lo. Aqui havia um aviso com espera de 0,9s: numa
    // rede ruim ele falhava calado, a exibição não era gravada e o formulário
    // voltava a aparecer para quem já tinha visto. Sem ele o desvio também
    // deixa de ter meio segundo de tela parada.
    location.assign(target.href);
    return true;
  }
  function prayerKey(path, search) {
    const params = new URLSearchParams(search);
    const day = params.get('dia');
    if (/\/dia(?:\.html)?$/.test(path) && !params.has('material') && /^[0-7]$/.test(day || '')) return `principal:${day}`;
    if (/\/dia-desatadora(?:\.html)?$/.test(path) && /^[1-9]$/.test(day || '')) return `desatadora:${day}`;
    if (/\/cantico-dia(?:\.html)?$/.test(path) && /^[0-7]$/.test(day || '')) return `cantico:${day}`;
    return null;
  }
  // A SAUDACAO DA HOME
  //
  // "Ola Maria, que a paz do Senhor esteja com voce!". O nome vem do cadastro
  // da Hubla, junto com a venda, e chega torto com frequencia: em 19/09/2026,
  // das 575 clientes com nome, 27 estavam em MAIUSCULAS, 9 em minusculas e 5
  // tinham numero no meio. Duas nao tinham nome nenhum.
  //
  // Por isso o nome passa por uma peneira antes de aparecer na tela. Nome que
  // nao passa nao vira "Ola ," nem "Ola MARIA123," -- fica valendo a saudacao
  // sem nome que ja esta escrita no index.html, que se sustenta sozinha.
  //
  // So o primeiro nome. "Ola Maria Aparecida da Silva" e comprido demais para
  // uma linha de boas-vindas, e ninguem fala assim.
  function primeiroNome(nomeCompleto) {
    const bruto = String(nomeCompleto || '').trim().split(/\s+/)[0] || '';
    // Letra de verdade no comeco, depois letras, hifen ou apostrofo -- Maria,
    // Jose, Ana-Clara, D'Angelo. De 2 a 15 letras: um "M" sozinho nao vira
    // saudacao, e nome grudado sem espaco (o maior no banco tem 32 letras)
    // tambem nao. Numero ou arroba reprovam o nome inteiro.
    if (!/^[\p{L}][\p{L}'-]{1,14}$/u.test(bruto)) return '';
    // MARIA e maria viram Maria; ANA-CLARA vira Ana-Clara.
    return bruto.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, separador, letra) => separador + letra.toUpperCase());
  }
  function desenharSaudacao() {
    const alvo = document.getElementById('saudacao');
    if (!alvo) return;
    const nome = primeiroNome(state && state.customer && state.customer.name);
    // Sem nome bom, nao mexe: o texto do HTML ja esta certo.
    if (nome) alvo.textContent = `Olá ${nome}, que a paz do Senhor esteja com você!`;
  }
  // A TRAVA DAS MADRUGADAS — a conta mora em js/trava.js
  //
  // Duas telas obedecem a ela. A lista das 7 orações (novena.html) redesenha
  // com cadeado nas que ainda não abriram, logo abaixo no render(). E esta
  // função cuida da outra: a página de uma oração (dia.html), para quem chega
  // por link direto — de um WhatsApp antigo, de um favorito, ou porque trocou
  // o número no endereço.
  //
  // O js/trava.js só é carregado nessas duas páginas; nas outras `trava` chega
  // nulo e aqui não há nada a fazer.
  //
  // ⚠️ Não é cadeado de verdade. O texto das orações está em js/dias.js, que é
  // arquivo público. Isto guia a jornada; não protege conteúdo.
  function bloquearDiaTravado(trava) {
    if (!trava) return false;
    const dia = /^principal:([1-7])$/.exec(prayerKey(location.pathname, location.search) || '');
    if (!dia || Number(dia[1]) <= trava.liberados) return false;

    const content = document.querySelector('.content');
    if (!content) return false;
    const titulo = node('h1', 'title', 'Esta oração ainda não chegou');
    titulo.style.fontSize = '22px';
    const bloco = node('div', 'heading-block');
    bloco.append(titulo, node('p', 'subtext', window.TRAVA.selo(Number(dia[1]), trava) === 'Abre amanhã'
      ? 'Ela abre amanhã, assim que a madrugada virar. Uma oração por dia, do jeito que a jornada foi feita.'
      : 'Cada madrugada abre a seguinte. Esta ainda está esperando a vez dela chegar.'));
    const voltar = node('a', 'member-button', 'Voltar para as minhas orações');
    voltar.href = 'novena.html';
    content.replaceChildren(bloco, voltar);
    return true;
  }
  // A CENTRAL DOS QUATRO ARCANJOS — o que a cliente recebe com o upsell_01
  //
  // O primeiro conteúdo do app trancado por produto extra (decisão do Caio,
  // 24/09/2026): quem comprou os Arcanjos entra; quem não comprou vê o card
  // com cadeado, que leva à página de oferta. Duas telas obedecem: o card da
  // home (index.html) e as três páginas da Central, para quem chega por link.
  //
  // Cancelar a assinatura NÃO tranca — quem pagou continua com a Central
  // (decisão de 24/09). Só reembolso tira. Quem sabe separar um caso do outro
  // é a member-api, no campo `conteudos`. Enquanto a função publicada não
  // mandar esse campo, vale a lista de produtos ativos — que hoje dá no mesmo,
  // porque nenhuma assinatura dos Arcanjos tinha sido encerrada até 24/09.
  //
  // ⚠️ Não é cadeado de verdade: os textos estão em js/arcanjos.js, arquivo
  // público. Guia a cliente; não protege conteúdo.
  const PRODUTO_ARCANJOS = 'upsell_01';
  const PAGINA_DOS_ARCANJOS = /\/(arcanjos|arcanjo|oracao-arcanjo)(?:\.html)?$/;
  // A etiqueta separa, no evento da Hubla, a venda que veio do card da que
  // veio do pop-up (utm_medium=popup). Ver oferta-arcanjos.html.
  const ofertaDosArcanjos = origem => `oferta-arcanjos.html?utm_source=app&utm_medium=card&utm_campaign=arcanjos&utm_content=${origem}`;
  const temArcanjos = () => (Array.isArray(state?.conteudos) ? state.conteudos : state?.products || []).includes(PRODUTO_ARCANJOS);
  function desenharCardArcanjos() {
    const card = document.getElementById('card-arcanjos');
    if (!card) return;
    const liberado = temArcanjos();
    const situacao = liberado ? 'liberado' : 'trancado';
    card.dataset.situacao = situacao;
    card.href = liberado ? 'arcanjos.html' : ofertaDosArcanjos('card-home');
    // O selo e o botão trazem as duas versões do texto no index.html
    // ("LIBERADO" / "🔒 EXTRA", "Acessar conteúdo" / "Adquirir"). O 🔒 vem
    // escrito no próprio texto: é o sinal que a frase acima dos extras explica.
    card.querySelectorAll('[data-liberado]').forEach(texto => {
      texto.textContent = texto.dataset[situacao] || texto.textContent;
    });
  }
  function trancarPaginaDosArcanjos() {
    if (!PAGINA_DOS_ARCANJOS.test(location.pathname)) return false;
    const content = document.querySelector('.content');
    if (!content) return false;
    if (temArcanjos()) {
      // Comprou com a tela trancada aberta: a verificação seguinte a encontra
      // aqui, e só recarregando a Central volta a aparecer.
      if (content.dataset.trancada) location.reload();
      return false;
    }
    if (content.dataset.trancada) return true;
    content.dataset.trancada = '1';
    const titulo = node('h1', 'title', 'Central dos Quatro Arcanjos');
    titulo.style.fontSize = '22px';
    const bloco = node('div', 'heading-block');
    bloco.append(titulo, node('p', 'subtext', 'Estas orações fazem parte da Oração Celestial dos Quatro Arcanjos, que ainda não está no seu acesso. Toque abaixo para conhecer.'));
    const conhecer = node('a', 'member-button', 'Conhecer os Quatro Arcanjos');
    conhecer.href = ofertaDosArcanjos('link-direto');
    conhecer.style.textAlign = 'center';
    const voltar = node('a', 'member-gate-help', 'Voltar para o início');
    voltar.href = 'index.html';
    voltar.style.textAlign = 'center';
    content.replaceChildren(bloco, conhecer, voltar);
    return true;
  }
  // O CÂNTICO ANGELICAL — o que a cliente recebe com o upsell_02
  //
  // Segundo conteúdo trancado por produto extra (decisão do Caio, 24/09/2026).
  // Na Hubla e no banco o produto ainda se chama "Músicas dos Anjos": é o
  // mesmo, só com nome novo. O desenho é o da Central dos Arcanjos, logo
  // acima: quem comprou entra; quem não comprou vê o cadeado e vai para a
  // oferta. Fica separado de propósito, para mexer num sem encostar no outro.
  //
  // Também é assinatura mensal, e também continua com quem cancela — só
  // reembolso tira (decisão de 24/09). Quem separa um caso do outro é a
  // member-api, no campo `conteudos`; sem ele, vale a lista de produtos
  // ativos, que hoje dá no mesmo (nenhuma assinatura encerrada até 24/09).
  //
  // ⚠️ Não é cadeado de verdade: os textos estão em js/cantico.js, arquivo
  // público. Guia a cliente; não protege conteúdo.
  const PRODUTO_CANTICO = 'upsell_02';
  const PAGINA_DO_CANTICO = /\/(cantico|cantico-dia)(?:\.html)?$/;
  // A mesma etiqueta dos Arcanjos, com campanha própria: na venda, a Hubla
  // conta se ela veio do card da home ou de um link direto.
  const ofertaDoCantico = origem => `oferta-cantico.html?utm_source=app&utm_medium=card&utm_campaign=cantico&utm_content=${origem}`;
  const temCantico = () => (Array.isArray(state?.conteudos) ? state.conteudos : state?.products || []).includes(PRODUTO_CANTICO);
  function desenharCardCantico() {
    const card = document.getElementById('card-cantico');
    if (!card) return;
    const liberado = temCantico();
    const situacao = liberado ? 'liberado' : 'trancado';
    card.dataset.situacao = situacao;
    card.href = liberado ? 'cantico.html' : ofertaDoCantico('card-home');
    // Mesmo esquema do card dos Arcanjos: as duas versões do texto moram no
    // index.html, e o 🔒 vem escrito nelas.
    card.querySelectorAll('[data-liberado]').forEach(texto => {
      texto.textContent = texto.dataset[situacao] || texto.textContent;
    });
  }
  function trancarPaginaDoCantico() {
    if (!PAGINA_DO_CANTICO.test(location.pathname)) return false;
    const content = document.querySelector('.content');
    if (!content) return false;
    if (temCantico()) {
      // Comprou com a tela trancada aberta: a verificação seguinte a encontra
      // aqui, e só recarregando a jornada volta a aparecer.
      if (content.dataset.trancada) location.reload();
      return false;
    }
    if (content.dataset.trancada) return true;
    content.dataset.trancada = '1';
    const titulo = node('h1', 'title', 'Cântico Angelical');
    titulo.style.fontSize = '22px';
    const bloco = node('div', 'heading-block');
    bloco.append(titulo, node('p', 'subtext', 'Esta jornada faz parte do Cântico Angelical, que ainda não está no seu acesso. Toque abaixo para conhecer.'));
    const conhecer = node('a', 'member-button', 'Conhecer o Cântico Angelical');
    conhecer.href = ofertaDoCantico('link-direto');
    conhecer.style.textAlign = 'center';
    const voltar = node('a', 'member-gate-help', 'Voltar para o início');
    voltar.href = 'index.html';
    voltar.style.textAlign = 'center';
    content.replaceChildren(bloco, conhecer, voltar);
    return true;
  }
  // Um dia do Cântico aberto por link antes da vez dele — o mesmo papel do
  // bloquearDiaTravado(), mais acima, para as madrugadas.
  function bloquearDiaDoCanticoTravado(trava) {
    if (!trava) return false;
    const dia = /^cantico:([1-7])$/.exec(prayerKey(location.pathname, location.search) || '');
    if (!dia || Number(dia[1]) <= trava.liberados) return false;

    const content = document.querySelector('.content');
    if (!content) return false;
    const titulo = node('h1', 'title', 'Este dia ainda não chegou');
    titulo.style.fontSize = '22px';
    const bloco = node('div', 'heading-block');
    bloco.append(titulo, node('p', 'subtext', window.TRAVA.selo(Number(dia[1]), trava) === 'Abre amanhã'
      ? 'Ele abre amanhã, logo depois da meia-noite. Um dia de cada vez, do jeito que a jornada foi feita.'
      : 'Cada dia abre o seguinte. Este ainda está esperando a vez dele chegar.'));
    const voltar = node('a', 'member-button', 'Voltar para o Cântico');
    voltar.href = 'cantico.html';
    voltar.style.textAlign = 'center';
    content.replaceChildren(bloco, voltar);
    return true;
  }
  // "Os itens com 🔒 são extras..." — a frase acima dos cards dos extras, na
  // home. Só faz sentido se houver algum 🔒 na tela: para quem já tem os dois
  // extras, ela some. Roda depois dos dois cards, que marcam a situação.
  function desenharAvisoDosExtras() {
    const aviso = document.getElementById('aviso-extras');
    if (aviso) aviso.hidden = !document.querySelector('[data-situacao="trancado"]');
  }
  function render() {
    desenharSaudacao();
    setupMemberMenu();
    desenharCardArcanjos();
    desenharCardCantico();
    desenharAvisoDosExtras();
    // A lista de madrugadas é ajustada ANTES do formulário de perfil poder
    // desviar a tela. Se ficasse depois, bastava uma pesquisa pendente para a
    // lista continuar com as sete abertas — e o desvio nem sempre acontece.
    const trava = window.TRAVA ? window.TRAVA.calcular(state) : null;
    if (trava && typeof window.desenharDias === 'function') window.desenharDias(trava);
    // O Cântico tem conta própria (mesma âncora, sem o piso das antigas).
    // calcularCantico só existe no js/trava.js de 24/09/2026 em diante.
    const travaDoCantico = window.TRAVA?.calcularCantico ? window.TRAVA.calcularCantico(state) : null;
    if (travaDoCantico && typeof window.desenharDiasDoCantico === 'function') window.desenharDiasDoCantico(travaDoCantico);
    // Antes do formulário de perfil pelo mesmo motivo: se o desvio para o
    // perfil acontecesse primeiro, a Central apareceria inteira, por um
    // instante, para quem não comprou.
    if (trancarPaginaDosArcanjos()) return;
    if (trancarPaginaDoCantico()) return;
    if (setupMemberSurvey()) return;
    if (bloquearDiaTravado(trava)) return;
    if (bloquearDiaDoCanticoTravado(travaDoCantico)) return;
    if (previaDaOferta) mostrarPreviaDaOferta(); else setupMemberOffer();
    document.querySelectorAll('a.card[href]').forEach(card => {
      const url = new URL(card.getAttribute('href'), location.href);
      const key = prayerKey(url.pathname, url.search);
      card.querySelector('.member-done')?.remove();
      if (key && completed(key)) card.append(node('span', 'member-done', key.startsWith('cantico:') ? '✓ Dia concluído' : '✓ Oração concluída'));
    });
    const content = document.querySelector('.content');
    if (!content) return;
    const home = /\/(index(?:\.html)?)?$/.test(location.pathname);
    if (home) {
      document.getElementById('member-extras')?.remove();
      const extras = node('section', ''); extras.id = 'member-extras';
      for (const product of state.catalog.filter(p => p.key !== 'principal')) {
        const owned = state.products.includes(product.key);
        const target = owned ? product.content_url : product.checkout_url;
        if (!target) continue;
        let url; try { url = new URL(target, location.href); } catch { continue; }
        if (url.protocol !== 'https:' && url.origin !== location.origin) continue;
        const card = node('article', 'member-offer');
        card.append(node('h2', '', product.title), node('p', '', product.description || ''));
        const link = node('a', 'member-button', owned ? 'Acessar meu conteúdo' : 'Conhecer este conteúdo'); link.href = url.href;
        if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener'; }
        card.append(link); extras.append(card);
      }
      if (extras.children.length) content.append(extras);
    }
    const key = prayerKey(location.pathname, location.search);
    if (!key || content.textContent.includes('Conteúdo indisponível')) return;
    // O Cântico só ganha o botão quando o servidor avisa que guarda os dias
    // dele (campo `jornadas`, da member-api de 24/09/2026 em diante). Antes
    // disso, tocar em "Concluí" terminaria em erro na tela dela: nem a função
    // nem o banco (prayer_progress_prayer_key_check) aceitavam a chave.
    const doCantico = key.startsWith('cantico:');
    if (doCantico && !(Array.isArray(state.jornadas) && state.jornadas.includes('cantico'))) return;
    let progress = document.getElementById('member-progress');
    if (!progress) {
      progress = node('section', 'member-progress'); progress.id = 'member-progress';
      const button = node('button', 'member-button', ''); button.type = 'button';
      const message = node('p', '', ''); message.setAttribute('role', 'status');
      button.addEventListener('click', async () => {
        // No Dia 03 quem conclui e a contribuicao. Enquanto ela nao escolher,
        // este botao nao salva nada: so aponta o caminho.
        //
        // ATENCAO: isto NAO tranca o Dia 04. Quem abre os dias e o calendario
        // (js/trava.js), e concluir serve so de piso. Quem nunca contribuir
        // continua recebendo a Quarta Madrugada na meia-noite seguinte.
        if (key === CHAVE_DIA_03 && !completed(key)) {
          const bloco = document.getElementById('doacoes-dia-03');
          const aparecendo = Boolean(bloco) && !bloco.classList.contains('doacao-dia-03--oculta');
          // Sem esta segunda frase o botao seria um beco: antes de o video
          // chegar la, nao existe contribuicao nenhuma na tela para escolher.
          message.textContent = aparecendo
            ? 'Escolha uma contribuição para concluir a oração.'
            : 'Escolha uma contribuição para concluir a oração. As opções aparecem aqui embaixo conforme o vídeo.';
          if (aparecendo) bloco.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        button.disabled = true; message.textContent = 'Salvando sua oração…';
        try { state = await api('progress', { prayer_key: key, completed: !completed(key) }); render(); message.textContent = 'Seu progresso foi salvo.'; }
        catch (error) { if ([401, 403].includes(error.status)) return toLogin(error.message); message.textContent = 'Não conseguimos salvar agora. Confira sua conexão e toque de novo — se continuar, fale com a gente no WhatsApp.'; }
        finally { button.disabled = false; }
      });
      progress.append(button, message);
    }
    const progressAnchor = document.getElementById('member-progress-anchor') || content.querySelector('.banner');
    if (progressAnchor) progressAnchor.before(progress);
    else if (!progress.isConnected) content.append(progress);
    // Concluida, o Dia 03 volta ao rotulo normal: ela pode desfazer como nos
    // outros dias.
    // No Cântico a palavra é "dia": é assim que a jornada dele é contada.
    progress.querySelector('button').textContent = completed(key)
      ? (doCantico ? '✓ Dia concluído · desfazer' : '✓ Oração concluída · desfazer')
      : (key === CHAVE_DIA_03 ? 'Escolha uma contribuição para concluir a oração' : doCantico ? 'Concluí este dia' : 'Concluí esta oração');
  }
  let ultimaVerificacao = 0;
  // Voltar para a aba, reconectar e destravar o celular disparam quase juntos.
  // Sem esta pausa, um gesto só da cliente vira três gravações no banco.
  const reverifica = () => { if (Date.now() - ultimaVerificacao > 20000) refresh(); };
  async function refresh() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    ultimaVerificacao = Date.now();
    try {
      state = await api('session');
      // O painel não é para cliente. A tranca continua sendo a member-api, que
      // recusa cada ação; aqui só evitamos que ela veja a tela do painel abrir
      // com uma tarja vermelha dizendo que não está autorizada.
      // `=== false` de propósito: enquanto a member-api antiga ainda estiver no ar
      // ela não devolve este campo, e com `!state.admin` o próprio Caio seria
      // expulso do painel. Assim, a tela só fecha depois que a função subir.
      if (/\/admin(?:\.html)?$/.test(location.pathname) && state.admin === false) { location.replace('index.html'); return; }
      // Libera a tela assim que o acesso é confirmado, ANTES de desenhar.
      // Se o desenho quebrar depois — uma oferta, o menu, um recurso que o
      // navegador dela não tem — ela ainda vê as orações que comprou.
      document.documentElement.classList.remove('member-checking');
      document.getElementById('member-gate')?.remove();
      try { render(); } catch (erroAoDesenhar) { console.error('Falha ao desenhar a tela', erroAoDesenhar); }
    }
    catch (error) {
      if ([401, 403].includes(error.status)) return toLogin(error.message);
      const gate = document.getElementById('member-gate');
      // A mensagem do servidor é mais honesta que culpar a internet dela.
      if (gate) gate.replaceChildren(
        node('p', '', error.message || 'Nosso sistema está instável neste momento. Já estamos vendo isso.'),
        (() => { const b = node('button', 'member-button', 'Tentar novamente'); b.onclick = refresh; return b; })(),
        (() => { const a = node('a', 'member-gate-help', 'Falar com a gente no WhatsApp'); a.href = AJUDA; a.target = '_blank'; a.rel = 'noopener'; return a; })(),
      );
      const status = document.querySelector('.member-sync'); if (status) status.textContent = 'Sem conexão. Seus acessos serão atualizados ao reconectar.';
    } finally { refreshing = false; }
  }
  // O LINK DE ENTRADA (24/09/2026): para a cliente que não consegue digitar o
  // e-mail. O suporte copia o link na ficha dela, no painel, e manda no
  // WhatsApp: setemadrugadas.com.br/entrar#<código>. Ela toca e já entra.
  //
  // O código vem depois do "#" de propósito: essa parte do endereço nunca sai
  // do celular dela. Não vai para o servidor da Netlify, não fica no registro
  // de acessos e não aparece no "de onde veio" da página seguinte.
  //
  // Mora aqui, e não num arquivo à parte, pelo mesmo motivo da recuperação
  // por CPF: a sessão tem que ser guardada exatamente como o login guarda.
  async function entrarPeloLink() {
    const titulo = document.getElementById('entrar-titulo');
    const texto = document.getElementById('entrar-texto');
    const saidas = document.getElementById('entrar-saidas');
    const tentar = document.getElementById('entrar-tentar');
    const whatsapp = document.getElementById('entrar-whatsapp');
    let codigo = '';
    try { codigo = decodeURIComponent(location.hash.slice(1)).trim(); } catch {}
    const falhou = (mensagem, podeTentarDeNovo) => {
      titulo.textContent = 'Não conseguimos abrir pelo link';
      texto.textContent = mensagem;
      tentar.hidden = !podeTentarDeNovo;
      // Um botão dourado por vez: quando dá para tentar de novo, ele é o
      // primeiro caminho, e o WhatsApp fica como segunda opção.
      whatsapp.classList.toggle('secondary', podeTentarDeNovo);
      saidas.hidden = false;
    };
    tentar.onclick = () => { location.reload(); };
    if (!codigo) return falhou('Este link está incompleto. Peça um link novo para a gente no WhatsApp.', false);
    try {
      const data = await api('entry', { code: codigo });
      remember(data.token);
      // replace, e não um link comum: o endereço com o código sai do
      // histórico, e o botão "voltar" não leva de novo a esta tela.
      location.replace('index.html');
    } catch (erro) {
      // Sem status, a chamada nem chegou: internet fraca ou sistema fora.
      // Aí vale tentar de novo. Com status, o servidor já disse o que houve.
      falhou(erro.status ? erro.message : 'Não conseguimos abrir agora. Confira se a internet está ligada e toque em "Tentar de novo".', !erro.status || erro.status >= 429);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (entrada) { entrarPeloLink(); return; }
    if (login) {
      const form = document.getElementById('member-login-form');
      const error = document.getElementById('member-login-error');
      try { error.textContent = sessionStorage.getItem('member-message') || ''; sessionStorage.removeItem('member-message'); } catch {}
      form.addEventListener('submit', async event => {
        event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Entrando…'; error.textContent = '';
        try { const data = await api('login', { email: form.email.value }); remember(data.token); location.replace(returnPath()); }
        // Sem status, o problema é nosso ou do caminho — não da internet dela.
        catch (err) { error.textContent = err.status ? err.message : 'Não conseguimos abrir seu acesso agora. Tente de novo em instantes, ou fale com a gente no WhatsApp.'; }
        finally { button.disabled = false; button.textContent = 'Entrar nas minhas orações'; }
      });
      // A tela de recuperação por CPF (js/recuperar.js) precisa falar com a
      // member-api e guardar a sessão exatamente como este formulário guarda.
      // Expor as três funções evita repetir a chave do localStorage e o
      // endereço da API em dois arquivos: se mudassem num só, o login
      // continuaria funcionando e a recuperação deixaria a cliente na porta,
      // sem erro nenhum aparecendo na tela.
      window.MEMBER_RECUPERACAO = { api, guardar: remember, destino: returnPath };
      return;
    }
    if (!token) return toLogin();
    // Clicar em qualquer das tres contribuicoes conclui a Terceira Madrugada.
    // Decisao do Caio em 22/09/2026: quem contribui concluiu, mesmo que nao
    // termine o pagamento do outro lado.
    //
    // `keepalive` e OBRIGATORIO aqui: o checkout abre na MESMA aba, e sem ele
    // o navegador cancela a gravacao no meio do caminho. A oracao nao ficaria
    // marcada e ninguem veria erro nenhum -- nem ela, nem o log.
    //
    // Na fase de captura e sem `await`: nada nesta marcacao pode atrasar nem
    // impedir a ida dela para o checkout, que e o que de fato importa.
    //
    // Delegado no documento porque o bloco de doacao nasce escondido e so
    // aparece quando o video chega aos 9:14 -- prender o ouvinte no elemento
    // exigiria saber a hora em que ele nasce.
    document.addEventListener('click', (evento) => {
      const alvo = evento.target;
      if (!(alvo instanceof Element) || !alvo.closest('.doacao-dia-03__botao')) return;
      if (!token || completed(CHAVE_DIA_03)) return;
      try {
        fetch(window.MEMBER_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-member-session': token },
          body: JSON.stringify({ action: 'progress', prayer_key: CHAVE_DIA_03, completed: true }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* o checkout dela importa mais que a marcacao */ }
    }, true);
    // O aviso de espera já vem escrito no HTML, então existe mesmo que este
    // arquivo falhe. Aqui só garantimos que ele exista em página antiga.
    if (!document.getElementById('member-gate')) {
      const gate = node('div', '', 'Verificando seu acesso…'); gate.id = 'member-gate'; gate.setAttribute('role', 'status'); document.body.append(gate);
    }
    // Se em 12 segundos a tela não liberou, a cliente precisa de uma saída,
    // não de uma tela parada. Acontece com internet ruim de madrugada.
    setTimeout(() => {
      if (!document.documentElement.classList.contains('member-checking')) return;
      const gate = document.getElementById('member-gate');
      if (!gate || gate.dataset.esgotado) return;
      gate.dataset.esgotado = '1';
      gate.append(
        node('p', '', 'Está demorando mais que o normal. Se não abrir, fale com a gente.'),
        (() => { const a = node('a', 'member-gate-help', 'Falar com a gente no WhatsApp'); a.href = AJUDA; a.target = '_blank'; a.rel = 'noopener'; return a; })(),
      );
    }, 12000);
    refresh();
    // 5 minutos, não 30 segundos: cada verificação grava no banco (dia de visita
    // e rotina de ofertas). Acesso revogado continua sendo bloqueado, só que em
    // minutos — e o consumo da Supabase cai cerca de dez vezes.
    setInterval(refresh, 300000);
    window.addEventListener('online', reverifica);
    document.addEventListener('visibilitychange', reverifica);
    window.addEventListener('pageshow', reverifica);
    window.addEventListener('storage', event => { if (event.key === storageKey) { token = readToken(); if (!token) toLogin(); else { document.documentElement.classList.add('member-checking'); refresh(); } } });
  });
})();
