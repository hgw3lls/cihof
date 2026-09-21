# CIHOF museum-interactive upgrade package

Prepared for Tony Yanick · Source documents dated September 19, 2026

**A Codex implementation handoff for the existing `hgw3lls/cihof` project.**
This ZIP contains the audit, upgrade specification, staged tasks, and working checklists.
It is not application source, an installer, or a ready-to-deploy offline kiosk build.
Nothing in this package changes or deploys the live site.

## Start here

1. Extract the ZIP. Put the entire `cihof-museum-upgrade` folder in the root of your existing `cihof` repository, alongside `package.json`. Do not put it in `public/`, `src/`, or a deployment output folder.
2. Open that repository in Codex and paste the contents of **[START_HERE.txt](START_HERE.txt)**.
3. Run **MG-00 only** first. Review the baseline report, actual test results, and changed files before authorizing the next stage. Continue one task at a time using the master plan and task tracker.

For an attachment-based Codex workflow instead, attach the audit and master plan and paste the original **[CIHOF_Codex_Start_Prompt.txt](CIHOF_Codex_Start_Prompt.txt)**. The instructions are included; this package does not assume a particular Codex interface or installation.

## Contents

| File or folder | Purpose |
|---|---|
| `CIHOF_Museum_Grade_Audit.md` | Full source-backed assessment and source register. Original file preserved. |
| `CIHOF_Codex_Upgrade_Plan.md` | Authoritative requirements, file targets, task dependencies, tests, and prompts. Original file preserved. |
| `CIHOF_Codex_Start_Prompt.txt` | Original bootstrap prompt for attached documents. |
| `START_HERE.txt` | Bootstrap prompt with explicit repository-relative package paths. |
| `tasks/` | Nine separate task briefs, MG-00 through MG-08, extracted from the master plan. |
| `TASK_TRACKER.md` | Editable execution tracker; all stages start as Not started. |
| `ACCEPTANCE_CHECKLIST.md` | Shared test matrix and remaining gallery sign-off checks. |
| `templates/TASK_COMPLETION.md` | Evidence and review template for each stage. |
| `SHA256SUMS.txt` | File-integrity checksums for this package. |

## Read this before coding

The audit is pinned to reference commit `f47d1d7ff9080072a7f3a28508a73e83907f61a5`.
Codex must inspect current HEAD and account for newer work, not revert it to match the audit.
The original assessment was source-backed, not a completed live visual, performance, accessibility,
or physical-hardware acceptance test. MG-00 establishes fresh runtime evidence.

Preserve People / Links / Years, person-selection continuity, canonical IDs, approved content,
the editorial visual direction, and the separate staff workflow. Work in the active visitor
implementation, not the retained legacy application. Do not invent history or approve media
or relationship claims. Read existing `AGENTS.md` instructions; no replacement `AGENTS.md`
is bundled here. Any repository guidance added during MG-00 must be based on verified context.

The master plan is authoritative. Standalone task briefs do not replace its shared constraints
or acceptance requirements. Packaging is complete; implementation and all acceptance checks
remain unperformed by this package.

## Verify the package (optional)

From inside the extracted folder on macOS:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

On systems with GNU coreutils:

```sh
sha256sum -c SHA256SUMS.txt
```

These checks verify packaged-file integrity only. They do not test or certify the application.
