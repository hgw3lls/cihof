# Visual concept round 01

These are exploratory image mockups for the Cleveland International Hall of Fame visitor app and staff portal. Each image places the visitor screen on the left and the staff screen on the right. They explore how the same archive could have a distinct composition for browsing people, reading a profile, following years, and understanding links.

The images were made with the built-in image generation tool. Faces, some names, relationships, counts, and small UI copy are generated placeholders. They are not verified archive data or proposed final content. Production design should use actual media and copy from the repo.

| Concept | Main composition | Staff translation | Useful part to carry forward |
| --- | --- | --- | --- |
| [01 Index](01-index.webp) | Alphabet and portrait matrix with one selected profile | Numbered queue beside the selected record | Fast scanning and clear collection scale |
| [02 Stage](02-stage.webp) | One person fills the visual field; peers sit in a restrained strip | A focused review task with the same portrait as context | Strong emotional focus and readable touch navigation |
| [03 Chronology](03-chronology.webp) | Year ruler and aligned class portraits | Year list and class record editor | Time is visible as an actual structure |
| [04 Connection Score](04-connection-score.webp) | Portraits and labeled relationship bands on one grid | Link queue, paired subjects, evidence, decision | Links become readable claims with supporting evidence |

## Prompt set

All four prompts requested straight-on, flat, high-fidelity UI diptychs showing both visitor and staff views. They used the real app's People / Links / Years exploration model and the portal's queue, selected record, evidence, and decision workflow. Each asked for clear typography, strong portrait content, stable navigation, deliberate alignment, and no gradients, shadows, glass, rounded cards, or decorative visual noise.

- **Index:** rigorous editorial alphabet and portrait matrix; white, black, acid yellow, vermilion; compact serif captions; numbered review queue.
- **Stage:** one monumental selected portrait and name; cobalt, coral, off-white, black; bottom navigation and a single story action; focused staff task.
- **Chronology:** horizontal year axis with aligned portraits; newsprint, charcoal, red, small blue accent; staff class-year editor.
- **Connection Score:** horizontal relationship bands and portrait columns; black, warm white, mint, pink; staff relationship evidence workbench.

## First synthesis

The strongest direction may combine the Index for People, the Stage for a selected person's story, the Chronology for Years, and the Score for Links. A next round should test that combination with actual inductee portraits and copy, then compare it at kiosk and portal viewport sizes before implementation.

## Round 02: Index permutations

The Index was selected for further exploration. These three studies use actual portrait files and record fields from `public/data/inductees.json`. They are static layout studies, so the pictured controls are not yet interactive. Their editable source is [index-permutations.html](index-permutations.html), which can be opened directly in a browser.

| Study | Layout change | Question it tests |
| --- | --- | --- |
| [05 Refined Index](05-index-refined.webp) | Retains the original three-part visitor layout and a compact queue/editor portal | Is the chosen concept already close with accurate content and cleaner spacing? |
| [06 Catalogue Index](06-index-catalogue.webp) | Moves the selected record left and runs A-Z across the full width | Does a denser reference-book rhythm suit the archive better? |
| [07 Exhibition Index](07-index-exhibition.webp) | Inverts the visitor field and makes the selected record a wide bottom band | Can the same index feel more like an exhibition wall without losing clarity? |

The selected record is Alex Machaskee, Class of 2010. The short summary, Serbian heritage tag, draft profile status, medium review priority, and approved image rights match the current data. The roster is a small sample of 12 real inductees, not the full collection.

## Round 03: Research-led Index studies

The default remains [05 Refined Index](05-index-refined.webp). In [index-permutations.html](index-permutations.html), the checkbox above the studies switches 05 between its light default and [08 Dark Index](08-index-dark.webp). Both visitor and staff surfaces change together; their hierarchy and placement stay fixed.

| Study | Change from 05 | Question it tests |
| --- | --- | --- |
| [08 Dark Index](08-index-dark.webp) | Deep neutral field, warm white type, luminous yellow selection | Does the same index retain its clarity in low light? |
| [09 Portrait Index](09-index-portraits.webp) | Three larger portrait columns, nine visible people, coral selection, pale teal story field | Does giving each person more visual space improve browsing? |
| [10 Typographic Index](10-index-type.webp) | Larger active letter, strong coral rule, quieter selected-person sheet | Can expressive type carry the exhibition identity while content stays orderly? |

Research inputs and our design inferences:

- [Letterform Archive's account of its Online Archive design](https://letterformarchive.org/news/designing-the-online-archive/) describes visual browsing with clear labels and context. We kept the portrait index as the entry point and tested larger images in 09.
- [Berlin Museum's recent identity](https://stanhema.com/en/projects/berlin-museum-rebranding) derives a flexible wordmark from the city's visual culture. We used this as a prompt to make the alphabet itself more expressive in 10, without borrowing its specific type or mark.
- [Cooper Hewitt's Pen design](https://www.cooperhewitt.org/new-experience/designing-pen/) connects in-gallery discovery with a saved collection that can be explored later. We exposed the existing CIHOF visit collection as a visible command in 09 and 10.
- [V&A East Storehouse Lookup](https://domwhooley.com/work/lookup/) keeps the gallery interface visually restrained, extends the physical wayfinding language, and uses a distinct dark mode for the David Bowie Centre. We treated dark mode as a full palette state of 05, with layout and content hierarchy unchanged.

The new images are deterministic browser captures using the repo's portrait files and the same verified sample records as round 02. They are visual studies, not a production interface.

## Round 04: Typographic Index states

[10 Typographic Index](10-index-type.webp) is the current preferred direction. These studies keep its alphabet rail, coral rule, portrait matrix, and selected record language intact while testing the next interaction states.

| Study | State | Design question |
| --- | --- | --- |
| [11 Typographic Index dark](11-index-type-dark.webp) | People browse, dark | Does the exact Type Index layout hold together in dark mode on visitor and staff screens? |
| [12 Opened person](12-index-type-focus.webp) | Alex Machaskee selected, light | Can a person move from the dense index to a generous reading field without losing the alphabet context? |
| [13 Opened person dark](13-index-type-focus-dark.webp) | Alex Machaskee selected, dark | Does that reading field stay legible and portrait-led in dark mode? |

The second checkbox in [index-permutations.html](index-permutations.html) switches studies 10 and 12 together between light and dark. The opened-person study uses Alex Machaskee's current summary, class year, Serbian heritage tag, portrait, and `inductedBy` value from the repo. The depicted controls remain static concept controls.

## Round 05: Actual functional scenes

The earlier Index images substituted an alphabetical catalogue and full-screen profile for the app's real portrait field and inspector. [Functional scenes](functional-scenes.html) applies the preferred 10 typographic language to the current scene anatomy instead. It opens directly as a local HTML file and has a light default plus a dark-mode switch.

| Visitor scene | Existing function represented |
| --- | --- |
| People | Browse the persistent portrait field, search, and switch lenses |
| Focus | Select a person while the field remains present; inspect facts, honor summary, and actions |
| Life + Work | Open the story panel over the field while retaining the focused-person inspector |
| Links | Follow a selected person's direct ties and choose connected portraits |
| Years | Move through induction classes and the selected cohort |
| Visit | See saved portraits, a guided journey step, suggested next person, and Visit QR action |

The eight staff portal scenes follow its current tabs: Start Here, Best Content, Workbench, Source Data, Story Lenses, Relationships, Readiness, and Exports. Their structures and commands are based on `ReviewDashboardView.tsx` and its portal panels, not the generic approval screen in the earlier study. Sample names, images, class years, status counts, and the Class of 2010 Legacy Path come from current repo data or acceptance tests. Some text is shortened to fit the visual study; it is not proposed archival copy.

These are browser-rendered **visual studies**, not a working replacement for the React app. The scene selector, lens tabs, portal tabs, and light/dark switch navigate the study; editing, search, saving, QR generation, and runner actions are not wired to data. Production code is unchanged.

## Round 06: Initial 4K type scale

The first 3840 x 2160 pass tested Atkinson Hyperlegible Next and Mona Sans under League Gothic. These captures preserve that comparison, but the pairing is no longer the preferred direction. Its physical-size and contrast work is carried into [the current accessibility notes](TYPOGRAPHY-ACCESSIBILITY.md).

| Native 4K capture | View |
| --- | --- |
| [Atkinson / People browse](kiosk-type-browse-atkinson.webp) | Light default |
| [Atkinson / focused portrait](kiosk-type-focus-atkinson.webp) | Light default |
| [Mona Sans / focused portrait](kiosk-type-focus-mona.webp) | Font comparison |
| [Atkinson / focused portrait / dark](kiosk-type-focus-dark.webp) | Dark option |

## Round 07: Art-led type systems

The [live 4K type study](kiosk-type-study.html) now defaults to **Bricolage Grotesque / Instrument Sans / Newsreader**. It keeps the same real People scenes, 30-40 inch sizing target, and contrast palette while testing a less condensed, more considered typographic voice. Switch between these five systems, the two earlier baselines, browse/focus, and light/dark in the study. The [typography notes](TYPOGRAPHY-ACCESSIBILITY.md) cover licenses, measured physical text size, and installation checks. This is still a visual prototype, not the production app or a compliance certification.

| Native 4K capture | Reading voice |
| --- | --- |
| [Preferred browse](kiosk-type-02-browse.webp) | Bricolage display / Instrument interface |
| [Preferred focus](kiosk-type-02-bricolage-newsreader.webp) | Bricolage display / Newsreader story |
| [Preferred dark](kiosk-type-02-bricolage-newsreader-dark.webp) | Same type in dark mode |
| [All sans](kiosk-type-02-bricolage-instrument.webp) | Bricolage / Instrument |
| [Editorial](kiosk-type-02-hanken-newsreader.webp) | Hanken / Newsreader |
| [Art-center](kiosk-type-02-syne-instrument.webp) | Syne / Instrument |
| [Neutral reference](kiosk-type-02-hanken-only.webp) | Hanken only |

## Round 08: Index approval candidate

[Open the interactive approval study](index-approval-study.html) to compare the selected type system in a composition closer to [10 Typographic Index](10-index-type.webp). It restores the large alphabet rail, a portrait-led catalogue, a single selected-person sheet, and the coral navigation rule. Bricolage carries display and index type, Instrument Sans carries controls and metadata, and Newsreader carries the story. Light is the default; dark is a complete palette state.

| Capture | Native size | Design question |
| --- | --- | --- |
| [Catalogue focus](approval-catalogue-light.webp) | 3840 x 2160 | Does an eight-person portrait field preserve the Index character while keeping names and class years kiosk-sized? |
| [Reading spread](approval-reading-light.webp) | 3840 x 2160 | Should a selected person receive a wider story field? |
| [People browse](approval-browse-light.webp) | 3840 x 2160 | Does a twelve-person overview work when no profile is selected? |
| [Catalogue dark](approval-catalogue-dark.webp) | 3840 x 2160 | Does the same hierarchy hold in the optional dark palette? |
| [Staff workbench](approval-portal-light.webp) | 1920 x 1080 | Can the same identity support a denser review queue and evidence task? |
| [Staff workbench dark](approval-portal-dark.webp) | 1920 x 1080 | Does the staff translation remain clear in dark mode? |

The visitor study uses actual portrait files and a thirteen-person sample from `public/data/inductees.json`. Search, alphabet jumps within that sample, person focus, per-person saving, Visit, scene switching, and the light/dark control work in the HTML study. Short story excerpts are edited down from current profile material for layout testing and still need editorial approval. Links, Years, and Follow the Trace open the earlier functional-scenes study; those views have **not** been translated into this new composition. The staff workbench is a visual translation of the current queue/editor anatomy and real Aklilu Demessie data, but its editing commands are not wired. None of this changes the production app.

The captures were checked at their native pixel dimensions for missing portraits, name/story overflow, and the browse-to-focus path across all twelve visible sample records. This is a direction to review, not an approved design or an accessibility certification. Before implementation, the remaining scenes, full 111-person catalogue behavior, real content editing, keyboard/screen-reader flow, and 30-40 inch physical-device legibility still need validation.
