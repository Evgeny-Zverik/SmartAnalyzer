# risk-analyzer.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: добавить пятый инструмент SmartAnalyzer — **Risk Analyzer** (оценка рисков по документам/данным) end-to-end.

Инструмент: пользователь загружает PDF/DOCX/XLSX → получает:
- risk_score (0–100)
- key_risks (список)
- risk_drivers (факторы)
- recommendations (что сделать)
- confidence (0..1)

---

## Цель (MVP)
Flow:

1) login  
2) `/tools/risk-analyzer`  
3) upload pdf/docx/xlsx  
4) Analyze  
5) result: risk score + risks + drivers + recommendations  
6) save analysis tool_slug=`risk-analyzer`  
7) limits: free 3/day per tool

---

## Constraints
- Reuse upload, extraction, analyses storage, usage limits
- XLSX: reuse extraction from data-extractor (openpyxl)
- LLM output strict JSON schema
- Keep scoring simple and explainable (drivers + reasons)

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `POST /api/v1/tools/risk-analyzer/run` exists
- [ ] supports pdf/docx/xlsx via extraction helpers
- [ ] validates and stores result_json tool_slug="risk-analyzer"
- [ ] enforces limits
- [ ] returns schema + handles errors

### Frontend
- [ ] `/tools/risk-analyzer` uses real API
- [ ] renders risk score prominently + lists
- [ ] shows errors with CTA to /pricing on limit

---

# 1) Backend спецификация

## 1.1 Endpoint
`POST /api/v1/tools/risk-analyzer/run`

Body:
```json
{ "document_id": 123 }
```

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

## 1.2 LLM client function
Добавить в `llm_client.py`:
- `analyze_risk(text: str) -> dict`

Strict JSON schema:

```json
{
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
```

Rules:
- risk_score 0..100 (int)
- confidence 0..1 (float)
- key_risks 3..10 (if possible)
- drivers 3..10
- recommendations 3..10
- severity/impact/priority use low/medium/high

---

## 1.3 Pydantic schema
Создать `RiskAnalyzerResult` (обязательно).  
If invalid → 500 LLM_INVALID_RESPONSE.

---

## 1.4 Run handler logic
1) auth user
2) load document by id + ownership
3) assert_can_run(user, "risk-analyzer")
4) extract_text (pdf/docx/xlsx)
5) result = llm_client.analyze_risk(text)
6) validate schema
7) save analysis tool_slug="risk-analyzer"
8) log_run
9) return

---

# 2) Frontend спецификация

## 2.1 API client
В `frontend/lib/api/tools.ts` добавить:
- `runRiskAnalyzer(document_id)`

---

## 2.2 UI
Страница `/tools/risk-analyzer`:

- upload zone
- button Analyze
- results:
  - Risk score widget (big number, color optional)
  - Confidence (small text)
  - Key risks cards (with severity badge)
  - Risk drivers list
  - Recommendations list (priority badge)

Reuse components:
- SeverityBadge
- ResultsPanel can be extended or create RiskResults component

---

# 3) Files to create/update

## Backend
- update: llm_client.py add analyze_risk
- new: schemas/risk_analyzer.py
- update: tools routes add /tools/risk-analyzer/run

## Frontend
- update: lib/api/tools.ts add runRiskAnalyzer
- update: tool page renderer for slug risk-analyzer
- add small component:
  - `components/tools/RiskScore.tsx` (optional)

---

# 4) Чеклист реализации

## Backend
- [ ] add Pydantic schema
- [ ] add llm_client.analyze_risk
- [ ] add endpoint run
- [ ] enforce limits + store analysis

## Frontend
- [ ] add API function
- [ ] implement UI sections and score widget
- [ ] errors handling

---

# 5) QA
- upload xlsx -> analyze -> score and lists render
- 4th run -> 429
- dashboard shows entry

---

## Prompt для Cursor (встроенный)
```
Implement SmartAnalyzer Risk Analyzer tool according to docs/risk-analyzer.md.

Backend:
- Implement POST /api/v1/tools/risk-analyzer/run using existing upload/extraction/limits
- Support pdf/docx/xlsx (reuse xlsx extraction from data-extractor)
- Add LLM client analyze_risk(text) with strict JSON schema
- Validate with Pydantic RiskAnalyzerResult and save analysis tool_slug="risk-analyzer"
- Enforce plan-based limits (free: 3/day per tool)

Frontend:
- Implement /tools/risk-analyzer page with real API calls
- Render risk_score prominently + confidence + key risks + drivers + recommendations
- Handle 429/400/500 errors with CTA to /pricing on limit

Keep MVP minimal.
```
