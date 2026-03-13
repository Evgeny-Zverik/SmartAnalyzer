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
        key="document_analyzer.risk_analyzer",
        name="Risk Analyzer",
        description="Поиск рискованных формулировок и рекомендаций.",
        example='''[HIGH] "Исполнитель несет ответственность за любые убытки"
-> Ограничить ответственность размером оплаты по договору''',
        kind="module",
        parent_key="document_analyzer",
        plugin_id="risk_analyzer",
        sort_order=130,
    ),
    FeatureModuleDefinition(
        key="document_analyzer.suggested_edits",
        name="Suggested Edits",
        description="Предложения по переписыванию и улучшению текста.",
        example='''Было: "Стороны обязуются незамедлительно..."
Стало: "Каждая сторона обязуется в течение 3 дней..."''',
        kind="module",
        parent_key="document_analyzer",
        plugin_id="suggested_edits",
        sort_order=140,
    ),
]

FEATURES_BY_KEY = {definition.key: definition for definition in FEATURE_DEFINITIONS}
FEATURES_BY_PLUGIN_ID = {
    definition.plugin_id: definition
    for definition in FEATURE_DEFINITIONS
    if definition.plugin_id is not None
}


def list_feature_definitions() -> list[FeatureModuleDefinition]:
    return sorted(FEATURE_DEFINITIONS, key=lambda definition: definition.sort_order)


def get_feature_definition(feature_key: str) -> FeatureModuleDefinition | None:
    return FEATURES_BY_KEY.get(feature_key)


def get_feature_definition_for_plugin(plugin_id: str) -> FeatureModuleDefinition | None:
    return FEATURES_BY_PLUGIN_ID.get(plugin_id)
