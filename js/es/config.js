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
    // ⏳ O canal de suporte em espanhol ainda é decisão do Caio (docs/app-es.md).
    // Provisório: o e-mail da PK Scale, o mesmo da página /amenes-gracias.
    soporte: 'mailto:contact@pkscale.com?subject=Ayuda%20-%207%20Amenes%20de%20la%20Madrugada',
  };

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE (LATAM) — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
