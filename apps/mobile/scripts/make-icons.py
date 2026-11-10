"""Renders every app icon and the splash image from assets/logo.svg.

Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick). Run: yarn icons
"""
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SIZE = 1024
CENTER = SIZE // 2
# Android masks the foreground to a 66 dp circle of the 108 dp canvas; the viewfinder corners must stay inside.
ANDROID_SAFE_SCALE = 0.68
BACKGROUND = """<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#20262F" /><stop offset="1" stop-color="#0B0D10" /></linearGradient>"""
STROKE, DOT = "#E8EAED", "#FF5A5F"

def canvas(defs, body, background=False, scale=1.0, view_box=f"0 0 {SIZE} {SIZE}"):
    fill = f'<rect width="{SIZE}" height="{SIZE}" fill="url(#bg)" />' if background else ""
    group = f'<g transform="translate({CENTER} {CENTER}) scale({scale}) translate(-{CENTER} -{CENTER})">{body}</g>'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="{view_box}">'
        f"<defs>{defs}{BACKGROUND}</defs>{fill}{group}</svg>"
    )


def recolor(body, stroke, dot):
    return body.replace(STROKE, stroke).replace(DOT, dot)


def render(name, svg, opaque=False):
    with tempfile.NamedTemporaryFile("w", suffix=".svg") as source:
        source.write(svg)
        source.flush()
        target = ASSETS / name
        subprocess.run(["rsvg-convert", "-w", str(SIZE), "-h", str(SIZE), "-o", str(target), source.name], check=True)
    if opaque:
        # The App Store rejects an app icon with an alpha channel.
        subprocess.run(["magick", str(target), "-alpha", "off", str(target)], check=True)
    print(f"assets/{name}")


def main():
    logo = (ASSETS / "logo.svg").read_text()
    defs = re.search(r"<defs>(.*)</defs>", logo, re.S).group(1)
    glyph = re.search(r"</defs>(.*)</svg>", logo, re.S).group(1)
    flat_glyph = re.sub(r'<circle[^>]*url\(#glow\)[^>]*/>', "", glyph)
    render("icon.png", canvas(defs, glyph, background=True), opaque=True)
    render("ios-dark.png", canvas(defs, glyph))
    render("ios-tinted.png", canvas(defs, recolor(flat_glyph, "#FFFFFF", "#BFBFBF")))
    render("android-icon-foreground.png", canvas(defs, glyph, scale=ANDROID_SAFE_SCALE))
    render("android-icon-background.png", canvas(defs, "", background=True))
    render(
        "android-icon-monochrome.png",
        canvas(defs, recolor(flat_glyph, "#FFFFFF", "#FFFFFF"), scale=ANDROID_SAFE_SCALE),
    )
    render("splash-icon.png", canvas(defs, glyph, view_box="192 192 640 640"))


if __name__ == "__main__":
    main()
