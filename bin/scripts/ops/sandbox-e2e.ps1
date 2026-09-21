#Requires -Version 5.1
<#
  Test end-to-end DAM na czystym Windows (Windows Sandbox), bez dysku Marketing.
  Uruchamiany przez sandbox-e2e.wsb. Wszystko przez API mostu i Edge bez okna:
  zero symulacji klawiatury i zero zrzutow ekranu hosta.

  Zakres (2026-09-20, po wpadce 2.1.2 z nieaktualnym haslem bazy):
  instalacja -> aktywacja -> logowanie -> POLACZENIE Z BAZA -> watcher indeksu
  -> miniatury z cache -> wszystkie endpointy danych -> KAZDA strona panelu
  (zrzut + DOM + liczba pustych kafelkow + bledy konsoli).
  Wyniki: OutDir\e2e.json + ui-*.png + dom-*.html.
#>
param(
  [string]$SetupDir = "C:\dam-setup",
  [string]$SecretsDir = "C:\dam-secrets",
  [string]$OutDir = "C:\dam-results",
  [string]$PayloadDir = "C:\dam-payload",
  [string]$Bridge = "http://127.0.0.1:8766",
  [string]$Ui = "http://127.0.0.1:8765",
  [int]$ThumbSample = 120
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
# Znacznik startu: odroznia "skrypt nie ruszyl" od "skrypt wisi na jakims kroku".
Start-Transcript -LiteralPath (Join-Path $OutDir "e2e-transcript.log") -Force | Out-Null
"start $(Get-Date -Format s) setup=$SetupDir out=$OutDir" | Set-Content -LiteralPath (Join-Path $OutDir "_START.txt") -Encoding UTF8
$r = [ordered]@{ started_at = (Get-Date).ToString("s"); steps = [ordered]@{}; checks = [ordered]@{}; failed = @(); result = "FAIL" }
function Step([string]$Name, $Value) { $r.steps[$Name] = $Value; Write-Host ("[{0:HH:mm:ss}] {1}: {2}" -f (Get-Date), $Name, ($Value | ConvertTo-Json -Compress -Depth 5)) }
function Check([string]$Name, [bool]$Ok, $Detail) {
  $r.checks[$Name] = [ordered]@{ ok = $Ok; detail = $Detail }
  if (-not $Ok) { $r.failed += $Name }
  Write-Host ("[{0:HH:mm:ss}] {1} {2}: {3}" -f (Get-Date), $(if ($Ok) { "OK  " } else { "FAIL" }), $Name, ($Detail | ConvertTo-Json -Compress -Depth 4))
}
function Post([string]$Path, $Body) {
  try {
    $resp = Invoke-WebRequest -Uri ($Bridge + $Path) -Method Post -UseBasicParsing -TimeoutSec 30 `
      -ContentType "application/json" -Body ($Body | ConvertTo-Json -Compress)
    return ($resp.Content | ConvertFrom-Json)
  } catch {
    # PS 5.1 trzyma cialo odpowiedzi 4xx w ErrorDetails; strumien bywa juz zamkniety,
    # przez co pierwszy przebieg pokazal "(400) Bad Request" zamiast prawdziwego bledu.
    $txt = ""
    try { $txt = [string]$_.ErrorDetails.Message } catch { }
    if (-not $txt) { try { $txt = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch { } }
    if ($txt) { try { return ($txt | ConvertFrom-Json) } catch { return [pscustomobject]@{ ok = $false; error = $txt } } }
    return [pscustomobject]@{ ok = $false; error = $_.Exception.Message }
  }
}
function Get-Json([string]$Path, [int]$TimeoutSec = 30) {
  try { return (Invoke-WebRequest -Uri ($Bridge + $Path) -UseBasicParsing -TimeoutSec $TimeoutSec).Content | ConvertFrom-Json }
  catch { return [pscustomobject]@{ ok = $false; error = $_.Exception.Message } }
}

try {
  $setup = Join-Path $SetupDir "DAM-Setup.exe"
  $log = Join-Path $OutDir "install.log"
  $sig = Get-AuthenticodeSignature -LiteralPath $setup
  Step "signature" ([ordered]@{ status = [string]$sig.Status; subject = [string]$sig.SignerCertificate.Subject })
  # Czysty Windows 11 (Smart App Control / WDAC) odmawia uruchomienia pliku,
  # ktorego korzen nie jest zaufany. Self-signed cert = kazdy nowy uzytkownik
  # dostaje "Zasady kontroli aplikacji zablokowaly ten plik". Najpierw probujemy
  # tak, jak zrobi to uzytkownik; dopiero potem ufamy certowi, zeby dokonczyc test.
  $p = $null
  $blocked = ""
  try {
    $p = Start-Process -FilePath $setup -ArgumentList @("/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES", "/SP-", "/LOG=$log") -Wait -PassThru
  } catch {
    $blocked = $_.Exception.Message
  }
  Check "instalator-startuje-bez-zaufanego-certu" ([string]::IsNullOrEmpty($blocked)) $blocked
  $sac = 0
  try { $sac = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction Stop).VerifiedAndReputablePolicyState } catch { }
  Step "smart_app_control" $sac
  $app = Join-Path $env:LOCALAPPDATA "Programs\DAM"
  $viaPayload = $false
  if ($blocked) {
    # Smart App Control (SAC=1) nie przepuszcza pliku podpisanego certyfikatem
    # self-signed i NIE pomaga dodanie certu do zaufanych - polityka patrzy na
    # reputacje, nie na magazyn. Zeby sprawdzic reszte aplikacji, wykladamy
    # ladunek recznie i startujemy bundlowanym python.exe (podpis PSF = zaufany).
    if (-not (Test-Path -LiteralPath $PayloadDir)) { throw "instalator zablokowany (SAC=$sac) i brak $PayloadDir" }
    New-Item -ItemType Directory -Force -Path $app | Out-Null
    & robocopy $PayloadDir $app /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy ladunku zwrocil $LASTEXITCODE" }
    $viaPayload = $true
    Step "tryb_awaryjny" "ladunek skopiowany z $PayloadDir (instalator zablokowany przez App Control)"
  } else {
    Step "install_exit" $p.ExitCode
    Check "instalacja" ($p.ExitCode -eq 0) $p.ExitCode
  }
  $desk = Join-Path $app "bin\apps\desktop"
  $py = Join-Path $app "bin\runtime\win\python\python.exe"

  # Konto QA ze slabym haslem: tylko ten jednorazowy sandbox, lokalna baza SQLite.
  $qaPy = Join-Path $OutDir "qa-user.py"
  @"
import sys
sys.path.insert(0, r'$desk')
import auth_store
auth_store.init_db()
c = auth_store._connect()
c.execute("DELETE FROM users WHERE email = ?", ('qa.sandbox@kubara.pl',))
c.execute("INSERT INTO users (email, name, role, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
          ('qa.sandbox@kubara.pl', 'QA Sandbox', 'admin', auth_store._hash_password('test'), 't', 't'))
c.commit()
print('qa_user_ok', auth_store._use_pg())
"@ | Set-Content -LiteralPath $qaPy -Encoding UTF8
  Step "qa_user" ((& $py $qaPy 2>&1) -join " ")

  # Natywne rozszerzenia: bez nich aktywacja i Postgres ciche padaja.
  $impPy = Join-Path $OutDir "imports.py"
  @"
import sys
sys.path.insert(0, r'$desk')
for mod in ('cryptography.fernet', 'psycopg2', 'bcrypt', 'PIL.Image'):
    try:
        __import__(mod)
        print(mod, 'OK')
    except Exception as exc:
        print(mod, 'FAIL', type(exc).__name__, str(exc)[:120])
# pg_seal.unseal() lyka kazdy wyjatek i zwraca "code_invalid", wiec scrypt sprawdzamy jawnie.
try:
    import hashlib
    hashlib.scrypt(b'x', salt=b'y' * 16, n=2**15, r=8, p=1, dklen=32, maxmem=128 * 1024 * 1024)
    print('hashlib.scrypt', 'OK')
except Exception as exc:
    print('hashlib.scrypt', 'FAIL', type(exc).__name__, str(exc)[:120])
"@ | Set-Content -LiteralPath $impPy -Encoding UTF8
  $imports = @(& $py $impPy 2>&1)
  Step "importy" $imports
  # Setup normalnie instaluje VC++ Redistributable; tryb awaryjny go pomija. Instalujemy
  # tylko wtedy, gdy import naprawde pada, i z limitem czasu: 20.09.2026 "vc_redist /quiet"
  # wisial w piaskownicy ponad 4 minuty i blokowal caly test.
  # Blokada App Control to nie brak runtime'u - instalowanie VC++ nic nie da (sprawdzone
  # 20.09.2026: vc_redist exit 0, a _rust.pyd i _psycopg.pyd dalej zablokowane).
  $vc = Join-Path $PSScriptRoot "vc_redist.x64.exe"
  $blokadaCI = [bool]($imports -match "kontroli aplikacji|Application Control")
  if ($blokadaCI) { Step "pomijam_vc_redist" "przyczyna to App Control, nie brak VC++" }
  if ($viaPayload -and -not $blokadaCI -and ($imports -match "FAIL") -and (Test-Path -LiteralPath $vc)) {
    $vp = Start-Process -FilePath $vc -ArgumentList @("/install", "/quiet", "/norestart", "/log", (Join-Path $OutDir "vc_redist.log")) -PassThru
    if ($vp.WaitForExit(240000)) { Step "vc_redist_exit" $vp.ExitCode }
    else { Step "vc_redist_exit" "timeout 240 s"; try { $vp.Kill() } catch { } }
    $imports = @(& $py $impPy 2>&1)
    Step "importy_po_vc_redist" $imports
  }
  Check "natywne-biblioteki" (-not ($imports -match "FAIL")) @($imports | Where-Object { $_ -match "FAIL" })

  if ($viaPayload) {
    Start-Process -FilePath $py -ArgumentList (Join-Path $desk "serve_browser.py") -WorkingDirectory $desk -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $OutDir "serve-out.log") -RedirectStandardError (Join-Path $OutDir "serve-err.log") | Out-Null
  } else {
    Start-Process -FilePath (Join-Path $app "DAM.exe") -WorkingDirectory $app | Out-Null
  }
  $up = $false
  for ($i = 0; $i -lt 60 -and -not $up; $i++) {
    try { $null = Invoke-WebRequest -Uri ($Bridge + "/health") -UseBasicParsing -TimeoutSec 5; $up = $true } catch { Start-Sleep -Seconds 3 }
  }
  Step "bridge_up" $up
  Check "most-8766" $up "GET /health"
  if (-not $up) { throw "most nie wstal" }

  $code = (Get-Content -LiteralPath (Join-Path $SecretsDir "activation-code.txt") -Raw).Trim()
  $act = Post "/db/activate" @{ code = $code }
  Remove-Variable code
  Step "activate" $act
  Check "aktywacja-kodem" ([bool]$act.ok) $act.error

  # Po aktywacji kod odpieczetowuje pg-config: baza MUSI byc online.
  # 2.1.2 wyjechalo z nieaktualnym haslem i kazda czysta instalacja byla offline.
  $ping = $null
  for ($i = 0; $i -lt 10; $i++) {
    $ping = Get-Json "/db/ping"
    if ($ping.ok) { break }
    Start-Sleep -Seconds 3
  }
  Step "db_ping" $ping
  Check "baza-online" ([bool]$ping.ok) $ping.error

  $pre = Get-Json "/preflight"
  Step "preflight" ([ordered]@{ ok = $pre.ok; blocking = @($pre.blocking); items = @($pre.items | ForEach-Object { "$($_.key)=$($_.state)" }) })
  # Brak dysku Marketing to jedyny dozwolony blokier w piaskownicy.
  $badBlock = @($pre.blocking | Where-Object { $_ -notmatch "marketing|root|path" })
  Check "preflight-bez-blokierow" ($badBlock.Count -eq 0) $badBlock

  $noSkip = Post "/auth/login" @{ email = "qa.sandbox@kubara.pl"; password = "test" }
  Step "login_weak_no_skip" ([ordered]@{ ok = $noSkip.ok; error = $noSkip.error; can_skip = $noSkip.can_skip; beta = $noSkip.beta })
  Check "slabe-haslo-wymusza-zmiane" (($noSkip.error -eq "password_change_required") -and [bool]$noSkip.can_skip) $noSkip.error
  $skip = Post "/auth/login" @{ email = "qa.sandbox@kubara.pl"; password = "test"; skip_password_change = $true }
  Step "login_weak_skip" ([ordered]@{ ok = $skip.ok; has_token = [bool]$skip.token; error = $skip.error })
  Check "logowanie-z-pominieciem" ([bool]$skip.ok -and [bool]$skip.token) $skip.error
  $tok = [string]$skip.token

  # Watcher indeksu: rc<>0 = czerwony baner "Aktualizacja indeksu nie dziala" u kazdego.
  $ix = $null
  for ($i = 0; $i -lt 10; $i++) { $ix = Get-Json "/index/status"; if ($ix.last_error) { break }; Start-Sleep -Seconds 3 }
  Step "index_status" ([ordered]@{ watcher_ok = $ix.watcher_ok; stage = $ix.stage; last_error = $ix.last_error })
  Check "watcher-indeksu" (-not ($ix.last_error -match "watcher_exited")) $ix.last_error

  $pamiec = Join-Path $app "bin\PAMIEC-PODRECZNA"
  $idx = Get-Content -LiteralPath (Join-Path $pamiec "thumb-rel-index.bundled.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $rels = @($idx.PSObject.Properties.Name | Where-Object { $_ -like "*|grid" } | Select-Object -First $ThumbSample | ForEach-Object { $_.Substring(0, $_.Length - 5) })
  $t = [ordered]@{ tried = 0; thumb_ok = 0; media_cache = 0; media_img_cache = 0; max_ms = 0 }
  foreach ($rel in $rels) {
    $q = [uri]::EscapeDataString("X:/Marketing/" + $rel)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try { $a = Invoke-WebRequest -Uri "$Bridge/thumb-cache?profile=grid&path=$q" -UseBasicParsing -TimeoutSec 10; if ($a.StatusCode -eq 200) { $t.thumb_ok++ } } catch { }
    $sw.Stop(); if ($sw.ElapsedMilliseconds -gt $t.max_ms) { $t.max_ms = [int]$sw.ElapsedMilliseconds }
    try { $b = Invoke-WebRequest -Uri "$Bridge/media?preview=1&path=$q" -UseBasicParsing -TimeoutSec 10; if ($b.Headers["X-DAM-Source"] -eq "cache") { $t.media_cache++ } } catch { }
    try { $c = Invoke-WebRequest -Uri "$Bridge/media?path=$q" -Headers @{ "Sec-Fetch-Dest" = "image" } -UseBasicParsing -TimeoutSec 10; if ($c.Headers["X-DAM-Source"] -eq "cache") { $t.media_img_cache++ } } catch { }
    $t.tried++
  }
  $t.installed = @(Get-ChildItem -LiteralPath (Join-Path $pamiec "thumbs") -File).Count
  Step "thumbs" $t
  $lim = [int]($t.tried * 0.9)
  Check "miniatury-z-cache" ($t.thumb_ok -ge $lim -and $t.media_cache -ge $lim -and $t.media_img_cache -ge $lim) $t
  Check "cache-wgrany-przez-instalator" ($t.installed -ge 10000) $t.installed

  $av = Get-Json ("/file-availability?path=" + [uri]::EscapeDataString("X:/Marketing/" + $rels[0]))
  Step "file_availability" ([ordered]@{ state = $av.state; label = $av.label_pl })

  # Dane kazdego ekranu: instalacja ma je miec od razu, bez dysku Marketing.
  $api = [ordered]@{}
  $endpoints = [ordered]@{
    "file-index"          = "/file-index"
    "viz-latest"          = "/file-index/viz-latest"
    # /branding-index bez ?full=1 zwraca 403 celowo (dump ~340 MB zamraza UI).
    # Panel czyta te dwa:
    "branding-grid-index" = "/branding-grid-index"
    "branding-grid-head"  = "/branding-grid-head"
    "product-catalog"     = "/product-catalog"
    "product-lifecycle"   = "/product-lifecycle"
    "lifecycle-status"    = "/lifecycle-status"
    "program-instructions"= "/program-instructions"
    "campaigns"           = "/change-log"
    "invoices"            = "/finance/invoices"
    "cost-rates"          = "/finance/cost-rates"
    "fmcg-catalog"        = "/finance/fmcg-catalog"
    "inbox"               = "/inbox-items"
    "wykrojniki"          = "/wykrojniki-registry"
    "integracje"          = "/integrations/status"
    "thumb-cache-status"  = "/thumb-cache/status"
    "user-prefs"          = "/user-prefs"
    "auth-me"             = "/auth/me"
    "machine-config"      = "/machine-config"
    "app-update"          = "/app-update/status"
  }
  foreach ($k in $endpoints.Keys) {
    $u = $Bridge + $endpoints[$k]
    try {
      $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 60 -Headers @{ Authorization = "Bearer $tok" }
      $api[$k] = [ordered]@{ status = [int]$resp.StatusCode; bytes = $resp.RawContentLength }
    } catch {
      $sc = 0; try { $sc = [int]$_.Exception.Response.StatusCode } catch { }
      $api[$k] = [ordered]@{ status = $sc; error = $_.Exception.Message }
    }
  }
  Step "api" $api
  $apiBad = @($api.Keys | Where-Object { $api[$_].status -ne 200 })
  Check "endpointy-danych" ($apiBad.Count -eq 0) $apiBad

  # UI: strona pomocnicza loguje przez most (z pominieciem) i przechodzi na podany ekran.
  $web = Join-Path $app "bin\apps\web"
  @'
<!doctype html><meta charset="utf-8"><script>
var next = new URLSearchParams(location.search).get("next") || "visualizations.html";
fetch("http://127.0.0.1:8766/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "qa.sandbox@kubara.pl", password: "test", skip_password_change: true }) })
  .then(function (r) { return r.json(); }).then(function (d) {
    if (!d.token) { document.body.textContent = "LOGIN FAIL " + JSON.stringify(d); return; }
    localStorage.setItem("dam_token", d.token);
    sessionStorage.setItem("dam_basepath_later", "1");
    ["device_id", "machine_id", "session_id"].forEach(function (k) { if (d[k]) localStorage.setItem("dam_" + k, d[k]); });
    if (d.user) { localStorage.setItem("dam_role", d.user.role || "admin"); localStorage.setItem("dam_user_name", d.user.name || "");
      localStorage.setItem("dam_user", JSON.stringify({ email: d.user.email || "", name: d.user.name || "", role: d.user.role || "" })); }
    location.replace(next);
  });
</script>
'@ | Set-Content -LiteralPath (Join-Path $web "_qa-autologin.html") -Encoding UTF8
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  Check "edge-obecny" ([bool]$edge) $edge
  $prof = Join-Path $env:TEMP "dam-qa-edge"
  # Kazda strona panelu, nie tylko trzy. signin/index pomijamy: to przekierowania.
  $pages = @(Get-ChildItem -LiteralPath $web -Filter "*.html" -File |
      Where-Object { $_.BaseName -notmatch '^(index|signin|signin-geex|_qa-autologin)$' -and $_.BaseName -notmatch 'Conflict' } |
      ForEach-Object { $_.Name } | Sort-Object)
  $shots = @()
  foreach ($page in $pages) {
    $base = $page -replace "\.html$", ""
    $png = Join-Path $OutDir ("ui-" + $base + ".png")
    $dom = Join-Path $OutDir ("dom-" + $base + ".html")
    $err = Join-Path $OutDir ("edge-" + $base + ".log")
    $argsCommon = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=$prof",
      "--window-size=1440,2200", "--virtual-time-budget=25000", "--enable-logging=stderr", "--v=0")
    # Edge pisze ostrzezenia na stderr; w PS 5.1 z ErrorAction Stop to byl wyjatek.
    Start-Process -FilePath $edge -Wait -WindowStyle Hidden -RedirectStandardError $err -ArgumentList ($argsCommon + @("--screenshot=$png", "$Ui/_qa-autologin.html?next=$page"))
    Start-Process -FilePath $edge -Wait -WindowStyle Hidden -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $OutDir "edge-dom.log") -ArgumentList ($argsCommon + @("--dump-dom", "$Ui/_qa-autologin.html?next=$page"))
    $html = if (Test-Path $dom) { Get-Content -LiteralPath $dom -Raw -Encoding UTF8 } else { "" }
    $errTxt = if (Test-Path $err) { Get-Content -LiteralPath $err -Raw } else { "" }
    $shots += [ordered]@{
      page       = $page
      png_bytes  = $(if (Test-Path $png) { (Get-Item $png).Length } else { 0 })
      dom_bytes  = $html.Length
      # Liczymy TYLKO realne zaslepki kafelkow, nie kazde wystapienie tekstu.
      # settings.html cytuje "Brak miniatury" w tresci instrukcji programu - to nie dziura.
      # Branding renderuje "Podgląd niedostępny" w <span>; wersaliki robi CSS, wiec DOM ma male litery.
      brak_thumb = ([regex]::Matches($html, 'text-anchor="middle"[^>]*>Brak miniatury<')).Count
      brak_podgl = ([regex]::Matches($html, '<span>Podgl[aą]d niedost[eę]pny</span>')).Count
      tylko_online = ([regex]::Matches($html, '<span>Tylko online</span>')).Count
      js_errors  = ([regex]::Matches($errTxt, "SEVERE|Uncaught|ERR_")).Count
      login_fail = ($html -match "LOGIN FAIL")
    }
  }
  Step "screenshots" $shots
  $noPng = @($shots | Where-Object { $_.png_bytes -lt 20000 } | ForEach-Object { $_.page })
  Check "zrzut-kazdej-strony" ($noPng.Count -eq 0) $noPng
  $emptyDom = @($shots | Where-Object { $_.dom_bytes -lt 5000 -or $_.login_fail } | ForEach-Object { $_.page })
  Check "strona-sie-renderuje" ($emptyDom.Count -eq 0) $emptyDom
  $jsBad = @($shots | Where-Object { $_.js_errors -gt 0 } | ForEach-Object { "$($_.page)=$($_.js_errors)" })
  Check "brak-bledow-konsoli" ($jsBad.Count -eq 0) $jsBad
  $holes = @($shots | Where-Object { ($_.brak_thumb + $_.brak_podgl) -gt 0 } | ForEach-Object { "$($_.page): brak_miniatury=$($_.brak_thumb) brak_podgladu=$($_.brak_podgl)" })
  Check "kazdy-kafelek-ma-podglad" ($holes.Count -eq 0) $holes
  # "Tylko online" to poprawny stan (plik niepobrany z Synology), nie defekt - raportujemy osobno.
  Step "kafelki_tylko_online" @($shots | Where-Object { $_.tylko_online -gt 0 } | ForEach-Object { "$($_.page)=$($_.tylko_online)" })

  $r.result = $(if ($r.failed.Count -eq 0) { "PASS" } else { "FAIL" })
} catch {
  $r.error = $_.Exception.Message
  $r.failed += "wyjatek"
} finally {
  $r.finished_at = (Get-Date).ToString("s")
  $r | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir "e2e.json") -Encoding UTF8
  Write-Host ("WYNIK: {0}  nieudane: {1}" -f $r.result, ($r.failed -join ", "))
  try { Stop-Transcript | Out-Null } catch { }
}
