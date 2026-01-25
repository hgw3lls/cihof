# CIHOF Kiosk App

## Manifest + media expectations

The kiosk loads inductees from the consolidated manifest CSV at `public/cihof_kiosk_manifest.csv`. Media files are expected to live in `public/images/` and `public/videos/`. The loader normalizes Windows/Unix paths and strips prefixes to the `/images/` or `/videos/` portion so kiosk builds can resolve local media correctly.

If the consolidated manifest is missing or fails to load, the app falls back to legacy sources (`public/cihf_inductees.json` and `public/cihf_images/manifest.csv`) to avoid breaking older builds.

**Expected public structure**

```
public/
  cihof_kiosk_manifest.csv
  images/
    <class_year>/
      <safe_name>/
        <hashed>_<filename>
  videos/
    <class_year>/
      <safe_name>/
        <hashed>_<filename>
  cihf_inductees.json
  cihf_images/
    manifest.csv
```

## Mode selection

The kiosk supports three UI options:

- `option1`: Timeline view
- `option2`: Explore view (default)
- `option3`: Cleveland hub map view

Set the mode using the Vite env var or `public/config.json`:

```
VITE_CIHOF_MODE=option1
```

```
public/config.json
{
  "mode": "option1"
}
```

To show a small corner label for the active mode during development, set:

```
VITE_CIHOF_SHOW_MODE=true
```

## Option3 hub map notes

- Region nodes are laid out radially around Cleveland using a deterministic, alphabetical ordering of region labels. The layout computes an angle for each region and places it on a responsive radius derived from the viewport size.
- Region labels are normalized by trimming, collapsing whitespace, and using a lowercase key for matching; the first non-empty label is preserved for display, and empty/odd labels fall back to “Unknown Region.”
