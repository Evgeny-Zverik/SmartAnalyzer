from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms import ColorJitter, RandomAffine
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune TrOCR for Russian handwriting from photo line crops.")
    parser.add_argument("--train-manifest", required=True, help="JSONL manifest with image_path and text fields.")
    parser.add_argument("--val-manifest", required=True, help="Validation JSONL manifest.")
    parser.add_argument("--base-model", default="kazars24/trocr-base-handwritten-ru")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=3e-5)
    parser.add_argument("--weight-decay", type=float, default=1e-2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-target-length", type=int, default=160)
    parser.add_argument("--save-every-epoch", action="store_true")
    return parser.parse_args()


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def read_manifest(path: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_no, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            item = json.loads(line)
            image_path = str(item.get("image_path") or "").strip()
            text = str(item.get("text") or "").strip()
            if not image_path or not text:
                raise ValueError(f"Manifest {path}:{line_no} must contain image_path and text.")
            rows.append({"image_path": image_path, "text": text})
    if not rows:
        raise ValueError(f"Manifest {path} is empty.")
    return rows


def normalize_target_text(text: str) -> str:
    return " ".join(str(text or "").split()).strip()


def prepare_image(image: Image.Image) -> Image.Image:
    image = ImageOps.autocontrast(image.convert("RGB"))
    width, height = image.size
    scale = 1
    if height < 48:
        scale = max(scale, math.ceil(48 / max(height, 1)))
    if width < 320:
        scale = max(scale, math.ceil(320 / max(width, 1)))
    scale = min(scale, 3)
    if scale > 1:
        image = image.resize((width * scale, height * scale), Image.Resampling.LANCZOS)
    return image


@dataclass
class Batch:
    pixel_values: torch.Tensor
    labels: torch.Tensor


class PhotoHandwritingDataset(Dataset):
    def __init__(self, rows: list[dict[str, str]], *, train: bool) -> None:
        self.rows = rows
        self.train = train
        self.affine = RandomAffine(degrees=2, translate=(0.01, 0.02), scale=(0.98, 1.02), fill=255)
        self.jitter = ColorJitter(brightness=0.18, contrast=0.18, saturation=0.02)

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, object]:
        row = self.rows[index]
        image = Image.open(row["image_path"]).convert("RGB")
        image = prepare_image(image)
        if self.train:
            image = self.jitter(image)
            image = self.affine(image)
        return {"image": image, "text": normalize_target_text(row["text"])}


def collate_batch(
    samples: list[dict[str, object]],
    *,
    processor: TrOCRProcessor,
    max_target_length: int,
) -> Batch:
    images = [sample["image"] for sample in samples]
    texts = [str(sample["text"]) for sample in samples]
    pixel_values = processor(images=images, return_tensors="pt").pixel_values
    tokenized = processor.tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=max_target_length,
        return_tensors="pt",
    )
    labels = tokenized.input_ids
    labels[labels == processor.tokenizer.pad_token_id] = -100
    return Batch(pixel_values=pixel_values, labels=labels)


def edit_distance(left: str, right: str) -> int:
    rows = len(left) + 1
    cols = len(right) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if left[i - 1] == right[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[-1][-1]


def char_error_rate(predictions: list[str], references: list[str]) -> float:
    total_distance = 0
    total_chars = 0
    for prediction, reference in zip(predictions, references):
        reference = normalize_target_text(reference)
        prediction = normalize_target_text(prediction)
        total_distance += edit_distance(prediction, reference)
        total_chars += max(len(reference), 1)
    return total_distance / max(total_chars, 1)


def evaluate(
    model: VisionEncoderDecoderModel,
    processor: TrOCRProcessor,
    loader: DataLoader,
    device: str,
) -> float:
    model.eval()
    predictions: list[str] = []
    references: list[str] = []

    with torch.no_grad():
        for batch in loader:
            pixel_values = batch.pixel_values.to(device)
            labels = batch.labels
            generated = model.generate(pixel_values, max_new_tokens=160)
            predictions.extend(processor.batch_decode(generated, skip_special_tokens=True))

            restored = labels.clone()
            restored[restored == -100] = processor.tokenizer.pad_token_id
            references.extend(processor.tokenizer.batch_decode(restored, skip_special_tokens=True))

    return char_error_rate(predictions, references)


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    train_rows = read_manifest(args.train_manifest)
    val_rows = read_manifest(args.val_manifest)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    processor = TrOCRProcessor.from_pretrained(args.base_model)
    model = VisionEncoderDecoderModel.from_pretrained(args.base_model)

    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.eos_token_id = processor.tokenizer.sep_token_id
    model.config.vocab_size = model.config.decoder.vocab_size

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

    train_dataset = PhotoHandwritingDataset(train_rows, train=True)
    val_dataset = PhotoHandwritingDataset(val_rows, train=False)

    def build_loader(dataset: Dataset, shuffle: bool) -> DataLoader:
        return DataLoader(
            dataset,
            batch_size=args.batch_size,
            shuffle=shuffle,
            num_workers=0,
            collate_fn=lambda samples: collate_batch(
                samples,
                processor=processor,
                max_target_length=args.max_target_length,
            ),
        )

    train_loader = build_loader(train_dataset, shuffle=True)
    val_loader = build_loader(val_dataset, shuffle=False)

    optimizer = AdamW(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)
    best_cer = float("inf")

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0

        for step, batch in enumerate(train_loader, start=1):
            pixel_values = batch.pixel_values.to(device)
            labels = batch.labels.to(device)

            outputs = model(pixel_values=pixel_values, labels=labels)
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)

            total_loss += float(loss.item())
            if step % 20 == 0 or step == len(train_loader):
                avg_loss = total_loss / step
                print(f"epoch={epoch} step={step}/{len(train_loader)} loss={avg_loss:.4f}")

        val_cer = evaluate(model, processor, val_loader, device)
        avg_epoch_loss = total_loss / max(len(train_loader), 1)
        print(f"epoch={epoch} train_loss={avg_epoch_loss:.4f} val_cer={val_cer:.4f}")

        if args.save_every_epoch:
            epoch_dir = output_dir / f"epoch-{epoch}"
            model.save_pretrained(epoch_dir)
            processor.save_pretrained(epoch_dir)

        if val_cer < best_cer:
            best_cer = val_cer
            best_dir = output_dir / "best"
            best_dir.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(best_dir)
            processor.save_pretrained(best_dir)

    with (output_dir / "training_summary.json").open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "base_model": args.base_model,
                "epochs": args.epochs,
                "batch_size": args.batch_size,
                "learning_rate": args.learning_rate,
                "best_val_cer": best_cer,
                "train_examples": len(train_rows),
                "val_examples": len(val_rows),
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )

    print(f"best checkpoint: {output_dir / 'best'}")


if __name__ == "__main__":
    main()
