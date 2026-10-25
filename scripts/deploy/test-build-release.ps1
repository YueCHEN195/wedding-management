# Packaging integration test with mock commands; no Docker/SSH/server changes.
$ErrorActionPreference = 'Stop'
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../releases'))
$existing = @(Get-ChildItem -LiteralPath $releaseRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object FullName)
$global:mockReleaseCalls = New-Object 'System.Collections.Generic.List[string]'

function docker {
    $global:LASTEXITCODE = 0
    $global:mockReleaseCalls.Add('docker ' + ($args -join ' '))
    switch ($args[0]) {
        'info' { Write-Output 'linux' }
        'image' { Write-Output ('sha256:' + ('a' * 64)) }
        'save' { [IO.File]::WriteAllText($args[2], 'mock image archive') }
    }
}
function pnpm { $global:LASTEXITCODE = 0; $global:mockReleaseCalls.Add('pnpm ' + ($args -join ' ')) }
function node { $global:LASTEXITCODE = 0; Write-Output 'v24.22.1' }
function Start-Process { param($FilePath, $ArgumentList) }

try {
    & (Join-Path $PSScriptRoot 'build-release.ps1')
    $created = @(Get-ChildItem -LiteralPath $releaseRoot -Directory | Where-Object FullName -NotIn $existing)
    if ($created.Count -ne 1) { throw 'Expected exactly one release folder.' }
    $manifest = Get-Content (Join-Path $created[0].FullName 'release.json') -Raw | ConvertFrom-Json
    $actualHash = (Get-FileHash (Join-Path $created[0].FullName 'image.tar')).Hash.ToLowerInvariant()
    if ($manifest.sha256 -ne $actualHash -or $manifest.platform -ne 'linux/amd64') { throw 'Invalid manifest.' }
    foreach ($file in @('update-server.py', 'deployment_support.py', 'SERVER-COMMAND.txt')) {
        if (-not (Test-Path (Join-Path $created[0].FullName $file))) { throw "Missing $file" }
    }
    if (-not ($global:mockReleaseCalls -contains 'pnpm check')) { throw 'Project checks were skipped.' }
    if (-not ($global:mockReleaseCalls -match '^docker build --platform linux/amd64')) { throw 'Missing platform.' }
    if (-not ($global:mockReleaseCalls -match '--build-arg DEBIAN_MIRROR=https://deb.debian.org')) { throw 'Missing HTTPS Debian mirror.' }
    if (-not ($global:mockReleaseCalls -match '^docker run --rm --network none')) { throw 'Missing Linux smoke check.' }
    $smokeCall = @($global:mockReleaseCalls -match '^docker run --rm --network none')[0]
    if ($smokeCall -notmatch "process.env.JWT_SECRET = .*randomBytes\(32\).*; const \{ runMigrations \} = await import") { throw 'Missing disposable secret before production imports.' }
    if ($smokeCall -notmatch 'DB_PATH=/tmp/release-smoke.db' -or $smokeCall -match '--env-file|--volume|NODE_ENV=development') { throw 'Smoke check must retain isolated production validation.' }
    Write-Output 'PASS: checks -> amd64 build -> Linux smoke -> archive -> checksum/manifest -> updater bundle.'
} finally {
    # Only remove folders created by this test, verified beneath the release root and with mock contents.
    $generated = @(Get-ChildItem -LiteralPath $releaseRoot -Directory -ErrorAction SilentlyContinue | Where-Object FullName -NotIn $existing)
    foreach ($folder in $generated) {
        $resolved = [IO.Path]::GetFullPath($folder.FullName)
        $archive = Join-Path $resolved 'image.tar'
        if ($resolved.StartsWith($releaseRoot + [IO.Path]::DirectorySeparatorChar) -and (Test-Path -LiteralPath $archive) -and [IO.File]::ReadAllText($archive) -eq 'mock image archive') {
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }
}
