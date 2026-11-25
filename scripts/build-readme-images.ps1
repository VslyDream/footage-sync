# Renders README pictures: every docs/readme/src/*.html becomes docs/readme/<name>.png.
# The picture size comes from <meta name="shot-size" content="WIDTHxHEIGHT"> in each source.
param([string]$EdgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $EdgePath -PathType Leaf)) { throw 'Microsoft Edge not found. Pass -EdgePath.' }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs\readme'))
$profileDir = Join-Path ([IO.Path]::GetTempPath()) ('footage-sync-readme-' + [guid]::NewGuid().ToString('N'))
foreach ($source in Get-ChildItem -LiteralPath (Join-Path $root 'src') -Filter '*.html') {
    $match = [regex]::Match((Get-Content -LiteralPath $source.FullName -Raw), 'name="shot-size" content="(\d+)x(\d+)"')
    if (-not $match.Success) { throw "No shot-size in $($source.Name)" }
    $target = Join-Path $root ($source.BaseName + '.png')
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target }
    $arguments = @(
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        "--user-data-dir=$profileDir", "--window-size=$($match.Groups[1].Value),$($match.Groups[2].Value)",
        "--screenshot=$target", ([Uri]$source.FullName).AbsoluteUri
    )
    Start-Process -FilePath $EdgePath -ArgumentList $arguments -Wait -WindowStyle Hidden
    if (-not (Test-Path -LiteralPath $target)) { throw "Edge did not write $target" }
    Write-Output "Rendered $($source.BaseName).png"
}
