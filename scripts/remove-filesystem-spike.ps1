$ErrorActionPreference = 'Stop'
$externalRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'))
$probeId = 'com.vsly.footage-sync.filesystem-spike'
$probeTarget = [IO.Path]::GetFullPath((Join-Path $externalRoot ($probeId + '_0.1.0')))
if ([IO.Path]::GetDirectoryName($probeTarget) -ne $externalRoot) { throw 'Unexpected probe target.' }
if (Get-Process -ErrorAction SilentlyContinue | Where-Object ProcessName -like 'Adobe Premiere Pro*') { throw 'Close Premiere before removing the probe.' }
if (Test-Path -LiteralPath $probeTarget) {
  $entries = @((Get-Item -LiteralPath $probeTarget)) + @(Get-ChildItem -LiteralPath $probeTarget -Recurse -Force)
  if ($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Redirected probe path.' }
  if ((Get-Content -LiteralPath (Join-Path $probeTarget 'manifest.json') -Raw | ConvertFrom-Json).id -ne $probeId) { throw 'Different plugin identity.' }
  Remove-Item -LiteralPath $probeTarget -Recurse -Force
}
if (Test-Path -LiteralPath $probeTarget) { throw 'Probe removal failed.' }
Write-Output "Removed temporary test plugin: $probeTarget"
