"""Recorta el damero que Gemini pinta cuando falla la transparencia.

El fondo son dos grises neutros exactos (255 y 197) en casillas de 20.48 px.
La manga jaspeada es gris ~218, lo bastante cerca del 197 como para que un
recorte por color la destroce, así que cada pixel se compara con el color que
le TOCA en su casilla. La paridad se deduce por fila de casillas y solo con las
que tienen fondo limpio, porque el artefacto de generacion desplaza la fase a
media imagen.
"""
from PIL import Image
import numpy as np
from scipy import ndimage

DIAG = np.ones((3, 3), bool)
PAD, PERIOD, WHITE, GREY = 4, 20.48, 255.0, 197.0


def expected_board(v, neutral):
    h, w = v.shape
    ny, nx = int(np.ceil(h / PERIOD)), int(np.ceil(w / PERIOD))
    verdict = np.zeros((ny, nx))          # +1 blanca, -1 gris, 0 sin datos

    for cy in range(ny):
        y0, y1 = int(cy * PERIOD), min(h, int((cy + 1) * PERIOD))
        for cx in range(nx):
            x0, x1 = int(cx * PERIOD), min(w, int((cx + 1) * PERIOD))
            cell, cn = v[y0:y1, x0:x1], neutral[y0:y1, x0:x1]
            nw = (cn & (np.abs(cell - WHITE) <= 8)).sum()
            ng = (cn & (np.abs(cell - GREY) <= 8)).sum()
            if max(nw, ng) >= 30:         # solo casillas con fondo limpio votan
                verdict[cy, cx] = 1 if nw >= ng else -1

    expected = np.zeros((h, w))
    last_parity = 0
    for cy in range(ny):
        row = verdict[cy]
        even = (row[0::2] == 1).sum() + (row[1::2] == -1).sum()
        odd = (row[1::2] == 1).sum() + (row[0::2] == -1).sum()
        parity = last_parity if even == odd == 0 else (0 if even >= odd else 1)
        last_parity = parity
        y0, y1 = int(cy * PERIOD), min(h, int((cy + 1) * PERIOD))
        for cx in range(nx):
            x0, x1 = int(cx * PERIOD), min(w, int((cx + 1) * PERIOD))
            expected[y0:y1, x0:x1] = WHITE if cx % 2 == parity else GREY
    return expected


def drop_stray_runs(mask, from_row):
    """Conserva solo el tramo horizontal mas ancho de cada fila a partir de
    , que es donde la silueta ya es solo antebrazo."""
    out = mask.copy()
    for y in range(from_row, mask.shape[0]):
        row = mask[y]
        if not row.any():
            continue
        edges = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        starts, ends = np.where(edges == 1)[0], np.where(edges == -1)[0]
        if len(starts) <= 1:
            continue
        widest = int(np.argmax(ends - starts))
        out[y] = False
        out[y, starts[widest]:ends[widest]] = True
    return out


def key(path, tol=13, neutral_tol=9):
    rgb = np.array(Image.open(path).convert("RGB")).astype(np.int16)
    v = rgb.mean(axis=-1)
    neutral = (rgb.max(axis=-1) - rgb.min(axis=-1)) <= neutral_tol
    cand = neutral & (np.abs(v - expected_board(v, neutral)) <= tol)
    cand = ndimage.binary_opening(cand, np.ones((3, 3)))

    padded = np.pad(cand, PAD, constant_values=True)
    padded = ndimage.binary_closing(padded, structure=DIAG)
    padded[:PAD, :] = padded[-PAD:, :] = True
    padded[:, :PAD] = padded[:, -PAD:] = True

    labels, _ = ndimage.label(padded, structure=DIAG)
    border = set(labels[0, :].tolist()) | set(labels[-1, :].tolist())
    border |= set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border.discard(0)
    background = np.isin(labels, list(border))[PAD:-PAD, PAD:-PAD]

    # Restos del damero pegados al borde: casillas planas de exactamente 197 o
    # 255. La manga jaspeada nunca es plana, asi que sobrevive.
    mean5 = ndimage.uniform_filter(v.astype(float), 5)
    flat = np.sqrt(np.maximum(ndimage.uniform_filter(v.astype(float) ** 2, 5) - mean5 ** 2, 0)) < 2.5
    exact = neutral & flat & (
        (np.abs(v - WHITE) <= 6) | (np.abs(v - GREY) <= 6)
    )
    background = background | exact

    subject = ndimage.binary_closing(~background, np.ones((7, 7)))
    subject = ndimage.binary_opening(subject, np.ones((11, 1)))
    subject = ndimage.binary_fill_holes(subject)
    lab, n = ndimage.label(subject, structure=DIAG)
    if n > 1:
        sizes = ndimage.sum(subject, lab, range(1, n + 1))
        subject = lab == int(np.argmax(sizes)) + 1
    # Debajo de la muneca el brazo es un unico tramo solido por fila, asi que
    # los tramos sueltos de esa zona son restos del artefacto de generacion
    # (quedan unidos al brazo solo en diagonal, por eso sobreviven al filtro de
    # componentes). Arriba no se toca nada: ahi el marcador y los dedos si son
    # tramos separados legitimos.
    subject = drop_stray_runs(subject, from_row=int(subject.shape[0] * 0.49))
    subject = ndimage.binary_fill_holes(subject)
    subject = ndimage.binary_erosion(subject, np.ones((3, 3)))

    alpha = ndimage.gaussian_filter((subject * 255).astype(np.uint8), 0.8)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA"), subject.mean()
