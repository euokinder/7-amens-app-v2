# 7 Améns da Madrugada — Contexto do Projeto

> Fonte de verdade das regras do projeto. Atualizado: 2026-09-18
> Contexto histórico completo em `docs/contexto-completo.md`. Leia sob demanda, não sempre.

## Em uma frase
Um app católico extremamente simples para a cliente, com infraestrutura por trás capaz de saber quem ela é, o que comprou, o que pode acessar e onde parou — tudo automaticamente.

## Status atual
- **MVP no ar e vendendo:** https://7-amens-app-v2.netlify.app/
- É um site HTML/CSS/JS puro desenhado para parecer app. **Não está em loja nenhuma.**
- Desafio NÃO é criar do zero — é **otimizar e completar** o que existe.
- Em andamento: login por e-mail (incompleto — próxima tarefa).

## Quem é o dono do projeto
Caio — copywriter da operação, à frente do desenvolvimento como **idealizador**, não como dev.
Não tem malícia de programação. Precisa que eu:
- explique decisões técnicas em português claro, sem jargão gratuito;
- **avise proativamente sobre custo** (Netlify, Supabase, cobrança automática no cartão);
- **economize tokens** — sem exploração desnecessária, sem reler o que já sei;
- construa junto, não só aconselhe.

## Público-alvo
Mulheres católicas brasileiras **45+** (também descrito como 40+/50+, senhoras maduras).
Isso é regra de UX, não detalhe: letras grandes, sans-serif, alto contraste, cards grandes, poucos elementos competindo, linguagem claríssima. **Lógica de "Netflix de orações", nunca de dashboard SaaS.**
Paleta aprovada: **creme + dourado + preto**, muito respiro, cards bem separados.
Regra fixa: revisar visualmente — nada de texto sobreposto ou elemento pequeno.

## Produto principal — 7 Améns da Madrugada
Jornada de 7 madrugadas, **1 oração por dia**, na ordem:
| Dia | Oração |
|---|---|
| 1 | Pai Nosso Completo |
| 2 | Perdão |
| 3 | Cura |
| 4 | Libertação |
| 5 | Prosperidade |
| 6 | Paz |
| 7 | Aliança |

- Horário recomendado: **4h–7h**, em voz alta, com áudio guiado.
- **Se perder um dia: NÃO reinicia e NÃO faz duas no mesmo dia.** Continua de onde parou, no dia seguinte.
- Depois dos 7 dias, materiais como o Pai Nosso seguem utilizáveis à parte.

## Stack
| Camada | Ferramenta | Papel |
|---|---|---|
| Frontend + hospedagem | **Netlify** | serve o HTML/CSS/JS, deploy automático |
| Código + histórico | **GitHub** | fonte central; commit lá → deploy na Netlify |
| Backend completo | **Supabase** | Postgres, usuários, entitlements, progresso, Edge Functions |
| Pagamentos | **Hubla** | fonte da verdade de compras e reembolsos, via webhook |

**Decisão firmada: NÃO reescrever em React/Next.** Preserva-se o frontend vanilla e adiciona-se backend por trás.

Arquivos conhecidos do frontend: `index.html`, `novena.html`, `dia.html`, `desatadora.html`, `app.js`, `dias.js`, `materiais.js`, `mensagens.js`, `novena-desatadora.js`.

## Regras de negócio (inegociáveis)
1. **Login sem senha, sem OTP, sem código no e-mail.** A cliente digita o mesmo e-mail da compra e entra. O e-mail É a identidade. Risco de compartilhamento é aceito conscientemente — a fricção de auth tradicional é pior para esse público.
2. **Só quem comprou o produto principal entra no app.** A compra principal libera todo o conteúdo base e o acesso é **vitalício**.
3. **Extras são entitlements individuais.** Cliente pode ter principal + extra A sem ter extra B.
4. **Reembolso do principal → perde o app inteiro.** **Reembolso de um extra → mantém o app, perde só aquele extra.**
5. **Comprou o extra Y → libera Y e para de oferecer Y para ela**, idealmente já na próxima sincronização, mesmo com o app aberto.
6. **Progresso vive na nuvem (Supabase), não em `localStorage`.** Trocou de aparelho, o progresso continua.
7. **Webhooks da Hubla devem ser idempotentes.** Evento repetido não duplica entitlement nem quebra o banco.
8. **RLS ligado no Supabase.** Ninguém consulta dados de outra pessoa.

## Home como hub
Cards: **7 Orações Sagradas · Mensagem do Dia · Pai Nosso · Novena Desatadora dos Nós · Lojinha**.
Cards são **inteligentes**: tem direito → entra; não tem → mostra "Desbloquear". O app vira consumo + venda de complementos sem jogar a cliente para fora.

## Modelo de dados — JÁ IMPLEMENTADO (`supabase/schema.sql`)
O backend está bem mais adiantado do que o desenho original sugeria. Nomes reais das tabelas:

| Tabela | Papel |
|---|---|
| `customers` | a cliente; e-mail normalizado, validado e `unique` |
| `products` | catálogo; semeado com `principal`, `upsell_01`, `upsell_02`, `upsell_03` |
| `entitlements` | o que cada cliente possui; `status` = `active` / `refunded` / `revoked` |
| `prayer_progress` | onde ela parou; `prayer_key` = `principal:0-7` ou `desatadora:1-9` |
| `member_sessions` | sessões opacas de 90 dias, **só o hash do token é guardado** |
| `member_login_limits` | anti-abuso: 20 tentativas por janela de 10 min |
| `member_offer_campaigns` | campanhas de oferta dentro do app |
| `member_offer_events` | registro servidor de exibição/clique, para não repetir oferta em outro aparelho |

Funções: `allow_member_login(bucket_key)` e `claim_member_offer(customer_id)`.
Edge Function: `supabase/functions/member-api/index.ts` — **todo acesso ao banco passa por ela.**

**RLS está ligado em todas as tabelas**, com `anon` e `authenticated` revogados e política `backend_only` exclusiva de `service_role`. O frontend nunca fala direto com o banco.

Motivo de `products` + `entitlements` em vez de um `tem_acesso = true`: o catálogo vai crescer (novenas, jornadas 21/30 dias, materiais). O banco não pode assumir produto único.

**Ainda falta:** `hubla_events` e `webhook_logs`, e a Edge Function que recebe o webhook da Hubla. É aí que está o caminho para a monetização automática.

## Catálogo de produtos
| `products.key` | Nome comercial | Tipo |
|---|---|---|
| `principal` | **Os 7 Améns da Madrugada** | main — libera o app inteiro |
| `upsell_01` | **Oração Celestial dos Quatro Arcanjos** | addon |
| `upsell_02` | **Músicas dos Anjos** | addon |
| `upsell_03` | **Comunidade da Fé** | addon |

O mapeamento vive em `hubla_product_map` (vários IDs da Hubla podem apontar para o mesmo produto). Situação em 2026-09-18:

| Produto | ID confirmado? |
|---|---|
| principal | ✅ `bniYICXEzykgw1PzEyme` |
| upsell_01 | ✅ `ODOZxlF1tfhee2TkZikI` |
| upsell_03 | ✅ `nMyLP4oFcIWiJ77UIbsu` |
| upsell_02 | ✅ `vRuLDZ1avAMG2LllTWAu` |

⚠️ **Armadilha comprovada: o slug da página `hub.la/g/...` quase nunca é o `event.product.id`.** Dos três slugs desse formato, **dois estavam errados** — só Comunidade da Fé coincidiu por acaso. Só o payload real confirma; nunca deduzir por analogia. ID desconhecido cai em `needs_reconciliation` e **nunca** libera acesso errado — é para isso que o mapeamento é tabela e não coluna.

A Novena Desatadora dos Nós **não é addon** — está incluída no produto principal.

## Hubla
Plataforma de vendas da operação. **Documentação oficial: https://hubla.gitbook.io/docs**
Tudo sobre Hubla — webhook, payload, evento, status, reembolso, produto — sai exclusivamente de lá. Nunca inferir por analogia com Kiwify, Hotmart ou Stripe.

**Especificação de integração aprovada: [docs/hubla-integracao-spec.md](docs/hubla-integracao-spec.md).** É a referência para o webhook. Decisão: adotar 100% da lógica dela, mas **manter os nomes de tabela atuais** (`customers`, `prayer_progress`, `products.key`) em vez dos propostos no documento (`profiles`, `progress`, `slug`) — renomear quebraria a `member-api`, o admin e o perfil num app já em produção.

## Painel administrativo (`admin.html`)
Protegido pela tabela `member_admins` — e um admin também precisa do `principal` ativo, porque a `member-api` exige isso antes de qualquer ação.

Mostra: KPIs, campanhas do funil, lista de clientes com busca, e a ficha completa de cada uma (acessos, orações concluídas, dias de acesso ao site, campanhas enviadas, perfil respondido, eventos da Hubla e histórico administrativo).

Age: liberar acesso na mão (aceita e-mail que ainda não existe), revogar produto específico, corrigir e-mail (derruba as sessões abertas).

**Toda ação fica registrada em `admin_actions` com o admin responsável.**

## ⚠️ Teste local fala com o banco de PRODUÇÃO
Não existe ambiente de staging. `localhost:3000` usa a mesma `member-api` e o mesmo Supabase das clientes reais. **Liberar ou revogar acesso no painel local altera dados de verdade.**

## Prioridades atuais (decididas em 2026-09-18)
1. ✅ **Webhook da Hubla** — entregue e rodando em produção desde 2026-09-18.
2. ✅ **Painel admin com controle** — construído; falta publicar na Netlify.
3. ⏳ **Carga inicial das clientes antigas** — a Hubla não faz backfill. Quem comprou antes do webhook não está no banco e não consegue entrar. Precisa de export da Hubla.

## Infraestrutura — identificadores
- Repositório: `euokinder/7-amens-app-v2` (branches `main` = produção, `development` = trabalho). **Não criar repositório novo** — a Netlify está ligada nele.
- Supabase em uso: projeto **`7-amens-app-v2`**, ref `lbaudlocfbjunnaoyrtz`, região sa-east-1.
- Existe um segundo projeto Supabase, `7 Orações da Madrugada` (`wyiqwsgfictcfkytldnu`), **vazio**. Não usar. Ocupa vaga do plano gratuito.

## Build e teste local
`netlify.toml` roda `node scripts/build.mjs` e publica `dist/`. **Existe etapa de build de verdade** — quebrar o `build.mjs` derruba o deploy.

**Sempre testar local antes de subir** (custo zero, Node 24 instalado):
```
node scripts/build.mjs && node scripts/preview.mjs
```
Abre em http://localhost:3000. Deploy de produção não é ferramenta de teste.

## Fluxo-alvo da Hubla
compra na Hubla → webhook → backend lê e-mail + produto + status → Supabase cria/atualiza entitlement → app consulta direitos → card libera sozinho.
Reembolso percorre o mesmo caminho removendo o entitlement certo.

## Objetivo do MVP técnico (a validar, nesta ordem)
cliente entra com e-mail → sistema a encontra → sabe o que comprou → mostra o conteúdo certo → registra onde parou → mantém em outro aparelho → libera/remove extras → depois recebe tudo automático da Hubla.

**Ordem de trabalho acordada:** primeiro criar usuários/compras/acessos **manualmente** no Supabase e validar login + entitlement + progresso. Só depois conectar a Hubla. Integração de pagamento não pode bloquear o teste do produto.

## ⚠️ Custos — vigiar sempre
- **Créditos do Netlify Free já foram zerados uma vez.** Plano pago ~US$9/mês em avaliação.
- **Nunca gastar deploy de produção em alteração pequena.** Desenvolver e testar localmente (inclusive Supabase, login, regras, progresso).
- Deploy externo só quando precisar de URL alcançável (teste real de webhook).
- **Um único site na Netlify**, com branch `development` para teste e `main` para produção. Não criar sites novos para fugir de créditos.
- Alertar sobre qualquer risco de cobrança automática no cartão antes de acontecer.

## Segurança — calibragem
Site simples, superfície de ataque pequena, **não é a prioridade**. Exceções que importam de verdade: RLS no Supabase e não vazar chave de service_role no frontend.

## Fora do MVP (direção futura, não construir agora)
Novenas extras, biblioteca de PDFs, pedidos de oração com status pendente/respondido, jornadas de 21/30 dias, Rosário, calendário litúrgico, oração personalizada para familiares, comunidade privada, mini-formulário de perfil (máx. 7 perguntas, tom de padre acolhendo uma irmã — nunca formulário de marketing).

## Versão americana
Existe uma vertente para o público católico americano 40+ explorada à parte. **Não misturar as regras** com a operação brasileira. A infraestrutura atual a suporta no futuro.

## Princípio que rege tudo
O repositório deve explicar o negócio sozinho. Nenhum agente de IA deveria precisar "lembrar da conversa" para trabalhar com segurança aqui. Decisão importante → vai para o repositório, não fica no chat.
