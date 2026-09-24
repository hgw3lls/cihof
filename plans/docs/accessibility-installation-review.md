# Accessibility and installation review

MG-06 is a software implementation and review package, not accessibility
certification. WCAG 2.2 AA is the intended software baseline. Automated scans,
keyboard tests, viewport simulations, and QR decoding are separate evidence layers.

## Implemented software behavior

- QR and admin use native modal dialogs. The background is browser-inert; Tab
  cycles within visible controls; Escape closes only the active dialog; closing
  restores the surviving trigger. Admin initial focus is deliberately sequenced
  after capturing the return target.
- QR contains its own reset action. A kiosk extension warning appears inside the
  modal so its controls remain usable. Ordinary reading is not replaced by QR.
- Skip-to-exhibit, focusable scrolling content, selection-removal focus recovery,
  record-close fallback, film Escape restoration, and a direct connection-list
  link support keyboard journeys. Chronology retains buttons and arrow/Home/End
  navigation as alternatives to dragging.
- Focus indication includes links and programmatically focused headings. Reduced
  motion disables CSS animation/transitions. Masthead rows grow with enlarged text.
- An unknown person link reports an unavailable record and retains collection access.

## QR boundary

The existing canonical destination is the institution's profile website, not
localhost or the un-deployed local exhibit. URLs are restricted to its two known
hostnames, HTTP is upgraded to HTTPS, credentials/ports/staff paths are rejected,
and query/hash state is removed. Historical nested paths and paths without trailing
slashes are preserved. All 111 stored profile paths remain eligible.

An automated test decodes pixels from the rendered QR image. A separate live
check on 2026-09-20 reached Alex Machaskee's public profile with HTTP 200 and the
matching heading. This was a phone-sized Chromium simulation, not a camera scan
on a physical phone and not validation of all 111 remote destinations.

**External release blocker:** the live profile has a 700 CSS-pixel document at a
390-pixel client viewport (14px body text). The earlier innerWidth-only overflow
check was insufficient; client viewport measurements reveal horizontal overflow.
The external site owner must fix mobile reflow, or approve and deploy a tested
public companion route before claiming usable QR continuation for all visitors.
No remote site was changed or deployed during this stage.

## Lower-screen prototype

Staff can open `?kiosk=1&reach=1` on the local exhibit. The complete interface and
dialogs occupy the lower 65% of the viewport, with a 540px minimum operating area.
It preserves the same scenes, discovery, full records, reset, and optional media.
Start over retains this prototype mode. It is not the default and does not replace
physical measurement. On a short screen it uses the available full height.

No physical reach range is implied by the percentage. Evaluate whether a lower
touch region, shelf controller, accessible keyboard/trackball, or a dedicated
accessible station best fits the actual installation. Screen-reader access must
have an institution-supported independent path, not depend on visitors' phones.

## Installation Record

| Required observation | Current result | Owner/action |
|---|---|---|
| Display width, height, diagonal, orientation | Not supplied | Installation team measures |
| Bottom/top edge and control heights above floor | Not supplied | Installation team measures |
| OS scale, resolution, browser zoom | Not supplied | Record on the installed device |
| Touch/keyboard/pointing device and shelf placement | Not supplied | Record input configuration |
| Seated/standing reach across all essential actions | Not tested | Disabled participants and installation team |
| Approach, turning space, knee/toe clearance, obstructions | Not supplied | Onsite accessibility review |
| Glare, ambient lighting, viewing distance, readable type | Not tested | Both themes in actual gallery lighting |
| Independent blind-visitor route and audio privacy | Unresolved | Institution agrees and tests supported AT/input path |
| VoiceOver/NVDA/TalkBack journeys | Not performed | Test names, order, announcements, dialogs, reading and recovery |
| Physical QR camera scan and remote mobile usability | Not performed / external reflow blocker | Real phones and external site owner |

These unresolved observations block installation sign-off. The software work does
not fill in unknown measurements or imply endorsement by an accessibility reviewer.

## Reproducible Evidence

- `CIHOF_PLAYWRIGHT_PORT=4176 npm run test:kiosk`: keyboard/modal/QR tests plus the
  existing visitor regression suite. Axe checks light/dark People, Links, Years,
  full record, and QR; scans do not substitute for assistive-technology testing.
- `npm run mg06:capture`: font-loaded 1920x1080, 960x540, and 320x700 captures in
  both themes, record/reading/QR/Links/Years, enlarged text and lower-screen views.
- `CIHOF_CHECK_PUBLIC_QR=1 npm run mg06:capture`: optional live external phone
  check, recorded separately so network/site failures are not hidden as passes.
- The 960px viewport approximates desktop 200% zoom geometry; an independent
  test doubles computed font sizes. Neither is a physical-browser zoom/AT audit.
- The spatial relationship graph retains a two-dimensional view; its adjacent
  linear connection list and direct list link provide the non-spatial alternative.

Evidence lives in ignored `artifacts/mg06-review/`. Inspect the screenshots as well
as the manifest: an overflow-free document alone does not prove readable content.

## References

The dialog contract follows [WAI's modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Review against [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and its
[reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
Browser target sizes are not physical reach certification.
