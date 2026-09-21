# Acceptance

## Inherited

The T / P / A / O matrix in
[`cihof-city-experience/ACCEPTANCE_TESTS.md`](../cihof-city-experience/ACCEPTANCE_TESTS.md)
applies in full, including its source-audit addendum (P10–P13, O12–O14, T19).
It is not restated here. Where a stage below names a case ID, that is the case.

The test-environment rules there also apply unchanged: pinned Node 22 and
lockfile, recorded browser/OS and build SHA, separate mouse / keyboard-only /
tap-only paths, and untested combinations recorded rather than omitted.

## Added by this plan

| ID | Case | Pass condition |
|---|---|---|
| E-A1 | Suite integrity | A run that collects zero tests, or fewer than the recorded expected count, fails. Every stage record citing a suite result states the collected count alongside pass/fail. |
| E-A2 | Generated text is distinguishable | A visitor can tell pipeline-generated text from source biography without opening a record's provenance. No generated line reads as a curatorial claim. Applies to `honoredForSummary`, `documentedContextLine` and `storyHighlights`. |
| E-A3 | Copy correctness | No shipped line contains a bare demonym used as a noun, or any other template artifact. Checked across the whole collection, not a sample. |
| E-A4 | Review queue provenance | Every record promoted by the review pipeline carries the legacy field it came from, the decision reference, and the reviewer. A promoted record is never indistinguishable from an authored one. |
| E-A5 | A name match is not a link | The pipeline never creates a relationship, identity or association from a string match. A match produces a queue item requiring an explicit decision. Exercised with a deliberate homonym fixture. |
| E-A6 | Threshold gating | A lens below its content threshold is absent from the build, not present-and-empty. The threshold, its value and who set it are recorded. |
| E-A7 | Gallery rights | Only images whose rights status is approved for the target appear in a gallery. A person with one approved image gets no gallery affordance rather than a gallery of one. |

## Evidence rules

Unchanged from CE, with one addition from E07:

- Record commands actually run, exit codes, build SHA and target, content
  revision, and anything blocked.
- **State the collected test count.** A pass with an unstated count is not
  evidence.
- Screenshots document a rendered state. They do not prove interaction, source
  accuracy, rights, reach, or accessibility.
- No test pass grants curatorial, rights or installation approval.
