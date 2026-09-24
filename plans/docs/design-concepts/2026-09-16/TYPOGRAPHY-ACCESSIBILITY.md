# Typography and accessibility / 4K visitor display

Decision study for the selected Typographic Index direction. This is a design target, not an ADA compliance determination. The [native 3840 x 2160 comparison](kiosk-type-study.html) uses actual CIHOF portraits and the People browse/focused-person composition. It defaults to light mode and the Bricolage / Instrument / Newsreader pairing; controls compare other type systems and dark mode. Other app commands shown inside the study are illustrative, not production functionality.

## Typeface recommendation

| Role | Typeface | Decision |
| --- | --- | --- |
| Short display titles and large wayfinding words | [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) | Preferred expressive face. Its irregular grotesque details feel like an exhibition identity without requiring tiny labels or dense ornament. [OFL license](type-fonts/bricolagegrotesque-OFL.txt). |
| Visitor names, metadata, navigation, commands | [Instrument Sans](https://github.com/Instrument/instrument-sans) | Preferred calm counterweight to Bricolage. Normal-width letterforms and a variable family keep it readable at touch distance. [OFL license](type-fonts/instrumentsans-OFL.txt). |
| Focused story / interpretive reading | [Newsreader](https://github.com/productiontype/Newsreader) | Preferred editorial layer, designed for continuous on-screen reading. Keep it to story content rather than every control. [OFL license](type-fonts/newsreader-OFL.txt). |
| Alternate systems | [Hanken Grotesk](https://github.com/marcologous/hanken-grotesk) and [Syne](https://gitlab.com/bonjour-monde/fonderie/syne-typeface) | Hanken offers a quieter signage-led option; Syne offers a more overt art-center voice. Both are in the same live comparison, with their local OFL notices beside the font files. |

The first-round [League Gothic](https://www.theleagueofmoveabletype.com/league-gothic) + [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) and Mona Sans pairings remain available as baselines, not the current recommendation. Atkinson has useful low-vision letter distinctions, but its default numerals and overall texture did not suit this visual direction. The new shortlist is a visual hypothesis, not a claim that one font is universally easier to read. Confirm it with visitors on the installed panel.

No font by itself makes an interface accessible. In the kiosk, write narrative in mixed case, keep required controls in the normal-width sans serif, and reserve all caps/heavy display type for short elements. Avoid hairline weights, tracking reductions, and long centered paragraphs. The [Smithsonian exhibition guidance](https://www.sifacilities.si.edu/sites/default/files/Files/Accessibility/accessible-exhibition-design1.pdf) supports distance-based sizing, at least 1.2 line spacing, and alternative forms of exhibit information.

## Physical scale

Assume a 3840 x 2160 panel at native 1:1 output, no OS scaling, no browser zoom, and roughly 30-40 inches diagonal. The pixel density is about 147 ppi at 30 inches and 110 ppi at 40 inches. Browser measurement of the actual study files gives a lowercase x-height of about 0.512 times the CSS size for Newsreader and 0.510 for Instrument Sans.

| Text role in the study | CSS size | Approx. x-height at 30 in. | Approx. x-height at 40 in. |
| --- | ---: | ---: | ---: |
| Inspector reading copy (Newsreader) | 112 px | 9.9 mm | 13.2 mm |
| Portrait names (Instrument Sans) | 74 px | 6.5 mm | 8.7 mm |
| Essential labels and controls (Instrument Sans) | 58 px | 5.1 mm | 6.8 mm |

The [Smithsonian distance table](https://www.sifacilities.si.edu/sites/default/files/Files/Accessibility/accessible-exhibition-design1.pdf) recommends 9 mm x-height for interpretive exhibit text viewed from about 1 m and 4.5 mm even at its shortest listed distance. This is exhibit guidance, not a kiosk-specific legal minimum. The 112 px reading size is intended to exceed its 1 m reference at the smallest proposed display. Smaller labels assume a closer touch interaction. Recalculate these dimensions on the purchased panel: TV overscan, browser/device pixel ratio, OS scaling, mounting position, viewing distance, and glare can all change the result. The preview scales to fit ordinary browser windows, so a laptop screenshot cannot validate physical size.

## Contrast and interaction targets

The study's color pairs were calculated with the [WCAG contrast formula](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html):

| Pair | Calculated contrast | Use |
| --- | ---: | --- |
| Light ink `#171716` on paper `#f6f3e9` | 16.16:1 | Main text |
| Light muted `#67615b` on paper | 5.50:1 | Search placeholder |
| Dark text `#171716` on light coral `#eb5b43` | 5.22:1 | Selected navigation/action |
| Dark paper `#f5f2e8` on field `#151917` | 15.84:1 | Main text |
| Dark muted `#bbb9af` on field | 9.02:1 | Search placeholder |
| Dark text `#171716` on coral `#fa7057` | 6.42:1 | Selected navigation/action |

Coral on light paper is only 3.10:1. Use it for rules, selected borders, and large emphasis, **not small text**. Our production target is at least 4.5:1 for ordinary text, 3:1 for large text and meaningful UI boundaries, with stronger contrast preferred on a backlit, glare-prone screen. See [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). The study's action buttons are at least 124 physical design pixels high (about 21 mm at 30 inches), exceeding the [WCAG 2.2 AA 24 CSS-pixel target](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); touch usability still needs testing with the installed panel.

## Before installation

1. Build the real People, Links, Years, story, and visit states with reflowing layout. This fixed 4K study clips beyond its artboard and is **not** a 200% resize solution. Validate [200% text resize](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) and [user text-spacing overrides](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) without lost content.
2. Re-audit every light/dark state, focus indicator, disabled control, data visualization, and portrait overlay. Color cannot be the sole indicator of selection. Verify keyboard, switch, and screen-reader paths, meaningful image alternatives, and an audio/large-print route for exhibit information.
3. Test on the **actual 30-40 inch panel** at its final mounting height and gallery lighting with standing and seated visitors, including low-vision users. Confirm portrait crops and resolution, reading distance, glare, reach, target spacing, and session timeout behavior.
4. Run a separate desktop-density accessibility pass on the staff portal. Do not apply 4K kiosk sizes to it. Start with a comfortable 18-20 CSS-pixel reading range and responsive reflow, then validate 200% zoom, keyboard workflow, table density, and contrast in its actual display context.

The [ADA.gov Title II web/mobile rule](https://www.ada.gov/resources/small-entity-compliance-guide/) specifies WCAG 2.1 AA for covered state/local government web content and apps; its application to this installation and operator needs a specific assessment. The [U.S. Access Board notes](https://www.access-board.gov/sstm/) that supplemental guidance for self-service kiosks is evolving. Do not transplant ATM/fare-machine text dimensions into this museum kiosk as if they were automatically binding. Use WCAG 2.2 AA and the exhibit guidance above as design targets, then obtain an accessibility review for the actual installation.
