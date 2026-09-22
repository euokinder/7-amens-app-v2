// ============================================================
// BANNER DE DESTAQUE DA HOME — carrossel de imagens
//
// Arquivo SEPARADO de propósito. O js/app.js roda em cinco páginas
// (index, novena, dia, dia-desatadora, desatadora) e o banner só
// existe na home. O scripts/build.mjs copia a pasta js/ inteira,
// então este arquivo entra no deploy sozinho, sem declarar nada.
//
// Quem arrasta é o próprio navegador: o trilho é uma faixa com
// overflow-x + scroll-snap. Este arquivo só faz quatro coisas
// pequenas — montar os slides a partir de uma lista, mover quando
// tocam na seta ou no pontinho, acender o pontinho certo, e avisar
// o leitor de tela.
//
// DE ONDE VEM A LISTA. Do banco, pela member-api, pelo caminho
// window.DESTAQUES -> initDestaque(). Quem preenche é o js/member.js,
// a cada verificação de sessão. Se o banco não responder, ou se a
// tabela `member_home_banners` ainda não existir, vale a lista escrita
// logo abaixo — a home nunca fica sem banner.
//
// ------------------------------------------------------------
// POR QUE O BANNER NÃO USA A CLASSE "card" — e isto morde de verdade
// ------------------------------------------------------------
// O initScrollFocus() do js/app.js observa ".card:not(.static)" e
// deixa em opacity .5 / scale(.96) tudo que não está 60% visível.
// E a própria regra .card do css/styles.css já NASCE com opacity .5.
// Se o banner virasse "card", ele apareceria apagado bem no lugar
// mais nobre da tela, e apagado para sempre.
//
// A correção NÃO é mexer no initScrollFocus. É nomear certo: o
// banner se chama "destaque-*" e nunca "card", então o seletor não
// o alcança. Zero linha alterada no código que já funciona.
// E é honesto também: a linha embaixo diz "Toque em qualquer card
// para abrir e começar" — o banner não é um daqueles cards.
// ============================================================

(() => {
  'use strict';

  // Os endereços do próprio app, em todas as roupas que ele veste.
  // Mesma lista do js/member.js, e pelo mesmo motivo: o banco guarda o
  // endereço com o domínio de verdade, e em localhost isso jogaria quem
  // está testando direto no site das clientes reais.
  const nossosSites = /(?:^|[.-])(?:setemadrugadas\.com\.br|7-amens-app-v2\.netlify\.app|7madrugadas\.netlify\.app)$/;

  // Peneira de endereço, usada tanto no link quanto na imagem. A lista
  // vem de um campo de texto do painel, então "javascript:" e amigos
  // morrem aqui, e não na tela da cliente.
  function enderecoSeguro(bruto) {
    let url;
    try { url = new URL(String(bruto), location.href); } catch { return null; }
    if (url.origin === location.origin) return { href: url.href, externo: false };
    if (url.protocol !== 'https:') return null;
    if (nossosSites.test(url.hostname)) {
      try { return { href: new URL(url.pathname + url.search + url.hash, location.href).href, externo: false }; }
      catch { return null; }
    }
    return { href: url.href, externo: true };
  }

  // O carrossel de agora. Os ouvintes de evento são ligados UMA vez e
  // perguntam por aqui quem manda — se fossem religados a cada desenho,
  // uma home aberta a madrugada toda acumularia um ouvinte a cada
  // verificação de sessão, e um toque na seta pularia várias imagens.
  let controle = null;
  let ouvintesLigados = false;
  // A lista desenhada por último. Redesenhar sem necessidade jogaria a
  // cliente de volta para a primeira imagem no meio da leitura.
  let assinaturaAtual = null;
  // O relógio do pouso mora AQUI, no módulo, e não dentro de cada desenho.
  // Quando a lista muda no meio de uma rolagem, o desenho velho é jogado
  // fora mas o relógio dele continuava vivo apontando para o mesmo trilho:
  // 600ms depois ele puxava o carrossel para a posição antiga sozinho,
  // como se a tela tivesse vida própria.
  let pouso;
  // "A rolagem de agora é do código, não do dedo." Sem esta bandeira, os
  // eventos de rolagem da animação suave chegam com a imagem ainda no meio
  // do caminho, sincronizar() arredonda para o slide ANTERIOR e rebobina o
  // índice. Consequência real: a cliente toca ">" duas vezes seguidas e
  // anda um slide só — a seta parece não funcionar.
  let emVoo = false;

  function ligarOuvintes(trilho, anterior, proxima) {
    if (ouvintesLigados) return;
    ouvintesLigados = true;

    trilho.addEventListener('scroll', () => controle && controle.sincronizar(), { passive: true });
    // Se ela encostar o dedo no trilho, quem manda é ela: cancela o pouso
    // automático para não puxar a imagem de volta no meio do gesto.
    trilho.addEventListener('pointerdown', () => controle && controle.soltar(), { passive: true });
    trilho.addEventListener('keydown', evento => {
      if (!controle) return;
      if (evento.key === 'ArrowRight') { evento.preventDefault(); controle.mover(1); }
      else if (evento.key === 'ArrowLeft') { evento.preventDefault(); controle.mover(-1); }
    });
    if (anterior) anterior.addEventListener('click', () => controle && controle.mover(-1));
    if (proxima) proxima.addEventListener('click', () => controle && controle.mover(1));

    // Girar o telefone muda a largura do trilho: sem isto a imagem fica
    // parada no meio do caminho entre duas.
    let giro;
    window.addEventListener('resize', () => {
      clearTimeout(giro);
      giro = setTimeout(() => controle && controle.recolocar(), 150);
    });
    // Voltar de outra página pelo botão "voltar" restaura a rolagem do
    // trilho sem disparar evento: reconfere quem está na frente.
    window.addEventListener('pageshow', () => controle && controle.sincronizar());
  }

  function initDestaque() {
    const secao = document.querySelector('.destaque');
    if (!secao) return;

    const trilho = secao.querySelector('.destaque-trilho');
    const pontos = secao.querySelector('.destaque-pontos');
    const status = secao.querySelector('.destaque-status');
    const anterior = secao.querySelector('.destaque-seta.anterior');
    const proxima = secao.querySelector('.destaque-seta.proxima');
    if (!trilho || !pontos) return;

    // Sem lista de reserva, de propósito. Antes, banco vazio ou fora do ar
    // caía numa lista escrita no código, e a home mostrava um destaque que
    // ninguém tinha escolhido no painel. Hoje vale o contrário: sem banner
    // cadastrado, a seção inteira não aparece (ela só ganha o data-pronto
    // lá embaixo, depois de montar pelo menos um slide de verdade).
    const lista = Array.isArray(window.DESTAQUES) ? window.DESTAQUES : [];

    // Monta os slides. Endereço torto derruba só aquele item, nunca o
    // banner inteiro: um banner mal digitado no painel não pode apagar
    // os outros dois da home.
    const slides = [];
    lista.forEach(item => {
      if (!item) return;
      const destino = enderecoSeguro(item.href);
      const imagem = enderecoSeguro(item.img);
      if (!destino || !imagem) return;

      const link = document.createElement('a');
      link.className = 'destaque-slide';
      link.href = destino.href;
      link.setAttribute('aria-label', `Destaque ${slides.length + 1}: ${item.titulo || 'ver conteúdo'}`);
      if (destino.externo) { link.target = '_blank'; link.rel = 'noopener'; }

      const img = document.createElement('img');
      img.src = imagem.href;
      // alt vazio de propósito: quem descreve o destino é o aria-label do
      // link. Com alt preenchido, o leitor de tela falaria duas vezes.
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      if (slides.length === 0) img.setAttribute('fetchpriority', 'high');
      else img.loading = 'lazy';

      link.append(img);
      slides.push(link);
    });

    // Lista vazia ou toda torta: a seção continua sem o data-pronto e o CSS
    // a mantém invisível. Se JÁ havia banner desenhado antes (o painel pode
    // ter desligado o último enquanto a cliente estava com o app aberto), o
    // trilho é esvaziado e a seção volta a sumir, em vez de congelar
    // mostrando um banner que não existe mais.
    if (!slides.length) {
      trilho.replaceChildren();
      pontos.replaceChildren();
      if (status) status.textContent = '';
      secao.removeAttribute('data-pronto');
      assinaturaAtual = null;
      return;
    }

    // Nada mudou desde o último desenho: não mexe. Sem esta linha, cada
    // verificação de sessão (de 5 em 5 minutos) jogaria a cliente de
    // volta para a primeira imagem enquanto ela olha a terceira.
    const assinatura = slides.map(a => `${a.href}|${a.querySelector('img').src}`).join('\n');
    if (assinatura === assinaturaAtual) return;
    assinaturaAtual = assinatura;

    const total = slides.length;
    // O desenho anterior pode ter deixado um pouso agendado. Ele aponta
    // para o MESMO trilho (replaceChildren só troca os filhos), então se
    // sobrevivesse puxaria o carrossel novo para a posição do antigo.
    clearTimeout(pouso);
    emVoo = false;
    trilho.replaceChildren(...slides);
    // Um número de verdade no lugar de "as outras": o leitor de tela
    // anuncia o tamanho do carrossel antes de a cliente entrar nele. Com
    // um banner só não existem setas, então prometê-las seria mentira para
    // quem não enxerga a tela.
    trilho.setAttribute('aria-label', total === 1
      ? 'Destaque: 1 imagem.'
      : `Destaques: ${total} imagens. Use as setas para ver as outras.`);

    // Um destaque só: não há o que navegar, então não há controle. Some
    // pelo CSS e não com remove(), porque o painel pode acrescentar um
    // segundo banner a qualquer momento — e aí as setas precisam voltar.
    secao.toggleAttribute('data-unico', total < 2);
    if (total < 2) {
      controle = null;
      pontos.replaceChildren();
      // O aviso do desenho anterior ("Imagem 3 de 4") ficaria mentindo no
      // leitor de tela para sempre, já que ninguém mais o atualiza.
      if (status) status.textContent = '';
      trilho.scrollTo({ left: 0, behavior: 'auto' });
      secao.setAttribute('data-pronto', '');
      return;
    }

    let atual = 0;
    const botoes = [];

    const comoRolar = () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    function pintar() {
      botoes.forEach((botao, indice) => {
        if (indice === atual) botao.setAttribute('aria-current', 'true');
        else botao.removeAttribute('aria-current');
      });
      if (status) status.textContent = `Imagem ${atual + 1} de ${total}`;
    }

    function irPara(indice) {
      // Enquanto o html.member-checking esconde o app, clientWidth vale
      // ZERO. Guarda barata contra rolar para lugar nenhum.
      const largura = trilho.clientWidth;
      if (!largura) return;

      // Dá a volta: do último, ">" leva ao primeiro. Seta desativada faz
      // a cliente achar que o app travou e ligar no WhatsApp.
      atual = ((indice % total) + total) % total;
      const alvo = atual * largura;
      emVoo = true;
      trilho.scrollTo({ left: alvo, behavior: comoRolar() });
      pintar();

      // Rede de segurança, e não é preciosismo: a rolagem suave é uma
      // animação do navegador e pode não chegar ao fim — já foi visto o
      // trilho parar entre duas imagens e ficar lá, com meia foto de cada
      // lado. Meio segundo depois, se não chegou, pousa de uma vez. O pior
      // caso vira um corte seco; o feio é a meia imagem.
      clearTimeout(pouso);
      pouso = setTimeout(() => {
        if (Math.abs(trilho.scrollLeft - alvo) > 2) {
          trilho.scrollTo({ left: alvo, behavior: 'auto' });
        }
        // Chegou (ou foi posto à força): o trilho volta a ser da cliente.
        emVoo = false;
      }, 600);
    }

    // Arrastar com o dedo também tem que acender o pontinho certo. Quem
    // manda no pontinho é a POSIÇÃO REAL do trilho, nunca o clique: assim
    // o dedo, a seta, o pontinho e o teclado acabam no mesmo lugar.
    function sincronizar() {
      const largura = trilho.clientWidth;
      if (!largura) return;
      const indice = Math.round(trilho.scrollLeft / largura);
      // Enquanto a rolagem é do código, o índice de verdade é o que irPara()
      // já escolheu — a posição do trilho ainda está a caminho. Aceitar o
      // meio do caminho rebobinaria o índice para o slide anterior.
      // Quando chega no alvo, o voo acabou e a cliente manda de novo.
      if (emVoo) {
        if (Math.abs(trilho.scrollLeft - atual * largura) <= 2) emVoo = false;
        return;
      }
      if (indice >= 0 && indice < total && indice !== atual) { atual = indice; pintar(); }
    }

    // Os pontinhos nascem da quantidade real de slides — nunca existe
    // pontinho a mais ou a menos que imagem.
    for (let k = 0; k < total; k++) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'destaque-ponto';
      botao.setAttribute('aria-label', `Ver imagem ${k + 1} de ${total}`);
      botao.addEventListener('click', () => irPara(k));
      botoes.push(botao);
    }
    pontos.replaceChildren(...botoes);

    // O trilho pode estar rolado de um desenho anterior: volta ao começo
    // para a primeira imagem e o primeiro pontinho concordarem.
    trilho.scrollTo({ left: 0, behavior: 'auto' });

    controle = {
      mover: passo => irPara(atual + passo),
      sincronizar,
      // O dedo encostou: a rolagem passa a ser dela na mesma hora.
      soltar: () => { clearTimeout(pouso); emVoo = false; },
      recolocar: () => { if (trilho.clientWidth) trilho.scrollTo({ left: atual * trilho.clientWidth, behavior: 'auto' }); },
    };
    ligarOuvintes(trilho, anterior, proxima);

    // Só agora setas e pontinhos aparecem.
    secao.setAttribute('data-pronto', '');
    pintar();
  }

  // NÃO tem giro automático, e é decisão, não esquecimento. Imagem que
  // troca sozinha é alvo que se mexe na hora do toque, tira o controle de
  // quem lê devagar, e obrigaria um botão de pausa (WCAG 2.2.2) — mais um
  // ícone incompreensível disputando atenção numa home que já tem sete
  // cards. Se o Caio pedir depois, entra COM pausa e respeitando o
  // prefers-reduced-motion; não é só ligar um setInterval.
  document.addEventListener('DOMContentLoaded', initDestaque);

  // O js/member.js chama isto de novo assim que os banners chegam do
  // banco, e a cada verificação de sessão. Redesenhar só acontece se a
  // lista realmente mudou.
  window.initDestaque = initDestaque;
})();
