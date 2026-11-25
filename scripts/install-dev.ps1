param([string]$PremierePath = 'T:\Programs\Adobe Premiere Pro 2025\Adobe Premiere Pro.exe')
$ErrorActionPreference = 'Stop'
$pluginSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\plugin'))
$pluginManifest = Get-Content -LiteralPath (Join-Path $pluginSource 'manifest.json') -Raw | ConvertFrom-Json
if ($pluginManifest.id -ne 'com.vsly.footage-sync') { throw 'Unexpected plugin identity.' }
if (-not (Test-Path -LiteralPath $PremierePath -PathType Leaf)) { throw 'Premiere executable not found.' }
$premiereVersion = [version](Get-Item -LiteralPath $PremierePath).VersionInfo.ProductVersion
if ($premiereVersion -lt [version]'25.6.0') { throw 'Premiere 25.6 or newer is required.' }
if (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'Adobe Premiere Pro*' }) { throw 'Close Premiere before updating the development plugin.' }
$externalRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'))
if ("$($pluginManifest.version)" -notmatch '^\d+\.\d+\.\d+$') { throw 'Unexpected plugin version.' }
$pluginTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot "$($pluginManifest.id)_$($pluginManifest.version)"))
if ([IO.Path]::GetDirectoryName($pluginTarget) -ne $externalRoot) { throw 'Install target is outside the expected plugin directory.' }
# Two folders with the same plugin id collide in Premiere. Folders of other versions are moved to a backup, never deleted.
$otherVersions = @(if (Test-Path -LiteralPath $externalRoot) { Get-ChildItem -LiteralPath $externalRoot -Directory | Where-Object { $_.Name -like "$($pluginManifest.id)_*" -and $_.FullName -ne $pluginTarget } })
if ($otherVersions.Count) {
  $backupRoot = Join-Path $env:LOCALAPPDATA ('FootageSync\backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  foreach ($otherVersion in $otherVersions) {
    if ($otherVersion.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to move a redirected plugin folder.' }
    $otherManifest = Get-Content -LiteralPath (Join-Path $otherVersion.FullName 'manifest.json') -Raw | ConvertFrom-Json
    if ($otherManifest.id -ne $pluginManifest.id) { throw "Folder $($otherVersion.Name) belongs to another plugin." }
  }
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  foreach ($otherVersion in $otherVersions) {
    Move-Item -LiteralPath $otherVersion.FullName -Destination $backupRoot
    Write-Output "Moved previous version $($otherVersion.Name) to $backupRoot"
  }
}
if (Test-Path -LiteralPath $pluginTarget) {
  $targetInfo = Get-Item -LiteralPath $pluginTarget
  if ($targetInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to write through a redirected plugin folder.' }
  $oldManifest = Get-Content -LiteralPath (Join-Path $pluginTarget 'manifest.json') -Raw | ConvertFrom-Json
  if ($oldManifest.id -ne $pluginManifest.id) { throw 'Existing folder belongs to another plugin.' }
}
New-Item -ItemType Directory -Path $pluginTarget -Force | Out-Null
foreach ($sourceFile in Get-ChildItem -LiteralPath $pluginSource -Recurse -File) {
  $relativePath = $sourceFile.FullName.Substring($pluginSource.Length + 1)
  $targetFile = [IO.Path]::GetFullPath((Join-Path $pluginTarget $relativePath))
  if (-not $targetFile.StartsWith($pluginTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid destination path.' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($targetFile)) -Force | Out-Null
  Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetFile -Force
}
Write-Output "Installed Footage Sync for Premiere $premiereVersion in $pluginTarget"
