import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync(resolve('data/media_manifest.json'), 'utf8'));
const columns = [
  'id', 'name', 'class_year', 'video_index', 'source_url',
  'video_rights_approved', 'captions_approved', 'transcript_approved',
  'video_kiosk_approved', 'media_notes',
];

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const rows = [columns.join(',')];
for (const [id, record] of Object.entries(manifest.assets ?? {}).sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const [index, video] of (record.videos ?? []).entries()) {
    const row = [id, record.name, record.classYear, index + 1, video.sourceUrl, '', '', '', '', ''];
    rows.push(row.map(csvCell).join(','));
  }
}
const output = process.argv.find((argument) => argument.startsWith('--output='))?.slice('--output='.length);
if (output) writeFileSync(resolve(output), `${rows.join('\n')}\n`);
else process.stdout.write(`${rows.join('\n')}\n`);
