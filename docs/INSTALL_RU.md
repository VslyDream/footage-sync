# Footage Sync — установка на Windows

Для Windows 11 и Adobe Premiere Pro 25.6 и новее. Плагин проверялся на Premiere Pro 25.6.2.

Проще всего поручить установку агенту (Claude Code, Codex): дайте ему [инструкцию для агента](https://github.com/VslyDream/footage-sync/blob/main/docs/INSTALL_AGENT.md). Ниже то же самое руками.

## Готовая папка плагина

В архиве `Footage-Sync-<версия>-Windows.zip` лежат эта инструкция и папка `com.vsly.footage-sync_<версия>`.

1. Сохраните проекты и закройте Premiere.
2. Распакуйте архив в любую временную папку.
3. Откройте в Проводнике `%APPDATA%\Adobe\UXP\Plugins\External`. Если папки `External` нет, создайте её.
4. Если там уже есть папка `com.vsly.footage-sync_…` от прежней версии, перенесите её в другое место: две версии рядом мешают друг другу.
5. Скопируйте в `External` папку `com.vsly.footage-sync_<версия>` целиком. Файл `manifest.json` должен лежать прямо в ней.
6. Запустите Premiere и откройте панель: **Window → UXP Plugins → Footage Sync → Footage Sync**.

Связи и настройки хранятся рядом с проектом в `<проект>.prproj.footage-sync.json`, поэтому при обновлении плагина они сохраняются. Установка не требует Node, npm или FFmpeg.

## Файл CCX

`Footage-Sync-<версия>.ccx` — пакет для Adobe Creative Cloud Desktop. Откройте его двойным щелчком и подтвердите установку стороннего плагина. Состав пакета сверен с исходниками, но сама установка через Creative Cloud **не проверялась**. Не ставьте CCX и готовую папку одновременно.

## Если панели нет в меню

- Версия Premiere ниже 25.6.
- `manifest.json` оказался во вложенной папке, а не прямо в `com.vsly.footage-sync_<версия>`.
- В `External` осталась папка прежней версии.
- Premiere не был перезапущен после копирования.
- Выключена настройка **Developer Mode** в разделе Plugins настроек Premiere: Adobe указывает её для плагинов, поставленных не через Creative Cloud.

Как пользоваться плагином, описано в [README](https://github.com/VslyDream/footage-sync#readme).
