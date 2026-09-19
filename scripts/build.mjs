import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { sep } from 'node:path';

// Bastidor: nada aqui é usado por nenhuma página (conferido), então publicar
// isso só engorda o deploy e deixa material interno num endereço público.
const foraDoAr = [
  'assets/pdfs/originais', // PDFs originais pesados, já substituídos pelos leves
  'assets/pdfs/build',     // o script que gera os PDFs, com o texto dos materiais
  'assets/fonts',          // .ttf sem uso: as fontes vêm do Google Fonts
];
const publicavel = origem => {
  const caminho = origem.split(sep).join('/');
  return !foraDoAr.some(pasta => caminho === pasta || caminho.startsWith(`${pasta}/`));
};

// Começa do zero: arquivo apagado do projeto não pode sobreviver dentro de dist/
// e continuar aparecendo no teste local como se ainda existisse no ar.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const entry of await readdir('.')) {
  if (entry.endsWith('.html') || ['assets', 'css', 'js'].includes(entry)) {
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
