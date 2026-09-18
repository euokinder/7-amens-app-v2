# Stack de trabalho no Claude Code — 7 Améns

_Decidido em 2026-09-18. Define o que o agente precisa ter acesso para trabalhar neste projeto com custo baixo._

## Princípio
Cada conector ligado e cada plugin instalado ocupa contexto em **toda** sessão. Ligar tudo "por precaução" é caro e deixa o agente mais lento e mais burro. A stack abaixo é o mínimo que cobre o projeto.

---

## 1. Acessos — o que bloqueia o trabalho hoje

| # | Acesso | Estado | Por que importa |
|---|---|---|---|
| 0 | **Código do projeto localmente** | ❌ pasta vazia | Sem o código clonado aqui, todo trabalho vira adivinhação. É o bloqueio nº 1. |
| 1 | **Supabase MCP** | ⚠️ configurado, sem autorização | Sem ele eu não leio o schema, não aplico migration, não testo SQL, não vejo log de Edge Function. Vira eu ditando SQL e você colando no painel — lento e caro em token. |
| 2 | **Netlify MCP** | ⚠️ configurado, sem autorização | Ver status de build, consumo e variáveis de ambiente **sem gastar deploy pra descobrir**. Ataca direto o risco de crédito. |
| 3 | **GitHub** | ❌ MCP falhando (`Authorization header is badly formatted`) | Resolvível por `git` + `gh` CLI local, que cobre 90% do uso. O MCP só adiciona PR/issues/Actions. Prioridade média. |
| 4 | **Browser embutido** | ✅ funcionando | Já dá pra inspecionar o site no ar, testar o login, ler erros de console e simular tela de celular. Custo zero. |
| 5 | **Hubla** | — | Não existe MCP. Integração será código + documentação de webhook deles. |

---

## 2. Plugins

### Manter
| Plugin | Motivo |
|---|---|
| **supabase** | Backend inteiro do projeto. Traz skills + MCP. |
| **netlify-skills** | Deploy, config, functions, e `netlify-image-cdn` para otimizar as imagens dos cards. |
| **design** | `accessibility-review` é praticamente requisito do público 45+ (contraste, tamanho de fonte, alvo de toque). `design-critique` e `ux-copy` de apoio. |
| **anthropic-skills** | `pdf` para os materiais ("Comece Aqui", Pai Nosso), `skill-creator` para as skills do projeto. |
| **claude-md-management** | Manter o `CLAUDE.md` afiado conforme o projeto evolui. |

### Remover
| Plugin | Motivo |
|---|---|
| **apollo-skills** | GraphQL / Apollo Federation. Zero relação com o projeto, e carrega um servidor MCP com 14 ferramentas. |
| **figma** | ~12 skills + MCP pesado. Só vale se o design realmente nasce no Figma. |
| **pdf-viewer** | Serve para anotar e assinar PDFs recebidos. Aqui nós **criamos** PDFs — isso é `anthropic-skills:pdf`. O MCP dele também está falhando. |

### Conectores do plugin `design` a ignorar
Asana, Atlassian, Intercom, Linear, Notion e Slack vêm junto e não têm uso aqui. Deixar sem autorizar.

---

## 3. Skills

### Já disponíveis que vão ser usadas de verdade
- `supabase:supabase` e `supabase:supabase-postgres-best-practices` — schema, RLS, migrations
- `netlify-skills:netlify-deploy`, `netlify-config`, `netlify-functions`, `netlify-edge-functions`, `netlify-image-cdn`
- `design:accessibility-review` — auditoria WCAG; o público 45+ torna isso funcional, não enfeite
- `code-review` e `simplify` — revisar mudanças antes de subir
- `anthropic-skills:pdf` — materiais em PDF
- `update-config` — hooks e permissões
- `fewer-permission-prompts` — reduzir interrupção e ruído

### Skills próprias a criar em `.claude/skills/`
| Skill | O que faz |
|---|---|
| `deploy-seguro` | Ritual obrigatório antes de qualquer deploy: confirmar branch, estimar impacto em créditos, exigir teste local primeiro. |
| `regras-de-acesso` | Codifica entitlements e reembolsos. Qualquer mexida em acesso passa por aqui, para nunca improvisar regra de negócio. |
| `ux-45mais` | Checklist visual do público: fonte mínima, contraste, alvo de toque, paleta creme/dourado/preto, nada sobreposto. |

---

## 4. Proteções automáticas (hooks)
Um hook em `.claude/settings.json` que **exige confirmação explícita antes de qualquer `git push` para `main`**. Como `main` dispara deploy de produção na Netlify, esse é o ponto exato onde o crédito é queimado. É a proteção de maior retorno do projeto.

---

## 5. Ordem de execução
1. Clonar o repositório aqui
2. Autorizar Supabase
3. Autorizar Netlify
4. Podar os plugins desnecessários
5. Criar as três skills do projeto e o hook de deploy
6. Só então: **terminar o login por e-mail**
