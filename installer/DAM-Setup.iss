; DAM Windows installer (per-user default). Compile via scripts/ops/build-installer.ps1
#ifndef MyAppVersion
  #define MyAppVersion "5.0.130"
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

[Setup]
AppId={{A8F3C2E1-9B4D-4F6A-8C1E-DAM-DOBRA-KALORIA}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\DAM
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#ReleaseDir}
OutputBaseFilename=DAM-Setup
SetupIconFile={#StageDir}\bin\apps\desktop\dam_app.ico
UninstallDisplayIcon={app}\bin\apps\desktop\dam_app.ico
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
InfoBeforeFile={#StageDir}\README.txt

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utworz skrot na pulpicie"; GroupDescription: "Skroty:"; Flags: checkedonce

[Files]
Source: "{#StageDir}\DAM.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\bin\*"; DestDir: "{app}\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#GitRoot}\installer\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\bin\apps\desktop\dam_app.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Instalowanie Visual C++ Runtime..."; Flags: waituntilterminated; Check: VCRedistNeeded

[Code]
function VCRedistNeeded: Boolean;
begin
  Result := not RegKeyExists(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64');
end;

[UninstallDelete]
Type: filesandordirs; Name: "{app}\bin\apps\desktop\webview2-profile"
