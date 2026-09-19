#!/usr/bin/env bash
# Protege a producao e os creditos da Netlify.
#
# Recebe o JSON do PreToolUse no stdin. Sai com codigo 2 para bloquear,
# devolvendo a explicacao pelo stderr.
#
# A logica de verdade mora no protege-producao.py ao lado: jq nao existe nesta
# maquina, e ler o JSON com grep foi justamente o furo da versao anterior
# (bastava a palavra "development" aparecer em qualquer campo para liberar).

entrada="$(cat)"
aqui="$(dirname "$0")"

py=""
for candidato in python python3 py; do
  if command -v "$candidato" >/dev/null 2>&1; then py="$candidato"; break; fi
done

if [ -z "$py" ] || [ ! -f "$aqui/protege-producao.py" ]; then
  # Sem como analisar direito: barra o que pode custar caro e libera o resto.
  if printf '%s' "$entrada" | grep -Eq 'git[^"]*push|netlify[[:space:]]+deploy|netlify[[:space:]]+(sites:create|init)'; then
    printf '%s\n' "BLOQUEADO pelo hook protege-producao.

Nao consegui analisar este comando (falta o Python ou o arquivo
protege-producao.py ao lado deste), e ele pode publicar em producao e gastar
credito da Netlify.

Confira a mao antes de insistir:
  1. git branch --show-current  ->  tem que dizer development
  2. Se for producao mesmo, PERGUNTE ao Caio de forma explicita." >&2
    exit 2
  fi
  exit 0
fi

printf '%s' "$entrada" | "$py" "$aqui/protege-producao.py"
exit $?
