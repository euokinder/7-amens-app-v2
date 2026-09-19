# Testa o hook protege-producao com os casos que furaram na versao anterior.
import json
import subprocess
import sys

REPO = r"D:\Downloads Certos\PkScale\App 7 Orações da Madrugada"
HOOK = REPO + r"\.claude\hooks\protege-producao.sh"

G = "g" + "it"          # evita que o proprio arquivo de teste vire um gatilho
P = "pu" + "sh"

CASOS = [
    # (descricao, comando, cwd, esperado)  esperado: 2 = bloquear, 0 = liberar
    ("push direto na main",              f"{G} {P} origin main", REPO, 2),
    ("refspec development:main",         f"{G} {P} origin development:main", REPO, 2),
    ("duas branches de uma vez",         f"{G} {P} origin main development", REPO, 2),
    # A desculpa em comentario nao vale mais nada: o comentario e descartado e
    # sobra um push pelado, que so passa se a branch atual for development.
    ("desculpa no comentario",           f"{G} {P} # ja validei em development", REPO, None),
    ("desculpa no comentario + main",    f"{G} {P} origin main # ja validei em development", REPO, 2),
    ("branch indeterminada",             f"{G} {P}", r"C:\pasta\que\nao\existe", 2),
    ("--all",                            f"{G} {P} --all origin", REPO, 2),
    ("--force na development",           f"{G} {P} --force origin development", REPO, 2),
    ("HEAD:main",                        f"{G} {P} origin HEAD:main", REPO, 2),
    ("cwd com a palavra development",    f"{G} {P} origin main", r"C:\dev\development\app", 2),
    ("checkout+merge+push encadeado",    f"{G} checkout main && {G} merge development && {G} {P}", REPO, 2),
    ("push pelado (branch atual manda)", f"{G} {P}", REPO, None),
    ("origin development",               f"{G} {P} origin development", REPO, 0),
    ("-u origin development",            f"{G} {P} -u origin development", REPO, 0),
    ("git -C ... push origin development", f'{G} -C "{REPO}" {P} origin development', REPO, 0),
    ("netlify deploy --prod",            "netlify deploy --prod", REPO, 2),
    ("netlify sites:create",             "netlify sites:create --name teste", REPO, 2),
    ("comando inofensivo",               "ls -la", REPO, 0),
    ("build local",                      "node scripts/build.mjs", REPO, 0),
]

branch = subprocess.run(["git", "-C", REPO, "branch", "--show-current"],
                        capture_output=True, text=True).stdout.strip()
print("branch atual do repo:", branch)
print()

falhas = 0
for descricao, comando, cwd, esperado in CASOS:
    payload = json.dumps({
        "tool_name": "Bash",
        "cwd": cwd,
        "tool_input": {"command": comando, "description": "trabalho normal em development"},
    })
    r = subprocess.run(["bash", HOOK], input=payload, capture_output=True, text=True)
    if esperado is None:
        esperado = 0 if branch == "development" else 2
    ok = r.returncode == esperado
    if not ok:
        falhas += 1
    print(("  OK  " if ok else " FALHA"), f"[esperado {esperado}, veio {r.returncode}]", descricao)
    if not ok:
        print("       stderr:", (r.stderr or "").strip().splitlines()[:3])

print()
print("falhas:", falhas)
sys.exit(1 if falhas else 0)
