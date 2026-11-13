// Configuração do app em espanhol (7 Amenes de la Madrugada).
// Arquivo só da LATAM: nenhuma página do Brasil carrega este arquivo.
//
// O teste local (localhost) fala com o banco de TESTE, como no app brasileiro.
// Qualquer outro endereço fala com a produção.
(function () {
  const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/latam-api';
  const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/latam-api';
  const noComputador = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.AMENES_CONFIG = {
    api: noComputador ? TESTE : PRODUCAO,
    // O reembolso em um toque (13/11/2026): função própria, separada da
    // latam-api. Só a /es-reembolso usa.
    reembolso: (noComputador ? TESTE : PRODUCAO).replace(/latam-api$/, 'latam-reembolso'),
    // O suporte em espanhol é soporte@pkscale.com (decisão do Caio, 08/11/2026).
    // O endereço também aparece ESCRITO no card "Escríbenos" (es.html) e na
    // tela de entrar (es-entrar.html), para quem não tem app de e-mail no
    // celular: trocar aqui é trocar lá também (e no es-reembolso.html).
    correo: 'soporte@pkscale.com',
    soporte: 'mailto:soporte@pkscale.com?subject=Ayuda%20-%207%20Amenes%20de%20la%20Madrugada',
    // O WhatsApp de suporte da LATAM (pedido do Caio em 10/11/2026). É número
    // do Brasil: no link vai com o país (55), senão não abre fora do Brasil.
    // Aparece na entrada (/es-entrar, em todos os passos) e no início (/es: o
    // cartão do WhatsApp e o link do portão). Trocar aqui troca nos dois.
    // whatsapp(texto) devolve o link com a mensagem já escrita para ela.
    whatsappEscrito: '+55 88 99443-2257',
    whatsapp: texto => 'https://wa.me/5588994432257' + (texto ? '?text=' + encodeURIComponent(texto) : ''),
  };

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE (LATAM) — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
