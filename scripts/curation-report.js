import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildCurationReport, loadCuratedMetadata, loadInductees, validateCuratedMetadata } from './data-utils.js';
import { generatedAtFor } from './stable-generated-at.js';

const outputPath = resolve('public/data/curation-report.json');
const baseInductees = loadInductees({ includeCurated: false, includeMedia: false });
const curatedMetadata = loadCuratedMetadata();
const validation = validateCuratedMetadata(curatedMetadata, baseInductees.map((item) => item.id));
const inductees = validation.errors.length > 0 ? baseInductees : loadInductees();
const report = {
  generatedAt: generatedAtFor(outputPath),
  ...buildCurationReport(inductees, curatedMetadata, validation),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Curation report: ${report.totalInductees} inductees, ${report.curatedRecords} curated records.`);
console.log(`Validation errors: ${validation.errors.length}`);
console.log(`Validation warnings: ${validation.warnings.length}`);
console.log(`Approved summaries: ${report.summaries.approved}`);
console.log(`Featured candidates: ${report.featured.candidates.length}`);
console.log(`Caption/transcript review needed: ${report.media.captionTranscriptReviewNeeded.length}`);
console.log(`Wrote ${outputPath}`);

if (validation.errors.length > 0) process.exitCode = 1;
