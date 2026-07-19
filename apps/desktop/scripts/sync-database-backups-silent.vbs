' Uruchom sync dumpow Postgres bez okna konsoli (pythonw + ukryty proces).
Option Explicit
Dim sh, fso, repo, pyw, script
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
script = repo & "\apps\desktop\scripts\sync-database-backups-to-git.py"

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
  sh.Run """" & pyw & """ """ & script & """ --push", 0, False
Else
  sh.Run "pythonw """ & script & """ --push", 0, False
End If
