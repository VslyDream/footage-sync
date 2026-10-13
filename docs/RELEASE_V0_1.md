# Footage Sync v0.1.0 — Preview

Первая предварительная Windows-сборка UXP-плагина для синхронизации папок с bins Adobe Premiere Pro 25.6+ (предыдущие реальные проверки: 25.6.2).

## Скачать и установить

- `Footage-Sync-0.1.0-Windows.zip` — готовая папка `com.vsly.footage-sync_0.1.0` и русская инструкция. После закрытия Premiere скопировать папку в `%APPDATA%\Adobe\UXP\Plugins\External`.
- `Footage-Sync-0.1.0.ccx` — пакет для Creative Cloud Desktop. Структура и содержимое проверены; установка этого CCX через Creative Cloud пока не прошла real-host acceptance. Для локального preview есть ZIP-вариант выше.
- `SHA256SUMS.txt` — контрольные суммы пакетов.

Панель: `Window → UXP Plugins → Footage Sync → Footage Sync`. Подробная инструкция приложена отдельно как `INSTALL_V0_1_RU.md` и находится внутри Windows ZIP. Не устанавливайте External-копию и CCX с одним ID одновременно.

## Возможности

Связи folder ↔ bin, Initial Sync preview, единый Review, режимы ASK/AUTO/MANUAL, reuse импортированных items, отслеживание rename/move по надёжной identity, relative paths/subfolders, TXT markers на исходных клипах и адаптивная компактная панель. Автоматического удаления исходников/items/bins нет.

Исправлен кэш MP4 detection: замена файла с теми же размером и датой больше не сохраняет классификацию прежнего файла. Без надёжной identity классификация перечитывается.

## Проверки

78 автоматических тестов, syntax/manifest check и проверка обоих архивов на точное совпадение с исходниками. Для v0.1 добавлены проверки Review decisions, повторов, блокировки всего batch, container headers и замены MP4. Предыдущие real-host проверки описаны в STATE.md; новый native Premiere прогон этой упаковки не выполнен.

## Ограничения preview

- Переупаковки и bundled helper пока нет. `Fix automatically` оставляет fragmented MP4 blocking; `Later` откладывает до следующего Sync; `Import original` требует явного выбора. Постоянное Ignore отсутствует.
- Links/settings пока сохраняются в соседнем `<project>.prproj.footage-sync.json`. Встраивание общего набора предложений в проект исследовано, но adoption/migration и Production locks не реализованы.
- Native Undo не гарантирует отмену source markers в 25.6.2. Premiere `Write clip markers to XMP` при ON может записывать markers в media; плагин настройку не меняет.
- Cross-project Production monitoring, network/Lucid performance, некоторые recovery/UI сценарии, macOS и другие Premiere builds ещё требуют acceptance.

Исходники и текущие результаты: README.md, STATE.md, docs/V0_1_REVIEW.md и docs/PROJECT_SETTINGS_RESEARCH.md. Тестовые проекты, media и локальные diagnostics не входят в релиз.

## Mac preview — добавление 2026-10-13

- `Footage-Sync-0.1.0-Mac.zip` — CCX и русская Mac-инструкция. Распаковать ZIP, открыть вложенный CCX двойным щелчком через Adobe Creative Cloud Desktop.
- `Footage-Sync-0.1.0-Mac.ccx` — отдельный Mac-пакет для установки без внешнего ZIP.
- `INSTALL_MAC_V0_1_RU.md` и `SHA256SUMS-Mac.txt` — инструкция и контрольные суммы новых файлов.

Mac-пакет — JavaScript UXP с ID/version `com.vsly.footage-sync` / `0.1.0`, baseline Premiere 25.6+. Нативных библиотек и helper нет. Добавлено исправление соединения путей от POSIX root `/`; 81 автоматический тест и syntax/manifest checks прошли. Содержимое CCX (18 plugin files) и внешнего ZIP проверено по SHA256.

**Установка и работа на настоящем Mac пока не проверены.** Mac filesystem identity, privacy/permissions, APFS/SMB case/Unicode spelling, import/relink, UI и AUTO/lifecycle требуют real-host acceptance. Windows disk paths автоматически не переводятся в `/Volumes/...`; папку на Mac нужно выбрать заново в Links.

Исходные Windows/CCX assets и тег `v0.1.0` сохраняются. Mac runtime отличается поправкой POSIX root paths; его source/packaging commit находится в main и указан ниже на GitHub release page.
