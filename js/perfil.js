(() => {
  // AbortSignal.timeout nao existe em iOS 15 ou anterior, aparelho comum
  // no publico do app. Sem isto a chamada quebra antes de sair do celular.
  // O relogio e desligado assim que a resposta chega: sem isso cada chamada
  // deixa um despertador pendurado por 15s, gastando bateria a toa.
  const limiteDeTempo = ms => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, encerrar: () => clearTimeout(t) }; };
  const form = document.getElementById('profile-form');
  if (!form) return;

  const questions = [...form.querySelectorAll('[data-screen="question"]')];
  const screens = [...form.querySelectorAll('.profile-screen')];
  const progress = document.getElementById('profile-progress');
  const actions = document.getElementById('profile-actions');
  const progressLabel = document.getElementById('profile-progress-label');
  const progressPercent = document.getElementById('profile-progress-percent');
  const progressBar = document.getElementById('profile-progress-bar');
  const nextButton = form.querySelector('[data-action="next"]');
  const status = document.getElementById('profile-form-status');
  const campaignKey = new URLSearchParams(location.search).get('campaign') || '';
  const storageKey = '7amens.member.session.v2';
  let current = -1;
  let completed = false;

  async function api(action, values = {}) {
    const token = localStorage.getItem(storageKey) || '';
    const limite = limiteDeTempo(15000);
    let response;
    try {
      response = await fetch(window.MEMBER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-member-session': token },
        body: JSON.stringify({ action, ...values }),
        signal: limite.signal,
      });
    } finally { limite.encerrar(); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível salvar agora. Confira sua conexão — se continuar, fale com a gente no WhatsApp.');
    return data;
  }

  const record = event => /^[a-z0-9_-]+$/.test(campaignKey)
    ? api('survey_event', { campaign_key: campaignKey, event }).catch(() => {})
    : Promise.resolve();

  function showScreen(target) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen === target));
    const questionIndex = questions.indexOf(target);
    const isQuestion = questionIndex >= 0;
    progress.hidden = !isQuestion;
    actions.hidden = !isQuestion;
    current = questionIndex;

    if (isQuestion) {
      const number = questionIndex + 1;
      const percent = Math.round((number / questions.length) * 100);
      progressLabel.textContent = `Pergunta ${number} de ${questions.length}`;
      progressPercent.textContent = `${percent}%`;
      progressBar.style.width = `${percent}%`;
      nextButton.textContent = number === questions.length ? 'Concluir' : 'Continuar';
      updateNextButton();
      target.querySelector('legend')?.focus?.();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNextButton() {
    const selected = questions[current]?.querySelector('input:checked');
    nextButton.disabled = !selected;
  }

  form.addEventListener('change', event => {
    if (event.target.matches('input[type="radio"]')) updateNextButton();
  });

  form.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'start') { record('started'); showScreen(questions[0]); }
    if (action === 'previous') showScreen(questions[Math.max(0, current - 1)]);
    if (action === 'next' && !nextButton.disabled) {
      if (current < questions.length - 1) showScreen(questions[current + 1]);
      else submitAnswers();
    }
    if (action === 'finish') returnToApp();
  });

  async function submitAnswers() {
    status.textContent = '';
    if (!/^[a-z0-9_-]+$/.test(campaignKey)) {
      status.textContent = 'Esta é uma visualização do formulário. O salvamento será ativado quando ele for disparado pelo aplicativo.';
      showScreen(form.querySelector('[data-screen="finished"]'));
      return;
    }
    nextButton.disabled = true;
    nextButton.textContent = 'Salvando…';
    const answers = Object.fromEntries(new FormData(form).entries());
    try {
      await api('survey_submit', { campaign_key: campaignKey, answers });
      completed = true;
      showScreen(form.querySelector('[data-screen="finished"]'));
    } catch (error) {
      status.textContent = error.message;
      nextButton.disabled = false;
      nextButton.textContent = 'Concluir';
    }
  }

  function returnToApp() {
    let target = 'index.html';
    try {
      const saved = sessionStorage.getItem('7amens.member.survey.return') || '';
      if (/^(index|novena|desatadora|dia|dia-desatadora|oferta-arcanjos)\.html(\?[^#]*)?$/.test(saved)) target = saved;
      sessionStorage.removeItem('7amens.member.survey.return');
    } catch {}
    location.href = target;
  }

  async function exitForm() {
    if (!completed) await Promise.race([record('dismissed'), new Promise(resolve => setTimeout(resolve, 500))]);
    returnToApp();
  }

  document.getElementById('profile-exit')?.addEventListener('click', () => {
    if (current > 0) showScreen(questions[current - 1]);
    else if (current === 0) showScreen(form.querySelector('[data-screen="intro"]'));
    else exitForm();
  });
})();
