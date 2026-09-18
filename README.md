# 7 Améns da Madrugada — V2

Ambiente de validação independente do site original.

- Site: https://7-amens-app-v2.netlify.app
- Supabase: projeto `lbaudlocfbjunnaoyrtz`, região São Paulo.
- Entrada por e-mail da compra, sem senha ou confirmação, por decisão de produto.
- Produto `principal` ativo libera todo o conteúdo existente.
- Progresso individual por oração, salvo no Supabase.
- Acessos atualizados a cada 30 segundos e ao voltar à aba.

## Administração manual

No Table Editor do Supabase:

1. Em `customers`, adicione o e-mail em minúsculas e sem espaços nas pontas.
2. Copie o `id` da cliente.
3. Em `entitlements`, crie uma linha com esse `customer_id`, `product_key = principal` e `status = active`.
4. Para retirar acesso, altere `status` para `refunded` ou `revoked`.

Cada extra futuro tem uma linha em `products` e uma liberação em `entitlements`.
Para exibir uma oferta, preencha `checkout_url`; para o conteúdo adquirido, preencha
`content_url`. A home troca a oferta pelo acesso quando a compra estiver ativa.
Não foram cadastrados produtos ou checkouts comerciais fictícios.

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

A Hubla ainda não está integrada. Nenhuma compra real é importada automaticamente.

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
