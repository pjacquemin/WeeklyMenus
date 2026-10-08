$ErrorActionPreference = 'Stop'
$taskPython = 'C:\Users\pjacquemin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$taskUrl = 'http://127.0.0.1:4173/'

function Test-WeeklyMenus {
    try {
        $taskState = Invoke-RestMethod -Uri ($taskUrl + 'api/state') -TimeoutSec 2
        return ($null -ne $taskState.revision -and $null -ne $taskState.recipes)
    } catch { return $false }
}

try {
    if (-not (Test-WeeklyMenus)) {
        if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Python est introuvable.' }
        Start-Process -FilePath $taskPython -ArgumentList @('"' + (Join-Path $PSScriptRoot 'server.py') + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
        $taskReady = $false
        for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
            if (Test-WeeklyMenus) { $taskReady = $true; break }
            Start-Sleep -Milliseconds 300
        }
        if (-not $taskReady) { throw 'Le serveur ne démarre pas. Le port 4173 est peut-être occupé.' }
    }
    Start-Process $taskUrl
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'WeeklyMenus') | Out-Null
}
