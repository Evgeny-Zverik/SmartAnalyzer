from __future__ import annotations

import io
import json
import mimetypes
import re
import threading
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib import error as urllib_error
from urllib import request as urllib_request

import cv2
import fitz
import numpy as np
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from app.core.config import settings
from app.core.encryption import decrypt
from app.utils.errors import raise_error

if TYPE_CHECKING:
    import torch
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel

register_heif_opener()

IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/heic", "image/heif"}
PDF_MIME_TYPES = {"application/pdf"}
MIN_LINE_WIDTH = 120
MIN_LINE_HEIGHT = 20
MAX_LINE_HEIGHT_RATIO = 0.25
MAX_LINE_COUNT = 80
REVIEW_CONFIDENCE_THRESHOLD = 0.6
MVD_TEMPLATE_ID = "mvd-refusal-order-185"

MVD_TEMPLATE_ZONES = (
    {"field_name": "date", "bbox": (0.05, 0.17, 0.33, 0.055), "mode": "single-line"},
    {"field_name": "place", "bbox": (0.60, 0.17, 0.30, 0.055), "mode": "single-line"},
    {"field_name": "officer", "bbox": (0.10, 0.22, 0.80, 0.055), "mode": "single-line"},
    {"field_name": "sender", "bbox": (0.40, 0.255, 0.52, 0.055), "mode": "single-line"},
    {"field_name": "circumstances", "bbox": (0.08, 0.31, 0.84, 0.17), "mode": "multiline"},
    {"field_name": "decision_reason", "bbox": (0.08, 0.65, 0.84, 0.07), "mode": "multiline"},
)

_MODEL_LOCK = threading.Lock()
_OCR_MODELS: dict[str, tuple["TrOCRProcessor", "VisionEncoderDecoderModel"]] = {}
_OCR_DEVICE: str | None = None
_OCR_MODEL_ID_IN_USE: str | None = None
_SERVICE_MODEL_ID = "trocr-service"


@dataclass(slots=True)
class OCRCrop:
    image: Image.Image
    page_index: int
    bbox: dict[str, int]
    source: str
    field_name: str | None = None


def _read_decrypted_bytes(path: str) -> bytes:
    file_path = Path(path)
    if not file_path.exists():
        raise_error(400, "BAD_REQUEST", "File not found", {"path": path})
    return decrypt(file_path.read_bytes())


def _normalize_ocr_backend() -> str:
    backend = str(settings.ocr_backend or "local").strip().lower()
    return backend if backend in {"local", "service"} else "local"


def _encode_png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _build_multipart_body(file_bytes: bytes, mime_type: str, field_name: str = "file") -> tuple[bytes, str]:
    boundary = f"codex-{uuid.uuid4().hex}"
    filename = f"upload{mimetypes.guess_extension(mime_type or '') or '.bin'}"
    lines = [
        f"--{boundary}".encode(),
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode(),
        f"Content-Type: {mime_type or 'application/octet-stream'}".encode(),
        b"",
        file_bytes,
        f"--{boundary}--".encode(),
        b"",
    ]
    return b"\r\n".join(lines), boundary


def _call_ocr_service(file_bytes: bytes, mime_type: str) -> dict[str, Any]:
    endpoint = str(settings.ocr_service_url or "").strip()
    if not endpoint:
        raise_error(500, "OCR_SERVICE_CONFIG_ERROR", "OCR service URL is not configured.", {})

    payload, boundary = _build_multipart_body(file_bytes, mime_type)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    api_key = str(settings.ocr_service_api_key or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib_request.Request(endpoint, data=payload, headers=headers, method="POST")
    timeout = max(1, int(settings.ocr_service_timeout_seconds))
    try:
        with urllib_request.urlopen(req, timeout=timeout) as response:
            raw_body = response.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        raise_error(
            502,
            "OCR_SERVICE_HTTP_ERROR",
            "OCR service returned an error.",
            {"status_code": exc.code, "detail": detail or str(exc)},
        )
    except Exception as exc:
        raise_error(502, "OCR_SERVICE_UNAVAILABLE", "Cannot reach OCR service.", {"detail": str(exc)})

    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise_error(502, "OCR_SERVICE_BAD_RESPONSE", "OCR service returned invalid JSON.", {"detail": str(exc)})

    if not isinstance(body, dict):
        raise_error(502, "OCR_SERVICE_BAD_RESPONSE", "OCR service returned unsupported payload.", {})
    return body


def _load_pages(content: bytes, mime_type: str) -> list[Image.Image]:
    if mime_type in IMAGE_MIME_TYPES:
        try:
            return [Image.open(io.BytesIO(content)).convert("RGB")]
        except Exception as exc:
            raise_error(400, "BAD_REQUEST", "Cannot read image for handwriting OCR.", {"detail": str(exc)})

    if mime_type in PDF_MIME_TYPES:
        try:
            doc = fitz.open(stream=content, filetype="pdf")
        except Exception as exc:
            raise_error(400, "BAD_REQUEST", "Cannot read PDF for handwriting OCR.", {"detail": str(exc)})

        pages: list[Image.Image] = []
        render_scale = max(1.0, float(settings.ocr_pdf_render_scale))
        matrix = fitz.Matrix(render_scale, render_scale)
        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            pages.append(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB"))
        if pages:
            return pages
        raise_error(400, "BAD_REQUEST", "PDF has no pages to process.", {})

    raise_error(
        400,
        "BAD_REQUEST",
        "Handwriting recognition supports PDF, PNG, JPEG and HEIC images.",
        {"mime_type": mime_type},
    )


def _parse_model_spec(spec: str) -> tuple[str, str | None]:
    cleaned = spec.strip()
    if "@" not in cleaned:
        return cleaned, None
    model_id, revision = cleaned.rsplit("@", 1)
    return model_id.strip(), revision.strip() or None


def _load_trocr_processor(model_id: str, revision: str | None):
    from transformers import RobertaTokenizer, TrOCRProcessor, ViTImageProcessor

    try:
        return TrOCRProcessor.from_pretrained(model_id, revision=revision)
    except Exception as exc:
        if "ModelWrapper" not in str(exc):
            raise

    image_processor = ViTImageProcessor.from_pretrained(model_id, revision=revision)
    tokenizer = RobertaTokenizer.from_pretrained(model_id, revision=revision, use_fast=False)
    return TrOCRProcessor(image_processor=image_processor, tokenizer=tokenizer)


def _load_vision_encoder_decoder_model(model_id: str, revision: str | None):
    from transformers import VisionEncoderDecoderModel

    try:
        return VisionEncoderDecoderModel.from_pretrained(model_id, revision=revision)
    except ValueError as exc:
        if "early_stopping" not in str(exc):
            raise
    return VisionEncoderDecoderModel.from_pretrained(
        model_id,
        revision=revision,
        early_stopping=False,
        num_beams=1,
    )


def _get_model_candidates() -> list[str]:
    primary = settings.ocr_model_id.strip() or "kazars24/trocr-base-handwritten-ru@5342fbb29ec56eb677f553738c2fcc2befd6b0ab"
    seen = {primary}
    candidates = [primary]
    for item in settings.ocr_model_fallbacks.split(","):
        cleaned = item.strip()
        if cleaned and cleaned not in seen:
            candidates.append(cleaned)
            seen.add(cleaned)
    return candidates


def _ensure_ocr_device() -> str:
    global _OCR_DEVICE
    if _OCR_DEVICE is None:
        import torch

        _OCR_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    return _OCR_DEVICE


def _load_model_spec(model_spec: str) -> tuple[TrOCRProcessor, VisionEncoderDecoderModel]:
    with _MODEL_LOCK:
        cached = _OCR_MODELS.get(model_spec)
        if cached is not None:
            return cached

        model_id, revision = _parse_model_spec(model_spec)
        processor = _load_trocr_processor(model_id, revision)
        model = _load_vision_encoder_decoder_model(model_id, revision)
        model.to(_ensure_ocr_device())
        model.eval()
        _OCR_MODELS[model_spec] = (processor, model)
        return processor, model


def _get_ocr_model(model_spec: str | None = None) -> tuple[str, TrOCRProcessor, VisionEncoderDecoderModel]:
    global _OCR_MODEL_ID_IN_USE

    requested = model_spec.strip() if model_spec else ""
    if requested:
        try:
            processor, model = _load_model_spec(requested)
            return requested, processor, model
        except Exception as exc:
            raise_error(
                500,
                "OCR_UNAVAILABLE",
                "Cannot load handwriting OCR model.",
                {"attempts": [{"model_id": requested, "detail": str(exc)}]},
            )

    if _OCR_MODEL_ID_IN_USE:
        processor, model = _load_model_spec(_OCR_MODEL_ID_IN_USE)
        return _OCR_MODEL_ID_IN_USE, processor, model

    errors: list[dict[str, str]] = []
    for candidate in _get_model_candidates():
        try:
            processor, model = _load_model_spec(candidate)
            _OCR_MODEL_ID_IN_USE = candidate
            return candidate, processor, model
        except Exception as exc:
            errors.append({"model_id": candidate, "detail": str(exc)})

    raise_error(
        500,
        "OCR_UNAVAILABLE",
        "Cannot load handwriting OCR model.",
        {"attempts": errors},
    )


def _get_generic_secondary_model_id(primary_model_id: str) -> str | None:
    if not settings.ocr_generic_ensemble_enabled:
        return None

    preferred = settings.ocr_generic_secondary_model_id.strip()
    candidates = [preferred] if preferred else []
    candidates.extend(item for item in _get_model_candidates() if item != primary_model_id)

    seen: set[str] = set()
    for candidate in candidates:
        cleaned = candidate.strip()
        if not cleaned or cleaned == primary_model_id or cleaned in seen:
            continue
        seen.add(cleaned)
        try:
            _load_model_spec(cleaned)
            return cleaned
        except Exception:
            continue
    return None


def _to_grayscale(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)


def _deskew(gray: np.ndarray) -> np.ndarray:
    coords = np.column_stack(np.where(gray < 240))
    if coords.size == 0:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:
        return gray

    height, width = gray.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(gray, matrix, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _prepare_binary(gray: np.ndarray) -> np.ndarray:
    denoised = cv2.fastNlMeansDenoising(gray, None, 12, 7, 21)
    return cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        15,
    )


def _prepare_text_binary(gray: np.ndarray) -> np.ndarray:
    binary = _prepare_binary(gray)
    height, width = binary.shape[:2]

    # Suppress notebook/grid lines and form underlines before line extraction.
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(24, width // 18), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(24, height // 18)))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
    cleaned = cv2.subtract(binary, cv2.bitwise_or(horizontal, vertical))
    return cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8))


def _make_bbox(x: int, y: int, width: int, height: int) -> dict[str, int]:
    return {"x": int(x), "y": int(y), "width": int(width), "height": int(height)}


def _row_segments(binary: np.ndarray, *, smoothing_window: int, threshold_bias: float, min_height: int) -> list[tuple[int, int]]:
    row_sum = binary.sum(axis=1) / 255.0
    window = max(3, smoothing_window)
    kernel = np.ones(window, dtype=np.float32) / float(window)
    smooth = np.convolve(row_sum, kernel, mode="same")
    threshold = smooth.mean() + smooth.std() * threshold_bias
    active = smooth > threshold

    segments: list[tuple[int, int]] = []
    in_segment = False
    start = 0
    for idx, value in enumerate(active):
        if value and not in_segment:
            start = idx
            in_segment = True
        elif not value and in_segment:
            if idx - start >= min_height:
                segments.append((start, idx - 1))
            in_segment = False

    if in_segment and len(smooth) - start >= min_height:
        segments.append((start, len(smooth) - 1))
    return segments


def _merge_close_segments(segments: list[tuple[int, int]], *, max_gap: int) -> list[tuple[int, int]]:
    if not segments:
        return []

    merged: list[tuple[int, int]] = [segments[0]]
    for start, end in segments[1:]:
        prev_start, prev_end = merged[-1]
        if start - prev_end <= max_gap:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def _trim_content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    gray = _deskew(_to_grayscale(image))
    binary = _prepare_text_binary(gray)

    row_segments = _row_segments(binary, smoothing_window=5, threshold_bias=0.2, min_height=3)
    if not row_segments:
        return None
    row_start = min(segment[0] for segment in row_segments)
    row_end = max(segment[1] for segment in row_segments)

    col_sum = binary.sum(axis=0) / 255.0
    threshold = col_sum.mean() + col_sum.std() * 0.2
    active_cols = np.where(col_sum > threshold)[0]
    if active_cols.size == 0:
        return None

    col_start = int(active_cols[0])
    col_end = int(active_cols[-1])
    return col_start, row_start, col_end, row_end


def _crop_with_bbox(image: Image.Image, bbox: tuple[int, int, int, int], *, padding: int = 8) -> tuple[Image.Image, tuple[int, int, int, int]]:
    width, height = image.size
    x0, y0, x1, y1 = bbox
    left = max(0, x0 - padding)
    top = max(0, y0 - padding)
    right = min(width, x1 + padding + 1)
    bottom = min(height, y1 + padding + 1)
    return image.crop((left, top, right, bottom)), (left, top, right, bottom)


def _extract_projection_crops(
    image: Image.Image,
    page_index: int,
    *,
    offset_x: int,
    offset_y: int,
    field_name: str,
    source_name: str,
) -> list[OCRCrop]:
    gray = _deskew(_to_grayscale(image))
    binary = _prepare_text_binary(gray)
    segments = _merge_close_segments(
        _row_segments(binary, smoothing_window=7, threshold_bias=0.45, min_height=6),
        max_gap=10,
    )

    crops: list[OCRCrop] = []
    for start, end in segments:
        top = max(0, start - 6)
        bottom = min(image.size[1], end + 7)
        if bottom - top < 14:
            extra = 14 - (bottom - top)
            top = max(0, top - extra // 2 - 1)
            bottom = min(image.size[1], bottom + extra - extra // 2)
        region = image.crop((0, top, image.size[0], bottom))
        content_bbox = _trim_content_bbox(region)
        if content_bbox is not None:
            if source_name == "generic-projection":
                _, y0, _, y1 = _crop_with_bbox(region, content_bbox, padding=6)[1]
                x0 = 0
                x1 = region.size[0]
                trimmed = region.crop((x0, y0, x1, y1))
            else:
                trimmed, (x0, y0, x1, y1) = _crop_with_bbox(region, content_bbox, padding=6)
            if (x1 - x0) < 32 or (y1 - y0) < 12:
                continue
            bbox = _make_bbox(offset_x + x0, offset_y + top + y0, x1 - x0, y1 - y0)
            crops.append(
                OCRCrop(
                    image=trimmed,
                    page_index=page_index,
                    bbox=bbox,
                    source=source_name,
                    field_name=field_name,
                )
            )
            continue

        if image.size[0] < 32 or (bottom - top) < 12:
            continue
        bbox = _make_bbox(offset_x, offset_y + top, image.size[0], bottom - top)
        crops.append(
            OCRCrop(
                image=region,
                page_index=page_index,
                bbox=bbox,
                source=source_name,
                field_name=field_name,
            )
        )

    return crops


def _extract_line_crops(
    page: Image.Image,
    page_index: int,
    *,
    offset_x: int = 0,
    offset_y: int = 0,
    source_name: str = "line-detection",
    field_name: str | None = None,
) -> list[OCRCrop]:
    gray = _to_grayscale(page)
    gray = _deskew(gray)
    binary = _prepare_text_binary(gray)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 3))
    merged = cv2.dilate(binary, kernel, iterations=1)
    contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    source_array = np.array(page)
    max_line_height = int(source_array.shape[0] * MAX_LINE_HEIGHT_RATIO)
    crops: list[tuple[int, OCRCrop]] = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < MIN_LINE_WIDTH or h < MIN_LINE_HEIGHT or h > max_line_height:
            continue

        pad_x = max(8, int(w * 0.02))
        pad_y = max(8, int(h * 0.2))
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(source_array.shape[1], x + w + pad_x)
        y1 = min(source_array.shape[0], y + h + pad_y)
        crop = Image.fromarray(source_array[y0:y1, x0:x1]).convert("RGB")
        crops.append(
            (
                y0,
                OCRCrop(
                    image=crop,
                    page_index=page_index,
                    bbox=_make_bbox(offset_x + x0, offset_y + y0, x1 - x0, y1 - y0),
                    source=source_name,
                    field_name=field_name,
                ),
            )
        )

    crops.sort(key=lambda item: item[0])
    line_crops = [crop for _, crop in crops[:MAX_LINE_COUNT]]
    return line_crops


def _extract_horizontal_lines(binary: np.ndarray, width: int) -> list[tuple[int, int, int, int]]:
    kernel_width = max(60, width // 5)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_width, 1))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    segments: list[tuple[int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w >= width * 0.12 and h <= max(8, binary.shape[0] // 60):
            segments.append((x, y, w, h))
    return segments


def _detect_mvd_template(page: Image.Image) -> str | None:
    width, height = page.size
    aspect = height / max(width, 1)
    if aspect < 1.2 or aspect > 1.7:
        return None

    gray = _deskew(_to_grayscale(page))
    binary = _prepare_binary(gray)
    segments = _extract_horizontal_lines(binary, width)
    if len(segments) < 8:
        return None

    ys = [y / max(height, 1) for _, y, _, _ in segments]
    expected_bands = (0.18, 0.22, 0.27, 0.34, 0.40, 0.46, 0.67)
    matches = sum(1 for band in expected_bands if any(abs(y - band) <= 0.035 for y in ys))
    return MVD_TEMPLATE_ID if matches >= 5 else None


def _should_force_mvd_template(page: Image.Image) -> bool:
    width, height = page.size
    aspect = height / max(width, 1)
    if width < 600 or height < 850:
        return False
    return 1.25 <= aspect <= 1.55


def _extract_template_crops(page: Image.Image, page_index: int, template_id: str) -> list[OCRCrop]:
    if template_id != MVD_TEMPLATE_ID:
        return _extract_line_crops(page, page_index)

    width, height = page.size
    source = np.array(page)
    crops: list[OCRCrop] = []

    for zone in MVD_TEMPLATE_ZONES:
        norm_x, norm_y, norm_w, norm_h = zone["bbox"]
        x = max(0, int(width * norm_x))
        y = max(0, int(height * norm_y))
        w = max(1, int(width * norm_w))
        h = max(1, int(height * norm_h))
        x1 = min(width, x + w)
        y1 = min(height, y + h)
        region = Image.fromarray(source[y:y1, x:x1]).convert("RGB")
        field_name = str(zone["field_name"])

        if zone["mode"] == "multiline":
            zone_crops = _extract_projection_crops(
                region,
                page_index,
                offset_x=x,
                offset_y=y,
                source_name="template-zone-projection",
                field_name=field_name,
            )
            if zone_crops:
                crops.extend(zone_crops)
                continue

        content_bbox = _trim_content_bbox(region)
        if content_bbox is not None:
            trimmed, (left, top, right, bottom) = _crop_with_bbox(region, content_bbox, padding=6)
            crops.append(
                OCRCrop(
                    image=trimmed,
                    page_index=page_index,
                    bbox=_make_bbox(x + left, y + top, right - left, bottom - top),
                    source="template-zone-trimmed",
                    field_name=field_name,
                )
            )
            continue

        crops.append(
            OCRCrop(
                image=region,
                page_index=page_index,
                bbox=_make_bbox(x, y, x1 - x, y1 - y),
                source="template-zone",
                field_name=field_name,
            )
        )

    return crops


def _select_generic_crops(page: Image.Image, page_index: int) -> list[OCRCrop]:
    contour_crops = _extract_line_crops(page, page_index)
    projection_crops = _extract_projection_crops(
        page,
        page_index,
        offset_x=0,
        offset_y=0,
        source_name="generic-projection",
        field_name=None,
    )

    if not contour_crops:
        return projection_crops
    if len(projection_crops) >= len(contour_crops) + 2:
        return projection_crops
    return contour_crops


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(text or ""))
    normalized = normalized.replace("\\", "/")
    normalized = re.sub(r"[^0-9А-Яа-яЁё .,:\-/()]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = re.sub(r"\s+([.,:()/-])", r"\1", normalized)
    normalized = re.sub(r"([(/-])\s+", r"\1", normalized)
    return normalized.strip(" .,:\n\t")


def _normalize_field_text(field_name: str | None, text: str) -> str:
    cleaned = _normalize_text(text)
    if not cleaned:
        return cleaned

    if field_name == "date":
        digits = re.sub(r"\D+", "", cleaned)
        if len(digits) >= 8:
            if len(digits) > 8:
                digits = digits[-8:]
            day = digits[:2]
            month = digits[2:4]
            year = digits[4:8]
            return f"{day}.{month}.{year}"
        if len(digits) == 6:
            return f"{digits[:2]}.{digits[2:4]}.20{digits[4:6]}"

    if field_name == "place":
        cleaned = re.sub(r"^[,.;:]+", "", cleaned).strip()
        if cleaned and not cleaned.lower().startswith(("г ", "г.", "пос.", "с.", "дер.", "рп.")):
            cleaned = f"г. {cleaned}"
        return cleaned

    return cleaned


def _confidence_from_generation(output: Any) -> float:
    import torch

    scores = getattr(output, "scores", None) or []
    sequences = getattr(output, "sequences", None)
    if sequences is None or not scores:
        return 0.0

    token_ids = sequences[0].tolist()
    if len(token_ids) <= 1:
        return 0.0

    generated_ids = token_ids[1 : 1 + len(scores)]
    probs: list[float] = []
    for step_scores, token_id in zip(scores, generated_ids):
        distribution = torch.softmax(step_scores[0], dim=-1)
        probs.append(float(distribution[token_id].item()))
    if not probs:
        return 0.0
    return max(0.0, min(1.0, sum(probs) / len(probs)))


def _text_quality_score(text: str) -> float:
    cleaned = _normalize_text(text)
    if not cleaned:
        return 0.0

    letters = [char.lower() for char in cleaned if char.isalpha()]
    if not letters:
        return 0.05 if any(char.isdigit() for char in cleaned) else 0.0

    modern_cyrillic = set("абвгдеёжзийклмнопрстуфхцчшщъыьэюя")
    cyrillic_count = sum(1 for char in letters if char in modern_cyrillic)
    latin_count = sum(1 for char in letters if "a" <= char <= "z")
    other_alpha_count = max(0, len(letters) - cyrillic_count - latin_count)
    cyrillic_ratio = cyrillic_count / max(len(letters), 1)
    latin_ratio = latin_count / max(len(letters), 1)
    other_alpha_ratio = other_alpha_count / max(len(letters), 1)

    vowels = set("аеёиоуыэюя")
    cyrillic_vowels = sum(1 for char in letters if char in vowels)
    vowel_ratio = cyrillic_vowels / max(cyrillic_count, 1) if cyrillic_count else 0.0
    vowel_balance = max(0.0, 1.0 - min(abs(vowel_ratio - 0.42), 0.42) / 0.42) if cyrillic_count else 0.0

    punctuation_ratio = sum(1 for char in cleaned if not char.isalnum() and not char.isspace()) / max(len(cleaned), 1)
    combining_ratio = sum(1 for char in cleaned if unicodedata.combining(char)) / max(len(cleaned), 1)
    word_count = len([word for word in cleaned.split() if word])
    length_score = min(len(cleaned) / 18.0, 1.0)
    word_score = min(word_count / 4.0, 1.0)

    score = (
        cyrillic_ratio * 0.45
        + vowel_balance * 0.15
        + length_score * 0.15
        + word_score * 0.10
        - latin_ratio * 0.30
        - other_alpha_ratio * 0.55
        - min(punctuation_ratio, 0.25) * 0.20
        - min(combining_ratio, 0.20) * 0.65
    )
    return max(0.0, min(1.0, score))


def _candidate_score(text: str, confidence: float) -> float:
    return max(0.0, min(1.0, confidence * 0.65 + _text_quality_score(text) * 0.35))


def _contains_non_modern_script(text: str) -> bool:
    modern_cyrillic = set("абвгдеёжзийклмнопрстуфхцчшщъыьэюя")
    for char in text.lower():
        if unicodedata.combining(char):
            return True
        if not char.isalpha():
            continue
        if char in modern_cyrillic or "a" <= char <= "z":
            continue
        return True
    return False


def _prepare_crop_for_model(image: Image.Image) -> Image.Image:
    prepared = ImageOps.autocontrast(image.convert("RGB"))
    width, height = prepared.size

    scale = 1
    if height < 48:
        scale = max(scale, int(np.ceil(48 / max(height, 1))))
    if width < 320:
        scale = max(scale, int(np.ceil(320 / max(width, 1))))
    scale = min(scale, 3)

    if scale > 1:
        prepared = prepared.resize((width * scale, height * scale), Image.Resampling.LANCZOS)
    return prepared


def _recognize_crop_with_model(image: Image.Image, model_spec: str | None = None) -> tuple[str, float, str]:
    import torch

    active_model_id, processor, model = _get_ocr_model(model_spec)
    prepared = _prepare_crop_for_model(image)

    try:
        encoded = processor.image_processor(images=prepared, return_tensors=None)
        raw_pixel_values = np.asarray(encoded["pixel_values"], dtype=np.float32)
        if raw_pixel_values.ndim == 3:
            raw_pixel_values = raw_pixel_values[None, ...]
        pixel_values = torch.from_numpy(raw_pixel_values).to(_ensure_ocr_device())
    except Exception as exc:
        raise_error(500, "OCR_FAILED", "Cannot prepare image for handwriting OCR.", {"detail": str(exc)})

    try:
        with torch.no_grad():
            output = model.generate(
                pixel_values,
                max_new_tokens=max(16, int(settings.ocr_max_new_tokens)),
                return_dict_in_generate=True,
                output_scores=True,
            )
    except Exception as exc:
        raise_error(500, "OCR_FAILED", "Handwriting recognition failed during inference.", {"detail": str(exc)})

    text = processor.batch_decode(output.sequences, skip_special_tokens=True)[0]
    return _normalize_text(text), _confidence_from_generation(output), active_model_id


def _recognize_crop(image: Image.Image, crop: OCRCrop) -> tuple[str, float, str]:
    text, confidence, model_id = _recognize_crop_with_model(image)
    best_text = text
    best_confidence = confidence
    best_model_id = model_id
    best_score = _candidate_score(text, confidence)

    should_try_secondary = (
        settings.ocr_generic_ensemble_enabled
        and crop.source == "generic-projection"
        and crop.field_name is None
        and best_score < 0.80
    )
    if not should_try_secondary:
        return best_text, best_confidence, best_model_id

    secondary_model_id = _get_generic_secondary_model_id(model_id)
    if not secondary_model_id:
        return best_text, best_confidence, best_model_id

    alt_text, alt_confidence, alt_model_id = _recognize_crop_with_model(image, secondary_model_id)
    if _contains_non_modern_script(alt_text):
        return best_text, best_confidence, best_model_id
    alt_score = _candidate_score(alt_text, alt_confidence)
    if alt_score > best_score + 0.04:
        return alt_text, alt_confidence, alt_model_id
    return best_text, best_confidence, best_model_id


def _recognize_handwriting_local_from_pages(pages: list[Image.Image]) -> dict[str, Any]:
    template_id = _detect_mvd_template(pages[0]) if pages else None
    all_lines: list[dict[str, Any]] = []
    for page_index, page in enumerate(pages):
        if template_id and page_index == 0:
            crops = _extract_template_crops(page, page_index, template_id)
        else:
            crops = _select_generic_crops(page, page_index)
            if not crops and page_index == 0 and _should_force_mvd_template(page):
                template_id = MVD_TEMPLATE_ID
                crops = _extract_template_crops(page, page_index, template_id)
        if not crops:
            crops = [
                OCRCrop(
                    image=page,
                    page_index=page_index,
                    bbox=_make_bbox(0, 0, page.size[0], page.size[1]),
                    source="full-page-fallback",
                )
            ]

        for crop in crops:
            text, confidence, model_id = _recognize_crop(crop.image, crop)
            text = _normalize_field_text(crop.field_name, text)
            if text:
                all_lines.append(
                    {
                        "text": text,
                        "confidence": confidence,
                        "model_id": model_id,
                        "page_index": crop.page_index,
                        "field_name": crop.field_name,
                        "source": crop.source,
                        "needs_review": confidence < REVIEW_CONFIDENCE_THRESHOLD,
                        "bbox": crop.bbox,
                    }
                )

    recognized_text = "\n".join(str(line["text"]) for line in all_lines).strip()
    if all_lines:
        confidence = sum(float(line["confidence"]) for line in all_lines) / len(all_lines)
    else:
        confidence = 0.0
    needs_review_count = sum(1 for line in all_lines if line.get("needs_review"))

    return {
        "recognized_text": recognized_text,
        "confidence": confidence,
        "page_count": len(pages),
        "template_id": template_id,
        "ocr_model_id": _OCR_MODEL_ID_IN_USE,
        "needs_review_count": needs_review_count,
        "lines": all_lines,
    }


def _recognize_handwriting_local(content: bytes, mime_type: str) -> dict[str, Any]:
    pages = _load_pages(content, mime_type)
    return _recognize_handwriting_local_from_pages(pages)


def _recognize_handwriting_via_service(content: bytes, mime_type: str) -> dict[str, Any]:
    pages = _load_pages(content, mime_type)
    all_lines: list[dict[str, Any]] = []

    for page_index, page in enumerate(pages):
        page_bytes = content if mime_type in IMAGE_MIME_TYPES and page_index == 0 else _encode_png_bytes(page)
        page_mime_type = mime_type if mime_type in IMAGE_MIME_TYPES and page_index == 0 else "image/png"
        raw_response = _call_ocr_service(page_bytes, page_mime_type)
        page_text = _normalize_text(
            str(raw_response.get("text") or raw_response.get("recognized_text") or "")
        )
        if not page_text:
            continue
        all_lines.append(
            {
                "text": page_text,
                "confidence": 1.0,
                "model_id": _SERVICE_MODEL_ID,
                "page_index": page_index,
                "field_name": None,
                "source": "ocr-service",
                "needs_review": False,
                "bbox": _make_bbox(0, 0, page.size[0], page.size[1]),
            }
        )

    recognized_text = "\n".join(str(line["text"]) for line in all_lines).strip()
    return {
        "recognized_text": recognized_text,
        "confidence": 1.0 if all_lines else 0.0,
        "page_count": len(pages),
        "template_id": None,
        "ocr_model_id": _SERVICE_MODEL_ID,
        "needs_review_count": 0,
        "lines": all_lines,
    }


def recognize_handwriting_bytes(content: bytes, mime_type: str) -> dict[str, Any]:
    if _normalize_ocr_backend() == "service":
        return _recognize_handwriting_via_service(content, mime_type)
    return _recognize_handwriting_local(content, mime_type)


def recognize_handwriting(path: str, mime_type: str) -> dict[str, Any]:
    content = _read_decrypted_bytes(path)
    return recognize_handwriting_bytes(content, mime_type)
