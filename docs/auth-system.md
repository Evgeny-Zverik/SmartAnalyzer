# auth-system.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: реализовать **полноценную авторизацию MVP** для SmartAnalyzer: регистрация, логин, JWT, защищённые эндпоинты, UI формы, хранение токена, middleware/guards.

После этого можно подключать реальные инструменты и лимиты.

---

## Цель (MVP)
Реализовать:

### Backend
- Email/password регистрация
- Email/password логин
- JWT access token
- `/auth/me` — текущий пользователь
- Hashing пароля (bcrypt)
- Защита роутов через dependency

### Frontend
- `/login` — форма входа
- `/register` — форма регистрации
- хранение токена (localStorage или httpOnly cookie — **в MVP допустим localStorage**)
- guard для `/dashboard` (если нет токена → редирект на `/login`)
- простая обработка ошибок

---

## Constraints (обязательные ограничения)
- Backend: FastAPI + SQLAlchemy + Pydantic + Alembic
- JWT: HS256, секрет из ENV
- Пароли: bcrypt (passlib)
- Frontend: Next.js 14 App Router + TS + Tailwind
- На MVP: без OAuth, без SSO, без magic links
- Токен на MVP можно хранить в localStorage (быстро). В будущем перейдём на httpOnly cookies.

---

## Definition of Done (Acceptance Criteria)
Считаем документ выполненным, если:

### Backend
- [ ] `POST /auth/register` создаёт пользователя
- [ ] `POST /auth/login` возвращает JWT token
- [ ] `GET /auth/me` возвращает текущего пользователя при валидном токене
- [ ] Пароль в базе хранится в виде хеша
- [ ] При неверном пароле/логине — корректная 401 ошибка
- [ ] Есть миграции Alembic, таблица `users`

### Frontend
- [ ] Страница `/register` регистрирует и переводит на `/dashboard`
- [ ] Страница `/login` логинит и переводит на `/dashboard`
- [ ] `/dashboard` защищен (без токена → `/login`)
- [ ] Logout очищает токен и редиректит на `/`
- [ ] Ошибки отображаются (не молча)

---

# 1) Backend спецификация

## 1.1 Таблица users
Создать SQLAlchemy модель `User` в `backend/app/models/user.py`.

Поля (минимум MVP):

- `id` (UUID или int — на MVP допустим int)
- `email` (unique, indexed)
- `password_hash` (string)
- `created_at` (timestamp)

Схема Pydantic:

- `UserCreate` (email, password)
- `UserLogin` (email, password)
- `UserRead` (id, email, created_at)

> Пароль никогда не возвращать наружу.

---

## 1.2 Endpoints

### `POST /auth/register`
Request:
```json
{ "email": "user@example.com", "password": "secret123" }
```

Response 201:
```json
{ "id": 1, "email": "user@example.com", "created_at": "..." }
```

Ошибки:
- 409 если email уже занят
- 422 если валидация

### `POST /auth/login`
Request:
```json
{ "email": "user@example.com", "password": "secret123" }
```

Response 200:
```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

Ошибки:
- 401 если неверно

### `GET /auth/me`
Headers:
`Authorization: Bearer <jwt>`

Response 200:
```json
{ "id": 1, "email": "user@example.com", "created_at": "..." }
```

Ошибки:
- 401 если нет/невалидный токен

---

## 1.3 JWT & Security

Файл: `backend/app/core/security.py`

Требования:
- функция `create_access_token(subject: str, expires_minutes: int)`
- функция `verify_token(token: str) -> dict`
- dependency `get_current_user()`

ENV переменные (backend):
- `JWT_SECRET`
- `JWT_ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`

---

## 1.4 Пароли
Файл: `backend/app/core/security.py` или `utils/passwords.py`

- `hash_password(password: str) -> str`
- `verify_password(password: str, hash: str) -> bool`

Использовать:
- passlib[bcrypt]

---

## 1.5 Роутинг
- Добавить `backend/app/api/v1/auth.py`
- Подключить роуты в `backend/app/api/router.py`
- Базовый префикс: `/api/v1` (если уже выбран)
  - тогда endpoints:
    - `/api/v1/auth/register`
    - `/api/v1/auth/login`
    - `/api/v1/auth/me`

> Если префикса пока нет, тогда оставить просто `/auth/*` — но зафиксировать один вариант.  
> **Рекомендуется `/api/v1`.**

---

## 1.6 Health endpoint
Если ещё не добавлен:
- `GET /health` → `{ "status": "ok" }`

---

# 2) Frontend спецификация

## 2.1 API клиент
Файл: `frontend/lib/api/client.ts`

Требования:
- baseURL = `NEXT_PUBLIC_API_BASE_URL`
- функция `apiFetch(path, options)`
- автоматическая подстановка Authorization header, если token есть

Токен хранить в:
- `localStorage` key: `smartanalyzer_token`

---

## 2.2 Auth API
Файл: `frontend/lib/api/auth.ts`

Функции:
- `register(email, password)` → user
- `login(email, password)` → token
- `me()` → user
- `logout()` → clear token

---

## 2.3 Страницы

### `/login`
Файл: `frontend/app/(auth)/login/page.tsx`

UI:
- email input
- password input
- submit button
- link to `/register`
- error alert

Логика:
- submit → call login → save token → redirect to `/dashboard`

### `/register`
Файл: `frontend/app/(auth)/register/page.tsx`

UI:
- email
- password
- confirm password (опционально, но желательно)
- submit
- link to `/login`
- error alert

Логика:
- submit → call register → auto login (или сразу вернуть token — но лучше auto login через login) → redirect `/dashboard`

### `/dashboard`
Файл: `frontend/app/(app)/dashboard/page.tsx`

UI:
- greeting: `Hello, <email>`
- button: Logout
- section placeholders:
  - Recent analyses
  - Usage limits

Guard:
- если токена нет → redirect `/login`
- если токен есть, но `/me` 401 → logout + redirect `/login`

---

## 2.4 Auth Guard (обязательный)
Реализовать helper:

`frontend/lib/auth/requireAuth.ts` или аналог:
- проверяет token
- вызывает `me()`
- возвращает user или редирект

На MVP допустимо сделать guard в `dashboard/page.tsx` (client component) через useEffect.

---

# 3) Файлы и папки (обязательные)

### Backend
- `backend/app/models/user.py`
- `backend/app/schemas/user.py`
- `backend/app/api/v1/auth.py`
- `backend/app/core/security.py`
- `backend/app/db/session.py` (если нет)
- Alembic migration: create users table

### Frontend
- `frontend/lib/api/client.ts`
- `frontend/lib/api/auth.ts`
- `frontend/lib/auth/token.ts` (get/set/clear)
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/register/page.tsx`
- `frontend/app/(app)/dashboard/page.tsx`
- UI components (если нет): Input, Button, Alert

---

# 4) Чеклист реализации (пошагово)

## Backend
- [ ] Создать модель User и миграцию
- [ ] Реализовать hashing/verify password
- [ ] Реализовать JWT create/verify
- [ ] Реализовать register endpoint (с проверкой уникальности email)
- [ ] Реализовать login endpoint (401 если неверно)
- [ ] Реализовать /me endpoint с get_current_user dependency
- [ ] Добавить CORS для frontend домена (local: http://localhost:3000)

## Frontend
- [ ] Создать API client с baseURL
- [ ] Реализовать auth.ts функции
- [ ] Сделать login/register UI + валидацию
- [ ] Сохранение токена в localStorage
- [ ] Сделать dashboard и guard
- [ ] Добавить logout

---

# 5) Быстрая проверка (QA)
1) Запусти backend+frontend
2) Открой `/register`
3) Зарегистрируй пользователя
4) Должно перейти на `/dashboard` и показать email
5) Обнови страницу dashboard (токен сохраняется)
6) Logout → редирект на `/`
7) Попробуй открыть `/dashboard` без токена → редирект на `/login`
8) Неверный пароль → error

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SmartAnalyzer authentication system according to docs/auth-system.md.

Backend:
- FastAPI + SQLAlchemy + Alembic
- Users table (email unique, password_hash)
- Password hashing (bcrypt)
- JWT auth (HS256, secret from env)
- Endpoints: POST /api/v1/auth/register, POST /api/v1/auth/login, GET /api/v1/auth/me
- Protect /me with get_current_user dependency
- Add CORS for http://localhost:3000

Frontend:
- Next.js App Router pages: /login, /register, /dashboard
- Implement API client with baseURL from NEXT_PUBLIC_API_BASE_URL
- Store token in localStorage key smartanalyzer_token
- Guard /dashboard: redirect to /login if no token or /me returns 401
- Logout clears token and redirects to /

Keep MVP minimal. No OAuth/SSO.
```
