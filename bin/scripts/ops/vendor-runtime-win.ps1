#Requires -Version 5.1
<#
.SYNOPSIS
  Vendor Windows embeddable CPython + site-packages into bin/runtime/win/python.
  Run on build machine only (needs network). End-user machines do NOT run this.
#>
$ErrorActionPreference = "Stop"

$GitRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$ContentRoot = Join-Path $GitRoot "bin"
$PyVer = "3.12.10"
$EmbedName = "python-$PyVer-embed-amd64.zip"
$EmbedUrl = "https://www.python.org/ftp/python/$PyVer/$EmbedName"
$Downloads = Join-Path $ContentRoot "tooling\downloads"
$RuntimePy = Join-Path $ContentRoot "runtime\win\python"
$ReqCore = Join-Path $ContentRoot "apps\desktop\requirements-portable.txt"
$ReqFull = Join-Path $ContentRoot "apps\desktop\requirements.txt"
$HostPy = $null

foreach ($c in @(
    "$env:LocalAppData\Programs\Python\Python312\python.exe",
    "$env:LocalAppData\Programs\Python\Python313\python.exe",
    "py",
    "python"
  )) {
  try {
    if ($c -eq "py" -or $c -eq "python") {
      $v = & $c -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $v) { $HostPy = $v.Trim(); break }
    } elseif (Test-Path $c) {
      $HostPy = $c
      break
    }
  } catch {}
}
if (-not $HostPy) { throw "Brak host Python do pip --target (build machine)." }

New-Item -ItemType Directory -Force -Path $Downloads | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $RuntimePy) | Out-Null

$zipPath = Join-Path $Downloads $EmbedName
if (-not (Test-Path $zipPath)) {
  Write-Host "Downloading $EmbedUrl ..."
  Invoke-WebRequest -Uri $EmbedUrl -OutFile $zipPath -UseBasicParsing
}

# Zasada 0 (~/.claude/CLAUDE.md): build NIGDY nie kasuje rekurencyjnie. 2026-09-22 ten
# krok robil Remove-Item -Recurse na runtime\win\python przy kazdym buildzie. Teraz stary
# katalog jest tylko PRZEMIANOWANY; usuwa go czlowiek przez Kosz (send-to-trash.ps1).
if (Test-Path $RuntimePy) {
  $oldName = (Split-Path $RuntimePy -Leaf) + ".old-" + (Get-Date -Format "yyyyMMdd-HHmmss")
  Rename-Item -LiteralPath $RuntimePy -NewName $oldName
  Write-Host "Poprzedni runtime przemianowany: $(Join-Path (Split-Path $RuntimePy) $oldName) (usun recznie przez Kosz)"
}
New-Item -ItemType Directory -Force -Path $RuntimePy | Out-Null
Write-Host "Expanding embed zip..."
Expand-Archive -LiteralPath $zipPath -DestinationPath $RuntimePy -Force

$pth = Get-ChildItem -LiteralPath $RuntimePy -Filter "python*._pth" | Select-Object -First 1
if (-not $pth) { throw "Brak python*._pth w embed" }
$zipDll = Get-ChildItem -LiteralPath $RuntimePy -Filter "python*.zip" | Select-Object -First 1
$pthLines = @()
if ($zipDll) { $pthLines += $zipDll.Name }
$pthLines += "."
$pthLines += "Lib\site-packages"
$pthLines += "import site"
[System.IO.File]::WriteAllText($pth.FullName, ($pthLines -join "`r`n") + "`r`n", [System.Text.UTF8Encoding]::new($false))

$site = Join-Path $RuntimePy "Lib\site-packages"
New-Item -ItemType Directory -Force -Path $site | Out-Null

$req = if (Test-Path $ReqCore) { $ReqCore } else { $ReqFull }
Write-Host "pip install --target=$site -r $req (host=$HostPy)"
& $HostPy -m pip install --upgrade --disable-pip-version-check --target $site -r $req
if ($LASTEXITCODE -ne 0) { throw "pip install failed: $LASTEXITCODE" }

$embedPy = Join-Path $RuntimePy "python.exe"
$embedPyw = Join-Path $RuntimePy "pythonw.exe"
if (-not (Test-Path $embedPy)) { throw "Brak python.exe w runtime" }
if (-not (Test-Path $embedPyw)) { throw "Brak pythonw.exe w runtime" }

Write-Host "Smoke import webview + bcrypt..."
& $embedPy -c "import webview, bcrypt; print('portable_ok', webview.__file__)"
if ($LASTEXITCODE -ne 0) { throw "Smoke import failed" }

$size = (Get-ChildItem -LiteralPath $RuntimePy -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("OK runtime size_mb={0:N1}" -f ($size / 1MB))
Write-Host "Runtime: $RuntimePy"

