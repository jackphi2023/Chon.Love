from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFile, ImageFilter, ImageFont

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / 'apps/mobile/assets/luxy'
W, H = 768, 528
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
TRANSPARENT = (0, 0, 0, 0)


def gradient(top: tuple[int, int, int, int], bottom: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new('RGBA', (W, H), TRANSPARENT)
    pixels = image.load()
    for y in range(H):
        t = y / max(1, H - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        for x in range(W):
            pixels[x, y] = color
    return image


def rounded_mask(box: tuple[int, int, int, int], radius: int) -> Image.Image:
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    return mask


def polygon_mask(points: list[tuple[float, float]]) -> Image.Image:
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points = []
    for i in range(8):
        angle = -math.pi / 2 + i * math.pi / 4
        radius = outer if i % 2 == 0 else inner
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def leaf_points(cx: float, cy: float, length: float, width: float, angle: float) -> list[tuple[float, float]]:
    local = [
        (0, -length / 2),
        (width / 2, -length * 0.12),
        (width * 0.38, length * 0.18),
        (0, length / 2),
        (-width * 0.38, length * 0.18),
        (-width / 2, -length * 0.12),
    ]
    cosine, sine = math.cos(angle), math.sin(angle)
    return [(cx + x * cosine - y * sine, cy + x * sine + y * cosine) for x, y in local]


def add_banner(base: Image.Image, main_text: str, y: int = 315) -> None:
    shadow = Image.new('RGBA', base.size, TRANSPARENT)
    ImageDraw.Draw(shadow).rounded_rectangle((102, y, W - 102, y + 166), radius=45, fill=(0, 0, 0, 155))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 10))

    draw = ImageDraw.Draw(base)
    left = [(46, y + 58), (143, y + 33), (159, y + 151), (43, y + 164), (79, y + 111)]
    right = [(W - x, yy) for x, yy in left]
    for points in (left, right):
        draw.polygon(points, fill=(14, 49, 111, 255), outline=(246, 185, 42, 255))

    outer = rounded_mask((102, y, W - 102, y + 166), 43)
    base.alpha_composite(Image.composite(gradient((255, 231, 105, 255), (166, 91, 5, 255)), Image.new('RGBA', base.size, TRANSPARENT), outer))

    inner = rounded_mask((116, y + 10, W - 116, y + 153), 34)
    base.alpha_composite(Image.composite(gradient((24, 80, 165, 255), (6, 28, 72, 255)), Image.new('RGBA', base.size, TRANSPARENT), inner))

    gloss = Image.new('RGBA', base.size, TRANSPARENT)
    ImageDraw.Draw(gloss).rounded_rectangle((127, y + 19, W - 127, y + 68), radius=24, fill=(255, 255, 255, 18))
    base.alpha_composite(gloss)

    draw = ImageDraw.Draw(base)
    title = 'THÀNH VIÊN'
    title_font = ImageFont.truetype(FONT, 33)
    main_font = ImageFont.truetype(FONT, 68 if len(main_text) <= 8 else 58)
    title_box = draw.textbbox((0, 0), title, font=title_font, stroke_width=1)
    title_width = title_box[2] - title_box[0]
    title_x = (W - title_width) // 2
    draw.line((144, y + 48, title_x - 16, y + 48), fill=(247, 187, 41, 245), width=4)
    draw.line((title_x + title_width + 16, y + 48, W - 144, y + 48), fill=(247, 187, 41, 245), width=4)
    draw.text((title_x, y + 25), title, font=title_font, fill=(250, 247, 235, 255), stroke_width=1, stroke_fill=(80, 48, 8, 210))

    main_box = draw.textbbox((0, 0), main_text, font=main_font, stroke_width=2)
    main_width = main_box[2] - main_box[0]
    main_x = (W - main_width) // 2
    draw.text((main_x + 3, y + 75), main_text, font=main_font, fill=(54, 30, 0, 180), stroke_width=2, stroke_fill=(54, 30, 0, 150))
    draw.text((main_x, y + 71), main_text, font=main_font, fill=(255, 213, 73, 255), stroke_width=2, stroke_fill=(113, 61, 0, 255))

    center_y = y + 163
    jewel = [(W / 2, center_y), (W / 2 + 22, center_y + 19), (W / 2, center_y + 43), (W / 2 - 22, center_y + 19)]
    draw.polygon(jewel, fill=(44, 163, 251, 255), outline=(244, 188, 42, 255))
    draw.line((W / 2, center_y, W / 2, center_y + 43), fill=(225, 250, 255, 170), width=2)
    draw.line((W / 2 - 22, center_y + 19, W / 2 + 22, center_y + 19), fill=(225, 250, 255, 170), width=2)
    draw.polygon(star_points(W - 129, y + 18, 13, 3), fill=(255, 255, 255, 230))
    draw.polygon(star_points(132, y + 138, 9, 2), fill=(255, 230, 150, 210))


def add_faceted_diamond(base: Image.Image) -> None:
    cx, top_y, width, height = W // 2, 112, 382, 226
    points = [
        (cx, top_y),
        (cx + width * 0.47, top_y + height * 0.28),
        (cx + width * 0.34, top_y + height * 0.75),
        (cx, top_y + height),
        (cx - width * 0.34, top_y + height * 0.75),
        (cx - width * 0.47, top_y + height * 0.28),
    ]
    mask = polygon_mask(points)
    glow = mask.filter(ImageFilter.GaussianBlur(22))
    base.alpha_composite(Image.composite(Image.new('RGBA', base.size, (106, 200, 255, 80)), Image.new('RGBA', base.size, TRANSPARENT), glow))
    base.alpha_composite(Image.composite(gradient((248, 253, 255, 255), (73, 151, 232, 255)), Image.new('RGBA', base.size, TRANSPARENT), mask))

    draw = ImageDraw.Draw(base)
    draw.line(points + [points[0]], fill=(224, 245, 255, 255), width=4)
    center = (cx, top_y + height * 0.32)
    for point in points:
        draw.line((point, center), fill=(255, 255, 255, 130), width=3)
    draw.polygon([points[0], points[1], center], fill=(210, 238, 255, 150))
    draw.polygon([points[5], points[0], center], fill=(240, 250, 255, 155))
    draw.polygon([points[5], center, points[4]], fill=(74, 163, 239, 120))
    draw.polygon([points[1], points[2], center], fill=(113, 201, 252, 110))
    draw.polygon([center, points[3], points[4]], fill=(82, 163, 234, 90))
    draw.polygon([center, points[2], points[3]], fill=(177, 225, 255, 90))


def build_premium() -> Image.Image:
    base = Image.new('RGBA', (W, H), TRANSPARENT)
    source = Image.open(ASSET_DIR / 'premium-badge-hq.png').convert('RGBA')
    valid_top = source.crop((0, 0, source.width, 132)).resize((W, round(132 * W / source.width)), Image.Resampling.LANCZOS)
    glow = valid_top.getchannel('A').filter(ImageFilter.GaussianBlur(16))
    glow_mask = Image.new('L', base.size, 0)
    glow_mask.paste(glow, (0, 0))
    base.alpha_composite(Image.composite(Image.new('RGBA', base.size, (245, 179, 30, 65)), Image.new('RGBA', base.size, TRANSPARENT), glow_mask))
    base.alpha_composite(valid_top)
    ImageDraw.Draw(base).polygon([(W // 2 - 50, 270), (W // 2 + 50, 270), (W // 2, 335)], fill=(24, 72, 151, 255), outline=(236, 174, 33, 255))
    add_banner(base, 'CAO CẤP')
    return base


def build_diamond() -> Image.Image:
    base = Image.new('RGBA', (W, H), TRANSPARENT)
    source = Image.open(ASSET_DIR / 'diamond-badge-hq.png').convert('RGBA')
    valid_top = source.crop((0, 0, W, 160))
    add_faceted_diamond(base)
    draw = ImageDraw.Draw(base)
    for side in (-1, 1):
        for center_y, distance, angle in [(185, 225, 0.55), (220, 255, 0.70), (256, 279, 0.82), (292, 300, 0.95)]:
            center_x = W // 2 + side * distance
            points = leaf_points(center_x, center_y, 68, 34, side * angle)
            draw.polygon(points, fill=(226, 159, 27, 245), outline=(255, 226, 121, 250))
            draw.line((points[0], points[3]), fill=(255, 229, 130, 190), width=2)
    base.alpha_composite(valid_top)
    ImageDraw.Draw(base).polygon(star_points(W // 2 + 145, 160, 12, 3), fill=(255, 255, 255, 235))
    add_banner(base, 'KIM CƯƠNG')
    return base


for filename, image in [
    ('premium-badge-hq.png', build_premium()),
    ('diamond-badge-hq.png', build_diamond()),
]:
    image.save(ASSET_DIR / filename, optimize=True)
    with Image.open(ASSET_DIR / filename) as check:
        check.verify()
    print(f'wrote valid {filename}: {W}x{H}')
