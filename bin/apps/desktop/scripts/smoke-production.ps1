#Requires -Version 5.1
<#
.SYNOPSIS
  Production smoke (Gate B) dla DAM - Dobra Kaloria - Inyfinn.
.DESCRIPTION
  Sprawdza most 8766, UI 8765, status plikow/bazy/meta oraz flage slabego hasla seed.
  Exit 0 = wszystkie PASS (WARN dozwolone). Exit 1 = FAIL krytyczny.
#>
param(
  [string]$Bridge = "http://127.0.0.1:8766",
  [string]$Ui = "http://127.0.0.1:8765",
  [switch]$StrictPasswords,
  [string]$SeedEmail = "krzysztof.wieczorek@kubara.pl",
  # Haslo do proby logowania. Nigdy w kodzie: zmienna DAM_SMOKE_WEAK_PASSWORD
  # albo zapytanie przy uruchomieniu recznym. Puste = kontrola pominieta.
  [string]$WeakPassword = ""
)

$ErrorActionPreference = "Continue"
$fail = 0
$warn = 0

function Write-Check([string]$name, [string]$status, [string]$detail = "") {
  $line = "[{0}] {1}" -f $status, $name
  if ($detail) { $line += " - $detail" }
  Write-Host $line
}

function Get-Json([string]$url) {
  try {
    return Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 8
  } catch {
    return $null
  }
}

function Post-Json([string]$url, $body) {
  try {
    $json = $body | ConvertTo-Json -Compress
    return Invoke-RestMethod -Uri $url -Method Post -Body $json -ContentType "application/json" -TimeoutSec 12
  } catch {
    return $null
  }
}

Write-Host "=== DAM smoke-production ==="
Write-Host "Bridge: $Bridge"
Write-Host "UI:     $Ui"
Write-Host ""

# B1 health
$health = Get-Json "${Bridge}/health"
if ($health -and ($health.ok -eq $true -or $health.status -eq "ok" -or $health -is [object])) {
  Write-Check "bridge /health" "PASS"
} else {
  # niektore buildy zwracaja surowy tekst
  try {
    $r = Invoke-WebRequest -Uri "${Bridge}/health" -UseBasicParsing -TimeoutSec 8
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
      Write-Check "bridge /health" "PASS" "HTTP $($r.StatusCode)"
    } else {
      Write-Check "bridge /health" "FAIL" "HTTP $($r.StatusCode)"
      $fail++
    }
  } catch {
    Write-Check "bridge /health" "FAIL" $_.Exception.Message
    $fail++
  }
}

# B2 files (wymaga root z machine-config)
$cfg = Get-Json "${Bridge}/machine-config"
$root = ""
if ($cfg) {
  if ($cfg.base_path) { $root = [string]$cfg.base_path }
  elseif ($cfg.root) { $root = [string]$cfg.root }
}
if (-not $root) { $root = "X:\Marketing" }
$filesUrl = "${Bridge}/files/status?root=" + [uri]::EscapeDataString($root)
$files = Get-Json $filesUrl
if ($files -and $files.online) {
  Write-Check "files online" "PASS" ($files.root -or $root)
} elseif ($files) {
  Write-Check "files online" "WARN" "offline - wskaz Marketing ($root)"
  $warn++
} else {
  Write-Check "files /status" "FAIL" "brak odpowiedzi ($filesUrl)"
  $fail++
}

# B3 db
$db = Get-Json "${Bridge}/db/status"
if ($db -and $db.online) {
  Write-Check "db online" "PASS" ($db.engine -or $db.driver -or "")
} elseif ($db) {
  Write-Check "db online" "WARN" "offline/SQLite - akceptuj swiadomie"
  $warn++
} else {
  Write-Check "db /status" "FAIL" "brak odpowiedzi"
  $fail++
}

# B4 meta
$meta = Get-Json "${Bridge}/meta/status"
if ($meta -and ($meta.synced -eq $true -or $meta.ok -eq $true)) {
  $detail = "products=$($meta.products) revisions=$($meta.revisions) files=$($meta.files)"
  Write-Check "meta synced" "PASS" $detail
} elseif ($meta) {
  Write-Check "meta synced" "WARN" ($meta | ConvertTo-Json -Compress)
  $warn++
} else {
  Write-Check "meta /status" "WARN" "endpoint niedostepny"
  $warn++
}

# B5 registration closed
$reg = Get-Json "${Bridge}/auth/registration-open"
if ($reg -and $reg.open -eq $false) {
  Write-Check "public register closed" "PASS" "users=$($reg.users)"
} elseif ($reg -and $reg.open -eq $true) {
  Write-Check "public register closed" "WARN" "bootstrap - pierwsze konto admin"
  $warn++
} else {
  Write-Check "public register closed" "WARN" "brak endpointu (UI i tak ukrywa rejestracje)"
  $warn++
}

# B6 stare haslo seed nie moze juz dzialac (haslo podaje operator, nie ten plik)
$probe = $WeakPassword
if (-not $probe) { $probe = [string]$env:DAM_SMOKE_WEAK_PASSWORD }
if (-not $probe -and [Environment]::UserInteractive) {
  $sec = Read-Host "Stare haslo seed do sprawdzenia (Enter = pomin)" -AsSecureString
  if ($sec -and $sec.Length -gt 0) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
      $probe = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}
if (-not $probe) {
  Write-Check "seed password rotated" "WARN" "pominieto - podaj DAM_SMOKE_WEAK_PASSWORD albo -WeakPassword"
  $warn++
} else {
  $weak = Post-Json "${Bridge}/auth/login" @{
    email = $SeedEmail
    password = $probe
    device_id = "smoke-prod"
    machine_id = "smoke-prod"
  }
  $probe = $null
  if ($weak -and $weak.ok -eq $true) {
    $msg = "konto $SeedEmail nadal przyjmuje podane haslo - uruchom set-all-passwords.py"
    if ($StrictPasswords) {
      Write-Check "seed password rotated" "FAIL" $msg
      $fail++
    } else {
      Write-Check "seed password rotated" "WARN" $msg
      $warn++
    }
  } elseif ($weak -and $weak.error -eq "password_change_required") {
    Write-Check "seed password rotated" "WARN" "haslo dziala, ale polityka wymusza zmiane przy logowaniu"
    $warn++
  } else {
    Write-Check "seed password rotated" "PASS" "podane haslo odrzucone (lub konto niedostepne)"
  }
}

# B7 UI (curl.exe - unikamy quirkow Invoke-WebRequest przy HTML)
try {
  $uiUrl = "${Ui}/signin.html?v=golive1"
  $tmp = [System.IO.Path]::GetTempFileName()
  $curlArgs = @("-sS", "-L", "-o", $tmp, "-w", "%{http_code}", "--max-time", "8", $uiUrl)
  $codeStr = & curl.exe @curlArgs 2>$null
  $code = 0
  [void][int]::TryParse(([string]$codeStr).Trim(), [ref]$code)
  $body = ""
  if (Test-Path $tmp) {
    $body = [System.IO.File]::ReadAllText($tmp)
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
  $okBody = ($body -like "*Witaj w DAM*") -or ($body -like "*DAM - Dobra Kaloria*")
  if ($code -ge 200 -and $code -lt 300 -and $okBody) {
    if ($body -like "*DAM ETA*") {
      Write-Check "UI signin branding" "WARN" "nadal zawiera 'DAM ETA'"
      $warn++
    } else {
      Write-Check "UI signin" "PASS" "HTTP $code"
    }
  } else {
    Write-Check "UI signin" "FAIL" "HTTP $code len=$($body.Length)"
    $fail++
  }
} catch {
  Write-Check "UI :8765" "FAIL" $_.Exception.Message
  $fail++
}

# B8 media jail
try {
  $m = Invoke-WebRequest -Uri "${Bridge}/media?path=test" -UseBasicParsing -TimeoutSec 8
  if ($m.StatusCode -eq 401 -or $m.StatusCode -eq 403) {
    Write-Check "media requires auth" "PASS" "HTTP $($m.StatusCode)"
  } else {
    Write-Check "media requires auth" "WARN" "HTTP $($m.StatusCode)"
    $warn++
  }
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 401 -or $code -eq 403) {
    Write-Check "media requires auth" "PASS" "HTTP $code"
  } else {
    Write-Check "media requires auth" "WARN" $_.Exception.Message
    $warn++
  }
}

Write-Host ""
Write-Host ("Wynik: FAIL={0} WARN={1}" -f $fail, $warn)
if ($fail -gt 0) {
  Write-Host "GO-LIVE: BLOKADA (napraw FAIL)"
  exit 1
}
Write-Host "GO-LIVE: Gate B smoke OK (sprawdz WARN przed oddaniem)"
exit 0
