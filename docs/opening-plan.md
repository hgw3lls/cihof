# Opening plan

Who does what before the exhibit opens, in what order, and what each step
waits on. It follows `npm run readiness`, which shows where each item stands
(the staff review app's home page shows the same list). Dates are for the
people responsible to fill in; the only fixed length is the five days of
endurance on the display.

Opening day: Saturday 31 October 2026 (provisional)  Approved by: ______________________

## The order, and why

The sign-off sheet is filled in on one release, and names it. So everything
that changes what the display shows is decided first, then one release is
built and installed, then people check it on the display, then someone
approves the opening.

A change to content after that release means a new release. Which sections
of the sheet are then checked again is for the person approving the opening
to decide.

```
1. Decisions and reviews ──► 2. The release ──► 3. Checks on the display ──► 4. Approval to open
   (in parallel)               (developer,        (sign-offs 1–6; endurance
                                administrator)     takes at least five days)
```

## 1. Decisions and reviews (in parallel)

| What | Who | Where | Done by |
| --- | --- | --- | --- |
| **Profiles**: approve each person's profile, words and portrait, as visitors will see it. 111 people; the longest job, so start it first. | Curator | Review app, *Profiles* (class by class) | |
| **Places**: decide the last researched place (East Technical High School); say what the remaining people did at their places (41 of 47 done). Only places within metro Cleveland are kept (not Cleveland itself); the rest were removed on 27 September. | Curator | Review app, *Places* | |
| **Attract screen words** | Curator | Review app, *Attract screen words* | |
| **Where ceremony films start** for the 6 people who share the 2024 ceremony film | Curator | Review app, *Where ceremony films start* | |
| **Caption and transcript noise**: what to do with music heard as "heat", the blank-audio marks, misheard names | Curator | Review app, *Film captions and transcripts*; `docs/film-transcript-check.md` | |
| **Audio description** for the 93 films | Accessibility reviewer and curator | `data/media_manifest.json`; record the decision in the review app, *Sign-offs* | |
| **The changed logo** | Cleveland International Hall of Fame | `docs/brand/skyline-guidelines.md` | |
| **The public website**: whether it goes live, and at what lasting address. Until it does, the display offers no take-home codes. | Cleveland International Hall of Fame | `plans/docs/CLEAN_APP_PLAN.md` §5.1 | |

The connections are all decided (29 of 29).

A decision is recorded in the review app when it is made, with who made it.
A sign-off is accepted in the review app, under *Sign-offs*, by the person
responsible, under their own name.

## 2. The release (after every decision in 1)

| What | Who | Where | Done by |
| --- | --- | --- | --- |
| Build the installer. Check its summary: **93 of 93 films** have their video, and note "profiles approved". Play every film (`npm run films:check`) and run both endurance runs; hand over their reports. | Developer | Windows checklist A (about an hour, plus the runs) | |
| Install and check the display PC | Administrator | Windows checklist B (about two hours) | |
| Set up the office PC for the review app | Developer, then a member of staff | Windows checklist C (about 30 minutes) | |

## 3. Checks on the display (on the installed release)

| What | Who | Where | Done by |
| --- | --- | --- | --- |
| Sign-off 1: the installation (reach, floor space, fixings) | Installation team | `docs/sign-off.md` §1 | |
| Sign-off 2: touch and reading in the gallery | Installation team | §2 | |
| Sign-off 3: accessibility, with disabled visitors where possible. Needs 1 and 2, and the audio description decision. | Accessibility reviewer | §3 | |
| Sign-off 4: endurance. **At least five days**, including a weekend and a nightly restart, with the endurance reports. Start it as soon as the release is installed. | Administrator | §4 | |
| Sign-off 5: content, looked at on the display itself | Curator | §5 | |
| Sign-off 6: rights, for every portrait and film shown | Rights and reproductions | §6 | |

These can run alongside the endurance days, but the display must be left
running as it will be in the gallery while they do.

## 4. Approval to open

All six sections signed, every exception listed with who accepted it
(`docs/sign-off.md`, *Approval to open*). The person who approves the
opening accepts it in the review app's *Sign-offs*; the app offers it only
once sections 1 to 6 are accepted. Then `npm run readiness -- --strict`
passes.

## Working back from opening day

| Step | At the latest | Date |
| --- | --- | --- |
| Approval to open | Before opening | Thursday 29 October |
| Endurance begins | Five days (with a weekend) before approval | Tuesday 20 October |
| Release installed on the display PC | Before endurance begins | Monday 19 October |
| Release built | Before it is installed | Friday 16 October |
| Every decision in 1 made | Before the release is built | Thursday 15 October |

These dates work back from a provisional opening on Saturday 31 October,
with a little room at each step:

- **Friday 30 October** is left free, for anything the approval turns up.
- **Endurance** runs from Tuesday 20 to Tuesday 27 October: more than the
  five days, through the weekend of 24 and 25 October. Wednesday 28 is for
  the endurance sign-off and gathering the sheet. Sign-offs 1, 2, 3, 5 and 6
  are done on the display during the same days.
- **The release** is built on the Friday and installed on the Monday, so
  there is a weekend to hand it over, and a day in hand if the build needs
  doing again.
- **Every decision** is made the day before the build. From late September
  that leaves under three weeks for the curator, including all 111 profiles,
  so the profiles need to start straight away.

If the opening day moves, move every date by the same number of days, and
keep a weekend inside the endurance days.
