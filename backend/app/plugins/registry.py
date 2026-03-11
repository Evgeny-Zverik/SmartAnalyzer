from __future__ import annotations

from app.plugins.implementations.document_plugins import (
    DatesDeadlinesPlugin,
    KeyPointsPlugin,
    RiskAnalyzerPlugin,
    SpeechTranscriptionPlugin,
    SuggestedEditsPlugin,
    SummaryPlugin,
)


PLUGIN_REGISTRY = {
    "summary": SummaryPlugin(),
    "key_points": KeyPointsPlugin(),
    "dates_deadlines": DatesDeadlinesPlugin(),
    "risk_analyzer": RiskAnalyzerPlugin(),
    "suggested_edits": SuggestedEditsPlugin(),
    "speech_transcription": SpeechTranscriptionPlugin(),
}


def list_registered_plugins():
    return list(PLUGIN_REGISTRY.values())


def get_registered_plugin(plugin_id: str):
    return PLUGIN_REGISTRY.get(plugin_id)
