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
$pluginTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot 'com.vsly.footage-sync_0.1.0'))
if ([IO.Path]::GetDirectoryName($pluginTarget) -ne $externalRoot) { throw 'Install target is outside the expected plugin directory.' }
if (Test-Path -LiteralPath $pluginTarget) {
  $targetInfo = Get-Item -LiteralPath $pluginTarget
  if ($targetInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to write through a redirected plugin folder.' }
  $oldManifest = Get-Content -LiteralPath (Join-Path $pluginTarget 'manifest.json') -Raw | ConvertFrom-Json
  if ($oldManifest.id -ne $pluginManifest.id) { throw 'Existing folder belongs to another plugin.' }
}
New-Item -ItemType Directory -Path $pluginTarget -Force | Out-Null
foreach ($sourceFile in Get-ChildItem -LiteralPath $pluginSource -Recurse -File) {
  $relativePath = [IO.Path]::GetRelativePath($pluginSource, $sourceFile.FullName)
  $targetFile = [IO.Path]::GetFullPath((Join-Path $pluginTarget $relativePath))
  if (-not $targetFile.StartsWith($pluginTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid destination path.' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($targetFile)) -Force | Out-Null
  Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetFile -Force
}
Write-Output "Installed Footage Sync for Premiere $premiereVersion in $pluginTarget"
