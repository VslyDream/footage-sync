# Footage Sync — ручная установка на Mac

В архиве `Footage-Sync-<версия>-Mac-Manual.zip` лежит готовая папка плагина для Adobe Premiere Pro 25.6 и новее. Creative Cloud Desktop для установки не нужен. **На настоящем Mac установка и работа плагина не проверялись.** Первый запуск делайте на копии проекта.

## Установка через Finder

1. Сохраните проекты и закройте Premiere.
2. Распакуйте архив.
3. В Finder нажмите **Cmd + Shift + G** и вставьте:

   `~/Library/Application Support/Adobe/UXP/Plugins/External`

   Это Library пользователя, а не `/Library` в корне диска. Недостающие папки `UXP`, `Plugins`, `External` создайте внутри `~/Library/Application Support/Adobe/`.
4. Если там уже есть папка `com.vsly.footage-sync_…` от прежней версии, перенесите её в другое место: две версии рядом мешают друг другу.
5. Скопируйте туда папку `com.vsly.footage-sync_<версия>` целиком. Файл `manifest.json` должен лежать прямо в ней, без промежуточной папки `plugin`.
6. Запустите Premiere и откройте панель: **Window → UXP Plugins → Footage Sync → Footage Sync**.

Не держите одновременно две копии плагина, включая установленную через Creative Cloud. Другие плагины и файлы Premiere не меняйте.

Если панель не появилась, проверьте версию Premiere и расположение `manifest.json`, затем перезапустите Premiere. Проверьте также настройку **Developer Mode** в разделе Plugins настроек Premiere: Adobe указывает её для плагинов, поставленных не через Creative Cloud.

## Что нужно знать на Mac

- В пакете только JavaScript, HTML и CSS, поэтому отдельной сборки под Intel и Apple Silicon не требуется. Это не подтверждает работу на конкретном Mac.
- Пути Windows вида `D:\Media` в `/Volumes/…` сами не переводятся. Если проект пришёл с Windows, укажите папку связи заново во вкладке **Links**.
- Связи и настройки хранятся рядом с проектом в `<проект>.prproj.footage-sync.json`, поэтому папка проекта должна быть доступна для записи.
- Не проверены: запросы доступа macOS, регистр и Unicode в именах на APFS и сетевых дисках, импорт и перепривязка, интерфейс, автоматический режим, Productions.

## На чём основан этот способ

- [Adobe](https://helpx.adobe.com/xd/desktop/troubleshooting/installation-and-updates/issues-installing-xd-plugins.html) описывает пользовательскую папку UXP `Plugins/External` на macOS для XD. Это подтверждает путь общей платформы, а не работу Footage Sync.
- [Разработчик Songfindr](https://docs.songfindr.com/hc/songfindr/articles/install-plugin-premiere) описывает такую же ручную установку своего плагина для Premiere 25.6+ на Mac. Это документация другого плагина, а не гарантия Adobe.
- [Документация Adobe по установке](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/) описывает CCX, Creative Cloud и Developer Mode. Ручную установку она не подтверждает.

Как пользоваться плагином, описано в [README](https://github.com/VslyDream/footage-sync#readme).
