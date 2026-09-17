from pathlib import Path
from PIL import Image

SOURCE = Path(r"C:\Users\USER\Downloads\28997822520250908_111639.png")
OUTPUT = Path(r"C:\Users\USER\Documents\AI-Teaching-Assessment\public\ced-logo-mark.png")

image = Image.open(SOURCE).convert("RGBA")

# The emblem occupies the left section of the supplied horizontal artwork.
mark = image.crop((0, 0, 1300, image.height))
pixels = mark.load()

for y in range(mark.height):
    for x in range(mark.width):
        red, green, blue, _ = pixels[x, y]
        distance_from_white = 255 - min(red, green, blue)
        alpha = max(0, min(255, distance_from_white * 9))
        pixels[x, y] = (red, green, blue, alpha)

bounds = mark.getbbox()
if bounds is None:
    raise RuntimeError("Logo extraction produced an empty image")

mark = mark.crop(bounds)
padding = 18
canvas = Image.new("RGBA", (mark.width + padding * 2, mark.height + padding * 2), (0, 0, 0, 0))
canvas.alpha_composite(mark, (padding, padding))
canvas.save(OUTPUT, "PNG", optimize=True)
print(f"Saved {OUTPUT} ({canvas.width}x{canvas.height})")
