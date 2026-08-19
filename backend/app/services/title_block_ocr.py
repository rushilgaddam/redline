"""Title-block OCR equipment resolution.

Unlike the rest of this prototype's "AI," this one is genuinely real: a
title-block thumbnail is rendered per drawing (standing in for a real photo
a technician would take of the physical drawing's bottom-right corner), and
Tesseract actually reads the pixels — the server never trusts which drawing
the client says it photographed, only what OCR extracts from the image file
on disk. See MOCKS.md: the "camera" is simulated (a picker instead of a real
lens), but the OCR pipeline itself is not.
"""
import re
from pathlib import Path

import pytesseract
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
W, H = 1000, 280

_FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
_FONT_REGULAR_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = _FONT_CANDIDATES if bold else _FONT_REGULAR_CANDIDATES
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def title_block_path(drawing_id: str) -> Path:
    return UPLOADS_DIR / f"{drawing_id}_titleblock.png"


def generate_title_block_image(drawing: models.Drawing, author_name: str) -> Image.Image:
    """Renders a realistic ANSI-style title block — the actual image a
    technician would be photographing — so OCR has real pixels to read."""
    img = Image.new("RGB", (W, H), "#f4f1ea")
    d = ImageDraw.Draw(img)

    outer = 8
    d.rectangle([outer, outer, W - outer, H - outer], outline="#111111", width=3)

    label_font = _font(15, bold=True)
    value_font = _font(22, bold=True)
    small_value = _font(17)

    def cell(x0, y0, x1, y1, label, value, value_font_=value_font):
        d.rectangle([x0, y0, x1, y1], outline="#111111", width=2)
        d.text((x0 + 10, y0 + 6), label, fill="#333333", font=label_font)
        d.text((x0 + 10, y0 + 28), value, fill="#000000", font=value_font_)

    top = outer + 6
    row_h = (H - 2 * outer - 12) // 3
    mid = W // 2

    cell(outer + 6, top, mid, top + row_h, "TITLE", drawing.title[:38])
    cell(mid, top, W - outer - 6, top + row_h, "DISCIPLINE", drawing.discipline)

    y2 = top + row_h
    cell(outer + 6, y2, mid, y2 + row_h, "DRAWING NO.", drawing.drawing_number)
    cell(mid, y2, W - outer - 6, y2 + row_h, "REV", drawing.revision)

    y3 = y2 + row_h
    cell(outer + 6, y3, mid, y3 + row_h, "DRAWN BY", author_name, small_value)
    cell(mid, y3, W - outer - 6, y3 + row_h, "DATE", drawing.created_at.strftime("%Y-%m-%d"), small_value)

    return img


def save_title_block_image(drawing: models.Drawing, author_name: str) -> None:
    UPLOADS_DIR.mkdir(exist_ok=True)
    img = generate_title_block_image(drawing, author_name)
    img.save(title_block_path(drawing.id))


# --psm 6 ("assume a uniform block of text") reads this specific two-column
# title-block layout as label-row / value-row pairs, which turned out far more
# reliable in testing than the default auto-segmentation mode (psm 3) — that
# mode silently dropped the REV cell's single-character value entirely. See
# MOCKS.md-adjacent note: this was actually measured against a real render,
# not assumed.
_OCR_CONFIG = "--psm 6"


def _parse(raw_text: str) -> tuple[str | None, str | None]:
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    for i, line in enumerate(lines):
        if re.search(r"DRAWING\s*NO", line, re.IGNORECASE) and i + 1 < len(lines):
            parts = lines[i + 1].split()
            drawing_number = parts[0].upper() if parts else None
            revision = parts[1].upper() if len(parts) > 1 else None
            return drawing_number, revision
    return None, None


def _ocr_once(image: Image.Image) -> dict:
    raw_text = pytesseract.image_to_string(image, config=_OCR_CONFIG)
    drawing_number, revision = _parse(raw_text)
    return {"raw_text": raw_text.strip(), "drawing_number": drawing_number, "revision": revision}


# Real phone photos are rarely dead-level. A small-angle retry sweep is a
# standard, cheap way to recover skewed shots without a full deskew algorithm.
# IMPORTANT: a misread (OCR confidently returning the wrong string, e.g. an
# em-dash glyph read as "£") is not the same as no read — early testing here
# returned on the first *non-empty* result and that made the retry sweep a
# no-op, since angle 0 on a skewed image still "reads something." The sweep
# only earns its keep if the caller validates each candidate against a real
# drawing number (see resolve_by_title_block) rather than just checking
# truthiness.
_RETRY_ANGLES = [0, -3, 3, -6, 6, -10, 10, -14, 14]


def extract_fields(image_path: Path) -> dict:
    """Single-pass OCR at the image's given orientation. For a real photo
    that might be skewed, prefer extract_candidates + DB validation."""
    return _ocr_once(Image.open(image_path))


def extract_candidates(image_path: Path) -> list[dict]:
    """OCR at 0° plus a small-angle retry sweep. Returns every candidate
    reading — the caller (resolve_by_title_block) picks whichever one
    actually matches a real drawing, since a non-empty OCR read isn't
    evidence it's a *correct* one."""
    image = Image.open(image_path)
    return [
        _ocr_once(image.rotate(angle, expand=True, fillcolor="white") if angle else image)
        for angle in _RETRY_ANGLES
    ]


def resolve_by_title_block(db: Session, image_path: Path) -> tuple[models.Drawing | None, dict]:
    """Runs real OCR against the image at image_path and looks up the
    drawing it actually read — not the drawing the caller claims it is.
    Tries the rotation-retry sweep and keeps the first candidate whose
    drawing_number matches a real row, not just the first non-empty read."""
    if not image_path.exists():
        return None, {"raw_text": "", "drawing_number": None, "revision": None, "error": "image not found"}

    candidates = extract_candidates(image_path)
    for fields in candidates:
        if not fields["drawing_number"]:
            continue
        drawing = db.execute(
            select(models.Drawing).where(models.Drawing.drawing_number == fields["drawing_number"])
        ).scalars().first()
        if drawing:
            return drawing, fields

    # nothing matched a real drawing — return the first read for diagnostics
    return None, candidates[0]
