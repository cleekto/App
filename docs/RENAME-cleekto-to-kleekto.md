# Переименование Cleekto → kleekTo

Отчёт о выполненном переименовании продукта/кодовой базы. Дата: 2026-09-02.
Не источник истины по продукту (см. `CLAUDE.md` §«Документы») — рабочая
справка о том, что именно изменилось и что осталось сделать руками вне кода.

## 1. Что и почему

Владелец решил переименовать продукт: `Cleekto` → `kleekTo`.

Принятое соглашение о регистре:

| Контекст | Было | Стало |
|---|---|---|
| Название бренда в тексте/UI/документации | `Cleekto`, `CleekTo` | `kleekTo` (маленькая `k`) |
| Технические идентификаторы: имена npm-пакетов, cookie, issuer, env-переменные, docker-имена | `cleekto` | `kleekto` |
| Технические идентификаторы в верхнем регистре (env-переменные времени сборки) | `CLEEKTO` | `KLEEKTO` |

Правило простое: капитализация конкретного вхождения сохраняется 1:1, меняется
только сама основа слова (`c→k`, остальные буквы как были).

## 2. Масштаб изменений

- **138 файлов** в git, **345 текстовых вхождений** заменено.
- Затронуты: код (`apps/`, `packages/`), конфиги, `package.json` во всех
  8 пакетах workspace, `pnpm-lock.yaml` (пересобран через `pnpm install`,
  не редактировался руками), документация (`docs/**`, `CLAUDE.md`,
  `README.md`), тесты.
- **Не тронуто:** `docs/archive/addendum-v2.1-design.md` — архивный документ,
  по аналогии с `docs/spec/MASTER_PRODUCT_SPECIFICATION.md` фиксирует
  состояние на момент написания и умышленно не редактируется.

Проверки после переименования — все зелёные:

```
pnpm typecheck   # 7/7 пакетов — Done
pnpm lint        # eslint + prettier — чисто
pnpm test        # 16 файлов, 402 теста — все прошли
pnpm build       # extension + web — собрались, включая next build
```

## 3. Детали по категориям

### 3.1 Имена npm-пакетов (workspace)
`@cleekto/core`, `@cleekto/db`, `@cleekto/i18n`, `@cleekto/contracts`,
`@cleekto/adapters`, `@cleekto/web`, `@cleekto/extension`, корневой `cleekto`
→ `@kleekto/*` / `kleekto`. Обновлены все импорты по всему коду,
`next.config.ts` (`transpilePackages`), `pnpm-workspace.yaml` не менялся (там
нет привязки к имени). `pnpm-lock.yaml` пересобран командой `pnpm install`.

### 3.2 Cookie сессии и JWT issuer
- `apps/web/app/api/_lib/cookie-names.ts`: `cleekto_access` /
  `cleekto_refresh` → `kleekto_access` / `kleekto_refresh`.
- `apps/web/app/locale.ts`: `LOCALE_COOKIE = 'cleekto_locale'` →
  `'kleekto_locale'`.
- `packages/core/src/auth/tokens.ts`: JWT `ISSUER = 'cleekto'` →
  `'kleekto'`, проверяется строго (`jwtVerify(..., { issuer: ISSUER })`).

**⚠️ Разлогинит всех действующих пользователей после деплоя.** Проверено по
коду:
- `apps/web/app/api/_lib/handler.ts:extractToken()` ищет куку строго по
  имени константы `ACCESS_COOKIE` — обратной совместимости со старым именем
  нет.
- `apps/web/middleware.ts:refreshSessionCookie()` читает `ACCESS_COOKIE` /
  `REFRESH_COOKIE` — те же новые имена, старую refresh-куку не видит.
- Даже если бы куки как-то долетели, `verifyAccessToken()` отклонит любой
  access-токен, подписанный со старым issuer `'cleekto'`.

Итог: у каждого пользователя, залогиненного до деплоя, при первом запросе
после раскатки отвалится сессия (сервер не увидит ни старую access-, ни
refresh-куку под новым именем) — просто редирект на `/login`, без потери
данных. Обратной совместимости специально не делали (недолговечное
переходное состояние ради двух cookie-имён того не стоит), но это осознанный
компромисс, а не побочный эффект — сообщаю явно, как просили.

### 3.3 Env-переменные времени сборки расширения
`.env.example`, `apps/extension/build.mjs`, `apps/extension/src/core/config.ts`,
`README.md`, `docs/DEPLOYMENT.md`:
`CLEEKTO_API_URL` / `CLEEKTO_APP_URL` → `KLEEKTO_API_URL` / `KLEEKTO_APP_URL`
(и `__CLEEKTO_API_URL__` / `__CLEEKTO_APP_URL__` — define-константы esbuild).

### 3.4 Docker / локальная база
- `docker-compose.yml`: `container_name`, `POSTGRES_USER`, `POSTGRES_DB`,
  `POSTGRES_PASSWORD` — `cleekto*` → `kleekto*`. Добавлено явное `name:
  kleekto` в начале файла: без этого Docker Compose берёт имя проекта из
  имени папки на диске (`CleekTo`), а не из содержимого файла, и volume/сеть
  остались бы с префиксом `cleekto_`.
- Старый локальный контейнер `cleekto-postgres` и volume
  `cleekto_postgres-data` **удалены** (`docker compose -p cleekto down -v`).
  Поднят новый `kleekto-postgres` / volume `kleekto_postgres-data` —
  **пустой**, миграции на него не накатывались.
- `.github/workflows/ci.yml`: те же переменные `POSTGRES_USER/DB/PASSWORD`
  и строки подключения — переименованы для консистентности с
  `docker-compose.yml`.

### 3.5 Extension manifest и пользовательский текст
- `apps/extension/public/manifest.json`: `"name": "Cleekto"` →
  `"name": "kleekTo"`.
- Словари `packages/i18n/src/locales/{ru,ka,en}.ts`: строки вида
  «Согласен — добавить в Cleekto», «Открыть в Cleekto», «Нет связи с
  Cleekto» → `kleekTo`.

### 3.6 Локальный `.env` (не в git)
Единственное вхождение — заголовочный комментарий `# Cleekto — пример
окружения.` → `# kleekTo — пример окружения.`. Реальные значения
`DATABASE_URL`/`DIRECT_URL` в этом файле указывают на боевую ветку Neon
(`NEON_BRANCH=production`) — их не трогали и не показывали повторно в чате.

### 3.7 Память ассистента (вне репозитория)
`~/.claude/projects/.../memory/MEMORY.md` и `cleekto-three-languages.md` —
поправлено название проекта в заголовке и описании, для консистентности
будущих сессий.

## 4. Что осталось сделать руками (вне этой сессии)

Ничего из этого не тронуто кодом/автоматически — требует твоего решения и
действий на внешних площадках:

1. **Сессии пользователей.** См. §3.2 — при деплое этого изменения все
   активные пользователи будут разлогинены разово. Если это неприемлемо для
   прод-релиза без предупреждения — стоит анонсировать заранее или катить
   в окно с низким трафиком.
2. **GitHub.** Remote сейчас `github.com/cleekto/App` — организация/репозиторий
   не переименовывались (это отдельное действие в настройках GitHub, не
   часть кода).
3. **Chrome Web Store.** Если расширение уже опубликовано под именем
   «Cleekto», смена `name` в `manifest.json` — это ещё и смена листинга в
   консоли разработчика Chrome Web Store, отдельно от кода.
4. **Vercel / CI секреты.** Если во внешних настройках хостинга уже заданы
   переменные `CLEEKTO_API_URL` / `CLEEKTO_APP_URL` (для сборки расширения)
   — их нужно переименовать в `KLEEKTO_API_URL` / `KLEEKTO_APP_URL` там же,
   иначе сборка возьмёт дефолт `http://localhost:3000`.
5. **Локальная база для разработки.** Новый контейнер `kleekto-postgres`
   пустой. Когда переключишь `DATABASE_URL` в `.env` обратно на localhost —
   выполни `pnpm db:migrate` (и по желанию `pnpm db:seed`).
6. **Физическая папка проекта.** `D:\coding\CleekTo` не переименована — это
   текущая рабочая директория сессии, переименовывать на лету рискованно
   (сломало бы cwd прямо во время работы). Можно переименовать вручную после
   закрытия сессии/IDE.
7. **Домен и внешние ссылки.** В коде не найдено захардкоженных доменов вида
   `cleekto.ge`/`.com` — переименование продукта на реальном домене (если он
   существует) находится полностью вне этого репозитория.

## 5. Проверки — полный вывод команд

```
$ pnpm typecheck
Scope: 7 of 8 workspace projects
✓ packages/contracts, packages/db, packages/i18n,
  packages/adapters, packages/core, apps/extension, apps/web — все Done

$ pnpm lint
✓ eslint . && prettier --check . — чисто

$ pnpm test
✓ Test Files  16 passed (16)
✓ Tests  402 passed (402)

$ pnpm build
✓ apps/extension build — Done
✓ apps/web build — next build, 14/14 страниц сгенерировано
```
