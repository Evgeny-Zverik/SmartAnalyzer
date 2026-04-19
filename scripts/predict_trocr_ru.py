from __future__ import annotations

import argparse
from pathlib import Path

import torch
from PIL import Image, ImageOps
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run TrOCR inference for a single Russian handwriting image.")
    parser.add_argument("--image", required=True, help="Path to a line image or cropped handwriting fragment.")
    parser.add_argument(
        "--model",
        default="kazars24/trocr-base-handwritten-ru",
        help="HF model id or local checkpoint directory.",
    )
    parser.add_argument("--max-new-tokens", type=int, default=96)
    return parser.parse_args()


def prepare_image(path: str) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image = ImageOps.autocontrast(image)
    width, height = image.size
    scale = 1
    if height < 48:
        scale = max(scale, (48 + max(height, 1) - 1) // max(height, 1))
    if width < 320:
        scale = max(scale, (320 + max(width, 1) - 1) // max(width, 1))
    scale = min(scale, 3)
    if scale > 1:
        image = image.resize((width * scale, height * scale), Image.Resampling.LANCZOS)
    return image


def main() -> None:
    args = parse_args()
    image_path = Path(args.image)
    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")

    processor = TrOCRProcessor.from_pretrained(args.model)
    model = VisionEncoderDecoderModel.from_pretrained(args.model)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()

    image = prepare_image(str(image_path))
    encoded = processor(images=image, return_tensors="pt")
    pixel_values = encoded.pixel_values.to(device)

    with torch.no_grad():
        generated = model.generate(pixel_values, max_new_tokens=max(16, args.max_new_tokens))

    text = processor.batch_decode(generated, skip_special_tokens=True)[0].strip()
    print(text)


if __name__ == "__main__":
    main()
