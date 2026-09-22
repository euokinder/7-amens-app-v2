// Recuperar o acesso pelo CPF
// ============================================================================
// Para quem não lembra, ou errou, o e-mail que usou na compra. Ela digita o
// CPF e recebe de volta o e-mail de acesso, entrando na hora.
//
// Antes disto, a única saída dessa cliente era o WhatsApp do suporte — e era
// para lá que a tela de login a mandava. Esta conversa existe para que o
// WhatsApp volte a ser a última porta, não a primeira.
//
// ⚠️ NÃO tem inteligência artificial aqui, de propósito. Toda fala é texto
// fixo escrito à mão. Custa zero por conversa, responde sempre a mesma coisa e
// nunca inventa uma resposta estranha para uma senhora de 68 anos às 4h da
// manhã. Se um dia parecer pouco, o caminho é escrever mais falas — não trocar
// isto por um robô que conversa.
//
// A conta do CPF (SHA-256) NÃO acontece aqui: o navegador manda os números e
// quem embaralha e compara é a member-api. Ver `supabase/recuperacao-por-cpf.sql`.
(() => {
  'use strict';

  const painel = document.getElementById('recuperar');
  if (!painel) return;

  const conversa = document.getElementById('recuperar-conversa');
  const barra = document.getElementById('recuperar-form');
  const campo = document.getElementById('recuperar-cpf');
  const enviar = barra.querySelector('button[type="submit"]');
  const abrir = document.getElementById('recuperar-abrir');
  const fechar = document.getElementById('recuperar-fechar');
  const AJUDA = painel.dataset.whatsapp || '';

  // A ponte vem do js/member.js, que é quem sabe o endereço da API e o nome da
  // chave da sessão. Se ela não existir, aquele arquivo não carregou — e aí a
  // única coisa honesta a fazer é mandar a cliente para o WhatsApp em vez de
  // deixá-la conversando com uma tela que não vai responder.
  //
  // ⚠️ Lida na HORA DO USO, nunca aqui em cima. O member.js só cria a ponte
  // quando o documento termina de carregar, e este arquivo roda antes disso —
  // guardá-la agora capturaria "não existe" para sempre, e toda cliente cairia
  // na mensagem de erro com o sistema inteiro funcionando.
  const ponte = () => window.MEMBER_RECUPERACAO || null;

  // Quem pediu menos movimento no aparelho não recebe animação nenhuma, e
  // também não espera pelos pontinhos: as falas aparecem direto.
  const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let ocupado = false;
  let encerrado = false;

  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  // Rola até embaixo a cada fala nova. Sem isto, a resposta nasce fora da tela
  // e ela acha que nada aconteceu.
  function aoFim() {
    conversa.scrollTo({ top: conversa.scrollHeight, behavior: semMovimento?.matches ? 'auto' : 'smooth' });
  }

  // ⚠️ Os nomes das classes são TODOS prefixados com `recuperar-`. A primeira
  // versão chamava o balão do app de `app`, e isso colidiu com a classe `.app`
  // do styles.css, que é a moldura da página inteira: o balão herdou
  // `min-height: 100dvh` e virou uma caixa vazia do tamanho da tela, com o
  // texto dentro e invisível. Nome curto e genérico aqui não é opção.
  function fala(texto, de = 'nos') {
    const balao = node('p', `recuperar-balao recuperar-balao-${de}`, texto);
    conversa.append(balao);
    aoFim();
    return balao;
  }

  const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Os três pontinhos do WhatsApp. Não é enfeite: sem eles, uma pausa antes da
  // resposta parece travamento, e travamento é o que faz ela desistir e ligar
  // no suporte. Com eles, a mesma pausa vira "estão me respondendo".
  function escrevendo() {
    const balao = node('p', 'recuperar-balao recuperar-balao-nos recuperar-escrevendo');
    balao.setAttribute('aria-label', 'Escrevendo');
    for (let i = 0; i < 3; i += 1) balao.append(node('span', ''));
    conversa.append(balao);
    aoFim();
    return balao;
  }

  // Cada fala é anunciada pelos pontinhos antes de aparecer. O ritmo é curto de
  // propósito — é uma senhora precisando de ajuda, não uma encenação.
  async function falaDevagar(linhas) {
    for (const linha of linhas) {
      if (semMovimento?.matches) {
        fala(linha);
        continue;
      }
      const pontos = escrevendo();
      await pausa(550);
      pontos.remove();
      fala(linha);
      await pausa(150);
    }
  }

  function botao(rotulo, aoClicar, classe = 'member-button') {
    const b = node('button', `${classe} recuperar-acao`, rotulo);
    b.type = 'button';
    b.onclick = aoClicar;
    conversa.append(b);
    aoFim();
    return b;
  }

  function botaoWhatsApp(rotulo = 'Falar com a gente no WhatsApp') {
    const a = node('a', 'member-button secondary recuperar-acao', rotulo);
    a.href = AJUDA;
    a.target = '_blank';
    a.rel = 'noopener';
    conversa.append(a);
    aoFim();
    return a;
  }

  // Encerra a conversa: some a barra de digitar, porque não há mais o que ela
  // possa escrever que mude alguma coisa.
  function encerrar() {
    encerrado = true;
    barra.hidden = true;
  }

  // --- CPF -------------------------------------------------------------------

  const soDigitos = (valor) => (valor || '').replace(/\D/g, '').slice(0, 11);

  // 000.000.000-00 enquanto ela digita. Os pontos e o traço ajudam a conferir
  // se não pulou nem repetiu número — em tela de celular, onze dígitos seguidos
  // sem separação são difíceis de reler.
  function comMascara(digitos) {
    const a = digitos.slice(0, 3);
    const b = digitos.slice(3, 6);
    const c = digitos.slice(6, 9);
    const d = digitos.slice(9, 11);
    let saida = a;
    if (b) saida += `.${b}`;
    if (c) saida += `.${c}`;
    if (d) saida += `-${d}`;
    return saida;
  }

  // A conta oficial dos dois últimos dígitos do CPF. Serve só para avisar ela
  // na hora, sem gastar uma ida ao servidor: quase todo CPF digitado errado
  // falha aqui, e o aviso chega instantâneo em vez de virar "não encontrei",
  // que soaria como "você não comprou".
  function cpfValido(d) {
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;
    const conta = (ate, peso) => {
      let soma = 0;
      for (let i = 0; i < ate; i += 1) soma += Number(d[i]) * (peso - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return conta(9, 10) === Number(d[9]) && conta(10, 11) === Number(d[10]);
  }

  // --- A conversa ------------------------------------------------------------

  function trabalhando(estado) {
    ocupado = estado;
    enviar.disabled = estado;
    enviar.textContent = estado ? 'Buscando…' : 'Enviar';
  }

  async function comecar() {
    conversa.replaceChildren();
    encerrado = false;
    barra.hidden = false;
    campo.value = '';
    trabalhando(false);

    if (!ponte() || !window.MEMBER_API) {
      fala('Oi! Estou com dificuldade de abrir a busca agora.');
      fala('Me chama no WhatsApp que a gente resolve seu acesso na mão, tá bom?');
      botaoWhatsApp();
      encerrar();
      return;
    }

    await falaDevagar([
      'Oi! Que bom que você veio. Vamos achar seu acesso juntas. 🙏',
      'Não tem problema nenhum não lembrar do e-mail — acontece muito.',
      'Me diga o seu CPF, o mesmo que você usou na hora da compra. Pode digitar só os números.',
    ]);
    campo.focus();
  }

  async function procurar(digitos) {
    fala(comMascara(digitos), 'ela');
    campo.value = '';
    trabalhando(true);

    const pontos = escrevendo();

    try {
      const dados = await ponte().api('recover', { cpf: digitos });
      pontos.remove();
      await encontrada(dados);
    } catch (erro) {
      pontos.remove();
      await naoDeuCerto(erro);
    } finally {
      trabalhando(false);
    }
  }

  async function encontrada(dados) {
    encerrar();

    // O nome dela NÃO é usado aqui de propósito. Cerca de 4 em cada 10
    // cadastros estão no nome do marido ou do filho que comprou (medido em
    // 19/09), e "Achei você, Luiz!" para uma Maria estragaria justamente o
    // momento em que ela precisa confiar na tela. Isso é decisão em aberto
    // com o Caio; até lá, esta tela não repete o problema.
    await falaDevagar(['Achei sua compra! 🎉', 'O e-mail do seu acesso é este:']);

    // O endereço vai montado em dois pedaços com um ponto de quebra no meio.
    // Sem isso ele quebra em qualquer letra e sai "...silva@gmail" / ".com",
    // que ela lê duas vezes para ter certeza. Com o corte no `@`, vira
    // "mariadelourdes.silva" / "@gmail.com" — duas partes que fazem sentido.
    // `overflow-wrap: anywhere` no CSS continua valendo como último recurso,
    // para um endereço sem arroba ou com a parte local gigante.
    const caixa = node('p', 'recuperar-email');
    const endereco = dados.email || '';
    const arroba = endereco.lastIndexOf('@');
    if (arroba > 0) {
      caixa.append(document.createTextNode(endereco.slice(0, arroba)));
      caixa.append(document.createElement('wbr'));
      caixa.append(document.createTextNode(endereco.slice(arroba)));
    } else {
      caixa.textContent = endereco;
    }
    conversa.append(caixa);
    aoFim();

    // Copiar ajuda quem quer guardar o e-mail nas anotações do celular. É um
    // extra: se o navegador não deixar copiar, o botão simplesmente não nasce —
    // ela continua vendo o endereço na tela e entrando pelo botão de baixo.
    if (navigator.clipboard?.writeText) {
      const copiar = botao('Copiar e-mail', async () => {
        try {
          await navigator.clipboard.writeText(dados.email || '');
          copiar.textContent = 'Copiado!';
          copiar.classList.add('recuperar-copiado');
          setTimeout(() => {
            copiar.textContent = 'Copiar e-mail';
            copiar.classList.remove('recuperar-copiado');
          }, 2200);
        } catch {
          // O navegador pode recusar a área de transferência (aba sem foco,
          // permissão negada, navegador antigo). Não é beco sem saída: o
          // endereço continua na tela logo acima, e o botão volta ao normal
          // para ela tentar outra vez.
          copiar.textContent = 'Não consegui copiar';
          setTimeout(() => { copiar.textContent = 'Copiar e-mail'; }, 2200);
        }
      }, 'member-button secondary');
    }

    await pausa(350);
    await falaDevagar([
      'Guarde este e-mail com carinho — é com ele que você entra sempre.',
      'Pode entrar agora, já deixei tudo pronto para você.',
    ]);

    botao('Entrar nas minhas orações', () => {
      try { ponte().guardar(dados.token); } catch { /* segue mesmo assim */ }
      window.location.replace(ponte().destino());
    });
  }

  async function naoDeuCerto(erro) {
    const status = erro && erro.status;

    // ⚠️ Estes dois casos NÃO encerram a conversa, de propósito. A barra de
    // digitar continua no lugar para ela tentar outro CPF — pode ter trocado um
    // número sem querer, ou lembrar no meio do caminho que quem comprou foi o
    // marido. Fechar aqui transformaria um engano de digitação numa mensagem
    // no WhatsApp, que é exatamente o que esta tela existe para evitar.
    //
    // A ordem das falas é proposital: tentar de novo vem ANTES do WhatsApp,
    // porque é mais rápido para ela e resolve sozinho.
    if (status === 404) {
      await falaDevagar([
        'Não encontrei nenhuma compra com esse CPF — mas isso não quer dizer que você não tenha o acesso.',
        'Pode ser que faltou um número, que a compra foi feita no CPF de alguém da família, ou que seja um cadastro mais antigo que ainda não tenho aqui.',
        'Quer tentar outro CPF? É só digitar aqui embaixo.',
      ]);
      botaoWhatsApp('Prefiro falar no WhatsApp');
      campo.focus();
      return;
    }

    if (status === 403) {
      await falaDevagar([
        'Encontrei sua compra, mas o acesso está desativado no momento.',
        'Se você tiver outro CPF para tentar, pode digitar aqui embaixo. Se não, me chama no WhatsApp que a gente vê o que aconteceu.',
      ]);
      botaoWhatsApp();
      campo.focus();
      return;
    }

    if (status === 429) {
      await falaDevagar([
        'Foram muitas tentativas seguidas, e preciso esperar um pouquinho antes de procurar de novo.',
        'Descanse uns minutinhos e tente outra vez. Se preferir não esperar, me chama no WhatsApp.',
      ]);
      botaoWhatsApp('Prefiro falar no WhatsApp');
      return;
    }

    if (status === 400) {
      fala('Esse CPF não parece completo. Confere os números para mim e manda de novo?');
      campo.focus();
      return;
    }

    // Sem status, o problema é nosso ou da conexão dela — nunca do CPF. Aqui
    // também não se encerra: o mesmo CPF pode dar certo na segunda tentativa.
    await falaDevagar([
      'Não consegui procurar agora. Pode ser a internet dando uma fraquejada.',
      'Tente de novo em instantes, ou me chama no WhatsApp.',
    ]);
    botaoWhatsApp();
    campo.focus();
  }

  // --- Ligações da tela ------------------------------------------------------

  campo.addEventListener('input', () => {
    campo.value = comMascara(soDigitos(campo.value));
  });

  barra.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (ocupado || encerrado) return;

    const digitos = soDigitos(campo.value);

    if (digitos.length < 11) {
      fala('Ainda faltam alguns números. O CPF tem onze ao todo.');
      campo.focus();
      return;
    }
    if (!cpfValido(digitos)) {
      fala('Esse CPF não parece certo. Confere os números para mim, com calma?');
      campo.focus();
      return;
    }
    procurar(digitos);
  });

  function abrirPainel() {
    painel.hidden = false;
    // Trava a rolagem da página de trás. Sem isto, o dedo dela arrasta o login
    // por baixo do painel e a conversa parece estar escapando da tela.
    document.body.style.overflow = 'hidden';
    comecar();
  }

  function fecharPainel() {
    painel.hidden = true;
    document.body.style.overflow = '';
    // Devolve o foco ao botão que abriu: quem navega por teclado ou leitor de
    // tela ficaria perdido no topo da página se o foco simplesmente sumisse.
    abrir?.focus();
  }

  abrir?.addEventListener('click', abrirPainel);
  fechar?.addEventListener('click', fecharPainel);

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !painel.hidden) fecharPainel();
  });
})();
