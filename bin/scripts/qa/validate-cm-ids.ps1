# validate-cm-ids.ps1 — plan §5.F: undefined CM-ID = FAIL
# Expected: exit 0; unresolved = 0
param(
    [string]$PlanPath = "C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md",
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path,
    [switch]$VerboseReport
)

$ErrorActionPreference = "Stop"

$Allowlist = @(
    "CM1a",
    "CM-double-bootstrap",
    "CM-bypass",
    "CM-slow-VM",
    "CM-hijack",
    "CM12a",
    "CM-heal-missing_runtime",
    "CM-heal-vcredist",
    "CM-heal-webview2",
    "CM-heal-corrupt_manifest",
    "CM-heal-db_config",
    "CM-heal-network",
    "CM7a",
    "CM7b",
    "CM7c",
    "CM7d",
    "CM7e",
    "CM8",
    "CM5p",
    "CM10",
    "CM10b",
    "CM13",
    "CM-REG-1",
    "CM-REG-2",
    "verify-manifest",
    "CM5",
    "CM6",
    "CM12b",
    "CM3",
    "CM4b"
) | Sort-Object -Unique

if ($Allowlist.Count -ne 30) {
    Write-Error "Allowlist must contain exactly 30 IDs; got $($Allowlist.Count)"
}

$allowSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($id in $Allowlist) { [void]$allowSet.Add($id) }

function Get-CmTokensFromText {
    param([string]$Text)
    $found = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    if ([string]::IsNullOrEmpty($Text)) { return $found }

    $cmPattern = '\bCM(?:\d[a-zA-Z0-9]*|-[A-Za-z0-9-]+)\b'
    foreach ($m in [regex]::Matches($Text, $cmPattern)) {
        $token = $m.Value
        if ($token -match '^CM1-profile') { continue }
        if ($token -eq 'CMYK') { continue }
        if ($token -eq 'CM1') { continue }
        if ($token -match '-$') { continue }
        if ($token -eq 'CM-heal') { continue }
        [void]$found.Add($token)
    }
    if ($Text -match '\bverify-manifest\b') {
        [void]$found.Add("verify-manifest")
    }
    return $found
}

function Get-KrokMatrixSections {
    param([string[]]$Lines)
    $headers = @(
        "### KROK 15",
        "### KROK 17",
        "### KROK 19",
        "### KROK 20"
    )
    $sections = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        $line = $Lines[$i]
        $isHeader = $false
        foreach ($h in $headers) {
            if ($line.StartsWith($h)) { $isHeader = $true; break }
        }
        if (-not $isHeader) { continue }
        $buf = New-Object System.Text.StringBuilder
        [void]$buf.AppendLine($line)
        for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
            $next = $Lines[$j]
            if ($next -match '^### KROK \d+' -and -not ($headers | Where-Object { $next.StartsWith($_) })) {
                break
            }
            if ($next -match '^## \d+\.' ) { break }
            [void]$buf.AppendLine($next)
        }
        [void]$sections.Add($buf.ToString())
    }
    return ($sections -join "`n")
}

$unresolved = New-Object System.Collections.Generic.List[string]
$report = New-Object System.Collections.Generic.List[object]

if (-not (Test-Path -LiteralPath $PlanPath)) {
    Write-Error "Plan not found: $PlanPath"
}

$planLines = Get-Content -LiteralPath $PlanPath -Encoding UTF8
$planText = $planLines -join "`n"
$krokText = Get-KrokMatrixSections -Lines $planLines
$planTokens = Get-CmTokensFromText -Text $krokText
foreach ($t in $planTokens) {
    if (-not $allowSet.Contains($t)) {
        [void]$unresolved.Add("plan:KROK-matrix:$t")
    }
}

$cmRoot = Join-Path $RepoRoot "dist\evidence\cm"
if (Test-Path -LiteralPath $cmRoot) {
    Get-ChildItem -LiteralPath $cmRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $dirName = $_.Name
        if (-not $allowSet.Contains($dirName)) {
            [void]$unresolved.Add("evidence-dir:$dirName")
        }
    }
}

$extraFiles = @(
    (Join-Path $RepoRoot "dist\evidence\DOD-PACK.md"),
    (Join-Path $RepoRoot "process.md")
)
foreach ($fp in $extraFiles) {
    if (-not (Test-Path -LiteralPath $fp)) { continue }
    $tokens = Get-CmTokensFromText -Text (Get-Content -LiteralPath $fp -Raw -Encoding UTF8)
    foreach ($t in $tokens) {
        if (-not $allowSet.Contains($t)) {
            [void]$unresolved.Add("file:$([IO.Path]::GetFileName($fp)):$t")
        }
    }
}

$distinctUnresolved = $unresolved | Sort-Object -Unique

Write-Host "validate-cm-ids: allowlist=$($Allowlist.Count) plan=$PlanPath"
Write-Host "referenced-in-KROK-matrix: $($planTokens.Count) token(s)"
Write-Host "unresolved: $($distinctUnresolved.Count)"

if ($VerboseReport) {
    $Allowlist | ForEach-Object { Write-Host "  allow: $_" }
    $distinctUnresolved | ForEach-Object { Write-Host "  FAIL: $_" }
}

if ($distinctUnresolved.Count -gt 0) {
    $distinctUnresolved | ForEach-Object { Write-Host "UNRESOLVED: $_" }
    exit 1
}

Write-Host "OK: all CM references resolved (0 unresolved)"
exit 0

