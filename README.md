# CIHOF Timeline View

## Local image strategy

This app only uses local images listed in `cihf_images/manifest.csv`. To make the `saved_path` values resolvable in a kiosk build, copy the full `cihf_images/` folder into the Vite `public/` directory (or configure your static file host to serve the folder from the site root). The data loader normalizes `saved_path` entries so that any path containing `cihf_images/` is converted into a `/cihf_images/...` URL.

**Expected public structure**

```
public/
  cihf_images/
    <class_year>/
      <safe_name>/
        <hashed>_<filename>
    manifest.csv
```

The JSON file `cihf_inductees.json` should also live in `public/` so it can be loaded via `/cihf_inductees.json`.
