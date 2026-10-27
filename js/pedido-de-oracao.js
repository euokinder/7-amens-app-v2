// OS PEDIDOS DE ORAÇÃO — o formulário aberto de sao-judas.html (26/10/2026).
//
// A cliente escreve o primeiro nome e a causa; o pedido vai para a member-api
// (ação "prayer_request", sem login) e fica na tabela prayer_requests.
//
// Ela SEMPRE vê "Recebi o seu pedido", mesmo se a gravação falhar: sem
// internet, função antiga no ar, banco sem a tabela. Foi a decisão de 26/10
// ("se não der para guardar, finge que recebeu"). Uma falha aqui não pode
// virar uma tela de erro para uma senhora que acabou de escrever a causa
// dela. Quem confere se está gravando é a consulta de
// supabase/pedidos-de-oracao.sql; o aviso fica só no console.
(function () {
  const form = document.getElementById('pedido-form');
  if (!form) return;

  const nome = document.getElementById('pedido-nome');
  const causa = document.getElementById('pedido-causa');
  const botao = form.querySelector('button[type="submit"]');
  const recebido = document.getElementById('pedido-recebido');
  const encerrado = document.getElementById('pedido-encerrado');
  const campanha = form.dataset.campanha || '';
  const encerraEm = Date.parse(form.dataset.encerra || '');
  const TEXTO_DO_BOTAO = botao.textContent;
  // Rede lenta não pode deixar ela presa em "Enviando…".
  const ESPERA_MAXIMA = 10000;

  const passouDoPrazo = () => Number.isFinite(encerraEm) && Date.now() >= encerraEm;
  // Os mesmos limites da member-api e do banco: 60 letras no nome, 300 na causa.
  const limpo = valor => valor.trim().replace(/\s+/g, ' ');

  function mostrar(tela) {
    form.hidden = tela !== form;
    recebido.hidden = tela !== recebido;
    encerrado.hidden = tela !== encerrado;
  }

  function avisar(campo, mensagem) {
    const erro = document.getElementById(`${campo.id}-erro`);
    erro.textContent = mensagem;
    campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  }

  async function guardar(pedido) {
    if (!window.MEMBER_API) return;
    const limite = new AbortController();
    const relogio = setTimeout(() => limite.abort(), ESPERA_MAXIMA);
    try {
      const resposta = await fetch(window.MEMBER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prayer_request', ...pedido }),
        signal: limite.signal,
      });
      if (!resposta.ok) console.warn(`Pedido não gravado (${resposta.status}).`);
    } catch (falha) {
      console.warn('Pedido não gravado:', falha);
    } finally {
      clearTimeout(relogio);
    }
  }

  for (const campo of [nome, causa]) {
    campo.addEventListener('input', () => { if (campo.getAttribute('aria-invalid') === 'true') avisar(campo, ''); });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (passouDoPrazo()) { mostrar(encerrado); return; }

    const pedido = { campaign: campanha, name: limpo(nome.value), intention: limpo(causa.value) };
    avisar(nome, pedido.name ? '' : 'Escreva o seu primeiro nome.');
    avisar(causa, pedido.intention ? '' : 'Escreva a sua causa, em poucas palavras.');
    if (!pedido.name) { nome.focus(); return; }
    if (!pedido.intention) { causa.focus(); return; }

    botao.disabled = true;
    botao.textContent = 'Enviando…';
    await guardar(pedido);
    botao.disabled = false;
    botao.textContent = TEXTO_DO_BOTAO;

    document.getElementById('pedido-recebido-nome').textContent = `, ${pedido.name}`;
    mostrar(recebido);
    recebido.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('pedido-recebido-titulo').focus({ preventScroll: true });
  });

  // Outro pedido da mesma pessoa: o nome fica, a causa recomeça em branco.
  document.getElementById('pedido-outro').addEventListener('click', () => {
    causa.value = '';
    mostrar(passouDoPrazo() ? encerrado : form);
    if (!form.hidden) causa.focus();
  });

  if (passouDoPrazo()) mostrar(encerrado);
})();
