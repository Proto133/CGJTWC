#!/usr/bin/env python3
"""
Build the shipped logo assets from the master artwork.

    python3 design/build_logo.py

Pipeline:
  1. Cut the white background out of the master. Only near-white pixels that are
     CONNECTED TO THE IMAGE BORDER count as background, so the white/silver
     segments inside the helmet plume survive. A colour-based selection (GIMP's
     fuzzy select) cannot make that distinction and eats the plumes.
  2. Flatten the bevel/emboss "gloss". The mark is ~13 separate shapes, each a
     connected run of opaque pixels, so each shape is repainted a single flat
     colour instead of trying to reverse the gradients pixel by pixel.
  3. Emit two families:
       JTWC-white-*.png  mono white, for the navy header and other dark surfaces
       JTWC-navy-*.png   flat navy + white, for light backgrounds

Masters stay in design/ on purpose. Anything under client/public/ is copied
verbatim into the production build and served to visitors, so the 1.1 MB
original must not live there.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, 'JTWC_Original.png')
OUT_DIR = os.path.join(HERE, os.pardir, 'client', 'public', 'assets')

NAVY = (0, 32, 91)     # brand primary; matches the site header
WHITE = (255, 255, 255)

HI, LO = 245, 200      # whiteness band used to feather the cutout edge
MIN_SHAPE = 200        # discard specks left over from the cutout
KEYLINE = 9            # navy border on light shapes, in master pixels


def cutout(path):
    """Drop the background, keeping enclosed white areas intact."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    lum = rgb.min(axis=2)   # near-white is high; navy and grey are much lower

    labels, _ = ndimage.label(lum >= LO)
    edges = np.unique(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    )
    background = np.isin(labels, edges[edges > 0])

    alpha = np.full(lum.shape, 255.0, dtype=np.float32)
    # Partial alpha across the HI..LO band keeps the outline anti-aliased.
    ramp = np.clip((HI - lum) / float(HI - LO) * 255.0, 0, 255)
    alpha[background] = ramp[background]

    return rgb.astype(np.uint8), alpha.astype(np.uint8)


def flatten(rgb, alpha, mono):
    """Repaint each shape flat. mono=True renders the whole mark in white."""
    out_rgb = rgb.copy()
    out_alpha = alpha.copy()
    labels, count = ndimage.label(alpha > 140)

    for idx in range(1, count + 1):
        shape = labels == idx
        if int(shape.sum()) < MIN_SHAPE:
            out_alpha[shape] = 0
            continue

        if mono:
            out_rgb[shape] = WHITE
            continue

        if np.median(rgb[shape], axis=0).mean() < 128:
            out_rgb[shape] = NAVY
        else:
            interior = ndimage.binary_erosion(
                shape, ndimage.generate_binary_structure(2, 1), iterations=KEYLINE
            )
            out_rgb[shape] = NAVY        # keyline keeps light shapes readable
            out_rgb[interior] = WHITE

    return Image.fromarray(np.dstack([out_rgb, out_alpha]), 'RGBA')


def trim(img):
    """Crop to the visible mark so sizes are comparable across variants."""
    a = np.asarray(img)
    ys, xs = np.nonzero(a[..., 3] > 20)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    print(f'master: {MASTER}')
    rgb, alpha = cutout(MASTER)

    for name, mono, sizes in (('white', True, (512, 192, 96)),
                              ('navy', False, (512, 192))):
        master = trim(flatten(rgb, alpha, mono=mono))
        for size in sizes:
            # Fit inside a square box, preserving the mark's aspect ratio.
            scaled = master.copy()
            scaled.thumbnail((size, size), Image.LANCZOS)
            path = os.path.join(OUT_DIR, f'JTWC-{name}-{size}.png')
            scaled.save(path, optimize=True)
            kb = os.path.getsize(path) / 1024
            print(f'  wrote JTWC-{name}-{size}.png  {scaled.size[0]}x{scaled.size[1]}  {kb:.0f} KB')


if __name__ == '__main__':
    main()
