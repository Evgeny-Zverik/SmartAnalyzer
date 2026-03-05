# document-analyzer.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: реализовать **первый реальный инструмент MVP** — **Document Analyzer** (анализ документа) end-to-end:

- Frontend: upload → analyze → показать результат
- Backend: upload → extract text → LLM → save analysis → return structured JSON
- DB: documents + analyses + usage logs
- Лимит: Free план = 3 анализа/день

> После этого SmartAnalyzer уже можно показывать как «живой продукт».

---

## Цель (MVP)
Реализовать полноценный flow:

1) Пользователь логинится  
2) Открывает `/tools/document-analyzer`  
3) Загружает PDF/DOCX  
4) Нажимает Analyze  
5) Получает результат в UI: summary, key points, risks, important dates  
6) Результат сохраняется в базе и появляется в Dashboard history (минимально)  
7) Учитывается лимит использования (3/день на Free)

---

## Constraints (обязательные ограничения)
- Никаких сложных очередей (Celery/Redis) в MVP
- Извлечение текста:
  - PDF: `pypdf` (предпочтительно) или `pdfplumber`
  - DOCX: `python-docx`
- LLM вызов: через единый сервис `services/llm_client.py`
- Ответ LLM должен быть **строго JSON** по заданной схеме
- Backend должен возвращать ошибки в понятном виде (422/400/401/429/500)
- Хранилище файлов — локально `storage/documents/` (монтируется в Docker)

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `POST /api/v1/documents/upload` принимает файл (pdf/docx), сохраняет в storage, пишет запись в `documents`
- [ ] `POST /api/v1/tools/document-analyzer/run` запускает анализ по document_id
- [ ] Извлекается текст (pdf/docx) и передается в LLM
- [ ] LLM возвращает валидный JSON согласно схеме
- [ ] Результат сохраняется в `document_analyses`
- [ ] Учитывается usage (таблица usage_logs)
- [ ] Лимит Free: максимум 3 запуска в сутки, иначе 429
- [ ] Эндпоинт `GET /api/v1/analyses/recent` (или аналог) возвращает последние анализы пользователя

### Frontend
- [ ] `/tools/document-analyzer` использует реальный API (не mock)
- [ ] Загрузка файла работает
- [ ] Analyze вызывает backend и получает JSON
- [ ] UI показывает результат секциями
- [ ] Если превышен лимит → UI показывает понятную ошибку
- [ ] Dashboard показывает хотя бы список последних анализов (минимально)

---

# 1) Backend спецификация

## 1.1 DB модели (MVP)

### documents
- id (int)
- user_id (FK users.id)
- filename (str)
- file_path (str) — абсолютный/относительный путь в storage
- mime_type (str)
- size_bytes (int)
- created_at (timestamp)

### document_analyses
- id (int)
- document_id (FK documents.id)
- user_id (FK users.id) — денормализовано для удобства
- tool_slug (str) = "document-analyzer"
- result_json (jsonb) — сырой JSON результата
- created_at (timestamp)

### usage_logs
- id (int)
- user_id (FK users.id)
- tool_slug (str)
- created_at (timestamp)

> Alembic миграции обязательны.

---

## 1.2 API Endpoints (обязательные)

### Upload
`POST /api/v1/documents/upload`

Headers:
- Authorization: Bearer <token>

Form-data:
- file: PDF or DOCX

Response 201:
```json
{
  "document_id": 123,
  "filename": "contract.pdf",
  "created_at": "..."
}
```

Ошибки:
- 400 если формат не поддерживается
- 413 если файл слишком большой (на MVP можно 20MB)

---

### Run analyzer
`POST /api/v1/tools/document-analyzer/run`

Headers:
- Authorization: Bearer <token>

Body:
```json
{
  "document_id": 123,
  "llm_config": {
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
    "model": "llama3.2"
  }
}
```
Поле `llm_config` опционально. Если передано — backend использует указанные `base_url`, `api_key`, `model` для вызова LLM вместо переменных окружения. Любое из полей внутри `llm_config` можно опустить (тогда берётся значение из env).

Response 200:
```json
{
  "analysis_id": 456,
  "tool_slug": "document-analyzer",
  "result": {
    "summary": "...",
    "key_points": ["..."],
    "risks": ["..."],
    "important_dates": [
      { "date": "2026-03-01", "description": "..." }
    ]
  }
}
```

Ошибки:
- 401 если нет auth
- 404 если document не найден или не принадлежит user
- 429 если превышен дневной лимит
- 500 если LLM/парсинг

---

### Recent analyses
`GET /api/v1/analyses/recent?limit=20`

Response 200:
```json
[
  {
    "analysis_id": 456,
    "tool_slug": "document-analyzer",
    "filename": "contract.pdf",
    "created_at": "..."
  }
]
```

---

## 1.3 Сервисы backend (обязательные)

### Text extraction
Файл: `backend/app/services/text_extraction.py`

Функции:
- `extract_text_from_pdf(path: str) -> str`
- `extract_text_from_docx(path: str) -> str`
- `extract_text(path: str, mime_type: str) -> str`

Требования:
- ограничить длину текста (например, до 60k символов) чтобы не убивать LLM
- если текст пустой → 400

---

### LLM client
Файл: `backend/app/services/llm_client.py`

Функция:
- `analyze_document(text: str, overrides: dict | None = None) -> dict`

Требования:
- единая точка вызова LLM
- prompt должен требовать **строгий JSON**
- таймаут и обработка ошибок
- если передан `overrides` с ключами `base_url`, `api_key`, `model` — они подменяют значения из env (OpenAI-совместимый API, в т.ч. локальный Ollama)

ENV (используются, если не переданы в overrides):
- OPENAI_API_KEY=...
- OPENAI_BASE_URL=... (опционально)
- OPENAI_MODEL=... (по умолчанию gpt-4o-mini)

---

### Usage / Limits
Файл: `backend/app/services/usage.py`

Функции:
- `count_today_runs(user_id, tool_slug) -> int`
- `assert_can_run(user_id, tool_slug, limit_per_day=3)` → throws HTTPException(429)
- `log_usage(user_id, tool_slug)`

Логика:
- “сегодня” считать по UTC или локально; в MVP можно UTC.
- лимит 3 в день только для tool_slug document-analyzer (пока).

---

## 1.4 Prompt (LLM) — обязательный формат

LLM должен возвращать JSON строго по схеме:

```json
{
  "summary": "string",
  "key_points": ["string"],
  "risks": ["string"],
  "important_dates": [
    { "date": "YYYY-MM-DD", "description": "string" }
  ]
}
```

Правила:
- key_points 3–10
- risks 0–10
- important_dates 0–10
- если дат нет → []

---

# 2) Frontend спецификация

## 2.1 API integration
Обновить/создать в `frontend/lib/api`:

- `documents.ts`
  - `uploadDocument(file) -> { document_id }`
- `tools.ts`
  - `runDocumentAnalyzer(document_id) -> result`
- `analyses.ts`
  - `getRecentAnalyses(limit) -> list`

Все вызовы используют Authorization header из localStorage token.

---

## 2.2 Tool page UI
Страница: `frontend/app/(marketing)/tools/document-analyzer/page.tsx`  
(или если уже в `[slug]`, то special-case slug)

UI блоки:
- UploadDropzone (уже есть)
- Button Analyze
- ResultsPanel

Логика:
- upload → сохранить document_id
- analyze → POST run
- success → показать секции

Ошибки:
- 429 → показать: `Daily limit reached. Upgrade to Pro.`
- 400 → `Cannot read text from document.`
- 500 → `Analysis failed, try again.`

---

## 2.4 Настройки LLM (локальная модель / API)

На странице Document Analyzer слева от кнопки «Analyze» отображается кнопка-шестерёнка (Settings). По клику открывается попап «Настройки LLM» с двумя вкладками:

**Вкладка «Локальная модель»**
- Base URL — адрес OpenAI-совместимого API (по умолчанию `http://localhost:11434/v1` для Ollama).
- Модель — имя модели (по умолчанию `llama3.2`).
- Для Ollama API key не обязателен (можно оставить placeholder).

**Вкладка «API»**
- Base URL — по умолчанию `https://api.openai.com/v1`.
- API Key — ключ провайдера.
- Модель — по умолчанию `gpt-4o-mini`.

Выбранные значения сохраняются в localStorage (ключ `smartanalyzer_llm_config`) и при нажатии «Analyze» передаются в теле запроса `POST /api/v1/tools/document-analyzer/run` в поле `llm_config`. Если пользователь не открывал настройки — используется конфигурация backend из env.

Компоненты:
- `frontend/components/tools/LLMSettingsModal.tsx` — попап с табами и сохранением.
- В `tools/[slug]/page.tsx` кнопка-шестерёнка и модалка показываются только при `tool.slug === "document-analyzer"`.

---

## 2.3 Dashboard history (минимум)
Страница: `/dashboard`
Добавить блок:
- `Recent analyses`
- список (filename + created_at)

API: `/api/v1/analyses/recent`

---

# 3) Files to create/update (обязательные)

## Backend
- `backend/app/models/document.py`
- `backend/app/models/document_analysis.py`
- `backend/app/models/usage_log.py`
- `backend/app/schemas/documents.py`
- `backend/app/schemas/analyses.py`
- `backend/app/api/v1/documents.py`
- `backend/app/api/v1/tools.py` (или отдельный `document_analyzer.py`)
- `backend/app/api/v1/analyses.py`
- `backend/app/services/text_extraction.py`
- `backend/app/services/llm_client.py`
- `backend/app/services/usage.py`
- Alembic migrations: create documents, document_analyses, usage_logs

## Frontend
- `frontend/lib/api/documents.ts`
- `frontend/lib/api/tools.ts` (заменить mock для document-analyzer на real)
- `frontend/lib/api/analyses.ts`
- Update tool page for `document-analyzer` to use real API
- Update dashboard page to show recent analyses

---

# 4) Чеклист реализации (пошагово)

## Backend
- [ ] создать модели и миграции (documents, document_analyses, usage_logs)
- [ ] реализовать upload endpoint (validation pdf/docx, size limit)
- [ ] реализовать text extraction сервис
- [ ] реализовать LLM client и prompt на strict JSON
- [ ] реализовать usage limit сервис (3/day)
- [ ] реализовать run endpoint:
  - проверить owner документа
  - проверить лимит
  - извлечь текст
  - вызвать LLM
  - сохранить result_json
  - log usage
  - вернуть result
- [ ] реализовать recent analyses endpoint

## Frontend
- [ ] реализовать uploadDocument → backend
- [ ] runDocumentAnalyzer → backend
- [ ] обновить `/tools/document-analyzer` UI flow (upload → analyze)
- [ ] показать результаты в ResultsPanel
- [ ] показать ошибки (429/400/500)
- [ ] dashboard: recent analyses list

---

# 5) QA сценарии (ручные)
1) login
2) upload pdf
3) analyze → success
4) refresh page → результат не обязан сохраняться в UI, но recent analyses должен показать запись
5) запустить анализ 4 раза за день → 4-й должен дать 429
6) чужой document_id → 404

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SmartAnalyzer Document Analyzer end-to-end according to docs/document-analyzer.md.

Backend:
- Add DB models and Alembic migrations: documents, document_analyses, usage_logs
- Implement POST /api/v1/documents/upload (pdf/docx only, store in /storage/documents)
- Implement text extraction service for pdf/docx
- Implement LLM client service with strict JSON output schema
- Implement usage limit service (3 runs/day for free)
- Implement POST /api/v1/tools/document-analyzer/run (check ownership, enforce limit, analyze, save result_json, log usage)
- Implement GET /api/v1/analyses/recent

Frontend:
- Replace mock tool call for document-analyzer with real API calls
- Implement upload → analyze flow, display results sections
- Handle errors (429, 400, 500) with clear UI messages
- Show recent analyses on /dashboard

Keep MVP minimal. No queues, no extra infra.
```
