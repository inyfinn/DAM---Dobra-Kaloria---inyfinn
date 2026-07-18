Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
desktopDir = fso.GetParentFolderName(WScript.ScriptFullName)
launchPy = desktopDir & "\launch.py"
logFile = desktopDir & "\launch-last-error.txt"

If Not fso.FileExists(launchPy) Then
  MsgBox "Nie znaleziono launch.py w " & desktopDir, vbCritical, "DAM ETA"
  WScript.Quit 1
End If

' Preferuj pelna sciezke (skrot nie dziedziczy zawsze PATH z terminala).
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

' WAZNE: styl okna 1 (SW_SHOWNORMAL), NIE 0 (SW_HIDE).
' pythonw.exe i tak nie ma konsoli - styl 0 nie chowa konsoli, tylko
' blokuje na starcie widocznosc glownego okna WebView2 (pywebview/WinForms
' dziedziczy stan "hidden" ze STARTUPINFO procesu). Efekt: aplikacja
' dziala w tle (most, watcher, WebView2), ale okno nigdy sie nie pojawia.
sh.CurrentDirectory = desktopDir

On Error Resume Next
If pythonw = "" Then
  ' Fallback: PATH
  sh.Run "pythonw """ & launchPy & """", 1, False
  If Err.Number <> 0 Then
    Err.Clear
    sh.Run "python """ & launchPy & """", 1, False
    If Err.Number <> 0 Then
      WriteLog "Nie znaleziono pythonw/python. Zainstaluj Python 3 i dodaj do PATH."
      MsgBox "Nie znaleziono Python (pythonw)." & vbCrLf & vbCrLf & _
             "Zainstaluj Python 3 albo sprawdz PATH." & vbCrLf & _
             "Log: " & logFile, vbCritical, "DAM ETA"
      WScript.Quit 1
    End If
  End If
Else
  sh.Run """" & pythonw & """ """ & launchPy & """", 1, False
  If Err.Number <> 0 Then
    WriteLog "Blad uruchomienia: " & Err.Description & " (" & Err.Number & ")" & vbCrLf & _
             "Cmd: " & pythonw & " " & launchPy
    MsgBox "Nie udalo sie uruchomic DAM ETA." & vbCrLf & vbCrLf & _
           Err.Description & vbCrLf & "Log: " & logFile, vbCritical, "DAM ETA"
    WScript.Quit 1
  End If
End If

WScript.Quit 0

Sub WriteLog(msg)
  On Error Resume Next
  Dim ts
  Set ts = fso.CreateTextFile(logFile, True)
  ts.WriteLine Now & " - " & msg
  ts.Close
End Sub
