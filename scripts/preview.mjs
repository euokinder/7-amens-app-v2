// Servidor local para ver o app sem gastar deploy na Netlify.
//
//   node scripts/build.mjs && node scripts/preview.mjs
//
// Serve a pasta dist/ em http://localhost:3000
// Sem dependencia externa: usa apenas o Node.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const porta = Number(process.env.PORT) || 3000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
};

async function arquivoDe(caminhoUrl) {
  // Impede sair da pasta dist via ../
  const limpo = decodeURIComponent(caminhoUrl.split('?')[0].split('#')[0]);
  const alvo = resolve(join(raiz, limpo));
  if (alvo !== raiz && !alvo.startsWith(raiz + sep)) return null;

  try {
    const info = await stat(alvo);
    if (info.isDirectory()) return arquivoDe(join(limpo, 'index.html'));
    return alvo;
  } catch {
    // Permite /login em vez de /login.html
    if (!extname(alvo)) {
      try {
        await stat(alvo + '.html');
        return alvo + '.html';
      } catch {}
    }
    return null;
  }
}

createServer(async (req, res) => {
  const alvo = await arquivoDe(req.url || '/');

  if (!alvo) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Nao encontrado em dist/. Rodou o build?</p>');
    return;
  }

  try {
    const conteudo = await readFile(alvo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(conteudo);
  } catch (erro) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro ao ler o arquivo: ' + erro.message);
  }
}).listen(porta, () => {
  console.log(`Preview local em http://localhost:${porta}`);
  console.log(`Servindo: ${raiz}`);
});
