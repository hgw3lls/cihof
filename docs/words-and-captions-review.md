# Two sheets for a curator: the exhibit's own words, and suspect captions

Drafted 17 November 2026. Nothing in either sheet has been applied: every row
waits for somebody to decide it.

## The exhibit's own words

`data/review-sheets/interface-words-sheet.csv`

The words the exhibit says in its own voice, outside anybody's biography, read
for stock phrasing, padding and lines that tell a visitor how to feel. There
was little of it. The sheet proposes 11 changes: the attract tagline, one line
on the compare card, five tour descriptions, and four spellings where the
exhibit wrote British English beside its American "Honored for".

Each row gives the words now, the proposal and why. Write `accept`, `reject`
or your own wording in **decision**.

- **Approved words** (the attract tagline, the tour descriptions) go back
  through the staff review app (Attract words; Tours, Edit this tour) or
  `npm run text:apply` / `npm run tours:apply`. Once changed, they are held
  back from the display until they are approved again.
- **The exhibit's code wording** (the compare card, How this works, two
  screen-reader labels) is changed by the developer once decided. No approval
  changes.

Left alone: the About words (the Hall's own, from its website), the
biographies and the story sections (each person's profile, with its own
approval), and the tour names.

## Captions and transcripts to listen to

`data/review-sheets/caption-suspects-sheet.csv`

A search of all 93 films' captions and transcripts, after the September
fixes, for what automatic captions get wrong. It can only point. Nobody has
listened, so nothing in it is a correction yet.

| kind | rows | what |
| --- | ---: | --- |
| name | 53 | A word close to a name in the records but not it ("Demissie" for Demessie, "Malloy" for Mulloy), or a person's own surname that never appears in their film at all |
| repeat | 15 | The same word three or more times in a row: a speaker's stammer, which is right, or captions stuck |
| noise | 1 | Branka Malinar's film: a run of "Oh, yeah. Yeah. Yeah." left where music played once "heat" was removed |

Rows give the film, the person, the time in the film where there is one, and
a suggestion where the records make one plain. The six 2024 inductees who
share the ceremony film share its rows.

For each row: play the film at that time, write what was said in **heard**,
and `fix` or `leave` in **decision**. The rows marked `fix` then go into the
staff review app's **Film captions and transcripts** screen, or a
`npm run films:captions:apply` sheet with fix `phrase`, which records each
correction with who decided and when. A surname that is missing because the
film never says it needs no fix.
