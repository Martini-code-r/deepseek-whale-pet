' DeepSeek 鲸鱼娘桌宠 · 无控制台启动器
' 双击本文件即可启动；实际启动逻辑在 launch.cmd 中。
Option Explicit

Dim shell, fso, appDir, cmd, args
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd.exe /c """ & fso.BuildPath(appDir, "launch.cmd") & """"
If WScript.Arguments.Count > 0 Then
  cmd = cmd & " " & WScript.Arguments(0)
End If

shell.Run cmd, 0, False
