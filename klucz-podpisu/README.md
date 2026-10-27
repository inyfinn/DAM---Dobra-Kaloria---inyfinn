# Klucz podpisu wydań (zaszyfrowany)

`release-signing-key.pem.enc` to klucz Ed25519, którym podpisujemy `DAM-Setup.exe.sig` i `DAM-*.dmg.sig`.
Program DAM instaluje aktualizację tylko z poprawnym podpisem. Bez klucza komputer nie zbuduje wydania.

Szyfr: `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`. Hasło nie leży w repo: jest w zmiennej repozytorium
`DAM_KLUCZ_PODPISU_HASLO` (widzi ją tylko konto z prawem zapisu do repo, czyli właściciel).

## Odblokowanie na nowym komputerze (po `gh auth login` na koncie inyfinn)

PowerShell (Windows):

```powershell
$d = "$HOME\.dam\secrets"; New-Item -ItemType Directory -Force $d | Out-Null
gh api repos/inyfinn/DAM---Dobra-Kaloria---inyfinn/contents/klucz-podpisu/release-signing-key.pem.enc --jq .content |
  ForEach-Object { [IO.File]::WriteAllBytes("$d\release-signing-key.pem.enc", [Convert]::FromBase64String(($_ -replace '\s',''))) }
$p = (gh variable get DAM_KLUCZ_PODPISU_HASLO --repo inyfinn/DAM---Dobra-Kaloria---inyfinn).Trim()
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$d\release-signing-key.pem.enc" -out "$d\release-signing-key.pem" -pass "pass:$p"
```

Bash / macOS:

```bash
d="$HOME/.dam/secrets"; mkdir -p "$d"
gh api repos/inyfinn/DAM---Dobra-Kaloria---inyfinn/contents/klucz-podpisu/release-signing-key.pem.enc --jq .content | base64 -d > "$d/release-signing-key.pem.enc"
p="$(gh variable get DAM_KLUCZ_PODPISU_HASLO --repo inyfinn/DAM---Dobra-Kaloria---inyfinn | tr -d '\r\n')"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$d/release-signing-key.pem.enc" -out "$d/release-signing-key.pem" -pass "pass:$p"
chmod 600 "$d/release-signing-key.pem"
```

Build szuka klucza w `%USERPROFILE%\.dam\secrets\release-signing-key.pem` (albo w zmiennej `DAM_RELEASE_KEY`).
Zmiana klucza = nowe hasło w zmiennej i nowy plik `.enc` (stary zostaje w historii gita, więc stary klucz trzeba uznać za zużyty).
