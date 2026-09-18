(() => {
  'use strict';
  const storageKey = '7amens.member.session.v2';
  const readToken = () => { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } };
  let token = readToken();
  let state = null;
  let refreshing = false;
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
  function prayerKey(path, search) {
    const params = new URLSearchParams(search);
    const day = params.get('dia');
    if (/\/dia(?:\.html)?$/.test(path) && !params.has('material') && /^[0-7]$/.test(day || '')) return `principal:${day}`;
    if (/\/dia-desatadora(?:\.html)?$/.test(path) && /^[1-9]$/.test(day || '')) return `desatadora:${day}`;
    return null;
  }
  function render() {
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
      let account = document.getElementById('member-account');
      if (!account) {
        account = node('section', 'member-account'); account.id = 'member-account';
        account.append(node('p', '', ''));
        const status = node('p', 'member-sync', ''); status.setAttribute('role', 'status'); account.append(status);
        const button = node('button', 'member-button secondary', 'Sair / trocar e-mail'); button.type = 'button';
        button.addEventListener('click', async () => { button.disabled = true; try { await api('logout'); } catch {} toLogin(); });
        account.append(button); content.prepend(account);
      }
      account.firstElementChild.textContent = state.customer.email;
      account.querySelector('.member-sync').textContent = `${state.progress.filter(p => p.completed).length} orações concluídas · progresso salvo`;
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
      progress.append(button, message); content.append(progress);
    }
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
