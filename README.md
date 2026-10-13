# Footage Sync

Предварительный релиз `0.1.0` для Windows 11 / Premiere Pro `25.6+`. [Скачать v0.1](https://github.com/VslyDream/footage-sync/releases/tag/v0.1.0): CCX, готовая Windows-папка в ZIP, инструкция и SHA256. Проверенные возможности и незавершённая работа описаны в [STATE.md](STATE.md). Продуктовый контракт: [SPEC.md](SPEC.md), экранный контракт: [docs/UI_SPEC.md](docs/UI_SPEC.md).

Стандартный UXP-пакет — `.ccx`, который открывается через Adobe Creative Cloud Desktop. Установка этого CCX ещё не проверена в реальном host; для preview приложен ZIP с готовой папкой для `%APPDATA%\Adobe\UXP\Plugins\External`. Полные шаги и границы проверки: [инструкция v0.1](docs/INSTALL_V0_1_RU.md). Не держать External и CCX копии с одним ID одновременно.

В том же релизе добавлен Mac preview: `Footage-Sync-0.1.0-Mac.zip` содержит Mac CCX и [инструкцию для macOS](docs/INSTALL_MAC_V0_1_RU.md). После распаковки открыть вложенный CCX через Creative Cloud Desktop. Mac-вариант включает исправление POSIX root paths; оригинальные Windows assets и tag сохраняются. На настоящем Mac эта сборка ещё не проверена.

Для Mac без Creative Cloud Desktop: [Mac-Manual ZIP](https://github.com/VslyDream/footage-sync/releases/download/v0.1.0/Footage-Sync-0.1.0-Mac-Manual.zip). Распаковать и скопировать `com.vsly.footage-sync_0.1.0` в `~/Library/Application Support/Adobe/UXP/Plugins/External`, затем перезапустить Premiere. [Пошаговая инструкция](docs/INSTALL_MAC_MANUAL_V0_1_RU.md). Runtime тот же, что в Mac CCX; native Mac acceptance ещё не выполнена.

## Установленная сборка

На этой машине плагин установлен отдельно от Polden OBS Bridge:

`%APPDATA%\Adobe\UXP\Plugins\External\com.vsly.footage-sync_0.1.0`

Панель открывается через `Window → UXP Plugins → Footage Sync → Footage Sync` в Premiere Pro 2025 (`25.6.2`). Это локальная development-установка предыдущей host-проверки. Пакеты релиза подготовлены отдельно; изменения scanner из аудита v0.1 ещё не устанавливались в Premiere в этой сессии.

Обновление после закрытия Premiere:

```powershell
./scripts/install-dev.ps1
```

Скрипт проверяет версию Premiere, ID и расположение собственной папки. Он копирует только файлы Footage Sync; соседние плагины и установочные файлы Premiere не изменяет.

## Использование

1. Открыть сохранённый проект Footage.
2. `Links → + Add link`: связать существующий bin либо выбрать папки для создания matching bins.
3. Посмотреть Initial Sync и подтвердить `Link & Sync`.
4. `Sync` применяет безопасный batch сразу. Если нужен выбор, открывается общий Review; `Later` оставляет изменения ожидающими, `Sync selected` применяет выбранные изменения.
5. `Links → Settings`: режим ASK / AUTO / MANUAL и fragmented MP4 setting. `Status` показывает реальные pending changes, проблемы и историю.

Основная панель содержит три иконки: Links, Sync, Status; названия доступны при наведении. При уменьшении ширины она автоматически становится колонкой, при расширении — строкой. Размеры иконок, кнопок и отступов подстраиваются под свободное место. Панель можно закрепить узкой колонкой; шапка Premiere сохраняется. Status показывает число ожидающих изменений и отдельный знак внимания; во время Sync появляется анимация и повторный запуск отключён. Остальные окна открываются отдельно.

Настройки, links и идентификаторы управляемых items сохраняются рядом с проектом: `<project>.prproj.footage-sync.json`. Не переносить этот файл отдельно от проекта без проверки relative paths. Изменения проекта сохраняются обычной командой Premiere `Save`.

Private Project Item metadata позволяют хранить данные внутри `.prproj` и уже используются для marker receipts. Root/bin anchor для mapping settings и работа у другого монтажёра в Production пока требуют spike. Предложенный сценарий с явным принятием и локальными настройками описан в [исследовании хранения](docs/PROJECT_SETTINGS_RESEARCH.md); в v0.1 он ещё не реализован.

### Маркеры исходных клипов

Автопоиск TXT включён в `Links → Settings → Source clip markers` по умолчанию. TXT лежит рядом с MP4; полное имя TXT без расширения входит в имя MP4 без учёта регистра: `яблоко.txt` подходит для `яблоко банан.mp4` и `2 яблоко.mp4`. Маркеры добавляются на исходный клип после импорта во время Sync. Время отсчитывается от начала исходного видео, независимо от его timecode и секвенции.

Формат строки: `0:00:53,1` (целые секунды, цвет 0–7 по Markerbox). Ошибка строки или время вне длительности пропускает весь TXT с предупреждением; само видео импортируется. Ручной `Choose TXT…` доступен в Initial Sync, Review и Status; в строке также работает ПКМ. Ручной выбор имеет приоритет над автопоиском.

Обычный повтор Sync не создаёт маркеры повторно. Изменённый TXT или повторный ручной выбор открывает Review: `Replace markers` удаляет все маркеры только этого исходного клипа, включая ручные; `Add to existing` добавляет новые; `Skip TXT` сохраняет текущие. При незавершённом/отменённом импорте Review позволяет продолжить либо пропустить TXT. Если Premiere уже оставил окончательные маркеры после Undo, выбирайте Skip для сохранения текущих маркеров; затем при необходимости выберите TXT снова. Плагин не сохраняет проект автоматически.

В Premiere 25.6.2 Undo не гарантирует отмену source markers: проверено, что отменяется служебная запись, а маркеры остаются. Защита переводит такой повтор в Review. Для хранения маркеров только в проекте выключите Premiere `Preferences → Media → Write clip markers to XMP`: согласно Adobe, включённая настройка записывает маркеры в media. На этой машине она выключена; плагин её не меняет. Подробнее и границы проверок — в STATE.md.

Плагин не удаляет исходники, Project Items или bins. Fragmented MP4 detection работает, но автоматическая подготовка через bundled helper ещё не реализована: такие файлы удерживаются для Review; импорт оригинала требует отдельного выбора. `Later` откладывает файл до следующего Sync, постоянного Ignore нет. Матрица решений и ограничения helper: [аудит v0.1](docs/V0_1_REVIEW.md).

## Разработка и проверки

Runtime не требует npm-зависимостей. Исходники находятся в `plugin/`; pure planner отделён от Premiere/UXP adapters. Сканирование выполняется раз в 5 секунд, чтение MP4 ограничено заголовками контейнера.

Для development checks нужен Node 24+, для сборки архивов — PowerShell 7.

```text
npm test
npm run check
npm run package
npm run package:mac
npm run package:mac:manual
```

Тесты проверяют reconciliation, identity matching, отсутствие duplicate/delete actions, блокировку batch и отмену устаревшего решения после изменения проекта/источника. Реальные host-проверки описаны в [docs/IMPLEMENTATION_NOTES.md](docs/IMPLEMENTATION_NOTES.md); снимки собственного runtime-state сохранены в `artifacts/`.

Тестовый Production пользователя использован в предыдущих host-проверках с собственными WAV/MP4 fixtures из `artifacts/test-media/`. Исходные проекты до тестов сохранены в `artifacts/original-projects/`. `artifacts/`, пользовательские проекты/media, diagnostics, зависимости и собранные пакеты исключены из Git. Пакеты публикуются как release assets.
