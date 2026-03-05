# deployment-vps.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: подготовить SmartAnalyzer к деплою на VPS: production docker-compose, nginx reverse proxy, HTTPS (Let's Encrypt), переменные окружения, команды обновления.

---

## Constraints
- Deployment через Docker Compose
- Один VPS (Ubuntu 22.04+)
- HTTPS через Let's Encrypt
- Никаких Kubernetes на MVP

---

## Definition of Done (Acceptance Criteria)
- [ ] Есть `docker-compose.prod.yml`
- [ ] Есть `infra/nginx/` с конфигом
- [ ] Есть инструкции в `README.md` (deploy section)
- [ ] Приложение доступно по домену через HTTPS
- [ ] Backend доступен только через nginx (не торчит наружу портом 8000)
- [ ] Postgres не торчит наружу

---

# 1) Production compose

Создать `docker-compose.prod.yml` с сервисами:
- `frontend` (Next.js production build)
- `backend` (uvicorn without reload)
- `postgres`
- `nginx`

Требования:
- `frontend` слушает внутри 3000
- `backend` внутри 8000
- наружу публикуется только 80/443 nginx
- volumes:
  - `storage:/storage` (persist uploads)
  - `pgdata:/var/lib/postgresql/data`

---

# 2) Nginx config

Создать:
- `infra/nginx/nginx.conf`
- `infra/nginx/sites/smartanalyzer.conf`

Правила:
- `/` проксировать на frontend:3000
- `/api/` проксировать на backend:8000
- добавить gzip
- добавить basic security headers

---

# 3) HTTPS

Использовать certbot (вариант 1):
- установить certbot на VPS
- получить сертификат для домена
- настроить nginx на 443
- cron/renew

Или вариант 2: dockerized certbot (допустим, но сложнее). На MVP проще системный certbot.

---

# 4) ENV production

Создать шаблон:
- `infra/env/backend.prod.env.example`
- `infra/env/frontend.prod.env.example`
- `infra/env/postgres.prod.env.example`

Backend prod:
- ENV=prod
- JWT_SECRET=strong_random
- OPENAI_API_KEY=...
- DATABASE_URL=postgresql+psycopg2://...@postgres:5432/...

Frontend prod:
- NEXT_PUBLIC_API_BASE_URL=https://<domain>/api

---

# 5) Deploy steps (README section)

Команды:
1) install docker + docker compose plugin
2) clone repo
3) copy env templates to real env
4) `docker compose -f docker-compose.prod.yml up --build -d`
5) setup nginx + certbot
6) upgrade: `git pull && docker compose -f docker-compose.prod.yml up --build -d`

---

## Prompt для Cursor (встроенный)
```
Prepare production deployment for SmartAnalyzer according to docs/deployment-vps.md.

- Create docker-compose.prod.yml with nginx reverse proxy
- Add infra/nginx configs to route / to frontend and /api to backend
- Add production env templates
- Update README with step-by-step VPS deployment instructions (Ubuntu)
Ensure only nginx exposes ports 80/443.
```
