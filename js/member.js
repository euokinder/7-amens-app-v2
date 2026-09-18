(() => {
  'use strict';
  const storageKey = '7amens.member.session.v2';
  const readToken = () => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } };
  let token = readToken();
  let state = null;
  let refreshing = false;
  let surveyRedirecting = false;
  const login = /\/login(?:\.html)?\/?$/.test(location.pathname);
  function remember(value) { token = value; try { value ? localStorage.setItem(storageKey, value) : localStorage.removeItem(storageKey); } catch {} }
  async function api(action, values = {}) {
    const response = await fetch(window.MEMBER_API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-member-session': token }, body: JSON.stringify({ action, ...values }), signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Não foi possível conectar. Tente novamente.'); error.status = response.status; throw error; }
    return data;
  }
  function returnPath() {
    const next = new URLSearchParams(location.search).get('next');
    return next && /^(index|novena|desatadora|dia|dia-desatadora)\.html(\?[^#]*)?$/.test(next) ? next : 'index.html';
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
  const previaDaOferta = new URLSearchParams(location.search).has('previa-oferta');
  async function mostrarPreviaDaOferta() {
    if (document.getElementById('member-offer-dialog')) return;
    try {
      const resposta = await api('offer_preview', {});
      if (resposta.offer) setupMemberOffer(resposta.offer);
    } catch {}
  }
  function setupMemberOffer(nextOffer = null) {
    const offer = nextOffer || state?.offer;
    if (!offer || document.getElementById('member-offer-dialog')) return;
    let target;
    try { target = new URL(offer.target_url); } catch { return; }
    if (target.protocol !== 'https:') return;
    const dialog = node('dialog', 'member-offer-dialog');
    dialog.id = 'member-offer-dialog';
    dialog.dataset.offerType = offer.offer_type || 'product';
    dialog.setAttribute('aria-labelledby', 'member-offer-title');
    const sheet = node('div', 'member-offer-sheet');
    const eyebrow = node('span', 'member-offer-eyebrow', offer.eyebrow || 'Uma oportunidade para você');
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
    if (!survey || surveyRedirecting || /\/perfil(?:\.html)?$/.test(location.pathname)) return false;
    if (!/^[a-z0-9_-]+$/.test(survey.campaign_key || '') || !/^[a-z0-9-]+[.]html$/.test(survey.target_path || '')) return false;
    surveyRedirecting = true;
    try { sessionStorage.setItem('7amens.member.survey.return', `${location.pathname.split('/').pop() || 'index.html'}${location.search}`); } catch {}
    const target = new URL(survey.target_path, location.href);
    target.searchParams.set('campaign', survey.campaign_key);
    Promise.race([
      api('survey_event', { campaign_key: survey.campaign_key, event: 'shown' }),
      new Promise(resolve => setTimeout(resolve, 900)),
    ]).finally(() => location.assign(target.href));
    return true;
  }
  function prayerKey(path, search) {
    const params = new URLSearchParams(search);
    const day = params.get('dia');
    if (/\/dia(?:\.html)?$/.test(path) && !params.has('material') && /^[0-7]$/.test(day || '')) return `principal:${day}`;
    if (/\/dia-desatadora(?:\.html)?$/.test(path) && /^[1-9]$/.test(day || '')) return `desatadora:${day}`;
    return null;
  }
  function render() {
    setupMemberMenu();
    if (setupMemberSurvey()) return;
    if (previaDaOferta) mostrarPreviaDaOferta(); else setupMemberOffer();
    document.querySelectorAll('a.card[href]').forEach(card => {
      const url = new URL(card.getAttribute('href'), location.href);
      const key = prayerKey(url.pathname, url.search);
      card.querySelector('.member-done')?.remove();
      if (key && completed(key)) card.append(node('span', 'member-done', '✓ Oração concluída'));
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
    let progress = document.getElementById('member-progress');
    if (!progress) {
      progress = node('section', 'member-progress'); progress.id = 'member-progress';
      const button = node('button', 'member-button', ''); button.type = 'button';
      const message = node('p', '', ''); message.setAttribute('role', 'status');
      button.addEventListener('click', async () => {
        button.disabled = true; message.textContent = 'Salvando sua oração…';
        try { state = await api('progress', { prayer_key: key, completed: !completed(key) }); render(); message.textContent = 'Seu progresso foi salvo.'; }
        catch (error) { if ([401, 403].includes(error.status)) return toLogin(error.message); message.textContent = 'Não foi possível salvar. Confira sua conexão e toque novamente.'; }
        finally { button.disabled = false; }
      });
      progress.append(button, message);
    }
    const progressAnchor = document.getElementById('member-progress-anchor') || content.querySelector('.banner');
    if (progressAnchor) progressAnchor.before(progress);
    else if (!progress.isConnected) content.append(progress);
    progress.querySelector('button').textContent = completed(key) ? '✓ Oração concluída · desfazer' : 'Concluí esta oração';
  }
  async function refresh() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try { state = await api('session'); render(); document.documentElement.classList.remove('member-checking'); document.getElementById('member-gate')?.remove(); }
    catch (error) {
      if ([401, 403].includes(error.status)) return toLogin(error.message);
      const gate = document.getElementById('member-gate');
      if (gate) { gate.replaceChildren(node('p', '', 'Não foi possível verificar seu acesso. Confira sua conexão.')); const retry = node('button', 'member-button', 'Tentar novamente'); retry.onclick = refresh; gate.append(retry); }
      const status = document.querySelector('.member-sync'); if (status) status.textContent = 'Sem conexão. Seus acessos serão atualizados ao reconectar.';
    } finally { refreshing = false; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (login) {
      const form = document.getElementById('member-login-form');
      const error = document.getElementById('member-login-error');
      try { error.textContent = sessionStorage.getItem('member-message') || ''; sessionStorage.removeItem('member-message'); } catch {}
      form.addEventListener('submit', async event => {
        event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Entrando…'; error.textContent = '';
        try { const data = await api('login', { email: form.email.value }); remember(data.token); location.replace(returnPath()); }
        catch (err) { error.textContent = err.status ? err.message : 'Não foi possível conectar. Confira sua internet e tente novamente.'; }
        finally { button.disabled = false; button.textContent = 'Entrar nas minhas orações'; }
      });
      return;
    }
    if (!token) return toLogin();
    const gate = node('div', '', 'Verificando seu acesso…'); gate.id = 'member-gate'; gate.setAttribute('role', 'status'); document.body.append(gate);
    refresh();
    setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('storage', event => { if (event.key === storageKey) { token = readToken(); if (!token) toLogin(); else { document.documentElement.classList.add('member-checking'); refresh(); } } });
  });
})();
