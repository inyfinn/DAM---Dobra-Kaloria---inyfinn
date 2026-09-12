; DAM Windows installer - pelny kreator (licencja, sciezka, aktualizacja)
#ifndef MyAppVersion
  #define MyAppVersion "5.0.205"
#endif
#ifndef StageDir
  #define StageDir "..\dist\staging\DAM-install"
#endif
#ifndef ReleaseDir
  #define ReleaseDir ".."
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

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utworz skrot na pulpicie"; GroupDescription: "Skroty:"; Flags: checkedonce

[Files]
Source: "{#StageDir}\DAM.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#GitRoot}\bin\installer\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#GitRoot}\bin\installer\redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalowanie Visual C++ Runtime..."; Flags: waituntilterminated; Check: VCRedistNeeded
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalowanie WebView2 Runtime (wymagane przez pywebview)..."; Flags: waituntilterminated; Check: WebView2Needed
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom DAM po zakonczeniu instalacji"; Flags: nowait postinstall skipifsilent unchecked

[Registry]
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Inyfinn\DAM"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey

[Code]
function IsBadInstallPath(const Path: String): Boolean;
var
  U: String;
begin
  U := Uppercase(Path);
  Result := (Path = '') or
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
  if PathLooksLikeDamRoot(SrcDir) then
  begin
    Result := SrcDir;
    Exit;
  end;
  Result := ExpandConstant('{localappdata}\Programs\DAM');
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
