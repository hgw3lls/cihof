# EV-07 — Make the images that are already approved reachable

**Depends on:** EV-02
**Cases:** T14, A01, A02, E-A7
**Threshold:** none; the content exists today

## Goal

The 65 people with more than one rights-approved image get a gallery.

## Why here

Cheapest real content win in the plan. 65 of 111 people have `hasGallery: true`
and more than one entry in `imageUrls`, every portrait carries
`imageRightsStatus: approved`, the files are already in the artifact, and there
is no surface. This is approved content that is built, shipped and unreachable.
See [AUDIT.md](../AUDIT.md) §1.5.

It needs no editorial throughput, which is why it does not wait for EV-05.

## File targets

- `src/features/archive-exhibit/ArchiveExhibit.tsx` — `RecordView`
- `src/features/archive-exhibit/interpretiveModel.ts`
- `src/app/mediaPublication.ts`
- `vite.config.ts` — target-eligible asset filtering

## Work

Add a gallery to the record, inside the existing detail system rather than a new
full-screen modal, and layered per decision D08 so it does not discard whatever
is underneath it.

Only target-eligible images appear. A person with one approved image gets no
gallery affordance rather than a gallery of one. A missing file or a load
failure shows a recoverable state. Captions and credits persist with the image.

Zoom works without pinch or drag, per A01. Keyboard and screen-reader paths are
built here, not deferred to a later accessibility stage.

## Acceptance

T14 and E-A7 pass. A01 and A02 pass for this surface. No image appears whose
rights status is not approved for the target, verified against the built
artifact.

## Completion

`completions/EV-07.md`; update the tracker. Stop for review.
