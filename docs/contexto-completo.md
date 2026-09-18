# Contexto histórico completo — 7 Améns da Madrugada

_Consolidado em 2026-09-18 a partir das conversas anteriores (ChatGPT/Codex). Referência de consulta, não leitura obrigatória por sessão. O essencial está em `CLAUDE.md`._

## 1. Produto central
"7 Améns da Madrugada" não é área de membros com PDFs — é um app católico simples que conduz a cliente por uma jornada. 7 madrugadas, 7 orações, 1 por dia: Pai Nosso Completo · Perdão · Cura · Libertação · Prosperidade · Paz · Aliança. Horário 4h–7h, em voz alta, áudio guiado. Perdeu um dia: não reinicia e não dobra — continua do ponto onde parou. Pós-jornada, materiais como o Pai Nosso seguem em uso separado.

## 2. UX para mulher mais velha
40+/50+, senhoras maduras. Letras grandes, sans-serif, alto contraste, poucos elementos competindo, cards grandes, linguagem claríssima, nada com cara de software complicado. Referência mental: "Netflix de orações", não dashboard de SaaS. Ela abre, entende na hora onde clicar, continua a jornada. Visual aprovado: creme + dourado + preto, bastante respiro, cards bem separados. Regra: revisar visualmente contra texto sobreposto e elemento pequeno.

## 3. Frontend existente (intencionalmente simples)
Projeto `7-amens-da-madrugada` em HTML/CSS/JS puro. Arquivos vistos: `index.html`, `novena.html`, `dia.html`, `desatadora.html`, `app.js`, `dias.js`, `materiais.js`, `mensagens.js`, `novena-desatadora.js`. **Não foi decidido reescrever em React/Next.** Plano: preservar o frontend e colocar backend por trás.

## 4. Home como hub
Cards: 7 Orações Sagradas · Mensagem do Dia · Pai Nosso · Novena Desatadora dos Nós · Lojinha. Cards inteligentes: tem direito → entra; não tem → "Desbloquear". O app vira consumo + venda de complementos sem mandar a cliente para página externa.

## 5. Login deliberadamente simples
Sem senha, sem código no e-mail, sem OTP, sem confirmação. Digita o e-mail da compra e entra. Risco de compartilhamento aceito conscientemente — a fricção de auth tradicional é pior para esse público. O e-mail é a identidade. O objetivo não é segurança bancária: é saber quem comprou, o que possui e onde parou.

## 6. Regra comercial
Só quem comprou o principal entra. O principal libera todo o conteúdo base, acesso vitalício. Adicionais são entitlements individuais — pode ter principal + extra A sem extra B.

## 7. Reembolsos
Refund do principal → perde acesso ao app. Refund de extra → mantém o app, perde só o extra. Compra de adicional Y → libera Y e para de oferecer Y, idealmente já na próxima sincronização.

## 8. Progresso na nuvem
Trocou de aparelho, o progresso continua. Saiu-se do `localStorage` como fonte principal para progresso ligado ao e-mail/usuária no Supabase: em que dia está, o que concluiu, estados dos módulos. Abre espaço para personalização futura.

## 9. Arquitetura
Netlify hospeda frontend/deploy · Supabase mantém Postgres, usuários, acessos, progresso e lógica · Hubla é a fonte da verdade de compras/reembolsos via webhook. Webhooks processados preferencialmente por **Supabase Edge Functions**, não pela Netlify.

## 10. Primeira validação sem Hubla
Decisão explícita: não esperar a Hubla. Criar usuários/compras/acessos manualmente no Supabase, validar login + entitlement + progresso, e só depois conectar a Hubla. Integração de pagamento não pode virar bloqueio para testar o produto.

## 11. Estrutura de dados
`profiles` (a cliente) · `products` (catálogo) · `entitlements` (o que cada uma possui) · `progress` (onde parou) · `hubla_events` (eventos recebidos) · `webhook_logs` (diagnóstico). Webhooks idempotentes: evento repetido não duplica produto nem deixa o banco inconsistente. RLS obrigatório.

## 12. Fluxo Hubla
compra → webhook → backend identifica e-mail + produto + status → Supabase cria/atualiza direito → app consulta direitos → card libera. Reembolso percorre o mesmo caminho removendo/desativando o entitlement certo: principal bloqueia o app, extra bloqueia só o conteúdo.

## 13. Netlify e créditos
Créditos do Free já zerados; plano ~US$9 em discussão. Não desperdiçar deploy de produção em alteração pequena — muita coisa (Supabase, login, regras, progresso, banco) testa-se localmente. URL externa só é necessária para webhook real (preview/túnel/deploy). Manter um único projeto com branch `development` para teste e `main` para produção, em vez de criar sites novos para fugir de créditos.

## 14. Arquitetura de longo prazo
GitHub (código/histórico) + Supabase (dados/acessos) + Netlify (entrega) + Hubla (eventos comerciais). Não ficar preso a ChatGPT nem a Claude: começar uma alteração em um, continuar no outro sobre o mesmo repositório.

## 15. Documentação no repositório
A IA não deve precisar lembrar da conversa para entender o negócio — o projeto explica as próprias regras. `README.md`, documentação de arquitetura/regras e `CLAUDE.md` com: principal dá acesso ao app; refund do principal bloqueia tudo; refund de extra bloqueia só o extra; progresso no Supabase; Hubla controla compras.

## 16. PDFs e materiais
Extensão direta do app. "Comece Aqui" ensina a usar a jornada sem complicação — abordagens muito técnicas foram rejeitadas; o pedido foi "que até uma criança entenda". Padrão aprovado: conteúdo ilustrativo, frases curtas, fonte grande, instruções práticas. No Pai Nosso personalizado: aramaico de um lado, português do outro, aparência de manuscrito antigo, sem virar material acadêmico. Frase pedida explicitamente: "Agora vem a parte que arrancaram da que conhecemos". Blocos como "Pronto." e explicações técnicas foram removidos.

## 17. Imagens
Realistas, still-life religioso, luz quente/dourada, sem texto embutido, composição preparada para receber título por cima. Cards das orações: mãos acendendo vela, gestos simbólicos de perdão etc. **Sombra/gradiente forte na região onde o texto entra** — no print do site o texto não destacava o suficiente. Aplicar aos oito conteúdos/cards. JPG otimizado; proporção mais vertical ou mais horizontal conforme o card.

## 18. Expansão futura (exploração, não requisito)
Novenas, biblioteca de PDFs, pedidos de oração com status pendente/respondido, jornadas de 21/30 dias, Rosário, calendário litúrgico, oração personalizada para familiares, comunidade privada, upsell de comunidade católica. Direção, não MVP.

## 19. Lojinha e extras
O backend não pode assumir produto único para sempre. Deve suportar principal + vários adicionais; comprou novena/material/jornada, o app reconhece automaticamente. Daí `products` + `entitlements` em vez de uma coluna `tem_acesso = true`.

## 20. Conhecer a cliente
Mini-formulário na oferta/upsell para enviar a oferta mais adequada: mãe/avó, estado civil, frequência à igreja, outras características religiosas/familiares. Máximo 7 perguntas, comunicação acolhedora — "como se um padre quisesse conhecer melhor uma irmã", nunca formulário de marketing. Ainda não é requisito técnico do MVP; futuramente conecta ao perfil no Supabase e à personalização de ofertas.

## 21. Vertente americana
App católico para mulheres americanas 40+, com upsells, comunidade privada, jornadas e materiais, explorado em outros chats. Relevante para estratégia de produto; **não misturar as regras** com a implementação brasileira. A infraestrutura suporta no futuro.

## 22. Objetivo do MVP
Não é "o aplicativo católico definitivo". É validar rápido o fluxo inteiro: entra com e-mail → sistema encontra → sabe o que comprou → mostra o conteúdo certo → registra onde parou → mantém em outro aparelho → libera/remove extras → depois recebe tudo automático da Hubla. Funcionando isso, o resto cresce por cima sem refazer a fundação.

## 23. Independência de IA
GitHub = código/documentação · Supabase = backend/dados · Netlify = frontend/deploy · Hubla = pagamentos/eventos. Claude Code e ChatGPT são apenas agentes trabalhando sobre essa infraestrutura. Dá para começar em um e continuar no outro — desde que as decisões importantes estejam no repositório, não só nas conversas.

## Onde paramos
Transformar o site estático em app com backend de verdade. O frontend já existe e não é o problema.

Próxima camada, em ordem:
`HTML/CSS/JS atual → Supabase → login por e-mail → banco de produtos/acessos → progresso por cliente → controle dos cards → testes → webhook Hubla → produção na Netlify`

Em paralelo, GitHub vira a fonte oficial do projeto.
