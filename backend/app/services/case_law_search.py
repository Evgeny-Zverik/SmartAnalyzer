from __future__ import annotations

import base64
import json
import re
from urllib import error, request
import xml.etree.ElementTree as ET

from app.core.config import settings
from app.core.logging import logger
from app.schemas.tools import (
    AmountStats,
    CaseLawReferenceItem,
    CourtPositionItem,
    OutcomeSummary,
    TenderAnalyzerResult,
)
from app.services.llm_client import _build_openai_client, _coerce_json_payload, _create_completion

REGION_HINT_PATTERNS = (
    r"\b(?:[а-яё-]+(?:ая|ой|ий|ый|ский|ская)\s+){1,2}(?:область|край|автономный округ|автономная область)\b",
    r"\b(?:республика\s+[а-яё-]+(?:\s+[а-яё-]+)?)\b",
    r"\b(?:москва|санкт-петербург|севастополь)\b",
)
SEARCH_STOP_WORDS = {
    "практика",
    "суд",
    "суда",
    "суды",
    "судов",
    "область",
    "области",
    "край",
    "республика",
    "арбитраж",
    "ссылки",
    "акты",
    "актов",
    "регион",
    "по",
    "о",
    "на",
    "и",
}
ARBITRAZH_ONLY_HINTS = {"арбитраж", "арбитражный", "арбитражных"}
GENERAL_JURISDICTION_HINTS = {"общей юрисдикции", "районный суд", "областной суд", "кассационный суд"}
REGION_MENTION_PATTERN = re.compile(
    r"\b(?:[а-яё-]+\s+){0,3}(?:области|область|края|край|республики|республика|автономного округа|автономный округ|автономной области|автономная область)\b",
    flags=re.IGNORECASE,
)


# Юрисдикции кассационных судов общей юрисдикции.
# Ключ — номер КСОЮ (поддомен Nkas.sudrf.ru), значение — списки токенов из _REGION_ALIASES,
# входящих в округ. Если в запросе регион, то разрешён только его КСОЮ.
CASSATION_DISTRICTS: dict[int, set[str]] = {
    1: {"брянск", "белгород", "воронеж", "калуга", "калужск", "курск", "липецк",
        "московск", "орёл", "орел", "орлов", "рязан", "смолен", "тамбов", "тверск", "тверь", "тульск", "тула"},
    2: {"москва", "владимир", "ярослав"},
    3: {"санкт", "петербург", "ленинград", "ленинградск", "архангельск", "вологод",
        "калининград", "мурманск"},
    4: {"краснодар", "ставропол", "ростов", "волгоград", "крым", "симферопол", "севастопол",
        "дагестан", "махачкала", "чечен", "грозн"},
    6: {"самар", "нижегород", "нижний новгород", "пенз", "оренбург", "саратов", "ульянов",
        "казан", "татар", "башкир", "башкортостан", "уфа", "удмурт", "ижевск", "чуваш",
        "чебоксар", "марий", "йошкар", "мордов", "саранск", "пермск", "пермь", "кировск", "киров"},
    7: {"свердлов", "екатеринбург", "тюмен", "челябинск"},
    8: {"алтайск", "барнаул", "кемеров", "кузбасс", "новосибирск", "омск", "красноярск", "иркутск"},
    9: {"приморск", "владивосток", "хабаров"},
}

# Поддомены апелляционных судов общей юрисдикции (1ap..5ap.sudrf.ru).
APPEAL_DOMAIN_PATTERN = re.compile(r"\b([1-5])ap\.sudrf\.ru\b", flags=re.IGNORECASE)
CASSATION_DOMAIN_PATTERN = re.compile(r"\b([1-9])kas\.sudrf\.ru\b", flags=re.IGNORECASE)

# Поддомены sudrf.ru, сопоставленные с токенами регионов из _REGION_ALIASES.
# Ключ — латинский код региона (вторая часть хоста типа `bgvs.amr.sudrf.ru`),
# значение — токен, который также присутствует в _REGION_ALIASES.
SUDRF_REGION_CODES: dict[str, str] = {
    "msk": "москва",
    "mos": "московск",
    "spb": "санкт",
    "lo": "ленинградск",
    "krd": "краснодар",
    "stv": "ставропол",
    "ros": "ростов",
    "vol": "волгоград",
    "ast": "астрахан",
    "amr": "амур",
    "chel": "челябинск",
    "svd": "свердлов",
    "sam": "самар",
    "sar": "саратов",
    "pnz": "пенз",
    "nnov": "нижегород",
    "nsk": "новосибирск",
    "oms": "омск",
    "tum": "тюмен",
    "krk": "красноярск",
    "alt": "алтайск",
    "kem": "кемеров",
    "irk": "иркутск",
    "hab": "хабаров",
    "prm": "пермск",
    "bel": "белгород",
    "brj": "брянск",
    "vrn": "воронеж",
    "klg": "калужск",
    "kln": "калининград",
    "krs": "курск",
    "lip": "липецк",
    "orl": "орлов",
    "rzn": "рязан",
    "smol": "смолен",
    "tmb": "тамбов",
    "tvr": "тверск",
    "tul": "тульск",
    "vld": "владимир",
    "yar": "ярослав",
    "ivn": "иваново",
    "vlg": "вологод",
    "mrm": "мурманск",
    "ark": "архангельск",
    "uln": "ульянов",
    "kir": "киров",
    "udm": "удмурт",
    "tat": "татар",
    "bkr": "башкир",
    "chv": "чуваш",
    "mel": "марий",
    "mor": "мордов",
    "oren": "оренбург",
    "krm": "крым",
    "sev": "севастопол",
    "dag": "дагестан",
    "che": "чечен",
    "vs": "приморск",
}

SUDRF_HOST_PATTERN = re.compile(r"([a-z]{2,5})\.sudrf\.ru\b", flags=re.IGNORECASE)


def _sudrf_region_token(url: str) -> str | None:
    match = SUDRF_HOST_PATTERN.search(url.lower())
    if not match:
        return None
    return SUDRF_REGION_CODES.get(match.group(1).lower())


ARBITRAZH_CASE_PATTERN = re.compile(r"\b[аa](\d{2,3})-\d+/\d{4}\b", flags=re.IGNORECASE)


def _arbitrazh_case_prefix(item: dict[str, str]) -> str | None:
    haystack = " ".join(
        [
            item.get("title", ""),
            item.get("snippet", ""),
            item.get("citation", ""),
            item.get("url", ""),
        ]
    )
    match = ARBITRAZH_CASE_PATTERN.search(haystack)
    if not match:
        return None
    return f"А{match.group(1)}"


INSTANCE_HINTS: dict[str, tuple[str, ...]] = {
    "cassation": ("кассац",),
    "appeal": ("апелляц",),
    "first": ("первой инстанции", "первая инстанция", "районный суд", "районного суда",
              "мировой судья", "городской суд", "городского суда"),
    "supreme": ("верховный суд", "верховного суда"),
}

# Тематические нормы: по ключевым словам запроса добавляются релевантные статьи.
TOPIC_ARTICLES: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    (
        ("неустойк", "пеня", "пени"),
        (
            "Статья 330 ГК РФ — понятие неустойки и условия её взыскания.",
            "Статья 331 ГК РФ — форма соглашения о неустойке.",
            "Статья 333 ГК РФ — снижение неустойки при явной несоразмерности.",
            "Статья 395 ГК РФ — ответственность за неисполнение денежного обязательства.",
            "Статья 401 ГК РФ — основания ответственности за нарушение обязательства.",
        ),
    ),
    (
        ("просрочк", "задержк"),
        (
            "Статья 405 ГК РФ — просрочка должника.",
            "Статья 406 ГК РФ — просрочка кредитора.",
            "Статья 395 ГК РФ — проценты за пользование чужими денежными средствами.",
        ),
    ),
    (
        ("поставк", "поставщик", "покупател"),
        (
            "Статья 506 ГК РФ — договор поставки.",
            "Статья 513 ГК РФ — принятие товаров покупателем.",
            "Статья 518 ГК РФ — последствия поставки товаров ненадлежащего качества.",
            "Статья 520 ГК РФ — права покупателя при нарушении сроков поставки.",
            "Статья 521 ГК РФ — неустойка за недопоставку или просрочку поставки.",
            "Статья 523 ГК РФ — односторонний отказ от исполнения договора поставки.",
        ),
    ),
    (
        ("подряд", "подрядчик", "заказчик работ"),
        (
            "Статья 702 ГК РФ — договор подряда.",
            "Статья 708 ГК РФ — сроки выполнения работ.",
            "Статья 715 ГК РФ — права заказчика во время выполнения работы.",
            "Статья 723 ГК РФ — ответственность подрядчика за ненадлежащее качество.",
        ),
    ),
    (
        ("аренд", "арендодател", "арендатор"),
        (
            "Статья 606 ГК РФ — договор аренды.",
            "Статья 614 ГК РФ — арендная плата.",
            "Статья 619 ГК РФ — досрочное расторжение по требованию арендодателя.",
            "Статья 622 ГК РФ — возврат арендованного имущества.",
        ),
    ),
    (
        ("заем", "займ", "кредит"),
        (
            "Статья 807 ГК РФ — договор займа.",
            "Статья 809 ГК РФ — проценты по договору займа.",
            "Статья 811 ГК РФ — последствия нарушения заёмщиком договора займа.",
        ),
    ),
    (
        ("неоснователь", "обогащен"),
        (
            "Статья 1102 ГК РФ — обязанность возвратить неосновательное обогащение.",
            "Статья 1107 ГК РФ — возмещение доходов от неосновательного обогащения.",
        ),
    ),
    (
        ("убытк", "возмещен"),
        (
            "Статья 15 ГК РФ — возмещение убытков.",
            "Статья 393 ГК РФ — обязанность должника возместить убытки.",
        ),
    ),
    (
        ("труд", "работник", "работодател", "увольнен", "восстановлен"),
        (
            "Статья 77 ТК РФ — общие основания прекращения трудового договора.",
            "Статья 81 ТК РФ — расторжение по инициативе работодателя.",
            "Статья 394 ТК РФ — вынесение решений по трудовым спорам об увольнении.",
        ),
    ),
]

BASE_LEGAL_ARTICLES = (
    "Статьи 309 и 310 ГК РФ — надлежащее исполнение обязательств и недопустимость одностороннего отказа.",
    "Статья 431 ГК РФ — толкование условий договора с учётом буквального смысла и поведения сторон.",
)


def _detect_instance(query: str) -> str | None:
    q = query.lower()
    for instance, hints in INSTANCE_HINTS.items():
        if any(hint in q for hint in hints):
            return instance
    return None


def _cassation_district_for_region(region_label: str) -> int | None:
    lower = region_label.lower()
    for number, tokens in CASSATION_DISTRICTS.items():
        if any(token in lower for token in tokens):
            return number
    return None


def _derive_legal_basis(query: str) -> list[str]:
    q = query.lower()
    articles: list[str] = []
    seen: set[str] = set()
    for keywords, items in TOPIC_ARTICLES:
        if any(kw in q for kw in keywords):
            for item in items:
                if item not in seen:
                    seen.add(item)
                    articles.append(item)
    if not articles:
        return list(BASE_LEGAL_ARTICLES) + [
            "Статья 65 АПК РФ или статья 56 ГПК РФ — бремя доказывания в зависимости от вида суда.",
        ]
    for item in BASE_LEGAL_ARTICLES:
        if item not in seen:
            articles.append(item)
    articles.append("Статья 65 АПК РФ или статья 56 ГПК РФ — бремя доказывания в зависимости от вида суда.")
    return articles


_REGION_ALIASES: list[tuple[tuple[str, ...], str, str]] = [
    (("брянск", "брянской", "брянская"), "Брянская область", "А09"),
    (("москва",), "Москва", "А40"),
    (("санкт", "петербург", "ленинград"), "Санкт-Петербург", "А56"),
    (("калуга", "калужск",), "Калужская область", "А23"),
    (("краснодар",), "Краснодарский край", "А32"),
    (("ростов",), "Ростовская область", "А53"),
    (("новосибирск",), "Новосибирская область", "А45"),
    (("свердлов", "екатеринбург"), "Свердловская область", "А60"),
    (("нижегород", "нижний новгород"), "Нижегородская область", "А43"),
    (("казан", "татар",), "Республика Татарстан", "А65"),
    (("самар",), "Самарская область", "А55"),
    (("челябинск",), "Челябинская область", "А76"),
    (("воронеж",), "Воронежская область", "А14"),
    (("красноярск",), "Красноярский край", "А33"),
    (("волгоград",), "Волгоградская область", "А12"),
    (("саратов",), "Саратовская область", "А57"),
    (("тюмен",), "Тюменская область", "А70"),
    (("омск",), "Омская область", "А46"),
    (("башкир", "башкортостан", "уфа"), "Республика Башкортостан", "А07"),
    (("пермск", "пермь"), "Пермский край", "А50"),
    (("иркутск",), "Иркутская область", "А19"),
    (("хабаров",), "Хабаровский край", "А73"),
    (("владивосток", "приморск",), "Приморский край", "А51"),
    (("ставропол",), "Ставропольский край", "А63"),
    (("тульск", "тула"), "Тульская область", "А68"),
    (("рязан",), "Рязанская область", "А54"),
    (("орёл", "орел", "орлов",), "Орловская область", "А48"),
    (("смолен",), "Смоленская область", "А62"),
    (("тверск", "тверь"), "Тверская область", "А66"),
    (("ярослав",), "Ярославская область", "А82"),
    (("владимир",), "Владимирская область", "А11"),
    (("ленинградск",), "Ленинградская область", "А56"),
    (("московск",), "Московская область", "А41"),
    (("крым", "симферопол"), "Республика Крым", "А83"),
    (("севастопол",), "Севастополь", "А84"),
    (("дагестан", "махачкала"), "Республика Дагестан", "А15"),
    (("чечен", "грозн",), "Чеченская Республика", "А77"),
    (("кемеров", "кузбасс"), "Кемеровская область", "А27"),
    (("алтайск", "барнаул"), "Алтайский край", "А03"),
    (("мурманск",), "Мурманская область", "А42"),
    (("архангельск",), "Архангельская область", "А05"),
    (("вологод",), "Вологодская область", "А13"),
    (("калининград",), "Калининградская область", "А21"),
    (("курск",), "Курская область", "А35"),
    (("белгород",), "Белгородская область", "А08"),
    (("липецк",), "Липецкая область", "А36"),
    (("тамбов",), "Тамбовская область", "А64"),
    (("пенз",), "Пензенская область", "А49"),
    (("ульянов",), "Ульяновская область", "А72"),
    (("оренбург",), "Оренбургская область", "А47"),
    (("удмурт", "ижевск"), "Удмуртская Республика", "А71"),
    (("чуваш", "чебоксар"), "Чувашская Республика", "А79"),
    (("кировск", "киров"), "Кировская область", "А28"),
    (("марий", "йошкар"), "Республика Марий Эл", "А38"),
    (("мордов", "саранск"), "Республика Мордовия", "А39"),
]


def build_case_law_stub_result(query: str) -> TenderAnalyzerResult:
    """Честный «пустой» результат, когда источники поиска недоступны.

    Не генерирует выдуманных карточек дел, позиций судов или темы спора. Содержит
    только нормы права (эвристика по ключевым словам) и прямые ссылки на открытые
    поисковики, чтобы юрист мог продолжить поиск вручную.
    """
    normalized = query.strip()
    query_lower = normalized.lower()

    matched_regions = [
        label
        for aliases, label, _prefix in _REGION_ALIASES
        if any(alias in query_lower for alias in aliases)
    ]
    if not matched_regions:
        extracted = _extract_region_hints(query)
        if extracted:
            matched_regions = [hint.title() for hint in extracted]

    return TenderAnalyzerResult(
        query=normalized,
        summary=(
            f"Поиск судебной практики по запросу «{normalized}» не выполнен: внешние "
            "источники (kad.arbitr.ru, sudrf.ru, sudact.ru) сейчас недоступны или не "
            "настроены. Мы ничего не нашли — и не выдумываем дел."
        ),
        search_scope=(
            "Источники поиска не отработали. Ниже — только применимые нормы права "
            "и прямые ссылки на открытые базы для ручного поиска."
        ),
        dispute_overview=(
            "Автоматическая подборка практики недоступна. Откройте источники ниже "
            "и введите запрос вручную — там вы найдёте актуальные акты."
        ),
        regions=matched_regions,
        court_positions=[],
        cited_cases=[
            CaseLawReferenceItem(
                title="Картотека арбитражных дел",
                citation="kad.arbitr.ru",
                url="https://kad.arbitr.ru/",
                takeaway="Официальный поиск по делам арбитражных судов РФ.",
            ),
            CaseLawReferenceItem(
                title="ГАС «Правосудие»",
                citation="sudrf.ru",
                url="https://sudrf.ru/",
                takeaway="Поиск актов судов общей юрисдикции по региону и типу суда.",
            ),
            CaseLawReferenceItem(
                title="СудАкт",
                citation="sudact.ru",
                url="https://sudact.ru/",
                takeaway="Агрегатор судебных актов с полнотекстовым поиском.",
            ),
        ],
        legal_basis=_derive_legal_basis(normalized),
        practical_takeaways=[
            "Откройте источники выше и повторите запрос вручную — мы не хотим "
            "подставлять вам несуществующие дела.",
            "Сужайте запрос по региону, периоду, инстанции и предмету спора.",
            "Сверяйте найденную практику с фактурой спора: предмет, нарушение, "
            "доказательства, итог.",
        ],
        follow_up_prompt=(
            "Как только поисковые источники заработают, автоматическая подборка "
            "актов и позиций судов появится в этом же окне."
        ),
        data_source="stub",
    )


def _normalize_case_law_payload(payload: object, query: str) -> TenderAnalyzerResult:
    if isinstance(payload, dict) and isinstance(payload.get("result"), dict):
        payload = payload["result"]
    if not isinstance(payload, dict):
        raise ValueError("Case law provider payload must be an object.")

    merged = {"query": query, **payload}
    return TenderAnalyzerResult.model_validate(merged)


def _get_web_search_domains() -> list[str]:
    raw = settings.case_law_web_search_domains.strip()
    if not raw:
        return ["kad.arbitr.ru", "sudrf.ru", "sudact.ru"]
    return [item.strip() for item in raw.split(",") if item.strip()]


def _get_preferred_domains(query: str) -> list[str]:
    query_lower = query.lower()
    configured = _get_web_search_domains()
    if any(hint in query_lower for hint in ARBITRAZH_ONLY_HINTS):
        preferred = [domain for domain in configured if "kad.arbitr.ru" in domain or "sudact.ru" in domain]
        return preferred or ["kad.arbitr.ru", "sudact.ru"]
    if any(hint in query_lower for hint in GENERAL_JURISDICTION_HINTS):
        return [domain for domain in configured if "sudrf.ru" in domain] or ["sudrf.ru"]
    return configured


def _canonicalize_region(raw: str) -> str:
    raw_lower = raw.strip().lower()
    for aliases, label, _prefix in _REGION_ALIASES:
        if any(alias in raw_lower for alias in aliases):
            return label
    return raw.strip().title()


def _extract_region_hints(query: str) -> list[str]:
    hints: list[str] = []
    normalized = re.sub(r"\s+", " ", query.strip().lower())
    for pattern in REGION_HINT_PATTERNS:
        for match in re.finditer(pattern, normalized, flags=re.IGNORECASE):
            value = re.sub(r"\s+", " ", match.group(0).strip())
            canonical = _canonicalize_region(value)
            if canonical and canonical not in hints:
                hints.append(canonical)
    return hints


def _region_to_arbitrazh_court(region: str) -> str:
    normalized = region.strip().lower()
    if normalized == "москва":
        return "Арбитражный суд города Москвы"
    if normalized == "санкт-петербург":
        return "Арбитражный суд города Санкт-Петербурга и Ленинградской области"
    if normalized == "севастополь":
        return "Арбитражный суд города Севастополя"
    if normalized.endswith("ая область"):
        adjective = normalized.rsplit(" ", 1)[0]
        if adjective.endswith("ая"):
            adjective = f"{adjective[:-2]}ой"
        return f"Арбитражный суд {adjective} области"
    if normalized.endswith("ий край"):
        adjective = normalized.rsplit(" ", 1)[0]
        if adjective.endswith("ий"):
            adjective = f"{adjective[:-2]}его"
        return f"Арбитражный суд {adjective} края"
    if normalized.endswith("ый край"):
        adjective = normalized.rsplit(" ", 1)[0]
        if adjective.endswith("ый"):
            adjective = f"{adjective[:-2]}ого"
        return f"Арбитражный суд {adjective} края"
    if normalized.endswith("ка республика"):
        name = normalized.rsplit(" ", 1)[0]
        if name.endswith("ка"):
            name = f"{name[:-2]}ки"
        return f"Арбитражный суд Республики {name}"
    if normalized.endswith("республика"):
        return f"Арбитражный суд {normalized}"
    if normalized.endswith("автономный округ"):
        return f"Арбитражный суд {normalized}"
    if normalized.endswith("автономная область"):
        return f"Арбитражный суд {normalized}"
    return f"Арбитражный суд {normalized}"


def _requested_court_phrases(query: str) -> list[str]:
    if not any(hint in query.lower() for hint in ARBITRAZH_ONLY_HINTS):
        return []
    return [_region_to_arbitrazh_court(region) for region in _extract_region_hints(query)]


def _extract_region_mentions(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text.lower())
    return [match.group(0).strip() for match in REGION_MENTION_PATTERN.finditer(normalized)]


def _matches_instance(query: str, url: str) -> bool:
    requested = _detect_instance(query)
    if not requested:
        return True
    url_lower = url.lower()
    is_cassation = bool(CASSATION_DOMAIN_PATTERN.search(url_lower)) or "верховн" in url_lower
    is_appeal = bool(APPEAL_DOMAIN_PATTERN.search(url_lower))
    if requested == "appeal":
        if is_cassation:
            return False
    elif requested == "cassation":
        if is_appeal:
            return False
    elif requested == "first":
        if is_cassation or is_appeal:
            return False
    return True


def _matches_cassation_district(query: str, url: str) -> bool:
    match = CASSATION_DOMAIN_PATTERN.search(url.lower())
    if not match:
        return True
    requested_regions = _extract_region_hints(query)
    if not requested_regions:
        return True
    expected_numbers = {
        num for region in requested_regions
        for num in (_cassation_district_for_region(region),) if num is not None
    }
    if not expected_numbers:
        return True
    return int(match.group(1)) in expected_numbers


def _matches_requested_region(query: str, item: dict[str, str]) -> bool:
    requested_regions = _extract_region_hints(query)
    url = item.get("url", "")
    if not _matches_cassation_district(query, url):
        return False
    if not _matches_instance(query, url):
        return False
    if not requested_regions:
        return True
    requested_lower_set = {r.lower() for r in requested_regions}
    requested_tokens: set[str] = set()
    requested_prefixes: set[str] = set()
    for aliases, label, prefix in _REGION_ALIASES:
        if label.lower() in requested_lower_set:
            requested_tokens.update(aliases)
            if prefix:
                requested_prefixes.add(prefix.upper())
    sudrf_token = _sudrf_region_token(url)
    if sudrf_token:
        if requested_tokens and sudrf_token not in requested_tokens:
            return False
    case_prefix = _arbitrazh_case_prefix(item)
    if case_prefix:
        if requested_prefixes and case_prefix.upper() in requested_prefixes:
            return True
        if requested_prefixes:
            return False
    haystack = " ".join(
        [
            item.get("title", "").lower(),
            item.get("snippet", "").lower(),
            url.lower(),
            item.get("source", "").lower(),
        ]
    )
    if any(region in haystack for region in requested_regions):
        return True
    requested_courts = [phrase.lower() for phrase in _requested_court_phrases(query)]
    if any(phrase in haystack for phrase in requested_courts):
        return True
    region_mentions = _extract_region_mentions(haystack)
    if region_mentions and not any(region in mention for mention in region_mentions for region in requested_regions):
        return False
    # Ссылки на kad.arbitr.ru оставляем: если префикс номера дела был бы не из запрошенного региона,
    # фильтр по _arbitrazh_case_prefix уже вернул бы False выше. Если префикса нет вообще — пропускаем.
    return not region_mentions


def _build_site_limited_query(query: str) -> str:
    domains = _get_preferred_domains(query)
    domain_clause = " | ".join(f"site:{domain}" for domain in domains)
    region_hints = _extract_region_hints(query)
    topic_terms = _extract_topic_terms(query)
    parts: list[str] = []
    if domain_clause:
        parts.append(f"({domain_clause})")
    if topic_terms:
        parts.append(" ".join(f'"{term}"' if len(term) > 6 else term for term in topic_terms[:6]))
    else:
        parts.append(query.strip())
    for hint in region_hints:
        parts.append(f'"{hint}"')
    for phrase in _requested_court_phrases(query):
        parts.append(f'"{phrase}"')
    return " ".join(part for part in parts if part).strip()


def _extract_topic_terms(query: str) -> list[str]:
    tokens = re.findall(r"[а-яёa-z0-9-]{4,}", query.lower())
    return [token for token in tokens if token not in SEARCH_STOP_WORDS]


ARBITRAZH_COURT_BY_PREFIX: dict[str, str] = {
    label[1]: label[0]  # reverse map: prefix → full region label
    for label in [(label, prefix) for aliases, label, prefix in _REGION_ALIASES if prefix]
}


def _court_name_from_item(item: dict[str, str]) -> str | None:
    """Попытаться извлечь нормальное название суда из item."""
    title = item.get("title", "").strip()
    if title and "суд" in title.lower() and len(title) < 160:
        return title
    source = item.get("source", "").strip()
    if source and "суд" in source.lower():
        return source
    url = item.get("url", "").strip().lower()
    if "kad.arbitr.ru" in url:
        prefix = _arbitrazh_case_prefix(item)
        if prefix:
            for aliases, label, pref in _REGION_ALIASES:
                if pref and pref.upper() == prefix.upper():
                    return _region_to_arbitrazh_court(label)
        return "Картотека арбитражных дел"
    return None


def _case_number_from_item(item: dict[str, str]) -> str | None:
    """Извлечь номер дела (А40-123/2024) или citation."""
    citation = item.get("citation", "").strip()
    if citation:
        return citation
    prefix = _arbitrazh_case_prefix(item)
    if prefix:
        haystack = " ".join([item.get("title", ""), item.get("snippet", ""), item.get("url", "")])
        match = re.search(r"\b([аa]\d{2,3}-\d+/\d{4})\b", haystack, flags=re.IGNORECASE)
        if match:
            return match.group(1).upper().replace("A", "А")
    return None


def _build_cited_title(item: dict[str, str]) -> str:
    """Строит читаемый заголовок для карточки: «Название суда (номер дела)»."""
    court = _court_name_from_item(item)
    case = _case_number_from_item(item)
    if court and case:
        return f"{court} ({case})"
    if court:
        return court
    if case:
        return case
    return _normalize_source_label(item)


def _normalize_source_label(item: dict[str, str]) -> str:
    title = item.get("title", "").strip()
    if title and "суд" in title.lower() and len(title) < 140:
        return title
    source = item.get("source", "").strip()
    url = item.get("url", "").strip().lower()
    if source and "суд" in source.lower():
        return source
    if "kad.arbitr.ru" in url:
        return "КАД Арбитр"
    if "sudrf.ru" in url:
        return "ГАС Правосудие"
    if "sudact.ru" in url:
        return "СудАкт"
    if source:
        return source
    return "Найденный источник"


_AMOUNT_PATTERN = re.compile(
    r"(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,](\d+))?"
    r"\s*(тыс\.?|млн\.?|млрд\.?)?"
    r"\s*(?:руб(?:\.|лей|ля|\b)|₽|р\.)",
    flags=re.IGNORECASE,
)

_MULTIPLIERS = {"тыс": 1_000, "млн": 1_000_000, "млрд": 1_000_000_000}


def _extract_max_amount_rub(*texts: str) -> int | None:
    """Вытащить максимальную сумму в рублях из переданных текстов.

    Считает только числа, у которых рядом маркер «руб»/«₽»/«р.», опционально
    умножая на «тыс./млн./млрд.». Защищает от ложных срабатываний на номерах
    дел (А40-264737/2024) и годах — там нет маркера рубля.
    """
    best: int | None = None
    for text in texts:
        if not text:
            continue
        for match in _AMOUNT_PATTERN.finditer(text):
            int_part = match.group(1).replace("\u00a0", "").replace(" ", "")
            if not int_part.isdigit():
                continue
            try:
                value = int(int_part)
            except ValueError:
                continue
            frac = match.group(2)
            multiplier_key = (match.group(3) or "").rstrip(".").lower()
            if multiplier_key in _MULTIPLIERS:
                mult = _MULTIPLIERS[multiplier_key]
                if frac:
                    value = int(value * mult + int(frac.ljust(len(frac), "0")) * mult // (10 ** len(frac)))
                else:
                    value *= mult
            # Отсекаем очевидно мелкие шумы вроде «1 руб.» в юридическом контексте —
            # такие суммы не про размер иска, а про номинальную компенсацию.
            if value < 100:
                continue
            if best is None or value > best:
                best = value
    return best


_OUTCOME_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Отказ — проверяем первым, чтобы «удовлетворить» потом не сматчило раньше.
    # Ловим обе последовательности: «отказ ... в удовлетворении/иске» и
    # «в удовлетворении/исковых требованиях ... отказ».
    ("denied", re.compile(
        r"(?:\bотказ(?:ать|ано|а)\b[^.]{0,80}(?:в\s+(?:удовлетворении|иске)|исковых?\s+требовани[йя]))|"
        r"(?:(?:в\s+удовлетворении|исковых?\s+требовани[йя])[^.]{0,80}\bотказ(?:ать|ано|а)\b)",
        flags=re.IGNORECASE,
    )),
    # Частичное удовлетворение — проверяется до granted, чтобы «удовлетворить иск
    # частично» не попадало в granted. Допускаем до 30 символов между «удовлетвор»
    # и «частично» в обе стороны.
    ("partial", re.compile(
        r"(?:частично.{0,30}удовлетвор)|(?:удовлетвор\w{0,6}.{0,30}частично)",
        flags=re.IGNORECASE,
    )),
    # Полное удовлетворение — «иск/требование удовлетвор…» или «удовлетвор… в
    # полном объёме/полностью».
    ("granted", re.compile(
        r"(?:(?:иск(?:овые\s+требования)?|требовани[яе])\s+[^.]{0,30}удовлетвор)|"
        r"(?:удовлетвор\w{0,6}\s+(?:в\s+полном\s+объ[её]ме|полностью|иск|требовани))",
        flags=re.IGNORECASE,
    )),
]


def _extract_outcome(*texts: str) -> str | None:
    """Определить исход дела по тексту снипета/заголовка.

    Возвращает "granted" / "partial" / "denied" / None. Порядок проверки
    важен: «отказ» раньше «частично», «частично» раньше «удовлетворить»,
    чтобы «частично удовлетворено» не попало в granted.
    """
    for text in texts:
        if not text:
            continue
        for label, pattern in _OUTCOME_PATTERNS:
            if pattern.search(text):
                return label
    return None


def _build_outcome_summary(cases: list[CaseLawReferenceItem]) -> OutcomeSummary | None:
    if not cases:
        return None
    summary = OutcomeSummary()
    for case in cases:
        if case.outcome == "granted":
            summary.granted += 1
        elif case.outcome == "partial":
            summary.partial += 1
        elif case.outcome == "denied":
            summary.denied += 1
        else:
            summary.unknown += 1
    if summary.granted + summary.partial + summary.denied == 0:
        return None  # нечего показывать, все unknown
    return summary


def _build_amount_stats(cases: list[CaseLawReferenceItem]) -> AmountStats | None:
    amounts = sorted(c.amount_rub for c in cases if c.amount_rub and c.amount_rub > 0)
    if not amounts:
        return None
    n = len(amounts)
    median = amounts[n // 2] if n % 2 else (amounts[n // 2 - 1] + amounts[n // 2]) // 2
    return AmountStats(count=n, min_rub=amounts[0], max_rub=amounts[-1], median_rub=median)


def _item_region_match(query: str, item: dict[str, str]) -> str:
    requested_regions = _extract_region_hints(query)
    if not requested_regions:
        return "unknown"
    url = item.get("url", "").lower()
    if not _matches_cassation_district(query, url):
        return "other"
    requested_lower = [region.lower() for region in requested_regions]
    requested_tokens: set[str] = set()
    requested_prefixes: set[str] = set()
    for aliases, label, prefix in _REGION_ALIASES:
        if label.lower() in requested_lower:
            requested_tokens.update(aliases)
            if prefix:
                requested_prefixes.add(prefix.upper())
    sudrf_token = _sudrf_region_token(url)
    if sudrf_token:
        if requested_tokens and sudrf_token in requested_tokens:
            return "match"
        return "other"
    case_prefix = _arbitrazh_case_prefix(item)
    if case_prefix and requested_prefixes:
        return "match" if case_prefix.upper() in requested_prefixes else "other"
    haystack = " ".join(
        [
            item.get("title", "").lower(),
            item.get("snippet", "").lower(),
            url,
            item.get("source", "").lower(),
        ]
    )
    if any(region in haystack for region in requested_lower):
        return "match"
    if requested_tokens and any(token in haystack for token in requested_tokens):
        return "match"
    mentions = _extract_region_mentions(haystack)
    if mentions and not any(region in mention for mention in mentions for region in requested_lower):
        return "other"
    return "unknown"


def _build_no_exact_matches_result(query: str, requested_regions: list[str]) -> TenderAnalyzerResult:
    base = build_case_law_stub_result(query)
    region_label = ", ".join(requested_regions) if requested_regions else "выбранного региона"
    return base.model_copy(
        update={
            "summary": (
                f"В открытых источниках (kad.arbitr.ru, sudrf.ru, sudact.ru) по запросу «{query}» "
                f"нет актов для региона {region_label}. Это значит, что мы ничего не нашли — "
                "и не выдумываем несуществующих дел."
            ),
            "search_scope": f"Точный поиск по региону: {region_label}. Источники: kad.arbitr.ru, sudrf.ru, sudact.ru.",
            "regions": requested_regions or base.regions,
            "court_positions": [],
            "cited_cases": [],
            "follow_up_prompt": (
                "Попробуйте сформулировать иначе: добавьте период, инстанцию, номер суда, "
                "номер дела или уточните предмет спора другими ключевыми словами. "
                "Отсутствие практики — это тоже полезный ответ: возможно, в открытом доступе дел нет."
            ),
            "data_source": "no_results",
        }
    )


def _looks_predominantly_latin(text: str) -> bool:
    latin = len(re.findall(r"[A-Za-z]", text))
    cyrillic = len(re.findall(r"[А-Яа-яЁё]", text))
    return latin > cyrillic and latin > 20


def _score_search_result(query: str, item: dict[str, str]) -> int:
    haystack = " ".join(
        [
            item.get("title", "").lower(),
            item.get("snippet", "").lower(),
            item.get("url", "").lower(),
            item.get("source", "").lower(),
            item.get("citation", "").lower(),
        ]
    )
    score = 0
    url = item.get("url", "").strip().lower()
    # kad.arbitr.ru — основной источник для юристов (sudrf.ru часто лагает),
    # поэтому даём базовый приоритет ему вне зависимости от слова "арбитраж" в запросе.
    if "kad.arbitr.ru" in haystack:
        score += 4
    if "арбитраж" in query.lower():
        if "kad.arbitr.ru" in haystack:
            score += 4
        if "судрф" in haystack or "sudrf.ru" in haystack:
            score -= 2
    # Для Верховного суда и высоких инстанций
    if "vsrf.ru" in haystack or "верховн" in haystack:
        score += 3
    if re.search(r"\b[1-9]kas\.sudrf\.ru\b", url):
        score += 2
    if re.search(r"\b[1-5]ap\.sudrf\.ru\b", url):
        score += 1
    if url.rstrip("/") == "https://kad.arbitr.ru":
        score -= 8
    if "sudrf.ru/modules.php?name=sud_delo" in url and "number=" not in url and "case_id=" not in url:
        score -= 6
    if "case_id=" in url or "number=" in url or re.search(r"\b[аa]\d{2,3}-\d+/\d{4}\b", haystack):
        score += 4
    if any(hint in haystack for hint in _extract_region_hints(query)):
        score += 4
    if any(phrase.lower() in haystack for phrase in _requested_court_phrases(query)):
        score += 8
    if not _matches_requested_region(query, item):
        score -= 12
    for term in _extract_topic_terms(query):
        if term in haystack:
            score += 2
    if item.get("citation"):
        score += 1
    return score


def _is_direct_case_link(item: dict[str, str]) -> bool:
    url = item.get("url", "").strip().lower()
    haystack = " ".join(
        [
            item.get("title", "").lower(),
            item.get("snippet", "").lower(),
            url,
            item.get("citation", "").lower(),
        ]
    )
    if "kad.arbitr.ru/card/" in url:
        return True
    if "sudrf.ru/modules.php?name=sud_delo" in url and ("number=" in url or "case_id=" in url):
        return True
    return bool(re.search(r"\b[аa]\d{2,3}-\d+/\d{4}\b", haystack))


def _filter_and_rank_results(query: str, results: list[dict[str, str]], strict_region: bool = True) -> list[dict[str, str]]:
    ranked: list[tuple[int, dict[str, str]]] = []
    seen_urls: set[str] = set()
    rejected: list[str] = []
    for item in results:
        url = item.get("url", "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        url_lower = url.lower().rstrip("/")
        if url_lower in {"https://kad.arbitr.ru", "http://kad.arbitr.ru",
                         "https://m.kad.arbitr.ru", "http://m.kad.arbitr.ru",
                         "https://sudrf.ru", "http://sudrf.ru",
                         "https://sudact.ru", "http://sudact.ru"}:
            continue
        if strict_region and not _matches_requested_region(query, item):
            rejected.append(url)
            continue
        score = _score_search_result(query, item)
        if not strict_region and _matches_requested_region(query, item):
            score += 6
        if not strict_region and _is_direct_case_link(item):
            score += 5
        ranked.append((score, item))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    filtered = [item for score, item in ranked if score > 0]
    if strict_region and rejected:
        logger.info("case_law strict filter rejected %d/%d: %s", len(rejected), len(results), rejected[:8])
    if filtered:
        return filtered[:12]
    return [item for _, item in ranked[:12]]


def _build_related_case_results(query: str, results: list[dict[str, str]]) -> list[dict[str, str]]:
    broad = _filter_and_rank_results(query, results, strict_region=False)
    direct = [item for item in broad if _is_direct_case_link(item)]
    return direct[:5] if direct else broad[:5]


def _parse_yandex_search_xml(raw: str) -> list[dict[str, str]]:
    root = ET.fromstring(raw)
    found = root.findall(".//group/doc")
    results: list[dict[str, str]] = []

    def node_text(node: ET.Element | None) -> str:
        if node is None:
            return ""
        return re.sub(r"\s+", " ", "".join(node.itertext())).strip()

    for doc in found:
        title = node_text(doc.find("./title"))
        if not title:
            title = node_text(doc.find("./headline"))
        url_text = (doc.findtext("./url") or "").strip()
        domain = (doc.findtext("./domain") or "").strip()
        passages = [
            node_text(item)
            for item in doc.findall(".//passage")
            if node_text(item)
        ]
        snippet = " ".join(passages[:3]).strip()
        citation_match = re.search(r"\b([АA]\d{2,3}-\d+/\d{4})\b", f"{title} {snippet}")
        citation = citation_match.group(1) if citation_match else ""
        if not title or not url_text:
            continue
        results.append(
            {
                "title": title,
                "url": url_text,
                "snippet": snippet,
                "source": domain or "Yandex Search API",
                "citation": citation,
            }
        )
        if len(results) >= 8:
            break
    return results


def _search_case_law_yandex_api(query: str, extra_terms: list[str] | None = None) -> list[dict[str, str]]:
    api_key = settings.yandex_search_api_key.strip()
    folder_id = settings.yandex_search_folder_id.strip()
    endpoint = settings.yandex_search_api_url.strip()
    if not api_key or not folder_id or not endpoint:
        return []

    query_text = _build_site_limited_query(query)
    if extra_terms:
        query_text = " ".join([query_text, *[f'+"{term}"' for term in extra_terms]]).strip()

    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": query_text,
        },
        "groupSpec": {
            "groupMode": "GROUP_MODE_FLAT",
            "groupsOnPage": str(settings.yandex_search_groups_on_page),
            "docsInGroup": str(settings.yandex_search_docs_in_group),
        },
        "maxPassages": "3",
        "region": str(settings.yandex_search_region),
        "l10N": "L10N_RU",
        "folderId": folder_id,
        "responseFormat": "FORMAT_XML",
    }
    req = request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Api-Key {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=settings.case_law_timeout_seconds) as response:
        raw = response.read().decode("utf-8", errors="replace")
    payload = json.loads(raw) if raw else {}
    if isinstance(payload, dict) and isinstance(payload.get("rawData"), str) and payload.get("rawData").strip():
        encoded = payload["rawData"].strip()
        try:
            decoded = base64.b64decode(encoded).decode("utf-8", errors="replace")
        except Exception:
            decoded = encoded
        return _parse_yandex_search_xml(decoded)
    raise ValueError("Yandex Search API response did not include rawData.")


def _normalize_web_search_payload(payload: object) -> list[dict[str, str]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            items = payload["results"]
        elif isinstance(payload.get("items"), list):
            items = payload["items"]
        else:
            items = []
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    normalized: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("name") or "").strip()
        url = str(item.get("url") or item.get("link") or "").strip()
        snippet = str(item.get("snippet") or item.get("description") or item.get("content") or "").strip()
        source = str(item.get("source") or item.get("court") or "").strip()
        citation = str(item.get("citation") or item.get("case_number") or "").strip()
        if not title or not url:
            continue
        normalized.append(
            {
                "title": title,
                "url": url,
                "snippet": snippet,
                "source": source,
                "citation": citation,
            }
        )
    return normalized[:8]


def _search_case_law_web(query: str) -> list[dict[str, str]]:
    endpoint = settings.case_law_web_search_url.strip()
    if not endpoint:
        return []

    body = json.dumps(
        {
            "query": query,
            "domains": _get_web_search_domains(),
            "limit": 8,
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.case_law_web_search_api_key.strip():
        headers["Authorization"] = f"Bearer {settings.case_law_web_search_api_key.strip()}"

    req = request.Request(endpoint, data=body, headers=headers, method="POST")
    with request.urlopen(req, timeout=settings.case_law_timeout_seconds) as response:
        raw = response.read().decode("utf-8")
    payload = json.loads(raw) if raw else {}
    return _normalize_web_search_payload(payload)


def _build_web_search_fallback(
    query: str,
    results: list[dict[str, str]],
    allow_related_regions: bool = False,
) -> TenderAnalyzerResult:
    base = build_case_law_stub_result(query)
    if not results:
        return base

    filtered = _filter_and_rank_results(query, results)
    region_hints = _extract_region_hints(query)
    used_related_matches = False
    if not filtered:
        if region_hints and not allow_related_regions:
            return _build_no_exact_matches_result(query, region_hints)
        filtered = _build_related_case_results(query, results)
        used_related_matches = bool(filtered)
    if not filtered:
        return base

    cited_cases = [
        CaseLawReferenceItem(
            title=_build_cited_title(item),
            citation=_case_number_from_item(item) or _normalize_source_label(item),
            url=item["url"],
            takeaway=item["snippet"] or "Откройте источник для просмотра карточки дела и судебных актов.",
            region_match=_item_region_match(query, item),
            amount_rub=_extract_max_amount_rub(item.get("title", ""), item.get("snippet", "")),
            outcome=_extract_outcome(item.get("title", ""), item.get("snippet", "")),
        )
        for item in filtered[:10]
    ]
    positions = [
        CourtPositionItem(
            court=_court_name_from_item(item) or _normalize_source_label(item),
            position=item["snippet"] or "Найден релевантный акт по запросу.",
            relevance="Материал отобран из поисковой выдачи по совпадению с предметом спора, регионом и типом суда.",
            region_match=_item_region_match(query, item),
        )
        for item in filtered[:6]
    ]
    search_scope = f"Интернет-поиск по доменам: {', '.join(_get_web_search_domains())}."
    if region_hints:
        search_scope += f" Региональный фокус: {', '.join(region_hints)}."
    summary = f"Найдены веб-результаты по запросу «{query}». Ниже приведены ссылки на релевантные судебные материалы и краткие выдержки."
    follow_up_prompt = "Можно уточнить регион, вид суда, инстанцию или период, чтобы интернет-поиск стал точнее."
    if used_related_matches:
        summary = (
            f"Точных актов по запросу «{query}» в выбранном регионе в поисковой выдаче не нашлось. "
            "Ниже показаны ближайшие найденные карточки дел и акты по похожему спору."
        )
        follow_up_prompt = (
            "Уточните период, инстанцию или номер суда. Если нужен только выбранный регион, лучше сузить запрос "
            "до конкретного суда или номера дела."
        )
    related_notice = ""
    if used_related_matches and region_hints:
        related_notice = (
            f"По региону {', '.join(region_hints)} точных актов не найдено. "
            "Ниже — ближайшие по теме дела из других регионов. Для той же темы позиции судов, как правило, сходятся."
        )
    return base.model_copy(
        update={
            "summary": summary,
            "search_scope": search_scope,
            "regions": region_hints or base.regions,
            "requested_regions": region_hints,
            "court_positions": positions,
            "cited_cases": cited_cases,
            "legal_basis": _derive_legal_basis(query),
            "follow_up_prompt": follow_up_prompt,
            "data_source": "web_search",
            "related_region_notice": related_notice,
            "outcome_summary": _build_outcome_summary(cited_cases),
            "amount_stats": _build_amount_stats(cited_cases),
        }
    )


def _summarize_web_results_with_llm(
    query: str,
    results: list[dict[str, str]],
    allow_related_regions: bool = False,
) -> TenderAnalyzerResult:
    if not results:
        return build_case_law_stub_result(query)

    filtered = _filter_and_rank_results(query, results)
    if not filtered:
        region_hints = _extract_region_hints(query)
        if region_hints and not allow_related_regions:
            return _build_no_exact_matches_result(query, region_hints)
        return _build_web_search_fallback(query, results, allow_related_regions=allow_related_regions)
    snippets = "\n\n".join(
        (
            f"Source #{index + 1}\n"
            f"Title: {item['title']}\n"
            f"URL: {item['url']}\n"
            f"Citation: {item['citation'] or 'n/a'}\n"
            f"Source/Court: {_normalize_source_label(item)}\n"
            f"Snippet: {item['snippet'] or 'n/a'}"
        )
        for index, item in enumerate(filtered[:6])
    )

    prompt = f"""Ты готовишь сводку по судебной практике на русском языке.
Верни только JSON без markdown и без пояснений.

Запрос пользователя: {query}

Используй только предоставленные результаты поиска.
Не выдумывай дела, суды, номера, даты, регионы и URL.
В поле court указывай ровно то наименование суда, которое присутствует в поле Source/Court или Title конкретного источника — не сокращай, не придумывай название, не подставляй суды, не упомянутые в результатах.
Не используй значения "n/a", "без названия", пустые строки и прочерки в полях title, citation, court. Если подходящего значения нет в источниках — не добавляй такой элемент вовсе.
В объектах court_positions используй строго ключи court, position, relevance — никаких severity, score, priority и прочих.
В объектах cited_cases используй строго ключи title, citation, url, takeaway, outcome.
Поле outcome — исход дела, одно из четырёх значений: "granted" (иск удовлетворён полностью),
"partial" (удовлетворён частично), "denied" (в удовлетворении отказано), "unknown" (из
снипета исход неясен). **Не угадывай** — если в Title или Snippet нет явных слов про
удовлетворение или отказ, ставь "unknown". Лучше честное "unknown", чем ошибка.
Все текстовые поля верни на русском языке.
Если в выдаче есть конфликт между арбитражными судами и судами общей юрисдикции, при слове "арбитраж" в запросе отдавай приоритет арбитражным материалам.

Верни объект с ключами:
- summary
- search_scope
- dispute_overview
- regions: string[]
- court_positions: array of objects {{court, position, relevance}}
- cited_cases: array of objects {{title, citation, url, takeaway, outcome}}
- legal_basis: string[]
- practical_takeaways: string[]
- follow_up_prompt

Результаты поиска:
{snippets}
"""

    client, model = _build_openai_client({})
    content = _create_completion(client, model, prompt, {}, "case law web search summary")
    payload = json.loads(_coerce_json_payload(content))
    normalized = _normalize_case_law_payload(payload, query)
    allowed_urls = {item["url"] for item in filtered}
    if any(
        _looks_predominantly_latin(value)
        for value in (normalized.summary, normalized.dispute_overview, normalized.follow_up_prompt)
    ):
        raise ValueError("LLM summary is not predominantly Russian.")
    if not normalized.cited_cases:
        raise ValueError("LLM summary omitted cited cases.")
    if any(case.url not in allowed_urls for case in normalized.cited_cases):
        raise ValueError("LLM summary introduced URLs outside the search results.")
    url_to_item = {item["url"]: item for item in filtered}
    source_labels_lower = {_normalize_source_label(item).lower() for item in filtered}
    enriched_cases = []
    for case in normalized.cited_cases:
        item = url_to_item.get(case.url, {"url": case.url, "title": case.title, "snippet": case.takeaway})
        regex_outcome = _extract_outcome(
            item.get("title", ""), item.get("snippet", ""), case.takeaway or ""
        )
        # LLM мог предложить свой outcome — принимаем его, только если regex ничего
        # не нашёл и LLM дал одно из допустимых значений. Regex побеждает LLM: он
        # сработал по явным маркерам резолютива и его ошибкам доверять сложнее.
        llm_outcome = (case.outcome or "").strip().lower() if case.outcome else ""
        outcome = regex_outcome or (llm_outcome if llm_outcome in {"granted", "partial", "denied"} else None)
        update: dict[str, object] = {
            "region_match": _item_region_match(query, item),
            "title": _build_cited_title(item),
            "citation": _case_number_from_item(item) or _normalize_source_label(item),
            "amount_rub": _extract_max_amount_rub(
                item.get("title", ""), item.get("snippet", ""), case.takeaway or ""
            ),
            "outcome": outcome,
        }
        enriched_cases.append(case.model_copy(update=update))
    enriched_positions = []
    for pos in normalized.court_positions:
        court_lower = pos.court.strip().lower()
        best_match = None
        for item in filtered:
            label = _normalize_source_label(item).lower()
            if label and label in court_lower:
                best_match = item
                break
        update = {"region_match": _item_region_match(query, best_match) if best_match else "unknown"}
        enriched_positions.append(pos.model_copy(update=update))
    region_hints_norm = _extract_region_hints(query)
    has_other = any(case.region_match == "other" for case in enriched_cases) or any(
        pos.region_match == "other" for pos in enriched_positions
    )
    related_notice = ""
    if has_other and region_hints_norm:
        related_notice = (
            f"Часть результатов не из региона {', '.join(region_hints_norm)}. "
            "Они оставлены как ближайшие по теме из других регионов."
        )
    derived_basis = _derive_legal_basis(query)
    seen_basis: set[str] = set()
    merged_basis: list[str] = []
    for item in list(normalized.legal_basis) + derived_basis:
        key = re.sub(r"\s+", " ", item.strip().lower())
        if not key or key in seen_basis:
            continue
        seen_basis.add(key)
        merged_basis.append(item)
    return normalized.model_copy(
        update={
            "cited_cases": enriched_cases,
            "court_positions": enriched_positions,
            "legal_basis": merged_basis,
            "requested_regions": region_hints_norm,
            "related_region_notice": related_notice,
            "outcome_summary": _build_outcome_summary(enriched_cases),
            "amount_stats": _build_amount_stats(enriched_cases),
        }
    )


def _expand_query_with_llm(query: str) -> list[str]:
    """Сгенерировать альтернативные «судейские» формулировки для поиска.

    Возвращает список, всегда начинающийся с исходного запроса. При ошибке/недоступности LLM —
    просто `[query]`, и поиск работает как раньше.
    """
    prompt = f"""Ты помощник юриста. Пользователь описывает правовую ситуацию обычными словами.
Твоя задача — предложить 4 альтернативные поисковые формулировки так, как суд мог бы написать
эту же мысль в мотивировочной части судебного акта. Эти формулировки будут отправлены в
поисковую систему (сайты kad.arbitr.ru, sudrf.ru, sudact.ru).

Жёсткие правила:
1. Длина каждой фразы — 3–12 слов.
2. Канцелярский стиль: «о взыскании», «о признании», «об обязании», «о расторжении» и т. п.
3. Если в запросе названы **регион** (Москва, СПб, область, край) или **инстанция**
   (арбитраж, общей юрисдикции, апелляция, кассация, ВС РФ) — обязательно сохрани этот
   маркер хотя бы в 2 из 4 вариантов. Это нужно, чтобы Yandex выдавал акты нужных судов.
   **Инстанцию заменять запрещено.** Если указан «арбитраж» — не пиши «суд общей
   юрисдикции». Если указана «общая юрисдикция» — не пиши «арбитражный суд»: это
   разные ветви, и запрос попадёт не туда.
   **Если инстанция не указана — не придумывай её.** Просто опусти слово «суд»,
   это безопаснее, чем угадать не ту ветвь (например, спор между компаниями —
   арбитраж, трудовой спор или заливы соседей — общая юрисдикция).
4. Номера статей (ГК/ТК/АПК/ГПК/КоАП РФ) указывай ТОЛЬКО если ты уверен, что статья
   действительно применяется к этой ситуации. Лучше без статьи, чем с неподходящей.
5. Не изобретай юридические термины. Используй только те, что реально встречаются в
   судебных актах.

Примеры (для запроса «поставщик не отгрузил товар, хочу взыскать пени, Москва, арбитраж»):

ПЛОХО:
- "Признание должника бездействием и взыскание пени" — нет такого термина «признание бездействием».
- "Взыскание пени" — слишком коротко, нет контекста и региона.
- "Иск по ст. 15 ГК РФ о пенях" — ст. 15 ГК про убытки, не про пени, статья подставлена наугад.

ХОРОШО:
- "О взыскании неустойки по договору поставки, Арбитражный суд г. Москвы"
- "Неисполнение обязательств по поставке товара, взыскание неустойки"
- "Ст. 330 ГК РФ взыскание неустойки за просрочку поставки"
- "Договор поставки просрочка передачи товара неустойка арбитраж"

Запрос пользователя: {query}

Верни строго JSON-массив из 4 строк, без пояснений, без markdown:
["формулировка 1", "формулировка 2", "формулировка 3", "формулировка 4"]
"""
    try:
        client, model = _build_openai_client({})
        content = _create_completion(client, model, prompt, {}, "case law query expansion")
        payload = json.loads(_coerce_json_payload(content))
    except Exception as exc:  # noqa: BLE001
        logger.warning("case_law query expansion failed: %s", exc)
        return [query]
    phrases: list[str] = []
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, str) and item.strip():
                phrases.append(item.strip())
    if not phrases:
        return [query]
    lower_query = query.lower()
    wants_arbitrazh = "арбитраж" in lower_query
    wants_ojur = "общ" in lower_query and "юрисдикц" in lower_query
    seen: set[str] = set()
    unique: list[str] = [query]
    seen.add(query.strip().lower())
    dropped_instance = 0
    for phrase in phrases[:4]:
        key = phrase.strip().lower()
        if not key or key in seen:
            continue
        has_arb = "арбитраж" in key
        has_ojur = "общ" in key and "юрисдикц" in key
        if wants_arbitrazh and has_ojur and not has_arb:
            dropped_instance += 1
            continue
        if wants_ojur and has_arb and not has_ojur:
            dropped_instance += 1
            continue
        seen.add(key)
        unique.append(phrase)
    if dropped_instance:
        logger.info("case_law query expansion dropped %d variants with wrong instance", dropped_instance)
    logger.info("case_law query expansion produced %d variants", len(unique) - 1)
    return unique


def _merge_yandex_results(batches: list[list[dict[str, str]]]) -> list[dict[str, str]]:
    """Объединить несколько батчей из Yandex с дедупом по URL. Item, встречающийся
    в нескольких батчах, ранжируется выше (count_hits помечается в source)."""
    by_url: dict[str, dict[str, str]] = {}
    hits: dict[str, int] = {}
    first_seen: dict[str, int] = {}
    for batch in batches:
        for item in batch:
            url = item.get("url", "").strip()
            if not url:
                continue
            if url not in by_url:
                by_url[url] = item
                first_seen[url] = len(first_seen)
            hits[url] = hits.get(url, 0) + 1
    # Сортировка: сначала те, что встретились в нескольких батчах,
    # при равенстве — сохраняем порядок первого появления.
    ordered = sorted(by_url.keys(), key=lambda u: (-hits[u], first_seen[u]))
    return [by_url[u] for u in ordered]


def search_case_law(query: str, allow_related_regions: bool = False) -> TenderAnalyzerResult:
    endpoint = settings.case_law_search_url.strip()
    if endpoint:
        body = json.dumps({"query": query}).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if settings.case_law_search_api_key.strip():
            headers["Authorization"] = f"Bearer {settings.case_law_search_api_key.strip()}"

        req = request.Request(endpoint, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=settings.case_law_timeout_seconds) as response:
                raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else {}
            return _normalize_case_law_payload(payload, query)
        except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("Case law provider failed, trying web search fallback: %s", exc)
    try:
        expanded_queries = _expand_query_with_llm(query)
        batches: list[list[dict[str, str]]] = []
        for variant in expanded_queries:
            try:
                batch = _search_case_law_yandex_api(variant)
            except (error.URLError, TimeoutError, ValueError, ET.ParseError) as exc:
                logger.warning("Yandex variant '%s' failed: %s", variant[:60], exc)
                continue
            if batch:
                batches.append(batch)
        yandex_results = _merge_yandex_results(batches)
        region_hints = _extract_region_hints(query)
        if yandex_results and region_hints:
            strict_matches = [
                item for item in yandex_results if _matches_requested_region(query, item)
            ]
            if len(strict_matches) < 3:
                court_phrases = _requested_court_phrases(query)
                extra_terms = list(region_hints) + court_phrases
                try:
                    forced = _search_case_law_yandex_api(query, extra_terms=extra_terms)
                except (error.URLError, TimeoutError, ValueError, ET.ParseError) as exc:
                    logger.warning("Forced-region Yandex retry failed: %s", exc)
                    forced = []
                if forced:
                    forced_urls = {item.get("url") for item in forced}
                    extra = [item for item in yandex_results if item.get("url") not in forced_urls]
                    yandex_results = list(forced) + extra
                    logger.info("case_law forced-region retry: merged %d new + %d existing", len(forced), len(extra))
        if yandex_results:
            try:
                return _summarize_web_results_with_llm(
                    query,
                    yandex_results,
                    allow_related_regions=allow_related_regions,
                )
            except Exception as exc:
                logger.warning("Case law Yandex Search API LLM summary failed, using search fallback: %s", exc)
                return _build_web_search_fallback(query, yandex_results, allow_related_regions=allow_related_regions)
    except (error.URLError, TimeoutError, ValueError, ET.ParseError) as exc:
        logger.warning("Case law Yandex Search API failed, trying generic web search: %s", exc)
    try:
        web_results = _search_case_law_web(query)
        if not web_results:
            return build_case_law_stub_result(query)
        try:
            return _summarize_web_results_with_llm(
                query,
                web_results,
                allow_related_regions=allow_related_regions,
            )
        except Exception as exc:
            logger.warning("Case law LLM summary failed, using web fallback: %s", exc)
            return _build_web_search_fallback(query, web_results, allow_related_regions=allow_related_regions)
    except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Case law web search failed, using stub fallback: %s", exc)
        return build_case_law_stub_result(query)
