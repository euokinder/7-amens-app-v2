// Teste das datas do painel administrativo — não abre navegador nem banco.
//
// Em 18/09/2026 o painel mostrou que um cliente tinha acessado o app em
// 17/09, um dia ANTES de ter comprado. A data estava certa no banco: o
// navegador é que lia "2026-09-18" como meia-noite em Londres e recuava três
// horas ao trazer para cá, caindo no dia anterior. Este teste lê os próprios
// ajudantes de data do `js/admin.js` e confere que isso não volta a acontecer
// — inclusive num computador configurado em outro fuso horário.
//
// Como rodar (o `node` desta máquina não está no PATH):
//   "C:\Program Files\nodejs\node.exe" scripts/testa-datas-admin.mjs

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const FUSOS = ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles'];

// Roda uma vez por fuso, em processos separados: o fuso do sistema só pode
// ser escolhido na partida do Node.
if (!process.env.FUSO_DO_TESTE) {
  let algumFalhou = false;
  for (const fuso of FUSOS) {
    console.log(`\n=== computador configurado em ${fuso} ===`);
    const saida = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: fuso, FUSO_DO_TESTE: fuso },
      stdio: 'inherit',
    });
    if (saida.status !== 0) algumFalhou = true;
  }
  console.log(algumFalhou ? '\nHOUVE FALHA' : '\nTodos os fusos passaram.');
  process.exit(algumFalhou ? 1 : 0);
}

// ---------------------------------------------------------------- extração

// Lê o bloco de datas do arquivo de verdade, para que o teste fale sobre o
// código que vai ao ar e não sobre uma cópia que envelhece em silêncio.
const fonte = readFileSync(resolve(raiz, 'js/admin.js'), 'utf8');
const inicio = fonte.indexOf('// --- datas do painel');
const fim = fonte.indexOf('// --- fim das datas do painel');
if (inicio < 0 || fim < 0) {
  console.log('  FALHA não achei o bloco "datas do painel" em js/admin.js');
  process.exit(1);
}
const bloco = fonte.slice(inicio, fim);
const { day, moment, hour } = new Function(`${bloco}\nreturn { day, moment, hour };`)();

// ---------------------------------------------------------------- conferências

let falhou = 0;
const confere = (descricao, obtido, esperado) => {
  if (obtido === esperado) console.log(`  ok   ${descricao} → ${obtido}`);
  else { falhou += 1; console.log(`  FALHA ${descricao} → esperado "${esperado}", veio "${obtido}"`); }
};
const contem = (descricao, obtido, pedaco) => {
  if (String(obtido).includes(pedaco)) console.log(`  ok   ${descricao} → ${obtido}`);
  else { falhou += 1; console.log(`  FALHA ${descricao} → "${obtido}" não contém "${pedaco}"`); }
};

// O caso do print: dia de visita, que o banco guarda sem hora.
confere('dia de visita 2026-09-18', day('2026-09-18'), '18/09/2026');
confere('virada de mês', day('2026-10-01'), '01/10/2026');
confere('virada de ano', day('2027-01-01'), '01/01/2027');
confere('sem data', day(null), '—');

// Campos com hora: 23:16 em Londres é 20:16 em Brasília, ainda dia 18.
confere('compra às 20:16 de Brasília', day('2026-09-18T23:16:00Z'), '18/09/2026');
// 02:30 do dia 19 em Londres ainda é 23:30 do dia 18 aqui.
confere('oração às 23:30 de Brasília', day('2026-09-19T02:30:00Z'), '18/09/2026');

contem('data e hora completas', moment('2026-09-18T23:16:00Z'), '18/09/2026');
contem('hora dentro do data e hora', moment('2026-09-18T23:16:00Z'), '20:16');

confere('entrou no app às 20:20', hour('2026-09-18T23:20:00Z'), '20:20');
confere('madrugada: 04:05', hour('2026-09-18T07:05:00Z'), '04:05');
confere('sem horário', hour(null), '—');

process.exit(falhou ? 1 : 0);
