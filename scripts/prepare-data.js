import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildReport, loadInductees } from './data-utils.js';

const outputPath = resolve('public/data/inductees.json');
const reportPath = resolve('public/data/data-report.json');

const inductees = loadInductees();
const report = buildReport(inductees);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(inductees, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `Prepared ${report.totalInductees} inductees across ${report.regions.length} regions. ` +
    `${report.media.withPrimaryImage} have primary images, ${report.media.withVideo} have videos.`,
);
if (report.missing.primaryImage.length > 0) {
  console.log(`Missing primary images: ${report.missing.primaryImage.length}`);
}
