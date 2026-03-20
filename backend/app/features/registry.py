from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

FeatureModuleKind = Literal["feature", "module"]
FeaturePlan = Literal["free", "pro", "enterprise"]


@dataclass(frozen=True)
class FeatureModuleDefinition:
    key: str
    name: str
    description: str
    example: str
    kind: FeatureModuleKind
    required_plan: FeaturePlan = "free"
    default_enabled: bool = True
    parent_key: str | None = None
    plugin_id: str | None = None
    sort_order: int = 0


FEATURE_DEFINITIONS = [
    FeatureModuleDefinition(
        key="document_analyzer",
        name="Document Analyzer",
        description="Хост-фича анализатора документов и его workspace.",
        example='''upload("contract.docx")
enable("key_points", "risk_analyzer")
run_analysis()''',
        kind="feature",
        sort_order=100,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.key_points",
        name="Key Points",
        description="Ключевые пункты документа.",
        example='''- Срок поставки: 10 дней
- Оплата: 100% постоплата
- Ответственность сторон ограничена''',
        kind="module",
        parent_key="document_analyzer",
        plugin_id="key_points",
        sort_order=110,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.encryption",
        name="Encryption",
        description="Шифрование загрузки, хранения и результатов анализа.",
        example='''upload.enc -> decrypt transport
storage.bin -> encrypt at rest
result.json -> protected''',
        kind="module",
        parent_key="document_analyzer",
        sort_order=115,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.anonymization",
        name="Anonymization",
        description="Обезличивание персональных данных перед отправкой текста в LLM.",
        example='''ivan.petrov@corp.ru -> xxxx.xxxxxx@xxxx.xx
+7 999 123-45-67 -> +0 000 000-00-00
www.company.ru -> www.xxxxxxx.xx''',
        kind="module",
        parent_key="document_analyzer",
        sort_order=116,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.ai_inspector",
        name="AI Inspector",
        description="Объединенный модуль замечаний: риски, улучшения и правая панель инспектора.",
        example='''[RISK] Неограниченная ответственность
-> Показать фрагмент, объяснение и правку

Очередь: 4 замечания
Rewrite: "в течение 3 дней..."''',
        kind="module",
        parent_key="document_analyzer",
        sort_order=117,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.dates_deadlines",
        name="Dates & Deadlines",
        description="Извлечение дат, сроков и дедлайнов.",
        example='''2026-03-20  Подписание договора
2026-03-25  Оплата счета
2026-04-01  Крайний срок поставки''',
        kind="module",
        parent_key="document_analyzer",
        plugin_id="dates_deadlines",
        sort_order=120,
    ),
    FeatureModuleDefinition(
        key="handwriting_recognition",
        name="Распознавание рукописных документов",
        description="OCR-фича для рукописных текстов, заявлений, анкет и архивных материалов.",
        example='''scan("statement.jpg")
recognize_handwriting()
export_editable_text()''',
        kind="feature",
        sort_order=200,
    ),
    FeatureModuleDefinition(
        key="contract_checker",
        name="AI Юрист",
        description="Юридическая проверка договоров, поиск рисков и проблемных формулировок.",
        example='''upload("agreement.docx")
check_contract()
review_risky_clauses()''',
        kind="feature",
        sort_order=210,
    ),
    FeatureModuleDefinition(
        key="data_extractor",
        name="Сравнение документов",
        description="Сопоставление версий документа и извлечение отличий по тексту, срокам и обязательствам.",
        example='''upload("v1.docx", "v2.docx")
compare_versions()
export_changes()''',
        kind="feature",
        sort_order=220,
    ),
    FeatureModuleDefinition(
        key="tender_analyzer",
        name="Обзор судебной практики",
        description="Подбор судебной практики, актов и применимых норм по аналогичным спорам.",
        example='''search_case_law(region="77")
collect_court_acts()
build_legal_review()''',
        kind="feature",
        sort_order=230,
    ),
    FeatureModuleDefinition(
        key="risk_analyzer",
        name="Анализатор рисков",
        description="Отдельная фича оценки рисков и рекомендаций вне хоста document analyzer.",
        example='''upload("project.pdf")
score_risks()
generate_recommendations()''',
        kind="feature",
        sort_order=240,
    ),
    FeatureModuleDefinition(
        key="legal_style_translator",
        name="Перевод на юридический",
        description="Приводит текст сообщения без вложений к официально-деловому стилю.",
        example='''input("Просьба оплатить до пятницы")
rewrite_legal_style()
return_formal_message()''',
        kind="feature",
        sort_order=250,
    ),
    FeatureModuleDefinition(
        key="legal_text_simplifier",
        name="Пересказ юридического текста",
        description="Передаёт смысл юридических текстов более простым языком.",
        example='''input("Сторона обязуется...")
simplify_legal_text()
return_plain_explanation()''',
        kind="feature",
        sort_order=260,
    ),
    FeatureModuleDefinition(
        key="spelling_checker",
        name="Проверка правописания",
        description="Исправляет ошибки в орфографии и пунктуации в тексте.",
        example='''input("Прошу вас рассматреть...")
check_spelling()
return_corrected_text()''',
        kind="feature",
        sort_order=270,
    ),
    FeatureModuleDefinition(
        key="foreign_language_translator",
        name="Перевод с иностранного языка",
        description="Переводит сообщения без вложений на русский язык.",
        example='''input("Please provide payment details")
translate_to_ru()
return_translated_text()''',
        kind="feature",
        sort_order=280,
    ),
    FeatureModuleDefinition(
        key="legal_document_design_review",
        name="Дизайн юридических документов",
        description="Проверяет структуру, язык и технику юридических документов.",
        example='''input("draft agreement text")
review_legal_document_design()
return_structural_feedback()''',
        kind="feature",
        sort_order=290,
    ),
]

FEATURES_BY_KEY = {definition.key: definition for definition in FEATURE_DEFINITIONS}
FEATURES_BY_PLUGIN_ID = {
    definition.plugin_id: definition
    for definition in FEATURE_DEFINITIONS
    if definition.plugin_id is not None
}
FEATURE_KEY_BY_PLUGIN_ID = {
    "risk_analyzer": "document_analyzer.ai_inspector",
    "suggested_edits": "document_analyzer.ai_inspector",
}


def list_feature_definitions() -> list[FeatureModuleDefinition]:
    return sorted(FEATURE_DEFINITIONS, key=lambda definition: definition.sort_order)


def get_feature_definition(feature_key: str) -> FeatureModuleDefinition | None:
    return FEATURES_BY_KEY.get(feature_key)


def get_feature_definition_for_plugin(plugin_id: str) -> FeatureModuleDefinition | None:
    aliased_key = FEATURE_KEY_BY_PLUGIN_ID.get(plugin_id)
    if aliased_key is not None:
        return FEATURES_BY_KEY.get(aliased_key)
    return FEATURES_BY_PLUGIN_ID.get(plugin_id)


def get_feature_key_for_plugin(plugin_id: str) -> str | None:
    if plugin_id in FEATURE_KEY_BY_PLUGIN_ID:
        return FEATURE_KEY_BY_PLUGIN_ID[plugin_id]
    definition = FEATURES_BY_PLUGIN_ID.get(plugin_id)
    return definition.key if definition is not None else None
