#!/usr/bin/env python3
"""Generate all app icons for the localhost macOS menu bar app."""

import os
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
FONT_PATH = '/System/Library/Fonts/Menlo.ttc'
FONT_BOLD_INDEX = 1


def rounded_rect_mask(size, radius):
    """Create a rounded rectangle mask."""
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def create_base_icon(size=1024):
    """Create the 1024x1024 base app icon with ://, gradient background, rounded corners."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw gradient background (top: #1a1a2e, bottom: #16213e)
    top_color = (26, 26, 46)
    bottom_color = (22, 33, 62)

    for y in range(size):
        t = y / (size - 1)
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * t)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * t)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * t)
        draw.line([(0, y), (size - 1, y)], fill=(r, g, b, 255))

    # Apply rounded corners
    corner_radius = int(size * 0.22)  # macOS-style rounded corners
    mask = rounded_rect_mask((size, size), corner_radius)
    img.putalpha(mask)

    # Draw "://" text
    # Use a large font size that fills the icon well
    font_size = int(size * 0.42)
    font = ImageFont.truetype(FONT_PATH, font_size, index=FONT_BOLD_INDEX)
    text = "://"

    bbox = font.getbbox(text)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center the text with slight upward offset for visual balance
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1] - int(size * 0.02)

    # Draw a subtle shadow for depth
    shadow_offset = max(2, int(size * 0.004))
    shadow_draw = ImageDraw.Draw(img)
    shadow_draw.text((x + shadow_offset, y + shadow_offset), text, fill=(0, 0, 0, 80), font=font)

    # Draw main text in white
    draw = ImageDraw.Draw(img)
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    return img


def create_tray_icon(size=44):
    """Create a tray template icon: black ://' on transparent background."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font_size = int(size * 0.55)
    font = ImageFont.truetype(FONT_PATH, font_size, index=FONT_BOLD_INDEX)
    text = "://"

    bbox = font.getbbox(text)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1]

    draw.text((x, y), text, fill=(0, 0, 0, 255), font=font)

    return img


def resize_icon(base_img, target_size):
    """Resize the base icon to a target size with high-quality resampling."""
    return base_img.resize((target_size, target_size), Image.LANCZOS)


def generate_all():
    shared_dir = os.path.join(ICONS_DIR, 'shared')
    macos_dir = os.path.join(ICONS_DIR, 'macos')
    windows_dir = os.path.join(ICONS_DIR, 'windows')

    os.makedirs(shared_dir, exist_ok=True)
    os.makedirs(macos_dir, exist_ok=True)
    os.makedirs(windows_dir, exist_ok=True)

    # --- 1. Generate base 1024x1024 icon ---
    print('Generating 1024x1024 base icon...')
    base = create_base_icon(1024)
    base.save(os.path.join(ICONS_DIR, 'app-icon-1024.png'))
    print('  -> app-icon-1024.png')

    # --- 2. Generate shared PNG sizes ---
    shared_sizes = {
        '32x32.png': 32,
        '128x128.png': 128,
        '128x128@2x.png': 256,
        '256x256.png': 256,
        '512x512.png': 512,
        'icon.png': 512,
    }

    print('Generating shared icon PNGs...')
    for filename, size in shared_sizes.items():
        resized = resize_icon(base, size)
        resized.save(os.path.join(shared_dir, filename))
        print(f'  -> shared/{filename} ({size}x{size})')

    # --- 3. Generate macOS .icns ---
    print('Generating macOS .icns file...')
    iconset_dir = os.path.join(ICONS_DIR, 'icon.iconset')
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir)

    icns_sizes = [
        ('icon_16x16.png', 16),
        ('icon_16x16@2x.png', 32),
        ('icon_32x32.png', 32),
        ('icon_32x32@2x.png', 64),
        ('icon_128x128.png', 128),
        ('icon_128x128@2x.png', 256),
        ('icon_256x256.png', 256),
        ('icon_256x256@2x.png', 512),
        ('icon_512x512.png', 512),
        ('icon_512x512@2x.png', 1024),
    ]

    for filename, size in icns_sizes:
        resized = resize_icon(base, size)
        resized.save(os.path.join(iconset_dir, filename))

    try:
        icns_path = os.path.join(macos_dir, 'icon.icns')
        subprocess.run(
            ['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path],
            check=True, capture_output=True
        )
        print(f'  -> macos/icon.icns')
        shutil.rmtree(iconset_dir)
    except Exception as e:
        print(f'  WARNING: Failed to create .icns: {e}')

    # --- 4. Generate tray icon ---
    print('Generating tray icon...')
    tray = create_tray_icon(44)
    tray.save(os.path.join(ICONS_DIR, 'tray-icon.png'))
    print('  -> tray-icon.png (44x44, template)')

    # --- 5. Generate Windows .ico ---
    print('Generating Windows .ico file...')
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = []
    for s in ico_sizes:
        resized = resize_icon(base, s)
        # Convert RGBA to ensure compatibility
        ico_images.append(resized.copy())
    ico_path = os.path.join(windows_dir, 'icon.ico')
    # PIL ICO: first image is base, append_images are additional sizes
    ico_images[-1].save(
        ico_path,
        format='ICO',
        append_images=ico_images[:-1],
    )
    print(f'  -> windows/icon.ico')

    print('\nAll icons generated successfully.')


if __name__ == '__main__':
    generate_all()
