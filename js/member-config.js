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
//
// DE ONDE VÊM OS ÁUDIOS E OS PDFs (27/10/2026). No ar, da Bunny: a Pull Zone
// "setemadrugadas" (rede Volume) busca cada arquivo aqui no site na primeira
// vez que alguém pede, guarda, e dali em diante entrega ela. Não há upload: o
// arquivo continua no repositório, e áudio novo chega com a publicação. Até
// esse dia, o áudio era ~71% da banda da Netlify, que é o que gasta crédito.
//   localhost / 127.0.0.1  -> a pasta local (áudio novo ainda não está no ar,
//                             e a Bunny não teria de onde buscar)
//   qualquer outro         -> a Bunny
// A Bunny guarda por um ano, como o celular: arquivo trocado = NOME novo
// (ex.: dia-01-oracao-v2.mp3). Se a Bunny falhar, o tocador (js/tocador.js)
// busca a cópia que ficou no site.
// Para voltar atrás: BUNNY = '' (1 build).

(function () {
  const PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/member-api';
  const TESTE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1/member-api';
  const BUNNY = 'https://setemadrugadas.b-cdn.net/';

  const noComputador = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.MEMBER_API = noComputador ? TESTE : PRODUCAO;

  // MIDIA.endereco('assets/audio/x.mp3') -> o endereço de onde tocar ou abrir.
  // Só mexe em assets/audio/ e assets/pdfs/; o resto volta como veio.
  window.MIDIA = {
    endereco: (caminho) => (!noComputador && BUNNY && /^assets\/(audio|pdfs)\//.test(caminho || '') ? BUNNY + caminho : caminho)
  };

  if (noComputador) {
    console.info('%c⚠️ BANCO DE TESTE — nenhuma cliente real aqui.', 'background:#7a4a00;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  }
})();
