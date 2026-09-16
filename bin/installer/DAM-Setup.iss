; DAM Windows installer - pelny kreator (licencja, sciezka, aktualizacja)
#ifndef MyAppVersion
  #define MyAppVersion "1.9.0"
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
PrivilegesRequired=lowest
OutputDir={#ReleaseDir}
OutputBaseFilename=DAM-Setup
SetupIconFile={#StageDir}\bin\apps\desktop\dam_app.ico
UninstallDisplayIcon={app}\bin\apps\desktop\dam_app.ico
WizardStyle=classic
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile={#GitRoot}\bin\installer\LICENSE.txt
InfoAfterFile={#StageDir}\README.txt
UsePreviousAppDir=no
UsePreviousGroup=yes
AlwaysShowDirOnReadyPage=yes
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
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom DAM po zakonczeniu instalacji (startuje mostek)"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey

[Code]
function IsProtectedInstallPath(const Path: String): Boolean;
var
  U: String;
begin
  U := Uppercase(Path);
  Result :=
    (Pos('\PROGRAM FILES\', '\' + U + '\') > 0) or
    (Pos('\PROGRAM FILES (X86)\', '\' + U + '\') > 0) or
    (Pos('\WINDOWS\', '\' + U + '\') > 0) or
    (Pos('\PROGRAMDATA\', '\' + U + '\') > 0);
end;

function UserInstallDir: String;
begin
  Result := ExpandConstant('{localappdata}\Programs\DAM');
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
  Result := UserInstallDir;
end;

procedure InitializeWizard;
begin
  if IsProtectedInstallPath(WizardForm.DirEdit.Text) then
    WizardForm.DirEdit.Text := UserInstallDir;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    if IsProtectedInstallPath(WizardDirValue) then
    begin
      MsgBox(
        'DAM instaluje sie bez uprawnien administratora, w folderze uzytkownika:' + #13#10 +
        UserInstallDir + #13#10#13#10 +
        'Program Files na dysku C wymaga uprawnien, ktorych ten instalator nie uzywa.',
        mbError, MB_OK);
      WizardForm.DirEdit.Text := UserInstallDir;
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
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin\apps\desktop\webview2-profile"
