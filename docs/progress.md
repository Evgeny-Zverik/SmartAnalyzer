# Прогресс реализации SmartAnalyzer

Отмечай выполненное галочкой `[x]`. Следующая задача — первый пункт с `[ ]`.

**Следующая задача:** шаг 8 (dashboard-and-history.md — список анализов, деталка).

---

## 2.1 Основа репозитория и маркетинг

- [x] 1) `docs/project-structure.md` — структура монорепо, docker, env
  - [x] Структура папок соответствует «Итоговая структура»
  - [x] Есть `docker-compose.yml`, запускает 3 сервиса
  - [x] Есть `infra/env/*.env.example`
  - [x] Есть `README.md` с командами запуска
  - [x] `storage/documents/` создаётся и монтируется в backend
  - [x] Frontend на http://localhost:3000
  - [x] Backend на http://localhost:8000/health
  - [x] Postgres доступен из backend по DATABASE_URL

- [x] 2) `docs/landing-page.md` — лендинг, /tools, /pricing
  - [x] `frontend/lib/config/tools.ts` с 5 инструментами, используется на `/` и `/tools`
  - [x] Общий layout, Header/Footer на маркетинговых страницах
  - [x] Страницы: page.tsx, tools/page.tsx, pricing/page.tsx, tools/[slug]/page.tsx
  - [x] Hero, Tools Preview (5), How it works (3), Features (6), Pricing Preview (3), Final CTA, Footer
  - [x] Tools page: заголовок, подзаголовок, search input, grid карточек, Open tool
  - [x] Tool stub: title, description, «What you get», CTA Try it
  - [x] Pricing: тарифы, CTA кнопки
  - [ ] Ручная проверка: /, /tools, /pricing, /tools/document-analyzer, мобилка

- [x] 3) `docs/tools-page.md` — каталог инструментов, UI страниц инструментов (mock)
  - [x] `tools.ts`: category, icon, mvp.accepts, mvp.output, getToolBySlug(slug)
  - [x] Каталог /tools: поиск, фильтр по category, 5 карточек, empty state + reset
  - [x] Страницы /tools/[slug]: ToolShell, UploadDropzone, ResultsPanel, state-machine, mock runToolAnalysis
  - [x] UI: responsive, отступы/шрифты, hover/focus
  - [ ] QA: поиск, фильтры, pdf/docx принимаются, loading→success, mock results, все 5 инструментов

**Проверка:** docker compose поднимает фронт/бэк, маркетинг-страницы работают.

---

## 2.2 Авторизация и общие правила API/ошибок

- [x] 4) `docs/auth-system.md` — регистрация, логин, JWT, guard
  - [x] Backend: POST /auth/register, POST /auth/login, GET /auth/me
  - [x] Пароль хеш, 401 при неверном логине, миграции, таблица users
  - [x] Frontend: /register, /login → /dashboard; /dashboard защищён; logout → /
  - [x] Ошибки отображаются

- [x] 5) `docs/api-contract.md` — единый контракт эндпоинтов
  - [x] Все перечисленные эндпоинты существуют
  - [x] Форматы запросов/ответов соответствуют описанию
  - [x] Ошибки в едином формате (error-handling.md)
  - [x] OpenAPI (Swagger) отражает схемы

- [x] 6) `docs/error-handling.md` — формат ошибок, parseApiError, CTA 401/429
  - [x] Backend: формат {error, message, details}, raise_error + exception handlers
  - [x] Frontend: parseApiError, isUnauthorized, isLimitReached
  - [x] Tool pages: лимит → CTA на /pricing; 401 → logout + redirect; 422 читаемо

**Проверка:** register/login/me, единый формат ошибок, frontend обрабатывает 401/429.

---

## 2.3 Планы/лимиты и история

- [x] 7) `docs/usage-and-plans.md` — планы free/pro, лимиты 3/день, upgrade stub
  - [x] Backend: users.plan, usage/status, billing/upgrade stub, assert_can_run, log_run, 429
  - [x] Подключить лимиты в document-analyzer run
  - [x] Frontend: API usage/billing, dashboard plan + runs left, pricing Upgrade, 429 → сообщение + CTA

- [ ] 8) `docs/dashboard-and-history.md` — список анализов, деталка, фильтры, Download JSON
  - [ ] Backend: GET /analyses (filters, pagination), GET /analyses/{id}, GET /documents
  - [ ] Frontend: analyses API client, таблица + фильтры + пагинация
  - [ ] Detail view (modal/page) с рендером по tool_slug
  - [ ] Download JSON

**Проверка:** план и лимиты отображаются, история анализов и деталка работают.

---

## 2.4 Первый «живой» инструмент

- [ ] 9) `docs/feature/document-analyzer.md` — upload, run, LLM, сохранение в историю
  - [ ] Backend: модели + миграции (documents, document_analyses, usage_logs)
  - [ ] Upload endpoint, text extraction, LLM client + strict JSON, usage limit (3/day), run endpoint, recent analyses
  - [ ] Frontend: uploadDocument, runDocumentAnalyzer → backend, /tools/document-analyzer flow, ResultsPanel, ошибки, dashboard recent list

**Проверка:** документ загружается → анализируется → результат в истории.

---

## 2.5 Расширение инструментов

- [ ] 10) `docs/contract-checker.md`
  - [ ] Backend: Pydantic schema, check_contract в llm_client, endpoint run, limits, save analysis
  - [ ] Frontend: runContractChecker, page upload→analyze→render, severity + checklist UI, ошибки

- [ ] 11) `docs/data-extractor.md`
  - [ ] Backend: DataExtractorResult schema, extract_structured_data, xlsx helper, run + limits + save
  - [ ] Frontend: runDataExtractor, UI fields/tables, Copy/Download JSON, ошибки

- [ ] 12) `docs/feature/tender-analyzer.md`
  - [ ] Backend: Pydantic schema, llm_client.analyze_tender, endpoint run, limits + store
  - [ ] Frontend: API function, UI sections (requirements, checklist, deadlines, risks), errors

- [ ] 13) `docs/feature/risk-analyzer.md`
  - [ ] Backend: Pydantic schema, llm_client.analyze_risk, endpoint run, limits + store
  - [ ] Frontend: API function, UI (score + lists), errors

**Проверка:** каждый инструмент работает end-to-end и попадает в историю.

---

## 2.6 Деплой

- [ ] 14) `docs/deployment-vps.md` — prod compose, nginx, HTTPS
  - [ ] docker-compose.prod.yml
  - [ ] infra/nginx/ с конфигом
  - [ ] README deploy section
  - [ ] Приложение по домену через HTTPS
  - [ ] Backend только через nginx, Postgres не наружу

**Проверка:** домен, https, backend не торчит наружу.
