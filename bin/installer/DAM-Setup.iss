; DAM Windows installer - pelny kreator (licencja, sciezka, aktualizacja)
#ifndef MyAppVersion
  #define MyAppVersion "2.5.6"
#endif
#ifndef StageDir
  #define StageDir "..\..\work\dist\staging\DAM-install"
#endif
#ifndef ReleaseDir
  #define ReleaseDir "..\instalator"
#endif
#ifndef GitRoot
  #define GitRoot "."
#endif

#define MyAppName "DAM - Dobra Kaloria"
#define MyAppPublisher "Inyfinn"
#define MyAppURL "https://inyfinn.synology.me"
#define MyAppExeName "DAM.exe"
#define MyAppId "{A8F3C2E1-9B4D-4F6A-8C1E-DAM-DOBRA-KALORIA}"

[Setup]
AppId={{#MyAppId}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={code:GetDefaultInstallDir}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
DisableDirPage=no
DisableReadyPage=no
; Start as user; when user picks Program Files, Inno asks to elevate mid-wizard.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#ReleaseDir}
OutputBaseFilename=DAM-Setup
SetupIconFile={#StageDir}\bin\apps\desktop\dam_app.ico
UninstallDisplayIcon={app}\bin\apps\desktop\dam_app.ico
WizardStyle=classic
Compression=lzma2/ultra64
SolidCompression=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile={#GitRoot}\bin\installer\LICENSE.txt
InfoAfterFile={#StageDir}\README.txt
UsePreviousAppDir=yes
UsePreviousGroup=yes
AlwaysShowDirOnReadyPage=yes
AllowUNCPath=no
ExtraDiskSpaceRequired=120000000
CloseApplications=force
CloseApplicationsFilter=*.exe
RestartApplications=no
AppMutex=
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
; Authenticode: ISCC /Sdamsigntool gdy jest signtool+PFX. Inaczej PowerShell
; podpisuje DAM-Setup.exe PO kompilacji (sign-dam-binaries.ps1).
#ifdef DamSignTool
SignTool=damsigntool
SignedUninstaller=yes
#endif

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utworz skrot na pulpicie"; GroupDescription: "Skroty:"; Flags: checkedonce
; Uslugi w tle NIE sa juz pytaniem do uzytkownika. Bez nich nie dzialaja podglady,
; odswiezanie listy plikow ani aktualizacje - "mostek" byl wyborem miedzy dzialajacym
; a polamanym programem i brzmial jak praca do wykonania recznie.

; Aktualizacja = czysty klad od nowa. Bez tego stare moduly JS/HTML i pliki
; usuniete w nowej wersji zostaja na dysku i wracaja do gry przy niezbumpowanym ?v=.
; web = kasuj caly kod (katalogi + pliki w korzeniu); NIE kasuj apps\web\data.
; Inno nie umie "delete tree except data" — enumerujemy katalogi kodu + leftover.
; NIE czyscimy: apps\web\data, apps\desktop\data, DATABASE, PAMIEC-PODRECZNA.
[InstallDelete]
Type: filesandordirs; Name: "{app}\bin\apps\web\assets"
Type: filesandordirs; Name: "{app}\bin\apps\web\i18n"
Type: filesandordirs; Name: "{app}\bin\apps\web\scripts"
Type: filesandordirs; Name: "{app}\bin\apps\web\_qa"
Type: filesandordirs; Name: "{app}\bin\apps\web\pages"
Type: filesandordirs; Name: "{app}\bin\apps\web\src"
Type: filesandordirs; Name: "{app}\bin\apps\web\vendor"
Type: filesandordirs; Name: "{app}\bin\apps\web\css"
Type: filesandordirs; Name: "{app}\bin\apps\web\js"
Type: filesandordirs; Name: "{app}\bin\apps\web\tests"
Type: filesandordirs; Name: "{app}\bin\apps\web\tooling"
Type: filesandordirs; Name: "{app}\bin\apps\web\static"
Type: filesandordirs; Name: "{app}\bin\apps\web\dist"
Type: filesandordirs; Name: "{app}\bin\apps\web\public"
Type: filesandordirs; Name: "{app}\bin\apps\web\components"
Type: files; Name: "{app}\bin\apps\web\*.html"
; 2.4.4: instalatory <= 2.4.3 dokladaly cudzy skan Brandingu (kopia ~370 MB + manifest).
; Runner bralby go za wlasny skan dysku - usuwamy; wlasny build odtworzy oba pliki.
Type: files; Name: "{app}\bin\apps\web\data\branding-index.scan.json"
Type: files; Name: "{app}\bin\apps\web\data\branding-scan-dirs.json"
Type: files; Name: "{app}\bin\apps\web\*.js"
Type: files; Name: "{app}\bin\apps\web\*.py"
Type: files; Name: "{app}\bin\apps\web\*.css"
Type: files; Name: "{app}\bin\apps\web\*.json"
Type: files; Name: "{app}\bin\apps\web\*.webmanifest"
Type: filesandordirs; Name: "{app}\bin\apps\api"
Type: filesandordirs; Name: "{app}\bin\THEME"
Type: filesandordirs; Name: "{app}\bin\runtime"
Type: filesandordirs; Name: "{app}\bin\scripts"
Type: filesandordirs; Name: "{app}\bin\docs"
Type: filesandordirs; Name: "{app}\bin\agents"
Type: files; Name: "{app}\bin\apps\desktop\*.py"
Type: files; Name: "{app}\bin\apps\desktop\*.html"
Type: filesandordirs; Name: "{app}\bin\apps\desktop\scripts"
Type: filesandordirs; Name: "{app}\bin\apps\desktop\tests"
; 28.09 (mapowanie kod/dane, W4 runda 2): jedyny znaleziony brak. DAM.exe importuje moduly
; *.py wprost z {app}\bin\apps\desktop (launch.py itp.) - CPython tworzy tam __pycache__
; w RUNTIME na kazdej stacji (nie pochodzi ze stagingu - build-installer.ps1 go
; wyklucza z kopiowania, ten sam wzorzec $xdCommon co powyzej). Po podmianie *.py
; nowa wersja moglaby razem ze starym .pyc siedziec w tym samym folderze (CPython sam
; sprawdza mtime/hash, wiec ryzyko jest niskie, ale to jednak "stary kod obok nowego").
; .pytest_cache dodany dla symetrii z tym samym powodem, gdyby ktos uruchomil testy na
; zainstalowanej kopii. Oba to WYLACZNIE generowany bajtkod/cache narzedzi - nigdy dane
; uzytkownika (machine-config.json, ktory tez lezy w tym folderze, zostaje nietkniety -
; nie jest to wzorzec plikow, tylko dwa konkretne foldery cache).
Type: filesandordirs; Name: "{app}\bin\apps\desktop\__pycache__"
Type: filesandordirs; Name: "{app}\bin\apps\desktop\.pytest_cache"

[Files]
Source: "{#StageDir}\DAM.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
; branding-index.json wykluczony z gornej linii (Excludes) - patrz oddzielny wpis nizej.
; Bez tego kazda aktualizacja kasowala uzytkownikowi juz-zeskanowany plik (9000+ pozycji,
; 15-30 min skanu dysku Marketing) z powrotem do zaslepki instalatora (assets:[]),
; wymuszajac pelny reskan i zerujac skojarzenia widoczne w Brandingu do czasu jego konca.
; Ta sama zasada dla pozostalych plikow stanu uzytkownika (indeksy, ustawienia, kampanie,
; statusy, osoby) i lokalnej bazy kont: cicha aktualizacja nie moze ich cofnac do wersji z builda.
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Excludes: "apps\web\data\market-index.json,\apps\web\data\branding-index.json,\apps\web\data\branding-index.scan.json,\apps\web\data\branding-scan-dirs.json,\apps\web\data\file-index.json,\apps\web\data\search-index.json,\apps\web\data\app-settings.json,\apps\web\data\campaigns.json,\apps\web\data\branding-grid-index.json,\apps\web\data\branding-grid-head.json,\apps\web\data\branding-search-index.json,\apps\web\data\lifecycle-status.json,\apps\web\data\product-people.json,\DATABASE\users-seed.sqlite,\PAMIEC-PODRECZNA\thumbs\*"; Flags: ignoreversion recursesubdirs createallsubdirs
; Miniatury maja nazwy = skrot tresci, wiec istniejacego pliku nie trzeba nadpisywac (szybsza aktualizacja).
Source: "{#StageDir}\bin\PAMIEC-PODRECZNA\thumbs\*"; DestDir: "{app}\bin\PAMIEC-PODRECZNA\thumbs"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\branding-index.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\file-index.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\search-index.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\app-settings.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\campaigns.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\branding-grid-index.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\branding-grid-head.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\branding-search-index.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\lifecycle-status.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\apps\web\data\product-people.json"; DestDir: "{app}\bin\apps\web\data"; Flags: onlyifdoesntexist
Source: "{#StageDir}\bin\DATABASE\users-seed.sqlite"; DestDir: "{app}\bin\DATABASE"; Flags: onlyifdoesntexist
Source: "{#GitRoot}\bin\installer\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#GitRoot}\bin\installer\redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#GitRoot}\bin\installer\inyfinn-dam-codesign.cer"; DestDir: "{app}\bin\installer"; Flags: ignoreversion skipifsourcedoesntexist
; dontcopy: NIE instalowany wprost do {app} tutaj - tylko trzymany do ExtractTemporaryFile
; w PrepareToInstall/CurStepChanged(ssInstall), bo ta faza biegnie PRZED [Files], wiec {app}
; jeszcze nie ma tego skryptu. Zwykla kopia do {app}\bin\scripts\ops\ idzie normalnym Source
; wyzej (katalog bin\scripts\* w Excludes go nie obejmuje - patrz [InstallDelete] i Source bin\*).
Source: "{#GitRoot}\bin\scripts\ops\dam-cleanup-autostart.ps1"; DestDir: "{tmp}"; Flags: dontcopy

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalowanie Visual C++ Runtime..."; Flags: waituntilterminated; Check: VCRedistNeeded
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalowanie WebView2 Runtime (wymagane przez pywebview)..."; Flags: waituntilterminated; Check: WebView2Needed
; Bez powershell -ExecutionPolicy Bypass: antywirusy (Bitdefender Boxter) blokuja ten wzorzec.
; PAMIEC-PODRECZNA jest w Setupie; uslugi w tle tylko ja aktualizuja z Synology.
; Certyfikat jest SAMOPODPISANY, wiec sam TrustedPublisher nie wystarcza: lancuch
; konczy sie na korzeniu, ktorego Windows nie zna i pokazuje "nieznany wydawca"
; (Get-AuthenticodeSignature: "przerwano na certyfikacie glownym, ktory nie nalezy
; do zaufanych"). Korzen musi trafic takze do Root - dopiero wtedy podpis sie waliduje.
Filename: "{sys}\certutil.exe"; Parameters: "-user -f -addstore Root ""{app}\bin\installer\inyfinn-dam-codesign.cer"""; StatusMsg: "Rejestracja wydawcy Inyfinn (korzen zaufania)..."; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\certutil.exe"; Parameters: "-user -f -addstore TrustedPublisher ""{app}\bin\installer\inyfinn-dam-codesign.cer"""; StatusMsg: "Rejestracja wydawcy Inyfinn..."; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom DAM po zakonczeniu instalacji"; Flags: nowait postinstall skipifsilent
; Cicha aktualizacja z aplikacji (app_updates.py: /VERYSILENT ... /DAMRELAUNCH=1): DAM wraca sam.
; Wpis wyzej ma skipifsilent, a RestartApplications=no, wiec bez tego program po prostu znikal.
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Flags: nowait runasoriginaluser; Check: IsDamRelaunch

[Registry]
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey
; Uslugi w tle startuja z Windows zawsze - to czesc programu, a nie dodatek.
; Bundlowany pythonw.exe -> zero okna konsoli, zero script-hosta.
; HKCU = bez podnoszenia uprawnien. Proces sam ustapi, gdy port 8766 jest zajety.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DAM-Bridge"; ValueData: """{app}\bin\runtime\win\python\pythonw.exe"" ""{app}\bin\apps\desktop\local_bridge.py"""; Flags: uninsdeletevalue

[Code]
function IsProtectedInstallPath(const Path: String): Boolean;
var
  U: String;
begin
  { Tylko Windows i ProgramData — Program Files JEST dozwolone (UAC mid-wizard). }
  U := Uppercase(Path);
  Result :=
    (Pos('\WINDOWS\', '\' + U + '\') > 0) or
    (Pos('\PROGRAMDATA\', '\' + U + '\') > 0);
end;

function UserInstallDir: String;
begin
  Result := ExpandConstant('{localappdata}\Programs\DAM');
end;

function ProgramFilesInstallDir: String;
begin
  Result := ExpandConstant('{autopf}\DAM');
end;

function IsBadInstallPath(const Path: String): Boolean;
var
  U: String;
begin
  U := Uppercase(Path);
  Result := (Path = '') or
    IsProtectedInstallPath(Path) or
    (Pos('\TEMP\', U) > 0) or
    (Pos('DAM-INSTALL-TEST', U) > 0) or
    (Pos('DAM-INSTALL-SMOKE', U) > 0);
end;

function PathLooksLikeDamRoot(const Path: String): Boolean;
begin
  Result := FileExists(AddBackslash(Path) + 'DAM.exe') and
    FileExists(AddBackslash(Path) + 'bin\apps\desktop\launch.py');
end;

function GetDefaultInstallDir(Param: String): String;
var
  Stored, SrcDir, UninstLoc: String;
begin
  if RegQueryStringValue(HKCU, 'Software\Inyfinn\DAM', 'InstallPath', Stored) then
  begin
    if (not IsBadInstallPath(Stored)) and PathLooksLikeDamRoot(Stored) then
    begin
      Result := Stored;
      Exit;
    end;
  end;
  if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppId}_is1', 'InstallLocation', UninstLoc) then
  begin
    if (not IsBadInstallPath(UninstLoc)) and PathLooksLikeDamRoot(UninstLoc) then
    begin
      Result := UninstLoc;
      Exit;
    end;
  end;
  SrcDir := ExtractFilePath(ExpandConstant('{srcexe}'));
  if (not IsBadInstallPath(SrcDir)) and PathLooksLikeDamRoot(SrcDir) then
  begin
    Result := SrcDir;
    Exit;
  end;
  { Domyslnie folder uzytkownika; Program Files wybierasz w kreatorze (UAC w trakcie). }
  Result := UserInstallDir;
end;

function PathNeedsAdmin(const Path: String): Boolean;
var
  U: String;
begin
  U := UpperCase(AddBackslash(Path));
  Result :=
    (Pos('\PROGRAM FILES\', U) > 0) or
    (Pos('\PROGRAM FILES (X86)\', U) > 0) or
    (Pos('\PROGRAMFILES\', U) > 0);
end;

procedure InitializeWizard;
begin
  { Domyslnie LocalAppData; Program Files tylko z admin (NextButtonClick). }
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    if IsBadInstallPath(WizardDirValue) then
    begin
      MsgBox(
        'Ta sciezka jest zabroniona (Windows / ProgramData / Temp).' + #13#10 +
        'Wybierz np.:' + #13#10 +
        UserInstallDir,
        mbError, MB_OK);
      Result := False;
      Exit;
    end;
    { PrivilegesRequired=lowest nie zawsze podnosi UAC mid-wizard → Error 5. }
    if PathNeedsAdmin(WizardDirValue) and (not IsAdminInstallMode) then
    begin
      if MsgBox(
        'Folder Program Files wymaga uprawnien administratora.' + #13#10#13#10 +
        'Tak = zainstaluj w folderze uzytkownika (bez UAC):' + #13#10 +
        UserInstallDir + #13#10#13#10 +
        'Nie = przerwanie. Uruchom DAM-Setup.exe jako administrator, jesli chcesz Program Files.',
        mbConfirmation, MB_YESNO) = IDYES then
      begin
        WizardForm.DirEdit.Text := UserInstallDir;
        Result := True;
      end
      else
        Result := False;
    end;
  end;
end;

function VCRedistNeeded: Boolean;
begin
  Result := not RegKeyExists(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64');
end;

function WebView2RuntimePresent: Boolean;
begin
  Result :=
    RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7C4E5}') or
    RegKeyExists(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7C4E5}') or
    RegKeyExists(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7C4E5}');
end;

function WebView2Needed: Boolean;
begin
  Result := not WebView2RuntimePresent;
end;

function IsUpgradeInstall: Boolean;
var
  Stored: String;
begin
  if RegQueryStringValue(HKCU, 'Software\Inyfinn\DAM', 'InstallPath', Stored) then
    Result := (not IsBadInstallPath(Stored)) and PathLooksLikeDamRoot(Stored)
  else
    Result := False;
end;

function GetPrevVersion: String;
begin
  if not RegQueryStringValue(HKCU, 'Software\Inyfinn\DAM', 'Version', Result) then
    Result := '';
end;

{ True tylko przy cichej aktualizacji z aplikacji z parametrem /DAMRELAUNCH=1.
  WizardSilent: w trybie interaktywnym zostaje zwykly checkbox "Uruchom DAM" (bez podwojnego startu). }
function IsDamRelaunch: Boolean;
begin
  Result := WizardSilent and (ExpandConstant('{param:DAMRELAUNCH|0}') = '1');
end;

{ 2026-09-28: /T zabija CALE drzewo procesow dopasowanych po /IM, wlacznie z potomkami o
  INNEJ nazwie obrazu. Zmierzone na atrapach (damtest-parent.exe uruchamiajacy
  damtest-child.exe, taskkill /F /T /IM damtest-parent.exe): dziecko zostalo zabite razem
  z rodzicem. Przy cichej aktualizacji instalator bywa potomkiem DAM.exe (most odpala go
  przez Popen) - /T zabilby wlasny proces instalatora w trakcie jego dzialania. Usuniete. }
function KillDamProcesses: Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM DAM.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('powershell.exe', '-NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @(''DAM.exe'',''pythonw.exe'',''python.exe'',''dam-appw.exe'') -and (($_.Name -eq ''DAM.exe'') -or ($_.CommandLine -match ''\\bin\\apps\\desktop\\(launch|local_bridge)\.py|dam-appw'')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := True;
end;

{ Rezerwa (bez ExecutionPolicy Bypass - Bitdefender blokuje ten wzorzec, NIESPRAWDZONE na tej
  maszynie, brak AV do testu): zatrzymuje obserwator indeksu (watch-file-index.py, build-*.py,
  bin\scripts\ops) po PID, bez /T, pomijajac korzenie z .git (repo dewelopera nie moze stracic
  wlasnego obserwatora). Uzywana TYLKO gdy dam-cleanup-autostart.ps1 sie nie uruchomil. }
function KillDamWatcherFallback: Boolean;
var
  ResultCode: Integer;
  Cmd: String;
begin
  Cmd :=
    '-NoProfile -NonInteractive -Command "' +
    'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match ''\\bin\\apps\\web\\scripts\\|\\bin\\scripts\\ops\\'' } | ' +
    'ForEach-Object { ' +
    '$exe = $_.ExecutablePath; $root = $exe; $skip = $false; ' +
    'for ($i = 0; $i -lt 12; $i++) { $root = Split-Path $root -Parent -ErrorAction SilentlyContinue; if (-not $root) { break }; if (Test-Path -LiteralPath (Join-Path $root ''.git'')) { $skip = $true; break } }; ' +
    'if (-not $skip) { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } ' +
    '}"';
  Result := Exec('powershell.exe', Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

{ Rezerwa: usuwa wpisy Run/RunOnce (HKCU) wskazujace uklad DAM poza folderem docelowym (app), bez uruchamiania
  PowerShell skryptu (uzywane, gdy dam-cleanup-autostart.ps1 sie nie uruchomil). Nie dotyka
  HKLM (wymaga admina) ani zadan/skrotow - to jest ograniczona rezerwa, nie pelna zamiana. }
procedure FallbackRemoveStaleRunEntries(const KeepDir: String);
var
  Names: TArrayOfString;
  I: Integer;
  Val, ValLower, KeepLower: String;
  Keys: TArrayOfString;
  K: Integer;
begin
  SetArrayLength(Keys, 2);
  Keys[0] := 'Software\Microsoft\Windows\CurrentVersion\Run';
  Keys[1] := 'Software\Microsoft\Windows\CurrentVersion\RunOnce';
  KeepLower := Lowercase(KeepDir);
  for K := 0 to GetArrayLength(Keys) - 1 do
  begin
    if not RegGetValueNames(HKCU, Keys[K], Names) then Continue;
    for I := 0 to GetArrayLength(Names) - 1 do
    begin
      if not RegQueryStringValue(HKCU, Keys[K], Names[I], Val) then Continue;
      ValLower := Lowercase(Val);
      if (Pos('\bin\apps\desktop\', ValLower) = 0) and
         (Pos('\bin\apps\web\scripts\', ValLower) = 0) and
         (Pos('\bin\scripts\ops\', ValLower) = 0) then Continue;
      { Uklad DAM. Zostaje tylko jesli polecenie wskazuje wewnatrz folderu docelowego (KeepDir). }
      if (KeepLower <> '') and (Pos(KeepLower, ValLower) > 0) then Continue;
      Log('FallbackRemoveStaleRunEntries: usuwam ' + Keys[K] + '\' + Names[I]);
      RegDeleteValue(HKCU, Keys[K], Names[I]);
    end;
  end;
end;

function InitializeSetup: Boolean;
var
  Prev: String;
begin
  Result := True;
  KillDamProcesses;
  { Auto-update (app_updates.py) odpala /VERYSILENT — MsgBox zablokowalby aktualizacje. }
  if (not WizardSilent) and IsUpgradeInstall then
  begin
    Prev := GetPrevVersion;
    if Prev <> '' then
    begin
      if MsgBox('Wykryto juz zainstalowana wersje DAM (' + Prev + ').' + #13#10 +
        'Instalator zaktualizuje program w poprzedniej lokalizacji.' + #13#10#13#10 +
        'Kontynuowac?', mbConfirmation, MB_YESNO) = IDNO then
        Result := False;
    end
    else if MsgBox('Wykryto poprzednia instalacje DAM.' + #13#10 +
      'Kontynuowac aktualizacje w poprzedniej lokalizacji?', mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
  end;
end;

{ Kazdy proces uruchomiony z katalogu instalacji (obserwator indeksu, skrypty tla):
  KillDamProcesses lapie tylko launch/local_bridge, a pomocnicze pythonw.exe z bin\runtime
  zostawaly i trzymaly zablokowany runtime - cicha aktualizacja w tym samym katalogu
  mogla utknac na podmianie pliku. Test 2026-09-18: po instalacji zostaly 3 takie procesy. }
procedure KillProcessesFromDir(const Dir: String);
var
  ResultCode: Integer;
  Safe: String;
begin
  if Length(Dir) < 8 then
    Exit;
  Safe := Dir;
  StringChangeEx(Safe, '''', '''''', True);
  Exec('powershell.exe', '-NoProfile -NonInteractive -Command "$d = ''' + AddBackslash(Safe) + '''; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($d, [StringComparison]::OrdinalIgnoreCase) -and ($_.ExecutablePath -notmatch ''\\data\\updates\\'') -and ($_.Name -notlike ''*Setup*'') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

{ 2026-09-28 (KINGAUR): stara instalacja w innym folderze albo wpis autostartu po
  recznie skasowanym folderze dalej uruchamialy most w tle i pisaly do wspolnej bazy.
  bin\scripts\ops\dam-cleanup-autostart.ps1 sprzata TYLKO rzeczy DAM: wpisy Run/RunOnce
  z ukladem DAM, stare foldery DAM (Kosz Windows, rezerwa: zmiana nazwy), zadania "DAM-*"
  z brakujacym plikiem (na dysku lokalnym - sieciowy nigdy nie jest "brak"), skroty DAM
  w Autostarcie, aktywacje (kopia pary pg-config.* do folderu docelowego i do state\activation).
  Log produktu: %LOCALAPPDATA%\DAM\logs\cleanup-<data>.log.

  WAZNE (naprawa bledu z 28.09): ta faza (Clean) biegnie w ssInstall - PRZED [Registry] -
  wiec wlasny swiezy wpis DAM-Bridge jeszcze nie istnieje i nie moze zostac przypadkiem
  skasowany (poprzedni blad Keep() jest tez naprawiony w samym skrypcie, niezaleznie).
  -ExecutionPolicy RemoteSigned (nie Bypass - .iss ma juz gdzie indziej komentarz, ze
  Bitdefender blokuje wzorzec "-ExecutionPolicy Bypass"; RemoteSigned nie byl testowany
  na maszynie z tym AV - NIESPRAWDZONE, brak Bitdefender na tym komputerze do testu).
  Jesli caly Exec zawiedzie albo rc<>0: FallbackFullFailure (Pascal-only, bez PowerShell
  -File, tylko Run wpisy + wzorzec obserwatora, pomijajac .git). }
function RunDamCleanPhaseScript(const Script, Mode, KeepDir: String): Integer;
var
  ResultCode: Integer;
begin
  Result := -1;
  if not FileExists(Script) then
  begin
    Log('RunDamCleanPhaseScript: skrypt nie istnieje: ' + Script);
    Exit;
  end;
  if Exec('powershell.exe',
    '-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "' + Script +
    '" -Phase Clean -Mode ' + Mode + ' -Installer -Apply -KeepDir "' + KeepDir + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('dam-cleanup-autostart Clean/' + Mode + ' rc=' + IntToStr(ResultCode));
    Result := ResultCode;
  end
  else
    Log('dam-cleanup-autostart Clean/' + Mode + ' NIE URUCHOMIONY (Exec=false, mozliwa blokada AV)');
end;

procedure FallbackFullFailure(const KeepDir: String);
begin
  Log('Rezerwa Pascal: skrypt PowerShell zawiodl - usuwam tylko Run wpisy spoza {app} i zatrzymuje wzorzec obserwatora (pomijajac .git).');
  FallbackRemoveStaleRunEntries(KeepDir);
  KillDamWatcherFallback;
end;

{ Faza Stop w PrepareToInstall: asynchronicznie (ewNoWait), limit 90 s, POTEM instalacja
  idzie dalej niezaleznie od wyniku (nigdy nie blokuje instalacji na zawsze). Skrypt sam
  zapisuje plik-znacznik na koncu (parametr -DoneFile) - to jest jedyny niezawodny sposob
  na "poczekaj do N sekund" w Inno (Exec nie ma wbudowanego timeoutu). }
procedure RunDamStopPhase(const KeepDir: String);
var
  Script, DoneFile, Args: String;
  ResultCode, Waited: Integer;
begin
  if not FileExists(ExpandConstant('{tmp}\dam-cleanup-autostart.ps1')) then
  begin
    ExtractTemporaryFile('dam-cleanup-autostart.ps1');
  end;
  Script := ExpandConstant('{tmp}\dam-cleanup-autostart.ps1');
  if not FileExists(Script) then
  begin
    Log('RunDamStopPhase: skrypt niedostepny (dontcopy) - pomijam faze Stop');
    Exit;
  end;
  DoneFile := ExpandConstant('{tmp}\dam-stop-done.flag');
  if FileExists(DoneFile) then DeleteFile(DoneFile);
  Args := '-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "' + Script +
    '" -Phase Stop -Mode Install -Installer -Apply -KeepDir "' + KeepDir +
    '" -DoneFile "' + DoneFile + '"';
  if not Exec('powershell.exe', Args, '', SW_HIDE, ewNoWait, ResultCode) then
  begin
    Log('RunDamStopPhase: Exec=false (mozliwa blokada AV) - rezerwa Pascal');
    FallbackFullFailure(KeepDir);
    Exit;
  end;
  Waited := 0;
  while (not FileExists(DoneFile)) and (Waited < 90000) do
  begin
    Sleep(300);
    Waited := Waited + 300;
  end;
  if not FileExists(DoneFile) then
    Log('RunDamStopPhase: limit 90 s minal, instalacja idzie dalej mimo to')
  else
    Log('RunDamStopPhase: zakonczona po ' + IntToStr(Waited) + ' ms');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillDamProcesses;
  KillProcessesFromDir(WizardDirValue);
  RunDamStopPhase(WizardDirValue);
  Sleep(200);
  Result := '';
  if PathNeedsAdmin(WizardDirValue) and (not IsAdminInstallMode) then
  begin
    Result :=
      'Program Files wymaga administratora. Wybierz ' + UserInstallDir +
      ' albo uruchom DAM-Setup.exe jako administrator.';
  end;
end;

function JsonEscape(const S: String): String;
var
  R: String;
begin
  R := S;
  StringChangeEx(R, '\', '\\', True);
  StringChangeEx(R, '"', '\"', True);
  Result := R;
end;

{ Znacznik state\current-install.json (DECYZJE.md sekcja 8 pkt 4-5): pola app_dir, version,
  state, written_at. Odczytywany w przyszlym wydaniu (etap 5.3, nie ta partia) jako
  "install_fence" - tutaj tylko zapisujemy, nic jeszcze go nie czyta. }
procedure WriteCurrentInstallMarker(const StateStr: String);
var
  StateDir, MarkerPath, Json: String;
begin
  StateDir := ExpandConstant('{localappdata}\DAM\state');
  ForceDirectories(StateDir);
  MarkerPath := StateDir + '\current-install.json';
  Json := '{"app_dir":"' + JsonEscape(ExpandConstant('{app}')) + '","version":"' +
    JsonEscape('{#MyAppVersion}') + '","state":"' + JsonEscape(StateStr) +
    '","written_at":"' + JsonEscape(GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0)) + '"}';
  SaveStringToFile(MarkerPath, Json, False);
end;

{ Zapisuje state:"uninstalled" TYLKO gdy istniejacy znacznik nalezy do TEGO folderu docelowego - inna
  rownolegla instalacja (inny folder) nie moze zostac oznaczona jako odinstalowana. }
procedure MarkUninstalledIfMatchingApp;
var
  StateDir, MarkerPath: String;
  Content: AnsiString;
  Needle: AnsiString;
begin
  StateDir := ExpandConstant('{localappdata}\DAM\state');
  MarkerPath := StateDir + '\current-install.json';
  if not FileExists(MarkerPath) then Exit;
  if not LoadStringFromFile(MarkerPath, Content) then Exit;
  Needle := AnsiString('"app_dir":"' + JsonEscape(ExpandConstant('{app}')) + '"');
  if Pos(Needle, Content) > 0 then
    WriteCurrentInstallMarker('uninstalled');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Script: String;
  Rc: Integer;
begin
  { ssInstall biegnie PRZED [InstallDelete]/[Files]/[Registry]: swiezy wpis DAM-Bridge
    jeszcze nie istnieje, wiec ta faza z definicji nie moze go skasowac. Skrypt jest
    wyciagniety do folderu tymczasowego przez RunDamStopPhase (PrepareToInstall zawsze biegnie pierwszy,
    przed ssInstall). }
  if CurStep = ssInstall then
  begin
    Script := ExpandConstant('{tmp}\dam-cleanup-autostart.ps1');
    if not FileExists(Script) then ExtractTemporaryFile('dam-cleanup-autostart.ps1');
    Rc := RunDamCleanPhaseScript(Script, 'Install', ExpandConstant('{app}'));
    if Rc <> 0 then
    begin
      Log('CurStepChanged(ssInstall): dam-cleanup-autostart Clean rc=' + IntToStr(Rc) + ' - rezerwa Pascal');
      FallbackFullFailure(ExpandConstant('{app}'));
    end;
    WriteCurrentInstallMarker('installed');
  end;
end;

function InitializeUninstall: Boolean;
begin
  KillDamProcesses;
  Result := True;
end;

procedure OpenExplorerDir(const Dir: String);
var
  RC: Integer;
begin
  if (Dir <> '') and DirExists(Dir) then
    ShellExec('', 'explorer.exe', '"' + Dir + '"', '', SW_SHOWNORMAL, ewNoWait, RC);
end;

procedure LeftoverOpenClick(Sender: TObject);
begin
  OpenExplorerDir(TNewButton(Sender).Hint);
end;

procedure ShowLeftoverCleanup;
var
  SrcDirs, SrcLabels, OpenDirs, OpenLabels: array of String;
  AppDir, LocalProg, LocalDam, Roam, Note, List, DirKey: String;
  I, J, Shown, Y: Integer;
  Dup: Boolean;
  Form: TSetupForm;
  Lbl: TNewStaticText;
  Btn, CloseBtn: TNewButton;
begin
  { Local\DAM CELOWO nie jest na tej liscie (DECYZJE.md sekcja 8 pkt 5): to folder stanu
    (state, aktywacja, logi), nie resztka instalacji - okno "skasuj recznie" bylo mylace. }
  AppDir := ExpandConstant('{app}');
  LocalProg := ExpandConstant('{localappdata}\Programs\DAM');
  LocalDam := ExpandConstant('{localappdata}\DAM');
  Roam := ExpandConstant('{userappdata}\DAM');
  SetArrayLength(SrcDirs, 3);
  SetArrayLength(SrcLabels, 3);
  SrcDirs[0] := AppDir;
  SrcLabels[0] := 'Folder instalacji';
  SrcDirs[1] := LocalProg;
  SrcLabels[1] := 'Programs\DAM';
  SrcDirs[2] := Roam;
  SrcLabels[2] := 'Roaming\DAM';

  SetArrayLength(OpenDirs, 0);
  SetArrayLength(OpenLabels, 0);
  Shown := 0;
  List := '';
  for I := 0 to GetArrayLength(SrcDirs) - 1 do
  begin
    if not DirExists(SrcDirs[I]) then
      Continue;
    Dup := False;
    DirKey := LowerCase(RemoveBackslashUnlessRoot(SrcDirs[I]));
    for J := 0 to Shown - 1 do
    begin
      if LowerCase(RemoveBackslashUnlessRoot(OpenDirs[J])) = DirKey then
      begin
        Dup := True;
        Break;
      end;
    end;
    if Dup then
      Continue;
    SetArrayLength(OpenDirs, Shown + 1);
    SetArrayLength(OpenLabels, Shown + 1);
    OpenDirs[Shown] := SrcDirs[I];
    OpenLabels[Shown] := SrcLabels[I];
    List := List + SrcLabels[I] + ': ' + SrcDirs[I] + #13#10;
    Shown := Shown + 1;
  end;
  if Shown = 0 then
    Exit;

  Note :=
    'Niektore pliki DAM nie daly sie usunac (proces, uprawnienia albo instalacja w folderze gita).' + #13#10 +
    'Kliknij przycisk, aby otworzyc folder w Eksploratorze i skasowac resztki recznie.' + #13#10#13#10 + List;
  ForceDirectories(LocalDam);
  SaveStringToFile(LocalDam + '\ODINSTALOWANIE-RESZTKI.txt', Note, False);
  if UninstallSilent then
    Exit;

  Form := CreateCustomForm(ScaleX(440), ScaleY(120 + (Shown * 44) + 56), False, True);
  try
    Form.Caption := 'Dezinstalator';

    Lbl := TNewStaticText.Create(Form);
    Lbl.Parent := Form;
    Lbl.Left := ScaleX(16);
    Lbl.Top := ScaleY(16);
    Lbl.Width := Form.ClientWidth - ScaleX(32);
    Lbl.AutoSize := False;
    Lbl.Height := ScaleY(72);
    Lbl.WordWrap := True;
    Lbl.Caption :=
      'Niektore pliki DAM nie daly sie usunac (proces, uprawnienia albo instalacja w folderze gita).' + #13#10 +
      'Kliknij przycisk, aby otworzyc folder w Eksploratorze.';

    Y := ScaleY(96);
    for I := 0 to Shown - 1 do
    begin
      Btn := TNewButton.Create(Form);
      Btn.Parent := Form;
      Btn.Left := ScaleX(16);
      Btn.Top := Y;
      Btn.Width := Form.ClientWidth - ScaleX(32);
      Btn.Height := ScaleY(36);
      Btn.Caption := 'Otworz: ' + OpenLabels[I];
      Btn.Hint := OpenDirs[I];
      Btn.ShowHint := False;
      Btn.OnClick := @LeftoverOpenClick;
      Y := Y + ScaleY(44);
    end;

    CloseBtn := TNewButton.Create(Form);
    CloseBtn.Parent := Form;
    CloseBtn.Width := ScaleX(120);
    CloseBtn.Height := ScaleY(32);
    CloseBtn.Left := (Form.ClientWidth - CloseBtn.Width) div 2;
    CloseBtn.Top := Form.ClientHeight - ScaleY(48);
    CloseBtn.Caption := 'Zamknij';
    CloseBtn.ModalResult := mrOk;
    Form.ActiveControl := CloseBtn;

    Form.ShowModal;
  finally
    Form.Free;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Script: String;
  Rc: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    { Kolejnosc (DECYZJE.md sekcja 8 pkt 4): najpierw zatrzymaj, POTEM autostart + aktywacja
      (skrypt lezy w folderze docelowym, jeszcze nie usuniety - pliki znikaja dopiero po tym kroku). }
    KillDamProcesses;
    Script := AddBackslash(ExpandConstant('{app}')) + 'bin\scripts\ops\dam-cleanup-autostart.ps1';
    if FileExists(Script) then
    begin
      Rc := RunDamCleanPhaseScript(Script, 'Uninstall', ExpandConstant('{app}'));
      if Rc <> 0 then
      begin
        Log('CurUninstallStepChanged: dam-cleanup-autostart Uninstall rc=' + IntToStr(Rc) + ' - rezerwa Pascal');
        FallbackFullFailure(ExpandConstant('{app}'));
      end;
    end
    else
    begin
      Log('CurUninstallStepChanged: skrypt nie istnieje w {app} - rezerwa Pascal');
      FallbackFullFailure(ExpandConstant('{app}'));
    end;
    MarkUninstalledIfMatchingApp;
  end;
  if CurUninstallStep = usPostUninstall then
    ShowLeftoverCleanup;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin\apps\desktop\webview2-profile"
Type: filesandordirs; Name: "{app}\bin\runtime"
Type: filesandordirs; Name: "{localappdata}\DAM\build"
; Sprzatniecie calego {app} PO wlasciwym odinstalowaniu (usPostUninstall): resztki nie
; sledzone przez [Files]/[Dirs] (cache, miniatury, logi, bazy) tez znikaja. {app} to zawsze
; podfolder wybrany w kreatorze (PathLooksLikeDamRoot/IsBadInstallPath wykluczaja korzen
; dysku/profil/system) - Type=filesandordirs nie "ucieka" poza niego. Zablokowane pliki:
; Inno i tak zostawi je z ostrzezeniem - zlapie je nastepna instalacja (stary korzen -> kosz).
Type: filesandordirs; Name: "{app}"
