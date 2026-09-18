# Pinned person interaction study

[Open the study](pinned-person-study.html) through the local Vite server at `/docs/design-concepts/2026-09-17/pinned-person-study.html`. This is a prototype using current runtime data, not a replacement for the visitor app.

The selected portrait and name occupy one fixed region while the adjacent field changes between People, Links, and Years. The selected person is omitted from the portrait grids, so their photo appears only once. People has search but no alphabet menu. Links is one list of archive person references and same-class people, with no nested connection modes or generated suggestions. Tapping a row selects that person; Back returns to the prior selection. Years uses one horizontally scrollable, tappable year rail; swiping the cohort advances or reverses the class. The light palette remains the default, with a dark option.

Archive relationship rows remain labeled as references, not confirmed direct ties. Same-class rows are derived from class-year records. The study does not write visitor state or alter the production app.

## Audit notes

- Checked People, Links, and Years from 320 x 640 through 3840 x 2160. The selected region stayed fixed, page width did not overflow, and the selected year stayed visible in the rail.
- Tested search, linked-person selection and Back, keyboard year stepping, touch year swipes, dark mode, long names, portrait decoding, and biography scrolling in Chromium.
- Primary touch controls measure at least 44 CSS pixels in each direction. Light and dark text tokens were checked for contrast; this is not a claim of WCAG conformance. A physical 30-40 inch touchscreen and assistive-technology pass are still required.
- All 111 primary portrait paths exist. However, 53 primary files are under 300 pixels in at least one dimension, so a sharp large-format 4K portrait requires higher-resolution source media. The prototype does not invent pixels or replace approved images.
