Set WshShell = CreateObject("WScript.Shell")
Dim deploy
deploy = "D:\Techfluent projects\qms 22-04-2026\deploy\"
WshShell.Run """" & deploy & "start_qms.bat""", 0, True
WshShell.Run """" & deploy & "watch_qms.bat""", 0, False