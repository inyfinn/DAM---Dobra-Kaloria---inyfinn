; DAM Windows installer - pelny kreator (licencja, sciezka, aktualizacja)
#ifndef MyAppVersion
  #define MyAppVersion "1.9.9"
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
Name: "cachesync"; Description: "Jesli brak dysku M: — pobierz pamiec podreczna z Synology po instalacji"; GroupDescription: "Pamiec podreczna:"; Flags: unchecked

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
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#GitRoot}\bin\installer\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#GitRoot}\bin\installer\redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#GitRoot}\bin\installer\inyfinn-dam-codesign.cer"; DestDir: "{app}\bin\installer"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#GitRoot}\bin\installer\trust-inyfinn-publisher.ps1"; DestDir: "{app}\bin\installer"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalowanie Visual C++ Runtime..."; Flags: waituntilterminated; Check: VCRedistNeeded
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalowanie WebView2 Runtime (wymagane przez pywebview)..."; Flags: waituntilterminated; Check: WebView2Needed
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\bin\installer\trust-inyfinn-publisher.ps1"""; StatusMsg: "Rejestracja wydawcy Inyfinn..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\bin\scripts\ops\seed-pamiec-from-canon.ps1"" -Dest ""{app}\bin\PAMIEC-PODRECZNA"" -Quiet"; StatusMsg: "Kopiowanie pamieci podrecznej z dysku M: (poza instalatorem)..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\bin\scripts\ops\sync-pamiec-podreczna-from-nas.ps1"" -Quiet"; StatusMsg: "Pobieranie pamieci podrecznej z Synology..."; Flags: runhidden waituntilterminated; Tasks: cachesync
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom DAM po zakonczeniu instalacji (startuje mostek)"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey

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

function KillDamProcesses: Boolean;
var
  ResultCode: Integer;
begin
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @(''DAM.exe'',''pythonw.exe'',''python.exe'',''dam-appw.exe'') -and $_.CommandLine -match ''DAM|launch\.py|local_bridge|dam-app|Dobra.Kaloria'' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := True;
end;

function InitializeSetup: Boolean;
var
  Prev: String;
begin
  Result := True;
  KillDamProcesses;
  if IsUpgradeInstall then
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

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillDamProcesses;
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
