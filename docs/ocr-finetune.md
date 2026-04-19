# Fine-Tuning OCR For Russian Handwriting Photos

## Когда это нужно

Текущая модель `kazars24/trocr-base-handwritten-ru` уже знает русскую рукопись, но ваш реальный домен уже уже:

- фото тетрадных листов;
- синяя/черная ручка;
- клетка на фоне;
- школьный/курсивный почерк;
- иногда наклон, тени, неидеальная перспектива.

Для такого кейса нужен не общий OCR, а дообучение именно на **line-crops из фото русской рукописи**.

## Важное ограничение

Текущий backend распознает не всю страницу одной моделью, а сначала режет страницу на строки, а потом подает строки в TrOCR.

Значит, дообучать нужно не на полных фото страниц, а на **картинках отдельных строк**:

- `line_0001.png -> "Свойства элементов, а потому и"`
- `line_0002.png -> "свойства образованных ими"`
- `line_0003.png -> "простых и сложных веществ"`

Именно такой формат лучше всего совпадает с вашим текущим pipeline.

## Формат датасета

Сделайте два файла:

- `train.jsonl`
- `val.jsonl`

Формат строки:

```json
{"image_path": "/absolute/path/to/line_0001.png", "text": "Свойства элементов, а потому и"}
```

Требования:

- только русская рукопись с фото;
- одна картинка = одна строка;
- текст разметки должен быть чистым эталоном;
- лучше убрать пустые/смазанные строки, чем учить модель на мусоре.

## Запуск обучения

Из корня проекта:

```bash
cd /Users/evgenij/Desktop/SmartAnalyzer
./backend/.venv311/bin/python scripts/train_trocr_ru_photos.py \
  --train-manifest /absolute/path/train.jsonl \
  --val-manifest /absolute/path/val.jsonl \
  --output-dir /absolute/path/models/trocr-ru-photo-ft \
  --base-model kazars24/trocr-base-handwritten-ru \
  --epochs 6 \
  --batch-size 4 \
  --learning-rate 3e-5
```

Лучший checkpoint сохранится в:

```text
/absolute/path/models/trocr-ru-photo-ft/best
```

## Быстрая проверка модели

```bash
cd /Users/evgenij/Desktop/SmartAnalyzer
./backend/.venv311/bin/python scripts/predict_trocr_ru.py \
  --image /absolute/path/to/line_0001.png \
  --model /absolute/path/models/trocr-ru-photo-ft/best
```

## Как подключить в backend

Ничего переписывать не нужно. Просто укажите локальный checkpoint в env:

```env
OCR_MODEL_ID=/absolute/path/models/trocr-ru-photo-ft/best
OCR_MODEL_FALLBACKS=
OCR_GENERIC_ENSEMBLE_ENABLED=false
```

После этого перезапустите backend.

## Практический совет по качеству

Если цель только одна: **русская рукопись с фото**, то качество сильнее всего растет от этих шагов:

1. Дообучать только на вашем домене, а не на смешанном OCR-датасете.
2. Давать модели именно строки, а не целые страницы.
3. Включать в train фото с клеткой, тенями, небольшим поворотом и разным освещением.
4. Держать валидацию из тех же реальных фото, но не из train.
5. После первой итерации собрать ошибки модели и добавить именно проблемные почерки обратно в train.

## Что делать дальше

Если после fine-tune качество все еще слабое, следующий шаг уже не “докрутить параметры”, а:

- улучшить line-segmentation для фото тетрадных страниц;
- добавить deskew/perspective correction перед OCR;
- хранить отдельную модель именно под `photo_ru_handwriting`.
