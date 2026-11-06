# Текущий интерфейс — снимки от 04.11.2026

> Это интерфейс до редизайна. Целевой интерфейс, утверждённый 2026-11-06, — [UI_SPEC.md](UI_SPEC.md) и [ui/redesign-2026-11/](ui/redesign-2026-11/).

[Галерея всех экранов](../artifacts/ui-inventory-2026-11-04/index.html) · [Контактный лист Review](../artifacts/ui-inventory-2026-11-04/review-overview.jpg) · [Manifest](../artifacts/ui-inventory-2026-11-04/manifest.json).

Зафиксированы **46 состояний / 84 PNG**. Это текущие `plugin/ui.js`, `style.css`, `main-panel.js` и Main Panel markup, отрисованные в браузере с демонстрационными данными через существующий `scripts/preview-ui.js`. Premiere во время сбора не запущен; новых native UXP screenshots в этой подборке нет. Spectrum controls приближены браузерным стендом. Подборка документирует реализацию, не заменяет SPEC/UI_SPEC/golden references и не означает нового visual approval или host acceptance.

Каждое состояние имеет отдельный самодостаточный HTML со встроенным снимком исходного UI-кода, текст видимого содержимого и один или несколько PNG. Длинные области сняты с перекрытием при последовательной прокрутке; header/footer и исходные размеры окон сохранены. Число changes означает операции: десять media и отдельный append дают 11 changes. Запуск, сохранение и решения происходят только в имитированном controller; пользовательские проекты/медиа/настройки и установленный плагин не затрагиваются.

| Группа | Состояний | Что зафиксировано |
|---|---:|---|
| Review Changes | 12 | 10 новых футажей; смешанный batch из 10 media + append; MP4 decisions; Import original; per-file Later; TXT Replace/Add/Skip и выбранное Add; sequence error; interrupted append и Keep; conflict/unavailable/media error; rename/move/folder/reconcile; пустой список |
| Initial Sync | 3 | 10 новых футажей с reuse; предупреждения/MP4; всё уже импортировано |
| Status | 9 | Up to date; pending; blocking; unavailable; неблокирующая TXT warning; import progress; ожидание; ошибка; завершение |
| Links / Settings / Ignore | 6 | Active/Paused/root/long paths; пустые Links; ASK/ASK и нижние настройки; список Ignore; file/folder scopes |
| Создание links и выбор целей | 9 | Два entry flows; existing/edit/validation; matching bins; свёрнутое/раскрытое bin tree; project/sequence picker |
| Маркеры / общая ошибка | 3 | TXT с уникальным совпадением; без совпадения; error assurance |
| Main Panel | 4 | Vertical idle; count + attention; busy spinner frame; horizontal pending |

Основные снимки Review: [10 файлов](../artifacts/ui-inventory-2026-11-04/review-safe-ten-01.png), [предупреждения и решения](../artifacts/ui-inventory-2026-11-04/review-mixed-ten-01.png), [середина списка](../artifacts/ui-inventory-2026-11-04/review-mixed-ten-02.png), [низ списка и append](../artifacts/ui-inventory-2026-11-04/review-mixed-ten-03.png). Все остальные снимки и состояния решений доступны через галерею.

Наблюдения по текущей браузерной отрисовке: 10 файлов требуют нескольких прокруток; warnings занимают верх списка; левая и правая колонки Review прокручиваются вместе; длинные имена обрезаются; footer остаётся видимым. Settings требует прокрутки до Notifications/Ignore. Это наблюдения стенда, точную плотность Spectrum и поведение native host нужно сверить отдельно.

Не покрыто новыми native снимками: реальный OS folder/TXT picker, dock/workspace/DPI, hover/tooltips, полный keyboard flow и анимация во времени. UI-09 Folder Unavailable recovery ещё не реализован; сохранены существующие unavailable представления в Review/Status, отдельный экран не выдуман. Matching bins снят в начальном состоянии; реальное файловое дерево не имитировалось. AUTO notifications и host-only состояния нельзя подтвердить этой галереей.

Существующие native references сохраняют свои прежние даты и ограничения: [Settings Ignore](ui/settings-ignore.png), [Ignore list](ui/ignored-paths.png), [Ignore scope](ui/ignore-path.png), [компактные цели Links](ui/links-targets-compact.png), [acceptance 2026-10-28](TIMELINE_IGNORE_ACCEPTANCE.md). Старые marker Status/Review из `artifacts/marker-host-test/` не представлены как текущий интерфейс: их постоянный список клипов уже заменён.

Проверка: 46 сценариев открылись без browser page errors; 84 PNG сохранены; Review и положения прокрутки, Settings и progress просмотрены визуально; `node --check scripts/capture-ui-inventory.js` и `npm run check` пройдены (22 runtime JS + manifest). Runtime не менялся, установка не требуется; native acceptance отдельно остаётся непроведённым в этом запросе.

Повторный сбор: `node scripts/capture-ui-inventory.js`, с `PLAYWRIGHT_PATH`, указывающим на имеющийся пакет Playwright. Используется установленный Edge, отдельный временный профиль и headless rendering. SHA256 UI-исходников записаны в manifest. Сами локальные материалы находятся в git-ignored `artifacts/`; для передачи подготовлен ZIP рядом с каталогом. Следующий шаг — сравнить выбранные плотные Review/Status состояния с native UXP на отдельном тестовом проекте.
