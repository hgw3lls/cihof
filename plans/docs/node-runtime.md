# The pinned Node runtime

`.nvmrc` pins Node 22. Use nvm, which is already installed:

```sh
nvm use          # or: nvm install, the first time
```

That installs an official prebuilt Node from nodejs.org, checksum-verified, and
is what `cihof-city-experience/ACCEPTANCE_TESTS.md` means by `nvm use` at the
top of the command baseline.

## Do not use Homebrew's node@22 for this

Homebrew's `node@22` links against Homebrew's `simdutf`. On 2026-09-21 a
`simdutf` upgrade from 9.1.0 to 9.2.0 changed that library's soname from
`libsimdutf.35` to `.36`, which broke **both** installed runtimes at once:

- `node@22` 22.22.3 wanted `libsimdutf.34.dylib` — gone
- `node` 26.8.1 reaches it through `merve`, which wanted `.35` — gone

Neither could start. A `brew reinstall simdutf node@22` then compiled Node from
source for roughly 80 minutes, failed, and rolled back to the same broken
22.22.3. This machine is an Intel Mac, which Homebrew has moved to Tier 3 and
no longer builds bottles for, so anything not already bottled is a source
build.

What actually fixed each one:

| Runtime | Fix | Cost |
|---|---|---|
| Node 26 | `brew reinstall merve` — relinks it against simdutf 9.2.0 | 19 seconds |
| Node 22 | `nvm install` — an official binary with no Homebrew dependency | under a minute |

The lesson worth keeping: a runtime the project depends on should not be
reachable only through a package manager that can rebuild its dependencies
underneath it. nvm's Node is self-contained, so a Homebrew upgrade cannot break
the runtime this repository pins.

## Verified on Node 22.23.2

Recorded 2026-09-21, the first time the rewrite ran on the pinned runtime.

| Check | Result |
|---|---|
| `packages/content` | 25 passed |
| `packages/pipeline` | 11 passed |
| `apps/exhibit` unit | 21 passed |
| `apps/exhibit` browser | 22 passed |
| `apps/web` browser | 5 passed |
| `apps/web` build | 112 pages |
| `apps/exhibit` build | release of 115 assets |
| Content revision, Node 22 vs Node 26 | identical (`c723000855c252316f038e8989d70a82`) |

That last row matters beyond this fix: the revision identifies the content, not
the machine that built it, so two builds of the same sources agree across
runtimes and a device can tell a new release from the same one rebuilt.
