# DAM Dobra Kaloria - Instalator Windows (WinForms wizard)
# Uruchom: powershell -ExecutionPolicy Bypass -File Setup-DAM.ps1

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$InstallerDir = $PSScriptRoot
$payloadDir = Join-Path $InstallerDir "payload"
if (Test-Path -LiteralPath $payloadDir) {
  $SourceRepo = $InstallerDir
} else {
  $SourceRepo = (Resolve-Path (Join-Path $InstallerDir "..\..\..")).Path
}
$CoreScript = Join-Path $InstallerDir "install-dam-core.ps1"

$BrandGreen = [System.Drawing.Color]::FromArgb(0, 130, 68)
$BrandPurple = [System.Drawing.Color]::FromArgb(171, 84, 219)
$Bg = [System.Drawing.Color]::FromArgb(248, 249, 252)
$Text = [System.Drawing.Color]::FromArgb(30, 35, 45)

function New-Label($text, $x, $y, $w, $size, $bold) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = New-Object System.Drawing.Point($x, $y)
  $l.Size = New-Object System.Drawing.Size($w, 28)
  $l.ForeColor = $Text
  $l.Font = New-Object System.Drawing.Font("Segoe UI", $size, $(if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }))
  return $l
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "DAM - Dobra Kaloria - Inyfinn"
$form.Size = New-Object System.Drawing.Size(560, 480)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $Bg

$header = New-Object System.Windows.Forms.Panel
$header.Dock = "Top"
$header.Height = 72
$header.BackColor = $BrandGreen
$form.Controls.Add($header)

$title = New-Object System.Windows.Forms.Label
$title.Text = "DAM - Dobra Kaloria"
$title.ForeColor = [System.Drawing.Color]::White
$title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(20, 14)
$title.AutoSize = $true
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Instalator lokalny (most + pliki Marketing)"
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(230, 255, 240)
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$subtitle.Location = New-Object System.Drawing.Point(22, 44)
$subtitle.AutoSize = $true
$header.Controls.Add($subtitle)

$stepLabel = New-Label "Krok 1 z 3: Witaj" 24 88 500 11 $true
$form.Controls.Add($stepLabel)

$body = New-Object System.Windows.Forms.Label
$body.Location = New-Object System.Drawing.Point(24, 118)
$body.Size = New-Object System.Drawing.Size(500, 120)
$body.ForeColor = $Text
$body.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$body.Text = @"
Przegladarka na Panel-DAM pokazuje tylko podglad bazy i cache.

Pelna praca (zapis, skojarzenia, pliki) wymaga tego instalatora:
- wybierz folder programu
- wskaz root Marketing (np. P:\Marketing)
- uruchom DAM lokalnie z mostem
"@
$form.Controls.Add($body)

$installBox = New-Object System.Windows.Forms.TextBox
$installBox.Location = New-Object System.Drawing.Point(24, 250)
$installBox.Size = New-Object System.Drawing.Size(380, 26)
$installBox.Text = Join-Path $env:LOCALAPPDATA "DAM-DobraKaloria"
$installBox.Visible = $false
$form.Controls.Add($installBox)

$marketingBox = New-Object System.Windows.Forms.TextBox
$marketingBox.Location = New-Object System.Drawing.Point(24, 290)
$marketingBox.Size = New-Object System.Drawing.Size(380, 26)
$marketingBox.Text = "P:\Marketing"
$marketingBox.Visible = $false
$form.Controls.Add($marketingBox)

$btnBrowseInstall = New-Object System.Windows.Forms.Button
$btnBrowseInstall.Text = "..."
$btnBrowseInstall.Location = New-Object System.Drawing.Point(412, 248)
$btnBrowseInstall.Size = New-Object System.Drawing.Size(40, 28)
$btnBrowseInstall.Visible = $false
$form.Controls.Add($btnBrowseInstall)

$btnBrowseMarketing = New-Object System.Windows.Forms.Button
$btnBrowseMarketing.Text = "..."
$btnBrowseMarketing.Location = New-Object System.Drawing.Point(412, 288)
$btnBrowseMarketing.Size = New-Object System.Drawing.Size(40, 28)
$btnBrowseMarketing.Visible = $false
$form.Controls.Add($btnBrowseMarketing)

$lblInstall = New-Label "Folder instalacji:" 24 228 200 9 $false
$lblInstall.Visible = $false
$form.Controls.Add($lblInstall)

$lblMarketing = New-Label "Root Marketing:" 24 268 200 9 $false
$lblMarketing.Visible = $false
$form.Controls.Add($lblMarketing)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(24, 340)
$progress.Size = New-Object System.Drawing.Size(500, 22)
$progress.Style = "Marquee"
$progress.Visible = $false
$form.Controls.Add($progress)

$btnBack = New-Object System.Windows.Forms.Button
$btnBack.Text = "Wstecz"
$btnBack.Location = New-Object System.Drawing.Point(24, 390)
$btnBack.Size = New-Object System.Drawing.Size(100, 32)
$btnBack.Enabled = $false
$form.Controls.Add($btnBack)

$btnNext = New-Object System.Windows.Forms.Button
$btnNext.Text = "Dalej"
$btnNext.Location = New-Object System.Drawing.Point(424, 390)
$btnNext.Size = New-Object System.Drawing.Size(100, 32)
$btnNext.BackColor = $BrandPurple
$btnNext.ForeColor = [System.Drawing.Color]::White
$btnNext.FlatStyle = "Flat"
$form.Controls.Add($btnNext)

$script:step = 1

function Show-Step($n) {
  $script:step = $n
  $lblInstall.Visible = ($n -ge 2)
  $installBox.Visible = ($n -ge 2)
  $btnBrowseInstall.Visible = ($n -ge 2)
  $lblMarketing.Visible = ($n -ge 3)
  $marketingBox.Visible = ($n -ge 3)
  $btnBrowseMarketing.Visible = ($n -ge 3)
  $btnBack.Enabled = ($n -gt 1)

  switch ($n) {
    1 {
      $stepLabel.Text = "Krok 1 z 3: Witaj"
      $body.Text = @"
Przegladarka na Panel-DAM pokazuje tylko podglad bazy i cache.

Pelna praca wymaga instalatora lokalnego z mostem do Postgres i dysku Marketing.
"@
      $btnNext.Text = "Dalej"
    }
    2 {
      $stepLabel.Text = "Krok 2 z 3: Folder instalacji"
      $body.Text = "Gdzie skopiowac program DAM (skrypty, UI, most)?"
      $btnNext.Text = "Dalej"
    }
    3 {
      $stepLabel.Text = "Krok 3 z 3: Root Marketing"
      $body.Text = "Wskaz dysk z folderem Marketing (np. P:\Marketing lub mapowanie Synology)."
      $btnNext.Text = "Instaluj"
    }
  }
}

$btnBrowseInstall.Add_Click({
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = "Folder instalacji DAM"
  if ($dlg.ShowDialog() -eq "OK") { $installBox.Text = $dlg.SelectedPath }
})

$btnBrowseMarketing.Add_Click({
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = "Root folder Marketing"
  if ($dlg.ShowDialog() -eq "OK") { $marketingBox.Text = $dlg.SelectedPath }
})

$btnBack.Add_Click({ Show-Step ($script:step - 1) })

$btnNext.Add_Click({
  if ($script:step -eq 1) { Show-Step 2; return }
  if ($script:step -eq 2) {
    if (-not $installBox.Text.Trim()) {
      [System.Windows.Forms.MessageBox]::Show("Podaj folder instalacji.", "DAM", "OK", "Warning") | Out-Null
      return
    }
    Show-Step 3
    return
  }
  if ($script:step -eq 3) {
    $m = $marketingBox.Text.Trim()
    if (-not $m) {
      [System.Windows.Forms.MessageBox]::Show("Podaj root Marketing.", "DAM", "OK", "Warning") | Out-Null
      return
    }
    $progress.Visible = $true
    $btnNext.Enabled = $false
    $btnBack.Enabled = $false
    try {
      & $CoreScript -InstallDir $installBox.Text.Trim() -MarketingRoot $m -SourceRepo $SourceRepo
      $runVbs = Join-Path $installBox.Text.Trim() "apps\desktop\run-dam.vbs"
      if (Test-Path $runVbs) {
        Start-Process "wscript.exe" -ArgumentList "`"$runVbs`""
      }
      [System.Windows.Forms.MessageBox]::Show(
        "DAM zainstalowany.`nSkroty na pulpicie.`nProgram zostal uruchomiony.",
        "DAM", "OK", "Information"
      ) | Out-Null
      $form.Close()
    } catch {
      $progress.Visible = $false
      $btnNext.Enabled = $true
      $btnBack.Enabled = $true
      [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Blad instalacji", "OK", "Error") | Out-Null
    }
  }
})

[void]$form.ShowDialog()
