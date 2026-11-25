# Установка Footage Sync — инструкция для агента

Этот файл написан для ИИ-агента (Claude Code, Codex и подобных), которого попросили установить или обновить плагин Footage Sync для Adobe Premiere Pro. Задача агента — сделать всё самому. Пользователю остаётся только открыть панель в Premiere.

## Что должно получиться

- В `%APPDATA%\Adobe\UXP\Plugins\External` лежит папка `com.vsly.footage-sync_<версия>`, и `manifest.json` находится прямо в ней.
- Других папок `com.vsly.footage-sync_*` там нет.
- Пользователю сказано, где открыть панель: **Window → UXP Plugins → Footage Sync → Footage Sync**.

## Правила

1. Не закрывайте Premiere принудительно: у пользователя могут быть несохранённые проекты. Если Premiere запущен, попросите сохранить проекты и закрыть его, затем продолжайте. Это единственное, что может понадобиться от пользователя.
2. Трогайте только папки, имя которых начинается с `com.vsly.footage-sync_`. Соседние плагины не трогайте, включая `com.vsly.footage-sync.marker-spike_*`, `com.vsly.footage-sync.panel-spike_*` и `com.polden.*`. Файлы самого Premiere тоже.
3. Ничего не удаляйте. Прежнюю версию плагина переместите в резервную папку и назовите пользователю путь.
4. Файлы проектов не трогайте. Связи и настройки пользователя хранятся рядом с проектом в `<проект>.prproj.footage-sync.json`, поэтому при обновлении плагина они сохраняются.

## Windows

Команды ниже рассчитаны на один сеанс PowerShell: блоки используют переменные друг друга. Подходит и Windows PowerShell 5.1, и PowerShell 7.

### 1. Проверить Premiere

```powershell
$ErrorActionPreference = 'Stop'
$premiere = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Adobe Premiere Pro.exe' -ErrorAction SilentlyContinue).'(default)'
if ($premiere) { $premiere = $premiere.Trim('"') }
if (-not $premiere -or -not (Test-Path -LiteralPath $premiere)) { throw 'Premiere Pro не найден. Спросите у пользователя путь к Adobe Premiere Pro.exe.' }
$premiereVersion = [version](Get-Item -LiteralPath $premiere).VersionInfo.ProductVersion
if ($premiereVersion -lt [version]'25.6.0') { throw "Нужен Premiere Pro 25.6 или новее, найден $premiereVersion." }
if (Get-Process | Where-Object { $_.ProcessName -like 'Adobe Premiere Pro*' }) { throw 'Premiere запущен. Попросите пользователя сохранить проекты и закрыть его.' }
"Premiere $premiereVersion закрыт, можно устанавливать."
```

### 2. Скачать последний релиз

Репозиторий открытый, вход в GitHub не нужен. Список релизов запрашивается целиком, потому что адрес `releases/latest` не видит предварительные релизы.

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ 'User-Agent' = 'footage-sync-installer' }
$work = Join-Path $env:TEMP ('footage-sync-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$release = Invoke-RestMethod -Headers $headers -Uri 'https://api.github.com/repos/VslyDream/footage-sync/releases?per_page=10' | ForEach-Object { $_ } | Where-Object { -not $_.draft } | Select-Object -First 1
$asset = $release.assets | Where-Object { $_.name -like 'Footage-Sync-*-Windows.zip' } | Select-Object -First 1
$sums = $release.assets | Where-Object { $_.name -eq 'SHA256SUMS.txt' } | Select-Object -First 1
if (-not $asset -or -not $sums) { throw 'В последнем релизе нет Windows ZIP или SHA256SUMS.txt.' }
$zip = Join-Path $work $asset.name
Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $asset.browser_download_url -OutFile $zip
$sumsText = Invoke-RestMethod -Headers $headers -Uri $sums.browser_download_url
$expected = (($sumsText -split "`n" | Where-Object { $_ -match ('\s' + [regex]::Escape($asset.name) + '\s*$') }) -split '\s+')[0]
if (-not $expected -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $expected) { throw 'Контрольная сумма архива не совпала.' }
"Скачан $($asset.name) из релиза $($release.tag_name)."
```

### 3. Установить

```powershell
$pluginId = 'com.vsly.footage-sync'
$unzipped = Join-Path $work 'unzipped'
Expand-Archive -LiteralPath $zip -DestinationPath $unzipped
$source = Get-ChildItem -LiteralPath $unzipped -Directory | Where-Object { $_.Name -like "${pluginId}_*" } | Select-Object -First 1
if (-not $source) { throw 'В архиве нет папки плагина.' }
$manifest = Get-Content -LiteralPath (Join-Path $source.FullName 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.id -ne $pluginId -or $source.Name -ne "${pluginId}_$($manifest.version)") { throw 'Папка в архиве не похожа на Footage Sync.' }

$external = Join-Path $env:APPDATA 'Adobe\UXP\Plugins\External'
New-Item -ItemType Directory -Path $external -Force | Out-Null
$backup = Join-Path $env:LOCALAPPDATA ('FootageSync\backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$previous = @(Get-ChildItem -LiteralPath $external -Directory | Where-Object { $_.Name -like "${pluginId}_*" })
foreach ($old in $previous) {
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Move-Item -LiteralPath $old.FullName -Destination $backup
}
Copy-Item -LiteralPath $source.FullName -Destination $external -Recurse
$installed = Join-Path $external $source.Name
```

### 4. Проверить и сообщить

```powershell
$differs = @(Get-ChildItem -LiteralPath $source.FullName -Recurse -File | Where-Object {
    $copy = Join-Path $installed $_.FullName.Substring($source.FullName.Length + 1)
    -not (Test-Path -LiteralPath $copy) -or (Get-FileHash -LiteralPath $copy).Hash -ne (Get-FileHash -LiteralPath $_.FullName).Hash
})
if ($differs.Count) { throw "Не совпали файлы: $($differs.Name -join ', ')" }
"Footage Sync $($manifest.version) установлен: $installed"
if ($previous.Count) { "Прежняя версия перемещена в $backup" }
```

Скажите пользователю:

- какая версия установлена;
- куда перемещена прежняя версия, если она была;
- что панель открывается в Premiere через **Window → UXP Plugins → Footage Sync → Footage Sync** и что дальше идёт раздел «Первый запуск» в [README](../README.md#первый-запуск).

## Установка из исходников

Нужна, когда требуется версия новее последнего релиза. Склонируйте репозиторий и выполните блок 1. Затем вместо блоков 2 и 3 скопируйте папку `plugin` в `External` под именем `com.vsly.footage-sync_<версия>`, где версия взята из `plugin/manifest.json`. Прежнюю папку плагина сначала переместите в резервную, как в блоке 3.

Разработчик может использовать готовый скрипт. Ему нужен PowerShell 7 и путь к Premiere:

```powershell
pwsh ./scripts/install-dev.ps1 -PremierePath "<путь к Adobe Premiere Pro.exe>"
```

## macOS

Сборки для macOS не проверены на настоящем Mac. Предупредите об этом пользователя до установки.

Возьмите из релиза `Footage-Sync-<версия>-Mac-Manual.zip`, распакуйте и скопируйте папку `com.vsly.footage-sync_<версия>` в `~/Library/Application Support/Adobe/UXP/Plugins/External`. Правила те же: Premiere закрыт, прежняя версия перемещена в резервную папку, соседние плагины не тронуты. Подробности — в [инструкции для Mac](INSTALL_MAC_MANUAL_V0_1_RU.md).

## Если плагина нет в меню Premiere

1. Проверьте версию Premiere: нужна 25.6 или новее.
2. Проверьте вложенность: `manifest.json` лежит прямо в `com.vsly.footage-sync_<версия>`, а не в подпапке.
3. Проверьте, что в `External` одна папка этого плагина.
4. Спросите пользователя, не ставил ли он плагин ещё и файлом `.ccx` через Creative Cloud. Две копии с одним идентификатором мешают друг другу. Копию из Creative Cloud пользователь удаляет сам в её окне управления плагинами.
5. Premiere читает папку плагинов при запуске: после установки его нужно запустить заново.
