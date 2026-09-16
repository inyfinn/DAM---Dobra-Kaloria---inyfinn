Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
desktopDir = fso.GetParentFolderName(WScript.ScriptFullName)
' desktopDir = ...\bin\apps\desktop -> git root = parents[3]
binDir = fso.GetParentFolderName(fso.GetParentFolderName(desktopDir))
gitRoot = fso.GetParentFolderName(binDir)
launchPy = desktopDir & "\launch.py"
logFile = desktopDir & "\launch-last-error.txt"
healHtml = desktopDir & "\boot-heal.html"
bundledPyw = gitRoot & "\bin\runtime\win\python\pythonw.exe"

If Not fso.FileExists(launchPy) Then
  OpenHeal "missing_launch"
  WScript.Quit 1
End If

pythonw = ""
If fso.FileExists(bundledPyw) Then
  pythonw = bundledPyw
End If

' Dev-only: system Python when DAM_ALLOW_SYSTEM_PYTHON=1
If pythonw = "" Then
  allowSys = LCase(Trim(sh.ExpandEnvironmentStrings("%DAM_ALLOW_SYSTEM_PYTHON%")))
  If allowSys = "1" Or allowSys = "true" Or allowSys = "yes" Then
    candidates = Array( _
      sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python312\pythonw.exe"), _
      sh.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python313\pythonw.exe"), _
      "C:\Python312\pythonw.exe", _
      "C:\Python313\pythonw.exe" _
    )
    For Each c In candidates
      If fso.FileExists(c) Then
        pythonw = c
        Exit For
      End If
    Next
  End If
End If

sh.CurrentDirectory = desktopDir
On Error Resume Next

If pythonw = "" Then
  WriteLog "Brak bundled pythonw: " & bundledPyw
  OpenHeal "missing_runtime"
  WScript.Quit 1
End If

' WindowStyle 0 = ukryte — NIGDY 1 (normalne okno / flash CMD przy starcie).
sh.Run """" & pythonw & """ """ & launchPy & """", 0, False
If Err.Number <> 0 Then
  WriteLog "Blad uruchomienia: " & Err.Description & " (" & Err.Number & ")" & vbCrLf & _
           "Cmd: " & pythonw & " " & launchPy
  MsgBox "Nie udalo sie uruchomic DAM - Dobra Kaloria - Inyfinn." & vbCrLf & vbCrLf & _
         Err.Description & vbCrLf & "Log: " & logFile, vbInformation, "DAM - Dobra Kaloria - Inyfinn"
  WScript.Quit 1
End If

WScript.Quit 0

Sub OpenHeal(reason)
  On Error Resume Next
  If fso.FileExists(healHtml) Then
    sh.Run "cmd /c start """" """ & healHtml & "?reason=" & reason & """", 0, False
  Else
    MsgBox "Brak silnika w folderze aplikacji." & vbCrLf & vbCrLf & _
           "Oczekiwany plik:" & vbCrLf & bundledPyw & vbCrLf & vbCrLf & _
           "Skopiuj kompletny folder DAM (z bin\runtime\win)." & vbCrLf & _
           "Nie trzeba instalowac Pythona.", vbInformation, "DAM - Dobra Kaloria - Inyfinn"
  End If
End Sub

Sub WriteLog(msg)
  On Error Resume Next
  Dim ts
  Set ts = fso.CreateTextFile(logFile, True)
  ts.WriteLine Now & " - " & msg
  ts.Close
End Sub
