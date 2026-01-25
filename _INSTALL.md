# CIHOF Kiosk App - Installation & Operations

## Requirements

- Node.js 18+ (recommended LTS)
- npm (bundled with Node)

## Development (local)

1. Install dependencies:

```
npm install
```

2. Start the dev server:

```
npm run dev
```

3. Open the kiosk in your browser at the URL shown in the terminal.

## Production build

1. Build the kiosk app:

```
npm run build
```

2. Preview the production build locally:

```
npm run preview
```

## Deployment (static hosting)

1. Run `npm run build` to generate the `dist/` folder.
2. Copy the `dist/` folder to your kiosk machine or static file host.
3. Ensure the `public/` static assets (manifest + media) are bundled into the build output.
   - `public/cihof_kiosk_manifest.csv`
   - `public/images/`
   - `public/videos/`

## Offline-first data + media

The kiosk is designed to be offline-first. Local media always wins:

- If `local_image_paths` contains entries, the UI uses those and skips remote images.
- If `local_video_paths` contains entries, the UI renders `<video>` players and skips remote videos.
- Remote media (URLs or YouTube) is only used when local media is missing.

## Mode configuration

You can switch between the two kiosk modes at build time or runtime:

### Build-time env var (preferred)

```
VITE_CIHOF_MODE=option1 npm run build
```

### Runtime config file

Create `public/config.json` with:

```
{
  "mode": "option2"
}
```

If neither is set, the kiosk defaults to `option2`.

## Media path normalization

The loader normalizes media paths so both Windows and Unix paths resolve inside `public/`:

- `C:\kiosk\images\2020\name\photo.jpg` → `/images/2020/name/photo.jpg`
- `/var/media/videos/2020/name/video.mp4` → `/videos/2020/name/video.mp4`

## Troubleshooting

- **Manifest fails to load:** confirm `public/cihof_kiosk_manifest.csv` exists and is served by the kiosk.
- **Images/videos missing:** verify the `public/images/` and `public/videos/` folders exist in the build output.
- **Wrong mode:** check `VITE_CIHOF_MODE` or `public/config.json` for the correct value (`option1` or `option2`).
