# api-contract.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: зафиксировать **единый контракт API** SmartAnalyzer (эндпоинты, форматы запросов/ответов, ошибки), чтобы frontend/backend не расходились.

После внедрения:
- фронт и бэк используют один формат
- ошибки всегда одинаковые
- базовая версия API: `/api/v1`

---

## Constraints
- Все эндпоинты версии: `/api/v1/*`
- Auth: `Authorization: Bearer <token>`
- JSON ответы: `application/json; charset=utf-8`
- Upload: `multipart/form-data`

---

## Definition of Done (Acceptance Criteria)
- [ ] Все перечисленные эндпоинты существуют (или заглушки, если явно помечено)
- [ ] Форматы запросов/ответов соответствуют описанию
- [ ] Ошибки возвращаются в едином формате (см. `error-handling.md`)
- [ ] OpenAPI (Swagger) в FastAPI отражает эти схемы (Pydantic models)

---

# 1) Базовые эндпоинты

## Health
### `GET /health`
Response 200:
```json
{ "status": "ok" }
```

---

# 2) Auth

## Register
### `POST /api/v1/auth/register`
Body:
```json
{ "email": "user@example.com", "password": "secret123" }
```
Response 201:
```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-03-04T10:00:00Z", "plan": "free" }
```

## Login
### `POST /api/v1/auth/login`
Body:
```json
{ "email": "user@example.com", "password": "secret123" }
```
Response 200:
```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

## Me
### `GET /api/v1/auth/me`
Response 200:
```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-03-04T10:00:00Z", "plan": "free" }
```

---

# 3) Documents

## Upload
### `POST /api/v1/documents/upload`
Headers:
- Authorization: Bearer
Form-data:
- file: PDF/DOCX/XLSX
Response 201:
```json
{
  "document_id": 123,
  "filename": "file.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "created_at": "2026-03-04T10:00:00Z"
}
```

## List
### `GET /api/v1/documents?limit=20&offset=0&q=`
Response 200:
```json
{
  "items": [
    { "document_id": 123, "filename": "file.pdf", "created_at": "2026-03-04T10:00:00Z" }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

# 4) Tools Run (единый формат)

> Все run-эндпоинты принимают `{ "document_id": <int> }` и возвращают `{ analysis_id, tool_slug, result }`.

## Document Analyzer
### `POST /api/v1/tools/document-analyzer/run`
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
`llm_config` опционально. Поля внутри: `base_url`, `api_key`, `model` (все опциональны). Если переданы — используются вместо env при вызове LLM.
Response 200:
```json
{
  "analysis_id": 456,
  "tool_slug": "document-analyzer",
  "result": {
    "summary": "string",
    "key_points": ["string"],
    "risks": ["string"],
    "important_dates": [
      { "date": "YYYY-MM-DD", "description": "string" }
    ]
  }
}
```

## Contract Checker
### `POST /api/v1/tools/contract-checker/run`
Response 200:
```json
{
  "analysis_id": 789,
  "tool_slug": "contract-checker",
  "result": {
    "summary": "string",
    "risky_clauses": [
      { "title": "string", "reason": "string", "severity": "low|medium|high" }
    ],
    "penalties": [
      { "trigger": "string", "amount_or_formula": "string" }
    ],
    "obligations": [
      { "party": "buyer|seller|client|contractor|other", "text": "string" }
    ],
    "deadlines": [
      { "date": "YYYY-MM-DD", "description": "string" }
    ],
    "checklist": [
      { "item": "string", "status": "ok|warn|missing", "note": "string" }
    ]
  }
}
```

## Data Extractor
### `POST /api/v1/tools/data-extractor/run`
Response 200:
```json
{
  "analysis_id": 111,
  "tool_slug": "data-extractor",
  "result": {
    "fields": [ { "key": "string", "value": "string" } ],
    "tables": [ { "name": "Table 1", "rows": [["c1","c2"],["v1","v2"]] } ],
    "confidence": 0.0
  }
}
```

## Tender Analyzer
### `POST /api/v1/tools/tender-analyzer/run`
Response 200:
```json
{
  "analysis_id": 222,
  "tool_slug": "tender-analyzer",
  "result": {
    "summary": "string",
    "requirements": [
      { "id": "REQ-1", "text": "string", "type": "doc|tech|finance|legal" }
    ],
    "compliance_checklist": [
      { "item": "string", "status": "required|optional|unknown", "note": "string" }
    ],
    "deadlines": [
      { "date": "YYYY-MM-DD", "description": "string" }
    ],
    "risks": [
      { "title": "string", "severity": "low|medium|high", "reason": "string" }
    ]
  }
}
```

## Risk Analyzer
### `POST /api/v1/tools/risk-analyzer/run`
Response 200:
```json
{
  "analysis_id": 333,
  "tool_slug": "risk-analyzer",
  "result": {
    "risk_score": 0,
    "confidence": 0.0,
    "key_risks": [
      { "title": "string", "severity": "low|medium|high", "reason": "string" }
    ],
    "risk_drivers": [
      { "driver": "string", "impact": "low|medium|high", "evidence": "string" }
    ],
    "recommendations": [
      { "action": "string", "priority": "low|medium|high", "note": "string" }
    ]
  }
}
```

---

# 5) Analyses

## List analyses
### `GET /api/v1/analyses?limit=20&offset=0&tool_slug=&q=`
Response 200:
```json
{
  "items": [
    {
      "analysis_id": 456,
      "tool_slug": "document-analyzer",
      "document_id": 123,
      "filename": "file.pdf",
      "created_at": "2026-03-04T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

## Recent analyses
### `GET /api/v1/analyses/recent?limit=20`
Response 200:
```json
[
  {
    "analysis_id": 456,
    "tool_slug": "document-analyzer",
    "filename": "file.pdf",
    "created_at": "2026-03-04T10:00:00Z"
  }
]
```

## Detail analysis
### `GET /api/v1/analyses/{analysis_id}`
Response 200:
```json
{
  "analysis_id": 456,
  "tool_slug": "document-analyzer",
  "document": { "document_id": 123, "filename": "file.pdf" },
  "created_at": "2026-03-04T10:00:00Z",
  "result": { }
}
```

---

# 6) Usage & Billing (MVP stubs)

## Usage status
### `GET /api/v1/usage/status`
Response 200:
```json
{
  "plan": "free",
  "limits": { "daily_runs_per_tool": 3 },
  "usage_today": {
    "document-analyzer": 0,
    "contract-checker": 0,
    "data-extractor": 0,
    "tender-analyzer": 0,
    "risk-analyzer": 0
  }
}
```

## Upgrade (stub)
### `POST /api/v1/billing/upgrade`
Body:
```json
{ "plan": "pro" }
```
Response 200:
```json
{ "plan": "pro" }
```

---

## Prompt для Cursor (встроенный)
```
Align backend FastAPI endpoints and Pydantic schemas with docs/api-contract.md.
Ensure all endpoints exist and responses match the specified JSON shapes.
Errors must follow the unified format described in docs/error-handling.md.
Update frontend API client calls to use /api/v1 base paths consistently.
```
