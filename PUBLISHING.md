# Публикация в Obsidian Community Plugins

## Требования

1. **GitHub репозиторий** — публичный, в корне (или в assets релиза):
   - `main.js`
   - `manifest.json`
   - `styles.css`

2. **GitHub Release** — тег версии должен совпадать с `version` в `manifest.json` (например `1.0.0`). В assets релиза приложить `main.js`, `manifest.json`, `styles.css`.

3. **`versions.json`** в корне репо — маппинг версий плагина на минимальную версию Obsidian:
   ```json
   {
     "1.0.0": "1.4.0"
   }
   ```

4. **README.md** — описание плагина.

5. Плагин не должен делать внешние сетевые запросы без согласия пользователя.

6. Код не должен быть обфусцирован.

## Процесс подачи

1. Форкнуть `obsidian-md/obsidian-releases`
2. Добавить запись в `community-plugins.json`:
   ```json
   {
     "id": "review-simple",
     "name": "Review Simple",
     "author": "CitrusRenegade",
     "description": "Revisit notes on a schedule you define.",
     "repo": "CitrusRenegade/review-simple-obsidian"
   }
   ```
3. Открыть PR в `obsidian-md/obsidian-releases`
4. Ждать ревью (обычно несколько недель)
5. После мержа форк можно удалить

## Про форк и приватность

Форк `obsidian-releases` обязателен — так работают GitHub PR'ы к чужому репо.

Известная проблема GitHub: если форкнуть **публичный** репо, сделать форк **приватным** и запушить туда секреты — они всё равно доступны через сеть форков оригинала. Но здесь это не применяется:

- В форк `obsidian-releases` идёт только одна строка JSON (имя + ссылка на репо)
- Код плагина живёт в отдельном своём репо, к форку `obsidian-releases` не относится
- Форк нужен буквально на время создания PR, после мержа удаляется

## GitHub Actions для автоматических релизов

Стандартный workflow из Obsidian sample plugin — при пуше тега автоматически собирает и создаёт Release с нужными assets. Добавить при необходимости.
