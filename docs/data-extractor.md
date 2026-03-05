# data-extractor.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: добавить третий инструмент SmartAnalyzer — **Data Extractor** (извлечение структурированных данных из документов) end-to-end.

Инструмент: пользователь загружает PDF/DOCX/XLSX → получает JSON со структурированными полями + таблицы (упрощенно) + возможность экспортировать результат.

---

## Цель (MVP)
Реализовать flow:

1) Пользователь логинится  
2) Открывает `/tools/data-extractor`  
3) Загружает PDF/DOCX/XLSX  
4) Нажимает Extract  
5) Получает результат:
   - `fields` (ключ-значение)
   - `tables` (упрощённо как массив строк)
   - `confidence` (0..1)
6) Результат сохраняется в `document_analyses` с tool_slug = `data-extractor`
7) Лимиты: free 3/день per tool

---

## Constraints (обязательные ограничения)
- Переиспользовать существующие:
  - upload endpoint
  - usage limits
  - analyses storage table
- Text extraction:
  - PDF/DOCX — через existing `text_extraction`
  - XLSX — через `openpyxl` (извлечь текст из первых N листов/строк, MVP)
- LLM response строго JSON
- Не пытаться идеально распознавать таблицы в PDF на MVP (слишком сложно).  
  Таблицы: либо из XLSX, либо “табличные блоки” из текста, как массив строк.

---

## Definition of Done (Acceptance Criteria)

### Backend
- [ ] `POST /api/v1/tools/data-extractor/run` реализован
- [ ] Поддерживает pdf/docx/xlsx
- [ ] Использует общий механизм лимитов
- [ ] Сохраняет analysis с tool_slug="data-extractor"
- [ ] Возвращает результат по схеме
- [ ] Для XLSX извлекает данные без LLM (частично) и/или отправляет summary в LLM (на MVP допустим гибрид)

### Frontend
- [ ] `/tools/data-extractor` использует реальный API
- [ ] UI отображает `fields` таблицей, `tables` списком
- [ ] Есть кнопка `Copy JSON` и/или `Download JSON`
- [ ] Ошибки отображаются

---

# 1) Backend спецификация

## 1.1 Endpoint
`POST /api/v1/tools/data-extractor/run`

Body:
```json
{ "document_id": 123 }
```

Response 200:
```json
{
  "analysis_id": 111,
  "tool_slug": "data-extractor",
  "result": {
    "fields": [
      { "key": "string", "value": "string" }
    ],
    "tables": [
      {
        "name": "Table 1",
        "rows": [
          ["col1","col2","col3"],
          ["...","...","..."]
        ]
      }
    ],
    "confidence": 0.0
  }
}
```

Ошибки:
- 400 если формат не поддержан/нет текста
- 404 если документ чужой/не найден
- 429 если лимит
- 500 если LLM/парсинг

---

## 1.2 LLM prompt
В `llm_client.py` добавить:
- `extract_structured_data(text: str) -> dict`

Требования:
- верни JSON строго по схеме
- fields 5–30 (если есть)
- tables 0–3 (MVP), rows максимум 20

Схема JSON (строго):
```json
{
  "fields": [
    { "key": "string", "value": "string" }
  ],
  "tables": [
    {
      "name": "string",
      "rows": [
        ["string"]
      ]
    }
  ],
  "confidence": 0.0
}
```

confidence:
- 0.3–0.9 (на основе уверенности модели)

---

## 1.3 XLSX extraction (MVP)
Создать в `text_extraction.py` (или отдельном `xlsx_extraction.py`):

- `extract_text_from_xlsx(path: str) -> str`
  - читает первые 2 листа
  - первые 200 строк
  - конкатенирует в текст “Sheet: .. Row: ..”

Также можно сделать “tables” напрямую:
- собрать из первых 20 строк 1 листа таблицу rows (как list[list[str]])

Для MVP допустим подход:
- таблица берется из XLSX напрямую (без LLM)
- fields можно получить через LLM из extracted_text

---

## 1.4 Валидация результата
Pydantic schema `DataExtractorResult` (обязательно).

Если невалидно → 500 `LLM_INVALID_RESPONSE`.

---

## 1.5 Реализация run handler
Логика:
1) current_user
2) load document by id + ownership
3) assert_can_run(user, "data-extractor")
4) based on mime_type:
   - pdf/docx: extract_text
   - xlsx: extract_xlsx_text + optional tables
5) call LLM `extract_structured_data(text)`
6) merge tables (если xlsx direct tables)
7) save analysis
8) log_run
9) return

---

# 2) Frontend спецификация

## 2.1 API client
В `frontend/lib/api/tools.ts` добавить:
- `runDataExtractor(document_id)`

---

## 2.2 UI
Страница `/tools/data-extractor`:

- upload zone
- button: `Extract`
- results:
  - Fields table (key/value)
  - Tables viewer (accordion or cards)
  - JSON viewer (collapsed) + Copy JSON button

Компоненты (предпочтительно):
- `components/tools/FieldsTable.tsx`
- `components/tools/TablesView.tsx`
- `components/tools/JsonActions.tsx` (copy/download)

Download JSON (MVP):
- создать blob и скачать файл `data-extractor-result.json`

---

# 3) Files to create/update

## Backend
- update: `backend/app/services/llm_client.py` (extract_structured_data)
- update/new: `backend/app/services/text_extraction.py` (xlsx extraction)
- new: `backend/app/schemas/data_extractor.py`
- update: tools routes to add `/tools/data-extractor/run`

## Frontend
- update: `frontend/lib/api/tools.ts` (runDataExtractor)
- update: tool page for slug `data-extractor`
- new components:
  - `FieldsTable.tsx`
  - `TablesView.tsx`
  - `JsonActions.tsx`

---

# 4) Чеклист реализации

## Backend
- [ ] добавить schema DataExtractorResult
- [ ] добавить LLM client function extract_structured_data
- [ ] добавить xlsx text extraction helper
- [ ] endpoint run + usage limits + save analysis

## Frontend
- [ ] API функция runDataExtractor
- [ ] UI: render fields/tables + copy/download JSON
- [ ] ошибки 429/400/500

---

# 5) QA сценарии
1) upload xlsx → extract → fields/tables show
2) upload pdf → extract → fields show
3) download json works
4) 4-й запуск → 429
5) dashboard shows analysis entry

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SmartAnalyzer Data Extractor tool according to docs/data-extractor.md.

Backend:
- Implement POST /api/v1/tools/data-extractor/run with plan-based limits (free: 3/day per tool)
- Support pdf/docx/xlsx using existing upload and extraction; add xlsx extraction (openpyxl)
- Add LLM client function extract_structured_data(text) with strict JSON schema
- Validate with Pydantic; save analysis (tool_slug="data-extractor") in document_analyses; log usage

Frontend:
- Implement /tools/data-extractor page using real API calls
- Render fields (table), tables (cards/accordion), add Copy JSON and Download JSON
- Handle 429/400/500 errors clearly with CTA to /pricing on limit

Keep MVP minimal.
```
