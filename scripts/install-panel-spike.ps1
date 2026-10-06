$ErrorActionPreference = 'Stop'
$panelSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts\panel-spike'))
$externalRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'))
$panelTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot 'com.vsly.footage-sync.panel-spike_0.1.0'))
if ([IO.Path]::GetDirectoryName($panelTarget) -ne $externalRoot) { throw 'Unexpected install target' }
if (Get-Process -ErrorAction SilentlyContinue | Where-Object ProcessName -like 'Adobe Premiere Pro*') { throw 'Close Premiere before installing probe' }
if ((Get-Content -Raw -LiteralPath (Join-Path $panelSource 'manifest.json') | ConvertFrom-Json).id -ne 'com.vsly.footage-sync.panel-spike') { throw 'Unexpected probe identity' }
if (Test-Path -LiteralPath $panelTarget) {
  if ((Get-Item -LiteralPath $panelTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Redirected plugin folder' }
  if ((Get-Content -LiteralPath (Join-Path $panelTarget 'manifest.json') -Raw | ConvertFrom-Json).id -ne 'com.vsly.footage-sync.panel-spike') { throw 'Different plugin identity' }
}
New-Item -ItemType Directory -Path $panelTarget -Force | Out-Null
foreach ($panelFile in Get-ChildItem -LiteralPath $panelSource -Recurse -File) {
  $panelRelative = [IO.Path]::GetRelativePath($panelSource, $panelFile.FullName)
  $panelDestination = [IO.Path]::GetFullPath((Join-Path $panelTarget $panelRelative))
  if (-not $panelDestination.StartsWith($panelTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid probe file target' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($panelDestination)) -Force | Out-Null
  Copy-Item -LiteralPath $panelFile.FullName -Destination $panelDestination -Force
}
Write-Output "Installed isolated panel probe: $panelTarget"
