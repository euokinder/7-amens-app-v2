// Prova de ponta a ponta do app em inglês no banco de TESTE (wyiqwsgfictcfkytldnu).
// Chama as funções en-api, en-refund e en-chat publicadas no projeto de TESTE,
// uma chamada por vez, como o navegador faria em http://localhost:3500.
// NUNCA aponta para a produção: o endereço está fixo abaixo e o script recusa outro.
//
// Rodar:  "C:\Program Files\nodejs\node.exe" supabase/en/testes/prova-http.mjs
// Contas de teste (criadas à mão no banco de teste, e-mails falsos):
//   teste.en@exemplo.com        Mary Test: app + Arcanjos + Cântico, administradora
//   teste.en.basico@exemplo.com Ann Test: só o app
// Ao final, o dia 1 marcado pela prova é desmarcado e as sessões abertas aqui são fechadas.
// São 14 chamadas no total, uma depois da outra.

const BASE = 'https://wyiqwsgfictcfkytldnu.supabase.co/functions/v1';
if (!BASE.includes('wyiqwsgfictcfkytldnu')) throw new Error('Só o banco de TESTE.');
const ORIGIN = 'http://localhost:3500';
const TZ = 'America/New_York';

let falhas = 0;
const confere = (nome, ok, extra = '') => {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}${extra ? ` | ${extra}` : ''}`);
};

async function chamar(funcao, corpo, sessao, metodo = 'POST') {
  const headers = { Origin: ORIGIN, 'Content-Type': 'application/json' };
  if (sessao) headers['x-en-session'] = sessao;
  const r = await fetch(`${BASE}/${funcao}`, { method: metodo, headers, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { bruto: texto.slice(0, 200) }; }
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), json };
}
const api = (corpo, sessao) => chamar('en-api', { tz: TZ, ...corpo }, sessao);
const resumo = j => JSON.stringify({
  nombre: j?.cliente?.nombre, hoy: j?.hoy, zona: j?.zona, abierto: j?.abierto, completados: j?.completados,
  acceso_hasta: j?.acceso_hasta, extras: j?.extras, cantico: j?.cantico, oferta: j?.oferta ? j.oferta.campaign_key : null,
});

// 0. CORS: o preflight do localhost passa.
const pre = await chamar('en-api', null, null, 'OPTIONS');
confere('preflight OPTIONS (localhost)', pre.status === 204 && pre.cors === ORIGIN, `status ${pre.status}, allow-origin ${pre.cors}`);

// 1. Login da Mary.
const login = await api({ action: 'login', email: 'teste.en@exemplo.com' });
const token = login.json?.token;
confere('login teste.en', login.status === 200 && /^[a-f0-9]{64}$/.test(token || ''), `status ${login.status} ${resumo(login.json)}`);
confere('acceso_hasta em inglês (Month D, YYYY)', /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(login.json?.acceso_hasta || ''), login.json?.acceso_hasta);
confere('extras da Mary = arcangeles + cantico', JSON.stringify(login.json?.extras) === '["arcangeles","cantico"]');

// 2. Sessão com o cabeçalho x-en-session.
const s1 = await api({ action: 'session' }, token);
confere('session', s1.status === 200 && s1.json?.abierto >= 1, `status ${s1.status} ${resumo(s1.json)}`);

// 3. Marca o dia 1 e confere na sessão.
const p1 = await api({ action: 'progress', day: 1, done: true }, token);
confere('progress dia 1 = feito', p1.status === 200 && (p1.json?.completados || []).includes(1), `status ${p1.status} completados ${JSON.stringify(p1.json?.completados)}`);
const s2 = await api({ action: 'session' }, token);
confere('session mostra o dia 1 concluído', s2.status === 200 && (s2.json?.completados || []).includes(1), `completados ${JSON.stringify(s2.json?.completados)}`);

// 4. Dia trancado (o 7, no primeiro dia) vem recusado, em inglês.
const p7 = await api({ action: 'progress', day: 7, done: true }, token);
confere('dia 7 trancado (409, em inglês)', p7.status === 409 && /not open yet/.test(p7.json?.error || ''), `status ${p7.status} "${p7.json?.error}"`);

// 5. Desmarca o dia 1 (a tela começa limpa).
const p0 = await api({ action: 'progress', day: 1, done: false }, token);
confere('progress dia 1 desfeito', p0.status === 200 && !(p0.json?.completados || []).includes(1), `completados ${JSON.stringify(p0.json?.completados)}`);

// 6. O painel: a Mary é administradora.
const adm = await api({ action: 'admin_dashboard' }, token);
confere('admin_dashboard', adm.status === 200 && Array.isArray(adm.json?.customers), `status ${adm.status}, clientes ${adm.json?.customers?.length}, campanhas ${adm.json?.campaigns?.length}`);

// 7. A Ann (só o app) entra e não tem extras.
const ann = await api({ action: 'login', email: 'teste.en.basico@exemplo.com' });
confere('login teste.en.basico sem extras', ann.status === 200 && JSON.stringify(ann.json?.extras) === '[]', `status ${ann.status} ${resumo(ann.json)}`);

// 8. E-mail desconhecido: segue para o resgate, em inglês.
const nao = await api({ action: 'login', email: 'ninguem.en@exemplo.com' });
confere('login desconhecido -> siguiente: nombre', nao.status === 403 && nao.json?.siguiente === 'nombre', `status ${nao.status} "${nao.json?.error}"`);

// 9. en-refund: a lista de compras de um e-mail (vazia até o checkout existir).
const ref = await chamar('en-refund', { action: 'compras', email: 'teste.en@exemplo.com' });
confere('en-refund compras', ref.status === 200 && Array.isArray(ref.json?.compras), `status ${ref.status} ${JSON.stringify(ref.json)}`);

// 10. en-chat: sem a chave (EN_ANTHROPIC_API_KEY) e com o chat desligado, responde "desligado".
const chat = await chamar('en-chat', { mensaje: 'Hello, I cannot find my prayers.', pagina: 'app' }, token);
confere('en-chat desligado sem erro', chat.status === 200 && (chat.json?.desligado === true || typeof chat.json?.resposta === 'string'), `status ${chat.status} ${JSON.stringify(chat.json)}`);

// 11. Fecha as sessões abertas pela prova.
const out1 = await api({ action: 'logout' }, token);
const out2 = ann.json?.token ? await api({ action: 'logout' }, ann.json.token) : { status: 0 };
confere('logout das duas sessões', out1.status === 200 && out2.status === 200, `${out1.status} / ${out2.status}`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
