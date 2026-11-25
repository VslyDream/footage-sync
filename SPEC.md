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

Не копируем per-link controls `SEQ` и `FLT`. [LOCKED — user decision 2026-10-27] Выбор общей Footage sequence и автоматическое добавление нового видео описаны в §19.

---

## 2. Target environment

[LOCKED]

- Adobe Premiere Pro 25.x, целевая baseline — версия, где нужный UXP API реально доступен; текущая рабочая гипотеза: **25.6+**.
- Primary OS: Windows 11.
- Architecture должна позволять дальнейшее расширение на macOS.
- Новый продукт проектируется вокруг UXP.
- Если конкретная функция упирается в ограничение UXP/Premiere version, это должно быть явно validated, а не assumed.

[LOCKED — user request 2026-10-13] В существующий v0.1.0 release добавляется Mac preview package с прежним baseline Premiere 25.6 и тем же plugin ID/version. [SPIKE] macOS installation, filesystem/permissions, host API и lifecycle acceptance ещё не выполнены; выпуск preview не является подтверждением полноценной macOS compatibility. Windows остаётся primary OS.

[LOCKED — user decision 2026-11-25] Все изменения после v0.1 preview выпускаются отдельным релизом **0.2.0** с тем же plugin ID и baseline Premiere 25.6. Mac-пакеты собираются из тех же исходников и остаются непроверенными в host.

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

[LOCKED — user decision 2026-11-06, UI redesign] Доступны два режима. Прежние ASK и MANUAL вели себя одинаково (различался только текст Settings) и объединены в `When I press Sync`. Сохранённое значение MANUAL читается как ASK.

### When I press Sync (default, internal ASK)

Плагин обнаруживает и накапливает pending changes, но не применяет их автоматически. Ожидающее видно в badge Main Panel и во вкладке Changes.

Явное нажатие `Sync` является confirmation для batch без items, требующих решения. Такой batch применяется сразу, без дополнительного окна.

Если в batch есть хотя бы один item, требующий решения, `Sync` открывает окно Footage Sync на вкладке **Changes** со всем batch (§11). До `Apply` ни одно изменение из этого batch не применяется.

Items, требующие решения (blocking; во вкладке Changes — блок `Needs you`):

- conflicts/errors, которые пользователь должен разрешить или игнорировать;
- недоступная цель импорта (§19);
- fragmented MP4 в режиме `Ask in Review`;
- изменённый или повторно назначенный marker TXT (§16);
- interrupted/undone sequence append (§19);
- любое другое change, для которого нужен явный выбор пользователя.

Недоступная linked folder — состояние связи, а не строка `Needs you`: она показывается в строке статуса Changes и в Links (§8, §15.8).

Не показывать popup на каждый файл.

### Automatically (internal AUTO)

Плагин автоматически применяет обнаруженные изменения.

Требование:
- работа не должна создавать заметных lag/stutter в Premiere;
- monitoring должен быть достаточно lightweight для обычного editing workflow.

[LOCKED — user decision 2026-11-06] Batch с хотя бы одним item, требующим решения, не применяется автоматически целиком, включая его safe-часть. Он ждёт во вкладке Changes; Main Panel показывает attention (§10). Применение — через `Apply` после решений, по общим правилам §11.

[SPIKE] Требуется проверить, может ли AUTO надёжно работать, когда plugin panel закрыта/скрыта, пока Premiere открыт.

### Placement in UI

[LOCKED]

Режим **не находится на Main Panel**.

[LOCKED — user decision 2026-11-06] Настройка режима находится во вкладке Settings окна Footage Sync (§15).

Main Panel содержит только `Links`, `Sync` и `Status`. Детали ожидающего и текущего процесса — во вкладке Changes; на Main Panel допустим только compact badge/attention indicator (§10).

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

[LOCKED — user decision 2026-11-06, supersedes separate Flow A / Flow B dialogs] Link создаётся одним диалогом `Add link` (`+ Add link` во вкладке Links):

1. **Folder on disk** — путь + `Browse…`; под полем краткая сводка выбранной папки (подпапки, число media).
2. **Where in Premiere** — один из двух вариантов:
   - `Into an existing bin [bin ▾]` — содержимое папки попадает в выбранный существующий bin (прежний Flow A);
   - `Into a new bin “<folder name>”, inside [bin ▾]` — создаётся bin с именем папки внутри выбранного родителя (прежний Flow B для одной папки).

   Под каждым вариантом показано, куда лягут файлы (пример пути вида `Footage/Video/2026-11-03/CamA/…`), и, где применимо, сколько matching bins уже существует.
3. **Options** — `Include subfolders` (default On), `Path relative to the project` (default Off, для project templates).

`Preview link` открывает превью новой связи (§9). До подтверждения превью проект не меняется.

[LOCKED — user request 2026-11-06] Выбор bin — раскрывающееся дерево, а не плоский список: сначала видны только верхние bins (например, Footage, Graphics, Sequences); стрелка раскрывает bin, имя выбирает его, вложенность любой глубины. Открывается с раскрытым путём до текущего выбора. `Project root` — первый пункт; отдельной опции root нет. [LOCKED — user request 2026-10-15, сохраняется] При root-link media из корня system folder попадают в корень проекта, а подпапки — в соответствующие bins при включённом Subfolders.

Мультивыбор нескольких папок с созданием нескольких links за один раз убран: несколько links добавляются по одному. Оба варианта приводят к одной внутренней сущности Link и появляются в общем списке Links.

---

## 8. Links Manager

[LOCKED direction and controls; exact visual details may be refined]

UX reference: Watchtower `Select Folders / Advanced`.

[LOCKED — user decision 2026-11-06] Links — вкладка окна Footage Sync (§15) с таблицей existing links.

Пользователь должен иметь возможность:
- видеть все links и их состояние;
- менять Premiere bin/path и system folder path (`Edit link…`);
- редактировать поддерживаемые flags/options (`Edit link…`; в таблице флаги показаны метками, а не живыми галочками);
- исключать подпапки link (`Exclude subfolders…`);
- ставить link на паузу и возобновлять;
- удалить link (`Remove link…` с подтверждением);
- добавить новый link (§7).

Row actions собраны в меню ⋯ строки: `Edit link…`, `Exclude subfolders…`, `Pause` / `Resume`, `Remove link…`. Состояния строки: `Active` (с числом pending или `up to date`), `Paused` (+ `Resume`), `Unavailable` (+ `Reconnect…`). Изменения во вкладке сохраняются сразу.

Над таблицей — тихая строка цели импорта (§19) с `Change…`, поиск, кнопка ⋯ со списком `Ignored files and folders (N)…` (§11) и `+ Add link`. Отдельной вкладки или кнопки Ignore в Settings нет.

### Exclude subfolders

[LOCKED — user request 2026-11-06] Сценарий: синхронизировать большую папку, исключив тяжёлые нерелевантные подпапки (прокси, рендеры).

`Exclude subfolders…` открывает дерево папок этого link: галочка = синхронизировать; для каждой папки видны число media и объём; есть фильтр. Footer показывает итог (`N folders excluded · files · size not synced`), `Cancel` / `Save`. Снятая папка сохраняется как persistent ignore rule `Folder and subfolders` (§11) и действует до явного возврата галочки или Restore. Уже существующие в Premiere items/bins не меняются. Строка link в таблице показывает метку `N folders excluded`.

[SPIKE] Подсчёт числа media и объёма выполняется только при открытии окна и не должен заметно нагружать диск/сеть (§13), особенно на сетевых томах; при долгом подсчёте дерево доступно до появления чисел.

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

Initial Sync является общей финальной стадией создания link.

[LOCKED — user decision 2026-11-06] Initial Sync — это тот же экран Changes (§11) в режиме новой связи, в отдельном окне `New link`: те же блоки `Needs you` и `Ready to apply`, те же правила решений, счёта и игнора. Отличия режима:

- заголовок `NEW LINK · PREVIEW`, mapping `bin ↔ folder` и сводка reuse (например, `82 files already in the project are reused, nothing is duplicated`);
- [LOCKED — issues #3, #4] В `Ready to apply` группировка по умолчанию — раскрывающееся дерево дисковых папок. Ветви с изменениями видны сразу. Стрелка показывает или скрывает непосредственное содержимое папки, сохраняя выбор во вложенных строках. У папок остаются сводки, relink, метка `new bin` и предупреждения TXT. Подробности о переиспользованных материалах доступны отдельно и изначально свёрнуты. Reuse не добавляет действий в batch;
- меню ⋯ папки: `Exclude this folder` (создаёт исключение этого link, как в §8), `Show all N files`, `Ignore a file…`; исключённая папка остаётся видна с меткой `excluded`;
- footer: `Cancel` / `Link and apply N changes`; нерешённые items остаются ждать, как в Changes.

---

## 10. Main Panel

[LOCKED]

Main Panel должна быть предельно компактной, в духе Watchtower.

[LOCKED — FUT-002, user decision 2026-10-06]

Одна dockable Main Panel автоматически переключается между вертикальной колонкой при узкой ширине и горизонтальным рядом при пересечении порога ширины. Иконки, области кнопок и отступы масштабируются по фактическому доступному размеру. Порог определяется при реализации/host-проверке с сохранением доступности всех трёх actions.

[LOCKED — user request 2026-11-06, supersedes «уменьшать controls и избегать прокрутки»] У кнопок есть нижний предел размера — около `28 px` (точное значение фиксируется при host-проверке). Ниже него кнопки больше не уменьшаются, панель прокручивается. Manifest `minimumSize` не считается гарантией: при доке Premiere может сжать панель сильнее.

Около `50 × 250 px` — ориентир компактности, а не жёсткий общий размер или гарантированный minimum Premiere. Основной рабочий вариант — компактно закреплённая вертикальная панель. Постоянных текстовых подписей нет ни в узком, ни в широком виде; названия действий доступны в подсказках.

Собственный header удаляется. Native tab/header Premiere желательно также скрыть, если существует поддерживаемый способ; его сохранение допустимо, если скрытие технически недоступно. Tools integration остаётся исследовательским пожеланием, наличие такого API не установлено.

На Main Panel постоянно находятся только три actions:

- `Links`;
- `Sync`;
- `Status`.

Названия `Links`, `Sync`, `Status` обозначают действия; в Main Panel они представлены иконками без постоянных подписей.

`Sync` применяет batch сразу, без confirmation window, если items, требующих решения, нет. Если они есть, `Sync` открывает окно Footage Sync на вкладке Changes для всего batch. При unavailable source Sync disabled.

[LOCKED — user decision 2026-11-06] Кнопки открывают одно окно Footage Sync (§15) на своей вкладке: `Links` → Links, `Status` → Changes, `Sync` с решениями → Changes. Settings action на Main Panel отсутствует; Settings — вкладка того же окна.

Main Panel не показывает inline status summary, sync history, conflicts, link list, Settings content или Sync mode. Выполняющийся Sync обозначается анимацией (предпочтительно кружок/spinner). [LOCKED — user request 2026-10-15] Нажатие на работающий кружок открывает подробности текущего процесса; второй Sync не запускается. [LOCKED — 2026-11-06] Подробности процесса показываются в окне Footage Sync на вкладке Changes.

[LOCKED — issue #1] При импорте на timeline компактная кнопка Sync также показывает полоску прогресса по числу обработанных видео. После подтверждения такого импорта пользователь может продолжать работу в редакторе. Вкладка Changes доступна по запросу и показывает текущий файл и счётчик этапа.

[LOCKED — user decision 2026-11-06, badge variant A]

- `Status` показывает основной числовой badge — число ожидающих изменений по правилу счёта §11 (добавление на таймлайн отдельно не считается);
- если есть items в `Needs you`, на `Status` дополнительно виден янтарный badge с их числом и янтарная рамка; основной count при этом сохраняется;
- на `Sync` янтарная точка, когда нажатие откроет Changes, а не применит batch сразу;
- tooltip `Status` повторяет сводку вкладки Changes (например, `34 changes waiting · 3 need you`, предупреждения) и поясняет, что Sync сначала откроет Changes.

---

## 11. Changes (formerly Review Changes)

[LOCKED]

Показывает batch changes до применения. Не показывать отдельное confirmation window на каждый файл.

Если item, требующий решения, присутствует, показывается весь batch, и ничего из него не применяется до подтверждения пользователя.

Минимальные категории:
- new files;
- new folders/bins;
- renamed files;
- moved files;
- renamed/moved folders;
- conflicts/errors;
- media requiring fragmented MP4 handling.

[LOCKED — user decision 2026-11-06, UI redesign] Review Changes и Status заменены вкладкой **Changes** окна Footage Sync. Она открывается из Main Panel (`Status`, `Sync` с решениями) и используется как превью новой связи (§9). Упоминания Review/Status в других разделах означают вкладку Changes (история — вкладку History). Визуальный контракт — [UI_SPEC UI-08](docs/UI_SPEC.md).

**Строка статуса** (тихая, под вкладками): цель импорта (`Into <project> → <sequence>`), время последнего sync, состояние links (например, `1 link paused`, ведёт в Links) и `Check now`.

**Два блока, без третьего блока Attention:**

1. **`Needs you`** — только items, у которых есть действие прямо в строке (выбор или одна кнопка) и без которых что-то не применится: fragmented MP4 (`Import originals` / `Skip this time`), изменённый marker TXT (`Replace` / `Add to existing` / `Skip TXT`), конфликт вроде «файл используется двумя project items» (пояснение + `Ignore…`), interrupted sequence append, недоступная или сломанная цель импорта. Одинаковые проблемы сворачиваются в одну строку с общим действием (например, `2 fragmented MP4 — Import originals / Skip this time`) и раскрываются по файлам по `Per file`. Подсказка блока: ничего отсюда не применяется, пока не выбрано.
2. **`Ready to apply`** — всё, что применится по кнопке `Apply`. Группы с галочкой, числом и сводкой: `New files`, `New bins`, `Renamed and moved`, `Add new videos to timeline`, `Clip markers`. Переключатель `Group by: Type | Folder`, `Select none`. Группа раскрывается до папок и файлов; у файла — галочка, метки (`+ timeline`, `TXT skipped · line 4`, `stays pending` для снятого) и меню ⋯.

Всё остальное — не отдельный блок:

- предупреждение, относящееся к файлу, — метка в строке этого файла/группы;
- ожидание, которое пройдёт само (`still copying`), — тихая сноска под `Ready to apply`;
- состояние (пауза link, последний sync, цель импорта) — строка статуса.

Если блок `Needs you` прокручен из вида, а решения открыты, сверху закреплена строка `N items in Needs you above are still open · Show`.

**Меню ⋯ строки файла:** `Ignore this file…`, `Ignore folder <folder>…`, `Import without adding to timeline`, `Add markers from TXT…` (§16), `Copy full path`.

**Меню ⋯ окна:** `Add markers from TXT…`, `Ignored files and folders (N)…`, `Change import project or timeline…`.

**Footer:** подсказка `N items wait for you`, `Close`, `Apply N changes`. `Apply` применяет отмеченное в `Ready to apply` и решённые строки `Needs you`; нерешённые не применяются и остаются ждать вместе со своими зависимыми операциями (добавление на таймлайн). `Close` закрывает окно без применения.

**Правило счёта** (badge, вкладка, группы, `Apply`): изменения считаются так, как их видит монтажёр — файл, bin, rename/move, маркеры одного TXT. Добавление нового видео на таймлайн — зависимая опция этого видео и отдельно не считается.

Ignore, Add markers и выбор цели открываются поверх Changes и не сбрасывают уже принятые решения, снятые галочки и прокрутку.

[SPIKE] Меню/поповеры ⋯ внутри UXP modal dialog и сохранение состояния при открытии вложенных диалогов и native pickers.

---

### Persistent ignore

[LOCKED — user request 2026-10-28] Можно явно игнорировать файл либо его папку со всеми подпапками. Список хранится для выбранного import project; в списке можно добавить абсолютный путь или восстановить правило.

[LOCKED — user decision 2026-11-06] Точки входа: меню ⋯ строки файла в Changes (`Ignore this file…`, `Ignore folder…`), кнопка `Ignore…` в строке конфликта, `Exclude subfolders…` в Links (§8), `Exclude this folder` / `Ignore a file…` в превью новой связи (§9). Список `Ignored files and folders (N)…` открывается из меню ⋯ над таблицей Links и из меню ⋯ окна. Кнопки Ignore в Settings больше нет.

Игнор действует до явного Restore, включая замену файла по тому же пути и новые файлы внутри игнорируемой папки. Эти пути исключаются из сканирования, sync/reconciliation, pending sequence appends и marker discovery; их проблемы не появляются в Changes, History, badges или текущих warning/error cards. Уже созданные Project Items, bins, markers и монтаж не удаляются и не меняются из-за игнора. Сохранённые mappings/незавершённые intents остаются для восстановления; Restore возобновляет обычный анализ с прежними правилами Changes и защиты от дублей. Другие пути продолжают обрабатываться.

`Skip this time` (прежний per-file `Later`) не означает постоянный игнор: он снимает импорт этого MP4 и зависимое добавление на таймлайн на текущий Sync, с явным текстом о переносе. `Close` (прежний нижний `Later`) закрывает окно без применения изменений. Для постоянного скрытия используется отдельный Ignore.

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

[LOCKED — user decision 2026-11-06, UI redesign] Подписи в Settings: `Ask in Review` (= Ask before fixing, default; решение в Changes: `Import original` / `Skip this time`), `Import original as is` (= Don't fix), `Repair before import` (= Fix automatically). Пока bundled helper не поставляется, `Repair before import` виден, но неактивен с пояснением `Needs the media helper — not in this version`, а в Changes нет действия ремонта.

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
- per-link `SEQ` flag (общая Footage sequence добавлена в §19);
- `FLT`;
- отдельное helper application, которое пользователь должен запускать;
- UX, завязанный на отдельную постоянно работающую программу.

Drag & drop может использоваться только если надёжно поддерживается выбранной UXP/Premiere architecture. Он не является обязательным core flow.

---

## 15. Screen-level UI specification

[LOCKED]

Detailed screen contracts, transitions and the approved main-screen PNG references are maintained in [`docs/UI_SPEC.md`](docs/UI_SPEC.md). Product behavior in this document takes precedence over mock data or stale helper copy visible in screenshots.

Интерфейс англоязычный, compact/dense, в dark-theme стиле Premiere и Adobe Spectrum.

Основная точка входа — адаптивная dockable Main Panel по §10: ориентир узкого вертикального вида около `50 × 250 px`, автоматический переход к горизонтальному при расширении.

[LOCKED — user decision 2026-11-06, UI redesign; supersedes separate Links / Settings, Status and Review windows] Весь содержательный UI, кроме direct action `Sync`, находится в **одном окне Footage Sync** с вкладками `Changes · History · Links · Settings` и меню ⋯ окна. Переключение вкладок не создаёт другое окно. Кнопки Main Panel открывают окно на своей вкладке (§10). Поверх окна открываются фокусные диалоги:

- `Add link` (§7) и `Edit link…`;
- `New link` — превью новой связи (§9);
- `Exclude subfolders` (§8);
- `Ignored files and folders` и Ignore файла/папки (§11);
- Add markers flow (§16);
- выбор import project / sequence (§19);
- error/conflict details, когда требуется решение пользователя.

### 15.1 Main Panel

Показывает только три масштабируемые icon actions без постоянных подписей: `Links`, `Sync`, `Status`. Layout, header, sizing и badge определены в §10 и UI_SPEC UI-01.

- `Links` открывает окно Footage Sync на вкладке Links;
- `Sync` сразу применяет changes без dialog, если items, требующих решения, нет; иначе открывает вкладку Changes;
- `Status` открывает вкладку Changes и показывает числовой badge и дополнительный attention state.

Ни один screen не подменяет содержимое Main Panel.

### 15.2 Add link

См. §7. Default flags: `Path relative to the project` — Off; `Include subfolders` — On.

### 15.3 Links

См. §8. Semantics флагов:

- `Relative path` хранит system folder path относительно файла Premiere project, чтобы link переносился вместе с project template;
- `Subfolders` включает recursive sync и зеркалирование вложенных folders в bins; Off синхронизирует только файлы непосредственно в linked folder.

`SEQ` и `FLT` отсутствуют.

### 15.4 New link preview (Initial Sync)

См. §9.

### 15.5 Changes

См. §11. Fragmented MP4 в режиме `Ask in Review` показывает decision внутри Changes, а не отдельный popup на каждый файл.

### 15.6 History

[LOCKED — user decision 2026-11-06] History — средство проверки, без действий: всё ли синхронизировалось, а если нет — что пошло не так. Список запусков (время, тип запуска, число изменений или причина сбоя) и изменения выбранного запуска раскрывающимися группами (New files, New bins, Renamed and moved, Clip markers) до отдельных файлов. Для неудачного запуска сверху показано, что пошло не так и на каком этапе. Нерешённое, неприменённое и предупреждения в History не показываются: всё ожидающее остаётся во вкладке Changes. Метрики прежнего Status не дублируются. Композиция — UI_SPEC UI-03.

### 15.7 Settings

[LOCKED — user decision 2026-11-06] Вкладка Settings окна Footage Sync; отдельной кнопки Settings на Main Panel нет. Изменения сохраняются сразу (`Saved automatically`), кнопки `Save`/`Cancel` нет.

Содержит:

- `Apply changes`: `When I press Sync` (Recommended) / `Automatically` (§6);
- `Fragmented MP4`: `Ask in Review` / `Import original as is` / `Repair before import` (§12);
- `Clip markers`: `Find a marker TXT next to each video`, default On (§16);
- `Notifications`: `Notify after a successful automatic sync`, default Off. Warnings и errors показываются всегда и не отключаются.

Defaults: `When I press Sync`; `Ask in Review`; маркеры On; AUTO не показывает success popups.

### 15.8 Current process, errors and unavailable folders

[LOCKED — user request 2026-10-15] Во время анализа/импорта подробности процесса доступны сразу и обновляют текущий этап, обрабатываемый файл/путь, доступные счётчики, прошедшее время и ошибки/предупреждения текущего процесса. Длительное ожидание host/filesystem показывается с последним известным этапом; неизвестный процент не выдумывается. Закрытие окна не останавливает Sync. Детали завершившегося/ошибочного процесса остаются доступны после тихого polling до следующей явной операции или актуального предупреждения/ошибки. [LOCKED — 2026-11-06] Текущий процесс показывается во вкладке Changes, завершённые — в History.

Conflicts и offline media попадают в Changes/details и не исправляются автоматически без решения пользователя.

Если linked folder unavailable:

- link pauses;
- Project Items/bins не удаляются;
- другие available links могут продолжать sync;
- пользователь может reconnect, choose replacement folder или оставить link paused.

---

## 16. Clip markers from TXT — FUT-001

[LOCKED — user decision, 2026-10-03]

Реализуем FUT-001 из `docs/FUTURE_VISION.md`: добавление и импорт маркеров относятся к конкретному исходному футажу / `ClipProjectItem`, а не к секвенции. Наличие секвенции и размещение клипа на timeline не являются условием импорта маркеров. При подтверждённой невозможности clip markers требуется остановиться и согласовать решение с пользователем; sequence markers не являются fallback.

Первая версия читает UTF-8 TXT: одна строка = `H:MM:SS,номер_цвета`, целые секунды от начала исходного видео. BOM, CRLF и пустые строки допускаются.

[LOCKED — user decision 2026-11-25, supersedes Markerbox indexes 0–7] Номера цветов — **1–8**, тот же формат, что пишет Polden OBS: 1 green, 2 red, 3 purple (rose), 4 orange, 5 yellow, 6 white, 7 blue, 8 cyan (teal). Номер вне 1–8, включая `0`, — ошибка строки по общему правилу ниже. Имена, комментарии, диапазоны, дробные секунды и frame timecode не входят в эту версию.

[LOCKED — user decision 2026-11-25] TXT, обработанные до перехода на 1–8, повторно в Changes не поднимаются; уже поставленные маркеры сохраняют цвета прежней нумерации.

[LOCKED — user decisions, 2026-10-03]

- Автопоиск включён по умолчанию, настройка global для проекта. TXT должен лежать в той же папке; весь basename TXT (без расширения) должен содержаться в basename MP4 в любом месте. Сравнение без учёта регистра; _repack обрабатывается этим же правилом. Например яблоко.txt → яблоко банан.mp4, яблоко 2.mp4, 2 яблоко.mp4. Это буквальная подстрока, без угадывания склонений. Несколько кандидатов: предупреждение и ручной выбор, без автоматического применения.
- Маркеры применяются вместе с Sync в обоих режимах (§6) согласно общим правилам. Сначала импорт/reconciliation media, затем маркеры source item. TXT, появившийся позже, также обрабатывается при Sync.
- [LOCKED — user request 2026-10-15] Ручной TXT имеет приоритет над автопоиском. Порядок: native TXT picker → выбор целевого source clip с попыткой автоподстановки по имени → подтверждение клипа. Неоднозначное совпадение не выбирается молча; можно вручную выбрать другой клип. Отмена на любом шаге не меняет назначение TXT. Назначение применяется при Sync по прежним правилам Changes: Replace/Append/Skip. Main Panel сохраняет Links / Sync / Status.
- [LOCKED — user decision 2026-11-06, supersedes the `Add markers…` button in Initial Sync / Review / Status] Постоянной кнопки нет. `Add markers from TXT…` находится в двух местах: в меню ⋯ окна Footage Sync (полный порядок выше, для клипов, уже находящихся в проекте) и в меню ⋯ строки клипа в Changes (клип уже известен: TXT picker → подтверждение). Flow открывается поверх Changes и не сбрасывает принятые решения.
- Обычный повторный Sync с последним обработанным TXT не создаёт дублей и сохраняет ручные правки/удаления маркеров. Изменённый TXT или повторный ручной выбор требуют Review: Replace markers / Add to existing / Skip TXT. Replace явно удаляет все маркеры только этого source clip, включая ручные; Append их сохраняет. Skip запоминает решение для этой версии TXT.
- Неверные строки, цвета, недоступный TXT, неоднозначный выбор и время вне длительности исходного media: точное предупреждение с именем TXT и номером строки где применимо; весь TXT пропускается до исправления. Импорт самого media может продолжаться. Ошибка TXT не превращается в общий blocking media conflict.
- [LOCKED — issue #2] Пустой TXT пропускается. После обработки предупреждения для текущей версии TXT и соответствующего клипа Changes возвращается к обычному состоянию, если других проблем нет. Появление новой версии или новое ручное назначение снова учитываются.
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

## 19. Import project and Footage sequence

[LOCKED — user request and answers 2026-10-27]

- Пользователь явно выбирает и сохраняет две независимые цели: проект, владеющий bins/media (обычно `…_Footage.prproj`), и проект/секвенцию для раскладки (обычно `…_Selects.prproj → Footage`). Они могут находиться в одном проекте. Смена активной вкладки не меняет выбранные цели. Недоступный import project останавливает импорт; другой активный проект не используется как fallback. [LOCKED — user request 2026-10-28] Проблема с секвенцией не блокирует доступный media import: Review позволяет продолжить только импорт файлов, пропустив раскладку этого пакета. [LOCKED — user decision 2026-11-06] В Changes это снятие группы `Add new videos to timeline` для всего пакета или `Import without adding to timeline` в меню ⋯ строки для одного файла; сохранённая цель и галочка не сбрасываются.
- [LOCKED — user decision 2026-11-06] Цели импорта показываются тихой строкой: в строке статуса Changes (`Into <project> → <sequence>`) и над таблицей Links (project, переключатель добавления новых видео в секвенцию, sequence, `Change…`). Изменение — через `Change…` в Links или `Change import project or timeline…` в меню ⋯ окна. Пока цель в порядке, она не выглядит как блок, требующий действия; если import project не открыт или секвенция недоступна, цель появляется строкой в `Needs you` с действием выбора.
- [LOCKED — user request 2026-11-04] Если native объект выбранного import project стал недействительным, плагин повторно ищет этот же сохранённый путь при штатном опросе каждые 5 секунд (когда нет выполняющегося Sync/модального flow). Выбор и настройки сохраняются. Возврат проекта восстанавливает работу без ручного выбора; открытие другого проекта не подменяет цель. Плагин не закрывает/не открывает проекты автоматически. Reopen/изменение identity по-прежнему требует свежего анализа перед мутацией.
- Выбор import project локально запоминается между сеансами; links/settings принадлежат этому проекту. Выбор секвенции относится к его настройкам. До явного выбора import project синхронизация не меняет проект. [LOCKED — user request 2026-10-28] Рядом с секвенцией есть сохраняемая галочка импорта в секвенцию для новых синхронизаций. Выключение не забывает цель и не меняет существующий монтаж. Видео, импортированные с выключенной галочкой, не добавляются задним числом при включении. Ранее сохранённые pending appends при выключении приостанавливаются.
- Впервые импортируемые видео добавляются целиком в конец выбранной секвенции: V1, исходный звук начиная с A1. Внутри пакета порядок — дата, затем имя файла. Ранее импортированные клипы автоматически не заполняют секвенцию задним числом. Existing монтаж не перестраивается; обычный повтор не добавляет клипы повторно.
- [LOCKED — user request 2026-10-28] Добавление футажа и Type Tool зависит от выбранного/разрешённого импорта исходного файла. Неразрешённый fragmented MP4 или снятая галочка его импорта отключают зависимый append в Review. После Import original и выбора файла append становится доступен. Уже импортированный источник и подтверждение выполненного receipt повторного media import не требуют. Отсутствие источника после import должно давать явную проблему, а не тихое завершение без вставки.
- Дата берётся из имени папки с датой, включая dated ancestor папки футажа. [LOCKED — user request 2026-10-28] Если распознать дату не получилось, Type Tool использует буквальное имя непосредственной папки файла. Дата файла/сегодняшняя дата не подставляются. Проверка выполняется отдельно для каждого видео: ошибка одного не помечает остальные файлы ошибочными и не блокирует их media import.
- На V2 располагается редактируемый native Type Tool с датой или fallback именем папки. Желательно один титр на одинаковую подпись в непрерывном блоке. Проверенный managed титр в конце того же блока продлевается для поздних клипов с той же подписью. Если титр нельзя надёжно найти или между блоками другая подпись, допустим новый титр. Старый титр не растягивается поверх кадров других дат ради формального ограничения количества.
- [LOCKED — user request 2026-11-04] Имя нового Type Tool клипа — буквальное имя папки футажа, без Footage Sync prefix. Подпись даты/папки внутри Type Tool остаётся прежней. При продолжении того же блока сохраняется один титр; старое managed имя с prefix распознаётся по receipt и при продлении переименовывается. Остальной монтаж и пользовательские названия не переименовываются массово.
- Незавершённое добавление сохраняется как pending intent. Неопределённый результат, Undo или отсутствующая после reopen служебная запись требуют общего Review; автоматическое дублирование не допускается. Пользователь может сохранить текущую секвенцию или явно повторить добавление; существующее в V1 медиа не дублируется при retry.
- Пользовательские проекты не autosave. Исходные media не переписываются; правила clip markers из §16 сохраняются. Production locks не обходятся. Host acceptance описывается отдельно от product contract.

[LOCKED — user request and answer 2026-11-04, supersedes manual step 2026-10-28] При добавлении новых видео в секвенцию автоматически применяется Fill Frame. Пользователь разрешил собственное масштабирование при проверенном совпадении со штатным Fill Frame. Пропорции сохраняются, кадр заполняется целиком с обрезкой излишка; учитываются размеры и pixel aspect ratio media/sequence. Применяется только к новым V1 clips, без изменения существующего монтажа, V2 Type Tool и звука. Дополнительный native модуль не требуется. Native comparison и ограничения описываются отдельно в STATE/acceptance.

[LOCKED — user confirmation 2026-10-27] Пользовательские папки используют `YYYY-MM-DD`. [VALIDATED — current implementation] Parser распознаёт этот формат, включая суффиксы вроде `2026-10-27-Developer`. Другие форматы не входят в текущий согласованный scope; неоднозначные day/month не угадываются.
