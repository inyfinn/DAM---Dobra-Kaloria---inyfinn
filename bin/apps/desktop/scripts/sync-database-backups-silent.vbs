' Uruchom sync dumpow Postgres bez okna konsoli (pythonw + ukryty proces).
' Bramka: bez DAM.exe / dam-appw.exe = ciche exit 0.
' Gdy DAM dziala (dam-running.lock) — pomijamy (sync robi most / launch.py).
Option Explicit
Dim sh, fso, repo, pyw, script, lockFile, runningLock, svc, procs
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
script = repo & "\apps\desktop\scripts\sync-database-backups-to-git.py"
runningLock = repo & "\apps\desktop\data\dam-running.lock"

Set svc = GetObject("winmgmts:\\.\root\cimv2")
Set procs = svc.ExecQuery("Select Name from Win32_Process Where Name='DAM.exe' OR Name='dam-appw.exe'")
If procs.Count = 0 Then
  WScript.Quit 0
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
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python313\pythonw.exe") _
)
For Each c In candidates
  If fso.FileExists(c) Then
    pyw = c
    Exit For
  End If
Next

sh.CurrentDirectory = repo
If pyw <> "" Then
  sh.Run """" & pyw & """ """ & script & """ --push --quiet", 0, False
Else
  sh.Run "pythonw """ & script & """ --push --quiet", 0, False
End If
