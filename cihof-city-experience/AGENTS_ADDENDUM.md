# Supplemental Codex execution rules for the city-experience upgrade

Read the repository's actual root and applicable nested `AGENTS.md` first. Do not overwrite them with this file. This package extends the existing MG plan; it does not nullify its safeguards or silently reopen completed tasks.

- Inspect HEAD, the dirty working tree, active entry, and current MG tracker before each stage. The audit SHA is a baseline, not an instruction to reset newer work.
- Work in the current `archive-exhibit` implementation. Preserve canonical IDs and existing deep links. A new Places lens and Activity mode are deliberate product additions; record route compatibility decisions.
- Modify canonical `data/` sources or generators, not only generated files under `public/data/`.
- Preserve approved source wording, field provenance, rights decisions and existing collection inclusion. Never mass-change `approvalStatus`, fabricate dates or quotes, or treat an inferred candidate as a published relationship.
- Distinguish code-ready, fixture-tested, content-ready, target-artifact-tested, and installation-approved. Passing tests does not authorize content.
- Use the pinned Node runtime and installed lockfile. Do not upgrade framework/dependencies to avoid diagnosing an existing failure.
- Use the existing public/kiosk/portal boundary. Extend the current visitor serializer rather than creating a competing publication path.
- New interactive features require a no-drag tap path, keyboard access, reduced-motion behavior, focus return, empty/error handling and reset integration in their own stage, not only in the final accessibility stage.
- Add synthetic fixture content only under test-only locations and ensure it is excluded from deployment. Never create fictional evidence under real inductee IDs.
- One CE stage per task/PR-sized diff. Update TASK_TRACKER and add a completion record using the template. Preserve unrelated edits. Do not push, merge, deploy, change permissions, or grant editorial/rights approval.
- Explain exact commands run, their results, existing failures, and skipped/blocked tests. Do not report other people's historical test results as new passes.
