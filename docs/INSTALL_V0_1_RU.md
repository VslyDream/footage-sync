# Footage Sync v0.1 — установка

Предварительная сборка для Windows 11 / Adobe Premiere Pro 25.6+. Реальные предыдущие проверки выполнены на 25.6.2; другие версии и macOS не проверены.

## Пакет CCX

Обычный формат UXP — `.ccx`. Откройте `Footage-Sync-0.1.0.ccx` двойным щелчком: установкой управляет Adobe Creative Cloud Desktop, включая предупреждение о стороннем плагине и доступе к файлам. Затем перезапустите Premiere и откройте `Window → UXP Plugins → Footage Sync → Footage Sync`.

В этом релизе проверены состав, manifest и точное совпадение файлов CCX с исходниками. Установка именно этого CCX через Creative Cloud на данной машине **не проверена**. Adobe рекомендует UXP Developer Tool для упаковки и обязательную проверку установки: [упаковка](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/), [установка](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/).

Если уже установлена development-копия с тем же ID, не держите её одновременно с CCX: используйте один способ установки. Сначала сохраните проект и закройте Premiere.

## Готовая папка плагина для Windows

`Footage-Sync-0.1.0-Windows.zip` содержит инструкцию и папку `com.vsly.footage-sync_0.1.0`.

1. Сохраните проекты и полностью закройте Premiere.
2. Распакуйте ZIP в любую временную папку.
3. Откройте в Проводнике `%APPDATA%\Adobe\UXP\Plugins\External` (создайте папку External, если её нет).
4. Скопируйте туда **целиком папку** `com.vsly.footage-sync_0.1.0`. Внутри неё должен лежать `manifest.json`, а не ещё одна папка plugin. При обновлении сделайте резервную копию существующей папки Footage Sync, затем замените только её.
5. Откройте Premiere и панель через `Window → UXP Plugins → Footage Sync → Footage Sync`.

Этот External-способ использовался в предыдущих реальных проверках на данной машине. Он предназначен для development/preview, а не является обещанием Marketplace-установки. Если Premiere не показывает плагин, проверьте версию, вложенность папок и настройку Developer Mode в Premiere Plugins; Adobe указывает её для подключения development-плагинов. Соседние плагины и файлы Premiere не изменяйте. Установка не требует npm, Node, ручного запуска helper или FFmpeg.

## Что работает и что отсутствует

- Links, Initial Sync, Review, ASK / AUTO / MANUAL, импорт и reconciliation без автоматических удалений, source TXT markers.
- Fragmented MP4 распознаётся. `Later` откладывает файл; `Import original` импортирует исходник после явного выбора. Постоянное Ignore и Repackage отсутствуют. `Fix automatically` удерживает такой batch для Review.
- Пары и настройки хранятся рядом с проектом в `<project>.prproj.footage-sync.json`. Предложения настроек другим участникам Production пока не реализованы.
- Для хранения source markers в проекте проверьте Premiere `Preferences → Media → Write clip markers to XMP`: при ON Adobe сохраняет markers в media. Плагин эту настройку не меняет. Native Undo на 25.6.2 не гарантирует отмену source markers.

Подробности: README.md, STATE.md, docs/V0_1_REVIEW.md, docs/PROJECT_SETTINGS_RESEARCH.md в репозитории. Это preview с перечисленными ограничениями.

