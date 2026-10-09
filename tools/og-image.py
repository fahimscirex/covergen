# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "cairosvg"]
# ///
"""Draw assets/og-cover.png, the 1200x630 card every shared link previews with.

Kept as a script rather than a one-off so the card can be redrawn when the
sample cover changes. Everything on the mock sheet is sample data: never put a
real student ID here, it is served publicly on every share preview.

    uv run tools/og-image.py
"""

import io
import pathlib

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, H = 1200, 630
BG, INK, MUTED, ACCENT, PAPER = "#141312", "#f8f8f4", "#93938b", "#93b0ff", "#ffffff"

# Sample only. Not anyone's real ID.
SAMPLE_NAME = "Md Fahim Montasir"
SAMPLE_ID = "23115012778"

DEJAVU = (
    "/usr/share/fonts/TTF/DejaVuSans{}.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf",
)


def ui(size, bold=False):
    for pattern in DEJAVU:
        try:
            return ImageFont.truetype(pattern.format("-Bold" if bold else ""), size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    bitrimus = ImageFont.truetype(str(ROOT / "assets/fonts/Bitrimus.ttf"), 62)

    # The mock A4 sheet, at the real 1:1.414 proportion.
    sh = 470
    sw = int(sh / 1.4142)
    sx, sy = W - sw - 70, (H - sh) // 2
    d.rectangle([sx + 7, sy + 9, sx + sw + 7, sy + sh + 9], fill="#0d0c0b")
    d.rectangle([sx, sy, sx + sw, sy + sh], fill=PAPER)
    cx = sx + sw // 2

    def mid(y, text, font, fill):
        d.text((cx - d.textbbox((0, 0), text, font=font)[2] // 2, y), text, font=font, fill=fill)

    mid(sy + 48, "BANGLADESH UNIVERSITY", ui(13, True), "#111")
    mid(sy + 66, "OF PROFESSIONALS", ui(13, True), "#111")

    crest = Image.open(io.BytesIO(cairosvg.svg2png(
        url=str(ROOT / "assets/bup_logo.svg"), output_height=54))).convert("RGBA")
    img.paste(crest, (cx - crest.width // 2, sy + 94), crest)

    mid(sy + 186, "Assignment on", ui(11), "#444")
    mid(sy + 208, "Key Concepts of Auditing", ui(15, True), "#111")
    mid(sy + 234, "Taxation and Auditing (MKT-3104)", ui(11, True), "#222")
    mid(sy + 288, "Submitted To:", ui(10, True), "#111")
    mid(sy + 306, "Asst. Prof. Anamika Dey", ui(10), "#333")
    mid(sy + 322, "Department of Marketing", ui(9), "#555")
    mid(sy + 362, "Submitted By:", ui(10, True), "#111")

    split = int((sw - 80) * 0.58)
    d.rectangle([sx + 40, sy + 380, sx + sw - 40, sy + 404], outline="#333", width=1)
    d.line([(sx + 40 + split, sy + 380), (sx + 40 + split, sy + 404)], fill="#333", width=1)
    d.text((sx + 50, sy + 387), SAMPLE_NAME, font=ui(9, True), fill="#111")
    d.text((sx + 46 + split, sy + 387), SAMPLE_ID, font=ui(9, True), fill="#111")
    for i, line in enumerate(["Section: A", "Session: 2022-2023", "Department of Marketing"]):
        mid(sy + 416 + i * 15, line, ui(9), "#444")

    d.text((70, 120), "covergen", font=bitrimus, fill=INK)
    d.text((70, 215), "Assignment cover pages", font=ui(42, True), fill=INK)
    d.text((70, 268), "for Bangladeshi students", font=ui(42, True), fill=ACCENT)
    d.text((70, 345), "24 universities with real teacher lists.", font=ui(21), fill=MUTED)
    d.text((70, 378), "Live A4 preview. Free vector PDF.", font=ui(21), fill=MUTED)
    for i, tag in enumerate(["DU", "BUET", "NSU", "BRACU", "BUP", "+19"]):
        x = 70 + i * 74
        d.rounded_rectangle([x, 440, x + 64, 472], 7, fill="#232320")
        w = d.textbbox((0, 0), tag, font=ui(14, True))[2]
        d.text((x + 32 - w // 2, 449), tag, font=ui(14, True), fill=MUTED)
    d.text((70, 512), "covergen.scirex.me", font=ui(18), fill=ACCENT)

    out = ROOT / "assets/og-cover.png"
    img.save(out, optimize=True)
    print(f"wrote {out.relative_to(ROOT)} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
