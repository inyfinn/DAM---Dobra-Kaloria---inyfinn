<#
.SYNOPSIS
    Porownuje zlota aplikacje DAM (z folderem Marketing/ROOT) z kopia BEZ ROOT:
    zrzuty ekranu + liczby widoczne w DOM, dla kompletu stron.

.DESCRIPTION
    Dla kazdej strony z listy robi:
      - zrzut + eval parity.js na zlotej aplikacji (:8765 UI, :8766 most)
      - zrzut + eval parity.js na kopii bez ROOT (:9765 UI, :9766 most)
    Zapisuje do -OutDir: <strona>-gold.png, <strona>-noroot.png, parity.json (wszystko razem),
    roznice.md (tylko pola, ktore sie roznia).

    Zlotej aplikacji NIE dotyka - tylko czyta przez HTTP. Kopie bez ROOT probuje
    wystartowac (idempotentnie, przez start-noroot.ps1) jesli porty nie odpowiadaja.

.PARAMETER App
    Folder kopii DAM bez ROOT (do ewentualnego auto-startu przez start-noroot.ps1).

.PARAMETER OutDir
    Folder wynikowy (PNG + parity.json + roznice.md). Domyslnie scratchpad tej sesji QA.

.EXAMPLE
    .\run-parity.ps1 -OutDir "C:\...\scratchpad\parity"
#>
param(
    [string]$App = "C:\Users\krzysztof.wieczorek\AppData\Local\DAM-bezroot-test",
    [Parameter(Mandatory = $true)]
    [string]$OutDir,
    [int]$GoldPort = 8765,
    [int]$NorootPort = 9765,
    [int]$GoldBridgePort = 8766,
    [int]$NorootBridgePort = 9766
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

function Test-PortOpen($port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(800)
        if ($ok -and $c.Connected) { $c.Close(); return $true }
        $c.Close()
        return $false
    } catch { return $false }
}

# --- Zlota aplikacja: TYLKO sprawdzamy, nigdy nie startujemy/nie dotykamy. ---
if (-not (Test-PortOpen $GoldPort) -or -not (Test-PortOpen $GoldBridgePort)) {
    Write-Error "Zlota aplikacja nie odpowiada na $GoldPort/$GoldBridgePort. Ten skrypt jej nie uruchamia - uruchom recznie."
    exit 1
}

# --- Kopia bez ROOT: startujemy idempotentnie, jesli trzeba. ---
if (-not (Test-PortOpen $NorootPort) -or -not (Test-PortOpen $NorootBridgePort)) {
    Write-Host "[run-parity] Kopia bez ROOT nie odpowiada - startuje przez start-noroot.ps1..."
    & (Join-Path $here "start-noroot.ps1") -App $App -BridgePort $NorootBridgePort -WebPort $NorootPort
    Start-Sleep -Seconds 3
}

if (-not (Test-PortOpen $NorootPort) -or -not (Test-PortOpen $NorootBridgePort)) {
    Write-Error "Kopia bez ROOT nadal nie odpowiada po probie startu."
    exit 1
}

# --- Lista stron do porownania ---
$pages = @(
    @{ Name = "index"; Path = "index.html"; Wait = 9000 },
    @{ Name = "visualizations"; Path = "visualizations.html"; Wait = 9000 },
    @{ Name = "branding"; Path = "branding.html"; Wait = 9000 },
    @{ Name = "explorer"; Path = "explorer.html"; Wait = 9000 },
    @{ Name = "project-figa-z-makiem"; Path = "project.html?id=figa-z-makiem-owocowe"; Wait = 14000 },
    @{ Name = "project-tuba-mix"; Path = "project.html?id=mix-tuba-30-szt-mixy"; Wait = 14000 }
)

$evalFile = Join-Path $here "parity.js"
$shotJs = Join-Path $here "shot.js"
$node = "node"

function Invoke-Shot($target, $url, $outPng, $wait) {
    $args = @("--target", $target, $url, $outPng, "1530", "1170", "$wait", $evalFile)
    $raw = & $node $shotJs @args 2>&1
    $evalLine = $raw | Where-Object { $_ -match "^EVAL:\s*(.*)$" } | Select-Object -Last 1
    $evalJson = $null
    if ($evalLine) {
        $jsonText = $evalLine -replace "^EVAL:\s*", ""
        try { $evalJson = $jsonText | ConvertFrom-Json -ErrorAction Stop } catch { $evalJson = $null }
    }
    return [pscustomobject]@{
        Raw   = ($raw -join "`n")
        Eval  = $evalJson
        PngOk = (Test-Path $outPng) -and ((Get-Item $outPng).Length -gt 0)
    }
}

$results = @{}

foreach ($p in $pages) {
    $name = $p.Name
    $goldUrl = "http://127.0.0.1:$GoldPort/$($p.Path)"
    $norootUrl = "http://127.0.0.1:$NorootPort/$($p.Path)"
    $goldPng = Join-Path $OutDir "$name-gold.png"
    $norootPng = Join-Path $OutDir "$name-noroot.png"

    Write-Host "[run-parity] $name : gold ..."
    $goldRes = Invoke-Shot "gold" $goldUrl $goldPng $p.Wait
    Write-Host "[run-parity] $name : noroot ..."
    $norootRes = Invoke-Shot "noroot" $norootUrl $norootPng $p.Wait

    $results[$name] = [ordered]@{
        gold_url     = $goldUrl
        noroot_url   = $norootUrl
        gold_png     = $goldPng
        noroot_png   = $norootPng
        gold_eval    = $goldRes.Eval
        noroot_eval  = $norootRes.Eval
        gold_png_ok  = $goldRes.PngOk
        noroot_png_ok = $norootRes.PngOk
    }
}

$parityJsonPath = Join-Path $OutDir "parity.json"
$results | ConvertTo-Json -Depth 12 | Set-Content -Path $parityJsonPath -Encoding utf8

# --- roznice.md: tylko pola ktore sie roznia ---
function Flatten($obj, $prefix) {
    $out = @{}
    if ($null -eq $obj) { return $out }
    if ($obj -is [System.Management.Automation.PSCustomObject]) {
        foreach ($prop in $obj.PSObject.Properties) {
            $sub = Flatten $prop.Value ("$prefix.$($prop.Name)")
            foreach ($k in $sub.Keys) { $out[$k] = $sub[$k] }
        }
    } elseif ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
        $i = 0
        foreach ($item in $obj) {
            $sub = Flatten $item ("$prefix[$i]")
            foreach ($k in $sub.Keys) { $out[$k] = $sub[$k] }
            $i++
        }
        if ($i -eq 0) { $out[$prefix] = "[]" }
    } else {
        $out[$prefix] = $obj
    }
    return $out
}

$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine("# Roznice gold vs noroot")
[void]$md.AppendLine("")
[void]$md.AppendLine("Wygenerowano: $(Get-Date -Format o)")
[void]$md.AppendLine("")

foreach ($name in $results.Keys) {
    $r = $results[$name]
    [void]$md.AppendLine("## $name")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("- gold PNG ok: $($r.gold_png_ok) | noroot PNG ok: $($r.noroot_png_ok)")

    $goldFlat = Flatten $r.gold_eval "eval"
    $norootFlat = Flatten $r.noroot_eval "eval"
    $keys = ($goldFlat.Keys + $norootFlat.Keys) | Sort-Object -Unique | Where-Object { $_ -ne "eval.url" }

    $anyDiff = $false
    foreach ($k in $keys) {
        $gv = if ($goldFlat.ContainsKey($k)) { $goldFlat[$k] } else { $null }
        $nv = if ($norootFlat.ContainsKey($k)) { $norootFlat[$k] } else { $null }
        if ("$gv" -ne "$nv") {
            $anyDiff = $true
            [void]$md.AppendLine("- **$k**: gold=`"$gv`" | noroot=`"$nv`"")
        }
    }
    if (-not $anyDiff) {
        [void]$md.AppendLine("- (brak roznic w polach eval)")
    }
    [void]$md.AppendLine("")
}

$roznicePath = Join-Path $OutDir "roznice.md"
Set-Content -Path $roznicePath -Value $md.ToString() -Encoding utf8

Write-Host "[run-parity] Gotowe. parity.json: $parityJsonPath"
Write-Host "[run-parity] roznice.md: $roznicePath"
