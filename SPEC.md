# Footage Sync — Product Spec

> Canonical product truth.  
> Этот документ описывает **что строим и как продукт должен вести себя**.  
> Implementation details допускаются только там, где они влияют на продуктовый контракт.

---

## 1. Product goal

Плагин для Adobe Premiere Pro, который связывает папки на диске с bins в проекте `Footage` и убирает ручную рутину:

- следит за linked folders;
- импортирует новые media files;
- сохраняет структуру системных папок в Premiere;
- не создаёт дубликаты;
- отслеживает rename/move и сохраняет existing Project Item через relink/move;
- умеет подготавливать problematic fragmented MP4 перед import.

Основной UX-референс: **Watchtower by Knights of the Editing Table**.

Берём за основу его:
- компактность main panel;
- идею watched/linked folders;
- отдельный экран управления links;
- initial sync/reconciliation approach.

Не копируем функции, которые нам не нужны, включая `SEQ` и `FLT`.

---

## 2. Target environment

[LOCKED]

- Adobe Premiere Pro 25.x, целевая baseline — версия, где нужный UXP API реально доступен; текущая рабочая гипотеза: **25.6+**.
- Primary OS: Windows 11.
- Architecture должна позволять дальнейшее расширение на macOS.
- Новый продукт проектируется вокруг UXP.
- Если конкретная функция упирается в ограничение UXP/Premiere version, это должно быть явно validated, а не assumed.

[LOCKED — user request 2026-10-13] В существующий v0.1.0 release добавляется Mac preview package с прежним baseline Premiere 25.6 и тем же plugin ID/version. [SPIKE] macOS installation, filesystem/permissions, host API и lifecycle acceptance ещё не выполнены; выпуск preview не является подтверждением полноценной macOS compatibility. Windows остаётся primary OS.

[LOCKED — user request 2026-10-13] Для Mac нужен также preview ZIP с готовой папкой плагина для ручного копирования в пользовательский UXP External, как в Windows workflow. Этот путь установки не требует Creative Cloud Desktop. [SPIKE] Native Mac loading/permissions должны быть проверены; runtime, ID/version и функциональные правила не меняются из-за способа установки.

---

## 3. Core model

[LOCKED]

### Disk is the source of truth

Для linked subtree структура на диске определяет ожидаемую структуру внутри Premiere.

Пример:

```text
Premiere:
Footage / 01_VIDEO

↕

Disk:
L:\Timber Truck\02_Assets\01_VIDEO
```

Если на диске:

```text
01_VIDEO/
└─ 2026-07-22-Announce/
   ├─ A001.mp4
   └─ A002.mp4
```

ожидаемая структура в Premiere:

```text
Footage/
└─ 01_VIDEO/
   └─ 2026-07-22-Announce/
      ├─ A001.mp4
      └─ A002.mp4
```

Синхронизация в MVP/основной модели идёт **disk → Premiere**, а не наоборот.

Ручное переименование bin в Premiere не должно автоматически переименовывать системную папку.

---

## 4. Synchronization behavior

[LOCKED]

| Change on disk | Expected behavior in Premiere |
|---|---|
| New file | Import existing media into corresponding bin |
| New folder | Create corresponding bin |
| File rename | Relink existing Project Item instead of creating a duplicate |
| File move | Preserve existing Project Item and move it to corresponding bin; relink if path changed |
| Folder rename | Rename corresponding managed bin |
| Folder move | Move corresponding managed bin |
| File/folder delete | Do **not** delete anything automatically from Premiere |
| Existing imported file is in wrong bin | Move existing Project Item to the bin dictated by disk structure |

Managed subtree should converge to disk structure for additions, renames and moves.

### Premiere-side manual changes

Если пользователь вручную переместил managed Project Item в другой bin, а media path на диске не изменился, следующая sync должна вернуть item в bin, соответствующий дисковой структуре.

### Deletes are non-destructive

Удаления на диске не синхронизируются автоматически в Premiere.

Плагин не должен сам удалять:
- Project Items;
- bins;
- media references,

только потому, что соответствующий source исчез с диска.

---

## 5. Duplicate behavior

[LOCKED]

Плагин не должен создавать второй Project Item для файла, который уже импортирован в проект.

Если media уже существует в Premiere, но:
- находится в другом bin;
- соответствующая папка была переименована;
- media была перемещена на диске,

предпочтение отдаётся reconciliation существующего Project Item, а не повторному import.

Точный internal matching algorithm — implementation detail, пока он надёжен и не меняет observable behavior.

---

## 6. Sync mode

[LOCKED]

Sync mode — **global for the project/plugin context**, а не индивидуальный для каждого link.

Доступны три режима:

### AUTO

Плагин автоматически применяет обнаруженные изменения.

Требование:
- работа не должна создавать заметных lag/stutter в Premiere;
- monitoring должен быть достаточно lightweight для обычного editing workflow.

[SPIKE] Требуется проверить, может ли AUTO надёжно работать, когда plugin panel закрыта/скрыта, пока Premiere открыт.

### ASK

Плагин обнаруживает и накапливает pending changes, но не применяет их автоматически.

Явное нажатие `Sync` является confirmation для batch без blocking items. Такой batch применяется сразу, без дополнительного confirmation dialog.

Если в batch есть хотя бы один blocking item, открывается **один batch Review Changes**. До решения пользователя ни одно изменение из этого batch не применяется.

Blocking items:

- conflicts/errors;
- unavailable source;
- fragmented MP4 в режиме `Ask before fixing`;
- любое другое change, для которого нужен явный выбор пользователя.

Не показывать popup на каждый файл.

Пример:

```text
17 changes detected
+ 14 new files
+ 2 new folders
↪ 1 renamed file

[Later] [Review] [Sync]
```

### MANUAL

Плагин обнаруживает/показывает pending state, но ничего не применяет без ручной команды `Sync`.

### Placement in UI

[LOCKED]

AUTO / ASK / MANUAL **не находятся постоянно на Main Panel**.

Настройка режима находится в Settings view общего Links / Settings window.

Main Panel содержит только `Links`, `Sync` и `Status`. Детали current status находятся в Status window; на Main Panel допустим только compact badge/attention indicator.

---

## 7. Links

Link связывает:

```text
Premiere bin ↔ system folder
```

Например:

```text
Footage / 01_VIDEO
↔
L:\Timber Truck\02_Assets\01_VIDEO
```

[LOCKED] Поддерживаем два entry flows.

### Flow A — link existing Premiere bin

Пользователь:
1. выбирает/указывает существующий bin;
2. выбирает соответствующую system folder;
3. видит Initial Sync;
4. подтверждает link.

UI может использовать `+ Add link`.

### Flow B — create matching bins automatically

UX reference: Watchtower `Select Folders / Standard`.

Пользователь видит filesystem tree и выбирает одну или несколько папок.

Плагин:
1. создаёт matching bins;
2. создаёт links;
3. показывает Initial Sync перед применением.

Оба flows приводят к одной и той же внутренней сущности Link и появляются в общем Links Manager.

---

## 8. Links Manager

[LOCKED direction and controls; exact visual details may be refined]

UX reference: Watchtower `Select Folders / Advanced`.

Нужен отдельный экран/section с таблицей existing links.

Минимальная концепция:

```text
Bin / Premiere path     Settings/flags     Folder path
---------------------------------------------------------------
01_VIDEO                [...]              L:\...\01_VIDEO
02_AUDIO                [...]              L:\...\02_AUDIO
```

Пользователь должен иметь возможность:
- видеть все links;
- менять Premiere bin/path;
- менять system folder path;
- редактировать поддерживаемые flags/options;
- удалить link;
- добавить новый link.

`SEQ` не нужен.  
`FLT` не нужен.

Поддерживаемые per-link flags:

- `Relative path`, default Off;
- `Subfolders`, default On.

`Relative path` хранит system folder path относительно Premiere project file. `Subfolders` включает recursive sync и зеркалирование вложенных folders в bins.

---

## 9. Initial Sync

[LOCKED]

После создания нового link плагин не должен сразу безусловно менять проект.

Он сначала анализирует существующую структуру и показывает reconciliation preview.

Пример:

```text
Link
Footage / 01_VIDEO
↔
L:\...\01_VIDEO

Existing structure detected:

✓ Gameplay   ↔ Gameplay
✓ Announce   ↔ Announce
+ Trailer    → create bin

42 files already imported
7 files will be imported

[Cancel] [Link & Sync]
```

Existing matching bins/items должны переиспользоваться, а не дублироваться.

Initial Sync является общей финальной стадией для обоих flows создания link.

---

## 10. Main Panel

[LOCKED]

Main Panel должна быть предельно компактной, в духе Watchtower.

[LOCKED — FUT-002, user decision 2026-10-06]

Одна dockable Main Panel автоматически переключается между вертикальной колонкой при узкой ширине и горизонтальным рядом при пересечении порога ширины. Иконки, области кнопок и отступы масштабируются по фактическому доступному размеру; при недостатке высоты предпочтительно уменьшать controls и избегать прокрутки. Порог и практические границы размера определяются при реализации/host-проверке с сохранением доступности всех трёх actions.

Около `50 × 250 px` — ориентир компактности, а не жёсткий общий размер или гарантированный minimum Premiere. Основной рабочий вариант — компактно закреплённая вертикальная панель. Постоянных текстовых подписей нет ни в узком, ни в широком виде; названия действий доступны в подсказках.

Собственный header удаляется. Native tab/header Premiere желательно также скрыть, если существует поддерживаемый способ; его сохранение допустимо, если скрытие технически недоступно. Tools integration остаётся исследовательским пожеланием, наличие такого API не установлено.

На Main Panel постоянно находятся только три actions:

- `Links`;
- `Sync`;
- `Status`.

Названия `Links`, `Sync`, `Status` обозначают действия; в Main Panel они представлены иконками без постоянных подписей.

`Sync` применяет batch сразу, без confirmation window, если blocking items отсутствуют. Если есть blocking items, `Sync` открывает Review Changes для всего batch. При unavailable source Sync disabled.

Settings action на Main Panel отсутствует. Переход в Settings доступен из общего header окна Links.

Main Panel не показывает inline status summary, sync history, conflicts, link list, Settings content или Sync mode. Status action показывает числовой badge pending changes; attention различимо дополнительно и не заменяет существующий count. Выполняющийся Sync обозначается анимацией (предпочтительно кружок/spinner); повторная активация disabled. Details открываются только в отдельном Status window.

---

## 11. Review Changes

[LOCKED]

Используется:

- обязательно, если в batch есть blocking items;
- доступно как manual action из Status window;
- может использоваться при Initial Sync.

Если blocking item присутствует, Review показывает весь batch. Safe changes не применяются до тех пор, пока пользователь не подтвердит batch.

Показывает batch changes до применения.

Минимальные категории:
- new files;
- new folders/bins;
- renamed files;
- moved files;
- renamed/moved folders;
- conflicts/errors;
- media requiring fragmented MP4 handling.

Не показывать отдельное confirmation window на каждый файл.

---

## 12. Fragmented MP4

[LOCKED product behavior]

Обработка fragmented MP4 — глобальная setting.

Предусмотреть как минимум:

```text
Fragmented MP4

○ Fix automatically before import
○ Ask before fixing
○ Don't fix
```

Default: `Ask before fixing`.

### Bundled helper

[LOCKED]

Для Premiere 25 допускается bundled native helper, если он полностью скрыт от обычного пользователя.

UX requirement:
- пользователь не запускает helper вручную;
- отдельного tray/background app нет;
- нет необходимости держать `.exe` постоянно запущенной;
- helper стартует автоматически только когда нужен;
- по завершении работы завершается;
- его существование не должно становиться отдельным пользовательским workflow.

Helper может использовать FFmpeg/FFprobe.

[SPIKE] Нужно проверить packaging, process launch permissions, отсутствие console/window и lifecycle на Windows 11 в целевой версии UXP.

В будущем для newer Premiere можно рассмотреть native/hybrid UXP mechanism, если это уменьшает complexity без изменения UX.

---

## 13. Performance requirements

[LOCKED]

AUTO/monitoring не должен заметно мешать editing.

Нельзя считать acceptable реализацию, которая:
- вызывает регулярные UI freezes;
- заметно грузит CPU в idle;
- постоянно перечитывает огромные media files;
- создаёт чрезмерный disk/network I/O;
- делает сетевой Lucid workflow ощутимо медленнее.

Точные thresholds будут определены после prototype/profiling.

Performance strategy — implementation detail.

---

## 14. Non-goals / excluded behavior

На текущем этапе не строим:

- bidirectional disk ↔ Premiere sync;
- automatic delete propagation;
- `SEQ`;
- `FLT`;
- отдельное helper application, которое пользователь должен запускать;
- UX, завязанный на отдельную постоянно работающую программу.

Drag & drop может использоваться только если надёжно поддерживается выбранной UXP/Premiere architecture. Он не является обязательным core flow.

---

## 15. Screen-level UI specification

[LOCKED]

Detailed screen contracts, transitions and the approved main-screen PNG references are maintained in [`docs/UI_SPEC.md`](docs/UI_SPEC.md). Product behavior in this document takes precedence over mock data or stale helper copy visible in screenshots.

Интерфейс англоязычный, compact/dense, в dark-theme стиле Premiere и Adobe Spectrum.

Основная точка входа — адаптивная dockable Main Panel по §10: ориентир узкого вертикального вида около `50 × 250 px`, автоматический переход к горизонтальному при расширении. FUT-002 меняет только Main Panel. Весь содержательный UI, кроме direct action `Sync`, открывается в отдельных windows/modal dialogs, как в UX reference Watchtower:

- Links / Settings management window;
- Status;
- Create Link — existing bin;
- Create matching bins — filesystem tree;
- Initial Sync;
- Review Changes;
- error/conflict details, когда требуется решение пользователя.

Links и Settings — два views одного management window с общим header и navigation tabs. `Links` открывает window на Links view. Прямой entry point в Settings с Main Panel отсутствует.

### 15.1 Main Panel

Показывает только три масштабируемые icon actions без постоянных подписей: `Links`, `Sync`, `Status`. Layout, header и sizing определены в §10 и UI_SPEC UI-01.

- `Links` открывает Links window;
- `Sync` сразу применяет changes без dialog, если blocking items отсутствуют; при blocking items открывает Review Changes;
- `Status` открывает Status window, показывает числовой pending badge и дополнительный attention state.

Links и Status открывают новые окна; Sync является direct action. Ни один screen не подменяет содержимое Main Panel.

### 15.2 Create Link — existing bin

Modal содержит:

- Premiere bin field + `Choose…`;
- system folder field + `Browse…`;
- per-link flags `Relative path` и `Include subfolders`;
- пояснение, что disk является source of truth и matching media переиспользуется;
- `Cancel` / `Analyze link`.

Default flags:

- `Relative path` — Off;
- `Include subfolders` — On.

### 15.3 Create matching bins — filesystem tree

Wide modal содержит searchable filesystem tree с multi-select checkboxes и destination bin в Premiere.

Каждая выбранная top-level folder создаёт отдельный Link. Перед изменением проекта пользователь переходит к Initial Sync.

### 15.4 Links Manager

Links Manager является Links view отдельного wide Links / Settings management window.

Каждый link показывает:

- Premiere bin/path;
- system folder path;
- `Relative path`;
- `Subfolders`;
- status `Active` / `Paused`;
- действия edit, pause/resume и remove.

Semantics:

- `Relative path` хранит system folder path относительно файла Premiere project, чтобы link переносился вместе с project template;
- `Subfolders` включает recursive sync и зеркалирование вложенных folders в bins; Off синхронизирует только файлы непосредственно в linked folder.

`SEQ` и `FLT` отсутствуют.

### 15.5 Initial Sync

Wide modal показывает:

- mapping Premiere bin ↔ system folder;
- какие existing bins/items будут reused;
- какие bins будут созданы;
- already imported / to import / duplicate counts;
- `Cancel` / `Link & Sync`.

### 15.6 Review Changes

Batch review группирует safe changes и blocking items. Если в batch есть blocking item, до user confirmation ничего из batch не применяется. Пользователь выбирает applicable safe changes, решает blocking items и один раз подтверждает batch.

Fragmented MP4 с mode `Ask before fixing` показывает decision внутри Review, а не отдельный popup на каждый файл.

### 15.7 Settings

Settings является Settings view того же wide Links / Settings management window.

Settings доступен только через `Settings` tab в header Links/Settings window; отдельной кнопки Settings на Main Panel нет.

Содержит:

- global Sync mode: AUTO / ASK / MANUAL;
- global Fragmented MP4 behavior;
- global Source clip markers: автопоиск TXT и применение во время Sync, default On;
- notification behavior.

Defaults:

- Sync mode — ASK для prototype/reference state;
- Fragmented MP4 — `Ask before fixing`;
- AUTO не показывает success popups;
- warnings/errors показываются явно.

### 15.8 Status / history / errors

Status открывается в отдельном window и объединяет:

- current sync status;
- manual `Sync now` / `Review changes` actions;
- active links / pending / conflict counters;
- sync history;
- conflicts, warnings и unavailable folders.

Conflicts и offline media попадают в Review/details и не исправляются автоматически без решения пользователя.

Если linked folder unavailable:

- link pauses;
- Project Items/bins не удаляются;
- другие available links могут продолжать sync;
- пользователь может reconnect, choose replacement folder или оставить link paused.

---

## 16. Clip markers from TXT — FUT-001

[LOCKED — user decision, 2026-10-03]

Реализуем FUT-001 из `docs/FUTURE_VISION.md`: добавление и импорт маркеров относятся к конкретному исходному футажу / `ClipProjectItem`, а не к секвенции. Наличие секвенции и размещение клипа на timeline не являются условием импорта маркеров. При подтверждённой невозможности clip markers требуется остановиться и согласовать решение с пользователем; sequence markers не являются fallback.

Первая версия читает UTF-8 TXT: одна строка = `H:MM:SS,colorIndex`, целые секунды от начала исходного видео, индексы 0–7 по Markerbox. BOM, CRLF и пустые строки допускаются. Имена, комментарии, диапазоны, дробные секунды и frame timecode не входят в эту версию.

[LOCKED — user decisions, 2026-10-03]

- Автопоиск включён по умолчанию, настройка global для проекта. TXT должен лежать в той же папке; весь basename TXT (без расширения) должен содержаться в basename MP4 в любом месте. Сравнение без учёта регистра; _repack обрабатывается этим же правилом. Например яблоко.txt → яблоко банан.mp4, яблоко 2.mp4, 2 яблоко.mp4. Это буквальная подстрока, без угадывания склонений. Несколько кандидатов: предупреждение и ручной выбор, без автоматического применения.
- Маркеры применяются вместе с Sync в AUTO / ASK / MANUAL согласно общим правилам. Сначала импорт/reconciliation media, затем маркеры source item. TXT, появившийся позже, также обрабатывается при Sync.
- Ручной TXT имеет приоритет над автопоиском. Выбор доступен в строке media в Initial Sync / Review (кнопка и ПКМ) и в списке уже импортированного media в Status. Main Panel сохраняет Links / Sync / Status.
- Обычный повторный Sync с последним обработанным TXT не создаёт дублей и сохраняет ручные правки/удаления маркеров. Изменённый TXT или повторный ручной выбор требуют Review: Replace markers / Add to existing / Skip TXT. Replace явно удаляет все маркеры только этого source clip, включая ручные; Append их сохраняет. Skip запоминает решение для этой версии TXT.
- Неверные строки, цвета, недоступный TXT, неоднозначный выбор и время вне длительности исходного media: точное предупреждение с именем TXT и номером строки где применимо; весь TXT пропускается до исправления. Импорт самого media может продолжаться. Ошибка TXT не превращается в общий blocking media conflict.
- Незавершённый или отменённый импорт требует Review. Записи об импорте должны согласованно сохраняться/отменяться с project markers. Autosave пользовательского проекта не вводится.

[VALIDATED — local Premiere 25.6.2]

Source marker create/read/color проверены на generated WAV и MP4, все восемь цветов, без секвенции. MP4 с исходным timecode 01:00:00:00 подтвердил относительное начало; AUTO/manual Sync и повтор без дублей проверены в 25.6.2. Private project metadata доступна для хранения состояния без source XMP API. Native Undo не гарантирует rollback source markers; XMP preference управляет возможной записью в media. Эти ограничения не меняют согласованный контракт: release policy остаётся открытой, evidence и acceptance описываются в STATE.md и docs/IMPLEMENTATION_NOTES.md.

## 17. Open product work

[OPEN]

- Финально уточнить granular conflict choices для разных классов rename/move ambiguity.
- Уточнить UX для media, которое остаётся offline после reconnect и не является обычным disk delete.
- Проверить screen prototype в реальном docked UXP panel на target Premiere version и при разных panel widths.

## 18. Shared sync suggestions in Productions

[LOCKED — user direction 2026-10-06]

Сохранённые пары folder ↔ bin должны предлагаться другим участникам Production, но не навязываться: обнаружение чужих настроек само по себе не включает sync и не импортирует media. Требуется возможность принять настройки после review. Стараемся не создавать дополнительные файлы в Production; предпочтительное место общего набора — внутри `.prproj`.

[SPIKE] Private Project Item metadata поддерживается на baseline 25.6 и уже используется для marker receipts. Конкретный root/bin anchor, persistence у другого участника и Production locks требуют отдельной host-проверки. Текущий v0.1 продолжает использовать sidecar; переход и новые UI controls пока не реализованы. Общий profile и локальные принятые настройки/служебное состояние не должны автоматически заменять друг друга.
