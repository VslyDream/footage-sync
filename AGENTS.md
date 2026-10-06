# Footage Sync — Codex instructions

Этот файл задаёт **как агент работает с проектом**.  
Он не заменяет продуктовый spec.

Before substantial work:

1. Read `SPEC.md`.
2. Read `STATE.md`.
3. Treat `SPEC.md` as the canonical product contract.
4. Treat `STATE.md` as the current development snapshot.
5. For UI work, also read `docs/UI_SPEC.md` and only the screenshots referenced by the screen(s) in scope.

---

## 1. Decision boundary

### Product decisions are locked

Не меняй самостоятельно решения, которые влияют на user-visible behavior или продуктовый контракт.

К ним относятся:

- user flows;
- экраны и основные UI controls;
- поведение AUTO / ASK / MANUAL;
- правила синхронизации disk ↔ Premiere;
- rename / move / delete behavior;
- duplicate behavior;
- installation / permissions UX;
- работа bundled helper;
- fragmented MP4 behavior;
- поддерживаемые версии Premiere / OS;
- требования к производительности, data integrity и non-destructive behavior.

Если такое решение нужно изменить из-за технического ограничения:

1. не подменяй его молча более удобной реализацией;
2. проверь документацию и/или сделай минимальный technical spike;
3. зафиксируй finding в `STATE.md`;
4. объясни conflict и предложи 1–3 viable options;
5. дождись product decision;
6. только после этого обновляй `SPEC.md`.

### Implementation decisions are delegated

Можно самостоятельно выбирать HOW, если это не меняет продуктовый контракт:

- code structure;
- modules / classes / interfaces;
- state management;
- internal data models;
- indexing / caching;
- polling/watch implementation;
- IPC implementation;
- helper internals;
- test structure;
- internal logging;
- error handling;
- naming;
- low-risk dependencies;
- performance optimizations.

Rule of thumb:

> If the Premiere user can notice the difference, it is probably a product decision.  
> If only a developer notices the difference, it is probably an implementation decision.

Даже implementation decision требует согласования, если он:

- заметно усложняет установку;
- требует нового user-facing permission;
- добавляет постоянно работающий background process;
- снижает Premiere/OS compatibility;
- создаёт риск потери или изменения пользовательских файлов;
- вводит тяжёлый runtime/dependency без явной необходимости.

---

## 2. Documentation & research

Не придумывай Premiere/UXP API по памяти.

Research обязателен, когда:

- используется незнакомый Premiere/UXP API;
- неизвестно, существует ли нужный API;
- поведение version-sensitive;
- речь о lifecycle/background execution;
- filesystem permissions;
- external/native process launch;
- Productions;
- import / relink / move Project Items;
- Premiere events;
- UXP UI limitations;
- Windows/macOS differences;
- FFmpeg container/remux behavior;
- docs и observed behavior расходятся;
- собираешься утверждать, что функция невозможна или unsupported.

Recommended sources — **guidance, not an allowlist**:

1. Adobe Premiere UXP official docs / API reference / changelog.
2. Official Adobe sample repositories.
3. FFmpeg official docs for FFmpeg/container behavior.
4. Watchtower docs/forum as product & UX reference.
5. GitHub issues, Adobe forums, community examples for undocumented behavior.
6. Other relevant sources when primary documentation is insufficient.

Разрешено искать шире. Не ограничивай research только этим списком.

При использовании неофициального источника отделяй:
- documented behavior;
- community evidence;
- local experimental finding.

Если документация не даёт уверенного ответа — делай minimal reproducible spike вместо assumption.

---

## 3. Project memory

### `SPEC.md`

Current product truth.

Обновляй только когда:
- принято новое product decision;
- изменён согласованный UX/behavior;
- technical spike подтвердил или опроверг assumption, явно записанный в SPEC.

Не переписывай SPEC ради удобства реализации.

### `STATE.md`

Current development truth.

После meaningful work обнови:
- что сейчас работает;
- что не реализовано;
- open spikes/blockers;
- validated technical findings;
- known issues;
- ближайший следующий шаг.

STATE — не diary и не changelog.

Удаляй/переписывай устаревшие записи, чтобы файл описывал текущее состояние.

> Git history is the historical archive.  
> Documentation describes the current truth.

### `docs/UI_SPEC.md`

Canonical screen contract for approved UI structure, controls, states and transitions.

- Treat screenshots in `docs/ui/` as golden visual references only when `docs/UI_SPEC.md` links them.
- Load only the screen images relevant to the current task.
- Treat the interactive prototype in `prototype/` as a secondary behavior/review reference.
- Do not load prototype source merely to understand the approved UI; inspect it only when implementing or resolving an ambiguity.
- Product behavior remains canonical in `SPEC.md`; avoid duplicating or overriding it in UI documentation.

---

## 4. Working with uncertainty

Используй статусы:

- `[LOCKED]` — product decision принят.
- `[OPEN]` — вопрос ещё не решён.
- `[SPIKE]` — целевое поведение определено, техническая реализуемость требует проверки.
- `[VALIDATED]` — проверено документацией и/или прототипом.
- `[LIMITATION]` — подтверждённое ограничение.

Не превращай uncertainty в скрытое assumption.

Если uncertainty не влияет на observable product behavior — выбери reasonable implementation и двигайся дальше.

---

## 5. Before finishing a task

Перед завершением meaningful task:

1. Run relevant tests/checks.
2. Не объявляй функцию working без проверки, соответствующей её риску.
3. Update `STATE.md`.
4. Если изменился продуктовый контракт — убедись, что изменение было согласовано, затем update `SPEC.md`.
5. Кратко сообщи:
   - what changed;
   - what was verified;
   - remaining issues / risks;
   - what should be done next.
