import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { posix, sep } from 'node:path';

// Bastidor: nada aqui é usado por nenhuma página (conferido), então publicar
// isso só engorda o deploy e deixa material interno num endereço público.
const foraDoAr = [
  'assets/pdfs/originais', // PDFs originais pesados, já substituídos pelos leves
  'assets/pdfs/build',     // o script que gera os PDFs, com o texto dos materiais
  'assets/fonts',          // .ttf sem uso: as fontes vêm do Google Fonts
];
// O funil de upsell da Payt (16/10/2026): páginas soltas, fora do app — sem
// login, sem banco, sem o visual do app. Cada pasta é uma página
// (index.html + images/), servida em setemadrugadas.com.br/<pasta>/.
// Pasta nova do funil só vai ao ar se entrar nesta lista.
const funil = ['upsell-01', 'downsell-01', 'upsell-02', 'upsell-03'];

const publicavel = origem => {
  const caminho = origem.split(sep).join('/');
  return !foraDoAr.some(pasta => caminho === pasta || caminho.startsWith(`${pasta}/`));
};

// Começa do zero: arquivo apagado do projeto não pode sobreviver dentro de dist/
// e continuar aparecendo no teste local como se ainda existisse no ar.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const entry of await readdir('.')) {
  if (entry.endsWith('.html') || ['assets', 'css', 'js', ...funil].includes(entry)) {
    await cp(entry, `dist/${entry}`, { recursive: true, filter: publicavel });
  }
}

// CSS e JS ficam um ano guardados no celular (netlify.toml). Para a cliente
// receber a versão nova logo depois de publicar, cada página passa a pedir o
// arquivo com uma impressão digital do conteúdo (css/styles.css?v=1a2b3c4d5e):
// mudou o arquivo, muda a impressão, e o celular busca de novo. O ?v= escrito à
// mão nos .html é trocado aqui, então não precisa mais ser aumentado.
const htmlDentroDe = async pasta => {
  const achados = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const caminho = `${pasta}/${item.name}`;
    if (item.isDirectory()) achados.push(...await htmlDentroDe(caminho));
    else if (item.name.endsWith('.html')) achados.push(caminho);
  }
  return achados;
};
const impressoes = new Map();
const impressao = async arquivo => {
  if (!impressoes.has(arquivo)) {
    const conteudo = await readFile(`dist/${arquivo}`).catch(() => null);
    impressoes.set(arquivo, conteudo && createHash('sha256').update(conteudo).digest('hex').slice(0, 10));
  }
  return impressoes.get(arquivo);
};
const referencia = /(\s(?:src|href)=")(\/?(?:css|js)\/[^"?#]+\.(?:css|js))(?:\?[^"#]*)?"/g;
for (const caminho of await htmlDentroDe('dist')) {
  const html = await readFile(caminho, 'utf8');
  const pasta = posix.dirname(caminho.slice('dist/'.length));
  const trocas = new Map();
  for (const [, , endereco] of html.matchAll(referencia)) {
    const arquivo = endereco.startsWith('/') ? endereco.slice(1) : posix.join(pasta, endereco);
    const hash = await impressao(arquivo);
    if (hash) trocas.set(endereco, hash);
    else console.warn(`AVISO: ${caminho} aponta para ${endereco}, que não existe`);
  }
  if (trocas.size) {
    await writeFile(caminho, html.replace(referencia, (inteiro, antes, endereco) =>
      trocas.has(endereco) ? `${antes}${endereco}?v=${trocas.get(endereco)}"` : inteiro));
  }
}

// O "não indexe" é só para o ambiente de validação. Na produção ele apagaria
// setemadrugadas.com.br do Google. SITE_NAME e URL são preenchidos pela própria
// Netlify em toda build; se a build não souber quem é, escreve o noindex —
// esconder por engano é menos grave do que expor o site de validação por engano.
const ehProducao = process.env.SITE_NAME === '7madrugadas'
  || (process.env.URL || '').includes('setemadrugadas.com.br');
if (!ehProducao) {
  await writeFile('dist/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
}
