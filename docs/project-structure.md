# project-structure.md

## Роль документа
Этот документ — **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Его цель: создать **правильную структуру монорепозитория SmartAnalyzer**, подготовить базовую инфраструктуру и зафиксировать правила, чтобы последующие задачи не расползались по проекту.

> Агент должен **СОЗДАТЬ/ОБНОВИТЬ** файлы и папки строго по этому документу.  
> Нельзя изобретать альтернативную структуру без явной причины.

---

## Цель (MVP)
Сформировать монорепо со следующими частями:

- `frontend/` — Next.js 14 (App Router) + Tailwind + TypeScript
- `backend/` — FastAPI + SQLAlchemy + Alembic + Pydantic
- `infra/` — docker-compose, env templates, локальные скрипты
- `docs/` — спецификации (.md)

После выполнения:
- проект **собирается локально**
- поднятие через `docker-compose` работает
- есть шаблоны `.env.example`
- есть линтер/форматтер минимум для Python и TypeScript

---

## Constraints (обязательные ограничения)
- **Node.js**: LTS (18+ или 20+). Зафиксировать в `.nvmrc` (предпочтительно `20`).
- **Python**: 3.11. Зафиксировать в `backend/.python-version` и/или `pyproject.toml`.
- **Package manager**: `pnpm` (предпочтительно). Зафиксировать `packageManager` в корневом `package.json`.
- **Docker**: обязательно для локального запуска MVP.
- Не добавлять лишние сервисы (Redis, Kafka, etc.) — только минимум.
- Storage файлов: `storage/` в корне (монтируется в backend).

---

## Итоговая структура (должна совпасть)
Создать структуру:

```
smartanalyzer/
  README.md
  .gitignore
  .editorconfig
  .nvmrc
  docker-compose.yml
  storage/
    documents/
  docs/
    site-stack.md
    project-structure.md
  infra/
    env/
      frontend.env.example
      backend.env.example
      postgres.env.example
  frontend/
    package.json
    next.config.js
    tailwind.config.ts
    tsconfig.json
    app/
      layout.tsx
      page.tsx
      (auth)/
        login/page.tsx
        register/page.tsx
      (marketing)/
        pricing/page.tsx
        tools/page.tsx
      (app)/
        dashboard/page.tsx
    components/
      ui/
      layout/
    lib/
      api/
      auth/
      config/
    styles/
      globals.css
  backend/
    pyproject.toml
    .python-version
    alembic.ini
    alembic/
      env.py
      versions/
    app/
      main.py
      core/
        config.py
        logging.py
        security.py
      db/
        base.py
        session.py
      models/
      schemas/
      api/
        router.py
        v1/
          auth.py
          documents.py
          tools.py
          usage.py
      services/
      utils/
      tests/
```

Допускаются дополнительные файлы (например `Makefile`), но основа должна совпадать.

---

## Naming & Conventions (обязательные правила)

### Общие
- `kebab-case` для файлов в `docs/` и `infra/`
- `snake_case` для Python модулей
- `camelCase/PascalCase` для React компонентов
- Везде использовать абсолютные/alias импорты, где разумно

### Frontend
- Страницы в `frontend/app/*` по App Router
- Общие компоненты в `frontend/components/*`
- API-клиент в `frontend/lib/api/*`
- Конфиг env в `frontend/lib/config/*`

### Backend
- Входная точка: `backend/app/main.py`
- Роутер: `backend/app/api/router.py`
- Версионирование API: `backend/app/api/v1/*`
- DB сессия: `backend/app/db/session.py`
- Модели SQLAlchemy: `backend/app/models/*`
- Pydantic схемы: `backend/app/schemas/*`
- Сервисы бизнес-логики: `backend/app/services/*`

---

## Минимальный набор зависимостей (MVP)

### Frontend
- next, react, react-dom
- tailwindcss, postcss, autoprefixer
- zod (валидация)
- axios или fetch wrapper (на выбор агента; предпочтительно fetch + wrapper)
- lucide-react (иконки) — опционально
- eslint + prettier

### Backend
- fastapi
- uvicorn[standard]
- sqlalchemy
- alembic
- psycopg2-binary (или asyncpg, но в MVP проще sync psycopg2-binary)
- pydantic
- python-jose (JWT) или PyJWT
- passlib[bcrypt]
- python-multipart (для upload)
- pydantic-settings (если нужно)
- ruff (линт) + black (формат) — минимум

---

## ENV переменные (шаблоны)
Сгенерировать env templates в `infra/env/`:

### `infra/env/postgres.env.example`
- POSTGRES_DB=smartanalyzer
- POSTGRES_USER=smartanalyzer
- POSTGRES_PASSWORD=smartanalyzer

### `infra/env/backend.env.example`
- ENV=local
- DATABASE_URL=postgresql+psycopg2://smartanalyzer:smartanalyzer@postgres:5432/smartanalyzer
- JWT_SECRET=change_me
- JWT_ALGORITHM=HS256
- ACCESS_TOKEN_EXPIRE_MINUTES=60
- STORAGE_PATH=/storage/documents
- LLM_PROVIDER=openai
- OPENAI_API_KEY=

### `infra/env/frontend.env.example`
- NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

> Важно: **не класть реальные ключи**. Только `.example`.

---

## Docker Compose (MVP)
Создать `docker-compose.yml` в корне со службами:

- `postgres`
- `backend`
- `frontend`

Требования:
- `postgres` читает env из `infra/env/postgres.env.example` (или копии `.env`)
- `backend` монтирует:
  - `./backend:/app`
  - `./storage:/storage`
- `frontend` монтирует:
  - `./frontend:/app`
- Expose порты:
  - frontend: `3000:3000`
  - backend: `8000:8000`
  - postgres: `5432:5432` (опционально, но удобно)

Healthcheck для postgres — желательно.

---

## Скрипты запуска (обязательные)
В `README.md` корня добавить команды:

### Локально через Docker
- `cp infra/env/postgres.env.example infra/env/postgres.env`
- `cp infra/env/backend.env.example infra/env/backend.env`
- `cp infra/env/frontend.env.example infra/env/frontend.env`
- `docker compose up --build`

### Локально без Docker (опционально)
Frontend:
- `cd frontend && pnpm i && pnpm dev`

Backend:
- `cd backend && python -m venv .venv && source .venv/bin/activate`
- `pip install -e .`
- `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

---

## Acceptance Criteria (Definition of Done)
Считаем задачу выполненной, если:

- [ ] Структура папок соответствует разделу «Итоговая структура»
- [ ] Есть `docker-compose.yml` и он запускает 3 сервиса
- [ ] Есть `infra/env/*.env.example`
- [ ] Есть `README.md` с командами запуска
- [ ] В `storage/documents/` создается директория и монтируется в backend контейнер
- [ ] Frontend отвечает на `http://localhost:3000`
- [ ] Backend отвечает на `http://localhost:8000/health` (агент должен добавить health endpoint)
- [ ] Postgres доступен из backend по `DATABASE_URL`

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
You are implementing the SmartAnalyzer monorepo structure.

Follow docs/project-structure.md strictly.

Tasks:
1) Create the monorepo folder structure exactly as described.
2) Setup Next.js 14 + TS + Tailwind in /frontend using App Router, with placeholder pages listed in the spec.
3) Setup FastAPI backend in /backend with the folder structure listed, add /health endpoint.
4) Add PostgreSQL + docker-compose in repo root with services: postgres, backend, frontend.
5) Add env templates in /infra/env as described.
6) Update root README.md with docker setup steps.
7) Ensure `docker compose up --build` starts all services and frontend loads.

Do not add extra services (no redis/kafka). Keep MVP minimal.
```

---

## Примечания для агента (важно)
- Если что-то уже существует — **не ломай**, а приведи к структуре.
- Если ты добавляешь файлы конфигурации (eslint/prettier/ruff/black) — добавляй минимально, без усложнений.
- Не внедряй бизнес-логику инструментов здесь. Только каркас.
