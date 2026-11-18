/**
 * Leitor do Gmail do suporte -> pedidos de reembolso no painel (18/11/2026).
 *
 * Roda dentro do Gmail de UMA caixa de suporte (Google Apps Script), a cada
 * 10 minutos. Só LÊ: não responde, não arquiva, não marca como lido, não mexe
 * em marcador. Pega os e-mails que chegaram, tira os da própria caixa e os de
 * robôs (plataformas, Brevo, a automação do Lucas...), corta a citação dos
 * e-mails anteriores e manda em lote para a função suporte-email do Supabase.
 * Lá a IA separa o que é pedido de reembolso e grava no painel.
 *
 * Lembra até onde já leu (propriedades do script). A primeira vez lê os
 * últimos 7 dias (a "varredura inicial": o que já foi devolvido é descartado).
 *
 * INSTALAR (guia passo a passo: docs/reembolso-por-email.md):
 *   1. script.google.com, logado NA CAIXA de suporte -> Novo projeto -> colar este arquivo;
 *   2. Configurações do projeto -> Propriedades do script:
 *        CAIXA                = soporte   (LATAM)   ou   eua   (EUA)
 *        SUPORTE_EMAIL_TOKEN  = o mesmo valor do segredo no Supabase
 *        IGNORAR              = (opcional) endereços ou domínios a mais para pular, separados por vírgula
 *        URL                  = (opcional) só para apontar para o banco de teste
 *   3. Escolher a função "instalar" e clicar em Executar (autorizar a leitura do Gmail).
 * DESLIGAR: executar "desinstalar" (apaga o gatilho). Nada mais muda.
 *
 * O token NUNCA fica escrito aqui: este arquivo está num repositório público.
 */

var URL_PRODUCAO = 'https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/suporte-email';
var LOTE = 10;                       // e-mails por chamada (a função aceita até 20)
var TEMPO_MAXIMO_MS = 4.5 * 60000;   // o Google corta em 6 min; para antes e continua na próxima volta
var SOBREPOSICAO_MS = 60 * 60000;    // relê a última hora (e-mail que chega atrasado), sem mandar de novo
var PRIMEIRA_VEZ_DIAS = 7;
var TENTATIVAS = 3;                  // e-mail que falha 3 vezes é deixado para trás (o resto não trava)

// Remetentes que nunca são cliente: plataformas, serviços e robôs.
var ROBOS_DOMINIOS = [
  'whop.com', 'digistore24.com', 'kashpay', 'brevo.com', 'sendinblue.com', 'brevosend.com', 'hub.la', 'hubla',
  'payt.com.br', 'stripe.com', 'paypal.com', 'google.com', 'facebookmail.com', 'meta.com',
  'supabase.io', 'supabase.com', 'netlify.com', 'github.com', 'bunny.net', 'vturb', 'postmarkapp.com',
  'anthropic.com', 'zoom.us', 'calendly.com', 'mailchimp', 'mcsv.net', 'amazonses.com',
];
var ROBO_LOCAL = /(^|[._+-])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|bounce[sd]?|alerts?)([._+-]|$)/i;

function instalar() {
  var props = PropertiesService.getScriptProperties();
  conferirPropriedades_(props);
  if (!props.getProperty('INSTALADO_EM')) props.setProperty('INSTALADO_EM', String(Date.now()));
  var ja = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'ler'; });
  if (!ja) ScriptApp.newTrigger('ler').timeBased().everyMinutes(10).create();
  Logger.log('Instalado. Lendo agora a primeira vez (os últimos ' + PRIMEIRA_VEZ_DIAS + ' dias).');
  ler();
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ler') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Desligado: o robô não lê mais esta caixa.');
}

function conferirPropriedades_(props) {
  var caixa = props.getProperty('CAIXA');
  if (caixa !== 'soporte' && caixa !== 'eua') throw new Error('Falta a propriedade CAIXA (soporte ou eua).');
  if (!props.getProperty('SUPORTE_EMAIL_TOKEN')) throw new Error('Falta a propriedade SUPORTE_EMAIL_TOKEN.');
}

function ler() {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(1000)) return; // a volta anterior ainda está rodando
  try {
    lerDeVerdade_();
  } finally {
    trava.releaseLock();
  }
}

function lerDeVerdade_() {
  var inicio = Date.now();
  var props = PropertiesService.getScriptProperties();
  conferirPropriedades_(props);
  var caixa = props.getProperty('CAIXA');
  var token = props.getProperty('SUPORTE_EMAIL_TOKEN');
  var url = props.getProperty('URL') || URL_PRODUCAO;
  var instaladoEm = Number(props.getProperty('INSTALADO_EM')) || Date.now();
  if (!props.getProperty('INSTALADO_EM')) props.setProperty('INSTALADO_EM', String(instaladoEm));
  var cursor = Number(props.getProperty('CURSOR')) || (instaladoEm - PRIMEIRA_VEZ_DIAS * 86400000);
  var vistos = lerJson_(props, 'VISTOS');
  var falhas = lerJson_(props, 'FALHAS');

  var eu = Session.getEffectiveUser().getEmail().toLowerCase();
  var meus = [eu].concat(GmailApp.getAliases().map(function (a) { return a.toLowerCase(); }));
  var extras = (props.getProperty('IGNORAR') || '').toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(String);

  // Tudo o que chegou depois do cursor (menos a última hora de folga), fora enviados, rascunhos, spam e lixeira.
  var desde = Math.floor((cursor - SOBREPOSICAO_MS) / 1000);
  var consulta = '-in:sent -in:drafts -in:spam -in:trash -in:chats after:' + desde;
  var mensagens = [];
  for (var pagina = 0; pagina < 5; pagina++) {
    var conversas = GmailApp.search(consulta, pagina * 100, 100);
    conversas.forEach(function (conversa) {
      conversa.getMessages().forEach(function (m) {
        var quando = m.getDate().getTime();
        if (quando < cursor - SOBREPOSICAO_MS || vistos[m.getId()]) return;
        mensagens.push({ m: m, quando: quando, conversa: conversa.getId() });
      });
    });
    if (conversas.length < 100) break;
  }
  mensagens.sort(function (a, b) { return a.quando - b.quando; });

  // Separa o que vai para a função do que é pulado aqui mesmo (da caixa, robô).
  var fila = [];
  mensagens.forEach(function (x) {
    var de = enderecoDe_(x.m.getFrom());
    x.pular = !de || meus.indexOf(de) >= 0 || eRobo_(de, extras) || eAutomatico_(x.m);
    x.de = de;
    fila.push(x);
  });

  var enviados = 0;
  var parouEm = null; // o primeiro e-mail que ficou para a próxima volta
  var i = 0;
  while (i < fila.length) {
    if (Date.now() - inicio > TEMPO_MAXIMO_MS) { parouEm = fila[i].quando; break; }
    if (fila[i].pular) { vistos[fila[i].m.getId()] = fila[i].quando; i++; continue; }
    // Um lote: até LOTE e-mails seguidos, sem misturar varredura inicial com e-mail novo.
    var varredura = fila[i].quando < instaladoEm;
    var lote = [];
    var j = i;
    while (j < fila.length && lote.length < LOTE) {
      if (!fila[j].pular) {
        if ((fila[j].quando < instaladoEm) !== varredura) break;
        lote.push(fila[j]);
      }
      j++;
    }
    var resposta = enviar_(url, token, caixa, varredura, lote, eu);
    if (!resposta) { parouEm = fila[i].quando; break; } // a função não respondeu: tenta tudo de novo na próxima volta
    enviados += lote.length;
    var porId = {};
    (resposta.resultados || []).forEach(function (r) { porId[r.id] = r; });
    var travou = false;
    for (var k = i; k < j; k++) {
      var x = fila[k];
      var r = porId[x.m.getId()];
      if (x.pular || (r && r.situacao !== 'erro')) { vistos[x.m.getId()] = x.quando; continue; }
      // Deu erro (a IA ou o banco): tenta de novo, até TENTATIVAS vezes.
      falhas[x.m.getId()] = (falhas[x.m.getId()] || 0) + 1;
      if (falhas[x.m.getId()] >= TENTATIVAS) { vistos[x.m.getId()] = x.quando; continue; }
      if (!travou) { parouEm = x.quando; travou = true; }
    }
    if (travou) break;
    i = j;
  }

  // O cursor anda até onde tudo foi resolvido.
  var novoCursor = parouEm !== null ? parouEm : (fila.length ? Math.max(cursor, fila[fila.length - 1].quando + 1) : cursor);
  if (parouEm === null && !fila.length) novoCursor = Math.max(cursor, Date.now() - SOBREPOSICAO_MS);
  props.setProperty('CURSOR', String(Math.max(cursor, novoCursor)));
  // Só guarda o que ainda pode reaparecer na sobreposição (cabe no limite de 9 KB).
  var limite = Math.max(cursor, novoCursor) - 2 * SOBREPOSICAO_MS;
  Object.keys(vistos).forEach(function (id) { if (vistos[id] < limite) delete vistos[id]; });
  Object.keys(falhas).forEach(function (id) { if (vistos[id]) delete falhas[id]; });
  props.setProperty('VISTOS', JSON.stringify(vistos));
  props.setProperty('FALHAS', JSON.stringify(falhas));
  Logger.log('Lidos ' + fila.length + ', enviados ' + enviados + (parouEm !== null ? ' (continua na próxima volta)' : '') + '.');
}

function enviar_(url, token, caixa, varredura, lote, eu) {
  var corpo = {
    caixa: caixa,
    varredura_inicial: varredura,
    emails: lote.map(function (x) {
      return {
        id: x.m.getId(),
        de: x.de,
        assunto: x.m.getSubject() || '',
        texto: semCitacao_(x.m.getPlainBody() || '').slice(0, 8000),
        recebido_em: new Date(x.quando).toISOString(),
        link: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(eu) + '#all/' + x.conversa,
      };
    }),
  };
  try {
    var r = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-suporte-token': token },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() !== 200) {
      Logger.log('A função respondeu ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
      return null;
    }
    return JSON.parse(r.getContentText());
  } catch (e) {
    Logger.log('Não deu para falar com a função: ' + e);
    return null;
  }
}

function enderecoDe_(from) {
  var m = String(from || '').match(/<([^>]+)>/);
  var endereco = (m ? m[1] : String(from || '')).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco) ? endereco : '';
}

function eRobo_(de, extras) {
  var partes = de.split('@');
  var dominio = partes[1] || '';
  if (ROBO_LOCAL.test(partes[0])) return true;
  var lista = ROBOS_DOMINIOS.concat(extras);
  return lista.some(function (item) {
    if (item.indexOf('@') >= 0) return de === item;
    return dominio === item || dominio.slice(-(item.length + 1)) === '.' + item || dominio.indexOf(item) >= 0;
  });
}

// Respostas automáticas, listas e boletins: não são a cliente escrevendo.
function eAutomatico_(m) {
  var auto = String(m.getHeader('Auto-Submitted') || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  var precedencia = String(m.getHeader('Precedence') || '').toLowerCase();
  if (precedencia === 'bulk' || precedencia === 'list' || precedencia === 'junk') return true;
  return Boolean(m.getHeader('List-Unsubscribe'));
}

// A mesma regra da função: para no começo da citação do e-mail anterior.
function semCitacao_(bruto) {
  var inicios = [
    /^\s*-{2,}\s*(original message|mensaje original|mensagem original|forwarded message|mensaje reenviado)\s*-{2,}/i,
    /^\s*(on|el|em|le)\b.{0,200}\b(wrote|escribió|escreveu|a écrit)\s*:?\s*$/i,
    /\b(wrote|escribió|escreveu)\s*:\s*$/i,
    /^\s*(from|de|von)\s*:\s.*$/i,
    /^\s*_{10,}\s*$/,
    /^\s*enviado desde mi (iphone|android|celular|móvil|samsung)/i,
    /^\s*sent from my (iphone|android|phone|samsung)/i,
  ];
  var linhas = bruto.replace(/\r\n?/g, '\n').split('\n');
  var ficam = [];
  for (var i = 0; i < linhas.length; i++) {
    var linha = linhas[i];
    if (inicios.some(function (re) { return re.test(linha); })) break;
    if (/^\s*>/.test(linha)) continue;
    ficam.push(linha);
  }
  return ficam.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function lerJson_(props, chave) {
  try { return JSON.parse(props.getProperty(chave) || '{}') || {}; } catch (e) { return {}; }
}
