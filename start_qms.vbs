Set WshShell = CreateObject("WScript.Shell")

' Run your batch file silently (0 = hidden)
WshShell.Run """C:\Users\Administrator\Downloads\qms 07-04-2026\start_qms.bat""", 0, False
