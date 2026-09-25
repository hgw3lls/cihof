# CIHOF skyline lockup: usage guide

> **Light theme.** When the exhibit is set to light colours, the lockup is
> drawn in one colour, the ink, as section 2C asks for light paper; the four
> bands appear only on the dark ground.
>
> **In this repository.** The exhibit uses `apps/exhibit/public/brand/skyline-mask.png`
> as a CSS mask, filled with the lens bands or one colour (`src/app/Lockup.tsx`,
> `.skyline` in `exhibit.css`); the kiosk app's icon is drawn from the same mask
> (`apps/kiosk-app/scripts/icon.mjs`). The ink and black versions are kept here
> for print and documents. The supplied `skyline-bands.png` and
> `skyline-bands-on-dark.png` were empty (fully transparent) exports and are not
> included; the band version is always drawn from the mask. **Sign-off:** the
> Hall of Fame has not yet approved this changed form of its logo (see the note
> below); record that decision before the exhibit opens.

A redesign of the Cleveland International Hall of Fame logo for the exhibit kiosk. It keeps the original skyline line and the italic *of*. It cuts the rainbow gradient into the four lens colours and resets the wordmark in Instrument Sans.

> The skyline outline was extracted from the Hall of Fame's supplied logo (`Cle_Int_HoF-hi.jpg`), not redrawn. Using it in this changed form needs sign-off from the Hall of Fame before public use.

---

## 1. The parts

**Skyline.** A single continuous outline of the Cleveland skyline with its left baseline, taken from the original mark.
- Aspect ratio **724 : 469**.
- The stroke is about **1.1% of the skyline's width**: 8px at 724px wide, 2px at about 180px wide.

**Wordmark.** "Cleveland International Hall *of* Fame".
- Instrument Sans 600, letter-spacing −0.025em (header size) to −0.05em (display size).
- *of* is set in **Instrument Serif Italic 400**, the one detail carried over from the original logo.

**Lens bands.** The original gradient ran blue → yellow → green → red. It is now four hard bands, one per kiosk lens, split at the tower edges.

| Band | Lens | Starts | Ends | Colour | Hex (sRGB) |
|---|---|---|---|---|---|
| 1 | Connections | 0% | 41% | `oklch(0.8 0.14 220)` | `#24d2fc` |
| 2 | Years | 41% | 58% | `oklch(0.8 0.14 85)` | `#e7b643` |
| 3 | Places | 58% | 71% | `oklch(0.8 0.14 150)` | `#75d78d` |
| 4 | People | 71% | 100% | `oklch(0.8 0.14 35)` | `#ff9b7f` |

The four colours share lightness and chroma and differ only in hue. Always use all four together, in this order. Never recolour one band on its own, and never bring back the gradient.

**Neutrals**
- Ground `#121211`
- Ink `#f2f1ec`
- Muted `#a19f97` (labels only)

---

## 2. Lockups

### A. Header (primary on screen)
Used in the 72px header of every kiosk screen. It replaces the old text label.
- **Skyline:** 62px wide (about 40px tall), lens bands.
- **Gap:** 14px.
- **Wordmark:** one line, 21px / 600 / −0.025em, ink. *of* in Instrument Serif Italic.
- **Alignment:** the skyline's baseline and the wordmark's baseline align (`align-items: flex-end`).
- **Minimum:** skyline 48px wide, wordmark 16px.

### B. Primary display
For title walls, the attract screen and print.
- **Skyline:** in lens bands.
- **Wordmark:** two lines, set into the open space to the right of the skyline's baseline, as in the original composition.
  - "Cleveland International": 600, in coral (People) or ink.
  - "Hall *of* Fame": 600, about 3.3× the size of line 1, −0.05em, line-height 0.9.
- **Proportions:** skyline width ≈ 5 × the cap height of "Hall *of* Fame". The wordmark overlaps the empty lower right of the skyline by about 27% of the skyline's width.

### C. One colour
- **Ink** (`#f2f1ec`) on dark ground.
- **Black** (`#121211`) on a lens-colour block or on light paper.
- Use this where there are fewer than four colours, or where the mark sits on a lens block.

---

## 3. Clear space and size
- Keep clear space on every side equal to **half the height of the tallest tower** (the Key Tower on the left).
- Minimum skyline width:
  - **48px** on screen
  - **18mm** in print
  - Below that, drop the skyline and set the wordmark alone.
- The line gets heavier as it scales. Beside 2px interface rules, keep the skyline under about 400px wide. Use it larger only as a deliberate display element (see the 9c mosaic).

---

## 4. Backgrounds
| Background | Skyline | Wordmark |
|---|---|---|
| Ground `#121211` | lens bands, or ink | ink (coral allowed for line 1) |
| Lens-colour block | black `#121211` | black |
| Photography | not allowed, except over the dimmed mosaic (portraits at 22% opacity, greyscale) | ink, on a solid `#121211` panel |
| Light paper | black, or lens bands only if a contrast check passes | black |

---

## 5. Don't
- Don't redraw or trace the skyline. Use the supplied asset.
- Don't bring back the smooth rainbow gradient, change the band order, or move the band edges.
- Don't stretch, skew or crop the skyline. Don't remove the baseline.
- Don't set the wordmark in another font, or all in italics. Only *of* is italic.
- Don't add outlines, shadows, glows or containers around the mark.
- Don't put the band version on a lens-colour block.

---

## 6. Using it in code
The skyline is a mask, so it takes any fill:

```css
.skyline {
  width: 62px;
  aspect-ratio: 724 / 469;
  -webkit-mask: url(/brand/skyline-mask.png) center / contain no-repeat;
          mask: url(/brand/skyline-mask.png) center / contain no-repeat;
  background: linear-gradient(90deg,
    var(--lens-links)  0 41%,
    var(--lens-years)  41% 58%,
    var(--lens-places) 58% 71%,
    var(--lens-people) 71% 100%);
}
.skyline--ink   { background: var(--ink); }
.skyline--black { background: var(--ground); }
```

```html
<span class="lockup">
  <span class="skyline" aria-hidden="true"></span>
  <span class="lockup__name">Cleveland International Hall <i class="lockup__of">of</i> Fame</span>
</span>
```

```css
.lockup { display: flex; align-items: flex-end; gap: 14px; }
.lockup__name { font: 600 21px/1 'Instrument Sans', sans-serif; letter-spacing: -.025em; }
.lockup__of { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; }
```

- The mark is decorative (`aria-hidden`). The wordmark text carries the name for screen readers.
- The kiosk is offline, so self-host Instrument Sans and Instrument Serif (both OFL) and add them to the service worker cache.

---

## 7. Files
| File | What |
|---|---|
| `skyline-mask.png` | white outline on transparent, 724×469; the source for CSS masks |
| `skyline-bands.png` | lens-band version, transparent, 1448×938 (2×) |
| `skyline-bands-on-dark.png` | lens-band version on `#121211`, 2× |
| `skyline-ink.png` | one colour, ink `#f2f1ec`, transparent, 2× |
| `skyline-black.png` | one colour, black `#121211`, transparent, 2× |

There's no vector version yet. The mask is traced from a 1486px JPEG, so for print above about 200mm, ask the Hall of Fame for the original vector logo and cut the bands from that at the same stops.
