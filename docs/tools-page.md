# tools-page.md

## Роль документа
Это **исполняемая спецификация (Spec-driven)** для агента (Cursor/Codex).  
Цель: реализовать **каталог инструментов** SmartAnalyzer на вебе как отдельный «продуктовый хаб», а также **страницы инструментов уровня MVP (реальные UI-экраны)** — без полной AI-логики (она будет в отдельных документах), но с готовыми интерфейсами загрузки/результатов и интеграционными точками.

> В итоге у нас появляются страницы инструментов, где **уже можно подключать backend**, и это выглядит как рабочий SaaS.

---

## Цель (MVP)
Реализовать:

1) `/tools` — каталог (фильтры/поиск базовые)  
2) `/tools/[slug]` — страница конкретного инструмента (MVP UI)  
3) Единый источник правды: `frontend/lib/config/tools.ts`  
4) Компоненты UI для:
   - Upload зоны
   - Results панели
   - Loading состояния
   - Errors (toast/alert)
5) Переиспользуемые блоки: layout, header, tool shell

---

## Constraints (обязательные ограничения)
- Next.js 14 App Router + TypeScript + TailwindCSS
- Не копировать bothub.ru, только вдохновение по UX
- Никаких реальных вызовов OpenAI на этом этапе **внутри фронта**
- Интеграция с backend должна быть через `frontend/lib/api/*` (заглушки разрешены)
- Инструменты ровно 5 и их slugs фиксированы:
  - document-analyzer
  - contract-checker
  - data-extractor
  - tender-analyzer
  - risk-analyzer

---

## Definition of Done (Acceptance Criteria)
Считаем документ выполненным, если:

- [ ] `/tools` отображает 5 инструментов (из `tools.ts`)
- [ ] Есть поиск и фильтр (можно клиентский по title/description)
- [ ] `/tools/document-analyzer` открывается и содержит:
  - upload UI (dropzone)
  - results UI (пока пустой)
  - button `Analyze` (пока вызывает mock)
- [ ] Аналогично для остальных 4 инструментов (с адаптированными подсказками)
- [ ] Есть общий «ToolShell» компонент с единым стилем
- [ ] На страницах инструментов нет крэшей, все состояния отображаются (idle/loading/success/error)
- [ ] UI аккуратно выглядит на мобилке

---

# 1) Источник правды по инструментам (обязательный)

Файл: `frontend/lib/config/tools.ts`

Каждый инструмент должен описываться:

```ts
export type Tool = {
  slug: string;
  title: string;
  description: string;
  category: "Documents" | "Risk" | "Data";
  icon: string; // lucide name or internal id
  mvp: {
    accepts: string[]; // e.g. ["pdf","docx"]
    output: string[];  // e.g. ["summary","risks","dates"]
  };
};
```

Список (обязательный):

1) Document Analyzer
- slug: `document-analyzer`
- category: Documents
- accepts: pdf, docx
- output: summary, key points, risks, dates

2) Contract Checker
- slug: `contract-checker`
- category: Documents
- accepts: pdf, docx
- output: risky clauses, penalties, obligations, deadlines

3) Data Extractor
- slug: `data-extractor`
- category: Data
- accepts: pdf, docx, xlsx
- output: structured fields, tables, json export

4) Tender Analyzer
- slug: `tender-analyzer`
- category: Documents
- accepts: pdf, docx
- output: requirements, compliance checklist, deadlines, risks

5) Risk Analyzer
- slug: `risk-analyzer`
- category: Risk
- accepts: pdf, docx, xlsx
- output: risk score, key drivers, recommendations

---

# 2) UI/UX: каталог `/tools`

## Layout
- Title: `Tools`
- Subtitle: `Choose an analyzer and get results in minutes.`
- Search input: placeholder `Search tools...`
- Filter chips (3):
  - All
  - Documents
  - Risk
  - Data

## Cards (обязательное)
Каждая карточка:
- icon
- title
- description
- badges: category, `MVP`
- button `Open` → `/tools/<slug>`

## Empty state
Если поиск ничего не нашёл:
- иконка/текст: `No tools found`
- кнопка: `Reset filters`

---

# 3) UI/UX: страницы инструментов `/tools/[slug]`

## Общий каркас ToolShell (обязательный)
Создать компонент `components/tools/ToolShell.tsx` который принимает:

- tool meta (title/description/accepts/output)
- children (основной контент инструмента)

ToolShell включает:
- breadcrumb: Home → Tools → Tool
- заголовок + описание
- блок “Accepted files” (badges)
- блок “Outputs” (bullets)
- divider
- основная зона инструмента (children)

---

## Состояния (обязательные)
На каждой странице инструмента реализовать состояния:

- `idle` — ничего не загружено
- `ready` — файл выбран
- `loading` — анализ в процессе
- `success` — показ результата
- `error` — показ ошибки

Состояния можно хранить в локальном state (React) без Redux.

---

## Upload зона (обязательная)
Компонент: `components/tools/UploadDropzone.tsx`

Требования:
- drag & drop
- кнопка выбора файла
- список выбранного файла (name, size)
- validation по расширениям из tool.mvp.accepts
- при неверном файле показывать error

---

## Results панель (обязательная)
Компонент: `components/tools/ResultsPanel.tsx`

Режимы:
- placeholder: `Upload a file to see results`
- loading: skeleton/placeholder
- success: показывает секции (в зависимости от tool.mvp.output)
- error: текст ошибки

Формат success (унифицированный):
- секции как карточки: `Summary`, `Risks`, `Key points`, `Important dates`
- даже если пока mock

---

## Кнопка Analyze (обязательная)
На странице каждого инструмента:
- primary button `Analyze`
- disabled, если нет файла
- при клике:
  - включает loading на 1–2 секунды (mock)
  - затем success с mock data (структурированный JSON)

Mock data должно быть разным для разных инструментов (минимально).

---

# 4) Интеграционный слой API (заглушка)
Создать `frontend/lib/api/tools.ts`

Функция:

```ts
export async function runToolAnalysis(
  toolSlug: string,
  file: File
): Promise<any> {
  // MVP: mock implementation
}
```

Пока вернуть mock. Позже заменим на real call.

---

# 5) Файлы и папки (обязательные)

Создать/обновить:

### Config
- `frontend/lib/config/tools.ts` (расширить до структуры выше)

### Components
- `frontend/components/tools/ToolShell.tsx`
- `frontend/components/tools/UploadDropzone.tsx`
- `frontend/components/tools/ResultsPanel.tsx`
- `frontend/components/tools/ToolCard.tsx`
- `frontend/components/tools/ToolFilters.tsx` (search + chips)

### API mock
- `frontend/lib/api/tools.ts`

### Pages
- `frontend/app/(marketing)/tools/page.tsx` (каталог)
- `frontend/app/(marketing)/tools/[slug]/page.tsx` (инструмент)

---

# 6) Чеклист реализации (пошагово)

## A) Обновить `tools.ts`
- [ ] добавить category/icon/mvp.accepts/mvp.output
- [ ] экспортировать helper: `getToolBySlug(slug)`

## B) Каталог `/tools`
- [ ] добавить поиск по title/description
- [ ] добавить фильтр по category
- [ ] вывести 5 карточек
- [ ] empty state + reset

## C) Tool pages `/tools/[slug]`
- [ ] валидировать slug (если нет — показать not found)
- [ ] использовать ToolShell
- [ ] подключить UploadDropzone
- [ ] подключить ResultsPanel
- [ ] реализовать state-machine (idle/ready/loading/success/error)
- [ ] реализовать mock analysis через `runToolAnalysis`

## D) UI polish
- [ ] responsive
- [ ] аккуратные отступы/шрифты
- [ ] hover/focus states на кнопках

---

# 7) Проверка вручную (QA)
- [ ] `/tools` поиск работает
- [ ] фильтры переключаются
- [ ] `/tools/document-analyzer` принимает pdf/docx, отклоняет png
- [ ] loading → success отображается
- [ ] mock results отображаются секциями
- [ ] все 5 инструментов открываются и работают одинаково (UI)

---

## Prompt для Cursor (встроенный)
Скопируй и отправь агенту целиком:

```
Implement SmartAnalyzer tools catalog and tool pages according to docs/tools-page.md.

Requirements:
- Next.js 14 App Router + TS + Tailwind.
- Single source of truth: frontend/lib/config/tools.ts with 5 tools only and required metadata.
- Build /tools page with search + category filters + cards.
- Build /tools/[slug] tool pages with ToolShell, UploadDropzone, ResultsPanel.
- Implement UI state machine (idle/ready/loading/success/error).
- Create API integration stub frontend/lib/api/tools.ts returning mock results (different per tool).
- Ensure responsive layout and no crashes.
```
