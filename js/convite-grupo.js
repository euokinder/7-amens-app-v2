// CONVITE PARA O GRUPO NO WHATSAPP — o pop-up que chama a cliente para o
// grupo, falando do que ela ganha lá dentro (pedido do Caio, 11/10/2026).
//
// QUEM DECIDE QUANDO ELE APARECE é o mesmo sistema do pop-up dos Arcanjos: a
// campanha `grupo_whatsapp_1`, no banco (supabase/convite-grupo.sql). O
// js/member.js recebe a campanha e, por ela ser do tipo 'grupo', chama
// CONVITE_GRUPO.abrir() em vez do pop-up de oferta comum. Regras do Caio
// (11/10/2026): depois dos dois pop-ups dos Arcanjos, uma vez só, para todas
// as clientes, e SÓ NA TELA INICIAL — por isso só o index.html carrega este
// arquivo. Em outra tela, a campanha espera ela passar pela inicial.
// O LINK que vale é o da campanha (target_url): trocar o link do grupo é
// mexer no banco, sem publicar o site. O LINK_DO_GRUPO daqui só serve à
// prévia.
//
// Prévia, sem contar nada no banco: index.html?previa-grupo=1.
//
// A copy mora toda aqui em cima. Num benefício, o trecho entre *asteriscos*
// sai em negrito.
// Os benefícios falam do GRUPO, não das 7 orações do app (pedido do Caio,
// 11/10/2026). Cada um precisa ser algo que o grupo entrega de verdade.
(function () {
  // Só para a prévia: com a campanha, o link vem do banco. É o mesmo do card
  // da home.
  const LINK_DO_GRUPO = 'https://chat.whatsapp.com/K603psXEfac6YCneu5TgaR';

  const TEXTOS = {
    chamada: 'Grupo exclusivo no WhatsApp',
    titulo: 'Você não precisa rezar sozinha',
    intro: 'Lá no grupo, você tem:',
    beneficios: [
      { icone: 'video', texto: '*Lives e orações* exclusivas' },
      { icone: 'presente', texto: '*Materiais bônus* exclusivos' },
      { icone: 'cruz', texto: 'Passagens e *imagens de Jesus*' },
      { icone: 'livro', texto: '*Orações e salmos* diários' },
      { icone: 'medalha', texto: '*Sorteios* e prêmios' },
    ],
    garantia: 'É de graça. Você sai quando quiser.',
    botao: 'Quero entrar no grupo',
    recusa: 'Agora não',
  };

  // O logo do WhatsApp (o balão com o telefone), desenhado cheio. É ele que
  // a cliente reconhece de longe: vai no topo e no botão.
  const LOGO_WHATSAPP = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';

  // Os ícones dos benefícios: só o traço, no mesmo estilo dos cards da home.
  const svg = corpo => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
  const ICONES = {
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    cruz: '<path d="M12 2v20"/><path d="M6 8h12"/>',
    livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    medalha: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  };

  function el(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto) node.textContent = texto;
    return node;
  }

  // "*Sorteios* e prêmios" → <strong>Sorteios</strong>, " e prêmios".
  // Monta nó por nó, sem innerHTML.
  function comNegrito(texto) {
    const span = el('span', 'convite-grupo-beneficio-texto');
    String(texto).split('*').forEach((trecho, i) => {
      if (trecho) span.append(i % 2 ? el('strong', '', trecho) : document.createTextNode(trecho));
    });
    return span;
  }

  function icone(nome, classe) {
    const caixa = el('span', classe);
    caixa.innerHTML = nome === 'whatsapp' ? LOGO_WHATSAPP : svg(ICONES[nome] || ICONES.livro);
    return caixa;
  }

  function montar(opcoes) {
    const dialog = el('dialog', 'convite-grupo');
    dialog.id = 'convite-grupo';
    dialog.setAttribute('aria-labelledby', 'convite-grupo-titulo');

    const folha = el('div', 'convite-grupo-folha');
    const topo = icone('whatsapp', 'convite-grupo-icone');
    const chamada = el('p', 'convite-grupo-chamada', TEXTOS.chamada);
    const titulo = el('h2', 'convite-grupo-titulo', TEXTOS.titulo);
    titulo.id = 'convite-grupo-titulo';
    const intro = el('p', 'convite-grupo-intro', TEXTOS.intro);

    const lista = el('ul', 'convite-grupo-beneficios');
    TEXTOS.beneficios.forEach(b => {
      const item = el('li', 'convite-grupo-beneficio');
      item.append(icone(b.icone, 'convite-grupo-beneficio-icone'), comNegrito(b.texto));
      lista.append(item);
    });

    const garantia = el('p', 'convite-grupo-garantia', TEXTOS.garantia);

    // Link de verdade (e não botão com JS): se algo falhar no meio, o toque
    // ainda leva ao grupo. Abre fora do app, como o card da home.
    const botao = el('a', 'convite-grupo-botao');
    botao.href = opcoes.link || LINK_DO_GRUPO;
    botao.target = '_blank';
    botao.rel = 'noopener';
    botao.append(icone('whatsapp', 'convite-grupo-botao-icone'), el('span', '', TEXTOS.botao));

    const recusa = el('button', 'convite-grupo-recusa', TEXTOS.recusa);
    recusa.type = 'button';

    let entrou = false;
    botao.addEventListener('click', () => {
      entrou = true;
      if (opcoes.aoEntrar) opcoes.aoEntrar();
      // Fecha logo atrás: quando ela voltar do WhatsApp, o pop-up não está
      // mais na frente da tela.
      setTimeout(() => dialog.close(), 300);
    });
    recusa.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (opcoes.aoFechar) opcoes.aoFechar({ entrou });
      dialog.remove();
    });

    folha.append(topo, chamada, titulo, intro, lista, garantia, botao, recusa);
    dialog.append(folha);
    return dialog;
  }

  // opcoes: link (o do grupo), aoMostrar, aoEntrar, aoFechar({ entrou }).
  let esperando = false;
  function abrir(opcoes = {}) {
    if (esperando || document.getElementById('convite-grupo')) return;
    const mostrar = () => {
      esperando = false;
      const dialog = montar(opcoes);
      document.body.append(dialog);
      dialog.showModal();
      if (opcoes.aoMostrar) opcoes.aoMostrar();
    };
    // Enquanto o app confere o acesso, a tela "Verificando seu acesso…" está
    // na frente. O convite espera ela sair, para não aparecer em cima dela.
    const raiz = document.documentElement;
    if (!raiz.classList.contains('member-checking')) return mostrar();
    esperando = true;
    const vigia = new MutationObserver(() => {
      if (raiz.classList.contains('member-checking')) return;
      vigia.disconnect();
      mostrar();
    });
    vigia.observe(raiz, { attributes: true, attributeFilter: ['class'] });
  }

  window.CONVITE_GRUPO = { abrir };

  if (new URLSearchParams(location.search).has('previa-grupo')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => abrir());
    else abrir();
  }
})();
