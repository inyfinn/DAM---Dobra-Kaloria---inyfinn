; DAM Windows installer - pelny kreator (licencja, sciezka, aktualizacja)
#ifndef MyAppVersion
  #define MyAppVersion "2.2.8"
#endif
#ifndef StageDir
  #define StageDir "..\dist\staging\DAM-install"
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

[Files]
Source: "{#StageDir}\DAM.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
; branding-index.json wykluczony z gornej linii (Excludes) - patrz oddzielny wpis nizej.
; Bez tego kazda aktualizacja kasowala uzytkownikowi juz-zeskanowany plik (9000+ pozycji,
; 15-30 min skanu dysku Marketing) z powrotem do zaslepki instalatora (assets:[]),
; wymuszajac pelny reskan i zerujac skojarzenia widoczne w Brandingu do czasu jego konca.
; Ta sama zasada dla pozostalych plikow stanu uzytkownika (indeksy, ustawienia, kampanie,
; statusy, osoby) i lokalnej bazy kont: cicha aktualizacja nie moze ich cofnac do wersji z builda.
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Excludes: "apps\web\data\branding-index.json,\apps\web\data\file-index.json,\apps\web\data\search-index.json,\apps\web\data\app-settings.json,\apps\web\data\campaigns.json,\apps\web\data\branding-grid-index.json,\apps\web\data\branding-grid-head.json,\apps\web\data\branding-search-index.json,\apps\web\data\lifecycle-status.json,\apps\web\data\product-people.json,\DATABASE\users-seed.sqlite,\PAMIEC-PODRECZNA\thumbs\*"; Flags: ignoreversion recursesubdirs createallsubdirs
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

function KillDamProcesses: Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM DAM.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('powershell.exe', '-NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @(''DAM.exe'',''pythonw.exe'',''python.exe'',''dam-appw.exe'') -and (($_.Name -eq ''DAM.exe'') -or ($_.CommandLine -match ''\\bin\\apps\\desktop\\(launch|local_bridge)\.py|dam-appw'')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := True;
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

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillDamProcesses;
  KillProcessesFromDir(WizardDirValue);
  Sleep(1000);
  Result := '';
  if PathNeedsAdmin(WizardDirValue) and (not IsAdminInstallMode) then
  begin
    Result :=
      'Program Files wymaga administratora. Wybierz ' + UserInstallDir +
      ' albo uruchom DAM-Setup.exe jako administrator.';
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
  AppDir := ExpandConstant('{app}');
  LocalProg := ExpandConstant('{localappdata}\Programs\DAM');
  LocalDam := ExpandConstant('{localappdata}\DAM');
  Roam := ExpandConstant('{userappdata}\DAM');
  SetArrayLength(SrcDirs, 4);
  SetArrayLength(SrcLabels, 4);
  SrcDirs[0] := AppDir;
  SrcLabels[0] := 'Folder instalacji';
  SrcDirs[1] := LocalProg;
  SrcLabels[1] := 'Programs\DAM';
  SrcDirs[2] := LocalDam;
  SrcLabels[2] := 'Local\DAM';
  SrcDirs[3] := Roam;
  SrcLabels[3] := 'Roaming\DAM';

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
begin
  if CurUninstallStep = usUninstall then
    KillDamProcesses;
  if CurUninstallStep = usPostUninstall then
    ShowLeftoverCleanup;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin\apps\desktop\webview2-profile"
Type: filesandordirs; Name: "{app}\bin\runtime"
Type: filesandordirs; Name: "{localappdata}\DAM\build"
