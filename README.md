# 7 Améns da Madrugada — V2

Ambiente de validação independente do site original.

- Produção: https://setemadrugadas.com.br (projeto Netlify `7madrugadas`)
- Validação: https://7-amens-app-v2.netlify.app (projeto Netlify `7-amens-app-v2`)
- São dois projetos Netlify distintos. Publicar na `main` não atualiza a produção sozinho.
- Supabase: projeto `lbaudlocfbjunnaoyrtz`, região São Paulo.
- Entrada por e-mail da compra, sem senha ou confirmação, por decisão de produto.
- Produto `principal` ativo libera todo o conteúdo existente.
- Progresso individual por oração, salvo no Supabase.
- Acessos atualizados a cada 5 minutos e ao voltar à aba.

## Administração manual

No Table Editor do Supabase:

1. Em `customers`, adicione o e-mail em minúsculas e sem espaços nas pontas.
2. Copie o `id` da cliente.
3. Em `entitlements`, crie uma linha com esse `customer_id`, `product_key = principal` e `status = active`.
4. Para retirar acesso, altere `status` para `refunded` ou `revoked`.

Cada extra futuro tem uma linha em `products` e uma liberação em `entitlements`.

## Campanhas de upsell no app

`member_offer_campaigns` define ofertas exibidas dentro do app e
`member_offer_events` registra a primeira exibição no servidor. A campanha
`front_only_to_upsell_01` já está preparada, mas permanece desativada e sem URL.
Ela exige o produto `principal` e exclui clientes que já possuem qualquer etapa
`upsell_01`, `upsell_02` ou `upsell_03`. Para ativar depois da configuração da
Hubla, defina uma `target_url` HTTPS, revise os textos e altere `enabled` para
`true`. O registro servidor evita repetir o pop-up em outro navegador ou aparelho.
Para exibir uma oferta, preencha `checkout_url`; para o conteúdo adquirido, preencha
`content_url`. A home troca a oferta pelo acesso quando a compra estiver ativa.
Não foram cadastrados produtos ou checkouts comerciais fictícios.

O funil completo está preparado em cinco campanhas desativadas:

- somente Front → UP01;
- Front + UP01 → UP02;
- recusa do UP02 → downsell UP02 + UP03;
- Front + UP01 + UP02 → assinatura UP03;
- funil completo → convite para o grupo VIP.

`trigger_type` separa ofertas de entrada e ofertas após recusa;
`source_campaign_key` vincula o downsell à oferta recusada. Todas as campanhas
exigem `target_url` HTTPS e `enabled = true`, portanto nenhuma delas será exibida
antes da configuração comercial real.

## Pesquisa de perfil

`member_visit_days` registra no máximo uma visita por cliente e data, usando o
fuso de São Paulo. A campanha `profile_after_third_visit_day`, em
`member_survey_campaigns`, direciona a cliente para `perfil.html` quando ela
alcança três dias distintos de acesso. Os dias não precisam ser consecutivos e
não dependem da ordem das orações.

A regra é configurável: `min_distinct_visit_days` muda o dia do disparo,
`enabled` liga ou desliga a campanha e `starts_at`/`ends_at` permitem definir uma
janela. `member_survey_events` registra elegibilidade, exibição, início, dispensa
e conclusão por cliente. `member_survey_responses` guarda as seis respostas
estruturadas e não duplica nome ou e-mail, pois usa a relação com `customers`.

## Painel administrativo

`admin.html` exibe métricas do app, campanhas, estágio do funil e perfil das
clientes, e também **libera acesso na mão, revoga produto e corrige e-mail** —
toda ação fica registrada em `admin_actions`. Exige que o cliente autenticado
esteja cadastrado em `member_admins`; quem não estiver é mandado para a home
antes de a tela abrir, e a `member-api` recusa cada ação de qualquer jeito. As views `admin_customer_overview` e
`admin_offer_overview` não têm acesso para `anon` ou `authenticated`.

Reembolso do principal bloqueia entrada e gravação de progresso. Reembolso de um
extra altera somente aquele extra. O progresso fica preservado se o acesso voltar.
As páginas atuais pertencem ao principal; extras futuros precisam validar seu
próprio acesso no backend ao implementar seus conteúdos.

## Arquitetura e limites da validação

`member-api` é uma Supabase Edge Function com identificação customizada. Somente
ela acessa o banco usando credenciais de servidor. As tabelas têm RLS e não têm
permissões para `anon`/`authenticated`. Sessões aleatórias duram 90 dias e são
armazenadas como SHA-256 no banco. Sair revoga a sessão atual.

O e-mail informado identifica a cliente, mas não comprova sua identidade: quem
souber um e-mail liberado pode entrar, conforme o fluxo aprovado. O HTML, os PDFs,
os vídeos externos e os demais arquivos estáticos mantêm a distribuição original;
a tela de entrada não é DRM nem torna esses arquivos privados. A API protege os
dados de clientes e progresso contra listagem pública.

A Hubla **está integrada** desde 2026-09-18: a Edge Function
`supabase/functions/hubla-webhook/index.ts` recebe a venda e libera o acesso
sozinha. A carga histórica das clientes antigas também já foi executada
(`docs/migracao-base-historica.md`).

⚠️ O caminho do **reembolso** nunca rodou com evento real: os testes de remoção
feitos até aqui vieram do sandbox, e o código descarta evento de sandbox antes de
mexer em acesso. Ou seja, o trecho que tira acesso de alguém nunca executou.

## Desenvolvimento e publicação

Sem dependências de frontend. Node.js gera somente os arquivos públicos em `dist`:

```sh
node scripts/build.mjs
```

`netlify.toml` configura esse comando. A função fica em
`supabase/functions/member-api/index.ts`; `supabase/schema.sql` registra o esquema
inicial aplicado pela migration remota `member_access_and_progress`.

Não publique a raiz do repositório como pasta estática. Não coloque chaves secretas
em `js/`, no HTML ou no Git. `member-config.js` contém apenas a URL pública da API.

## Validação executada

- E-mail sem acesso, e-mail inválido e sessão inválida rejeitados.
- Normalização de e-mail e persistência de sessão.
- Progresso sincronizado entre duas sessões independentes.
- Logout invalida o token no servidor.
- Reembolso do principal bloqueia sessão existente, gravação e novo login.
- Extra adquirido aparece em sessão ativa; reembolso do extra preserva principal.
- Verificação de segurança do Supabase sem alertas.
