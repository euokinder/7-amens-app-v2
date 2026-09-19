# Decide se um comando pode rodar. Chamado pelo protege-producao.sh.
# Sai com 0 (libera) ou 2 (bloqueia, explicando pelo stderr).
#
# A regra e NEGAR POR PADRAO: so passa o que casar com uma forma explicitamente
# segura. Se nao der para entender o comando com certeza, bloqueia e explica.
import json
import os
import re
import shlex
import subprocess
import sys

BRANCH_DE_TRABALHO = 'development'
ENCADEADORES = ['&&', '||', ';', '|', '`', '$(', '\n']
PROIBIDOS = {
    '--force', '-f', '--force-with-lease', '--force-if-includes',
    '--all', '--mirror', '--tags', '--follow-tags', '--delete', '-d', '--prune',
}


def bloqueia(motivo, dica=''):
    texto = 'BLOQUEADO pelo hook protege-producao.\n\n' + motivo
    if dica:
        texto += '\n\n' + dica
    sys.stderr.write(texto + '\n')
    sys.exit(2)


PADRAO = ('Formas liberadas, e so estas:\n'
          '  git push\n'
          '  git push origin ' + BRANCH_DE_TRABALHO + '\n'
          '  git push -u origin ' + BRANCH_DE_TRABALHO + '\n'
          '(o "git push" sem destino so passa se a branch atual for ' + BRANCH_DE_TRABALHO + ')\n\n'
          'Qualquer coisa que possa atingir a main dispara build de producao na\n'
          'Netlify e gasta credito. Se for producao mesmo, PERGUNTE ao Caio de\n'
          'forma explicita, dizendo o que vai ao ar e que isso gasta um build.')

try:
    dados = json.loads(sys.stdin.read())
except Exception:
    bloqueia('Nao consegui ler o pedido do PreToolUse, entao nao sei o que este comando faz.')

if not isinstance(dados, dict):
    bloqueia('O pedido do PreToolUse veio num formato que eu nao entendo.')

ferramenta = dados.get('tool_name') or ''
entrada = dados.get('tool_input')
if ferramenta not in ('Bash', 'PowerShell'):
    sys.exit(0)
if not isinstance(entrada, dict) or not isinstance(entrada.get('command'), str):
    bloqueia('Este pedido nao traz o campo tool_input.command, entao nao da para\n'
             'saber qual comando seria executado.')

comando = entrada['command']
pasta = dados.get('cwd') or os.getcwd()

# --- Netlify: deploy de producao e criacao de site --------------------------
if re.search(r'\bnetlify\b[\s\S]*\bdeploy\b', comando) and re.search(r'--prod\b', comando):
    bloqueia('Deploy de producao direto pela CLI consome credito da Netlify na hora.',
             'Pergunte ao Caio antes, dizendo exatamente o que vai ser publicado.')

if re.search(r'\bnetlify\b\s+(sites:create|init)\b', comando):
    bloqueia('Criar site novo na Netlify para contornar credito foi descartado.',
             'Confirme com o Caio antes.')

# --- Git push ---------------------------------------------------------------
if not re.search(r'\bgit\b[\s\S]*\bpush\b', comando):
    sys.exit(0)

for pedaco in ENCADEADORES:
    if pedaco in comando:
        nome = 'quebra de linha' if pedaco == '\n' else pedaco
        bloqueia('Este comando junta um "git push" com outros comandos (usando "'
                 + nome + '").\n'
                 'Foi exatamente assim que a main recebeu codigo sem ninguem ver:\n'
                 'trocar de branch, juntar e publicar num comando so.\n'
                 'Nao da para garantir o destino, entao eu barro.',
                 'Rode um comando de cada vez.\n\n' + PADRAO)

try:
    partes = shlex.split(comando, comments=True)
except ValueError:
    bloqueia('Nao consegui separar as partes deste comando com seguranca (aspas abertas?).', PADRAO)

if not partes:
    sys.exit(0)

# Ignora prefixos tipo VAR=valor
i = 0
while i < len(partes) and re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', partes[i]):
    i += 1

if i >= len(partes) or os.path.basename(partes[i]).replace('.exe', '') != 'git':
    bloqueia('Aqui tem a palavra "push", mas eu nao reconheci o comando como um\n'
             'git push simples. Por precaucao, barro.', PADRAO)
i += 1

# Opcoes globais do git antes do subcomando: -C <pasta>, --git-dir=..., -c k=v
while i < len(partes):
    atual = partes[i]
    if atual == '-C' and i + 1 < len(partes):
        pasta = partes[i + 1]
        i += 2
    elif atual == '-c' and i + 1 < len(partes):
        i += 2
    elif (atual.startswith('--git-dir=') or atual.startswith('--work-tree=')
          or (atual.startswith('-C') and len(atual) > 2)):
        i += 1
    else:
        break

if i >= len(partes) or partes[i] != 'push':
    bloqueia('Este comando tem "push" em algum lugar, mas nao no formato que eu sei\n'
             'conferir. Por precaucao, barro.', PADRAO)

resto = partes[i + 1:]

for token in resto:
    if token in PROIBIDOS or token.startswith('--force'):
        bloqueia('O push usa "' + token + '", que pode sobrescrever ou apagar branch\n'
                 'no GitHub, inclusive a main.', PADRAO)
    if ':' in token:
        bloqueia('O push usa "' + token + '". Esse formato manda uma branch para outra\n'
                 '(ex.: development:main publica na PRODUCAO, mesmo escrito assim).',
                 PADRAO)
    if re.search(r'\bmain\b|\bHEAD\b|\bmaster\b', token):
        bloqueia('O push menciona "' + token + '", que aponta para a branch de producao.', PADRAO)

# -u / --set-upstream sao inofensivos
resto = [t for t in resto if t not in ('-u', '--set-upstream', '--quiet', '-q', '--verbose', '-v')]

if len(resto) == 0 or resto == ['origin']:
    try:
        atual = subprocess.run(['git', '-C', pasta, 'branch', '--show-current'],
                               capture_output=True, text=True, timeout=15)
    except Exception:
        atual = None
    branch = atual.stdout.strip() if atual and atual.returncode == 0 else ''
    if branch != BRANCH_DE_TRABALHO:
        bloqueia('Este "git push" nao diz o destino, e a branch atual e "'
                 + (branch or 'desconhecida') + '".\n'
                 'Um push pelado a partir da main publica em PRODUCAO sem avisar.', PADRAO)
    sys.exit(0)

if resto == ['origin', BRANCH_DE_TRABALHO]:
    sys.exit(0)

bloqueia('Este push nao casa com nenhuma forma que eu sei que e segura:\n  '
         + comando.strip(), PADRAO)
