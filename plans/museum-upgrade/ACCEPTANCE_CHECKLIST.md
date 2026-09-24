# Acceptance checklist

**Status: not executed.** Packaging these documents does not verify the application, implement the upgrade, or approve a museum installation.

Use the master plan for detailed acceptance requirements. For each scenario below, record pass, fail, blocked, or not run; the tested commit/build; the actual method; and an evidence location. An absent result is not a pass.

| Scenario | Required behavior |
|---|---|
| Eligible person lacks photo or film | Person remains reachable in the collection and chronology; honest fallback |
| Selected person found through search | Tile/context remain stable; close restores position and focus |
| Active reading and playback | Accessible extension policy; no unexplained abrupt reset |
| Start over from every state | Fresh visitor baseline without destroying staff settings |
| Provisional relation | Policy determines eligibility explicitly; no accidental factual assertion |
| Same induction year | Shared context label, not implied friendship/collaboration |
| No approved videos anywhere | All three primary scenes remain coherent and useful |
| Approved video fixture | Decodes, progresses, seeks, captions/transcript load, failure is recoverable |
| QR dialog | True modal keyboard behavior, adequate time, correct continuation URL |
| Offline after provisioning | Previously unvisited core content works after restart |
| HTTP error, hang, range, cache failure | Bounded recovery and no broken active package |
| Interrupted or revoked-content update | Coherent rollback or safe withholding; no stale permission bypass |
| Narrow/zoomed/seated/keyboard use | Essential functions have a usable equivalent; physical checks documented |
| Public build artifact | No restricted videos, derivatives, privileged credentials, or staff-only payloads |
| CI and deployment | Test the exact release; failure prevents publication |

## Gallery sign-off remains separate

- [ ] Physical mounting, reach, approach, keyboard/trackpad, and seated-use review documented.
- [ ] Assistive-technology and manual accessibility journeys documented.
- [ ] Curatorial, rights, caption, transcript, and relationship publication decisions reviewed by authorized people.
- [ ] Offline provisioning, restart, failed-update recovery, and rollback demonstrated on the installed system.
- [ ] Actual performance and endurance evidence recorded; proposed targets are not reported as results.
- [ ] Staff can use the runbook and recover the system without developer assistance.
- [ ] Required release gates pass for the exact artifact proposed for deployment.
- [ ] Production deployment explicitly authorized.
