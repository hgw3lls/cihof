# City Experience adoption decisions

These decisions adopt the City Experience extension without replacing the
current product, changing publication status, or reopening completed MG work.

## D01 - Evolve the active exhibit

The visitor root remains `ArchiveExhibit`. New modules will be extracted under
`src/features/archive-exhibit/` as responsibilities become independently
testable. The legacy Living Hall and `App.tsx` are not implementation targets.
React, TypeScript, Vite, the current runtime loaders, and the separate staff
portal remain in place.

## D02 - One shell, four lenses

The persistent shell will expose People, Places, Connections, and Time while
preserving one selected person across compatible transitions.

- Canonical route values remain `people`, `links`, and `years`; `places` is
  added deliberately.
- Existing `scene=links` and `scene=years` URLs keep their meanings.
- Existing connection aliases continue to resolve to Connections.
- The legacy `places` alias currently resolves to Links. CE-05 will change it
  to the real Places lens and will add compatibility tests at that point.
- `scene=years` always opens induction chronology. Historical activity requires
  an explicit stable mode identifier; it is never inferred from an old URL.
- Unknown person IDs return a recoverable collection state.

## D03 - One visitor-state owner

CE-02 will introduce one typed reducer/controller for lens, grouping, query,
facets, selected person, comparison, place, time, detail, history, and per-lens
restoration. Existing session timeout and media-stop ownership remain singular.
Stable IDs may be serialized; staff data, filesystem paths, long content, DOM
references, and installation settings may not be serialized as visitor state.

## D04 - Staged feature exposure

New lenses and interpretation surfaces will be introduced behind typed,
target-aware capability checks while incomplete. Test-only synthetic fixtures
stay under test paths and may enable capabilities in browser tests. Public and
kiosk builds must not receive fixture records. CE-11 may enable a capability by
default only after its software and publication gates pass; external review
items remain labeled even when code is enabled.

## D05 - Preserve base eligibility; gate enrichment

The 111-person base collection remains discoverable. Existing
`approvalStatus: draft` values are not treated as a blanket removal rule and
are not mass-promoted. New stories, place associations, vocabulary assertions,
events, relationships, comparisons, media uses, and trails require explicit
item-level evidence, review state, and publication target. UI and build-time
serialization will share pure eligibility selectors.

## D06 - Sequential delivery and reviewable evidence

CE-00 through CE-11 are completed in dependency order. Each stage receives a
tracker update and completion record before the next begins. Code readiness,
fixture-test readiness, content readiness, exact-artifact readiness, and
installation approval are reported separately.

## D07 - No inferred historical expansion

No identity, place, date, relationship, quotation, outcome, rights scope, or
approval is inferred from a name, portrait, prose mention, shared tag, or file
presence. Shared induction context remains distinct from a documented direct
relationship. Sparse and unknown data remain visible as such.

## D08 - Detail state may layer; it is not one mutually exclusive value

Record, QR, film and later evidence, gallery and comparison surfaces are not
alternatives to one another. The tested MG-03 behavior is that a record opens
over an active film and closing it returns to that film with focus restored to
its originating control. A single-valued `detail` union cannot express this and
silently discards the underlying surface.

CE-02 therefore owns a detail model that keeps an active media surface
independent of the transient panel above it, or an explicit ordered stack. Any
lens or detail work in later stages inherits this constraint. Recorded during
CE-00 because the in-progress CE-02 code already violates it and the failure is
in the existing regression suite, not in new coverage.
