# Footage Sync — установка на Mac через Creative Cloud

Пакет для Adobe Premiere Pro 25.6 и новее на macOS. **На настоящем Mac установка и работа плагина не проверялись.** Первый запуск делайте на копии проекта.

## Установка

1. Сохраните проект и закройте Premiere.
2. Распакуйте `Footage-Sync-<версия>-Mac.zip`.
3. Откройте вложенный `Footage-Sync-<версия>-Mac.ccx` двойным щелчком. Установкой управляет Adobe Creative Cloud Desktop: подтвердите установку стороннего плагина и доступ к файлам, если он спросит.
4. Запустите Premiere и откройте панель: **Window → UXP Plugins → Footage Sync → Footage Sync**.

Не держите одновременно две копии плагина: эту и скопированную вручную в папку `External`. Если двойной щелчок не открывает Creative Cloud, воспользуйтесь [инструкцией Adobe](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/) или установкой без Creative Cloud из `Footage-Sync-<версия>-Mac-Manual.zip`.

## Что нужно знать на Mac

- В пакете только JavaScript, HTML и CSS, поэтому отдельной сборки под Intel и Apple Silicon не требуется. Это не подтверждает работу на конкретном Mac.
- Пути Windows вида `D:\Media` в `/Volumes/…` сами не переводятся. Если проект пришёл с Windows, укажите папку связи заново во вкладке **Links**.
- Связи и настройки хранятся рядом с проектом в `<проект>.prproj.footage-sync.json`, поэтому папка проекта должна быть доступна для записи.
- Не проверены: запросы доступа macOS, регистр и Unicode в именах на APFS и сетевых дисках, импорт и перепривязка, интерфейс, автоматический режим, Productions.

Как пользоваться плагином, описано в [README](https://github.com/VslyDream/footage-sync#readme).
