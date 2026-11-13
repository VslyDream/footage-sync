param([string]$Report = (Join-Path $PSScriptRoot '..\artifacts\ui-redesign\installed.json'))
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\plugin'))
$targetRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External\com.vsly.footage-sync_0.1.0'))
$checks = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | ForEach-Object {
  $relative = [IO.Path]::GetRelativePath($sourceRoot, $_.FullName)
  $installedFile = Join-Path $targetRoot $relative
  $sourceHash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
  $installedHash = if (Test-Path -LiteralPath $installedFile -PathType Leaf) { (Get-FileHash -LiteralPath $installedFile -Algorithm SHA256).Hash } else { $null }
  [pscustomobject]@{ path = $relative; sourceHash = $sourceHash; installedHash = $installedHash; match = $sourceHash -eq $installedHash }
})
$extras = @(Get-ChildItem -LiteralPath $targetRoot -Recurse -File | Where-Object {
  -not (Test-Path -LiteralPath (Join-Path $sourceRoot ([IO.Path]::GetRelativePath($targetRoot, $_.FullName))))
} | ForEach-Object FullName)
$result = [pscustomobject]@{ time = [DateTime]::UtcNow.ToString('o'); files = $checks; extras = $extras; matched = @($checks | Where-Object match).Count; total = $checks.Count }
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Report))) -Force | Out-Null
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Report -Encoding utf8
if (@($checks | Where-Object { -not $_.match }).Count -or $extras.Count) { throw 'Installed files differ from source. See report.' }
Write-Output ('Verified {0}/{1} source files; no extras.' -f $result.matched, $result.total)
