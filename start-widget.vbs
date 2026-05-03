Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\hosse\Desktop\ClaudeCodeTest"
WshShell.Run "cmd /c npx electron .", 0, False
