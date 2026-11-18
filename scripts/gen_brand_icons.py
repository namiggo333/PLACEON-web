"""이곳저곳 브랜드 아이콘 생성 — PWA 아이콘(화이트 스쿼클 + 오렌지 지도핀 집)과 파비콘.

public/icons/*.png 는 홈 화면 추가용(iOS/Android가 자체 마스킹) 이라 흰색 풀블리드로 깔고,
파비콘용 src/app/icon.svg 는 흰 스쿼클 위에 핀을 올린 형태로 만든다.
"""
from __future__ import annotations

import io
import os

import cairosvg
from PIL import Image

ORANGE = "#FF6B00"
ORANGE_LIGHT = "#FF8A2B"
PEACH = "#FFE1CA"

OUT_DIR = "/workspace/placeon-web/public/icons"
APP_SVG_PATH = "/workspace/placeon-web/src/app/icon.svg"
ICO_PATH = "/workspace/placeon-web/public/favicon.ico"

# 64x64 좌표계의 로고 마크 (Logo.tsx 와 같은 형태)
MARK = f"""
  <ellipse cx="32" cy="60.4" rx="12.8" ry="2.7" fill="{PEACH}"/>
  <path d="M32 4.6C19.9 4.6 10.1 14.4 10.1 26.5c0 6.7 3.4 12.9 8.5 18.6 4.6 5.1 9.8 8.9 12.7 11.1.4.3 1 .3 1.4 0 2.9-2.2 8.1-6 12.7-11.1 5.1-5.7 8.5-11.9 8.5-18.6C53.9 14.4 44.1 4.6 32 4.6Z" fill="{ORANGE}" stroke="{ORANGE}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M32 19.6c.3 0 .6.12.83.35l10.2 9.4c.28.26.44.63.44 1.02v9.5c0 1.5-1.22 2.73-2.73 2.73H21.86a2.73 2.73 0 0 1-2.73-2.73v-9.5c0-.39.16-.76.44-1.02l10.2-9.4c.23-.23.53-.35.83-.35Z" fill="#FFFFFF"/>
  <path d="M27.3 43.6v-6.4a4.7 4.7 0 0 1 9.4 0v6.4h-9.4Z" fill="{ORANGE}"/>
  <path d="M51.8 14.4 56 10.2" stroke="{ORANGE_LIGHT}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M54.6 21.8 59.6 19.7" stroke="{ORANGE_LIGHT}" stroke-width="3.4" stroke-linecap="round"/>
"""

APP_ICON_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <g transform="translate(160 144) scale(11)">
    {MARK}
  </g>
</svg>
"""

FAVICON_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="1.2" y="1.2" width="61.6" height="61.6" rx="17" fill="#FFFFFF" stroke="#FFDCC4" stroke-width="2"/>
  <g transform="translate(4.6 3.4) scale(0.855)">
    {MARK}
  </g>
</svg>
"""

SIZES = {
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
}


def render(svg: str, size: int, bg: str | None = None) -> Image.Image:
    big = size * 4  # 슈퍼샘플링으로 곡선 계단현상 제거
    png = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=big, output_height=big)
    img = Image.open(io.BytesIO(png)).convert("RGBA").resize((size, size), Image.LANCZOS)
    if bg is None:
        flat = Image.new("RGB", (size, size), "#FFFFFF")
    else:
        flat = Image.new("RGB", (size, size), bg)
    flat.paste(img, (0, 0), img)
    return flat


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(APP_SVG_PATH, "w", encoding="utf-8") as fh:
        fh.write(FAVICON_SVG)

    for name, size in SIZES.items():
        path = os.path.join(OUT_DIR, name)
        render(APP_ICON_SVG, size).save(path, "PNG", optimize=True)
        print(f"{path}  {size}x{size}")

    # 파비콘: 흰 스쿼클 디자인을 16/32/48px 로 멀티 해상도 ICO
    frames = [render(FAVICON_SVG, s, bg="#FFFFFF") for s in (16, 32, 48)]
    frames[-1].save(ICO_PATH, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{ICO_PATH}  ico 16/32/48")


if __name__ == "__main__":
    main()
