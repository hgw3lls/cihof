import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadInductees } from './data-utils.js';

const metadataPath = resolve('data/cihof_curated_metadata.json');
const reportPath = resolve('artifacts/story-summary-draft-sync-report.json');
const markdownPath = resolve('docs/story-summary-draft-sync-report.md');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const generatedAt = new Date().toISOString();
const inducteesById = new Map(loadInductees({ includeMedia: false, includePhysicalWall: false }).map((person) => [person.id, person]));
const summaryPolishOverrides = Object.freeze({
  'dr-dieu-thuc-do-2010': "Dr. Dieu Thuc Do brought medical training, military service, and civic leadership from Vietnam to Cleveland, where he practiced medicine and supported Vietnamese community life.",
  'lonnie-mccauley-2010': "Lonnie McCauley promoted Irish culture and history in Cleveland through library research, community leadership, Irish American organizations, and public heritage projects.",
  'robert-j-haas-2010': "Robert J. Haas combined Berea public safety work, German cultural leadership, and community organizing through decades of police service, festivals, and civic involvement.",
  'luis-martinez-2011': "Luis Martinez linked military service, education, and Puerto Rican civic leadership through work in recruitment, training, community programs, and Cleveland public service.",
  'ralph-j-perk-2011': "Ralph J. Perk served as Cleveland's mayor after city and county office, becoming known for human-rights advocacy, Czech heritage pride, and anti-totalitarian civic leadership.",
  'reverend-dr-otis-moss-jr-2011': "Rev. Dr. Otis Moss Jr. became a nationally influential pastor, theologian, and civil-rights leader through ministry, education, and civic leadership in Cleveland and beyond.",
  'vijaya-l-emani-2011': "Vijaya L. Emani turned engineering, entrepreneurship, and personal resilience into community leadership, mentoring, advocacy, and service within Cleveland's Indian American community.",
  'anthony-yen-yan-yuan-tai-2012': "Anthony Yen advanced international business and trade through World Trade Center Cleveland work, export-development leadership, and decades of service linking Chinese and American business communities.",
  'jose-c-feliciano-2012': "Jose C. Feliciano made history in Cleveland law and public service, becoming the city's first Hispanic public official and a leader in civic, legal, and business circles.",
  'ken-kovach-2012': "Ken Kovach built a professional practice in human resources, organization development, coaching, and leadership training while supporting Russian, Hungarian, and broader civic communities.",
  'jack-coyne-2013': "Jack Coyne combined law, military service, parking-industry leadership, and philanthropy, supporting Irish heritage, education, and civic organizations across Greater Cleveland.",
  'donna-hom-2014': "Donna Hom built a Chinese restaurant business with her family and became a visible supporter of Chinese heritage, entrepreneurship, and community life in Cleveland.",
  'eugene-bak-2014': "Eugene Bak carried a Polish refugee story into Cleveland civic life, building business ventures while preserving memory, culture, and immigrant experience through community service.",
  'jim-foster-2014': "Jim Foster expanded The City Club of Cleveland's programming, broadcasts, student forums, and civic reach, strengthening public dialogue and education in the region.",
  'margaret-callander-2014': "Margaret Callander taught and promoted Scottish Highland dance for generations, preserving Scottish culture through performance, adjudication, instruction, and community leadership in Cleveland.",
  'thomas-j-scanlon-2014': "Thomas J. Scanlon built a long legal career in real estate and nonprofit work while supporting Irish heritage, education, arts, and civic institutions.",
  'shiv-k-aggarwal-2015': "Shiv K. Aggarwal linked social work, business education, real estate, and civic service, becoming a leader in Cleveland's Indian community and broader nonprofit life.",
  'jack-kahl-2016': "Jack Kahl built Manco and Duck brand duct tape into a global business while championing employee-centered management, entrepreneurship, and Cleveland civic causes.",
  'basil-russo-2017': "Basil Russo combined law, business, and Italian American cultural leadership, strengthening the Order Italian Sons and Daughters of America and broader Cleveland civic life.",
  'sam-kim-2017': "Sam Kim brought military service, skilled trade, and entrepreneurship from Korea to Northeast Ohio, building businesses while serving Cleveland's Korean American community.",
  'ralph-perk-jr-2018': "Ralph Perk Jr. carried a family legacy of public service into law, education, and civic leadership, supporting Czech and Italian heritage communities.",
  'marilyn-madigan-2019': "Marilyn Madigan strengthened Irish heritage in Cleveland through parish advocacy, cultural leadership, health-related service, and education rooted in the West Park community.",
  'margaret-lynch-2020': "Margaret Lynch preserved and interpreted Cleveland's Irish history through archives, talks, walking tours, public programs, and leadership with the Irish American Archives Society.",
  'ramesh-shah-2020': "Ramesh Shah organized medical missions, education projects, and humanitarian support across multiple countries, linking Indian community leadership with practical service to people in need.",
  'anda-cook-2022': "Anda Cook carried Latvian refugee experience into a life of cultural preservation, civic leadership, education, and service to Cleveland's Latvian community.",
  'carl-robson-2022': "Dr. Carl Robson devoted decades to family medicine in underserved Cleveland neighborhoods while building ties with Ethiopian communities through health, education, and cultural service.",
  'taras-szmagala-2022': "Taras Szmagala preserved Ukrainian American history through education, civic advocacy, and cultural leadership, helping sustain Cleveland's Ukrainian Museum-Archives and community memory.",
  'pierre-bejjani-2023': "Pierre Bejjani used journalism, advertising, and civic leadership to promote Middle Eastern culture, diversity, and Lebanese community visibility in Northeast Ohio.",
  'ambassador-edward-f-crawford-2024': "Ambassador Edward F. Crawford built major manufacturing and logistics businesses while supporting education, Irish heritage, civic leadership, and international service.",
  'dr-eugene-jordan-2024': "Dr. Eugene Jordan expanded access to dental care in Cleveland and East Cleveland while mentoring students, leading professional organizations, and supporting African American community advancement.",
  'erika-puussaar-2024': "Erika Puussaar carried Estonian refugee experience into education, faith-based service, and cultural diplomacy, strengthening Estonian heritage connections in Cleveland.",
  'veronica-dahlberg-2024': "Veronica Dahlberg became an advocate for immigrant families, community organizing, and Mexican American civic life, grounding her work in family history and neighborhood service.",
  'beverly-kerecman-2025': "Beverly Kerecman connected Japanese American history, education, and faith-based service, sharing family internment history while supporting cultural understanding and community learning.",
  'lucy-torres-2026': "Lucy Torres built a life of Puerto Rican community leadership through nursing, education, advocacy, cultural work, and service to families across Cleveland.",
});

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const records = metadata.inductees ?? {};
const polishedRecords = Object.entries(records)
  .map(([id, record]) => buildPolishRecord(id, record))
  .filter(Boolean);

const updatedMetadata = JSON.parse(JSON.stringify(metadata));
polishedRecords.forEach((polish) => {
  const record = updatedMetadata.inductees[polish.id];
  record.summaryDraft = polish.afterSummary;
  record.approvedSummary = polish.afterSummary;
  record.curatorNotes = Array.from(new Set([
    ...(Array.isArray(record.curatorNotes) ? record.curatorNotes : []),
    polish.action === 'curated-polish'
      ? `Story summary polished from existing CIHOF profile text on ${generatedAt.slice(0, 10)}; factual approval remains separate.`
      : `Story summary draft synced to approved summary on ${generatedAt.slice(0, 10)}; public approved summary unchanged.`,
  ]));
});

const report = {
  schemaVersion: 1,
  generatedAt,
  dryRun,
  source: {
    updatedFile: 'data/cihof_curated_metadata.json',
    basis: 'Applies curated local rewrites to known optional-polish story summaries, then synchronizes draft and approved summary fields.',
    excluded: ['data/external-research/*'],
    note: 'This clears optional story-summary polish from local CIHOF profile material. It does not mark factual approval complete.',
  },
  summary: {
    polishedRecords: polishedRecords.length,
    byAction: countBy(polishedRecords.map((record) => record.action)),
    skippedForReadiness: buildSkippedForReadiness(records),
  },
  records: polishedRecords,
};

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, `${buildMarkdown(report)}\n`);

if (!dryRun) {
  writeFileSync(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`);
}

console.log(`Story summary polish ${dryRun ? 'dry run' : 'complete'}.`);
console.log(`${polishedRecords.length} story summaries ${dryRun ? 'would be polished/synced' : 'polished/synced'}.`);
console.log(`Actions: ${formatCountMap(report.summary.byAction)}`);
console.log(`Skipped for readiness: ${report.summary.skippedForReadiness.length}`);
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${markdownPath}`);
if (!dryRun) console.log(`Updated ${metadataPath}`);

function buildPolishRecord(id, record) {
  const person = inducteesById.get(id);
  const override = summaryPolishOverrides[id];
  if (override) {
    if (!summaryLooksVisitorReady(override)) return null;
    return buildRecord({
      id,
      person,
      record,
      action: 'curated-polish',
      afterSummary: override,
    });
  }

  if (!shouldSync(record) || !summaryLooksVisitorReady(record.approvedSummary)) return null;
  return buildRecord({
    id,
    person,
    record,
    action: 'draft-sync-only',
    afterSummary: record.approvedSummary,
  });
}

function buildRecord({ id, person, record, action, afterSummary }) {
  return {
    id,
    displayName: cleanText(person?.name || record.displayName),
    classYear: person?.classYear ?? record.classYear,
    action,
    beforeDraft: cleanText(record.summaryDraft),
    beforeApproved: cleanText(record.approvedSummary),
    afterSummary: cleanText(afterSummary),
  };
}

function shouldSync(record) {
  return Boolean(
    cleanText(record.summaryDraft) &&
    cleanText(record.approvedSummary) &&
    cleanText(record.summaryDraft) !== cleanText(record.approvedSummary),
  );
}

function summaryLooksVisitorReady(value) {
  const text = cleanText(value);
  return (
    wordCount(text) >= 18 &&
    wordCount(text) <= 60 &&
    !/\.{3}|…/u.test(text) &&
    !/\b(currently|today|now|at present|presently)\b|present role/i.test(text) &&
    !/\bhttps?:\/\/|\bwww\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) &&
    !/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(text) &&
    !/\b\d{2,5}\s+(?:Public Square|Lakeshore Boulevard)\b/i.test(text)
  );
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wordCount(value) {
  const text = cleanText(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function buildSkippedForReadiness(recordsById) {
  const skippedOverrideIds = Object.entries(summaryPolishOverrides)
    .filter(([, summary]) => !summaryLooksVisitorReady(summary))
    .map(([id]) => id);
  const skippedSyncIds = Object.entries(recordsById)
    .filter(([id, record]) => !summaryPolishOverrides[id] && shouldSync(record) && !summaryLooksVisitorReady(record.approvedSummary))
    .map(([id]) => id);
  return [...skippedOverrideIds, ...skippedSyncIds];
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function formatCountMap(map) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}: ${count}`)
    .join('; ') || 'none';
}

function buildMarkdown(data) {
  const lines = [];
  lines.push('# CIHOF Story Summary Polish Report');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('This pass fixes optional story-summary polish by applying local, curated rewrites to the remaining draft/approved mismatch records and syncing draft plus approved summary fields. It excludes `data/external-research/*`.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Story summaries polished/synced: ${data.summary.polishedRecords}`);
  lines.push(`- Actions: ${formatCountMap(data.summary.byAction)}`);
  lines.push(`- Mismatches skipped for readiness: ${data.summary.skippedForReadiness.length}`);
  lines.push('');
  lines.push('## Polished Records');
  lines.push('');
  lines.push('| Person | Class | Action | Final summary |');
  lines.push('| --- | ---: | --- | --- |');
  data.records.forEach((record) => {
    lines.push(`| ${escapeCell(record.displayName)} | ${record.classYear ?? ''} | ${escapeCell(record.action)} | ${escapeCell(record.afterSummary)} |`);
  });
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
