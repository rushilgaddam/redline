"""Tiny helper library for building the structured shape lists that seed.py
feeds into Drawing.layout. Shapes are semantic (class=outline/detail/wire/dim/
centerline/hatch/label/tag) rather than styled directly — the frontend CAD
viewer owns the actual palette/line-weight so every drawing renders as one
consistent visual system.
"""
import math

SHEET_W = 1000
SHEET_H = 680


def rect(x, y, w, h, cls="detail", rx=0):
    return {"type": "rect", "x": x, "y": y, "w": w, "h": h, "rx": rx, "class": cls}


def line(x1, y1, x2, y2, cls="detail"):
    return {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "class": cls}


def circle(cx, cy, r, cls="detail"):
    return {"type": "circle", "cx": cx, "cy": cy, "r": r, "class": cls}


def path(d, cls="detail"):
    return {"type": "path", "d": d, "class": cls}


def text(x, y, s, cls="label", size=11, anchor="middle"):
    return {"type": "text", "x": x, "y": y, "text": s, "class": cls, "size": size, "anchor": anchor}


def polyline(points, cls="detail"):
    return {"type": "polyline", "points": points, "class": cls}


def dim_h(x1, x2, y, label, tick=7):
    return [
        line(x1, y - tick, x1, y + tick, "dim"),
        line(x2, y - tick, x2, y + tick, "dim"),
        {"type": "line", "x1": x1, "y1": y, "x2": x2, "y2": y, "class": "dim", "arrows": True},
        text((x1 + x2) / 2, y - 9, label, "dim-label", 9.5),
    ]


def dim_v(y1, y2, x, label, tick=7):
    return [
        line(x - tick, y1, x + tick, y1, "dim"),
        line(x - tick, y2, x + tick, y2, "dim"),
        {"type": "line", "x1": x, "y1": y1, "x2": x, "y2": y2, "class": "dim", "arrows": True},
        {"type": "text", "x": x + 12, "y": (y1 + y2) / 2, "text": label, "class": "dim-label",
         "size": 9.5, "anchor": "start", "rot": -90, "rotX": x + 12, "rotY": (y1 + y2) / 2},
    ]


def centerline_h(x1, x2, y):
    return line(x1, y, x2, y, "centerline")


def centerline_v(y1, y2, x):
    return line(x, y1, x, y2, "centerline")


def hatch(x, y, w, h, cls="hatch", step=9):
    shapes = [rect(x, y, w, h, "detail")]
    n = int((w + h) / step)
    for i in range(-int(h / step), n):
        x1, y1 = x + i * step, y
        x2, y2 = x + i * step - h, y + h
        shapes.append(line(max(x, x1), y if x1 >= x else y + (x - x1), min(x + w, x2), y + h if x2 <= x + w else y + (x + w - x1), cls))
    return shapes


def ground_symbol(cx, cy, cls="hatch"):
    shapes = [line(cx, cy, cx, cy + 14, "detail")]
    widths = [22, 15, 8]
    for i, wdt in enumerate(widths):
        yy = cy + 14 + i * 6
        shapes.append(line(cx - wdt / 2, yy, cx + wdt / 2, yy, cls))
    return shapes


def terminal_strip(x, y, n, pitch=24, w=16, h=30, prefix="1"):
    shapes = [line(x - 6, y, x - 6 + (n - 1) * pitch + w + 12, y, "wire")]
    for i in range(n):
        bx = x + i * pitch
        shapes.append(rect(bx, y, w, h, "outline", 2))
        shapes.append(line(bx + w / 2, y, bx + w / 2, y - 6, "wire"))
        shapes.append(text(bx + w / 2, y + h + 13, str(int(prefix) + i) if prefix.isdigit() else f"{prefix}{i+1}", "tag", 8.5))
    return shapes


def bolt_pattern(cx, cy, r, n, bolt_r=4.5):
    shapes = [circle(cx, cy, r, "centerline")]
    for i in range(n):
        ang = (2 * math.pi / n) * i - math.pi / 2
        bx, by = cx + r * math.cos(ang), cy + r * math.sin(ang)
        shapes.append(circle(bx, by, bolt_r, "outline"))
    return shapes


def gdt_frame(x, y, symbol, tol, datum, cls="outline"):
    cw = [26, 34, 22]
    shapes = [rect(x, y, sum(cw), 22, cls)]
    cx = x
    for w in cw:
        shapes.append(line(cx, y, cx, y + 22, cls))
        cx += w
    shapes.append(line(cx, y, cx, y + 22, cls))
    shapes.append(text(x + cw[0] / 2, y + 15, symbol, "gdt-sym", 12))
    shapes.append(text(x + cw[0] + cw[1] / 2, y + 15, tol, "tag", 9.5))
    shapes.append(text(x + cw[0] + cw[1] + cw[2] / 2, y + 15, datum, "tag", 9.5))
    return shapes


def breaker_symbol(x, y, cls_body="outline"):
    shapes = [
        rect(x, y, 46, 70, cls_body, 2),
        circle(x + 23, y + 14, 3, "detail"),
        circle(x + 23, y + 56, 3, "detail"),
        line(x + 23, y + 17, x + 34, y + 40, "detail"),
        line(x + 23, y + 40, x + 23, y + 53, "detail"),
    ]
    return shapes


def contactor_symbol(x, y, label):
    shapes = [
        rect(x, y, 40, 56, "outline", 2),
        circle(x + 20, y + 14, 8, "detail"),
        line(x + 12, y + 34, x + 28, y + 34, "detail"),
        line(x + 12, y + 42, x + 28, y + 42, "detail"),
        text(x + 20, y + 70, label, "tag", 9),
    ]
    return shapes


def transformer_symbol(x, y):
    shapes = [
        circle(x, y, 16, "outline"),
        circle(x + 20, y, 16, "outline"),
        text(x + 10, y + 34, "T1", "tag", 9),
    ]
    return shapes


def motor_symbol(cx, cy, r):
    return [
        circle(cx, cy, r, "outline"),
        text(cx, cy + 5, "M", "gdt-sym", 20),
    ]


def sheet_frame(w, h, margin=15, cols=6, rows=4):
    shapes = [rect(margin, margin, w - 2 * margin, h - 2 * margin, "sheet")]
    inner = margin + 14
    shapes.append(rect(inner, inner, w - 2 * inner, h - 2 * inner, "sheet-inner"))
    col_w = (w - 2 * inner) / cols
    row_h = (h - 2 * inner) / rows
    for i in range(cols):
        cx = inner + col_w * (i + 0.5)
        shapes.append(text(cx, margin + 10, str(i + 1), "zone-label", 8))
        shapes.append(text(cx, h - margin - 4, str(i + 1), "zone-label", 8))
    for j in range(rows):
        cy = inner + row_h * (j + 0.5)
        letter = chr(ord("A") + j)
        shapes.append(text(margin + 9, cy + 3, letter, "zone-label", 8))
        shapes.append(text(w - margin - 9, cy + 3, letter, "zone-label", 8))
    return shapes
