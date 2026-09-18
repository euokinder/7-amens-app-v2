// Conteúdo real dos 7 Améns da Madrugada + Introdução.
// videoId vazio = ainda não temos o vídeo real (mostra placeholder).
// materialPdf vazio = ainda não temos o PDF desse dia (botão fica oculto).
// audioUrl vazio = sem áudio ainda (botão de ouvir fica oculto).
const DIAS = {
  0: {
    numero: '0',
    titulo: 'Introdução',
    subtitulo: 'Comece aqui antes da 1ª madrugada',
    kicker: '7 Améns da Madrugada · Comece Aqui',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aaad90b2ceec980432f7750" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aaad90b2ceec980432f7750/v4/player.js'
    },
    materialPdf: 'assets/pdfs/7-amens-comece-aqui-premium-revisado.pdf',
    materialLabel: 'Acessar Material de Apoio',
    audioUrl: '',
    disponivel: true,
    oracao: null,
    guiaPage: {
      destaque: 'Você não precisa decorar nada.',
      destaqueTexto: 'Guarde este guia. Amanhã, entre 4h e 7h, comece pelo Primeiro Amém e siga um dia de cada vez.',
      fraseKicker: 'Sua jornada em uma frase',
      frase: '7 madrugadas. 7 orações. Uma oração por dia.',
      fraseTexto: 'Sem pressa. Sem compensar. Sem precisar recomeçar do zero se perder um dia.',
      amanha: {
        titulo: 'Amanhã é o Dia 1',
        subtitulo: 'Pai Nosso Completo',
        texto: 'O Padre Tiago estará com você em cada madrugada.'
      },
      prepare: [
        { titulo: 'Horário', texto: 'O recomendado é rezar entre 4h e 7h da manhã.' },
        { titulo: 'Em voz alta', texto: 'De preferência acompanhando o áudio guiado.' },
        { titulo: 'Sem interrupções', texto: 'Escolha um lugar tranquilo e deixe o celular no silencioso.' },
        { titulo: 'Duração', texto: 'Reserve cerca de 8 a 10 minutos para cada oração.' }
      ],
      checklist: [
        'Deixar o áudio fácil de encontrar',
        'Separar um lugar tranquilo',
        'Colocar o celular no silencioso',
        'Lembrar: amanhã é apenas uma oração'
      ],
      seNaoForPossivel: 'Reze assim que acordar. A constância é mais importante do que fazer tudo perfeito.',
      regras: [
        { titulo: 'Uma oração por dia', texto: 'Não reze duas no mesmo dia para compensar.' },
        { titulo: 'Siga a sequência', texto: 'Faça do 1º ao 7º Amém, sempre nessa ordem.' },
        { titulo: 'Não pule de propósito', texto: 'Cada dia prepara o seguinte.' },
        { titulo: 'Perdeu uma madrugada?', texto: 'Continue no dia seguinte de onde parou.' },
        { titulo: 'Não recomece do zero', texto: 'Uma falha não apaga o caminho já feito.' },
        { titulo: 'Reze em voz alta', texto: 'De preferência junto do áudio guiado.' },
        { titulo: 'Faça sem pressa', texto: 'Reserve o tempo da oração e dos momentos de silêncio.' }
      ],
      regraPrincipal: 'Um dia de cada vez.',
      jornada: [
        { titulo: 'Pai Nosso Completo', texto: 'Abra a jornada e reze devagar, prestando atenção em cada palavra.', frase: 'Hoje, eu abri o caminho.' },
        { titulo: 'Oração do Perdão', texto: 'Solte mágoas e culpas antigas, dos outros e de si mesma.', frase: 'Hoje, eu solto o peso que carreguei por anos.' },
        { titulo: 'Oração da Cura', texto: 'Apresente a Deus a sua saúde ou a de alguém que você ama.', frase: 'Eu não estou enfrentando isso sozinha.' },
        { titulo: 'Oração da Libertação', texto: 'Marque uma decisão de ruptura com aquilo que te prende.', frase: 'Isso pode terminar em mim.' },
        { titulo: 'Oração da Prosperidade', texto: 'Apresente seu trabalho e suas contas, pedindo clareza e disciplina.', frase: 'Pode existir uma saída que eu ainda não estou enxergando.' },
        { titulo: 'Oração da Paz', texto: 'Menos palavras. Mais silêncio e descanso.', frase: 'Hoje, eu consigo descansar.' },
        { titulo: 'Oração da Aliança', texto: 'Não é um pedido novo: é a entrega e o selo da semana inteira.', frase: 'Eu fiz a minha parte. Agora eu entrego.' }
      ],
      duvidas: [
        { p: 'Perdi um dia. E agora?', r: 'Continue no dia seguinte a partir de onde parou. Não faça duas orações no mesmo dia.' },
        { p: 'Preciso ter muita fé para começar?', r: 'Não. O guia orienta atenção e constância, um dia de cada vez.' },
        { p: 'Posso rezar fora de 4h às 7h?', r: 'Esse é o horário recomendado. Se não for possível, reze assim que acordar.' },
        { p: 'Só ouvir o áudio já basta?', r: 'A orientação é falar em voz alta, de preferência acompanhando o áudio guiado.' },
        { p: 'E depois do 7º dia?', r: 'Você pode usar o Pai Nosso Completo avulso ou, depois de algum tempo, reiniciar a jornada.' }
      ],
      saude: 'As orações caminham ao lado de tratamento médico, terapia ou remédios - nunca no lugar deles.',
      planoTitulo: 'Está Tudo Pronto',
      planoSubtitulo: 'Amanhã, comece.',
      planoTexto: 'Sem tentar fazer a semana inteira hoje.',
      plano: [
        { titulo: 'Ao acordar', texto: 'Vá para o lugar tranquilo que você escolheu.' },
        { titulo: 'Abra o Dia 1', texto: 'Comece pelo Pai Nosso Completo.' },
        { titulo: 'Reze em voz alta', texto: 'Acompanhe o áudio guiado, sem pressa.' },
        { titulo: 'Terminou?', texto: 'Feche o dia. A próxima oração fica para amanhã.' }
      ],
      lembrete: 'Você não precisa fazer tudo perfeito. Precisa apenas continuar.'
    },
    proximo: 'Amanhã: Primeira Madrugada — O Pai Nosso Completo.'
  },
  1: {
    numero: '1',
    titulo: 'Primeira Madrugada',
    subtitulo: 'Pai Nosso Completo',
    kicker: '7 Améns da Madrugada · Dia 01',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aab6a53529335352865b504" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aab6a53529335352865b504/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-01-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 8 a 10 minutos, sem pressa.',
        'Reze em voz alta, de preferência acompanhando o áudio guiado.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      antes: 'Respire fundo três vezes. Guarde em silêncio o pedido mais importante do seu coração para estes sete dias.',
      preencher: 'Meu pedido:',
      depois: 'Fique alguns instantes em silêncio e apresente a Deus o seu pedido. Diga o nome, a situação, o que está doendo — sem pressa para terminar.',
      declaracao: 'Hoje, eu abri o caminho.'
    },
    audioUrl: 'assets/audio/dia-01-oracao.mp3',
    materialExtraPdf: 'assets/pdfs/traducao-lado-a-lado.pdf',
    materialExtraLabel: 'Manuscrito Digital em Aramaico',
    disponivel: true,
    confirmaAntes: false,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Pai Nosso, que estais no Céu,\nsantificado seja o vosso nome;',
        'venha a nós o vosso Reino;\nseja feita a vossa vontade,\nassim na Terra como no Céu.',
        'O pão nosso de cada dia nos dai hoje;\nperdoai as nossas ofensas,',
        'assim como nós perdoamos\na quem nos tem ofendido;',
        'e não nos deixeis cair em tentação,\nmas livrai-nos do mal.',
        'Porque vosso é o Reino, o poder e a glória, agora e sempre.',
        'Eu recebo, Senhor, as bênçãos que já preparastes para mim.\nAbro o meu coração para tudo aquilo que vem do Teu amor.\nHoje eu não peço mais pela metade — eu recebo por inteiro.',
        'Que a Tua paz habite em mim, hoje e todos os dias da minha vida.\nEu me entrego. Eu confio. Eu recebo.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Segunda Madrugada — A Oração do Perdão.'
  },
  2: {
    numero: '2',
    titulo: 'Segunda Madrugada',
    subtitulo: 'Oração do Perdão',
    kicker: '7 Améns da Madrugada · Dia 02',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac286cd1cf3533caea5880" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac286cd1cf3533caea5880/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-02-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 9 a 11 minutos, sem pressa.',
        'Reze em voz alta, de preferência acompanhando o áudio guiado.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      antes: 'Perdoar não é dizer que o que aconteceu estava certo, e não significa voltar a conviver com quem te machucou. É libertar o seu próprio coração.',
      preencher: 'Eu preciso perdoar:',
      depois: 'Fique alguns instantes em silêncio. Se ainda houver um nome guardado no coração, apresente-o a Deus — em voz alta ou em silêncio.',
      declaracao: 'Hoje, eu solto o peso que carreguei por anos.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor Jesus, Tu que na cruz olhaste para quem Te feria\ne disseste: "Pai, perdoa-lhes, porque não sabem o que fazem",\nensina-me a perdoar como Tu perdoaste.',
        'Hoje eu trouxe um nome comigo.\nEu escolho, agora, entregar essa mágoa nas Tuas mãos.',
        'Eu perdoo o que essa pessoa me fez.\nEu não vou mais deixar essa dor decidir\no meu humor, a minha casa, a minha paz.',
        'E, Senhor, hoje eu também perdoo a mim mesmo, a mim mesma,\npelo que eu fiz e nunca contei pra ninguém,\npelos erros que ainda me perseguem à noite.',
        'Eu não sou mais só aquilo que eu fiz.\nHoje eu escolho recomeçar.',
        'Tira de mim o peso que eu carreguei por anos,\nsem nem perceber o tamanho dele.\nEnche esse espaço vazio com a Tua paz.',
        'Eu solto. Eu perdoo. Eu sou livre.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Terceira Madrugada — A Oração da Cura.'
  },
  3: {
    numero: '3',
    titulo: 'Terceira Madrugada',
    subtitulo: 'Oração da Cura',
    kicker: '7 Améns da Madrugada · Dia 03',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac288759845bfd5b371b1e" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac288759845bfd5b371b1e/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-03-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 8 a 10 minutos, sem pressa.',
        'Reze em voz alta, de preferência acompanhando o áudio guiado.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      importante: 'esta oração não substitui médico, remédio ou tratamento nenhum. Continue o seu acompanhamento médico normalmente — a fé e o cuidado com a saúde caminham juntos.',
      antes: 'Decida por quem você vai rezar hoje: por você, ou por alguém que você ama.',
      preencher: 'Eu rezo por:',
      depois: 'Fique alguns instantes em silêncio. Diga a Deus, em voz alta ou em silêncio, o nome de quem você está entregando hoje, e o que dói.',
      declaracao: 'Eu não estou enfrentando isso sozinho, sozinha.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor, Tu que caminhaste por este mundo\ncolocando as mãos sobre os doentes,\ncoloca hoje a Tua mão sobre mim\n(ou sobre o nome de quem você ama).',
        'Eu não peço só a cura do corpo.\nEu peço força pra atravessar esse tempo.',
        'Dá sabedoria a quem cuida,\ne coragem pra mim, pra seguir o tratamento até o fim.',
        'Enquanto o corpo se trata,\nque a minha alma descanse em Ti.',
        'Tira de mim o medo do resultado.\nOnde há exame, põe a Tua paz.',
        'Seja qual for a resposta que eu receber,\neu escolho confiar que Tu estás comigo.',
        'Eu não estou enfrentando isso sozinho, sozinha.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Quarta Madrugada — A Oração da Libertação.'
  },
  4: {
    numero: '4',
    titulo: 'Quarta Madrugada',
    subtitulo: 'Oração da Libertação',
    kicker: '7 Améns da Madrugada · Dia 04',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac359e57fe5864f0f72204" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac359e57fe5864f0f72204/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-04-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 8 a 10 minutos, sem pressa.',
        'Reze em voz alta, de preferência acompanhando o áudio guiado.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      importante: 'se o que te prende é uma dependência química ou uma compulsão que já machucou a sua vida, esta oração caminha ao lado de tratamento, terapia ou grupo de apoio — ela não substitui isso.',
      antes: 'Nomeie, dentro de você, o que te prende hoje.',
      preencher: 'Eu rompo hoje com:',
      depois: 'Diga a Deus, em voz alta ou em silêncio, o nome daquilo que você está rompendo hoje. Se for um padrão de família, peça que essa corrente pare aqui, com você.',
      declaracao: 'Isso pode terminar em mim.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor, foi para a liberdade que Cristo me libertou.\nE hoje eu escolho viver essa liberdade.',
        'Hoje eu nomeio diante de Ti aquilo que me prende.\nIsso pode ter começado antes de mim.',
        'Mas, em nome de Jesus, pode terminar em mim.\nEu não vou entregar essa corrente\npra quem vem depois de mim.',
        'Dá-me força hoje, e força a cada dia,\naté que essa corrente não tenha mais poder sobre mim.',
        'Eu escolho a liberdade. Eu escolho recomeçar.',
        'A partir de hoje, essa corrente\nnão tem mais a última palavra sobre a minha vida.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Quinta Madrugada — A Oração da Prosperidade.'
  },
  5: {
    numero: '5',
    titulo: 'Quinta Madrugada',
    subtitulo: 'Oração da Prosperidade',
    kicker: '7 Améns da Madrugada · Dia 05',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac291793f4b40dc401d0da" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac291793f4b40dc401d0da/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-05-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 8 a 10 minutos, sem pressa.',
        'Reze em voz alta, de preferência acompanhando o áudio guiado.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      importante: 'esta oração não promete dinheiro garantido, herança ou prêmio. Ela pede clareza, disciplina e coragem para enxergar e agir sobre oportunidades.',
      antes: 'Pense na sua situação financeira específica.',
      preencher: 'Eu apresento a Deus:',
      depois: 'Diga a Deus, em voz alta ou em silêncio, qual é a sua situação financeira específica. Peça clareza pra ela, com as suas próprias palavras.',
      declaracao: 'Pode existir uma saída que eu ainda não estou enxergando.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor, Tu que prometeste suprir aquilo de que eu preciso,\neu trago diante de Ti o meu trabalho e as minhas contas.',
        'Eu não peço um milagre que me poupe de agir.\nEu peço clareza pra enxergar\no caminho que eu ainda não vi.',
        'Dá-me disciplina pra organizar o que está desorganizado,\ne coragem pra bater à porta certa.',
        'Tira de mim a vergonha da dívida,\ne o peso de sentir que eu falhei.',
        'Onde há porta fechada,\nabre uma janela que eu ainda não estou vendo.',
        'Eu escolho ter paciência comigo mesmo\nenquanto essa solução não chega.',
        'Eu confio que a provisão pode vir de onde eu menos espero.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Sexta Madrugada — A Oração da Paz.'
  },
  6: {
    numero: '6',
    titulo: 'Sexta Madrugada',
    subtitulo: 'Oração da Paz',
    kicker: '7 Améns da Madrugada · Dia 06',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac35bfeb06d96c9272123e" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac35bfeb06d96c9272123e/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-06-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 8 a 10 minutos — boa parte em silêncio.',
        'Este é o dia mais calmo dos sete. Sem pressa nenhuma.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      importante: 'se você faz tratamento para ansiedade, insônia ou depressão, continue fazendo. Esta oração é descanso — não substitui o seu tratamento.',
      antes: 'Feche os olhos, se puder. Respire fundo, sem pressa, três vezes. Você não precisa resolver nada agora — só descansar.',
      preencher: null,
      depois: 'Fique mais um instante em silêncio, só respirando. Se um pensamento insistir em voltar, deixe ele passar — não lute com ele.',
      declaracao: 'Hoje, eu consigo descansar.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor, acalma as águas dentro de mim.\nOnde há pensamento em excesso, põe silêncio.\nOnde há alerta, põe descanso.',
        'Eu solto, nas Tuas mãos,\ntudo que eu não consigo resolver hoje.',
        'Esta noite, eu descanso.\nAmanhã, Tu cuidas.'
      ],
      fechamento: 'Amém.'
    },
    proximo: 'Amanhã: Sétima Madrugada — A Oração da Aliança.'
  },
  7: {
    numero: '7',
    titulo: 'Sétima Madrugada',
    subtitulo: 'Oração da Aliança',
    kicker: '7 Améns da Madrugada · Dia 07',
    videoId: '',
    videoEmbed: {
      html: '<vturb-smartplayer id="vid-6aac39e6eb06d96c92721e01" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 133.33333333333331% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer>',
      scriptSrc: 'https://scripts.converteai.net/3fe9f7a6-c604-479d-b1c4-ccd47fcf7108/players/6aac39e6eb06d96c92721e01/v4/player.js'
    },
    materialPdf: 'assets/pdfs/dia-07-material-apoio.pdf',
    materialLabel: 'Acessar Material de Apoio',
    materialPage: {
      regras: [
        'Horário: entre 4h e 7h da manhã.',
        'Duração: cerca de 9 a 11 minutos, sem pressa.',
        'Hoje você não pede nada novo — você entrega e sela a semana.',
        'Escolha um lugar tranquilo, sozinho, sem interrupções.'
      ],
      antes: 'Pense em cada pessoa que mora com você, ou que você quer proteger com essa bênção. Respire fundo três vezes.',
      preencher: null,
      depois: 'Diga, em voz alta ou em silêncio, o nome de cada pessoa que você quer cobrir com essa bênção.',
      declaracao: 'Eu fiz a minha parte. Agora eu entrego.'
    },
    audioUrl: '',
    disponivel: true,
    confirmaAntes: true,
    oracao: {
      abertura: 'Em nome do Pai, do Filho e do Espírito Santo. Amém.',
      blocos: [
        'Senhor, hoje eu não venho pedir. Eu venho entregar.',
        'Entrego a Ti a conexão que abri no primeiro dia,\ne as mágoas que soltei no segundo.',
        'Entrego a Ti a saúde que apresentei,\ne a corrente que rompi.',
        'Entrego a Ti o trabalho que confiei a Ti,\ne o descanso que recebi.',
        'Cobre a minha casa.\nCobre quem dorme debaixo do meu teto.',
        'Cobre os meus filhos, os meus netos,\ne todos os que ainda virão depois de mim.',
        'Que essa semana seja o começo\nde uma vida de mais fé, mais gratidão, e mais presença.',
        'Eu fiz a minha parte. Agora eu entrego.'
      ],
      fechamento: 'Está selado. Amém.'
    },
    proximo: 'Você concluiu os 7 Améns da Madrugada. Volte a esta oração sempre que quiser selar algo diante de Deus.'
  }
};
