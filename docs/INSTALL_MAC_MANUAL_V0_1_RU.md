# Footage Sync v0.1.0 — ручная установка на Mac

Пакет `Footage-Sync-0.1.0-Mac-Manual.zip` для Premiere Pro 25.6+ содержит готовую папку плагина. Установка выполняется в Finder без Creative Cloud Desktop, CCX, UPIA или дополнительного установщика. Premiere уже должен быть установлен. На настоящем Mac установка Footage Sync этим способом **ещё не проверена**; для первого запуска используйте копию проекта.

## Установка через Finder

1. Сохраните проекты и полностью закройте Premiere.
2. Распакуйте `Footage-Sync-0.1.0-Mac-Manual.zip` обычным Archive Utility/Finder.
3. В Finder нажмите **Cmd + Shift + G** и вставьте:

   `~/Library/Application Support/Adobe/UXP/Plugins/External`

   Это пользовательская Library, а не `/Library` в корне диска. Если папки ещё нет, создайте недостающие `UXP`, `Plugins`, `External` внутри `~/Library/Application Support/Adobe/`.
4. Скопируйте туда **целиком папку** `com.vsly.footage-sync_0.1.0` из ZIP. Инструкция остаётся вне папки плагина.
5. Проверьте, что manifest находится по пути:

   `~/Library/Application Support/Adobe/UXP/Plugins/External/com.vsly.footage-sync_0.1.0/manifest.json`

   Между `com.vsly.footage-sync_0.1.0` и `manifest.json` не должно быть ещё одной папки `plugin`.
6. Запустите Premiere. Откройте `Window → UXP Plugins → Footage Sync → Footage Sync`.

При обновлении сначала сохраните прежнюю папку Footage Sync за пределами `External`, затем замените только её. Не держите одновременно две копии с ID `com.vsly.footage-sync`, включая CCX/development-копию. Другие плагины и установочные файлы Premiere не изменяйте.

Если панель не появилась, проверьте версию Premiere, точное расположение manifest и перезапустите приложение. Adobe указывает Developer Mode в Premiere Plugins preferences для подключения development-плагинов; ручная External-установка остаётся preview/development способом. Ошибки доступа к media разбирайте после выбора папки через Links; упаковка не отключает macOS privacy/security controls.

## Использование

Откройте сохранённую копию проекта. `Links → + Add link`, выберите папку на этом Mac и проверьте Initial Sync перед подтверждением. Windows-пути вида `D:\Media` автоматически не переводятся в `/Volumes/...`; папку нужно выбрать заново. Настройки и pairs пока сохраняются рядом с `.prproj` в `.footage-sync.json`, поэтому папка проекта должна быть доступна для записи.

В ZIP находится тот же Mac runtime, что и в ранее опубликованном `Footage-Sync-0.1.0-Mac.ccx`: 18 JS/HTML/CSS/manifest files, включая POSIX root-path fix. Установка не требует Node, npm, FFmpeg или запуска helper. Переупаковка fragmented MP4, постоянное Ignore и общий набор предложений настроек Productions пока не реализованы.

Source markers зависят от Premiere `Write clip markers to XMP`: при ON Adobe сохраняет их в media; плагин настройку не меняет. Native Undo на проверенном Windows Premiere 25.6.2 не гарантирует отмену source markers; Mac-поведение неизвестно.

## Evidence и границы проверки

- [Adobe](https://helpx.adobe.com/xd/desktop/troubleshooting/installation-and-updates/issues-installing-xd-plugins.html) документирует пользовательскую папку UXP `Plugins/External` на macOS для XD. Это подтверждает путь общей платформы, а не acceptance нашего Premiere-плагина.
- [Разработчик Songfindr](https://docs.songfindr.com/hc/songfindr/articles/install-plugin-premiere) прямо описывает manual ZIP → эта папка для Premiere 25.6+ на Mac. Это документация другого Premiere-плагина, а не официальная гарантия Adobe для Footage Sync.
- [Adobe Premiere installation docs](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/) описывают CCX/Creative Cloud/UPIA и Developer Mode. Там ручная установка Footage Sync не подтверждена.

Проверены структура ZIP и SHA256 всех 18 payload files; runtime совпадает с Mac CCX. Native Mac loading, permissions, filesystem identity/case/Unicode, import/relink, UI, AUTO/lifecycle и Productions ещё требуют real-host проверки. Пакет публикуется в существующем [v0.1.0 Preview](https://github.com/VslyDream/footage-sync/releases/tag/v0.1.0).
