# usage-and-plans.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: внедрить SaaS-логику планов и лимитов в SmartAnalyzer так, чтобы:
- Free план был ограничен (3 запуска/день на инструмент),
- Pro снимал лимиты,
- UI показывал текущий план и остаток лимита,
- Backend имел единый механизм проверки лимитов для всех инструментов.

> После этого можно добавлять новые инструменты по одному, просто подключая лимит-чек.

---

## Цель (MVP)
Реализовать:

### Backend
- хранение плана пользователя (`users.plan`)
- единый сервис лимитов:
  - `assert_can_run(user, tool_slug)`
- endpoints:
  - `GET /api/v1/usage/status` — статус лимитов
  - `POST /api/v1/billing/upgrade` — MVP-заглушка апгрейда на Pro
- лимиты:
  - Free: 3 runs/day per tool
  - Pro: unlimited

### Frontend
- dashboard виджет:
  - plan badge
  - “runs left today” по инструменту
- pricing CTA:
  - кнопка Upgrade (MVP заглушка) → меняет plan на Pro
- обработка 429 и отображение “Upgrade to Pro”

---

## Constraints (обязательные ограничения)
- Не интегрировать реальные платежи на этом этапе.
- Апгрейд — простая серверная заглушка, меняющая `users.plan = "pro"`.
- Лимиты считать по UTC дню (MVP).
- Не добавлять внешние сервисы (Stripe/ЮKassa) на этом этапе.

---

## Definition of Done (Acceptance Criteria)
Считаем документ выполненным, если:

### Backend
- [ ] В `users` добавлено поле `plan` со значениями `free|pro|enterprise`
- [ ] `GET /api/v1/usage/status` возвращает лимиты и usage
- [ ] `POST /api/v1/billing/upgrade` меняет план на `pro` (для текущего юзера)
- [ ] `assert_can_run` учитывает план (free ограничен, pro без лимита)
- [ ] Все tool-run endpoints (минимум document-analyzer) используют общий механизм лимитов
- [ ] 429 ошибка возвращает код и полезное сообщение

### Frontend
- [ ] Dashboard показывает текущий план и лимит
- [ ] На pricing странице есть кнопка Upgrade → становится Pro
- [ ] После upgrade лимит исчезает/становится unlimited
- [ ] UI корректно показывает сообщения при 429

---

# 1) Backend спецификация

## 1.1 План пользователя
Добавить поле в модель User:

- `plan: str` default `"free"`

Допустимые значения:
- `free`
- `pro`
- `enterprise` (пока не используется, но зарезервировано)

Alembic миграция обязательна.

---

## 1.2 Usage модель (уже может быть создана)
Используем таблицу `usage_logs`:

- id
- user_id
- tool_slug
- created_at

Считаем usage за текущие сутки (UTC):

- from 00:00 UTC to 23:59:59 UTC

---

## 1.3 Rules лимитов (MVP)
Лимиты задаются кодом (позже вынесем в конфиг):

- Free:
  - `3` запуска в сутки **на каждый tool_slug**
- Pro:
  - unlimited
- Enterprise:
  - unlimited (MVP)

---

## 1.4 Services: limits
Файл: `backend/app/services/usage.py` (или новый `limits.py`)

Реализовать:

```py
def get_plan_limits(plan: str) -> dict:
    # returns { "daily_runs_per_tool": 3 or None }

def count_runs_today(user_id: int, tool_slug: str) -> int:
    # SQL query for today UTC

def assert_can_run(user, tool_slug: str) -> None:
    # if plan free and count >= 3 -> raise HTTPException(429, detail=...)

def log_run(user_id: int, tool_slug: str) -> None:
    # insert usage log
```

Detail для 429 должен быть структурированный:

```json
{
  "error": "LIMIT_REACHED",
  "message": "Daily limit reached for this tool.",
  "tool_slug": "document-analyzer",
  "plan": "free",
  "limit_per_day": 3
}
```

---

## 1.5 Endpoint: usage status

`GET /api/v1/usage/status`

Headers:
Authorization Bearer

Response 200 example:

```json
{
  "plan": "free",
  "limits": {
    "daily_runs_per_tool": 3
  },
  "usage_today": {
    "document-analyzer": 2,
    "contract-checker": 0,
    "data-extractor": 0,
    "tender-analyzer": 0,
    "risk-analyzer": 0
  }
}
```

Требования:
- tool list должен включать 5 инструментов
- даже если usage 0, вернуть ключ

---

## 1.6 Endpoint: upgrade (MVP stub)

`POST /api/v1/billing/upgrade`

Headers:
Authorization Bearer

Body:
```json
{ "plan": "pro" }
```

Rules:
- разрешить только "pro" (на MVP)
- установить user.plan = "pro"
- вернуть `{ "plan": "pro" }`

---

## 1.7 Подключение к tool endpoints
Минимум: endpoint Document Analyzer run должен:

- `assert_can_run(user, tool_slug)`
- в конце `log_run`

> Позже все инструменты будут подключены так же.

---

# 2) Frontend спецификация

## 2.1 API
Создать/обновить:

- `frontend/lib/api/usage.ts`
  - `getUsageStatus()`
- `frontend/lib/api/billing.ts`
  - `upgradePlan(plan: "pro")`

---

## 2.2 Dashboard UI
На `/dashboard` добавить карточку:

Title: `Plan`
- badge: Free/Pro
- text: `Runs left today (Document Analyzer): X` (если free)
- если pro: `Unlimited`

Также можно показать таблицу usage по всем 5 инструментам (опционально).

---

## 2.3 Pricing UI (upgrade)
На `/pricing`:
- на карточке Pro:
  - button `Upgrade to Pro`
  - on click:
    - call `upgradePlan("pro")`
    - затем refetch `getUsageStatus()`
    - показать успех

---

## 2.4 Обработка 429
Если при запуске инструмента backend вернул 429 с `LIMIT_REACHED`:

- ResultsPanel / Alert должен показать:
  - `Daily limit reached. Upgrade to Pro.`
  - CTA кнопка → `/pricing`

---

# 3) Files to create/update (обязательные)

## Backend
- Alembic migration: add users.plan
- `backend/app/services/usage.py` (добавить plan logic)
- `backend/app/api/v1/usage.py`
- `backend/app/api/v1/billing.py`
- Update router includes

## Frontend
- `frontend/lib/api/usage.ts`
- `frontend/lib/api/billing.ts`
- Update `frontend/app/(app)/dashboard/page.tsx`
- Update `frontend/app/(marketing)/pricing/page.tsx`
- Update tool run error handling (document-analyzer page or shared handler)

---

# 4) Чеклист реализации (пошагово)

## Backend
- [ ] добавить `plan` в User модель + migration
- [ ] расширить usage service: plan limits + structured 429
- [ ] реализовать `/api/v1/usage/status`
- [ ] реализовать `/api/v1/billing/upgrade` (stub)
- [ ] подключить `assert_can_run` и `log_run` в document-analyzer run
- [ ] smoke test: free лимит работает, pro снимает

## Frontend
- [ ] реализовать API usage/billing
- [ ] dashboard: показать plan и runs left
- [ ] pricing: кнопка upgrade и обновление статуса
- [ ] при 429: показать сообщение и CTA на pricing

---

# 5) QA сценарии (ручные)
1) зарегистрируйся → plan должен быть free
2) запусти document-analyzer 3 раза → ок
3) 4-й раз → 429 и UI сообщение
4) нажми upgrade → plan pro
5) снова запусти анализ → без лимита
6) dashboard показывает Unlimited

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SaaS plans and usage limits according to docs/usage-and-plans.md.

Backend:
- Add users.plan (free|pro|enterprise), default free + Alembic migration
- Implement plan-aware limits (free: 3 runs/day per tool; pro: unlimited)
- Provide GET /api/v1/usage/status returning plan, limits, usage_today for 5 tools
- Provide POST /api/v1/billing/upgrade stub to set current user to pro
- Ensure tool run endpoints use assert_can_run + log_run and return structured 429 LIMIT_REACHED

Frontend:
- Add API clients for usage and billing upgrade
- Show plan + runs left on dashboard
- Add Upgrade button on pricing that upgrades to pro and refreshes status
- When receiving 429 LIMIT_REACHED show clear message + CTA to /pricing

Keep MVP minimal. No real payments yet.
```
