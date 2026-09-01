# Zabezpieczenie repo na GitHubie (checklista właściciela)

## 1. Private — zrobione

Repo `inyfinn/synology-mcp` powinno być **Private**.

## 2. Dostęp dla Cloud Agenta (`cursor[bot]`)

Po ustawieniu Private agent traci clone/push (404). **Jeden** z poniższych:

### A) Aplikacja Cursor (zalecane)

1. https://github.com/settings/installations
2. **Cursor** → **Configure**
3. **Repository access** → wybierz **inyfinn/synology-mcp** (lub All repositories)
4. Save

### B) Collaborator

https://github.com/inyfinn/synology-mcp/settings/access → Invite **cursor[bot]** → rola **Write**

### C) PAT w Cursor Environment

Sekret `GITHUB_PAT` (fine-grained, read/write tylko `synology-mcp`) — używany przez
`clone-synology-mcp.sh` w repo DAM.

## 3. Rulesets vs ochrona `main`

Na **darmowym koncie osobistym** GitHub **nie egzekwuje rulesets** na prywatnych repo
(komunikat: wymaga GitHub Team). To normalne — **Private wystarczy** na ukrycie mapy
infrastruktury. Rulesets / branch protection na private wymagają **GitHub Pro** lub org **Team**.

Nie musisz konfigurować rulesetów, jeśli nie masz Pro/Team.

## 4. Secret scanning

Settings → Code security → włącz **Secret scanning** (jeśli dostępne na koncie).

## 5. Hardening docs (agent)

W repo DAM: `bash bin/scripts/ops/push-synology-mcp-security.sh` (po kroku 2).

- `SECURITY.md`, redakcja UUID Environment w docs, rozszerzony `.gitignore`

## 6. Sekrety operacyjne

`NAS_SSH_KEY` itd. zostają w **Cursor Environment** — nie w gitcie. Rotacja klucza SSH
nie jest wymagana po samym Private (o ile klucz nigdy nie był commitowany).
