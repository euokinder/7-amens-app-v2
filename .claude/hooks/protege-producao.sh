#!/usr/bin/env bash
# Protege os créditos da Netlify: barra push para produção e deploy direto
# sem confirmação explícita do Caio.
#
# Recebe o JSON do PreToolUse no stdin. Sai com código 2 para bloquear,
# devolvendo a explicação pelo stderr.

entrada="$(cat)"

# Só interessa o conteúdo do comando que o agente quer rodar.
cmd="$entrada"

bloqueia() {
  printf '%s\n' "$1" >&2
  exit 2
}

# --- push para a branch de produção -----------------------------------------
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push'; then
  if ! printf '%s' "$cmd" | grep -q 'development'; then
    bloqueia "BLOQUEADO pelo hook protege-producao.

Este push pode atingir a branch main, que dispara build de produção na Netlify e consome crédito.

Antes de insistir:
  1. Confirme a branch atual com: git branch --show-current
  2. Se for trabalho normal, use a branch development
  3. Se for produção mesmo, PERGUNTE ao Caio de forma explícita, dizendo o que vai ao ar e que isso gasta um build

Só rode o push depois que ele responder que pode."
  fi
fi

# --- deploy direto de produção ----------------------------------------------
if printf '%s' "$cmd" | grep -Eq 'netlify[[:space:]]+deploy' && printf '%s' "$cmd" | grep -Eq '\-\-prod'; then
  bloqueia "BLOQUEADO pelo hook protege-producao.

Deploy de produção direto pela CLI consome crédito da Netlify na hora.
Pergunte ao Caio antes, dizendo exatamente o que vai ser publicado."
fi

# --- criar site novo na Netlify ---------------------------------------------
if printf '%s' "$cmd" | grep -Eq 'netlify[[:space:]]+(sites:create|init)'; then
  bloqueia "BLOQUEADO pelo hook protege-producao.

A decisão do projeto é manter UM ÚNICO site na Netlify, com development para teste e main para produção.
Criar site novo para contornar crédito foi descartado. Confirme com o Caio antes."
fi

exit 0
