# EV-02 — Make the published content boundary hold at runtime

**Depends on:** EV-01
**Cases:** P01, P03, P05, P08, P10, P11, P12, P13

## Goal

The reviewed artifact is the only content a visitor can be shown; the running
application knows its content revision; and the staff import path is
deliberate, visible and reversible.

## Why here

The site is deployed to the public now, and its publication boundary is enforced
only at build time. A localStorage override outranks the reviewed artifact,
accepts anything with an `inductees` array, survives every reset the product
offers, and is invisible outside the admin panel. See [AUDIT.md](../AUDIT.md)
§2.1, §2.2, §2.3, §2.6.

Keep the staff import feature. Staff need to load a reviewed bundle without a
rebuild. The boundary around it is what changes.

## File targets

- `src/data/runtimeDataBundle.ts`
- `src/data/localDataCache.ts`
- `src/data/publicationPolicy.ts`
- `src/features/admin/AdminDataPanel.tsx`
- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `vite.config.ts`

## Work

**Read the revision.** Surface `contentContract.contentRevision` and
`schemaVersion` as typed values. Key every cache and override on the revision.
Refuse a payload whose schema version is not the one this build expects.

**Validate an import.** An imported bundle passes the same pure selectors in
`publicationPolicy.ts` that the build uses, plus reference validation, before it
can be shown. Do not write a second set of rules. A refusal names its reason.

**Make an override visible and reversible.** A persistent staff-readable
indicator names the imported revision while it is in effect. Clearing it does
not require the passcode form. Answer open question Q4 and record it as E10:
does an active import survive Start Over on an unattended terminal?

**Repair or remove the dead fallback.** The runtime bundle is 3.1 MB against a
1.5 MB cache cap, so its fallback never stores and never reads. Either move it
to storage sized for the payload or delete the branch and stop implying a
fallback. Either way, test at the real payload size and make an oversize payload
a loud failure.

**Gate the admin surface on build target** so the public build does not ship it.
Record whether a compile-time `VITE_` passcode is acceptable for the kiosk build
given that it is a literal in the shipped bundle.

Do not introduce a server, accounts, or a network authority.

## Acceptance

Listed cases pass. An unpublished record cannot be reinstated through an import
and left undetected. The public build contains no admin code path, verified
against the built bundle. The local fallback either works at real size or no
longer claims to exist.

## Completion

`completions/EV-02.md`; record E10; update the tracker. Stop for review.
