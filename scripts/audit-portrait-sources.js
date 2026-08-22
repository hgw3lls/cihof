import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve('data/media_manifest.json');
const jsonOutputPath = resolve('public/data/portrait-source-audit.json');
const csvOutputPath = resolve('public/data/portrait-source-audit.csv');
const htmlOutputPath = resolve('public/portrait-audit.html');
const targetAspectRatio = 4 / 5;

if (!existsSync(manifestPath)) {
  console.error(`${manifestPath} was not found. Run npm run media:manifest and npm run media:localize first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const assets = manifest?.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)
  ? manifest.assets
  : {};

const records = Object.entries(assets)
  .map(([id, record]) => auditRecord(id, record))
  .sort((a, b) => (a.classYear ?? 9999) - (b.classYear ?? 9999) || a.name.localeCompare(b.name));
const summary = summarizeRecords(records);
const document = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    generator: 'scripts/audit-portrait-sources.js',
    mediaManifest: 'data/media_manifest.json',
    note: 'Audits localized primary portrait sources and their generated display derivatives. Original images are not modified.',
  },
  processingGuidance: {
    targetAspectRatio: '4:5',
    defaultMode: 'cover crop for normal portrait ratios',
    atypicalMode: 'neutral matte fit for very wide or very tall source images',
    colorPolicy: 'No color, tone, smoothing, face retouching, or generative alteration is applied by the portrait preparation script.',
    manualReview: 'Low-resolution, wide, tall, missing, and rights-pending records should be reviewed before permanent installation.',
  },
  summary,
  records,
};

mkdirSync(dirname(jsonOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(document, null, 2)}\n`);
writeFileSync(csvOutputPath, `${toCsv(records)}\n`);
writeFileSync(htmlOutputPath, htmlDocument());

console.log(
  `Portrait source audit: ${summary.total} records, ${summary.lowResolution} low resolution, ` +
    `${summary.usableButSmall} usable-but-small, ${summary.matteFit} matte fit, ${summary.missingSource} missing source.`,
);
console.log(`Wrote ${jsonOutputPath}`);
console.log(`Wrote ${csvOutputPath}`);
console.log(`Wrote ${htmlOutputPath}`);

function auditRecord(id, record) {
  const primary = record?.images?.primary ?? {};
  const sourceFile = findSourceFile(primary);
  const sourceStats = sourceFile ? statSync(sourceFile) : null;
  const dimensions = sourceFile ? identifyDimensions(sourceFile, primary) : { width: 0, height: 0 };
  const treatment = portraitTreatment(dimensions.width, dimensions.height);
  const portraits = record?.images?.portraits && typeof record.images.portraits === 'object' ? record.images.portraits : {};

  return {
    id,
    name: cleanString(record?.name) || id,
    classYear: Number.isInteger(record?.classYear) ? record.classYear : null,
    rightsStatus: cleanString(primary?.rightsStatus) || 'unknown',
    approvedForKiosk: Boolean(primary?.approvedForKiosk),
    source: {
      filePath: sourceFile ? relativeRepoPath(sourceFile) : cleanString(primary?.filePath),
      runtimePath: cleanString(primary?.runtimePath),
      sourceUrl: cleanString(primary?.sourceUrl),
      width: dimensions.width,
      height: dimensions.height,
      normalResolution: dimensions.width && dimensions.height ? `${dimensions.width} x ${dimensions.height}` : 'unknown',
      shortestSide: Math.min(dimensions.width || 0, dimensions.height || 0),
      aspectRatio: treatment.aspectRatio,
      fileSizeBytes: sourceStats?.size ?? 0,
      fileSizeLabel: sourceStats ? formatBytes(sourceStats.size) : 'unknown',
      qualityLabel: qualityLabel(dimensions.width, dimensions.height),
    },
    derivatives: {
      wall: derivativeSummary(portraits.wall),
      profile: derivativeSummary(portraits.profile),
      thumbnail: derivativeSummary(portraits.thumbnail),
    },
    treatment,
  };
}

function derivativeSummary(asset) {
  if (!asset || typeof asset !== 'object') return null;
  return {
    runtimePath: cleanString(asset.runtimePath),
    width: Number.isInteger(asset.width) ? asset.width : 0,
    height: Number.isInteger(asset.height) ? asset.height : 0,
    fitMode: cleanString(asset.fitMode),
    displayTreatment: cleanString(asset.displayTreatment),
  };
}

function findSourceFile(asset) {
  const candidates = [
    cleanString(asset?.filePath),
    asset?.runtimePath ? `public/${String(asset.runtimePath).replace(/^\/+/, '')}` : '',
    asset?.sourceUrl?.startsWith('/media/') ? `public/${String(asset.sourceUrl).replace(/^\/+/, '')}` : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const absolutePath = resolve(candidate);
    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) return absolutePath;
  }

  return '';
}

function identifyDimensions(filePath, fallbackAsset) {
  try {
    const output = execFileSync('magick', ['identify', '-format', '%w %h', filePath], { encoding: 'utf8' }).trim();
    const [width, height] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));
    if (Number.isInteger(width) && Number.isInteger(height)) return { width, height };
  } catch {
    // Fall through to manifest dimensions.
  }

  return {
    width: Number.isInteger(fallbackAsset?.width) ? fallbackAsset.width : 0,
    height: Number.isInteger(fallbackAsset?.height) ? fallbackAsset.height : 0,
  };
}

function portraitTreatment(width, height) {
  const aspectRatio = width > 0 && height > 0 ? width / height : 0;
  const reviewFlags = [];

  if (!aspectRatio) reviewFlags.push('missing-source');
  if (aspectRatio > 1.35) reviewFlags.push('wide-source');
  if (aspectRatio > 0 && aspectRatio < 0.58) reviewFlags.push('tall-source');

  const shortestSide = Math.min(width || 0, height || 0);
  if (shortestSide > 0 && shortestSide < 300) reviewFlags.push('low-resolution-source');
  else if (shortestSide >= 300 && shortestSide < 520) reviewFlags.push('usable-but-small-source');

  const fitMode = reviewFlags.includes('wide-source') || reviewFlags.includes('tall-source') ? 'contain' : 'cover';
  return {
    aspectRatio: aspectRatio ? Number(aspectRatio.toFixed(3)) : 0,
    targetAspectRatio: Number(targetAspectRatio.toFixed(3)),
    fitMode,
    reviewFlags,
    reviewRecommendation: recommendationForTreatment(reviewFlags, fitMode),
  };
}

function recommendationForTreatment(reviewFlags, fitMode) {
  if (reviewFlags.includes('missing-source')) return 'Find or localize a source image before installation.';
  if (reviewFlags.includes('low-resolution-source')) return 'Replace with a higher-resolution portrait before permanent installation if possible.';
  if (fitMode === 'contain') return 'Use neutral matte fit to avoid over-cropping; review for a custom curator-approved crop or replacement portrait.';
  if (reviewFlags.includes('usable-but-small-source')) return 'Usable for prototype display; prioritize a higher-resolution source for final installation.';
  return 'Use generated display crops unless curator review identifies a better focal crop.';
}

function qualityLabel(width, height) {
  const shortestSide = Math.min(width || 0, height || 0);
  if (shortestSide >= 900) return 'high-resolution-source';
  if (shortestSide >= 520) return 'standard-source';
  if (shortestSide >= 300) return 'usable-source';
  if (shortestSide > 0) return 'low-resolution-source';
  return 'missing-source';
}

function summarizeRecords(items) {
  return {
    total: items.length,
    missingSource: items.filter((item) => item.treatment.reviewFlags.includes('missing-source')).length,
    lowResolution: items.filter((item) => item.treatment.reviewFlags.includes('low-resolution-source')).length,
    usableButSmall: items.filter((item) => item.treatment.reviewFlags.includes('usable-but-small-source')).length,
    matteFit: items.filter((item) => item.treatment.fitMode === 'contain').length,
    coverCrop: items.filter((item) => item.treatment.fitMode === 'cover').length,
    rightsApproved: items.filter((item) => item.approvedForKiosk || item.rightsStatus === 'approved').length,
    rightsPending: items.filter((item) => !(item.approvedForKiosk || item.rightsStatus === 'approved')).length,
    qualityLabels: countBy(items.map((item) => item.source.qualityLabel)),
  };
}

function countBy(values) {
  return values.reduce((summary, value) => {
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
}

function toCsv(items) {
  const columns = [
    'id',
    'name',
    'classYear',
    'sourceRuntimePath',
    'sourceWidth',
    'sourceHeight',
    'normalResolution',
    'shortestSide',
    'aspectRatio',
    'fileSizeBytes',
    'fileSizeLabel',
    'qualityLabel',
    'fitMode',
    'reviewFlags',
    'reviewRecommendation',
    'rightsStatus',
    'approvedForKiosk',
  ];
  const rows = items.map((item) => [
    item.id,
    item.name,
    item.classYear ?? '',
    item.source.runtimePath,
    item.source.width,
    item.source.height,
    item.source.normalResolution,
    item.source.shortestSide,
    item.source.aspectRatio,
    item.source.fileSizeBytes,
    item.source.fileSizeLabel,
    item.source.qualityLabel,
    item.treatment.fitMode,
    item.treatment.reviewFlags.join('|'),
    item.treatment.reviewRecommendation,
    item.rightsStatus,
    item.approvedForKiosk ? 'yes' : 'no',
  ]);

  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function htmlDocument() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CIHOF Portrait Source Audit</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #10151f;
      --paper: #efe3c7;
      --line: #171b21;
      --red: #e63f27;
      --gold: #c39024;
      --muted: #59616a;
      --field: #f8edcf;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0b1018;
      color: var(--ink);
      font-family: Arial, sans-serif;
    }
    .page {
      min-height: 100vh;
      padding: 28px;
      background:
        radial-gradient(circle at 1px 1px, rgba(16, 21, 31, 0.14) 0 1px, transparent 1.2px) 0 0 / 12px 12px,
        var(--paper);
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      border: 3px solid var(--line);
      background: var(--field);
      padding: 24px;
      box-shadow: 8px 8px 0 rgba(230, 63, 39, 0.22);
    }
    h1 {
      margin: 0;
      font-family: Impact, "Arial Black", sans-serif;
      font-size: clamp(3rem, 8vw, 7rem);
      line-height: 0.86;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .kicker, .card h2, .meta strong, button, select, input {
      font-family: Impact, "Arial Black", sans-serif;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .kicker {
      margin: 0 0 8px;
      color: var(--red);
      font-size: 0.9rem;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      gap: 10px;
      min-width: min(640px, 100%);
    }
    .summary span {
      border: 2px solid var(--line);
      padding: 10px;
      background: #fff8e7;
    }
    .summary strong {
      display: block;
      font-size: 1.6rem;
    }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(180px, 260px));
      gap: 12px;
      margin: 22px 0;
    }
    input, select {
      width: 100%;
      min-height: 52px;
      border: 3px solid var(--line);
      background: #fff8e7;
      color: var(--ink);
      padding: 0 14px;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 18px;
    }
    .card {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 16px;
      border: 3px solid var(--line);
      background: rgba(255, 248, 231, 0.82);
      padding: 14px;
      box-shadow: 5px 5px 0 rgba(16, 21, 31, 0.14);
    }
    .source {
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .source img {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: contain;
      background: var(--line);
      border: 2px solid var(--line);
    }
    .card h2 {
      margin: 0;
      font-size: 1.55rem;
      line-height: 0.95;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin: 10px 0;
    }
    .meta span, .flags span, .recommendation {
      border: 1px solid rgba(16, 21, 31, 0.34);
      background: rgba(255, 248, 231, 0.7);
      padding: 6px 8px;
    }
    .meta strong {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
    }
    .flags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }
    .flags span {
      color: var(--red);
      font-family: Impact, "Arial Black", sans-serif;
      font-size: 0.72rem;
      text-transform: uppercase;
    }
    .recommendation {
      margin: 8px 0;
      color: #333;
      font-size: 0.88rem;
      line-height: 1.35;
    }
    .variants {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .variant {
      display: grid;
      gap: 4px;
      min-width: 0;
      font-size: 0.72rem;
      text-transform: uppercase;
    }
    .variant img {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: cover;
      border: 2px solid var(--line);
      background: var(--paper);
    }
    a {
      color: var(--red);
      font-weight: 800;
      text-transform: uppercase;
    }
    .empty {
      border: 3px solid var(--line);
      padding: 24px;
      background: #fff8e7;
      font-family: Impact, "Arial Black", sans-serif;
      text-transform: uppercase;
    }
    @media (max-width: 820px) {
      .page { padding: 12px; }
      header, .toolbar, .card { grid-template-columns: 1fr; }
      .summary { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <p class="kicker">Western Reserve Historical Society / Staff Audit</p>
        <h1>Portrait Source Audit</h1>
      </div>
      <div class="summary" id="summary" aria-label="Audit summary"></div>
    </header>
    <section class="toolbar" aria-label="Audit controls">
      <input id="search" type="search" placeholder="Search name, year, flag, recommendation" />
      <select id="filter">
        <option value="all">All portraits</option>
        <option value="low">Low resolution</option>
        <option value="small">Usable but small</option>
        <option value="matte">Matte fit</option>
        <option value="rights">Rights pending</option>
      </select>
      <select id="sort">
        <option value="year">Sort by year</option>
        <option value="name">Sort by name</option>
        <option value="shortest">Sort by resolution</option>
        <option value="ratio">Sort by aspect ratio</option>
      </select>
    </section>
    <section class="grid" id="grid" aria-label="Portrait audit records"></section>
  </main>
  <script>
    const state = { records: [], query: '', filter: 'all', sort: 'year' };

    fetch('data/portrait-source-audit.json')
      .then((response) => response.json())
      .then((audit) => {
        state.records = audit.records || [];
        renderSummary(audit.summary || {});
        render();
      })
      .catch((error) => {
        document.getElementById('grid').innerHTML = '<div class="empty">Audit could not be loaded: ' + escapeHtml(error.message) + '</div>';
      });

    document.getElementById('search').addEventListener('input', (event) => {
      state.query = event.target.value.toLowerCase();
      render();
    });
    document.getElementById('filter').addEventListener('change', (event) => {
      state.filter = event.target.value;
      render();
    });
    document.getElementById('sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      render();
    });

    function renderSummary(summary) {
      const items = [
        ['Records', summary.total || 0],
        ['Low Res', summary.lowResolution || 0],
        ['Small', summary.usableButSmall || 0],
        ['Matte Fit', summary.matteFit || 0],
      ];
      document.getElementById('summary').innerHTML = items.map(([label, value]) => '<span><strong>' + value + '</strong>' + label + '</span>').join('');
    }

    function render() {
      const grid = document.getElementById('grid');
      const records = state.records.filter(matchesFilter).sort(compareRecords);
      grid.innerHTML = records.length ? records.map(cardHtml).join('') : '<div class="empty">No portraits match this audit filter.</div>';
    }

    function matchesFilter(record) {
      const flags = record.treatment.reviewFlags || [];
      if (state.filter === 'low' && !flags.includes('low-resolution-source')) return false;
      if (state.filter === 'small' && !flags.includes('usable-but-small-source')) return false;
      if (state.filter === 'matte' && record.treatment.fitMode !== 'contain') return false;
      if (state.filter === 'rights' && (record.approvedForKiosk || record.rightsStatus === 'approved')) return false;
      if (!state.query) return true;
      const haystack = [
        record.name,
        record.classYear,
        record.source.normalResolution,
        record.source.qualityLabel,
        record.treatment.fitMode,
        record.treatment.reviewRecommendation,
        ...(record.treatment.reviewFlags || []),
      ].join(' ').toLowerCase();
      return haystack.includes(state.query);
    }

    function compareRecords(a, b) {
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      if (state.sort === 'shortest') return (a.source.shortestSide || 0) - (b.source.shortestSide || 0) || a.name.localeCompare(b.name);
      if (state.sort === 'ratio') return (a.source.aspectRatio || 0) - (b.source.aspectRatio || 0) || a.name.localeCompare(b.name);
      return (a.classYear || 9999) - (b.classYear || 9999) || a.name.localeCompare(b.name);
    }

    function cardHtml(record) {
      const flags = record.treatment.reviewFlags && record.treatment.reviewFlags.length
        ? record.treatment.reviewFlags.map((flag) => '<span>' + escapeHtml(flag) + '</span>').join('')
        : '<span>display-ready</span>';
      return '<article class="card">' +
        '<figure class="source">' +
          imageTag(record.source.runtimePath, record.name + ' source portrait') +
          '<figcaption><a href="' + imagePath(record.source.runtimePath) + '" target="_blank" rel="noreferrer">Open source</a></figcaption>' +
        '</figure>' +
        '<div>' +
          '<p class="kicker">' + escapeHtml(record.classYear ? 'Class of ' + record.classYear : 'Year unknown') + '</p>' +
          '<h2>' + escapeHtml(record.name) + '</h2>' +
          '<div class="meta">' +
            meta('Native resolution', record.source.normalResolution) +
            meta('File size', record.source.fileSizeLabel) +
            meta('Quality', record.source.qualityLabel) +
            meta('Treatment', record.treatment.fitMode) +
            meta('Rights', record.rightsStatus) +
            meta('Kiosk approved', record.approvedForKiosk ? 'yes' : 'no') +
          '</div>' +
          '<div class="flags">' + flags + '</div>' +
          '<p class="recommendation">' + escapeHtml(record.treatment.reviewRecommendation) + '</p>' +
          '<div class="variants">' +
            variant('Wall', record.derivatives.wall) +
            variant('Profile', record.derivatives.profile) +
            variant('Thumb', record.derivatives.thumbnail) +
          '</div>' +
        '</div>' +
      '</article>';
    }

    function meta(label, value) {
      return '<span><strong>' + escapeHtml(label) + '</strong>' + escapeHtml(value || 'unknown') + '</span>';
    }

    function variant(label, asset) {
      if (!asset || !asset.runtimePath) return '<span class="variant">' + label + '<span>Missing</span></span>';
      return '<span class="variant">' + imageTag(asset.runtimePath, label + ' derivative') + '<span>' + label + ' / ' + escapeHtml(asset.width + ' x ' + asset.height) + '</span></span>';
    }

    function imageTag(path, alt) {
      return '<img src="' + imagePath(path) + '" alt="' + escapeHtml(alt) + '" loading="lazy" />';
    }

    function imagePath(path) {
      return String(path || '').replace(/^\\/+/, '');
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }
  </script>
</body>
</html>
`;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function relativeRepoPath(filePath) {
  return filePath.replace(`${process.cwd()}/`, '');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
