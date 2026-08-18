"""Drawing ingestion (architecture §3, steps 1 & 3): turn a real CAD export into
the same {viewBox, shapes} layout the rest of the app already renders, and
auto-suggest candidate regions by spatially clustering the drawing's own
geometry — a real deterministic heuristic, not an AI call. The engineer
confirms/renames/adjusts the suggestions once before the drawing is matchable
against technician SMS (§3.5's confidence floor).
"""
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import ezdxf
import pymupdf as fitz

from . import blueprint_kit as bp

PAD = 40
W, H = bp.SHEET_W, bp.SHEET_H
MAX_CLUSTER_ENTITIES = 1500
MAX_REGIONS = 10

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class UnsupportedFormat(Exception):
    pass


@dataclass
class RegionSuggestion:
    px: tuple[float, float, float, float]  # x, y, w, h in layout px space
    weight: int


@dataclass
class ParsedDrawing:
    layout: dict
    regions: list[RegionSuggestion] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _fit_transform(xmin, ymin, xmax, ymax, flip_y: bool):
    src_w = max(xmax - xmin, 1e-6)
    src_h = max(ymax - ymin, 1e-6)
    scale = min((W - 2 * PAD) / src_w, (H - 2 * PAD) / src_h)
    off_x = PAD + (W - 2 * PAD - src_w * scale) / 2
    off_y = PAD + (H - 2 * PAD - src_h * scale) / 2

    def transform(x, y):
        sx = off_x + (x - xmin) * scale
        sy = off_y + ((ymax - y) if flip_y else (y - ymin)) * scale
        return sx, sy

    return transform, scale


def _boxes_intersect(a, b) -> bool:
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def _cluster(bboxes: list[tuple[float, float, float, float]], margin: float) -> list[RegionSuggestion]:
    n = len(bboxes)
    if n == 0:
        return []
    if n > MAX_CLUSTER_ENTITIES:
        bboxes = bboxes[:MAX_CLUSTER_ENTITIES]
        n = len(bboxes)

    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    expanded = [(x0 - margin, y0 - margin, x1 + margin, y1 + margin) for x0, y0, x1, y1 in bboxes]
    for i in range(n):
        for j in range(i + 1, n):
            if _boxes_intersect(expanded[i], expanded[j]):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    clusters = []
    for idxs in groups.values():
        xs0 = [bboxes[i][0] for i in idxs]
        ys0 = [bboxes[i][1] for i in idxs]
        xs1 = [bboxes[i][2] for i in idxs]
        ys1 = [bboxes[i][3] for i in idxs]
        clusters.append((min(xs0), min(ys0), max(xs1), max(ys1), len(idxs)))

    # prefer clusters with more than one entity (real groupings, not stray marks);
    # fall back to singletons only if the drawing is too sparse otherwise
    substantial = [c for c in clusters if c[4] >= 2]
    pool = substantial if len(substantial) >= 3 else clusters
    pool.sort(key=lambda c: (c[2] - c[0]) * (c[3] - c[1]) * c[4], reverse=True)
    top = pool[:MAX_REGIONS]

    return [RegionSuggestion((x0, y0, x1 - x0, y1 - y0), weight) for x0, y0, x1, y1, weight in top]


# --------------------------------------------------------------------------- DXF
def parse_dxf(data: bytes) -> ParsedDrawing:
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        doc = ezdxf.readfile(tmp_path)
    except ezdxf.DXFStructureError as e:
        raise UnsupportedFormat(f"Could not parse this DXF file: {e}") from e
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    msp = doc.modelspace()

    raw_entities: list[tuple[str, dict]] = []
    warnings: list[str] = []

    def walk(entities, depth=0):
        if depth > 3:
            return
        for e in entities:
            kind = e.dxftype()
            try:
                if kind == "LINE":
                    s, en = e.dxf.start, e.dxf.end
                    raw_entities.append(("line", {"x1": s.x, "y1": s.y, "x2": en.x, "y2": en.y}))
                elif kind in ("LWPOLYLINE", "POLYLINE"):
                    pts = [(p[0], p[1]) for p in (e.get_points("xy") if kind == "LWPOLYLINE" else
                                                    [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices])]
                    if len(pts) >= 2:
                        raw_entities.append(("polyline", {"pts": pts, "closed": bool(getattr(e, "closed", False))}))
                elif kind == "CIRCLE":
                    c = e.dxf.center
                    raw_entities.append(("circle", {"cx": c.x, "cy": c.y, "r": e.dxf.radius}))
                elif kind == "ARC":
                    c = e.dxf.center
                    raw_entities.append(("arc", {
                        "cx": c.x, "cy": c.y, "r": e.dxf.radius,
                        "start": e.dxf.start_angle, "end": e.dxf.end_angle,
                    }))
                elif kind in ("TEXT", "MTEXT"):
                    ins = e.dxf.insert
                    text = e.plain_text() if kind == "MTEXT" else e.dxf.text
                    height = getattr(e.dxf, "height", getattr(e.dxf, "char_height", 2.5))
                    if text and text.strip():
                        raw_entities.append(("text", {"x": ins.x, "y": ins.y, "text": text.strip(), "height": height}))
                elif kind == "INSERT":
                    walk(e.virtual_entities(), depth + 1)
            except Exception:
                continue

    try:
        walk(msp)
    except Exception as e:
        raise UnsupportedFormat(f"Could not read entities from this DXF file: {e}") from e

    if not raw_entities:
        raise UnsupportedFormat("This DXF file has no recognizable geometry (lines, polylines, circles, arcs, text).")

    xs, ys = [], []
    for kind, d in raw_entities:
        if kind == "line":
            xs += [d["x1"], d["x2"]]; ys += [d["y1"], d["y2"]]
        elif kind == "polyline":
            xs += [p[0] for p in d["pts"]]; ys += [p[1] for p in d["pts"]]
        elif kind in ("circle", "arc"):
            xs += [d["cx"] - d["r"], d["cx"] + d["r"]]; ys += [d["cy"] - d["r"], d["cy"] + d["r"]]
        elif kind == "text":
            xs.append(d["x"]); ys.append(d["y"])

    xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    transform, scale = _fit_transform(xmin, ymin, xmax, ymax, flip_y=True)

    shapes = list(bp.sheet_frame(W, H))
    cluster_boxes: list[tuple[float, float, float, float]] = []

    for kind, d in raw_entities:
        if kind == "line":
            x1, y1 = transform(d["x1"], d["y1"])
            x2, y2 = transform(d["x2"], d["y2"])
            shapes.append(bp.line(x1, y1, x2, y2, "outline"))
            cluster_boxes.append((min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)))
        elif kind == "polyline":
            pts = [transform(x, y) for x, y in d["pts"]]
            if d["closed"] and pts[0] != pts[-1]:
                pts = pts + [pts[0]]
            shapes.append(bp.polyline(" ".join(f"{x:.1f},{y:.1f}" for x, y in pts), "outline"))
            pxs = [p[0] for p in pts]; pys = [p[1] for p in pts]
            cluster_boxes.append((min(pxs), min(pys), max(pxs), max(pys)))
        elif kind == "circle":
            cx, cy = transform(d["cx"], d["cy"])
            r = d["r"] * scale
            shapes.append(bp.circle(cx, cy, r, "outline"))
            cluster_boxes.append((cx - r, cy - r, cx + r, cy + r))
        elif kind == "arc":
            cx, cy = d["cx"], d["cy"]
            r = d["r"]
            import math
            a0, a1 = math.radians(d["start"]), math.radians(d["end"])
            sx, sy = transform(cx + r * math.cos(a0), cy + r * math.sin(a0))
            ex, ey = transform(cx + r * math.cos(a1), cy + r * math.sin(a1))
            span = (d["end"] - d["start"]) % 360
            large_arc = 1 if span > 180 else 0
            rr = r * scale
            shapes.append(bp.path(f"M {sx:.1f} {sy:.1f} A {rr:.1f} {rr:.1f} 0 {large_arc} 1 {ex:.1f} {ey:.1f}", "outline"))
            tcx, tcy = transform(cx, cy)
            cluster_boxes.append((tcx - rr, tcy - rr, tcx + rr, tcy + rr))
        elif kind == "text":
            x, y = transform(d["x"], d["y"])
            size = max(7, min(15, d["height"] * scale * 1.4))
            shapes.append(bp.text(x, y, d["text"][:60], "label", size, "start"))

    margin = 0.015 * max(W, H)
    regions = _cluster(cluster_boxes, margin)

    if len(raw_entities) > MAX_CLUSTER_ENTITIES:
        warnings.append(
            f"Drawing has {len(raw_entities)} entities — region suggestions are based on the first "
            f"{MAX_CLUSTER_ENTITIES}; add any missed ones manually."
        )

    return ParsedDrawing(layout={"viewBox": [0, 0, W, H], "shapes": shapes}, regions=regions, warnings=warnings)


# --------------------------------------------------------------------------- PDF
def parse_pdf(data: bytes) -> ParsedDrawing:
    UPLOADS_DIR.mkdir(exist_ok=True)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise UnsupportedFormat(f"Could not open this PDF: {e}") from e
    if doc.page_count == 0:
        raise UnsupportedFormat("This PDF has no pages.")
    page = doc[0]

    page_w, page_h = page.rect.width, page.rect.height
    transform, scale = _fit_transform(0, 0, page_w, page_h, flip_y=False)
    img_x0, img_y0 = transform(0, 0)
    img_x1, img_y1 = transform(page_w, page_h)

    zoom = min(3.0, 1600 / max(page_w, 1))
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    filename = f"{uuid.uuid4().hex}.png"
    pix.save(UPLOADS_DIR / filename)

    shapes = [{
        "type": "image", "class": "raster",
        "x": img_x0, "y": img_y0, "w": img_x1 - img_x0, "h": img_y1 - img_y0,
        "href": f"/uploads/{filename}",
    }]
    shapes += bp.sheet_frame(W, H)

    cluster_boxes: list[tuple[float, float, float, float]] = []
    warnings: list[str] = []
    try:
        vector_paths = page.get_drawings()
    except Exception:
        vector_paths = []

    for item in vector_paths:
        rect = item.get("rect")
        if rect is None or rect.is_empty or rect.width < 1 or rect.height < 1:
            continue
        x0, y0 = transform(rect.x0, rect.y0)
        x1, y1 = transform(rect.x1, rect.y1)
        cluster_boxes.append((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))

    if not cluster_boxes:
        warnings.append(
            "No vector content found (likely a scanned page) — draw regions manually below."
        )

    margin = 0.015 * max(W, H)
    regions = _cluster(cluster_boxes, margin) if cluster_boxes else []

    return ParsedDrawing(
        layout={"viewBox": [0, 0, W, H], "shapes": shapes}, regions=regions, warnings=warnings,
    )


def parse_upload(filename: str, data: bytes) -> ParsedDrawing:
    ext = Path(filename).suffix.lower()
    if ext == ".dxf":
        return parse_dxf(data)
    if ext == ".pdf":
        return parse_pdf(data)
    if ext == ".dwg":
        raise UnsupportedFormat(
            "DWG is Autodesk's proprietary binary format and can't be parsed without their SDK. "
            "Export as DXF instead — every major CAD package (AutoCAD, SolidWorks, Inventor, Fusion 360, "
            "Revit) supports File → Save/Export As → DXF."
        )
    raise UnsupportedFormat(f"Unsupported file type '{ext}'. Upload a .dxf or .pdf.")
