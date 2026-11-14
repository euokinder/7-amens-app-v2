// Configuração do app em inglês (7 Amens Before Dawn).
// Arquivo só do app dos EUA: nenhuma página do Brasil nem do espanhol carrega
// este arquivo.
//
// O teste local (localhost) fala com o banco de TESTE, como no app brasileiro.
// Qualquer outro endereço fala com a produção.
(function () {
  const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/en-api';
  const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/en-api';
  const noComputador = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // ⏳ EUA: PROVISÓRIO (Arthur, 14/11/2026): enquanto o suporte americano não
  // existe, o inglês usa o e-mail e o WhatsApp da LATAM (os mesmos de
  // js/es/config.js). Quando o Arthur mandar os contatos dos EUA, trocar aqui.
  // ESTE É O ÚNICO LUGAR onde os contatos moram: as telas leem
  // daqui (o card "Contact us" e o do WhatsApp no início, a entrada, o
  // reembolso e a Lucy). Enquanto estiverem vazios:
  //   - o card "Contact us" do início continua na tela e abre a Lucy (o chat);
  //   - o card do WhatsApp, o bloco "Would you rather talk to a person?" da
  //     entrada, os botões de WhatsApp/e-mail da Lucy e do reembolso e o link
  //     de ajuda do portão ("Need help?") ficam escondidos, em vez de abrir um
  //     link quebrado.
  // Preencher é só escrever aqui (1 build). Cada contato aparece sozinho.
  const CORREO = 'soporte@pkscale.com';         // ⏳ EUA: provisório, o da LATAM
  const WHATSAPP_ESCRITO = '+55 88 99443-2257';  // ⏳ EUA: provisório, o da LATAM
  const WHATSAPP_NUMERO = '5588994432257';       // ⏳ EUA: provisório, o da LATAM (só os dígitos, com o país)

  const whatsapp = texto => (WHATSAPP_NUMERO
    ? `https://wa.me/${WHATSAPP_NUMERO}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
    : '');
  const mailto = CORREO ? `mailto:${CORREO}?subject=${encodeURIComponent('Help - 7 Amens Before Dawn')}` : '';

  window.AMENES_CONFIG = {
    api: noComputador ? TESTE : PRODUCAO,
    // O reembolso em um toque: função própria, separada da en-api. Só a
    // /en-refund usa.
    reembolso: (noComputador ? TESTE : PRODUCAO).replace(/en-api$/, 'en-refund'),
    // A Lucy (provisório; no espanhol, Lucía), o chat de suporte
    // (js/en/lucia.js). Apagar a linha `chat` tira a Lucy de todas as telas
    // (com 1 build). Desligar SEM build é no banco: en_chat_config.ligado =
    // false (ela passa a mostrar o WhatsApp e o e-mail, se existirem).
    // luciaFoto: a foto dela (vazia = a letra "L").
    chat: (noComputador ? TESTE : PRODUCAO).replace(/en-api$/, 'en-chat'),
    luciaFoto: '',
    // O e-mail do suporte, escrito por extenso nas telas (para quem não tem
    // app de e-mail no celular). Vazio = a linha some.
    correo: CORREO,
    // O melhor link de contato que existir: o e-mail; sem ele, o WhatsApp;
    // sem os dois, vazio. Outras telas (dia, lista, extras, ofertas) põem
    // este link no "Need help?" do portão; vazio, o js/en/sesion.js esconde.
    soporte: mailto || whatsapp('Hi, I need help with my 7 Amens Before Dawn app.'),
    // whatsapp(texto) devolve o link com a mensagem já escrita para ela, ou
    // '' enquanto não houver número.
    whatsappEscrito: WHATSAPP_NUMERO ? WHATSAPP_ESCRITO : '',
    whatsapp,
    temSuporte: Boolean(CORREO || WHATSAPP_NUMERO),
  };

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE (EUA) — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
