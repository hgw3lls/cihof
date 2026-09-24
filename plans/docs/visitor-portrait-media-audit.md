# Visitor portrait media audit

2026-09-17. Source: `data/media_manifest.json`, `assets[*].images.primary`.

## Current set

- 111 primary portraits have approved rights and kiosk approval.
- 53 are narrower than 350px; 95 are narrower than 600px.
- 63 are square or wider than a 0.95 width-to-height ratio. All visitor portraits now fill the same image opening; near-square sources receive a slight crop instead of visible letterboxing.
- At 3840 x 2160, a People-grid opening is about 553 x 560 CSS pixels. Softness in the smallest originals cannot be corrected by display styling or upscaling.

The visitor build now reserves equal image and caption areas, uses a consistent fill crop, displays a visible loading fallback, loads the first twelve portraits eagerly, and defers the rest until needed. This addresses layout shifts and blank openings, not source resolution.

## Larger approved gallery candidates

Each file below has approved rights and kiosk approval in the manifest and is at least 1.5 times larger in both dimensions than its current primary. These are **not automatic replacements**: compare identity, crop, occasion, and curatorial intent before changing the primary selection. For example, Valarie McCall's candidate is a different, informal photograph from her current official portrait.

| Person | Current primary | Gallery candidate |
| --- | --- | --- |
| Bishop Anthony Pilla | 298 x 302 | `gallery-7.jpg`, 500 x 752 |
| Dick Pogue | 298 x 302 | `gallery-5.jpg`, 500 x 538 |
| Dick Russ | 298 x 302 | `gallery-11.jpg`, 500 x 726 |
| Honorable Jose A. Villanueva | 298 x 302 | `gallery-3.jpg`, 500 x 492 |
| Richard A. Ganim | 298 x 302 | `gallery-5.jpg`, 500 x 497 |
| Shiv K. Aggarwal | 298 x 302 | `gallery-2.jpg`, 500 x 512 |
| Steve Mulloy | 298 x 302 | `gallery-1.jpg`, 500 x 502 |
| Berj Shakarian | 656 x 606 | `gallery-2.jpg`, 1024 x 982 |
| Valarie McCall | 214 x 320 | `gallery-6.jpg`, 500 x 751 |

All candidate paths are under `public/media/images/<person-id>/`. The first priority for new masters is the 53 sub-350px primaries, especially portraits shown at large scale on the 4K installation. Keep the existing primary until a curator approves a replacement with matching identity and display rights.
