# Cloud Agent → Synology SSH (bez Termius)

Ten dokument opisuje, jak sterować Synology **wyłącznie z Cursor Cloud Agenta** (telefon, przeglądarka, PC — bez osobnej aplikacji SSH).

## Architektura

```
Cursor Cloud Agent (Linux w chmurze)
        │ SSH :5022
        ▼
inyfinn.synology.me (Synology NAS)
        │ docker
        ▼
Home Assistant, Panel Klienta, MCP, …
```

## Jednorazowa konfiguracja (3 kroki)

### Krok 1 — Klucz publiczny na Synology (z telefonu, bez Termius)

W DSM 7 **nie ma** osobnej zakładki „Klucze SSH” w Terminal i SNMP (to normalne). Klucz dodajesz przez **File Station**.

#### 1a. Włącz folder domowy użytkownika (jeśli jeszcze nie)

1. DSM → **Panel sterowania → Użytkownicy i grupy**
2. Zakładka **Zaawansowane**
3. Zaznacz **Włącz usługę home użytkowników** → Zastosuj

#### 1b. Dodaj klucz w File Station

1. Otwórz **File Station**
2. Wejdź w folder **home** → folder użytkownika **Inyfinn**
3. Utwórz podfolder o nazwie dokładnie: `.ssh`  
   (na telefonie: menu ⋮ → Utwórz → Utwórz folder → wpisz `.ssh`)
4. Wejdź do `.ssh` → **Utwórz → Utwórz plik tekstowy** → nazwa: `authorized_keys`
5. Otwórz plik do edycji i wklej **całą jedną linię** klucza publicznego (wygenerowanego w kroku 0)
6. Zapisz plik

#### Krok 0 — Wygeneruj parę kluczy (przed wklejeniem na NAS)

Na dowolnym Linux/macOS lub w Cloud Agent po sklonowaniu repo:

```bash
bash scripts/generate-cloud-agent-ssh-key.sh
```

Skrypt wypisze **klucz publiczny** (jedna linia) — ten wklejasz do `authorized_keys` na NAS.  
Klucz prywatny trafia do sekretu `NAS_SSH_KEY` w Cursor (patrz krok 2).

Przy każdym setupie **od zera** generuj **nową** parę — nie używaj starego klucza z poprzedniego urządzenia.

#### 1c. Uprawnienia (ważne — bez tego SSH odrzuci klucz)

Jeśli masz już jakikolwiek dostęp do terminala DSM (apka **DSM mobile → Terminal** albo inna sesja SSH), uruchom:

```bash
chmod 755 ~
chmod 755 ~/.ssh
chmod 644 ~/.ssh/authorized_keys
```

Jeśli nie masz terminala — po dodaniu pliku napisz **„gotowe”**, agent sprawdzi połączenie; przy błędzie uprawnień podam dalszy krok.

### Krok 2 — Sekrety w Cursor Cloud Environment

Otwórz środowisko Cloud Agenta w Cursorze:
**Cursor → Dashboard → Cloud Agents → Environments** → wybierz **„Synology MCP — Cloud SSH”** (nazwa z `.cursor/environment.json`).

> Nie linkuj publicznie do URL z ID środowiska — trzymaj link tylko w dashboardzie Cursor.

Dodaj sekrety:

| Nazwa sekretu | Wartość |
|---------------|---------|
| `NAS_SSH_KEY` | **cała zawartość** pliku `.cursor/cloud-agent-nas` (klucz prywatny z kroku 0) |
| `NAS_SSH_USER` | `Inyfinn` |
| `NAS_SSH_HOST` | `inyfinn.synology.me` |
| `NAS_SSH_PORT` | `5022` |

**Nie wklejaj klucza prywatnego na czacie z agentem.**

### Krok 3 — Zapisz środowisko i uruchom nowego agenta

1. W dashboardzie środowiska naciśnij **Save** (po merge tej konfiguracji z repo).
2. Uruchom nowego Cloud Agenta na repo `inyfinn/synology-mcp`.
3. Agent przy starcie uruchomi `scripts/cloud-agent-ssh-setup.sh` i zweryfikuje połączenie.

## Klucze SSH — gdzie co trafia

| Plik | Gdzie | Commit do gita? |
|------|-------|-----------------|
| `.cursor/cloud-agent-nas.pub` | `home/Inyfinn/.ssh/authorized_keys` na NAS | Nie (`.gitignore`) |
| `.cursor/cloud-agent-nas` | sekret `NAS_SSH_KEY` w Cursor Environment | Nie (`.gitignore`) |

Pełny runbook od zera: [runbook-od-zera.md](runbook-od-zera.md).

## Co agent może robić po połączeniu

Przykłady poleceń do agenta:

- „Sprawdź `docker ps` na NAS”
- „Pokaż logi Home Assistanta”
- „Zmień konfigurację Home Assistant w Dockerze”
- „Uruchom `tworz-klienta.sh --lista`”

Agent używa:

```bash
bash scripts/nas.sh "docker ps"
bash scripts/nas.sh "docker logs homeassistant --tail 50"
```

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| `BRAK SEKRETU: NAS_SSH_KEY` | Dodaj sekret w dashboardzie i uruchom agenta ponownie |
| `Permission denied (publickey)` | Klucz publiczny nie jest w DSM lub zły użytkownik |
| `Connection timed out` | Sprawdź port 5022 i firewall routera |
| SSH działa, Docker nie | Użytkownik musi być w grupie `docker` na NAS |

## Bezpieczeństwo

- Klucz jest **tylko** dla Cloud Agenta — nie używaj go na PC ani w Termius.
- Nie commituj klucza prywatnego do gita.
- Konto SSH z minimalnymi uprawnieniami (sudo tylko gdy potrzebne).
