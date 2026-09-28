// O POP-UP DA BASÍLICA — Terceira Madrugada (27/09/2026, pedido do Caio).
//
// Tocar num dos valores do bloco de doação (R$ 950, R$ 300, R$ 197) não leva
// mais direto para o pagamento. Abre este pop-up, que agradece e mostra os
// dois jeitos de ajudar: todo mês (Pix Automático, na Cakto) ou só desta vez
// (Hubla). Ela pode trocar o valor ali mesmo, e os dois botões mudam juntos.
//
// Por quê: em 26/09 os links mensais da Cakto tomaram o lugar dos únicos da
// Hubla, e a conversão caiu muito. Quem tocava em "Contribuição de R$950" só
// descobria no checkout que era "R$ 950,00 / mês".
//
// Os links moram nos próprios botões, em dia.html (href = pagamento único,
// data-mensal = mensal). Este arquivo só lê de lá: trocar um link é mexer
// num lugar só. Se este arquivo não carregar, o toque no valor segue o href
// e ela cai no pagamento único, sem susto de cobrança todo mês.
//
// A CONTAGEM não mora aqui: todo elemento com data-doacao-evento é contado
// pelo js/member.js, que tem a sessão dela (tabela member_donation_events).
// Fechar pelo fundo escuro ou pela tecla Esc passa pelo botão "Voltar", para
// ser contado do mesmo jeito.
//
// A VTurb continua contando os toques nos três valores
// (smartplayer-click-event), como antes: o pop-up é só um passo a mais.
(() => {
  const bloco = document.getElementById('doacoes-dia-03');
  if (!bloco) return;
  const botoes = [...bloco.querySelectorAll('.doacao-dia-03__botao[data-mensal]')];
  if (!botoes.length) return;
  const opcoes = botoes.map((botao) => ({ valor: Number(botao.dataset.valor), mensal: botao.dataset.mensal, unica: botao.href }));
  const reais = (valor) => `R$ ${valor.toLocaleString('pt-BR')}`;

  const popup = document.createElement('div');
  popup.className = 'modal-scrim doacao-popup';
  popup.id = 'doacao-popup';
  popup.innerHTML = `
    <div class="doacao-popup__card" role="dialog" aria-modal="true" aria-labelledby="doacao-popup-titulo" tabindex="-1">
      <h2 class="doacao-popup__titulo" id="doacao-popup-titulo">Que Deus abençoe o seu coração generoso!</h2>
      <p class="doacao-popup__texto">A sua contribuição ajuda a construir a Basílica. Escolha o valor e como prefere ajudar:</p>
      <div class="doacao-popup__valores" role="group" aria-label="Valor da contribuição"></div>
      <a class="doacao-popup__caminho" data-doacao-evento="monthly" data-caminho="mensal">
        <strong>Quero ajudar todo mês</strong>
        <span></span>
      </a>
      <a class="doacao-popup__caminho" data-doacao-evento="once" data-caminho="unica">
        <strong>Quero ajudar só desta vez</strong>
        <span></span>
      </a>
      <div class="doacao-popup__aviso">
        <p><b>Todo mês:</b> você autoriza uma única vez no aplicativo do seu banco, e depois o valor sai sozinho, uma vez por mês, pelo Pix Automático.</p>
        <p><b>Cancelar é simples:</b> quando quiser, é só chamar a gente no WhatsApp ou cancelar direto no aplicativo do seu banco.</p>
      </div>
      <button type="button" class="doacao-popup__voltar" data-doacao-evento="closed">Voltar para a oração</button>
    </div>`;
  document.body.append(popup);

  const cartao = popup.querySelector('.doacao-popup__card');
  const valores = popup.querySelector('.doacao-popup__valores');
  const mensal = popup.querySelector('[data-caminho="mensal"]');
  const unica = popup.querySelector('[data-caminho="unica"]');
  const voltar = popup.querySelector('.doacao-popup__voltar');
  const chips = opcoes.map((opcao) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'doacao-popup__valor';
    chip.textContent = reais(opcao.valor);
    chip.addEventListener('click', () => escolher(opcao));
    valores.append(chip);
    return chip;
  });

  function escolher(opcao) {
    chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(opcoes[i] === opcao)));
    mensal.href = opcao.mensal;
    unica.href = opcao.unica;
    mensal.querySelector('span').textContent = `${reais(opcao.valor)} por mês, no Pix Automático`;
    unica.querySelector('span').textContent = `${reais(opcao.valor)}, uma única vez`;
    // O valor que o js/member.js conta é sempre o que está na tela.
    [mensal, unica, voltar].forEach((el) => { el.dataset.valor = String(opcao.valor); });
  }

  let origem = null;
  function abrir(botao) {
    origem = botao;
    escolher(opcoes.find((opcao) => opcao.valor === Number(botao.dataset.valor)) || opcoes[0]);
    popup.classList.add('open');
    document.body.style.overflow = 'hidden';
    cartao.scrollTop = 0;
    cartao.focus();
  }
  function fechar() {
    if (!popup.classList.contains('open')) return;
    popup.classList.remove('open');
    document.body.style.overflow = '';
    origem?.focus();
  }

  // Delegado no documento: o bloco nasce escondido e só aparece aos 9:14 do
  // vídeo. Fase de bolha de propósito — o js/member.js já contou o toque e
  // marcou a oração na fase de captura, antes daqui.
  document.addEventListener('click', (evento) => {
    const botao = evento.target instanceof Element && evento.target.closest('.doacao-dia-03__botao[data-mensal]');
    if (!botao) return;
    evento.preventDefault();
    abrir(botao);
  });
  voltar.addEventListener('click', fechar);
  popup.addEventListener('click', (evento) => { if (evento.target === popup) voltar.click(); });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && popup.classList.contains('open')) voltar.click();
  });
  // Voltando do pagamento pelo botão "voltar" do celular, a página pode
  // reaparecer como estava, com o pop-up aberto. Fecha sem contar: ela não
  // tocou em "Voltar para a oração".
  window.addEventListener('pageshow', (evento) => { if (evento.persisted) fechar(); });
})();
