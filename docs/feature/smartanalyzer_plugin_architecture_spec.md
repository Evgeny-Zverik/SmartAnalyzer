# SmartAnalyzer — Plugin Architecture Spec

## 1. Цель

Перевести SmartAnalyzer из монолитного набора AI-фич в расширяемую платформу модулей, где каждая возможность подключается как отдельный plugin/feature module и прозрачно отображается в интерфейсе.

Основная идея:
- документ или другой input открывается в общем workspace;
- справа пользователь видит список подключенных модулей;
- каждый модуль может:
  - выполнять анализ;
  - отдавать результаты в едином формате;
  - добавлять UI в разрешенные зоны;
  - рисовать подсветки/оверлеи внутри документа;
  - добавлять действия в toolbar / context menu / панели.

Это должно дать:
- понятность для пользователя;
- масштабируемость продукта;
- возможность продавать наборы модулей;
- асинхронную обработку отдельных фич;
- единый UX для разных типов файлов: document / audio / video / table / tender / chat.

---

## 2. Ключевые принципы

### 2.1. Не монолит, а ядро + плагины
Ядро отвечает только за:
- workspace layout;
- routing;
- загрузку файла;
- lifecycle плагинов;
- permissions / plans;
- единый store состояния;
- рендер допустимых UI-слотов;
- сохранение результатов.

Плагины отвечают за:
- доменную логику;
- анализ;
- вывод результатов;
- UI-вклад в рамках разрешенных слотов;
- overlays / actions / widgets.

### 2.2. Плагин не меняет UI как попало
Любой плагин работает только через разрешенные точки расширения.

Нельзя:
- полностью перерисовывать экран;
- ломать layout;
- напрямую встраиваться в случайные места DOM/UI;
- хаотично менять чужие виджеты.

Можно:
- регистрировать карточки;
- добавлять toolbar actions;
- создавать overlays;
- регистрировать панели;
- отдавать findings, привязанные к якорям документа.

### 2.3. Один единый контракт результатов
Все плагины возвращают результаты в общей структуре, чтобы:
- единообразно сохранять в БД;
- легко строить UI;
- быстро добавлять новые плагины;
- упростить telemetry / audit / export.

### 2.4. Плагины должны быть видимыми
Пользователь всегда должен видеть:
- какие модули подключены;
- какие сейчас активны;
- какие что-то нашли;
- какие работают;
- какие недоступны по тарифу.

---

## 3. Термины

### 3.1. Plugin
Техническая единица расширения. Может содержать backend-логику, AI-вызовы, UI, overlays и actions.

### 3.2. Feature Module
Пользовательское понятие для крупной возможности. Например:
- Risk Analyzer
- Speech Transcription
- Spellcheck
- Tender Review

### 3.3. UI Extension
Небольшое расширение интерфейса, которое плагин может зарегистрировать:
- карточка справа;
- кнопка в toolbar;
- бейдж;
- tooltip;
- panel tab;
- floating action.

### 3.4. Overlay
Визуальный слой поверх документа или другой сущности:
- highlight;
- underline;
- comment marker;
- badge;
- timestamp marker;
- anchor jump.

### 3.5. Workspace
Основной экран работы с сущностью.
Примеры:
- document workspace;
- audio workspace;
- tender workspace.

---

## 4. Типы плагинов

## 4.1. Analysis Plugins
Делают анализ и возвращают findings.

Примеры:
- risk analyzer;
- dates extractor;
- requisites extractor;
- missing clauses checker;
- summary generator.

## 4.2. UI Plugins
Добавляют UI-компоненты в разрешенные зоны.

Примеры:
- transcript panel;
- compare versions side panel;
- spellcheck suggestion list;
- actions sidebar.

## 4.3. Overlay Plugins
Рисуют поверх сущности визуальные подсказки.

Примеры:
- highlights;
- underlines;
- annotations;
- timestamp markers;
- severity icons.

## 4.4. Action Plugins
Добавляют действия в интерфейс.

Примеры:
- “Сгенерировать summary”;
- “Показать риски”;
- “Скрыть орфографию”;
- “Перейти к таймкоду”;
- “Скачать transcript”.

## 4.5. Composite Plugins
Полноценные feature-плагины, которые совмещают логику + UI + overlays + actions.

Примеры:
- speech transcription;
- contract review;
- tender analyzer.

---

## 5. Разрешенные UI-слоты

Плагин не вставляет UI напрямую. Он объявляет, в какие слоты хочет подключиться.

```ts
export type UISlot =
  | 'right_sidebar'
  | 'left_sidebar'
  | 'document_toolbar'
  | 'top_banner'
  | 'bottom_panel'
  | 'inspector_panel'
  | 'context_menu'
  | 'document_overlay'
  | 'floating_widget'
  | 'header_actions'
```

### 5.1. right_sidebar
Основное место для списка модулей и кратких результатов.

Примеры:
- карточка “Риски — найдено 8”;
- карточка “Орфография — 3 замечания”;
- карточка “Расшифровка — готово”.

### 5.2. document_toolbar
Кнопки и фильтры над документом.

Примеры:
- показать/скрыть highlights;
- фильтр по severity;
- перейти к следующему риску.

### 5.3. bottom_panel
Нижняя панель для объемного контента.

Примеры:
- transcript;
- timeline;
- compare versions;
- raw extraction table.

### 5.4. inspector_panel
Панель деталей выбранного элемента.

Примеры:
- подробности риска;
- описание найденной даты;
- источник фрагмента.

### 5.5. context_menu
Действия по выделенному тексту.

Примеры:
- объяснить фрагмент;
- проверить формулировку;
- предложить улучшение;
- сравнить с шаблоном.

### 5.6. document_overlay
Визуальный слой прямо поверх контента.

Примеры:
- highlight ranges;
- underline ranges;
- severity markers;
- inline badges.

---

## 6. Базовый UX экрана

## 6.1. Layout
- слева: список документов / папки / история;
- центр: viewer документа / текста / аудио / видео;
- справа: панель подключенных модулей;
- снизу (опционально): расширенная рабочая панель плагина.

## 6.2. Правая панель “Подключенные модули”
Для каждого модуля отображать:
- название;
- статус;
- short summary;
- счетчик результатов;
- доступность по тарифу;
- toggle enable/disable;
- action “Открыть результаты”.

Статусы:
- available
- enabled
- disabled
- queued
- running
- completed
- partial
- failed
- locked

### Пример карточки
- Risk Analyzer — running — найдено 4 из 8 фрагментов
- Dates & Deadlines — completed — 12 дат
- Spellcheck — completed — 3 замечания
- Speech Transcription — locked — доступно в Pro

## 6.3. Поведение
- при открытии документа ядро определяет совместимые плагины;
- автоматически включает базовые плагины;
- остальные доступны вручную или по тарифу;
- каждый плагин запускается независимо;
- результаты появляются постепенно;
- при клике на finding происходит переход к якорю в документе.

---

## 7. Manifest плагина

Каждый плагин обязан иметь manifest.

```ts
export interface PluginManifest {
  id: string
  version: string
  name: string
  description: string
  category: 'analysis' | 'ui' | 'overlay' | 'action' | 'composite'
  supportedInputs: InputType[]
  requiredPlan: 'free' | 'pro' | 'enterprise'
  uiSlots: UISlot[]
  capabilities: PluginCapability[]
  outputSchemaVersion: string
  isExperimental?: boolean
}

export type InputType =
  | 'pdf'
  | 'docx'
  | 'text'
  | 'audio'
  | 'video'
  | 'spreadsheet'
  | 'tender'
  | 'chat'

export type PluginCapability =
  | 'analyze'
  | 'highlight'
  | 'annotate'
  | 'extract'
  | 'summarize'
  | 'transcribe'
  | 'compare'
  | 'suggest'
  | 'timeline'
  | 'toolbar_action'
  | 'panel'
```

### Пример manifest: Risk Analyzer

```json
{
  "id": "risk_analyzer",
  "version": "1.0.0",
  "name": "Risk Analyzer",
  "description": "Находит рискованные формулировки и спорные условия в договоре",
  "category": "composite",
  "supportedInputs": ["pdf", "docx", "text"],
  "requiredPlan": "pro",
  "uiSlots": ["right_sidebar", "document_overlay", "inspector_panel", "document_toolbar"],
  "capabilities": ["analyze", "highlight", "annotate", "suggest"],
  "outputSchemaVersion": "1.0"
}
```

### Пример manifest: Speech Transcription

```json
{
  "id": "speech_transcription",
  "version": "1.0.0",
  "name": "Speech Transcription",
  "description": "Расшифровывает речь, строит таймкоды и summary встречи",
  "category": "composite",
  "supportedInputs": ["audio", "video"],
  "requiredPlan": "pro",
  "uiSlots": ["right_sidebar", "bottom_panel", "document_toolbar", "inspector_panel"],
  "capabilities": ["transcribe", "summarize", "timeline", "panel"],
  "outputSchemaVersion": "1.0"
}
```

---

## 8. Lifecycle плагина

```ts
export type PluginLifecycleState =
  | 'registered'
  | 'compatible'
  | 'enabled'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'disabled'
  | 'locked'
```

### Порядок работы
1. Plugin registry загружает все плагины.
2. Workspace получает input.
3. Core определяет compatible plugins.
4. Проверяется plan / permissions.
5. Часть плагинов auto-enabled.
6. Плагин регистрирует UI extensions.
7. Плагин запускает analysis pipeline.
8. Плагин стримит промежуточные статусы.
9. Плагин сохраняет standardized output.
10. UI обновляет карточки, findings и overlays.

### Важные требования
- запуск плагинов должен быть независимым;
- падение одного плагина не ломает workspace;
- partial results допустимы;
- можно повторно запускать plugin;
- должен быть cancel/retry;
- статус должен быть виден пользователю.

---

## 9. Единый output contract

```ts
export interface PluginExecutionResult {
  pluginId: string
  pluginVersion: string
  status: 'completed' | 'partial' | 'failed'
  startedAt: string
  finishedAt?: string
  summary?: PluginSummary
  metrics?: PluginMetrics
  findings: PluginFinding[]
  overlays?: PluginOverlay[]
  actions?: PluginAction[]
  panels?: PluginPanel[]
  raw?: Record<string, unknown>
  error?: PluginError
}

export interface PluginSummary {
  title: string
  subtitle?: string
  shortText: string
  counters?: Array<{
    key: string
    label: string
    value: number | string
  }>
}

export interface PluginMetrics {
  durationMs?: number
  tokensUsed?: number
  model?: string
  confidence?: number
}

export interface PluginError {
  code: string
  message: string
  details?: Record<string, unknown>
}
```

### Finding

```ts
export interface PluginFinding {
  id: string
  type: string
  title: string
  description?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  confidence?: number
  anchor?: ContentAnchor
  quote?: string
  suggestion?: string
  metadata?: Record<string, unknown>
}
```

### Anchor

```ts
export interface ContentAnchor {
  targetType: 'document' | 'audio' | 'video' | 'table'
  page?: number
  textRange?: {
    start: number
    end: number
  }
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  timestampMs?: number
  rowId?: string
  cellId?: string
}
```

### Overlay

```ts
export interface PluginOverlay {
  id: string
  type: 'highlight' | 'underline' | 'badge' | 'comment' | 'timestamp_marker'
  anchor: ContentAnchor
  label?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  colorToken?: string
  interactive?: boolean
  findingId?: string
}
```

### Action

```ts
export interface PluginAction {
  id: string
  label: string
  slot: 'document_toolbar' | 'context_menu' | 'right_sidebar' | 'header_actions'
  actionType: 'open_panel' | 'toggle_overlay' | 'jump_to_finding' | 'export' | 'rerun'
  payload?: Record<string, unknown>
}
```

### Panel

```ts
export interface PluginPanel {
  id: string
  title: string
  slot: 'bottom_panel' | 'inspector_panel' | 'right_sidebar'
  panelType: 'list' | 'timeline' | 'transcript' | 'table' | 'details'
  data: Record<string, unknown>
}
```

---

## 10. Пример output: Risk Analyzer

```json
{
  "pluginId": "risk_analyzer",
  "pluginVersion": "1.0.0",
  "status": "completed",
  "startedAt": "2026-03-11T10:00:00Z",
  "finishedAt": "2026-03-11T10:00:18Z",
  "summary": {
    "title": "Риски",
    "shortText": "Найдено 8 потенциально рискованных фрагментов",
    "counters": [
      { "key": "high", "label": "Высокий риск", "value": 2 },
      { "key": "medium", "label": "Средний риск", "value": 4 },
      { "key": "low", "label": "Низкий риск", "value": 2 }
    ]
  },
  "metrics": {
    "durationMs": 18000,
    "confidence": 0.86,
    "model": "gpt-5"
  },
  "findings": [
    {
      "id": "risk-1",
      "type": "liability_clause",
      "title": "Неограниченная ответственность одной стороны",
      "description": "Формулировка перекладывает существенную ответственность на исполнителя без верхнего лимита",
      "severity": "high",
      "confidence": 0.91,
      "quote": "Исполнитель несет ответственность за любые убытки...",
      "suggestion": "Добавить лимит ответственности и исключения",
      "anchor": {
        "targetType": "document",
        "page": 3,
        "textRange": { "start": 1204, "end": 1288 }
      }
    }
  ],
  "overlays": [
    {
      "id": "overlay-1",
      "type": "highlight",
      "label": "Высокий риск",
      "severity": "high",
      "findingId": "risk-1",
      "anchor": {
        "targetType": "document",
        "page": 3,
        "textRange": { "start": 1204, "end": 1288 }
      },
      "interactive": true
    }
  ],
  "actions": [
    {
      "id": "show-risk-overlays",
      "label": "Показать подсветку рисков",
      "slot": "document_toolbar",
      "actionType": "toggle_overlay"
    }
  ],
  "panels": [
    {
      "id": "risk-details",
      "title": "Детали риска",
      "slot": "inspector_panel",
      "panelType": "details",
      "data": {
        "findingIds": ["risk-1"]
      }
    }
  ]
}
```

---

## 11. Пример output: Speech Transcription

```json
{
  "pluginId": "speech_transcription",
  "pluginVersion": "1.0.0",
  "status": "completed",
  "startedAt": "2026-03-11T10:00:00Z",
  "finishedAt": "2026-03-11T10:01:10Z",
  "summary": {
    "title": "Расшифровка речи",
    "shortText": "Готово: 24 минуты, 3 спикера, 12 action items",
    "counters": [
      { "key": "speakers", "label": "Спикеры", "value": 3 },
      { "key": "tasks", "label": "Задачи", "value": 12 }
    ]
  },
  "findings": [
    {
      "id": "task-1",
      "type": "action_item",
      "title": "Подготовить новую редакцию договора",
      "severity": "medium",
      "anchor": {
        "targetType": "audio",
        "timestampMs": 345000
      },
      "metadata": {
        "speaker": "Speaker 2"
      }
    }
  ],
  "actions": [
    {
      "id": "open-transcript",
      "label": "Открыть transcript",
      "slot": "right_sidebar",
      "actionType": "open_panel"
    }
  ],
  "panels": [
    {
      "id": "transcript-panel",
      "title": "Transcript",
      "slot": "bottom_panel",
      "panelType": "transcript",
      "data": {
        "segments": [
          {
            "speaker": "Speaker 1",
            "startMs": 0,
            "endMs": 6000,
            "text": "Добрый день, предлагаю обсудить финальную редакцию договора"
          }
        ]
      }
    }
  ]
}
```

---

## 12. Plugin Registry

Нужен единый registry, который знает:
- какие плагины доступны;
- какие совместимы с текущим input;
- какие доступны по тарифу;
- какие авто-включаются;
- как строить правую панель.

```ts
export interface RegisteredPlugin {
  manifest: PluginManifest
  factory: () => Promise<SmartAnalyzerPlugin>
}

export interface SmartAnalyzerPlugin {
  setup(context: PluginSetupContext): Promise<void>
  canHandle(input: WorkspaceInput): Promise<boolean>
  run(input: WorkspaceInput, context: PluginRunContext): Promise<PluginExecutionResult>
  dispose?(): Promise<void>
}
```

---

## 13. Frontend архитектура

## 13.1. Основные сущности
- `PluginRegistry`
- `WorkspaceShell`
- `PluginSidebar`
- `PluginStore`
- `OverlayRenderer`
- `PluginPanelHost`
- `ToolbarExtensionsHost`

## 13.2. Состояние
Хранить:
- список доступных плагинов;
- compatibility map;
- enabled/disabled;
- statuses;
- last results;
- overlays visibility;
- active finding;
- open panels.

### Пример store

```ts
interface PluginState {
  plugins: Record<string, PluginManifest>
  statusByPlugin: Record<string, PluginLifecycleState>
  enabledByPlugin: Record<string, boolean>
  resultByPlugin: Record<string, PluginExecutionResult | null>
  visibleOverlayByPlugin: Record<string, boolean>
  activeFindingId?: string
  openPanelIds: string[]
}
```

## 13.3. Рендеринг
- `PluginSidebar` отображает карточки модулей;
- `OverlayRenderer` рисует overlays по standardized output;
- `PluginPanelHost` рендерит панели в bottom/inspector зоне;
- toolbar собирается из действий всех активных плагинов.

---

## 14. Backend архитектура

## 14.1. Что делает backend
- принимает запрос на запуск plugin execution;
- определяет входной тип и совместимость;
- запускает pipeline плагина;
- сохраняет результаты;
- отдает статусы и partial results;
- журналирует usage;
- привязывает результаты к document_id / analysis_id.

## 14.2. Рекомендуемая структура
- `backend/app/plugins/base.py`
- `backend/app/plugins/registry.py`
- `backend/app/plugins/contracts.py`
- `backend/app/plugins/executors/`
- `backend/app/plugins/implementations/risk_analyzer/`
- `backend/app/plugins/implementations/spellcheck/`
- `backend/app/plugins/implementations/speech_transcription/`

## 14.3. Базовый интерфейс backend plugin

```py
class PluginResult(BaseModel):
    plugin_id: str
    plugin_version: str
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    summary: dict | None = None
    metrics: dict | None = None
    findings: list[dict] = []
    overlays: list[dict] = []
    actions: list[dict] = []
    panels: list[dict] = []
    raw: dict | None = None
    error: dict | None = None

class BasePlugin(Protocol):
    plugin_id: str
    async def can_handle(self, input_data: dict) -> bool: ...
    async def run(self, input_data: dict) -> PluginResult: ...
```

---

## 15. База данных

Минимально потребуется хранить:

### plugin_definitions
- id
- version
- name
- description
- category
- required_plan
- supported_inputs jsonb
- capabilities jsonb
- ui_slots jsonb
- is_active
- created_at

### plugin_executions
- id
- user_id
- document_id nullable
- analysis_id nullable
- plugin_id
- plugin_version
- status
- started_at
- finished_at nullable
- result_json jsonb
- error_json jsonb nullable
- duration_ms nullable
- created_at

### workspace_enabled_plugins
- id
- user_id
- workspace_type
- workspace_entity_id
- plugin_id
- is_enabled
- created_at

---

## 16. API

## 16.1. Получить доступные плагины
`GET /api/v1/plugins`

Ответ:
- список плагинов;
- метаданные;
- доступность по тарифу.

## 16.2. Получить совместимые плагины для файла
`GET /api/v1/workspaces/{entityId}/plugins`

## 16.3. Включить/выключить плагин
`POST /api/v1/workspaces/{entityId}/plugins/{pluginId}/toggle`

Body:
```json
{ "enabled": true }
```

## 16.4. Запустить плагин
`POST /api/v1/workspaces/{entityId}/plugins/{pluginId}/run`

## 16.5. Получить статус плагина
`GET /api/v1/plugin-executions/{executionId}`

## 16.6. Получить результаты всех плагинов workspace
`GET /api/v1/workspaces/{entityId}/plugin-results`

---

## 17. MVP набор плагинов

## 17.1. Базовые
1. Summary
2. Key Points
3. Dates & Deadlines
4. Parties & Requisites
5. Spellcheck

## 17.2. Юридические
6. Risk Analyzer
7. Missing Clauses
8. Liability / Penalty Checker
9. Ambiguous Wording Detector

## 17.3. Умные
10. Q&A over document
11. Suggested Edits
12. Compare With Template

## 17.4. Медиа
13. Speech Transcription
14. Meeting Summary
15. Action Items Extractor

---

## 18. Тарифы и монетизация

## Free
- Summary
- Key Points
- Basic Spellcheck

## Pro
- Risks
- Dates
- Requisites
- Missing Clauses
- Speech Transcription
- Suggested Edits

## Enterprise
- Team rules
- Custom plugins
- Private plugin packs
- API access
- Company-specific checklists
- Audit logs

### Будущие пакеты
- Legal Pack
- Tender Pack
- Meeting Pack
- Finance Pack
- HR Pack

---

## 19. Ограничения и guardrails

### 19.1. Безопасность UI
Плагин не должен:
- выполнять произвольный UI code injection;
- менять layout root;
- ломать чужие extension points;
- делать side effects вне контракта.

### 19.2. Производительность
- lazy load plugin bundles;
- запуск только совместимых плагинов;
- кэширование результатов;
- стрим статусов;
- partial rendering.

### 19.3. Надежность
- timeout на plugin execution;
- graceful fallback;
- retry;
- error badge в UI;
- журналирование ошибок.

---

## 20. Рекомендация по этапам внедрения

## Phase 1 — Plugin-ready UI
Сделать:
- правую панель модулей;
- status model;
- единый result contract;
- базовые карточки;
- простые toggles.

Без полноценного dynamic UI injection — только controlled sidebar.

## Phase 2 — Overlays и panels
Добавить:
- highlight overlays;
- inspector panel;
- bottom panel;
- toolbar actions.

## Phase 3 — Composite plugins
Добавить:
- speech transcription;
- compare versions;
- suggested edits;
- template matching.

## Phase 4 — Plugin packs и enterprise
Добавить:
- тарифные паки;
- кастомные правила компании;
- private plugins;
- team admin UI.

---

## 21. Что делать сейчас

Рекомендуемый ближайший scope:
1. Ввести сущность plugin manifest.
2. Сделать правую панель “Подключенные модули”.
3. Подключить 5 базовых модулей к единому output contract.
4. Добавить status pipeline: queued / running / completed / failed.
5. Добавить overlay layer для highlights.
6. Добавить inspector panel по клику на finding.

Этого достаточно, чтобы продукт уже воспринимался как modular AI workspace.

---

## 22. Prompt для Cursor

```text
Нужно реализовать plugin-based architecture для SmartAnalyzer.

Контекст:
- продукт должен поддерживать расширяемые модули анализа;
- справа от документа должна быть панель подключенных модулей;
- каждый модуль имеет manifest, статус, совместимость с input type и standardized output;
- модули не могут менять UI произвольно, только через разрешенные UI slots;
- поддержать как минимум: right_sidebar, document_toolbar, bottom_panel, inspector_panel, document_overlay;
- нужен единый result contract: summary, findings, overlays, actions, panels, metrics, error;
- падение одного плагина не должно ломать весь workspace;
- должны поддерживаться статусы: available, enabled, disabled, queued, running, completed, partial, failed, locked.

Что нужно сделать:
1. Создать базовые типы plugin manifest, plugin execution result, findings, overlays, actions, panels.
2. Создать plugin registry.
3. Создать store состояния плагинов на frontend.
4. Сделать UI правой панели модулей.
5. Сделать controlled rendering для overlays и panel host.
6. Реализовать минимум 2 demo plugins:
   - risk_analyzer
   - speech_transcription
7. Сделать API слой для:
   - получения списка плагинов
   - получения совместимых плагинов для workspace
   - toggle enable/disable
   - run plugin
   - get plugin results
8. Сохранить архитектуру расширяемой и безопасной.

Требования:
- чистая модульная структура;
- без хаотичного coupling;
- типы должны быть едиными для frontend/backend там, где возможно;
- UI должен быть готов к постепенному появлению результатов;
- все решения должны быть совместимы с будущими plugin packs и enterprise custom plugins.

Сначала покажи итоговую структуру файлов и ключевые интерфейсы, затем реализуй код по этапам.
```

