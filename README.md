# SmartAnalyzer

Монорепо: Next.js (frontend), FastAPI (backend), PostgreSQL.

## Локально через Docker

```bash
cp infra/env/postgres.env.example infra/env/postgres.env
cp infra/env/backend.env.example infra/env/backend.env
cp infra/env/frontend.env.example infra/env/frontend.env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health: http://localhost:8000/health

## Локально без Docker

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
