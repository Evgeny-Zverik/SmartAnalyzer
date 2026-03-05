# error-handling.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: внедрить **единый формат ошибок** в backend и единый UI-рендер ошибок во frontend.

После внедрения:
- любые ошибки читаемые
- фронт понимает 401/404/429 и показывает правильные CTA
- логика “logout on 401” централизована

---

## Constraints
- Backend всегда возвращает JSON ошибки в одном формате
- Frontend должен иметь единый обработчик ошибок (`parseApiError`)

---

## Единый формат ошибки (обязательный)
Любая ошибка backend должна возвращаться как:

```json
{
  "error": "STRING_CODE",
  "message": "Human readable message",
  "details": { }
}
```

Где:
- `error` — код (например `UNAUTHORIZED`, `LIMIT_REACHED`)
- `message` — текст для пользователя
- `details` — объект с доп. полями (может быть пустым)

HTTP статус коды:
- 400 BAD_REQUEST
- 401 UNAUTHORIZED
- 403 FORBIDDEN (если понадобится)
- 404 NOT_FOUND
- 413 PAYLOAD_TOO_LARGE
- 422 VALIDATION_ERROR
- 429 LIMIT_REACHED
- 500 INTERNAL_ERROR / LLM_ERROR / LLM_INVALID_RESPONSE

---

## Backend: как реализовать (обязательный)
1) Создать единый helper:
- `backend/app/utils/errors.py`
  - `raise_error(status_code, error, message, details=None)`

2) Добавить FastAPI exception handlers:
- `HTTPException`
- `RequestValidationError`
- общий `Exception`

3) Для `RequestValidationError` возвращать:
- error: `VALIDATION_ERROR`
- message: `Validation failed`
- details: список полей

Пример 429:
```json
{
  "error": "LIMIT_REACHED",
  "message": "Daily limit reached for this tool.",
  "details": { "tool_slug": "document-analyzer", "plan": "free", "limit_per_day": 3 }
}
```

---

## Frontend: как реализовать (обязательный)

### 1) Парсер ошибки
Файл: `frontend/lib/api/errors.ts`

Функции:
- `parseApiError(respOrError) -> { status, error, message, details }`
- `isUnauthorized(err) -> boolean`
- `isLimitReached(err) -> boolean`

### 2) UI отображение
Добавить компонент:
- `frontend/components/ui/Alert.tsx` (если нет)
- `frontend/components/ui/Toast.tsx` (опционально)

Места применения:
- login/register: показывать message
- tool pages: показывать message + CTA на /pricing если LIMIT_REACHED
- dashboard: если 401 на /me → logout + redirect /login

### 3) CTA правила
- 401: logout + redirect `/login`
- 429 LIMIT_REACHED: показывать кнопку `Upgrade` → `/pricing`
- 404 NOT_FOUND: показать “Not found” (без краша)

---

## Definition of Done (Acceptance Criteria)
- [ ] Backend возвращает ошибки строго в формате `{error,message,details}`
- [ ] Frontend использует единый `parseApiError`
- [ ] На tool страницах лимит показывает CTA на /pricing
- [ ] На 401 происходит logout + redirect
- [ ] Валидационные ошибки 422 отображаются читаемо (минимум message)

---

## Prompt для Cursor (встроенный)
```
Implement unified error handling according to docs/error-handling.md.

Backend:
- Add helper raise_error and exception handlers (HTTPException, RequestValidationError, generic Exception)
- Ensure all endpoints return {error,message,details} on errors

Frontend:
- Add parseApiError utilities and use them across auth, tool pages, dashboard
- Implement CTA rules for 401 and 429 LIMIT_REACHED
```
