' Hidden PAMIEC-PODRECZNA sync. WindowStyle 0 = no console flash.
' Task Scheduler must call wscript.exe (not .cmd, not powershell.exe).
Option Explicit
Dim sh, fso, here, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & here & "\sync-pamiec-podreczna.ps1"""
sh.Run cmd, 0, True
