# contract-checker.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: добавить второй инструмент SmartAnalyzer — **Contract Checker** (проверка договора на риски) end-to-end:

- Frontend: upload → analyze → показать результат + чеклист
- Backend: reuse upload/documents, extract text, LLM strict JSON, save analysis, usage limits
- Dashboard: recent analyses включает этот инструмент

Инструмент отличается от Document Analyzer **структурой результата** и промптом.

---

## Цель (MVP)
Реализовать flow:

1) Пользователь логинится  
2) Открывает `/tools/contract-checker`  
3) Загружает PDF/DOCX договора  
4) Нажимает Analyze  
5) Получает результат: risks/penalties/obligations/deadlines + checklist  
6) Результат сохраняется в базе как analysis с tool_slug = `contract-checker`  
7) Применяются лимиты (free: 3/день на tool)

---

## Constraints (обязательные ограничения)
- Переиспользовать существующие:
  - upload documents endpoint
  - text extraction service
  - usage limits service
  - document_analyses table (result_json)
- Не вводить новые таблицы, кроме если критично (не должно быть)
- LLM response строго JSON по схеме ниже
- Не добавлять очереди/фоновые задачи

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `POST /api/v1/tools/contract-checker/run` реализован
- [ ] Использует общий механизм лимитов (assert_can_run/log_run)
- [ ] Сохраняет analysis в `document_analyses` с `tool_slug="contract-checker"`
- [ ] Возвращает structured JSON результата по схеме
- [ ] Обрабатывает ошибки (400/401/404/429/500)

### Frontend
- [ ] `/tools/contract-checker` использует реальные API вызовы
- [ ] UI показывает секции результата + чеклист (галочки)
- [ ] Ошибки 429/400/500 показываются понятно
- [ ] Recent analyses в dashboard показывает contract-checker записи

---

# 1) Backend спецификация

## 1.1 Endpoint
`POST /api/v1/tools/contract-checker/run`

Headers:
Authorization Bearer

Body:
```json
{ "document_id": 123 }
```

Ответ 200:
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

Ошибки:
- 404 если document не найден или не принадлежит пользователю
- 429 если лимит
- 400 если не удалось извлечь текст
- 500 если LLM/парсинг

---

## 1.2 LLM prompt (обязательный)
В `backend/app/services/llm_client.py` добавить функцию:
- `check_contract(text: str) -> dict`

Требования:
- строго вернуть JSON по схеме
- severity распределять: low/medium/high
- checklist items 5–12 штук
- если данных нет → пустые массивы

Схема JSON (строго):
```json
{
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
```

---

## 1.3 Валидация результата
Желательно (MVP):
- валидировать dict через Pydantic schema `ContractCheckResult`
- если невалидно → 500 с понятной ошибкой (`LLM_INVALID_RESPONSE`)

Создать:
- `backend/app/schemas/tools.py` или `schemas/contract_checker.py`

---

## 1.4 Реализация run handler
Файл (рекомендация):
- `backend/app/api/v1/tools.py` (добавить роут)
или
- `backend/app/api/v1/contract_checker.py` (отдельный)

Логика:
1) current_user
2) найти документ по id и user_id
3) assert_can_run(user, "contract-checker")
4) extract_text
5) llm_client.check_contract(text)
6) сохранить в document_analyses (tool_slug="contract-checker", result_json=...)
7) log_run
8) вернуть result

---

# 2) Frontend спецификация

## 2.1 API client
В `frontend/lib/api/tools.ts` добавить функцию:
- `runContractChecker(document_id)`

Возвращает `result` как выше.

---

## 2.2 Tool page UI
Страница `/tools/contract-checker` должна:

- reuse UploadDropzone
- кнопка Analyze
- ResultsPanel, но расширить отображение:
  - Summary
  - Risky clauses (карточки с severity badge)
  - Penalties (list)
  - Obligations (list grouped by party)
  - Deadlines (list)
  - Checklist (checkbox-like list, read-only statuses)

Компоненты (предпочтительно):
- `components/tools/SeverityBadge.tsx`
- `components/tools/ChecklistView.tsx`

---

## 2.3 Ошибки
429 → “Daily limit reached. Upgrade to Pro.” + кнопка на `/pricing`  
400 → “Cannot extract text from contract.”  
500 → “Contract analysis failed. Try again.”  

---

# 3) Files to create/update

## Backend
- update: `backend/app/services/llm_client.py` (add check_contract)
- new: `backend/app/schemas/contract_checker.py` (Pydantic result model)
- update/new: `backend/app/api/v1/tools.py` (route run)
- update: router include if needed

## Frontend
- update: `frontend/lib/api/tools.ts` (runContractChecker)
- update: tool page renderer for slug `contract-checker`
- new components:
  - `frontend/components/tools/SeverityBadge.tsx`
  - `frontend/components/tools/ChecklistView.tsx`

---

# 4) Чеклист реализации (пошагово)

## Backend
- [ ] добавить Pydantic schema результата contract checker
- [ ] добавить `check_contract` в llm_client
- [ ] добавить endpoint run
- [ ] подключить usage limits
- [ ] сохранить analysis в DB

## Frontend
- [ ] добавить API функцию runContractChecker
- [ ] обновить /tools/contract-checker page: upload → analyze → render
- [ ] добавить UI для severity и checklist
- [ ] обработать ошибки

---

# 5) QA сценарии
1) login
2) upload contract pdf
3) run contract checker → success
4) проверить severity badges
5) 4-й запуск за день → 429
6) dashboard recent analyses включает contract-checker

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SmartAnalyzer Contract Checker tool according to docs/contract-checker.md.

Backend:
- Reuse existing document upload, text extraction, usage limits, analyses storage
- Implement POST /api/v1/tools/contract-checker/run
- Add LLM client function check_contract(text) with strict JSON schema
- Validate result with Pydantic schema; handle invalid responses
- Save analysis in document_analyses with tool_slug="contract-checker"
- Enforce plan-based daily limits (free: 3/day per tool)

Frontend:
- Implement contract-checker tool page using real API calls
- Render result sections: summary, risky_clauses(severity), penalties, obligations, deadlines, checklist
- Handle 429/400/500 errors with clear UI and CTA to /pricing

Keep MVP minimal, no queues.
```
