import { cp, mkdir, readdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const entry of await readdir('.')) {
  if (entry.endsWith('.html') || ['assets', 'css', 'js'].includes(entry)) {
    await cp(entry, `dist/${entry}`, { recursive: true });
  }
}
