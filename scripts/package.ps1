$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path $PSScriptRoot -Parent
$buildRoot = Join-Path $projectRoot ('.runtime/package-' + [guid]::NewGuid().ToString('N'))
$packRoot = Join-Path $buildRoot 'packs'
$distRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $packRoot,$distRoot -Force | Out-Null
$versions = @()
foreach ($kind in @('behavior','resource')) {
    $source = Join-Path $projectRoot "cessna172s/${kind}_packs/skyhawk"
    $manifest = Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
    $version = $manifest.header.version -join '.'
    $versions += $version
    $destination = Join-Path $packRoot "Cessna172S-${kind}-${version}.mcpack"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($source,$destination,[System.IO.Compression.CompressionLevel]::Optimal,$false)
}
if ($versions[0] -ne $versions[1]) { throw 'Behavior and resource pack versions must match.' }
$bundle = Join-Path $buildRoot "Cessna172S-V$($versions[0])-ALL-IN-ONE.mcaddon"
[System.IO.Compression.ZipFile]::CreateFromDirectory($packRoot,$bundle,[System.IO.Compression.CompressionLevel]::Optimal,$false)
Copy-Item -LiteralPath $bundle -Destination $distRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'Cessna172S-README.txt') -Destination (Join-Path $distRoot "Cessna172S-V$($versions[0])-README.txt") -Force
Write-Output (Join-Path $distRoot (Split-Path $bundle -Leaf))
