param(
    [switch]$Publish,
    [ValidateSet('https://mirrors.tuna.tsinghua.edu.cn', 'https://mirrors.ustc.edu.cn', 'https://deb.debian.org')]
    [string]$DebianMirror = 'https://deb.debian.org'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

function Invoke-ReleaseCommand {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}

function Publish-Release {
    param([string]$BundlePath, [string]$Version)
    $configPath = Join-Path $PSScriptRoot 'server.local.json'
    if (-not (Test-Path -LiteralPath $configPath)) {
        throw 'Copy scripts/deploy/server.example.json to server.local.json and enter your SSH target first. The local release has been retained.'
    }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($config.target -notmatch '^[a-z_][a-z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$' -or $config.target -match 'YOUR_SERVER') {
        throw 'Invalid SSH target; expected ubuntu@your-server-ip.'
    }
    foreach ($remotePath in @($config.project, $config.inbox)) {
        if ($remotePath -notmatch '^/home/[a-z_][a-z0-9_-]*/[a-zA-Z0-9_/-]+$' -or $remotePath.Contains('..')) {
            throw 'Remote paths must be simple absolute paths below /home/user/.'
        }
    }
    Get-Command ssh, scp -ErrorAction Stop | Out-Null
    Invoke-ReleaseCommand 'ssh' @($config.target, "mkdir -p -- '$($config.inbox)'")
    Invoke-ReleaseCommand 'scp' @('-r', $BundlePath, "$($config.target):$($config.inbox)/")
    $remoteScript = "$($config.inbox)/$Version/update-server.py"
    Invoke-ReleaseCommand 'ssh' @($config.target, "sudo -n python3 '$remoteScript' --project '$($config.project)'")
}

try {
    Set-Location -LiteralPath $projectRoot
    Get-Command docker, pnpm, node -ErrorAction Stop | Out-Null
    $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 24) { throw 'Node 24 or newer is required.' }
    $engine = & docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0 -or ($engine -join '').Trim() -ne 'linux') {
        throw 'Start Docker Desktop, wait until the Linux engine is running, then double-click again.'
    }
    if (-not (Test-Path 'tooling/eslint/node_modules/eslint/bin/eslint.js')) {
        Invoke-ReleaseCommand 'pnpm' @('lint:setup')
    }
    Write-Host '[1/5] Running project checks...'
    Invoke-ReleaseCommand 'pnpm' @('check')
    $version = 'wedding-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
    $image = "wedding-management:$version"
    $bundle = Join-Path $projectRoot "releases/$version"
    New-Item -ItemType Directory -Path $bundle | Out-Null
    Write-Host '[2/5] Building linux/amd64 image...'
    Write-Host "Debian package mirror: $DebianMirror"
    Invoke-ReleaseCommand 'docker' @('build', '--platform', 'linux/amd64', '--build-arg', "DEBIAN_MIRROR=$DebianMirror", '-t', $image, '.')
    $imageId = & docker image inspect --format '{{.Id}}' $image
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the built image.' }
    Write-Host '[3/5] Checking migrations and native modules in an isolated Linux container...'
    # Generate a disposable secret inside the isolated container before loading production env validation.
    $smokeScript = "process.env.JWT_SECRET = (await import('node:crypto')).randomBytes(32).toString('hex'); const { runMigrations } = await import('./server/db/migrate.ts'); runMigrations(); await import('sharp'); console.log('Linux dependencies and migrations OK');"
    Invoke-ReleaseCommand 'docker' @('run', '--rm', '--network', 'none', '-e', 'DB_PATH=/tmp/release-smoke.db', $image, 'node', '--import', 'tsx', '--input-type=module', '-e', $smokeScript)
    $archive = Join-Path $bundle 'image.tar'
    Write-Host '[4/5] Exporting image (this file may be large)...'
    Invoke-ReleaseCommand 'docker' @('save', '-o', $archive, $image)
    $manifest = [ordered]@{
        version = $version
        image = $image
        imageId = ($imageId -join '').Trim()
        archive = 'image.tar'
        sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        platform = 'linux/amd64'
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $bundle 'release.json'), ($manifest | ConvertTo-Json), $utf8)
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'update-server.py') -Destination $bundle
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'deployment_support.py') -Destination $bundle
    $manual = "sudo python3 /home/ubuntu/$version/update-server.py --project /home/ubuntu/wedding-management"
    [IO.File]::WriteAllText((Join-Path $bundle 'SERVER-COMMAND.txt'), $manual + [Environment]::NewLine, $utf8)
    Write-Host "[5/5] Release ready: $bundle"
    if ($Publish) { Publish-Release $bundle $version }
    else {
        Write-Host 'Upload the ENTIRE release folder to /home/ubuntu using OrcaTerm (Upload folder).'
        Write-Host 'Then paste the one line from SERVER-COMMAND.txt into the server terminal.'
        Start-Process explorer.exe -ArgumentList $bundle
    }
} catch {
    Write-Host "Release failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
