# Curation decisions

Every sheet a curator signed, committed beside the change it produced. The apply
tools archive here automatically, so this directory is the answer to "who decided
this, and what did they see when they decided it".

## What a `decisionReference` has to do

Approval in this repository is not a boolean. `isApproved` in
`packages/content/src/publication.ts` refuses a bare `status: 'approved'` and
requires two more fields:

- **`decisionReference`** — what the approval rests on. It exists so a claim can
  be traced back to a person and an occasion.
- **`contentVersion`** — which wording the decision covered, so a later edit
  cannot inherit an approval made about different words.

A reference that resolves to nothing is worse than an absent one. `isApproved`
passes, the gate reports green, and the audit trail is decorative — which is the
one failure the field exists to prevent.

## The convention

    <subject>-<act>-<YYYY-MM-DD>

The date is **when the decision was made**, not when the file was written. A
correction to how a decision was recorded does not change when it was taken.

In use:

| Reference | The decision |
| --- | --- |
| `links-review-2026-09-22` | Who each recorded inducter name refers to — 25 names confirmed against the corpus candidates |
| `links-publication-2026-09-22` | Whether those relationships may be shown, and to whom — kiosk only |

Those are two references because they are two decisions, and the crosswalk keeps
them apart on purpose: *"Resolving all 90 names grants no permission at all."*
Knowing who Sam Miller is does not decide whether to say so on a wall.

**What a reference points at.** With no external tracker in this project, it
points at this directory: the dated sheet archived here is the record of what was
signed. If a tracker is adopted later, use its id instead — the requirement is
that the string resolves to something a person can open, not that it matches this
shape.

## `contentVersion`

Use the build's own content revision, prefixed:

    content-<contentRevision>

`contentRevision` is a sha256 of the published people, computed by `revisionOf`
in `packages/pipeline/src/build/emit.ts`. It is derived from content alone and is
stable across rebuilds, so two builds of the same sources produce the same value
and a changed one means the content genuinely moved.

Read the current value for the target you are approving for:

```
node --experimental-strip-types -e "
import('./packages/pipeline/src/build/emit.ts').then(async (m) => {
  const { buildPeople } = await import('./packages/pipeline/src/build/people.ts');
  console.log(m.buildRuntimeBundle(buildPeople(), 'kiosk').contentRevision);
});"
```

Do not invent a version number. `v7` was used here initially and named a version
nothing had produced; it was replaced with
`content-2e3082085018a330e07cd374937fe242`, which is the kiosk revision the
approval was actually made against.

## Applying

Never hand-edit the canonical JSON. The apply tools dry-run by default, require
a hash of the sheet you previewed, refuse on a dirty working tree, and archive
the sheet here:

```
npm run links:apply   -- --input=<sheet>              # induction resolutions
npm run links:apply   -- --sign-publication --decision-reference=… --content-version=… --targets=kiosk
npm run places:apply  -- --input=<sheet>              # place approvals, or tie roles
npm run ties:apply    -- --input=<sheet> --targets=kiosk   # proposed ties
npm run bios:apply    -- --input=<sheet>              # biography corrections
npm run class:add     -- --input=<sheet>              # a new induction class
npm run curate:apply  -- --input=<sheet> --decision-reference=…   # curated metadata
```

`curate:apply` and `media:apply` are older: they preview by default, but take
no hash, do not check the working tree and do not archive. Commit the sheet
here yourself, beside the change it made.

A change visitors will see is also recorded, with its reference, in
`data/cihof_reviewed_differences.json`: the difference from the record the
exhibit first published, and the decision that made it.

Each refuses a decision with no reference rather than writing a placeholder.
That refusal is the point of them.
