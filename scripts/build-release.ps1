param([switch]$MacOnly)
$ErrorActionPreference = 'Stop'
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseSource = Join-Path $releaseRoot 'plugin'
$releaseDist = Join-Path $releaseRoot 'dist'
$releaseManifest = Get-Content -LiteralPath (Join-Path $releaseSource 'manifest.json') -Raw | ConvertFrom-Json
$releasePackage = Get-Content -LiteralPath (Join-Path $releaseRoot 'package.json') -Raw | ConvertFrom-Json
if ($releaseManifest.id -ne 'com.vsly.footage-sync' -or $releaseManifest.version -ne $releasePackage.version -or $releaseManifest.host.minVersion -ne '25.6.0') { throw 'Release identity/version/baseline mismatch.' }
$releaseFiles = @(Get-ChildItem -LiteralPath $releaseSource -Recurse -File)
foreach ($releaseFile in $releaseFiles) {
    if ($releaseFile.Attributes -band [IO.FileAttributes]::ReparsePoint -or $releaseFile.Extension -notin @('.js', '.html', '.css', '.json')) { throw "Unexpected plugin payload: $($releaseFile.Name)" }
}
if ((Get-Item -LiteralPath $releaseSource).Attributes -band [IO.FileAttributes]::ReparsePoint -or @(Get-ChildItem -LiteralPath $releaseSource -Recurse -Directory | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Redirected plugin directories are not release inputs.' }
New-Item -ItemType Directory -Path $releaseDist -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
$releaseVersion = $releaseManifest.version
$releaseFolder = "$($releaseManifest.id)_$releaseVersion"
$releaseCCX = Join-Path $releaseDist $(if ($MacOnly) { "Footage-Sync-$releaseVersion-Mac.ccx" } else { "Footage-Sync-$releaseVersion.ccx" })
$releaseZIP = Join-Path $releaseDist $(if ($MacOnly) { "Footage-Sync-$releaseVersion-Mac.zip" } else { "Footage-Sync-$releaseVersion-Windows.zip" })
$releaseInstructions = Join-Path $releaseRoot $(if ($MacOnly) { 'docs\INSTALL_MAC_V0_1_RU.md' } else { 'docs\INSTALL_V0_1_RU.md' })
$releaseInstructionName = [IO.Path]::GetFileName($releaseInstructions)

function New-ReleaseArchive([string]$archivePath, [string]$entryPrefix, [bool]$includeInstructions, [object[]]$inputFiles = $releaseFiles, [string]$inputRoot = $releaseSource) {
    $stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create, [IO.FileAccess]::Write)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($releaseFile in $inputFiles) {
            $relative = [IO.Path]::GetRelativePath($inputRoot, $releaseFile.FullName).Replace('\', '/')
            $entry = $archive.CreateEntry($entryPrefix + $relative, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::new(2026, 10, 6, 0, 0, 0, [TimeSpan]::Zero)
            $inputStream = [IO.File]::OpenRead($releaseFile.FullName)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
        }
        if ($includeInstructions) {
            $entry = $archive.CreateEntry($releaseInstructionName)
            $entry.LastWriteTime = [DateTimeOffset]::new(2026, 10, 6, 0, 0, 0, [TimeSpan]::Zero)
            $inputStream = [IO.File]::OpenRead($releaseInstructions)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose(); $outputStream.Dispose() }
        }
    } finally { $archive.Dispose(); $stream.Dispose() }
}
function Test-ReleaseArchive([string]$archivePath, [string]$entryPrefix, [bool]$includeInstructions, [object[]]$inputFiles = $releaseFiles, [string]$inputRoot = $releaseSource) {
    $stream = [IO.File]::OpenRead($archivePath)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read)
    try {
        $expectedCount = $inputFiles.Count + [int]$includeInstructions
        if ($archive.Entries.Count -ne $expectedCount) { throw 'Unexpected release entries.' }
        foreach ($releaseFile in $inputFiles) {
            $relative = [IO.Path]::GetRelativePath($inputRoot, $releaseFile.FullName).Replace('\', '/')
            $entry = $archive.GetEntry($entryPrefix + $relative)
            if (-not $entry) { throw "Missing release file: $relative" }
            $entryStream = $entry.Open()
            try { $actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($entryStream)) } finally { $entryStream.Dispose() }
            if ($actual -ne (Get-FileHash -LiteralPath $releaseFile.FullName -Algorithm SHA256).Hash) { throw "Release content differs: $relative" }
        }
        if ($includeInstructions) {
            $entryStream = $archive.GetEntry($releaseInstructionName).Open()
            try { $actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($entryStream)) } finally { $entryStream.Dispose() }
            if ($actual -ne (Get-FileHash -LiteralPath $releaseInstructions).Hash) { throw 'Packaged instructions differ.' }
        }
    } finally { $archive.Dispose(); $stream.Dispose() }
}
New-ReleaseArchive $releaseCCX '' $false
Test-ReleaseArchive $releaseCCX '' $false
if ($MacOnly) {
    $bundleFiles = @((Get-Item -LiteralPath $releaseCCX))
    New-ReleaseArchive $releaseZIP '' $true $bundleFiles $releaseDist
    Test-ReleaseArchive $releaseZIP '' $true $bundleFiles $releaseDist
} else {
    New-ReleaseArchive $releaseZIP ($releaseFolder + '/') $true
    Test-ReleaseArchive $releaseZIP ($releaseFolder + '/') $true
}
Copy-Item -LiteralPath $releaseInstructions -Destination (Join-Path $releaseDist $releaseInstructionName) -Force
$releaseChecksums = @($releaseCCX, $releaseZIP, (Join-Path $releaseDist $releaseInstructionName)) | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetFileName($_) }
$checksumName = if ($MacOnly) { 'SHA256SUMS-Mac.txt' } else { 'SHA256SUMS.txt' }
[IO.File]::WriteAllText((Join-Path $releaseDist $checksumName), ($releaseChecksums -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
Write-Output "Packaged and verified $($releaseFiles.Count) plugin files in CCX and $(if ($MacOnly) { 'Mac' } else { 'Windows' }) ZIP, version $releaseVersion."

