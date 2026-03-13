from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.user import User

DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY = "document_analyzer.anonymization"

_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"(?<!\w)(?:\+?\d[\d\-\(\)\s]{8,}\d)(?!\w)"),
    re.compile(r"\b(?:https?://|www\.)\S+\b", re.IGNORECASE),
    re.compile(
        r"\b(?:ООО|ОАО|ЗАО|ПАО|АО|ИП|LLC|Inc\.?|Ltd\.?|Corp\.?|GmbH)\s*"
        r"(?:[\"'«][^\"'»\n]{2,120}[\"'»]|[A-ZА-ЯЁ][^\n,;]{2,120})",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:ИНН|КПП|ОГРН|ОГРНИП|БИК|IBAN|SWIFT(?:/BIC)?|р/с|к/с|расч[её]тный\s+сч[её]т|"
        r"корр(?:еспондентский)?\s+сч[её]т)\s*[:№#]?\s*[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9\-\s]{3,40}",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:паспорт|passport)\s*(?:рф|гражданина\s+рф)?"
        r"(?:\s*(?:серия|series))?\s*[:№#]?\s*\d{2}\s?\d{2}\s?\d{6}\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:серия|series)\s*[:№#]?\s*\d{2}\s?\d{2}"
        r"(?:\s*(?:номер|no\.?|number)\s*[:№#]?\s*\d{6})?\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b\d{2}\s?\d{2}\s?\d{6}\b"),
    re.compile(
        r"\b(?:адрес|address|зарегистрирован(?:а|о)?\s+по\s+адресу|место\s+жительства)"
        r"\s*:\s*[^\n]{8,160}",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:г\.?|город|пос\.?|поселок|с\.?|село|дер\.?|деревня|ул\.?|улица|проспект|пр-кт|"
        r"переулок|пер\.?|бул\.?|бульвар|наб\.?|набережная|ш\.?|шоссе|дом|д\.|корп\.?|корпус|"
        r"стр\.?|строение|кв\.?|квартира|оф\.?|офис)\s+[^\n,;]{2,120}",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
    re.compile(r"\b\d{6}\b"),
    re.compile(r"\b\d{10}\b"),
    re.compile(r"\b\d{12}\b"),
    re.compile(r"\b\d{20}\b"),
    re.compile(r"\b[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?\b"),
    re.compile(
        r"\b[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?\s+[А-ЯЁA-Z]\.\s*[А-ЯЁA-Z]\."
        r"(?=$|[^\w])"
    ),
    re.compile(
        r"\b[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?"
        r"(?:\s+[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?){1,2}\b"
    ),
    re.compile(
        r"\b[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?(?=\s*(?:/|\||_))"
    ),
    re.compile(
        r"(?:(?<=/)|(?<=\|)|(?<=_))\s*[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?\s*(?=/|\||_)"
    ),
)


def is_document_analyzer_anonymization_enabled(db: Session, user: User) -> bool:
    from app.features.service import get_resolved_feature_state

    state = get_resolved_feature_state(db, user, DOCUMENT_ANALYZER_ANONYMIZATION_FEATURE_KEY)
    return bool(state and state.effective_enabled)


def anonymize_text_for_llm(*, db: Session, user: User, text: str) -> str:
    if not is_document_analyzer_anonymization_enabled(db, user):
        return text

    masked = text
    for pattern in _PATTERNS:
        masked = pattern.sub(_mask_match, masked)
    return masked


def _mask_match(match: re.Match[str]) -> str:
    value = match.group(0)
    return "".join(_mask_char(char) for char in value)


def _mask_char(char: str) -> str:
    if char.isdigit():
        return "0"
    if char.isalpha():
        return "X" if char.isupper() else "x"
    return char
