# SmartAnalyzer

<p align="center">
  <strong>AI-анализ документов и данных для бизнеса</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python" alt="Python" />
</p>

<p align="center">
  Загружайте документы — получайте структурированные выводы, риски и ключевые даты за минуты.
</p>

---

## О проекте

**SmartAnalyzer** — это SaaS-платформа для интеллектуального анализа документов и данных. ИИ извлекает инсайты, проверяет договоры, оценивает риски и превращает неструктурированные файлы в готовые отчёты и структурированные данные.

- **Безопасно** — данные под вашим контролем  
- **Быстро** — результат за минуты, не за дни  
- **Для бизнеса** — тарифы, лимиты, экспорт в JSON и таблицы  

---

## Инструменты

| Инструмент | Описание |
|------------|----------|
| **Анализатор документов** | Структурированные выводы, риски, ключевые даты и стороны по любому документу |
| **Проверка договоров** | Соответствие, риски, отсутствующие пункты, чек-лист по типу договора |
| **Извлечение данных** | Поля и таблицы из документов → JSON, XLSX, копирование в буфер |
| **Анализатор тендеров** | Требования, критерии, дедлайны, оценка рисков по тендерной документации |
| **Анализатор рисков** | Оценка и скоринг рисков в документах и бизнес-процессах |

---

## Стек

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS  
- **Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic  
- **БД:** PostgreSQL  
- **Инфраструктура:** Docker Compose, env-шаблоны в `infra/env/`  

---

## Быстрый старт

### Локально через Docker

```bash
cp infra/env/postgres.env.example infra/env/postgres.env
cp infra/env/backend.env.example infra/env/backend.env
cp infra/env/frontend.env.example infra/env/frontend.env
docker compose up --build
```

- **Frontend:** http://localhost:3000  
- **Backend:** http://localhost:8000  
- **Health:** http://localhost:8000/health  
- В `docker compose` для разработки включён auto-reload: изменения в `backend/` и `frontend/` должны подхватываться без ручного рестарта контейнеров.

### Production через Docker

Для продакшена используйте отдельный compose-файл:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Он запускает frontend через `next build` + `next start`, backend без `--reload` и не монтирует исходники приложения внутрь контейнеров. Скрипты `scripts/deploy.sh` и `scripts/deploy-remote.sh` по умолчанию используют этот production compose.

### Локально без Docker

**Frontend:**

```bash
cd frontend && pnpm i && pnpm dev
```

**Backend:**

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

PostgreSQL должен быть запущен отдельно; в `infra/env/backend.env` укажи `DATABASE_URL` на локальный инстанс.

---

## Структура репозитория

```
SmartAnalyzer/
├── frontend/          # Next.js, маркетинг + приложение
├── backend/           # FastAPI, API, БД, сервисы
├── docs/              # Спецификации и прогресс
├── infra/env/         # Шаблоны .env
├── storage/documents/ # Файлы документов (монтируется в backend)
└── docker-compose.yml
```

Подробнее — в [docs/project-structure.md](docs/project-structure.md) и [docs/progress.md](docs/progress.md).

---

## Лицензия

Private. Все права защищены.
