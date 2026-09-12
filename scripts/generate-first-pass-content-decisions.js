import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadCuratedMetadata, loadInductees } from './data-utils.js';

const outputPath = resolve('data/curation-decisions/cihof-first-pass-content.csv');
const reportPath = resolve('docs/visitor-content-first-pass-report.md');
const generatedAt = new Date().toISOString();

const baseInductees = loadInductees({ includeCurated: false, includeMedia: false, includePhysicalWall: false });
const currentMetadata = loadCuratedMetadata({ optional: false });
const rows = baseInductees.map((inductee) => buildDecisionRow(inductee, currentMetadata.inductees?.[inductee.id]));
const report = buildReport(rows);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(outputPath, writeCsv(rows));
writeFileSync(reportPath, report);

console.log(`Wrote ${rows.length} first-pass content decision rows to ${outputPath}.`);
console.log(`Wrote first-pass content report to ${reportPath}.`);

function buildDecisionRow(inductee, curated = {}) {
  const bio = cleanBioText(inductee.bioText, inductee.name);
  const approvedSummary = cleanSummary(curated.approvedSummary) || buildSummary(bio, inductee.name);
  const themeTags = firstValues(curated.approvedThemeTags, curated.themeTagCandidates, inductee.themeTags, 3);
  const countryTags = firstValues(curated.approvedCountryTags, curated.countryTagCandidates, inductee.countryTags, 5);
  const communityTags = firstValues(curated.approvedCommunityTags, curated.communityTagCandidates, inductee.communityTags, 4);
  const sourceProfileUrl = inductee.profileUrl;

  return {
    id: inductee.id,
    name: inductee.name,
    class_year: inductee.classYear ?? '',
    source_profile_url: sourceProfileUrl,
    approve_summary: 'yes',
    approved_summary: approvedSummary,
    documented_context_line: buildContextLine(inductee, countryTags, communityTags),
    honored_for_summary: buildHonoredForSummary(themeTags, countryTags),
    life_work_summary: buildLifeWorkSummary(bio, approvedSummary),
    approve_country_tags: countryTags.length > 0 ? 'yes' : '',
    approved_country_tags: countryTags.join('|'),
    country_note: countryTags.length > 0
      ? `First-pass nationality/heritage tags promoted from CIHOF profile text and class/source-page context. Source: ${sourceProfileUrl}`
      : '',
    curator_notes: [
      `First-pass visitor copy generated from CIHOF official profile text on ${generatedAt.slice(0, 10)}.`,
      'Treat CIHOF profile text as the baseline source of truth for this pass.',
      'Media rights, video captions/transcripts, and WRHS archival permissions remain separate review tracks.',
    ].join('|'),
  };
}

function cleanBioText(value, name) {
  let text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  text = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0].trim();
  const escapedName = escapeRegExp(name);
  const firstName = escapeRegExp(name.split(/\s+/)[0] ?? '');
  const lastName = escapeRegExp(name.split(/\s+/).at(-1) ?? '');
  text = text.replace(new RegExp(`^${escapedName}\\s+${escapedName}\\s+`, 'i'), `${name} `);
  const withoutPrefix = text.replace(new RegExp(`^${escapedName}\\s+`, 'i'), '');
  if (new RegExp(`^(?:${firstName}|${lastName}|Mr\\.|Mrs\\.|Ms\\.|Dr\\.|Mayor|Rev\\.|Reverend|Senator|Sister)\\b`, 'i').test(withoutPrefix)) {
    text = withoutPrefix;
  }
  return text.trim();
}

function cleanSummary(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function buildSummary(bio, name) {
  const sentences = splitSentences(bio);
  const summary = takeWords(sentences.slice(0, 2).join(' '), 48);
  return summary || `${name} is a Cleveland International Hall of Fame inductee.`;
}

function buildContextLine(inductee, countryTags, communityTags) {
  const identity = countryTags.length > 0
    ? countryTags.join(', ')
    : communityTags.length > 0
      ? communityTags.join(', ')
      : inductee.region;
  const classLabel = inductee.classYear ? `Class of ${inductee.classYear}` : 'Cleveland International Hall of Fame inductee';
  const inductedBy = inductee.inductedBy ? ` Inducted by ${inductee.inductedBy}.` : '';
  return `${classLabel} honoree connected to ${identity || 'Cleveland international communities'}.${inductedBy}`.trim();
}

function buildHonoredForSummary(themeTags, countryTags) {
  const themes = themeTags.length > 0 ? themeTags : ['civic leadership', 'community service'];
  const community = countryTags.length > 0 ? ` within ${countryTags.slice(0, 2).join(' and ')} heritage communities` : '';
  return `Contributions to ${humanList(themes.map(lowerFirst))}${community} and to Greater Cleveland's multicultural civic life.`;
}

function buildLifeWorkSummary(bio, fallbackSummary) {
  const sentences = splitSentences(bio);
  const text = takeWords(sentences.slice(0, 5).join(' '), 118) || fallbackSummary;
  return ensureTerminalPunctuation(text);
}

function splitSentences(text) {
  const protectedText = String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\b(Mr|Mrs|Ms|Dr|Rev|Fr|St|Lt|Col|Gen|Sen|Prof|Gov|Hon)\./g, '$1<prd>')
    .replace(/\b(Pa|Ohio|Ky|Va|W\.Va|N\.Y|N\.J|D\.C|U\.S|U\.K)\./g, (match) => match.replace(/\./g, '<prd>'))
    .replace(/\b([A-Z])\./g, '$1<prd>');

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((sentence) => sentence.trim())
    .map((sentence) => sentence.replace(/<prd>/g, '.'))
    .filter((sentence) => sentence.length > 20);
}

function takeWords(text, limit) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length <= limit) return ensureTerminalPunctuation(words.join(' '));
  return `${words.slice(0, limit).join(' ').replace(/[,;:]$/, '')}...`;
}

function ensureTerminalPunctuation(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.endsWith('...')) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function firstValues(...args) {
  const limit = args.at(-1);
  const sources = args.slice(0, -1);
  const seen = new Set();
  const values = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const value = String(item ?? '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      values.push(value);
      if (values.length >= limit) return values;
    }
  }
  return values;
}

function humanList(values) {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function lowerFirst(value) {
  return value ? value.toLowerCase() : value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeCsv(records) {
  const headers = [
    'id',
    'name',
    'class_year',
    'source_profile_url',
    'approve_summary',
    'approved_summary',
    'documented_context_line',
    'honored_for_summary',
    'life_work_summary',
    'approve_country_tags',
    'approved_country_tags',
    'country_note',
    'curator_notes',
  ];
  return `${headers.join(',')}\n${records.map((record) => headers.map((header) => csvCell(record[header])).join(',')).join('\n')}\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildReport(records) {
  const withCountryTags = records.filter((row) => row.approved_country_tags).length;
  const lifeWordCounts = records.map((row) => row.life_work_summary.split(/\s+/).filter(Boolean).length);
  const minLifeWords = Math.min(...lifeWordCounts);
  const maxLifeWords = Math.max(...lifeWordCounts);
  const avgLifeWords = Math.round(lifeWordCounts.reduce((sum, count) => sum + count, 0) / Math.max(lifeWordCounts.length, 1));
  const rowsByClass = new Map();
  records.forEach((row) => rowsByClass.set(row.class_year || 'unknown', (rowsByClass.get(row.class_year || 'unknown') ?? 0) + 1));

  return `# Visitor Content First-Pass Report

Generated: ${generatedAt}

## What This Pass Does

This pass promotes CIHOF-owned/source-profile biography material into visitor-facing copy fields for all 111 profiles. It treats the CIHOF profile text as the baseline source of truth for first-pass content management.

It updates:

- approved profile summaries
- documented context lines
- honored-for summaries
- Life + Work overview copy
- first-pass nationality/heritage tags when present in the current CIHOF-derived metadata
- curator notes that keep media rights and archival permissions separate

It does not approve:

- YouTube/video rights
- captions, transcripts, or audio description
- image rights
- WRHS archival display permissions
- final profile approval

## Coverage

- Decision rows: ${records.length}
- Rows with first-pass nationality/heritage tags: ${withCountryTags}
- Life + Work word counts: min ${minLifeWords}, average ${avgLifeWords}, max ${maxLifeWords}

## Class Coverage

${Array.from(rowsByClass.entries()).sort(([a], [b]) => Number(a) - Number(b)).map(([year, count]) => `- ${year}: ${count}`).join('\n')}

## Output

- Decisions CSV: \`${outputPath}\`
- Apply with: \`npm run curate:apply -- --input=${outputPath} --no-backup\`
- Rebuild with: \`npm run build\`

## Review Notes

These decisions intentionally clear the first-pass text/content backlog while leaving legal, accessibility, and archival review visible. Profiles should still receive human curator review before being marked fully approved.
`;
}
