# Footage Sync — Development State

> Current development truth, updated 2026-10-13. Product contract remains in SPEC.md; screen contract remains in docs/UI_SPEC.md.

## Current phase

**v0.1 preview release / first working UXP core.**

Сборка `0.1.0` ранее установлена в Premiere Pro 2025 **25.6.2** на Windows, отдельно от Polden OBS Bridge. Подготовлен предварительный релиз v0.1: CCX и готовая Windows-папка в ZIP, инструкция и SHA256. Это не завершённый MVP. Установка именно release CCX через Creative Cloud ещё не проверена; новая identity-aware scanner cache правка в этой сессии не устанавливалась в host. FUT-001 интегрирован; принятые правила находятся в SPEC §16 и UI_SPEC §8. Исходные golden screenshots сохранены.

[VALIDATED — v0.1 audit] 78 tests, 15-module syntax/manifest check; оба архива содержат ровно 18 plugin files, SHA256 совпадает с исходниками. Проверены Review Later/original/deferral, MP4 ASK/AUTO/NONE, запрет несуществующих Ignore/Repackage decisions, whole-batch blocking/repeats и container headers. Исправлен кэш MP4 classification при замене с теми же size/mtime: учитывает reliable identity; без неё classification не кэшируется. Новый native Premiere/remux/двухмашинный Production прогон не выполнен. Матрица: [V0_1_REVIEW.md](docs/V0_1_REVIEW.md).

[VALIDATED / SPIKE — shared settings] Links/settings/checkpoints сейчас в `<project>.prproj.footage-sync.json`; sidecar активируется при открытии проекта и не является optional suggestion. Private clip project metadata подтверждены official API и сохранённым/reopened marker fixture; read-only inspection `.prproj` подтвердил schema и payload. Shared JSON внутри проекта возможен на Project Item, но root/bin anchor, другой editor без schema и locked Production требуют spike. [LOCKED] Запрошены предлагаемые, не навязываемые mapping settings с минимумом файлов в Production (SPEC §18). [OPEN] Proposal: shared profile в metadata, adopted settings/checkpoints в local plugin data, explicit review/adoption; UI/migration не реализованы. [Research](docs/PROJECT_SETTINGS_RESEARCH.md).

Исходники: `plugin/`. Инструкция: [README.md](README.md). API findings и реальные host-проверки: [docs/IMPLEMENTATION_NOTES.md](docs/IMPLEMENTATION_NOTES.md).

Приватный GitHub repository: [VslyDream/footage-sync](https://github.com/VslyDream/footage-sync). [v0.1.0 Preview](https://github.com/VslyDream/footage-sync/releases/tag/v0.1.0) опубликован 2026-10-07; tag указывает на `011086b5b1659418abb04c1108ebb0a75cce25ea`. В тот же release 2026-10-13 добавлены Mac CCX/ZIP, Mac-инструкция и отдельный SHA256SUMS-Mac; исходные четыре assets сохранены. Mac source/packaging commit: `c089661535d733e11af5f654f36848b733ebca8b`. Локальные test projects/media/diagnostics и deployment config прототипа исключены; существующий Git прототипа сохранён.

[VALIDATED — publication] Страница опубликованного release показывает восемь файлов (+ два source archives); все восемь server-side SHA256 сверены с локальными файлами, четыре исходных hash сохранились. Подтверждение: `artifacts/release/github-release-mac.png` (локально, исключено из Git). Install acceptance остаётся отдельным spike.

[VALIDATED — Mac preview packaging] Для того же v0.1.0 подготовлены отдельные `Footage-Sync-0.1.0-Mac.ccx`, Mac ZIP (CCX + инструкция), `INSTALL_MAC_V0_1_RU.md` и `SHA256SUMS-Mac.txt`. `npm run package:mac` не перезаписывает исходные Windows/CCX assets или их checksums. Сверены 18 plugin payloads с source, вложенный CCX и инструкция — с отдельными файлами. Mac runtime включает только portability fix `paths.join` от `/`, предотвращающий ошибочный Windows UNC path. ID/version/baseline остаются прежними; original tag не перемещается. 81 tests и 15-module syntax/manifest check passed; EPERM rename в sandbox TEMP устранён запуском тестов с временными fixtures внутри workspace (изменение runtime/tests policy не потребовалось). [SPIKE] Native Mac installation, APFS/SMB identity/case/Unicode, permissions, import/relink, UI и AUTO/Productions не проверены. Это Mac preview, не validated macOS support.

## Future vision / to-do

[VALIDATED — Mac manual packaging] По запросу подготовлен `Footage-Sync-0.1.0-Mac-Manual.zip`: 18 runtime files в `com.vsly.footage-sync_0.1.0/` и отдельная `INSTALL_MAC_MANUAL_V0_1_RU.md` (19 archive entries). SHA256 всех runtime files совпали с ранее опубликованным Mac CCX; manifest/syntax check passed. `npm run package:mac:manual` не пересобирает старые CCX/ZIP или их checksums. Path `~/Library/Application Support/Adobe/UXP/Plugins/External` documented Adobe для общей UXP-платформы (XD); manual-copy Premiere 25.6+ flow подтверждён документацией разработчика Songfindr. Это внешняя документация, не собственная real-Mac acceptance. [LOCKED] Ручной folder-copy flow без Creative Cloud Desktop запрошен пользователем (SPEC §2). [SPIKE] Native Mac loading/permissions остаются непроверенными. Evidence, установка и диагностика: [manual Mac instruction](docs/INSTALL_MAC_MANUAL_V0_1_RU.md).

Пожелания пользователя ведутся в [docs/FUTURE_VISION.md](docs/FUTURE_VISION.md). **FUT-001** реализован и локально проверен: маркеры на конкретном исходном клипе, без sequence fallback. **FUT-002** реализован и установлен по принятым 2026-10-06 решениям (SPEC §10/§15.1, UI_SPEC UI-01): адаптивная icon-only Main Panel, scaling по фактическим width/height, порог column/row 160 content px, count + отдельный attention и animated Sync. Собственный header удалён, native Premiere tab оставлен согласно fallback. Остальные окна и sync semantics сохраняются. Research: [docs/FUT002_UI_RESEARCH.md](docs/FUT002_UI_RESEARCH.md); результаты и границы acceptance: [artifacts/panel-host-test/ACCEPTANCE.md](artifacts/panel-host-test/ACCEPTANCE.md).

[VALIDATED — FUT-002 local Premiere 25.6.2 / UXP 8.1] ResizeObserver доступен и измеряет root основной панели; dialogs не меняют её layout. Изолированная probe использует те же HTML/CSS/layout/MainPanel, без project API. Измерен floating content 52 × 262 px без overflow; проверены переходы column → row → column, 5-секундный busy spinner и его остановка. В основной сборке панель закреплена узкой колонкой; Links / Settings / Status открываются отдельно, tooltip Links виден, Sync с zero changes завершился. Все 18 установленных файлов совпали с source; проект fixture и 3 Bridge hashes сохранились (`verification.json`). [LIMITATION locally] Host при первом открытии probe выбрал minimum 40 × 48 вместо preferred 50 × 250; кнопки помещаются, но становятся слишком мелкими для удобной работы. Preferred size не гарантирует startup size. [SPIKE] Полная Tab/Enter/Space матрица, nonzero/large-count attention в host, восстановление workspace и переход между мониторами с записанным Windows scale. Захват окна перестал работать с `window crop is outside captured monitor` после повторной попытки восстановления; дальнейшие UI inputs прекращены. [OPEN] Tools registration/native header control не найден в официальных docs/sample; невозможность не доказана. Manifest shortcuts документированно не поддерживаются Premiere.

FUT-001: UTF-8 parser, scanner TXT, discovery/policy service, project-contained import receipts и Source clip markers UI подключены к Sync. Автопоиск ON default, буквальная подстрока basename TXT в basename MP4 в том же каталоге. Ручной выбор приоритетен. Время от начала исходника, цвета 0–7; ошибка/недоступность/неоднозначность/range пропускает весь TXT с предупреждением, не мешая импорту media. Последний обработанный TXT не применяется повторно; изменённый/заново выбранный требует Replace / Append / Skip в Review. Replace удаляет все маркеры только source clip, включая ручные, с явным предупреждением. Sequence/offline targets отклоняются.

[VALIDATED — local Premiere 25.6.2, generated WAV/MP4] Отдельный `artifacts/marker-host-test/ClipMarkers.prproj`, sequences = 0. WAV подтвердил семь времён и все восемь цветов (`spike-result.json`), повтор без дублей и сохранение ручных правок (`import-result.json`). MP4 с timecode 01:00:00:00 / duration 300 s подтвердил относительные времена 53/72/90/112/214/246/267 s: в native Markers panel первый отображается 01:00:53:00 (`video-result.json`, `source-markers.png`). Controller Sync импортировал два MP4, применил семь auto-маркеров к валидному TXT, пропустил ошибочный цвет у другого без блокировки видео; ручной выбор, Append, Skip и Replace проверены (`integration-result.json`). WAV SHA256 сохранился; три MP4 сохранили SHA256 `36EA03D63A3DDCA14D951A58A21A870ADA6F9001A6A886F132E79204AF4AD94A`; adjacent XMP не появился. Другие builds/OS, Productions и network marker workflow не проверены.

[VALIDATED — project state / baseline timing] Receipts хранятся в private project metadata через UXP XMPMeta; sidecar сохраняет observation до первой marker mutation, чтобы отсутствие/отмена project receipt требовали Review вместо автоматических дублей. Пользовательский проект не autosave. Timing получен через raw tick columns MediaStart/MediaDuration; новые Media APIs 26.5 не используются. `getOutPoint(AUDIO)` с отрицательным sentinel не считается duration. Pending intent проверяется отдельной metadata transaction перед staging; итог проверяется с новой collection после finalization (старые Marker wrappers могут стать stale).

[LIMITATION — real native Undo, 25.6.2] Edit → Undo после Replace восстановил pending receipt, но оставил окончательные source markers; старые markers также не восстановились (`undo-result.json`). Нельзя обещать native rollback маркеров. Повтор переводится в Review. Skip снимает pending state, сохраняя edited/finalized/ambiguous markers; только полностью неизменённые staged markers можно убрать. После сохранения, перезапуска Premiere и reopen Controller запросил Review; Skip сохранил оба finalized marker, убрал pending и следующий scan дал zero changes (`recovery-result.json`).

[LIMITATION — documented preference / locally OFF] Adobe `Preferences → Media → Write clip markers to XMP` при ON сохраняет markers в media, при OFF — в проект. На этой машине OFF (проверено native UI), настройка не изменялась. Документированный AppPreference API 25.6 не предоставляет XMP key; private project receipts не означают, что source markers обходят эту настройку. Не гарантировать неизменность исходников при ON. Release guard/предупреждение или поддержка иной политики требуют решения, если эта конфигурация войдёт в scope.

[VALIDATED — final local acceptance] Native Status picker/ПКМ, Review Append и Settings checkbox проверены; дополнительно unit tests покрывают picker Cancel и перекрывающийся переход Status → Review. Metadata readback после transaction может задерживаться: bounded read verification (до 1 s, без повторных writes) проверена реальным Append и repeat zero (`visibility-result.json`, `ui-manual-result.json`). AUTO после cold restart с закрытой основной панелью импортировал два новых MP4: валидный TXT дал 7 markers, ошибочный цвет дал line-1 warning / 0 markers без блокировки media. После исправления TXT AUTO дал 1 marker, warnings и pending исчезли (`auto-invalid-result.json`, `auto-invalid-markers.json`, `auto-corrected-result.json`, `auto-corrected-markers.json`). Все 5 MP4 и 2 WAV сохранили SHA256, adjacent XMP нет (`source-hashes-after.json`). Все 16 установленных файлов основной сборки совпали с исходниками (`installed-source-verification.json` в той же fixture folder); Bridge hashes совпали. Native Undo/XMP policy остаются release gaps, полноценная Initial Sync marker picker/keyboard матрица ещё не пройдена.

Отдельные development-панели `com.vsly.footage-sync.marker-spike_0.1.0` и `com.vsly.footage-sync.panel-spike_0.1.0` установлены для изолированных проверок. Основной Footage Sync обновлён; Polden OBS Bridge не является целью installers. Scripts: `install-marker-spike.ps1`, `build-panel-spike.js`, `install-panel-spike.ps1`. Panel probe доступна как Footage Sync UI Probe; она только симулирует UI состояния.

## Working and verified

[VALIDATED — local Premiere 25.6.2, small NTFS fixtures]

- Реальная адаптивная Main Panel: Links, Sync, Status без подписей и собственного header. Column/row автоматически меняются по width; размеры кнопок/иконок/отступов учитывают height. Links / Settings открываются в общем management dialog; Main Panel не заменяется. Узкое docking и широкая row проверены локально; runtime references в docs/ui.
- Matching-folder selection и Initial Sync: preview выполняется до изменения проекта. Созданы matching bins и импортированы тестовые WAV в выбранные bins.
- Links / settings / identity mappings / history сохраняются рядом с `.prproj` в `.footage-sync.json`; восстановление после полного перезапуска проверено.
- Recursive filesystem scan раз в 5 секунд. Subfolders Off и relative paths покрыты автоматическими проверками.
- Project-wide media-path reconciliation: повторный Sync переиспользует items, не импортирует повторно.
- Core reconciliation acceptance: Status `Up to date`, 5 clips / 3 bins, 0 pending, error null (`artifacts/final-restored-state.json`). Текущая marker acceptance использует отдельный ClipMarkers project; installed verification описана выше.
- Rename папки сохраняет ID managed bin; клип relinked к новому пути. Перенос WAV между subfolders сохраняет ID клипа и перемещает его между bins.
- Filename rename при закрытом Premiere после загрузки проекта сохранил ID и обновил имя/media path existing clip.
- AUTO работает после закрытия панели. В этой External-установке также проверен cold start с ранее закрытой панелью: после открытия проекта новый WAV импортирован без открытия панели и без success popup.
- Fragmented MP4 detection на реальном `frag_keyframe` fixture: MP4 и безопасный WAV остановлены как один batch. Main Sync открыл единый Review; Later не изменил проект. После `Sync selected` импортирован только выбранный WAV, MP4 остался pending.
- Unavailable source показан в Initial Sync / Review / Status. Main Sync и Status Sync disabled; пять клипов и три bins сохранены. Рабочий path после теста восстановлен.
- Active project и свежий plan проверяются перед mutation; смена проекта/изменение размера, timestamp или identity после Review отменяет confirmation. Source повторно stat-checked перед каждой операцией. Verified mappings checkpointed после операций.
- Delete propagation отсутствует: planner не создаёт delete actions и сохраняет tombstones. Это проверено tests; реальный disk-delete сценарий ещё не проведён.

[VALIDATED — automated checks]

**81 tests passed**, syntax check 15 JS modules и manifest passed. Покрыты reconciliation/identity/batch/races; TXT validation/discovery/settling/retry, ручной приоритет/auto OFF, range с номером строки, latest receipt repeats, Undo/missing-receipt Review, source-only target/colors, failed metadata/Replace и pending recovery. Panel tests проверяют fit при width/height, точный count 12345 + attention/disabled, анимацию и очистку timers на idle/error/zero size/destroy, root-scoped observer и fallback. File-decision/container tests описаны выше; новые POSIX tests проверяют root join, native/relative paths и reuse/rename identity. Fake-host Undo не доказывает native rollback; geometry/POSIX tests не заменяют реальную Mac/DPI/keyboard acceptance.

[VALIDATED — installation isolation]

`scripts/install-dev.ps1` пишет только собственную папку `com.vsly.footage-sync_0.1.0` и требует закрытого Premiere. SHA256 трёх существовавших файлов Polden OBS Bridge совпали после тестов: `artifacts/existing-plugins-after.json`. Adobe binaries и другие plugin sources не изменены.

Тестовый Production: `D:\3_Proga\Polden-OBS\build_polden_next\test-sandbox\PoldenBridgeTest\01_PoldenBridgeTest_Production`, project `00_Footage/01_PoldenBridgeTest_Footage.prproj`. Исходные `.prproj` до тестов сохранены в `artifacts/original-projects/`. Для rename/move/import использованы только созданные fixtures из `artifacts/test-media/`; existing `02_Assets/01_VIDEO` не изменялся.

## Implemented, but not fully accepted

- Existing-bin linking/editing: editor, analysis, unavailable mapping и restoration проверены; новый healthy link этого flow и все picker/keyboard paths ещё не прошли полную acceptance-проверку.
- Link search, flags, pause/resume/remove доступны; полная host-матрица UI controls ещё не завершена.
- Wrong-bin reconciliation реализован; file move проверен в host, ручное перемещение пользователем в unrelated bin пока покрыто planner tests.
- Cross-link file move покрыт tests, не real Premiere. Cross-link folder move ещё не доведён.
- Relink — non-undoable вызов. Partial failure оставляет выполненные project actions; crash/failure-injection проверка checkpoint recovery нужна до рабочих материалов.

## Not implemented / known gaps

- Bundled helper, FFmpeg preparation, hidden process launch, update и cleanup. Release archives реализованы. `Fix automatically` пока удерживает fragmented media для Review; там явно указана недоступность automatic repair. Постоянного Ignore нет; Later — deferral. Автоматическая подготовка не подменяется импортом оригинала.
- Folder Unavailable recovery dialog (UI-09), last-available metadata, detailed reconnect/conflict choices. Источник можно восстановить через Edit link; offline media при unchanged path ещё не восстанавливается отдельно.
- Explicit AUTO warning/error notification при скрытой панели: сейчас issue виден через badge/Status; notification settings сохранены, policy подключена не полностью. Links unavailable source пока показывает Active вместо автоматически paused presentation; active-link counter требует derived state.
- Monitoring Footage project, когда активен другой проект Production, и read-only/locked project handling. Controller пока работает только с active saved project.
- Performance profiling на больших деревьях и сетевом/Lucid storage, memory/cache bounds и длительная idle stability.
- Stable identity на network/macOS volumes. При ненадёжной identity новый неоднозначный файл блокируется, а не угадывается по имени/размеру.
- CCX release installation, permission UX acceptance и macOS real-host support acceptance. Mac preview packaging реализован; native Mac тестов нет.
- Visual acceptance: FUT-002 реализован, narrow floating/docked и row проверены; новые runtime references предоставлены, старый Main Panel PNG сохранён как previous design. Новые снимки не являются отдельным пользовательским visual approval. Keyboard/nonzero-count host matrix, workspace restoration и recorded Windows DPI ещё требуют проверки. Плотность таблиц остальных окон вне FUT-002; table headers местами сжаты, Notifications Settings доступна через scroll.
- History теперь различает zero-action deferred batch (`No changes applied`) и up-to-date. Предыдущая тестовая запись может оставаться в истории sidecar.

## Technical spikes

| ID | Current result / remaining work |
|---|---|
| PREM-001 | [VALIDATED locally] Core traversal/import/bin rename/item move/relink на 25.6.2. Manifest baseline 25.6 соответствует official docs. Другие builds/OS не проверены. |
| AUTO-001 | [VALIDATED locally] Polling/auto-import с закрытой панелью и после cold start в этой development-installation. [SPIKE] CCX/workspaces, Production, длительная стабильность. `hide()` hook documented unreliable; diagnostic visible не доказывает UI visibility. |
| RENAME-001 | [VALIDATED locally] NTFS folder rename, filename rename и file move сохраняют IDs. [SPIKE] Network identity, cross-link directories, rapid moves, partial-error recovery. |
| HELPER-001 | [LIMITATION — official shell recipe] shell.openPath требует consent, не принимает CLI args и не возвращает output. [SPIKE] Job-file/IPC и hidden launch на 25.6.2 не проверены. [VALIDATED — docs] Hybrid требует 26.2+/manifest 6; baseline нельзя повысить без решения. Options: docs/V0_1_REVIEW.md. |
| STORE-002 | [VALIDATED] Sidecar implementation и persisted clip project metadata. [SPIKE] Root/bin shared-profile anchor, second-editor schema/Save/reopen/Undo и Production locks. Optional adoption/local migration proposal ещё не утверждён/не реализован. |
| MAC-001 | [VALIDATED — packaging + automated checks] Mac CCX/ZIP и manual folder ZIP с POSIX root path fix, 81 tests ранее, exact payload/archive hashes, manual runtime = Mac CCX. [SPIKE] Реальная установка/host/permissions/FS/lifecycle на Mac; архитектура JS-only и внешняя manual-install документация не доказывают acceptance Footage Sync. |
| PERF-001 | [SPIKE] Small-tree scan работает; MP4 payload не перечитывается. Large/network load ещё не measured. |
| FUT-001 | [LOCKED] First-version rules. [VALIDATED locally] Source-only MP4 timing/colors, full Controller Sync, auto discovery, manual Append/Skip/Replace/repeat, media import despite TXT errors. [LIMITATION] Native Undo does not reliably undo source markers; XMP preference controls media writes. [VALIDATED locally] UI choices/picker, AUTO with closed panel after restart, recovery/reopen. [SPIKE] Crash/Productions/network/release guard. |
| FUT-002 | [VALIDATED locally] Реализован, установлен, 52 × 262 floating content без overflow, compact docked и оба layout, busy animation, dialogs и zero-change Sync проверены. [SPIKE] DPI/workspace/keyboard/nonzero-count host matrix. [OPEN] Tools/native header API; native header fallback использован. |

Official evidence и local findings разделены в IMPLEMENTATION_NOTES. Locked product contract не менялся ради технических ограничений.

## Next

Приоритет v0.1: выполнить установку release CCX/ZIP в host; проверить новую scanner правку и permissions. Затем проверить shared-profile root/bin anchor и read-only Production, согласовать adoption/migration и permanent Ignore/helper policy по research docs. До этого релиз остаётся preview.

Mac: проверить в первую очередь ручное копирование Mac-Manual folder в user External без Creative Cloud Desktop на копии проекта, затем folder picker/Initial Sync/import/repeat/rename/relink и closed-panel AUTO. CCX installation acceptance остаётся отдельным spike. Переупаковка и production locks остаются прежними gaps; публикация Mac preview их не закрывает.

1. FUT-001 перед release: закрыть crash/partial-failure acceptance и product decision для native Undo и XMP preference ON без молчаливого изменения настроек Premiere.
2. Validate HELPER-001 через minimal hidden bundled job до automatic MP4 preparation. При подтверждённом конфликте с UX записать evidence/options и получить product decision до изменения SPEC.
3. Finish AUTO warnings, offline recovery/paused presentation и Production monitoring; проверить locks и partial failures.
4. Расширить real-host tests: existing-bin initial reconciliation, wrong-bin reuse, cross-link folders, deletes и network storage; затем profile large trees и docked/keyboard/visual acceptance.
5. FUT-002: после восстановления захвата окна закончить keyboard/nonzero-count/attention host matrix и workspace/DPI проверки. Использовать отдельную UI Probe, не менять sync semantics. Реализация и installed source verification завершены.

Browser prototype остаётся в `prototype/` как secondary UI reference; runtime logic находится в UXP implementation.


