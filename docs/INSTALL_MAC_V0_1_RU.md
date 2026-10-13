# Footage Sync v0.1.0 — Mac preview

Пакет для Adobe Premiere Pro 25.6+ на macOS. На настоящем Mac установка и работа этой сборки **ещё не проверены**. Используйте копию проекта для первого теста.

## Установка

1. Установите Adobe Premiere Pro 25.6+ и Adobe Creative Cloud Desktop. Требования к версии macOS и процессору определяются установленной версией Premiere.
2. Сохраните проект и закройте Premiere.
3. Распакуйте `Footage-Sync-0.1.0-Mac.zip` обычным Archive Utility/Finder.
4. Откройте вложенный `Footage-Sync-0.1.0-Mac.ccx` двойным щелчком. Установкой управляет Creative Cloud Desktop; подтвердите установку стороннего плагина и доступ к файлам, если Adobe запросит его.
5. Запустите Premiere. Панель: `Window → UXP Plugins → Footage Sync → Footage Sync`.

Не копируйте ZIP или CCX в папку MediaCore: это UXP-плагин, он устанавливается через Creative Cloud. Не держите одновременно другую development/CCX-копию с тем же ID `com.vsly.footage-sync`. Если двойной щелчок не запускает Creative Cloud, воспользуйтесь официальной [инструкцией Adobe / UPIA для macOS](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/); при ошибке установки откройте Details в Creative Cloud.

## Состав и совместимость

ZIP содержит CCX и эту инструкцию. CCX содержит JavaScript/HTML/CSS/manifest; нативных `.exe`, `.dll` и `.uxpaddon` нет. Поэтому отдельной компиляции для Intel/Apple Silicon пакет не требует. Это не подтверждает работу на конкретной модели Mac: архитектуру должен поддерживать сам Premiere, а real-host acceptance ещё предстоит.

Mac-пакет сохраняет ID/version `com.vsly.footage-sync` / `0.1.0` и baseline 25.6. В него включена поправка соединения POSIX-путей от `/`: они больше не превращаются в Windows UNC path. Исходные Windows ZIP/CCX в релизе не заменяются. Тег `v0.1.0` сохраняет исходную Windows-сборку; Mac-поправка и packaging source находятся в main (commit указан в release notes).

## Первый запуск

- Откройте сохранённую копию проекта. Добавьте link через `Links → + Add link`, выберите папку на этом Mac и проверьте Initial Sync перед подтверждением.
- Windows-пути вида `D:\Media` или `L:\Assets` автоматически не переводятся в `/Volumes/...`. Перепривяжите папку через Links. Для переносимого расположения проверьте Relative path.
- Links/settings пока хранятся рядом с проектом в `<project>.prproj.footage-sync.json`; для записи нужна доступная для записи папка проекта.
- Проверки на этой машине покрывают POSIX path logic/reconciliation и точное содержимое архивов. Permissions/macOS privacy prompts, case/Unicode spelling на реальном APFS/SMB, filesystem identity, import/relink, UI, закрытая панель/AUTO и Productions на Mac не проверены.

## Ограничения v0.1

Переупаковки fragmented MP4 и bundled helper нет. `Later` откладывает файл до следующего Sync; постоянного Ignore нет. Native Undo не гарантирует отмену source markers в проверенном Windows Premiere 25.6.2; поведение Mac неизвестно. Перед source TXT markers проверьте Premiere `Settings/Preferences → Media → Write clip markers to XMP`: согласно Adobe, при ON markers сохраняются в media; плагин настройку не меняет.

Пакет распространяется в существующем [v0.1.0 Preview](https://github.com/VslyDream/footage-sync/releases/tag/v0.1.0). Проверка установки через CCX описана в [Adobe docs](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/).
