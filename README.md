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

The kiosk supports two UI options:

- `option1`: Timeline view
- `option2`: Explore view (default)

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
