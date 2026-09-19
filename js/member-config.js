// Qual banco este site está usando.
//
// ANTES: havia uma linha só, apontando para produção. Como o site local
// carrega o mesmo arquivo, abrir o site no computador falava com o banco
// das clientes reais. Testar a tela era seguro; testar qualquer coisa que
// GRAVA dado não era — era escrever na vida real achando que era teste.
//
// AGORA: o endereço é escolhido pelo próprio navegador.
//   localhost / 127.0.0.1  -> banco de TESTE  (ninguém dentro)
//   qualquer outro         -> banco de PRODUÇÃO (clientes reais)
//
// Produção não muda em nada: o site no ar nunca é "localhost", então cai
// sempre no endereço de sempre. O desvio só existe na sua máquina.
//
// Para conferir em qual você está, abra o console do navegador: o site
// avisa em voz alta quando está no banco de teste.

(function () {
  const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/member-api';
  const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/member-api';

  const noComputador = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.MEMBER_API = noComputador ? TESTE : PRODUCAO;

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
