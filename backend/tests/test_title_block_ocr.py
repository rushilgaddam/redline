"""Accuracy test for the title-block OCR resolver — the one piece of this
prototype's "AI" that's genuinely real (see MOCKS.md). This isn't a smoke
test; it's measuring resolution accuracy against realistic phone-photo
degradation (skew, blur, low light, low resolution, JPEG artifacts) so the
retry-sweep behavior has actual numbers behind it instead of an assumption.

Run with: ./venv/bin/pytest tests/test_title_block_ocr.py -v
"""
import io
import tempfile
from pathlib import Path

import pytest
from PIL import Image, ImageEnhance, ImageFilter

from app import models
from app.database import SessionLocal, engine
from app.seed import seed
from app.services import title_block_ocr


@pytest.fixture(scope="module")
def db():
    models.Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed(session)
    yield session
    session.close()


@pytest.fixture(scope="module")
def real_title_block_image(db):
    """The actual generated title block for the seeded E-1042 drawing —
    exactly what gets rendered and OCR'd in the running app, not a
    synthetic stand-in."""
    drawing = db.query(models.Drawing).filter_by(drawing_number="E-1042").first()
    author = db.get(models.User, drawing.primary_author_id)
    return title_block_ocr.generate_title_block_image(drawing, author.name)


def _resolve(db, image: Image.Image) -> tuple[models.Drawing | None, dict]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "variant.png"
        image.convert("RGB").save(path)
        return title_block_ocr.resolve_by_title_block(db, path)


def test_clean_render_resolves_correctly(db, real_title_block_image):
    drawing, fields = _resolve(db, real_title_block_image)
    assert drawing is not None
    assert drawing.drawing_number == "E-1042"
    assert fields["revision"] == "C"


@pytest.mark.parametrize("angle", [3, -3, 6, -6, 10, -10])
def test_realistic_skew_resolves_via_retry_sweep(db, real_title_block_image, angle):
    """A phone photo is rarely dead-level. This is the exact bug that shipped
    once already — the retry sweep existed but returned on the first
    non-empty (not first correct) OCR read, so it was a no-op. Regression
    guard for that."""
    rotated = real_title_block_image.rotate(angle, expand=True, fillcolor="white")
    drawing, _ = _resolve(db, rotated)
    assert drawing is not None and drawing.drawing_number == "E-1042", f"failed at {angle} deg"


def test_extreme_skew_beyond_retry_range_fails_safely(db, real_title_block_image):
    """Known limitation, not a crash: beyond the retry sweep's range, this
    should degrade to 'no match' (caller falls back to asking), never a
    wrong drawing."""
    rotated = real_title_block_image.rotate(35, expand=True, fillcolor="white")
    drawing, _ = _resolve(db, rotated)
    assert drawing is None


def test_mild_blur_resolves(db, real_title_block_image):
    blurred = real_title_block_image.filter(ImageFilter.GaussianBlur(1.2))
    drawing, _ = _resolve(db, blurred)
    assert drawing is not None and drawing.drawing_number == "E-1042"


def test_heavy_blur_fails_safely_not_wrong(db, real_title_block_image):
    """Known limitation: heavy blur currently fails to resolve at all. The
    important property is it returns None, not a misresolved drawing."""
    blurred = real_title_block_image.filter(ImageFilter.GaussianBlur(3))
    drawing, _ = _resolve(db, blurred)
    assert drawing is None


def test_low_contrast_resolves(db, real_title_block_image):
    dim = ImageEnhance.Contrast(real_title_block_image).enhance(0.4)
    drawing, _ = _resolve(db, dim)
    assert drawing is not None and drawing.drawing_number == "E-1042"


def test_dim_lighting_resolves(db, real_title_block_image):
    dim = ImageEnhance.Brightness(real_title_block_image).enhance(0.5)
    drawing, _ = _resolve(db, dim)
    assert drawing is not None and drawing.drawing_number == "E-1042"


def test_jpeg_compression_resolves(db, real_title_block_image):
    buf = io.BytesIO()
    real_title_block_image.convert("RGB").save(buf, format="JPEG", quality=25)
    buf.seek(0)
    drawing, _ = _resolve(db, Image.open(buf))
    assert drawing is not None and drawing.drawing_number == "E-1042"


def test_low_resolution_photo_fails_safely(db, real_title_block_image):
    """Known limitation: a photo taken from far away (downsampled detail)
    currently fails to resolve. Documented, not silently wrong."""
    small = real_title_block_image.resize(
        (real_title_block_image.width // 3, real_title_block_image.height // 3)
    ).resize(real_title_block_image.size)
    drawing, _ = _resolve(db, small)
    assert drawing is None


def test_never_resolves_to_the_wrong_drawing(db, real_title_block_image):
    """The one property that actually matters most: across every distortion
    tried, a bad read must never silently resolve to a *different* real
    drawing. Fail closed (None), not fail wrong."""
    variants = [
        real_title_block_image.rotate(20, expand=True, fillcolor="white"),
        real_title_block_image.filter(ImageFilter.GaussianBlur(4)),
        real_title_block_image.resize((80, 22)).resize(real_title_block_image.size),
    ]
    for variant in variants:
        drawing, _ = _resolve(db, variant)
        assert drawing is None or drawing.drawing_number == "E-1042"
