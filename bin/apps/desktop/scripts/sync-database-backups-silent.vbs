' Uruchom sync dumpow Postgres bez okna konsoli (pythonw + ukryty proces).
' Gdy DAM dziala (dam-running.lock) — pomijamy (sync robi launch.py w tle).
'
' Layout (2026-08+): GIT_ROOT / bin = CONTENT_ROOT / apps / desktop / scripts / this.vbs
' Nie hardkoduj sciezek wzgledem GIT_ROOT — zawsze wzgledem lokalizacji tego VBS.
Option Explicit
Dim sh, fso, scriptsDir, desktopDir, contentRoot, pyw, script, runningLock
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopDir = fso.GetParentFolderName(scriptsDir)
' scripts -> desktop -> apps -> bin (CONTENT_ROOT)
contentRoot = fso.GetParentFolderName(fso.GetParentFolderName(desktopDir))
script = scriptsDir & "\sync-database-backups-to-git.py"
runningLock = desktopDir & "\data\dam-running.lock"

If Not fso.FileExists(script) Then
  WScript.Quit 2
End If

If fso.FileExists(runningLock) Then
  WScript.Quit 0
End If

pyw = ""
Dim c, candidates
candidates = Array( _
  "C:\Python314\pythonw.exe", _
  "C:\Python313\pythonw.exe", _
  "C:\Python312\pythonw.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python314\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python313\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python312\pythonw.exe") _
)
For Each c In candidates
  If fso.FileExists(c) Then
    pyw = c
    Exit For
  End If
Next

sh.CurrentDirectory = contentRoot
If pyw <> "" Then
  sh.Run """" & pyw & """ """ & script & """ --push --quiet", 0, False
Else
  sh.Run "pythonw """ & script & """ --push --quiet", 0, False
End If
