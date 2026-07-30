Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
desktopDir = fso.GetParentFolderName(WScript.ScriptFullName)
ensurePy = desktopDir & "\ensure_dam_running.py"
logFile = desktopDir & "\open-browser-last-error.txt"

If Not fso.FileExists(ensurePy) Then
  MsgBox "Nie znaleziono ensure_dam_running.py w " & desktopDir, vbCritical, "DAM - przegladarka"
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
  sh.Run "pythonw """ & ensurePy & """ --open", 0, True
  If Err.Number <> 0 Then
    Err.Clear
    sh.Run "python """ & ensurePy & """ --open", 1, True
  End If
Else
  sh.Run """" & pythonw & """ """ & ensurePy & """ --open", 0, True
End If

If Err.Number <> 0 Then
  WriteLog "Blad: " & Err.Description
  MsgBox "Nie udalo sie uruchomic DAM w przegladarce." & vbCrLf & vbCrLf & _
         Err.Description & vbCrLf & "Log: " & logFile, vbCritical, "DAM - przegladarka"
  WScript.Quit 1
End If

WScript.Quit 0

Sub WriteLog(msg)
  On Error Resume Next
  Dim ts
  Set ts = fso.CreateTextFile(logFile, True)
  ts.WriteLine Now & " - " & msg
  ts.Close
End Sub
