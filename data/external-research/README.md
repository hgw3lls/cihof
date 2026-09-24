# CIHOF External Research Collection

This folder is a separated external-source collection area.

It is not canonical CIHOF content, is not read by the pipeline or the exhibit, and should not be used by either until a curator reviews and promotes specific facts into authored source files.

Excluded primary source domains for this collection:

- `clevelandinternationalhalloffame.com`
- `clevelandpeople.com`

Current collector:

```sh
npm run source:external-research
```

The collector searches Wikipedia, Wikidata, and official-site leads outside the excluded domains. Every collected item is treated as `collected-needs-review`.

Contribution-only cleanup pass:

```sh
npm run source:external-contributions
```

This produces:

- `cihof-external-contribution-candidates.json`
- `cihof-external-contribution-candidates.csv`

The contribution files keep only strong identity-matched Wikipedia/Wikidata records and usable official or institutional external source leads. Loose candidates, source errors, generic directory sites, social/media pages, and empty/no-match records are excluded from the contribution files.

Official-site search failures are tracked separately as source errors. They are not counted as official-site leads unless a usable external URL is collected.

If a run records many `429` source errors from Wikipedia or Wikidata, rerun later with a slower cadence, for example:

```sh
npm run source:external-research -- --delay-ms=1500 --timeout-ms=8000
```
