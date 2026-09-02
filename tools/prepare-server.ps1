# Makes sure the world exists AND has the Enchanted Shop pack activated on
# it, in one shot, with no manual steps - this is what makes a fresh
# "git clone -> npm install -> npm run build -> start.bat" actually work on
# the very first try instead of needing a throwaway first launch.
#
# Bedrock only creates server\worlds\<level-name>\ *during* bedrock_server.exe's
# own startup, and world_behavior_packs.json (the file that actually
# activates a pack) has to already exist inside that folder before that
# same startup gets to its "which packs are active" check - so there is no
# way to activate a pack on a world that doesn't exist yet from outside the
# process. The fix: if the world doesn't exist yet, this script launches
# bedrock_server.exe itself just long enough to create it, sends it a clean
# "stop" over stdin the moment the world files show up on disk, waits for
# it to exit, and only *then* writes world_behavior_packs.json - before
# start.bat launches the real, interactive session.
#
# Safe/idempotent to re-run: an existing world is left completely alone
# (bootstrapping is skipped), and world_behavior_packs.json is simply
# rewritten from the pack's current manifest.json every time, so a pack
# version bump is picked up for free.
#
# Usage (from the repo root):
#   npm run prepare-server        (also called automatically by start.bat)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot "server"
$exePath = Join-Path $serverDir "bedrock_server.exe"
$manifestPath = Join-Path $repoRoot "packs\EnchantedShop_BP\manifest.json"
$propertiesPath = Join-Path $serverDir "server.properties"

if (!(Test-Path $exePath)) {
    throw "bedrock_server.exe not found in $serverDir. Extract the Bedrock Dedicated Server zip into 'server' first."
}
if (!(Test-Path $manifestPath)) {
    throw "Pack manifest not found: $manifestPath. Run 'npm run build' first."
}
if (!(Test-Path $propertiesPath)) {
    throw "server\server.properties not found."
}

$levelNameLine = Get-Content $propertiesPath | Where-Object { $_ -match '^\s*level-name\s*=' } | Select-Object -First 1
if (-not $levelNameLine) {
    throw "Could not find 'level-name=' in server.properties."
}
$levelName = ($levelNameLine -split '=', 2)[1].Trim()

$worldDir = Join-Path $serverDir "worlds\$levelName"
$levelDatPath = Join-Path $worldDir "level.dat"

if (!(Test-Path $levelDatPath)) {
    Write-Host "[prepare-server] World '$levelName' doesn't exist yet - launching bedrock_server.exe once to create it..."

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exePath
    $psi.WorkingDirectory = $serverDir
    $psi.RedirectStandardInput = $true
    $psi.UseShellExecute = $false

    $bootstrapProcess = New-Object System.Diagnostics.Process
    $bootstrapProcess.StartInfo = $psi
    $bootstrapProcess.Start() | Out-Null

    $deadline = (Get-Date).AddSeconds(90)
    while (!(Test-Path $levelDatPath) -and (Get-Date) -lt $deadline -and !$bootstrapProcess.HasExited) {
        Start-Sleep -Milliseconds 500
    }

    if ($bootstrapProcess.HasExited) {
        throw "bedrock_server.exe exited unexpectedly while bootstrapping the world (exit code $($bootstrapProcess.ExitCode)) - check the log above."
    }
    if (!(Test-Path $levelDatPath)) {
        Write-Host "[prepare-server] Timed out waiting for the world to be created - stopping the bootstrap instance anyway."
    } else {
        # A couple extra seconds so the initial world save has settled before we yank it.
        Start-Sleep -Seconds 3
    }

    Write-Host "[prepare-server] Stopping the bootstrap instance..."
    $bootstrapProcess.StandardInput.WriteLine("stop")
    $bootstrapProcess.StandardInput.Flush()

    if (!$bootstrapProcess.WaitForExit(30000)) {
        Write-Host "[prepare-server] Bootstrap instance didn't stop cleanly in time - killing it."
        $bootstrapProcess.Kill()
        $bootstrapProcess.WaitForExit()
    }

    Write-Host "[prepare-server] World '$levelName' created."
} else {
    Write-Host "[prepare-server] World '$levelName' already exists."
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$activation = @(
    [ordered]@{
        pack_id = $manifest.header.uuid
        version = $manifest.header.version
    }
)
$activationPath = Join-Path $worldDir "world_behavior_packs.json"
# ConvertTo-Json unrolls a single-element array when it arrives via the
# pipeline, which would silently produce "{...}" instead of the required
# "[{...}]" - use -InputObject (not a pipe) so $activation stays an array.
ConvertTo-Json -InputObject $activation -Depth 5 | Set-Content -Path $activationPath -Encoding utf8

Write-Host "[prepare-server] Activated $($manifest.header.name) ($($manifest.header.uuid)) on world '$levelName'."
