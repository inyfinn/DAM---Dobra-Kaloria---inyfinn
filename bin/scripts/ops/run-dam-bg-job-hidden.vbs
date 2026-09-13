' Hidden launcher for DAM scheduled jobs. WindowStyle 0 = no console flash.
' Usage: wscript.exe run-dam-bg-job-hidden.vbs panel-dam-sync
'        wscript.exe run-dam-bg-job-hidden.vbs db-git-sync
Option Explicit
Dim sh, fso, here, jobId, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
jobId = "panel-dam-sync"
If WScript.Arguments.Count > 0 Then
  jobId = WScript.Arguments(0)
End If
cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & here & "\run-dam-bg-job.ps1"" -JobId " & jobId
' 0 = hidden, True = wait so Last Result reflects the job
sh.Run cmd, 0, True
