"""
Собирает marketplace/header-image.jpg — картинку карточки плагина в каталоге.

Каталог требует пропорции 2,41:1, поэтому размер задан явно.
Запуск из корня проекта: python tools/make-header.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1205, 500  # 2.41:1

BACKGROUND = (27, 42, 74)
PANEL = (35, 52, 88)
TRACK = (51, 69, 107)
WHITE = (255, 255, 255)
MUTED = (166, 179, 204)
ROLE_COLORS = [(78, 143, 247), (111, 207, 151), (242, 201, 76)]

# Доля закрашенной части — факт относительно плана, только для иллюстрации.
ROLES = [("Разработчик", 0.72), ("Аналитик", 1.00), ("Тестировщик", 0.45)]


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for path in (rf"C:\Windows\Fonts\{name}", r"C:\Windows\Fonts\arial.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)

    return ImageFont.load_default()


def main() -> None:
    title_font = load_font("segoeuib.ttf", 56)
    subtitle_font = load_font("segoeui.ttf", 27)
    label_font = load_font("segoeui.ttf", 22)
    legend_font = load_font("segoeui.ttf", 19)

    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    draw.text((72, 150), "Трудозатраты", font=title_font, fill=WHITE)
    draw.text((72, 214), "по ролям", font=title_font, fill=WHITE)
    draw.text((72, 300), "План и факт по каждой роли —", font=subtitle_font, fill=MUTED)
    draw.text((72, 336), "в задаче и по всей очереди", font=subtitle_font, fill=MUTED)

    panel_x, panel_y, panel_w, panel_h = 660, 96, 470, 308
    draw.rounded_rectangle(
        [panel_x, panel_y, panel_x + panel_w, panel_y + panel_h], radius=18, fill=PANEL
    )

    bar_x = panel_x + 34
    bar_w = panel_w - 68
    bar_y = panel_y + 58

    for index, (title, ratio) in enumerate(ROLES):
        draw.text((bar_x, bar_y - 32), title, font=label_font, fill=WHITE)
        draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + 18], radius=9, fill=TRACK)
        draw.rounded_rectangle(
            [bar_x, bar_y, bar_x + int(bar_w * ratio), bar_y + 18],
            radius=9,
            fill=ROLE_COLORS[index],
        )
        bar_y += 88

    legend_y = panel_y + panel_h - 34
    draw.text((bar_x, legend_y), "план", font=legend_font, fill=MUTED)
    draw.rounded_rectangle(
        [bar_x + 46, legend_y + 8, bar_x + 62, legend_y + 18], radius=5, fill=TRACK
    )
    draw.text((bar_x + 70, legend_y), "факт", font=legend_font, fill=MUTED)
    draw.rounded_rectangle(
        [bar_x + 120, legend_y + 8, bar_x + 136, legend_y + 18], radius=5, fill=ROLE_COLORS[0]
    )

    os.makedirs("marketplace", exist_ok=True)
    image.save("marketplace/header-image.jpg", "JPEG", quality=92, optimize=True)

    print(f"marketplace/header-image.jpg {WIDTH}x{HEIGHT} ({WIDTH / HEIGHT:.3f}:1)")


if __name__ == "__main__":
    main()
