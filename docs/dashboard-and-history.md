# dashboard-and-history.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: сделать Dashboard SmartAnalyzer реально полезным для пользователя:
- история запусков по всем инструментам
- просмотр результата анализа (detail view)
- быстрые действия: открыть инструмент, скачать JSON
- базовые фильтры: инструмент, дата, поиск по имени файла

---

## Цель (MVP)
Реализовать:

### Backend
- `GET /api/v1/analyses` — список анализов пользователя (pagination/filters)
- `GET /api/v1/analyses/{analysis_id}` — детали анализа (result_json)
- `GET /api/v1/documents` — список документов пользователя (минимум для UI)
- (опционально) `DELETE /api/v1/documents/{id}` — удалить документ + файл (на MVP можно не делать)

### Frontend
- `/dashboard`:
  - таблица “Analyses history”
  - фильтр tool + search filename
  - просмотр деталей в модалке/странице
  - кнопка “Download JSON”
- `/dashboard/analyses/[id]` (или modal) — detail view результата

---

## Constraints
- No complex BI charts в MVP
- Данные выводим из `document_analyses.result_json`
- Фильтрация на backend предпочтительна, но на MVP допустим hybrid (часть на фронте)

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `GET /api/v1/analyses` возвращает список анализов пользователя, включая filename, tool_slug, created_at
- [ ] `GET /api/v1/analyses/{id}` возвращает детальный result_json
- [ ] 404 если analysis не принадлежит пользователю
- [ ] (минимум) `limit` и `offset` поддерживаются

### Frontend
- [ ] Dashboard показывает список анализов
- [ ] Можно отфильтровать по tool_slug
- [ ] Можно искать по имени файла
- [ ] Можно открыть детали анализа и увидеть result sections
- [ ] Можно скачать JSON результата
- [ ] UI работает для всех 5 инструментов (даже если некоторые ещё не запущены)

---

# 1) Backend спецификация

## 1.1 List analyses endpoint
`GET /api/v1/analyses?limit=20&offset=0&tool_slug=&q=`

Headers:
Authorization Bearer

Response 200:
```json
{
  "items": [
    {
      "analysis_id": 456,
      "tool_slug": "document-analyzer",
      "document_id": 123,
      "filename": "contract.pdf",
      "created_at": "..."
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Filters:
- `tool_slug` optional
- `q` optional (search in filename, case-insensitive)

---

## 1.2 Analysis detail endpoint
`GET /api/v1/analyses/{analysis_id}`

Response 200:
```json
{
  "analysis_id": 456,
  "tool_slug": "document-analyzer",
  "document": {
    "document_id": 123,
    "filename": "contract.pdf"
  },
  "created_at": "...",
  "result": { ... }   // from result_json
}
```

Security:
- ensure analysis.user_id == current_user.id else 404

---

## 1.3 Documents list endpoint (минимум)
`GET /api/v1/documents?limit=20&offset=0&q=`

Response 200:
```json
{
  "items": [
    { "document_id": 123, "filename": "contract.pdf", "created_at": "..." }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

# 2) Frontend спецификация

## 2.1 API clients
Create:
- `frontend/lib/api/analyses.ts`
  - `listAnalyses({limit, offset, toolSlug, q})`
  - `getAnalysis(id)`
- `frontend/lib/api/documents.ts` (if not already)
  - `listDocuments(...)` (optional in this doc)

---

## 2.2 Dashboard layout
Page: `frontend/app/(app)/dashboard/page.tsx`

Sections (order):
1) Plan widget (if exists from usage-and-plans)
2) Analyses history (main)

Analyses table columns:
- Tool
- Filename
- Created
- Actions (View / Download JSON / Open tool)

Filters row:
- tool dropdown (All + 5 tools)
- search input (filename)

Pagination:
- Next/Prev buttons (limit=20)

---

## 2.3 Analysis detail view
Option A (recommended MVP): modal dialog inside dashboard.
Option B: separate page `/dashboard/analyses/[id]`.

Detail UI should render based on `tool_slug`:

- document-analyzer: summary, key_points, risks, important_dates
- contract-checker: summary, risky_clauses, penalties, obligations, deadlines, checklist
- data-extractor: fields, tables, confidence
- tender-analyzer: summary, requirements, compliance_checklist, deadlines, risks
- risk-analyzer: risk_score, confidence, key_risks, drivers, recommendations

Implementation tip:
Create renderer map:
`components/analyses/renderers/{tool}.tsx` or a single `AnalysisRenderer.tsx` switch.

---

## 2.4 Download JSON
Implement helper in frontend:
- create Blob from `JSON.stringify(result, null, 2)`
- download file name: `{tool_slug}-{analysis_id}.json`

---

# 3) Files to create/update

## Backend
- new/update: `backend/app/api/v1/analyses.py` (list + detail)
- new/update: `backend/app/api/v1/documents.py` (list)
- schemas:
  - `backend/app/schemas/analyses.py` (list/detail responses)
  - `backend/app/schemas/documents.py` (list response)
- ensure router includes routes

## Frontend
- `frontend/lib/api/analyses.ts`
- update: `frontend/app/(app)/dashboard/page.tsx`
- new components:
  - `frontend/components/dashboard/AnalysesTable.tsx`
  - `frontend/components/dashboard/AnalysesFilters.tsx`
  - `frontend/components/analyses/AnalysisModal.tsx` (or detail page)
  - `frontend/components/analyses/AnalysisRenderer.tsx`
  - `frontend/lib/utils/downloadJson.ts`

---

# 4) Чеклист реализации

## Backend
- [ ] implement list analyses (filters + pagination)
- [ ] implement analysis detail (security)
- [ ] implement list documents (pagination/search)
- [ ] add/update schemas and router

## Frontend
- [ ] add analyses API client
- [ ] dashboard: filters + table + pagination
- [ ] detail view modal/page with tool-specific renderer
- [ ] download JSON action

---

# 5) QA scenarios
- run each tool once (at least document-analyzer)
- open dashboard -> list shows items
- filter by tool -> table updates
- search by filename -> table updates
- open detail -> renderer correct
- download JSON -> file downloads

---

## Prompt для Cursor (встроенный)
```
Implement SmartAnalyzer dashboard history and analysis detail view according to docs/dashboard-and-history.md.

Backend:
- Add GET /api/v1/analyses (pagination + filters tool_slug and q on filename)
- Add GET /api/v1/analyses/{id} (returns result_json) with ownership check
- Add GET /api/v1/documents (pagination + q)
- Ensure schemas and router updated

Frontend:
- Build dashboard analyses table with filters (tool dropdown + filename search) and pagination
- Add detail view (modal or /dashboard/analyses/[id]) rendering result based on tool_slug
- Add Download JSON action for each analysis
- Keep MVP clean and responsive
```
