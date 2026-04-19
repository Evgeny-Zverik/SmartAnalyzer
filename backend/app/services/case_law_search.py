from __future__ import annotations

import base64
import json
import re
from urllib import error, request
import xml.etree.ElementTree as ET

from app.core.config import settings
from app.core.logging import logger
from app.schemas.tools import CaseLawReferenceItem, CourtPositionItem, TenderAnalyzerResult
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
    normalized = query.strip()
    query_lower = normalized.lower()

    matched_regions = [
        (label, prefix)
        for aliases, label, prefix in _REGION_ALIASES
        if any(alias in query_lower for alias in aliases)
    ]

    if not matched_regions:
        extracted = _extract_region_hints(query)
        if extracted:
            matched_regions = [(hint.title(), "А40") for hint in extracted]

    if not matched_regions:
        matched_regions = [("Москва", "А40")]

    regions = [label for label, _ in matched_regions]
    case_prefix = matched_regions[0][1]

    court_label = "арбитражных судов"
    if "област" in query_lower or "суд общей юрисдикции" in query_lower:
        court_label = "судов общей юрисдикции"
    elif "арбитраж" in query_lower:
        court_label = "арбитражных судов"

    subject_match = re.search(r"(?:по|о)\s+(.+)", normalized, flags=re.IGNORECASE)
    subject = subject_match.group(1).strip() if subject_match else "аналогичному спору"
    subject = subject.rstrip(".")

    return TenderAnalyzerResult(
        query=normalized,
        summary=(
            f"По запросу «{normalized}» собрана подборка практики {court_label} по региону "
            f"{', '.join(regions)} с акцентом на {subject}."
        ),
        search_scope=(
            f"Регион: {', '.join(regions)}. Контур поиска: {court_label}. "
            "Если настроен внешний retrieval API, результаты будут приходить из него."
        ),
        dispute_overview=(
            f"Запрос ориентирован на споры о {subject}. Для таких дел суды обычно смотрят на договор, переписку, "
            "первичные документы, подтверждение фактического исполнения и причинную связь между нарушением и последствиями."
        ),
        regions=regions,
        court_positions=[
            CourtPositionItem(
                court=f"Практика {regions[0]}",
                position=(
                    "Суды придают значение не только тексту договора, но и переписке, актам, платежным документам "
                    "и последующему поведению сторон."
                ),
                relevance="Полезно, если спор строится на фактическом исполнении или принятии результата работ.",
            ),
            CourtPositionItem(
                court=f"Апелляционная инстанция {regions[0]}",
                position=(
                    "Для взыскания убытков и санкций требуется отдельно показать состав нарушения, расчет требований "
                    "и доказанность причинной связи."
                ),
                relevance="Важно для оценки перспектив и структуры доказательственной базы.",
            ),
        ],
        cited_cases=[
            CaseLawReferenceItem(
                title=f"Карточка дела по спору о {subject}",
                citation=f"{case_prefix}-12345/2025",
                url="https://kad.arbitr.ru/",
                takeaway="Используйте карточку дела для перехода к судебным актам, движению дела и процессуальным документам.",
            ),
            CaseLawReferenceItem(
                title="Поиск актов через ГАС Правосудие",
                citation="ГАС Правосудие",
                url="https://sudrf.ru/",
                takeaway="Удобен для расширения выдачи по региону, типу суда и ключевым словам запроса.",
            ),
        ],
        legal_basis=[
            "Статьи 309 и 310 ГК РФ о надлежащем исполнении обязательств и недопустимости одностороннего отказа.",
            "Статья 431 ГК РФ о толковании условий договора с учетом буквального смысла и поведения сторон.",
            "Статья 65 АПК РФ или статья 56 ГПК РФ о бремени доказывания в зависимости от вида суда.",
        ],
        practical_takeaways=[
            "Сужайте запрос по региону, периоду, инстанции и предмету спора, чтобы подборка была точнее.",
            "Сразу собирайте ссылки на акты, карточки дел, переписку и первичные документы под вашу позицию.",
            "Сверяйте найденную практику с вашей фактической моделью спора: предмет, нарушение, доказательства и итог.",
        ],
        follow_up_prompt="Можно уточнить период, инстанцию, вид суда или категорию спора для более точной подборки.",
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


def _matches_requested_region(query: str, item: dict[str, str]) -> bool:
    requested_regions = _extract_region_hints(query)
    if not requested_regions:
        return True
    haystack = " ".join(
        [
            item.get("title", "").lower(),
            item.get("snippet", "").lower(),
            item.get("url", "").lower(),
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
    if requested_courts and "kad.arbitr.ru" in haystack:
        return False
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


def _normalize_source_label(item: dict[str, str]) -> str:
    source = item.get("source", "").strip()
    url = item.get("url", "").strip().lower()
    if source:
        return source
    if "kad.arbitr.ru" in url:
        return "КАД Арбитр"
    if "sudrf.ru" in url:
        return "ГАС Правосудие"
    if "sudact.ru" in url:
        return "СудАкт"
    return "Найденный источник"


def _build_no_exact_matches_result(query: str, requested_regions: list[str]) -> TenderAnalyzerResult:
    base = build_case_law_stub_result(query)
    region_label = ", ".join(requested_regions) if requested_regions else "выбранного региона"
    return base.model_copy(
        update={
            "summary": (
                f"По запросу «{query}» в поисковой выдаче не нашлось точных актов для региона {region_label}. "
                "Уточните период, инстанцию, номер суда или номер дела."
            ),
            "search_scope": f"Точный поиск по региону: {region_label}.",
            "regions": requested_regions or base.regions,
            "court_positions": [],
            "cited_cases": [],
            "follow_up_prompt": (
                "Попробуйте сузить запрос: добавьте период, инстанцию, номер суда или номер дела. "
                "Если нужен поиск по аналогам из других регионов, это можно будет включить отдельно."
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
    if "арбитраж" in query.lower():
        if "kad.arbitr.ru" in haystack:
            score += 6
        if "судрф" in haystack or "sudrf.ru" in haystack:
            score -= 1
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
    for item in results:
        url = item.get("url", "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        if strict_region and not _matches_requested_region(query, item):
            continue
        score = _score_search_result(query, item)
        if not strict_region and _matches_requested_region(query, item):
            score += 6
        if not strict_region and _is_direct_case_link(item):
            score += 5
        ranked.append((score, item))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    filtered = [item for score, item in ranked if score > 0]
    if filtered:
        return filtered[:8]
    return [item for _, item in ranked[:8]]


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


def _search_case_law_yandex_api(query: str) -> list[dict[str, str]]:
    api_key = settings.yandex_search_api_key.strip()
    folder_id = settings.yandex_search_folder_id.strip()
    endpoint = settings.yandex_search_api_url.strip()
    if not api_key or not folder_id or not endpoint:
        return []

    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": _build_site_limited_query(query),
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
            title=item["title"],
            citation=item["citation"] or _normalize_source_label(item),
            url=item["url"],
            takeaway=item["snippet"] or "Откройте источник для просмотра карточки дела и судебных актов.",
        )
        for item in filtered[:5]
    ]
    positions = [
        CourtPositionItem(
            court=_normalize_source_label(item),
            position=item["snippet"] or "Найден релевантный акт по запросу.",
            relevance="Материал отобран из поисковой выдачи по совпадению с предметом спора, регионом и типом суда.",
        )
        for item in filtered[:3]
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
    return base.model_copy(
        update={
            "summary": summary,
            "search_scope": search_scope,
            "regions": region_hints or base.regions,
            "court_positions": positions,
            "cited_cases": cited_cases,
            "follow_up_prompt": follow_up_prompt,
            "data_source": "web_search",
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
Если детали нет, формулируй осторожно.
Все текстовые поля верни на русском языке.
Если в выдаче есть конфликт между арбитражными судами и судами общей юрисдикции, при слове "арбитраж" в запросе отдавай приоритет арбитражным материалам.

Верни объект с ключами:
- summary
- search_scope
- dispute_overview
- regions: string[]
- court_positions: array of objects {{court, position, relevance}}
- cited_cases: array of objects {{title, citation, url, takeaway}}
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
    return normalized


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
        yandex_results = _search_case_law_yandex_api(query)
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
