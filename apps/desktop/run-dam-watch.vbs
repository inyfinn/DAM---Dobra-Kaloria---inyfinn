Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
desktopDir = fso.GetParentFolderName(WScript.ScriptFullName)
ensurePy = desktopDir & "\ensure_dam_running.py"

If Not fso.FileExists(ensurePy) Then
  WScript.Quit 1
End If

pythonw = ""
candidates = Array( _
  "C:\Python314\pythonw.exe", _
  "C:\Python313\pythonw.exe", _
  "C:\Python312\pythonw.exe", _
  "C:\Python311\pythonw.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python314\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python313\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python312\pythonw.exe") _
)

For Each c In candidates
  If fso.FileExists(c) Then
    pythonw = c
    Exit For
  End If
Next

sh.CurrentDirectory = desktopDir

On Error Resume Next
If pythonw = "" Then
  sh.Run "pythonw """ & ensurePy & """ --watch", 0, False
Else
  sh.Run """" & pythonw & """ """ & ensurePy & """ --watch", 0, False
End If
