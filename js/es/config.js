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
    // O suporte em espanhol é soporte@pkscale.com (decisão do Caio, 08/11/2026).
    // O endereço também aparece ESCRITO no card "Escríbenos" (es.html) e na
    // tela de entrar (es-entrar.html), para quem não tem app de e-mail no
    // celular: trocar aqui é trocar lá também (e no es-reembolso.html).
    correo: 'soporte@pkscale.com',
    soporte: 'mailto:soporte@pkscale.com?subject=Ayuda%20-%207%20Amenes%20de%20la%20Madrugada',
  };

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE (LATAM) — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
