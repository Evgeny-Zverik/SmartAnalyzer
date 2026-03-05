# tender-analyzer.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: добавить четвертый инструмент SmartAnalyzer — **Tender Analyzer** (анализ тендерной документации) end-to-end.

Инструмент: пользователь загружает тендер PDF/DOCX → получает:
- summary
- требования (requirements)
- чеклист соответствия (compliance checklist)
- сроки/дедлайны
- риски участия

---

## Цель (MVP)
Flow:

1) login  
2) `/tools/tender-analyzer`  
3) upload pdf/docx  
4) Analyze  
5) result: requirements + checklist + deadlines + risks  
6) save analysis tool_slug=`tender-analyzer`  
7) limits: free 3/day per tool

---

## Constraints
- Reuse upload, extraction, analyses storage, usage limits
- LLM output strict JSON by schema
- Do not implement full госзакупки integrations in MVP
- Keep result practical and actionable

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `POST /api/v1/tools/tender-analyzer/run` exists
- [ ] Uses limits service (assert_can_run/log_run)
- [ ] Validates and stores result_json (tool_slug="tender-analyzer")
- [ ] Returns response in schema
- [ ] Handles errors (404/429/400/500)

### Frontend
- [ ] `/tools/tender-analyzer` uses real API
- [ ] Renders requirements list, checklist view, deadlines, risks
- [ ] Shows errors with CTA to /pricing on limit

---

# 1) Backend спецификация

## 1.1 Endpoint
`POST /api/v1/tools/tender-analyzer/run`

Body:
```json
{ "document_id": 123 }
```

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

---

## 1.2 LLM client function
Добавить в `llm_client.py`:
- `analyze_tender(text: str) -> dict`

Strict JSON schema:

```json
{
  "summary": "string",
  "requirements": [
    { "id": "string", "text": "string", "type": "doc|tech|finance|legal" }
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
```

Rules:
- requirements 10–40 items (if possible)
- checklist 8–20 items
- deadlines 0–10
- risks 0–10
- if missing → empty arrays

---

## 1.3 Pydantic schema
Создать `TenderAnalyzerResult` (обязательно).  
Если invalid → 500 LLM_INVALID_RESPONSE.

---

## 1.4 Run handler logic
1) auth user
2) load document by id + ownership
3) assert_can_run(user, "tender-analyzer")
4) extract_text
5) result = llm_client.analyze_tender(text)
6) validate schema
7) store analysis tool_slug="tender-analyzer"
8) log_run
9) return

---

# 2) Frontend спецификация

## 2.1 API client
В `frontend/lib/api/tools.ts` добавить:
- `runTenderAnalyzer(document_id)`

---

## 2.2 UI
Страница `/tools/tender-analyzer` должна показывать:

Sections:
- Summary
- Requirements (group by type with tabs or headings)
- Compliance checklist (read-only checklist view)
- Deadlines (list)
- Risks (cards with severity badge)

Reuse components:
- SeverityBadge (already from contract-checker)
- ChecklistView (already from contract-checker or create generic)
- ResultsPanel can be extended or create TenderResults component

---

# 3) Files to create/update

## Backend
- update: `llm_client.py` add analyze_tender
- new: `schemas/tender_analyzer.py`
- update: tools routes add /tools/tender-analyzer/run

## Frontend
- update: `lib/api/tools.ts` add runTenderAnalyzer
- update: tool page renderer for slug tender-analyzer
- reuse: SeverityBadge, ChecklistView

---

# 4) Чеклист реализации

## Backend
- [ ] add Pydantic schema
- [ ] add llm_client.analyze_tender
- [ ] add endpoint run
- [ ] enforce limits + store analysis

## Frontend
- [ ] add API function
- [ ] implement UI sections
- [ ] errors handling

---

# 5) QA
- upload tender pdf -> analyze -> requirements render
- checklist renders
- 4th run -> 429
- dashboard shows entry

---

## Prompt для Cursor (встроенный)
```
Implement SmartAnalyzer Tender Analyzer tool according to docs/tender-analyzer.md.

Backend:
- Implement POST /api/v1/tools/tender-analyzer/run using existing upload/extraction/limits
- Add LLM client analyze_tender(text) with strict JSON schema
- Validate with Pydantic TenderAnalyzerResult and save analysis tool_slug="tender-analyzer"
- Enforce plan-based limits (free: 3/day per tool)

Frontend:
- Implement /tools/tender-analyzer page with real API calls
- Render summary, requirements grouped by type, compliance checklist, deadlines, risks with severity badges
- Handle 429/400/500 errors with CTA to /pricing on limit

Keep MVP minimal.
```
