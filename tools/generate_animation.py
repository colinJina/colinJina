#!/usr/bin/env python3
"""Generate a GitHub-profile contribution-block animation.

The animation is deterministic: GitHub-coloured blocks fall under gravity,
collide with the supplied display name, and collect along the bottom edge.
It intentionally simulates the contribution grid; it does not fetch activity.
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 800
HEIGHT = 400
BLOCK_SIZE = 10.0
FPS = 25
FRAME_COUNT = 232
SUBSTEPS = 4
BACKGROUND = "#fafafa"
TEXT_COLOR = "#111111"
CONTRIBUTION_COLORS = (
    "#ebedf0",
    "#9be9a8",
    "#40c463",
    "#30a14e",
    "#216e39",
)


@dataclass
class Block:
    x: float
    y: float
    vx: float
    vy: float
    angle: float
    angular_velocity: float
    color: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Colin", help="display name")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/colin-contribution.gif"),
        help="GIF output path",
    )
    parser.add_argument("--font", type=Path, help="optional TrueType/OpenType font")
    parser.add_argument("--seed", type=int, default=20260720)
    parser.add_argument(
        "--once",
        action="store_true",
        help="play once instead of looping forever",
    )
    return parser.parse_args()


def load_font(font_path: Path | None, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        font_path,
        Path("C:/Windows/Fonts/georgiab.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
        Path("/System/Library/Fonts/NewYork.ttf"),
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.truetype("DejaVuSerif-Bold.ttf", size=size)


def make_name_layer(name: str, font: ImageFont.FreeTypeFont) -> tuple[Image.Image, Image.Image]:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    bbox = draw.textbbox((0, 0), name, font=font)
    text_width = bbox[2] - bbox[0]
    x = (WIDTH - text_width) / 2 - bbox[0]
    y = 92 - bbox[1]
    draw.text((x, y), name, font=font, fill=255)

    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    layer.paste(TEXT_COLOR, (0, 0, WIDTH, HEIGHT), mask)
    return mask, layer


def make_blocks(rng: random.Random) -> list[Block]:
    blocks: list[Block] = []
    for week in range(52):
        for day in range(7):
            x = 40 + week * 14 + rng.uniform(-0.8, 0.8)
            y = -112 + day * 14 + rng.uniform(-0.8, 0.8)
            blocks.append(
                Block(
                    x=x,
                    y=y,
                    vx=rng.uniform(-7.0, 7.0),
                    vy=rng.uniform(-5.0, 4.0),
                    angle=rng.uniform(-0.16, 0.16),
                    angular_velocity=rng.uniform(-1.0, 1.0),
                    color=rng.choices(
                        CONTRIBUTION_COLORS,
                        weights=(14, 16, 24, 24, 22),
                        k=1,
                    )[0],
                )
            )
    return blocks


def overlaps_name(block: Block, mask: Image.Image) -> bool:
    half = BLOCK_SIZE * 0.48
    points = (
        (block.x - half, block.y - half),
        (block.x + half, block.y - half),
        (block.x - half, block.y + half),
        (block.x + half, block.y + half),
        (block.x, block.y),
        (block.x - half, block.y),
        (block.x + half, block.y),
        (block.x, block.y - half),
        (block.x, block.y + half),
    )
    pixels = mask.load()
    for px, py in points:
        ix, iy = int(px), int(py)
        if 0 <= ix < WIDTH and 0 <= iy < HEIGHT and pixels[ix, iy] > 48:
            return True
    return False


def resolve_world(block: Block, previous: tuple[float, float], name_mask: Image.Image) -> None:
    half = BLOCK_SIZE / 2
    restitution = 0.16
    friction = 0.88

    if block.x < half:
        block.x = half
        block.vx = abs(block.vx) * restitution
    elif block.x > WIDTH - half:
        block.x = WIDTH - half
        block.vx = -abs(block.vx) * restitution

    floor = HEIGHT - 10 - half
    if block.y > floor:
        block.y = floor
        block.vy = -abs(block.vy) * restitution
        block.vx *= friction
        block.angular_velocity *= 0.86

    if overlaps_name(block, name_mask):
        old_x, old_y = previous
        attempted_x, attempted_y = block.x, block.y

        block.y = old_y
        if not overlaps_name(block, name_mask):
            block.vy = -abs(block.vy) * 0.2
            block.vx += math.copysign(7.0, attempted_x - WIDTH / 2 or 1.0)
        else:
            block.y = attempted_y
            block.x = old_x
            if not overlaps_name(block, name_mask):
                block.vx = -block.vx * 0.24
            else:
                block.x, block.y = old_x, old_y
                block.vx *= -0.18
                block.vy = -abs(block.vy) * 0.18
        block.angular_velocity += block.vx * 0.025


def resolve_block_collisions(blocks: list[Block]) -> None:
    cell_size = 12
    buckets: dict[tuple[int, int], list[int]] = {}
    for index, block in enumerate(blocks):
        if block.y < -BLOCK_SIZE:
            continue
        key = (int(block.x // cell_size), int(block.y // cell_size))
        buckets.setdefault(key, []).append(index)

    visited: set[tuple[int, int]] = set()
    for key, indexes in buckets.items():
        neighbours: list[int] = []
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                neighbours.extend(buckets.get((key[0] + ox, key[1] + oy), ()))

        for i in indexes:
            a = blocks[i]
            for j in neighbours:
                if i == j:
                    continue
                pair = (min(i, j), max(i, j))
                if pair in visited:
                    continue
                visited.add(pair)
                b = blocks[j]
                dx, dy = b.x - a.x, b.y - a.y
                overlap_x = BLOCK_SIZE - abs(dx)
                overlap_y = BLOCK_SIZE - abs(dy)
                if overlap_x <= 0 or overlap_y <= 0:
                    continue

                if overlap_y < overlap_x:
                    direction = 1.0 if dy >= 0 else -1.0
                    correction = overlap_y * 0.5 + 0.01
                    a.y -= direction * correction
                    b.y += direction * correction
                    relative = b.vy - a.vy
                    impulse = relative * 0.46
                    a.vy += impulse
                    b.vy -= impulse
                    a.vx *= 0.992
                    b.vx *= 0.992
                else:
                    direction = 1.0 if dx >= 0 else -1.0
                    correction = overlap_x * 0.5 + 0.01
                    a.x -= direction * correction
                    b.x += direction * correction
                    relative = b.vx - a.vx
                    impulse = relative * 0.42
                    a.vx += impulse
                    b.vx -= impulse


def step(blocks: list[Block], name_mask: Image.Image, dt: float) -> None:
    gravity = 520.0
    for block in blocks:
        previous = (block.x, block.y)
        block.vy += gravity * dt
        block.vx *= 0.9994
        block.x += block.vx * dt
        block.y += block.vy * dt
        block.angle += block.angular_velocity * dt
        resolve_world(block, previous, name_mask)

    resolve_block_collisions(blocks)
    resolve_block_collisions(blocks)


def render(blocks: list[Block], name_layer: Image.Image) -> Image.Image:
    frame = Image.new("RGBA", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(frame)
    half = BLOCK_SIZE / 2

    for block in blocks:
        if block.y < -BLOCK_SIZE or block.y > HEIGHT + BLOCK_SIZE:
            continue
        cos_a, sin_a = math.cos(block.angle), math.sin(block.angle)
        corners = []
        for local_x, local_y in ((-half, -half), (half, -half), (half, half), (-half, half)):
            corners.append(
                (
                    block.x + local_x * cos_a - local_y * sin_a,
                    block.y + local_x * sin_a + local_y * cos_a,
                )
            )
        draw.polygon(corners, fill=block.color)

    # Keep the display name legible even while blocks are bouncing over it.
    frame.alpha_composite(name_layer)
    return frame.convert("RGB")


def make_palette() -> Image.Image:
    palette = []
    base_colors = [BACKGROUND, TEXT_COLOR, *CONTRIBUTION_COLORS]
    for color in base_colors:
        value = color.lstrip("#")
        palette.extend(int(value[i : i + 2], 16) for i in (0, 2, 4))
    for level in range(16, 248, 8):
        palette.extend((level, level, level))
    palette.extend([250, 250, 250] * (256 - len(palette) // 3))
    image = Image.new("P", (1, 1))
    image.putpalette(palette[: 256 * 3])
    return image


def generate(name: str, output: Path, font_path: Path | None, seed: int, loop: bool) -> None:
    rng = random.Random(seed)
    font = load_font(font_path, size=74)
    name_mask, name_layer = make_name_layer(name, font)
    blocks = make_blocks(rng)
    palette = make_palette()
    frames: list[Image.Image] = []
    dt = 1.0 / (FPS * SUBSTEPS)

    for frame_number in range(FRAME_COUNT):
        if frame_number < FRAME_COUNT - 28:
            for _ in range(SUBSTEPS):
                step(blocks, name_mask, dt)
        rendered = render(blocks, name_layer)
        frames.append(rendered.quantize(palette=palette, dither=Image.Dither.NONE))
        if frame_number % FPS == 0:
            print(f"rendered {frame_number:03d}/{FRAME_COUNT - 1}")

    output.parent.mkdir(parents=True, exist_ok=True)
    save_options = {
        "save_all": True,
        "append_images": frames[1:],
        "duration": round(1000 / FPS),
        "optimize": True,
        "disposal": 2,
    }
    if loop:
        save_options["loop"] = 0
    frames[0].save(output, **save_options)
    print(f"wrote {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    arguments = parse_args()
    generate(
        name=arguments.name,
        output=arguments.output,
        font_path=arguments.font,
        seed=arguments.seed,
        loop=not arguments.once,
    )
