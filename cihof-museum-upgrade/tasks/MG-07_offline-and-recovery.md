# MG-07 — Offline package, safe updates, and recovery

**Goal:** The provisioned gallery system works independently of internet availability and recovers from failed releases.

**Primary files:** `public/sw.js`, worker registration, `vite.config.ts`, packaging/validation scripts, runtime data loading, diagnostics; inspect existing implementations before adding alternatives.

**Changes:** Document two deployment modes: an approved public site and a locally served gallery package. Keep restricted review material isolated from public output. Determine what the installed kiosk must contain versus the staff review workstation; do not ship unnecessary pending payloads merely because they are locally available.

Replace “worker registered” as the readiness definition with a validated inventory of the required core shell, fonts, person data, and portraits/fallbacks. Generate a release manifest with application/data/asset identity and hashes or another documented integrity mechanism. Do not hard-code a manual cache version as the only release identity.

For browser offline support, pre-cache/stage the approved core deliberately. For large gallery films, prefer a verified on-disk package and local server with range support rather than downloading the full archive into a fragile request cache. Select the simpler architecture that meets the actual installation requirements.

Handle network timeouts, non-OK responses, corrupted/missing data, cache-write rejection, and quota problems without discarding a healthy active release. Treat HTTP 206/range requests deliberately: do not blindly pass partial responses into `Cache.put`. Test seek and playback with the worker actually controlling the page. [S7]

Keep application, data, and assets coherent. Stage and validate an update before switching releases; activate at an appropriate idle or staff-approved point rather than disrupting a visitor. Retain a last-known-good rollback, except where revoked rights require material to be withheld. Add a documented revocation/update procedure and do not promise that already-distributed public files can be retroactively erased.

Add readiness diagnostics and recovery actions to existing staff tools where possible. Distinguish “internet offline,” “local server unavailable,” “package incomplete,” and “healthy offline.” Inspect browser/OS startup and watchdog arrangements separately from in-app error handling.

**Tests:** Provision core without manually visiting every record; go offline; restart browser; open previously unvisited people and approved media. Simulate a hanging request, HTTP 500, corrupt data, storage/write failure, valid partial-content request, interrupted update, mixed-version attempt, revoked asset, and rollback. Verify public output contains no rejected payloads, including captions/posters/transcripts associated with blocked media.

**Acceptance:** Core content works after verified provisioning and restart without internet; media ranges/playback are correct; failed updates preserve a coherent usable release; staff can identify and recover failures; no restricted artifact is published.

**Prompt:**

```text
Execute MG-07 only. Implement and test a coherent approved offline
release, with deliberate provisioning, HTTP/range and cache-failure
handling, staged updates, and rollback. Distinguish the public site
from the locally served museum package. Reuse diagnostics and
packaging infrastructure where suitable. Do not deploy or expose
restricted media.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
