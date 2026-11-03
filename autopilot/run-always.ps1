# Makes the Williams Systems Autopilot start with Windows (no login needed) and
# keep running whether or not you are signed in. Windows asks for YOUR Windows
# password once and keeps it for the task; it is never shown or saved anywhere else.
# (Microsoft account sign-in: use the Microsoft account password, not your PIN.)
$ErrorActionPreference = 'Stop'
# the outcome (never the password) goes to autopilot\run-always.result so Claude can see what happened
$resultFile = Join-Path $PSScriptRoot 'run-always.result'
function Note($s) { "$(Get-Date -Format s) $s" | Out-File -FilePath $resultFile -Append -Encoding utf8 }
Note 'window opened'
$task = 'Williams Systems Autopilot'
$dir = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$user = "$env:USERDOMAIN\$env:USERNAME"

Write-Host ""
Write-Host "Williams Systems Autopilot: run 24/7" -ForegroundColor Cyan
Write-Host "Type the Windows password for $user (it goes to Windows only)."
$cred = Get-Credential -UserName $user -Message "Windows password for $user, so the autopilot can run after restarts without anyone logging in"
if (-not $cred) { Note 'cancelled (no password entered)'; Write-Host 'Cancelled, nothing changed.'; Read-Host 'Press Enter to close'; exit 1 }
$pass = $cred.GetNetworkCredential().Password

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c cd /d `"$dir`" && `"$node`" autopilot\server.mjs >> autopilot\autopilot.log 2>&1" -WorkingDirectory $dir
$triggers = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

try {
  Register-ScheduledTask -TaskName $task -Action $action -Trigger $triggers -Settings $settings -User $user -Password $pass `
    -RunLevel Limited -Description 'Ticket autopilot for williamssystems.dev: starts with Windows, runs whether or not anyone is signed in' -Force | Out-Null
} catch {
  Note "Windows refused: $($_.Exception.Message)"
  Write-Host "Windows didn't accept that: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Nothing changed. Run this again and check the password.'
  Read-Host 'Press Enter to close'; exit 1
}

# move the running copy over to the new task
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*autopilot\server.mjs*' -or $_.CommandLine -like '*autopilot/server.mjs*' -or ($_.Name -eq 'cloudflared.exe' -and $_.CommandLine -like '*127.0.0.1:4430*') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $task
Note 'done: task now starts with Windows'
Write-Host ""
Write-Host "Done. The autopilot now starts with Windows and runs whether or not you're signed in." -ForegroundColor Green
Read-Host 'Press Enter to close'
