$ErrorActionPreference = 'Stop'

$root = 'E:\Chatbot'
$runtime = Join-Path $root 'comfypack\Krea2_runtime'
$hookServer = Join-Path $root 'comfypack\comfyui_hooking_server'
$logDirectory = Join-Path $root 'krea2_integration\logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Test-ListeningPort {
    param([Parameter(Mandatory)][int]$Port)
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-ListeningPort -Port 8190)) {
    Start-Process `
        -FilePath (Join-Path $runtime 'python_embeded\python.exe') `
        -ArgumentList @(
            '-I', '-W', 'ignore::FutureWarning', 'main.py',
            '--windows-standalone-build',
            '--use-flash-attention',
            '--listen', '127.0.0.1',
            '--port', '8190',
            '--disable-auto-launch',
            '--input-directory', (Join-Path $runtime 'ComfyUI\input'),
            '--output-directory', (Join-Path $runtime 'ComfyUI\output'),
            '--temp-directory', (Join-Path $runtime 'ComfyUI\temp'),
            '--user-directory', (Join-Path $runtime 'ComfyUI\user')
        ) `
        -WorkingDirectory (Join-Path $runtime 'ComfyUI') `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'comfyui.stdout.log') `
        -RedirectStandardError (Join-Path $logDirectory 'comfyui.stderr.log')
}

$comfyReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-ListeningPort -Port 8190) {
        $comfyReady = $true
        break
    }
}
if (-not $comfyReady) {
    throw 'Krea2 ComfyUI did not start on port 8190.'
}

if (-not (Test-ListeningPort -Port 8189)) {
    Start-Process `
        -FilePath (Join-Path $hookServer '.venv\Scripts\python.exe') `
        -ArgumentList @('server.py') `
        -WorkingDirectory $hookServer `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'hook.stdout.log') `
        -RedirectStandardError (Join-Path $logDirectory 'hook.stderr.log')
}

$hookReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-ListeningPort -Port 8189) {
        $hookReady = $true
        break
    }
}
if (-not $hookReady) {
    throw 'Hooking Manager did not start on port 8189.'
}

Write-Host 'Krea2 ComfyUI: http://127.0.0.1:8190'
Write-Host 'Hooking Manager / PocketRisu endpoint: http://127.0.0.1:8189'
