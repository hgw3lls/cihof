import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildReport, loadInductees } from './data-utils.js';

const outputPath = resolve('public/data/data-audit.local.json');
const inductees = loadInductees();
const report = buildReport(inductees);
const audit = {
  generatedAt: new Date().toISOString(),
  ...report,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(`Audit complete: ${report.totalInductees} inductees, ${report.regions.length} regions, ${report.countries.length} nationality/heritage labels.`);
console.log(`Videos missing: ${report.missing.video.length}`);
console.log(`Primary images missing: ${report.missing.primaryImage.length}`);
console.log(`Duplicate IDs: ${report.duplicateIds.length}`);
console.log(`Generic image candidates: ${report.suspicious.genericImageCandidates.length}`);
console.log(`Wrote ${outputPath}`);
