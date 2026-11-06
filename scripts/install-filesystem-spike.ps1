$ErrorActionPreference = 'Stop'
$probeSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\artifacts\filesystem-spike'))
$externalRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'))
$probeId = 'com.vsly.footage-sync.filesystem-spike'
$probeTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot ($probeId + '_0.1.0')))
if ([IO.Path]::GetDirectoryName($probeTarget) -ne $externalRoot) { throw 'Unexpected probe target.' }
if (Get-Process -ErrorAction SilentlyContinue | Where-Object ProcessName -like 'Adobe Premiere Pro*') { throw 'Close Premiere before installing probe.' }
if ((Get-Content -LiteralPath (Join-Path $probeSource 'manifest.json') -Raw | ConvertFrom-Json).id -ne $probeId) { throw 'Unexpected probe identity.' }
if (Test-Path -LiteralPath $probeTarget) {
  if ((Get-Item -LiteralPath $probeTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Redirected probe folder.' }
  if ((Get-Content -LiteralPath (Join-Path $probeTarget 'manifest.json') -Raw | ConvertFrom-Json).id -ne $probeId) { throw 'Different plugin identity.' }
}
New-Item -ItemType Directory -Path $probeTarget -Force | Out-Null
foreach ($probeFile in Get-ChildItem -LiteralPath $probeSource -File -Recurse) {
  $probeDestination = [IO.Path]::GetFullPath((Join-Path $probeTarget ([IO.Path]::GetRelativePath($probeSource, $probeFile.FullName))))
  if (-not $probeDestination.StartsWith($probeTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid probe destination.' }
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($probeDestination)) -Force | Out-Null
  Copy-Item -LiteralPath $probeFile.FullName -Destination $probeDestination -Force
}
Write-Output "Installed read-only filesystem probe: $probeTarget"
