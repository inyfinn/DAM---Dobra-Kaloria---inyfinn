#Requires -Version 5.1
# Probuje wylaczyc Smart App Control / WDAC w piaskownicy i raportuje, co zadzialalo.
# Tylko do testow w jednorazowej Piaskownicy - nigdy na maszynie uzytkownika.
$Out = "C:\dam-results"
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$d = [ordered]@{}
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$d.user = $id.Name
$d.elevated = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
try { $d.sac_przed = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy").VerifiedAndReputablePolicyState } catch { $d.sac_przed = "$($_.Exception.Message)" }

$d.polityki = @()
try {
  $raw = & CiTool.exe --list-policies --json 2>&1 | Out-String
  $j = $raw | ConvertFrom-Json
  foreach ($p in $j.Policies) {
    $d.polityki += [ordered]@{ id = $p.PolicyID; nazwa = $p.FriendlyName; baza = $p.IsSystemPolicy; wymusza = $p.IsEnforced; odwolywalna = $p.IsAuthorized }
  }
} catch { $d.polityki_blad = "$($_.Exception.Message)"; $d.citool_raw = $raw }

# Proba usuniecia kazdej polityki, ktora nie jest systemowa
$d.usuniete = @()
foreach ($p in $d.polityki) {
  if ($p.baza) { continue }
  $r = & CiTool.exe --remove-policy $p.id 2>&1 | Out-String
  $d.usuniete += "$($p.nazwa) [$($p.id)] -> $($r.Trim())"
}

# Plikowe polityki CI (SAC lezy w CiPolicies\Active jako .cip)
$act = "C:\Windows\System32\CodeIntegrity\CiPolicies\Active"
try { $d.cip = @(Get-ChildItem -LiteralPath $act -Filter *.cip -ErrorAction Stop | ForEach-Object { $_.Name }) } catch { $d.cip = "$($_.Exception.Message)" }

# Rejestr: 0 = wylaczony (skutkuje po restarcie, ale probujemy)
foreach ($kv in @(
    @{ p = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"; n = "VerifiedAndReputablePolicyState"; v = 0 },
    @{ p = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender"; n = "DisableAntiSpyware"; v = 1 }
  )) {
  try {
    New-Item -Path $kv.p -Force | Out-Null
    Set-ItemProperty -Path $kv.p -Name $kv.n -Value $kv.v -Type DWord -ErrorAction Stop
    $d["reg_$($kv.n)"] = "ustawiono $($kv.v)"
  } catch { $d["reg_$($kv.n)"] = "$($_.Exception.Message)" }
}

# Defender: wylacz ochrone w czasie rzeczywistym i dodaj wyjatki na drzewo DAM
foreach ($cmd in @(
    { Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction Stop },
    { Set-MpPreference -PUAProtection Disabled -ErrorAction Stop },
    { Add-MpPreference -ExclusionPath "C:\Users\WDAGUtilityAccount\AppData\Local\Programs\DAM" -ErrorAction Stop },
    { Add-MpPreference -ExclusionPath "C:\dam-payload" -ErrorAction Stop }
  )) {
  try { & $cmd; $d["mp_" + $d.Count] = "ok" } catch { $d["mp_" + $d.Count] = "$($_.Exception.Message)" }
}

try { $d.sac_po = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy").VerifiedAndReputablePolicyState } catch { $d.sac_po = "$($_.Exception.Message)" }

# Czy natywne rozszerzenia juz sie laduja?
$py = "C:\dam-payload\bin\runtime\win\python\python.exe"
if (Test-Path -LiteralPath $py) {
  $t = Join-Path $Out "imp.py"
  "for m in ('cryptography.fernet','psycopg2'):`n    try:`n        __import__(m); print(m,'OK')`n    except Exception as e:`n        print(m,'FAIL',str(e)[:90])" | Set-Content -LiteralPath $t -Encoding UTF8
  $d.importy = @(& $py $t 2>&1)
}
$d | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Out "sac-off.json") -Encoding UTF8
Write-Host "SAC-OFF GOTOWE"
