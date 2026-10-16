import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { sep } from 'node:path';

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

// O "não indexe" é só para o ambiente de validação. Na produção ele apagaria
// setemadrugadas.com.br do Google. SITE_NAME e URL são preenchidos pela própria
// Netlify em toda build; se a build não souber quem é, escreve o noindex —
// esconder por engano é menos grave do que expor o site de validação por engano.
const ehProducao = process.env.SITE_NAME === '7madrugadas'
  || (process.env.URL || '').includes('setemadrugadas.com.br');
if (!ehProducao) {
  await writeFile('dist/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
}
