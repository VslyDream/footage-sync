# FUT-002 — Компактный интерфейс: исследование и реализация

> Исследовано 2026-10-03; product decisions получены 2026-10-06.
> Адаптивный Main Panel реализован, установлен и проверен локально в Premiere 25.6.2. Полная DPI/keyboard/state acceptance остаётся открытой.
> Исходная идея: [FUTURE_VISION.md, FUT-002](FUTURE_VISION.md#fut-002--компактные-кнопки--вертикальная-панель).
> Действующие контракты: [SPEC.md](../SPEC.md), [UI_SPEC.md](UI_SPEC.md).

## Вывод

Собственная адаптивная панель реализована в текущей UXP-архитектуре. Внутренний заголовок удалён; кнопки и иконки подстраиваются под фактические width/height. В изолированной probe измерено содержимое 52 × 262 px без overflow; основная панель закреплена узкой колонкой и проверена в горизонтальном виде. Это content pixels, а не гарантированный физический размер вместе с вкладкой Premiere.

Документированного способа добавить наши действия именно во встроенную **Tools panel** или скрыть **host tab/header** в просмотренных источниках не найдено. Это не доказательство невозможности во всех Adobe технологиях. Такие варианты нельзя обещать для Premiere 25.6.2 до адресного подтверждения API или воспроизводимой host-проверки.

## Что проверено

Прочитаны SPEC, STATE, FUT-002, общие UI rules и UI-01; просмотрен только golden `ui/main-panel.png`. Изучены текущие `plugin/manifest.json`, `index.html`, `index.js`, `style.css`, main-action handlers и modal/update code в `ui.js`. Проверены официальные Adobe страницы и manifest официального Premiere API sample.

Исследование продолжено реализацией и реальной host-пробой; отдельная UI Probe использует production HTML/CSS/MainPanel/layout без Premiere project API. Основная development-сборка обновлена. Настройки Windows не менялись. Проверены resize, animation, docking и открытие отдельных окон; тестовый проект не изменился. Полные результаты и ограничения: [ACCEPTANCE.md](../artifacts/panel-host-test/ACCEPTANCE.md). Browser preview не считается доказательством UXP/host sizing.

## Возможности и ограничения

| Задача | Статус | Основание / практическое значение |
|---|---|---|
| Собственная dockable/floating panel | [VALIDATED — official docs; existing local implementation] | UXP panels поддерживают docking, floating и resize. Текущий плагин уже использует panel entrypoint. [Adobe](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/panels-and-commands/) |
| Вертикальные иконки Links / Sync / Status | [VALIDATED locally 25.6.2] | Собственные HTML/SVG controls реализованы; узкая колонка и переход в row проверены. |
| Убрать собственную полосу FS / Footage Sync | [VALIDATED locally; LOCKED decision 2026-10-06] | Удалена из HTML/CSS; native tab/header Premiere сохраняется. |
| Добавить кнопки во встроенную Tools | [OPEN / SPIKE] | UXP документирует entrypoints `panel` и `command`; найденного Tools registration API или примера нет. `species: ["toolbar"]` задаёт назначение ресурса иконки, а не добавляет действие в Tools. [Manifest](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) |
| Скрыть native tab/header Premiere | [OPEN / SPIKE] | В просмотренных panel entrypoint properties нет такой настройки. CSS нашего документа не предоставляет документированного управления host chrome. Пустой label не является доказательством удаления вкладки. [Manifest](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) |
| Гарантировать ровно 50 px через manifest | [LIMITATION — docs + local observation] | Preferred sizes — запрос; host может не соблюдать их. Probe впервые открылась при content 40 × 48, затем resize дал 52 × 262. Это измерения конкретных состояний, не универсальный minimum. [Manifest](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) |
| Переключать layout при resize | [VALIDATED — docs + local 25.6.2] | Использован root-scoped `ResizeObserver`, доступный в целевом UXP 8.1. Для нескольких panels media query использует размер первой панели; поэтому размер dialogs не используется как размер Main Panel. Есть feature-detected polling fallback. [Width](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-css/media-queries/width), [ResizeObserver](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/global-members/html-dom/resize-observer) |
| Просто уменьшить весь UI через CSS transform | [SPIKE; not proposed as default] | Changelog описывает `scaleX/scaleY` с `CSSNextSupport`. Текущий manifest этот flag не включает. Это не замена проверки layout, попадания кликов и размеров host. [Changelog](https://developer.adobe.com/premiere-pro/uxp/uxp-api/changelog3-p) |
| Открывать широкие Links / Status из узкой панели | [VALIDATED locally 25.6.2] | Links / Settings / Status из новой узкой панели сохранили отдельные широкие окна. Стили Main Panel ограничены его root. |
| Запускать действия из меню без постоянной панели | [VALIDATED — official docs; optional direction] | `command` создаёт пункт Window > UXP Plugins, не кнопку Tools. Это дополнительный вариант, не выбранная замена панели. [Panels and Commands](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/panels-and-commands/) |
| Назначить глобальные shortcuts через manifest | [LIMITATION — official docs] | Premiere пока не поддерживает manifest `shortcut`. Не путать с Enter/Space внутри панели: такие handlers уже есть. Глобальные shortcuts не являются обещанным fallback. [Manifest](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) |

Официальный [Premiere API sample manifest](https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/public/manifest.json) показывает обычную panel и SVG icon resources с scale 1/2. Он не показывает Tools integration или удаление host header; его размеры нельзя считать измерением минимальной ширины Premiere. Текущая версия sample/docs может содержать API новее baseline 25.6, поэтому каждый используемый механизм проверяется в целевом host.

## Что изменено относительно прежнего UI

- Manifest minimum изменён с 230 × 115 на 40 × 48, preferred с 340 × 150 на 50 × 250. Это запрос host, не обещание точного размера.
- `core/panel-layout.js` рассчитывает square buttons, иконки, padding и gap по реальным width/height. Ниже 160 content px используется column, начиная со 160 — row. Максимальная кнопка 56 px, иконка 32 px; недостаток места уменьшает оба размера.
- `main-panel.js` наблюдает собственный root и управляет numeric badge, отдельным attention, disabled и spinner. Точный count сохраняется; font уменьшается для длинного числа.
- Busy spinner меняет SVG fills каждые 100 ms без нового CSS flag/runtime. Timer прекращается при idle/error, zero size или destroy. Observer/fallback также освобождаются.
- Собственный header и постоянные подписи удалены. Title tooltips, focus и существующие Enter/Space handlers сохранены.
- Размеры dialogs и controller/sync flows не изменены. Production files совпали с installed files (18/18).

## Принятые ответы перед реализацией

[LOCKED — user decision 2026-10-06]

1. **Layout:** одна панель автоматически переключается между вертикальным и горизонтальным видом при пересечении порога ширины.
2. **Размер:** 50 × 250 px — ориентир, не жёсткий minimum. Читать фактическую ширину колонки и масштабировать иконки. Не трактовать этот размер как утверждённый content-box или total-chrome размер.
3. **Header:** желательно убрать обе шапки; собственную убираем, native Premiere допустимо оставить, если поддерживаемое скрытие недоступно.
4. **Подписи:** только иконки и в узком, и в широком виде; постоянные короткие подписи не нужны. Названия доступны в подсказках.
5. **Масштабирование:** уменьшение иконок и отступов плюс автоматическая смена ориентации по threshold. Конкретный threshold и границы размеров определяются реализацией с host-проверкой.
6. **Недостаток места:** предпочтительно избегать прокрутки и уменьшать кнопки. Практические границы должны сохранять доступность всех трёх действий; недостижимый размер нельзя молча считать выполненным.
7. **Состояния:** числовой count изменений на Status. Для работающего Sync — анимация, кружок/spinner предложен пользователем; точное визуальное исполнение делегировано. Attention должен оставаться различимым вместе с count, а busy animation завершаться после работы/ошибки.
8. **Scope:** только Main Panel. Links / Settings / Status / Review и остальные flows по-прежнему открываются в отдельных окнах; их redesign не входит в FUT-002.
9. **Рабочее окружение:** один 2K монитор и один Full HD, основной вариант docked. Вертикальная панель нужна для максимально компактного закрепления. Windows scaling percentages пока не известны; разрешение мониторов не определяет их.

Действия Links / Sync / Status, Sync semantics и отсутствие отдельной Settings кнопки сохраняются. Contract отражён в SPEC §10/§15.1 и UI_SPEC UI-01. Старый Main Panel PNG сохранён как previous design; новые runtime references предоставлены в docs/ui.

## Что остаётся выяснить технически

[VALIDATED locally] Adaptive sizing/animation, column/row, content 52 × 262, compact docking, tooltip Links и отдельные dialogs. Host content 40 × 48 тоже размещает три кнопки, но делает их слишком мелкими для удобного использования; не считать его рекомендуемым размером. Это не проверка всех dock groups/host configurations.

[SPIKE] Nonzero/large count + attention в реальном host, полный Tab/Enter/Space, восстановление workspace и переход между мониторами. Numeric/attention/error/timer lifecycle покрыты unit tests. Tools integration/native header control по-прежнему не подтверждены; native header fallback уже применён.

[OPEN — environment] Конкретные Windows scaling percentages для двух мониторов нужно записать при host acceptance. Это не новое product decision и не основание повторно спрашивать уже согласованные UI preferences.

## Технические проверки — работа агента, не вопросы пользователю

1. **Tools / host header:** получить конкретную ссылку на поддерживаемый API/официальный пример для baseline. Отсутствие API в найденном перечне не заменять экспериментом с недокументированным вызовом. Если подтверждения нет, сохранить native header согласно принятому fallback; не переходить молча к native injection, CEP, новому runtime или повышению baseline. Собственная адаптивная панель уже согласована.
2. **Минимальная ширина:** отдельная изолированная UXP sizing probe с запрашиваемыми 50 px и тремя dummy controls, без filesystem scan/project mutation. Измерить content box и общую область; записать docked/floating режим, одиночную/групповую вкладку, UXP/host versions и Windows scaling. Manifest change требует полноценного unload/load; факт принятия JSON не доказывает фактическую ширину.
3. **Resize:** проверить media queries или feature-detected ResizeObserver в 25.6.2, переход туда/обратно, отсутствие мерцания и обрезки. Ограничить стили Main Panel его root, чтобы dialogs не наследовали маленькие размеры.
4. **Доступность:** mouse, hover tooltip у края панели, Tab/Enter/Space, видимый focus, disabled, syncing, pending count большого размера, attention. Сейчас title и keyboard handlers есть, но narrow-host acceptance отсутствует.
5. **Dialog regression:** из узкого UI открываются прежние окна и Review; Sync по-прежнему direct action для safe batch. Не менять sync/controller semantics ради новой компоновки.
6. **Acceptance:** проверить workspace restoration после перезапуска и перенос между 2K/Full HD мониторами с записанным Windows scale. Contract уже обновлён; после реализации предоставить новый visual reference и записать фактические ограничения.

## Следующий шаг и границы acceptance

Реализация и installed verification завершены; 67 tests и 15-module syntax/manifest check passed. Далее — оставшаяся host matrix из ACCEPTANCE.md. UI automation после повторной попытки восстановления получила `encode latest capture frame failed: window crop is outside captured monitor`; использование старых координат прекращено. Не объявлять DPI/keyboard/nonzero-state matrix завершённой по unit tests или неподтверждённым UI inputs. Текущая основная панель оставлена закреплённой узкой колонкой; рядом установлен отдельный UI Probe для дальнейшей проверки.
