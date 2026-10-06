$ErrorActionPreference = 'Stop'
$spikeSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts\marker-spike'))
$externalRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'))
$spikeTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot 'com.vsly.footage-sync.marker-spike_0.1.0'))
if ([IO.Path]::GetDirectoryName($spikeTarget) -ne $externalRoot) { throw 'Unexpected install target' }
if (Get-Process -ErrorAction SilentlyContinue | Where-Object ProcessName -like 'Adobe Premiere Pro*') { throw 'Close Premiere before installing spike' }
if (Test-Path -LiteralPath $spikeTarget) {
  if ((Get-Item -LiteralPath $spikeTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Redirected plugin folder' }
  if ((Get-Content -LiteralPath (Join-Path $spikeTarget 'manifest.json') -Raw | ConvertFrom-Json).id -ne 'com.vsly.footage-sync.marker-spike') { throw 'Different plugin identity' }
}
New-Item -ItemType Directory -Path $spikeTarget -Force | Out-Null
foreach ($spikeFile in Get-ChildItem -LiteralPath $spikeSource -Recurse -File) {
  $spikeRelative = [IO.Path]::GetRelativePath($spikeSource, $spikeFile.FullName)
  $spikeDestination = [IO.Path]::GetFullPath((Join-Path $spikeTarget $spikeRelative))
  if (-not $spikeDestination.StartsWith($spikeTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid spike file target' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($spikeDestination)) -Force | Out-Null
  Copy-Item -LiteralPath $spikeFile.FullName -Destination $spikeDestination -Force
}
Write-Output "Installed isolated marker spike: $spikeTarget"
