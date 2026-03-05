# landing-page.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: реализовать **маркетинговую часть MVP** SmartAnalyzer на вебе (Next.js), вдохновляясь структурой bothub.ru **только по UX/навигации**, без копирования дизайна/кода.

Результат должен быть максимально «SaaS-премиум»: чисто, быстро, понятно.

---

## Цель (MVP)
Сделать Landing Page + базовые маркетинговые страницы:

- `/` — главная (лендинг)
- `/tools` — каталог инструментов (маркетинговый список)
- `/pricing` — тарифы
- общая навигация (header/footer)
- CTA-кнопки ведут на `/tools` или `/login` (пока логин может быть заглушкой)

> Инструменты на лендинге — **ровно 5** (как утверждено):
1) Document Analyzer  
2) Contract Checker  
3) Data Extractor  
4) Tender Analyzer  
5) Risk Analyzer  

---

## Constraints (обязательные ограничения)
- Next.js 14 + TypeScript + TailwindCSS (App Router)
- Не подключать тяжелые UI-библиотеки. Можно использовать минимальные компоненты.
- Не внедрять пока реальную бизнес-логику инструментов (это отдельные документы).
- Никаких внешних платных сервисов аналитики на этом этапе.
- Дизайн: современный SaaS (Linear/Vercel/Notion), **без копирования bothub.ru**.

---

## Acceptance Criteria (Definition of Done)
Считаем документ выполненным, если:

- [ ] `/` отображает полноценный лендинг со всеми секциями из чеклиста
- [ ] `/tools` показывает 5 карточек инструментов с кнопками
- [ ] `/pricing` показывает 3 тарифа (Free/Pro/Enterprise)
- [ ] Header и Footer есть на всех маркетинговых страницах
- [ ] Ссылки работают, нет 404
- [ ] Мобильная версия адекватная (responsive)
- [ ] Lighthouse (примерно): Performance не ниже ~80 (без фанатизма), нет огромных изображений

---

## Структура страниц (обязательная)

### 1) Главная `/`
Секции (в указанном порядке):

1. **Header**
   - Logo: `SmartAnalyzer`
   - Links: Tools, Pricing
   - CTA button: `Try Free` (ведет на `/tools`)
   - Secondary: `Sign in` (ведет на `/login`)

2. **Hero**
   - Заголовок (пример): `AI-анализ документов и данных для бизнеса`
   - Подзаголовок: 1–2 строки про пользу
   - CTA: `Try Document Analyzer` → `/tools/document-analyzer`
   - Secondary CTA: `View Tools` → `/tools`
   - Мини-карточки доверия: `Secure`, `Fast`, `Business-ready` (3 шт)

3. **Tools Preview**
   - 5 карточек инструментов (см. список)
   - каждая: icon, title, 1–2 строки, button `Open` → `/tools/<slug>`

4. **How it works**
   - 3 шага:
     1) Upload (загрузите документ/файл)
     2) Analyze (AI извлечёт инсайты)
     3) Export (скачайте результат / скопируйте)
   - Можно сделать как горизонтальные карточки

5. **Features**
   - 6 буллетов/карточек (2 ряда по 3):
     - Structured results (JSON)
     - Citations (источники/выдержки) — пока как тезис
     - Usage limits
     - Team-ready (потом)
     - API-ready (потом)
     - Privacy-first

6. **Pricing Preview**
   - 3 плана кратко (Free/Pro/Enterprise)
   - CTA: `See Pricing` → `/pricing`

7. **Final CTA**
   - Большая карточка: `Start analyzing in minutes`
   - CTA: `Get Started` → `/tools`
   - Secondary: `Contact` (пока mailto заглушка или страница-заглушка)

8. **Footer**
   - Links: Tools, Pricing, Terms (заглушка), Privacy (заглушка)
   - Copyright

---

### 2) Каталог `/tools`
Показывает 5 инструментов карточками. Каждая карточка содержит:

- icon
- title
- short description
- badges (1–2): `MVP`, `Docs`, `Risk` etc (не обяз.)
- button `Open tool` → `/tools/<slug>`

Также сверху:
- Page title: `Tools`
- short subtitle
- search input (можно статический, без реальной фильтрации на MVP)

---

### 3) Pricing `/pricing`
Тарифы:

**Free**
- 3 analyses/day
- basic tools access
- community support

**Pro**
- unlimited analyses (MVP: условно)
- priority queue (тезис)
- export formats (тезис)

**Enterprise**
- SSO (тезис)
- on-prem / private deployment (тезис)
- custom limits

CTA:
- Free: `Start Free` → `/register`
- Pro: `Upgrade` → `/register` (или `/contact`)
- Enterprise: `Contact Sales` → mailto или `/contact`

> Сами /register /login могут быть заглушками на этом этапе (если auth еще не сделан).

---

## Slugs (обязательные)
Использовать следующие слаги для страниц инструментов:

- Document Analyzer → `/tools/document-analyzer`
- Contract Checker → `/tools/contract-checker`
- Data Extractor → `/tools/data-extractor`
- Tender Analyzer → `/tools/tender-analyzer`
- Risk Analyzer → `/tools/risk-analyzer`

Эти страницы пока могут быть **marketing stub** (описание + CTA `Sign in`), если инструменты не реализованы.

---

## UI требования (детально)
- Использовать Tailwind, аккуратные отступы.
- Максимальная ширина контента: `max-w-6xl` или `max-w-7xl`
- Карточки: rounded-2xl, border, soft shadow on hover
- Кнопки: primary/secondary варианты
- Типографика: крупный hero, readable body
- Цвета: нейтральные (gray), 1 акцентный (не задавать жестко — можно выбрать 1 акцент через Tailwind класс)

---

## Компоненты (предпочтительно)
Создать переиспользуемые компоненты:

- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- `components/ui/Button.tsx`
- `components/ui/Card.tsx`
- `components/ui/Badge.tsx`
- `components/marketing/Hero.tsx`
- `components/marketing/ToolsGrid.tsx`
- `components/marketing/PricingTable.tsx`
- `lib/config/tools.ts` — единый источник правды для списка инструментов

`tools.ts` должен содержать массив:

```ts
export const tools = [
  {
    slug: "document-analyzer",
    title: "Document Analyzer",
    description: "Upload a document and get structured insights, risks, and key dates."
  },
  ...
];
```

---

## Чеклист реализации (пошагово)

### A) Источник правды по инструментам
- [ ] Создать `frontend/lib/config/tools.ts` с 5 инструментами (slug/title/description)
- [ ] Использовать этот список на `/` и `/tools`

### B) Layout и маршруты
- [ ] Реализовать общий layout в `frontend/app/layout.tsx`
- [ ] Добавить Header/Footer на маркетинговые страницы
- [ ] Создать страницы:
  - [ ] `frontend/app/page.tsx`
  - [ ] `frontend/app/(marketing)/tools/page.tsx`
  - [ ] `frontend/app/(marketing)/pricing/page.tsx`
  - [ ] `frontend/app/(marketing)/tools/[slug]/page.tsx` (маркетинговая заглушка)
- [ ] Добавить простую 404 страницу (опционально)

### C) Landing page секции
- [ ] Hero
- [ ] Tools Preview (5 карточек)
- [ ] How it works (3 шага)
- [ ] Features (6 карточек)
- [ ] Pricing Preview (3 карточки)
- [ ] Final CTA
- [ ] Footer

### D) Tools page
- [ ] Заголовок, подзаголовок, search input (можно без функционала)
- [ ] Grid карточек из `tools.ts`
- [ ] Кнопка `Open tool` → `/tools/<slug>`

### E) Tool stub pages
- [ ] Для `/tools/[slug]` показать:
  - title
  - description
  - список “What you get” (3–5 пунктов)
  - CTA `Try it` → `/login` или `/register`

### F) Pricing page
- [ ] Таблица/карточки тарифов
- [ ] CTA кнопки
- [ ] FAQ (3–5 вопросов) — опционально

---

## Definition of Done (автотест руками)
После выполнения агентом — проверить вручную:

- [ ] `http://localhost:3000/` открывается без ошибок
- [ ] клики `Tools`, `Pricing` работают
- [ ] `/tools` показывает 5 карточек
- [ ] `/tools/document-analyzer` открывается
- [ ] `/pricing` открывается и показывает 3 тарифа
- [ ] дизайн не разваливается на мобилке

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement marketing pages for SmartAnalyzer according to docs/landing-page.md.

Rules:
- Use Next.js 14 App Router + TypeScript + Tailwind.
- Do not copy bothub.ru. Use only general UX inspiration.
- Create pages: /, /tools, /tools/[slug], /pricing with Header/Footer.
- Tools list must come from a single source of truth in frontend/lib/config/tools.ts (5 tools only).
- Create clean SaaS UI components (Button, Card, Badge).
- Ensure responsive layout and working navigation.
```
