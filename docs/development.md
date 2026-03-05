# development.md

## Зачем этот документ
Это «как разрабатывать SmartAnalyzer» в формате **короткого, практичного гида** для:
- агента (Cursor/Codex/Claude)
- нового разработчика
- тебя как PO/архитектора

Цель: чтобы человек **без контекста** понял:
1) **в каком порядке** внедрять фичи,
2) какие **общие правила** действуют,
3) где находится **контракт инструментов** и как он будет расширяться.

---

# 1) Структура документации в репозитории (актуально)

В проекте спеки лежат так:

- `docs/*.md` — общие спеки (инфраструктура, auth, API, ошибки, страницы, деплой)
- `docs/feature/*.md` — спеки конкретных инструментов (feature-level)

Сейчас в `docs/feature/` находятся:
- `docs/feature/document-analyzer.md`
- `docs/feature/tender-analyzer.md`
- `docs/feature/risk-analyzer.md`
(остальные инструменты могут быть в корне `docs/` или тоже переедут в `docs/feature/` — ниже указано явно по текущим путям).

---

# 2) Порядок реализации (MVP → пилот)

Ниже — рекомендуемый порядок документов.  
Каждый документ реализуется **до конца**, затем прогоняется **чеклист** из этого документа.

## 2.1 Основа репозитория и маркетинг
1) `docs/project-structure.md`  
2) `docs/landing-page.md`  
3) `docs/tools-page.md`  

**Проверка:** docker compose поднимает фронт/бэк, маркетинг-страницы работают.

> Примечание: если у тебя появится/вернётся `docs/site-stack.md`, держи его как справочный документ.
> Он **не обязателен** для разработки по спекам, если порядок и правила уже зафиксированы здесь.

## 2.2 Авторизация и общие правила API/ошибок
4) `docs/auth-system.md`  
5) `docs/api-contract.md`  
6) `docs/error-handling.md`  

**Проверка:** register/login/me, единый формат ошибок, frontend корректно обрабатывает 401/429.

## 2.3 Планы/лимиты и история
7) `docs/usage-and-plans.md`  
8) `docs/dashboard-and-history.md`  

**Проверка:** план показывается, лимиты считаются, история анализов отображается, деталка анализа открывается.

## 2.4 Первый «живой» инструмент (MVP value)
9) `docs/feature/document-analyzer.md`  

**Проверка:** документ загружается → анализируется → результат сохраняется и виден в истории.

## 2.5 Расширение инструментов (добавляем по одному)
Дальше добавляй инструменты по одному. Сейчас пути такие:

10) `docs/contract-checker.md`  
11) `docs/data-extractor.md`  
12) `docs/feature/tender-analyzer.md`  
13) `docs/feature/risk-analyzer.md`  

**Проверка:** каждый инструмент работает end-to-end и попадает в историю.

## 2.6 Деплой (показ пилотному заказчику)
14) `docs/deployment-vps.md`  

**Проверка:** домен, https, продовый compose, backend не торчит наружу.

---

# 3) Общие правила разработки (обязательные)

## 3.1 Single Source of Truth (SSOT)
- Список инструментов — только в `frontend/lib/config/tools.ts`
- Схемы ответов инструментов — в backend Pydantic schemas
- API paths — строго `/api/v1/*` (см. `docs/api-contract.md`)
- Формат ошибок — строго `{ error, message, details }` (см. `docs/error-handling.md`)

## 3.2 Нельзя «фантазировать»
Если в документе есть:
- fixed slug
- fixed response schema
- fixed file paths
— агент обязан следовать этому.

Если нужно изменить — сначала правим **спеку**, потом код.

## 3.3 Минимум зависимостей
MVP без:
- очередей (Celery/Redis)
- Kafka
- сложных observability стеков

Сначала продукт, потом инфраструктура.

---

# 4) Правила API (кратко)

## 4.1 Версионирование
- Все endpoints: `/api/v1/...`

## 4.2 Авторизация
- Bearer token: `Authorization: Bearer <token>`
- 401 → фронт делает logout + redirect `/login`

## 4.3 Инструменты (Run контракт)
- Все инструменты запускаются через **run endpoint**:
  - `POST /api/v1/tools/<tool-slug>/run`
- Тело запроса (MVP): `{ "document_id": <int> }`
- Ответ:
  - `{ "analysis_id": <int>, "tool_slug": "<slug>", "result": { ... } }`

## 4.4 Ошибки
Единый формат:
```json
{ "error": "CODE", "message": "text", "details": {} }
```

Ключевые:
- 429 `LIMIT_REACHED` → UI показывает CTA на `/pricing`
- 404 `NOT_FOUND` → не крашить, показывать пустое состояние/сообщение

---

# 5) Где будет единый контракт инструментов (когда появится)

Сейчас контракт инструментов описан по каждому инструменту в отдельных документах:

- `docs/feature/document-analyzer.md`
- `docs/contract-checker.md`
- `docs/data-extractor.md`
- `docs/feature/tender-analyzer.md`
- `docs/feature/risk-analyzer.md`

### Когда инструментов станет больше
Добавим единый файл:

- `docs/tools-contract.md` ✅ (будущий документ)

В нём будет:
- общий формат run endpoints
- единая схема хранения `result_json`
- требования к strict JSON
- стандарты полей (dates, severity, confidence)
- правила backward compatibility версий инструментов

---

# 6) Как работать с агентом (Cursor)

## 6.1 Правильный цикл
1) Выбери документ из `docs/` или `docs/feature/`
2) Скопируй блок **Prompt для Cursor**
3) Дай агенту выполнить
4) Прогони чеклист “Definition of Done”
5) Зафиксируй изменения (commit)
6) Переходи к следующему документу

## 6.2 Правило «одна фича — один документ»
Не смешивать:
- auth
- лимиты
- инструменты
в одном PR/итерации.

---

# 7) Мини-checklist перед PR (всегда)
- [ ] `docker compose up --build` работает
- [ ] основные маршруты не 404
- [ ] ошибки в формате `{error,message,details}`
- [ ] для новых endpoints обновлён `docs/api-contract.md` (если контракт менялся)
- [ ] новые инструменты добавлены в `frontend/lib/config/tools.ts` (SSOT)

---

## Prompt для Cursor (встроенный)
```
Update docs/development.md to reflect actual docs layout.

Rules:
- Paths must match current repository structure: docs/*.md and docs/feature/*.md
- Remove/avoid references to missing docs files
- Keep the step-by-step order and SSOT/API rules intact
```
