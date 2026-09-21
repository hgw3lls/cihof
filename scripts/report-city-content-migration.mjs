import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve('public/data/city-content-review.json');
const outputPath = resolve('cihof-city-experience/reports/CE-01_MIGRATION_REPORT.md');
const report = JSON.parse(readFileSync(sourcePath, 'utf8'));
const approvalCounts = Object.entries(report.compatibility?.approvalStatusCounts ?? {})
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n');
const invalidIds = report.personEntityMapping?.invalidIds ?? [];

const markdown = `# CE-01 content migration report

**Content revision:** \`${report.contentRevision}\`  
**Generated:** ${report.generatedAt}

## Base-profile compatibility

${report.compatibility?.baseProfileCount ?? 0} current base profiles remain eligible through the
canonical id-and-name compatibility policy. Existing \`approvalStatus\` values are
reported without being reinterpreted as enrichment publication decisions.

${approvalCounts || '- No approval statuses recorded.'}

## Canonical identity adapter

The adapter is \`${report.personEntityMapping?.adapter}\`. It checked
${report.personEntityMapping?.checked ?? 0} person IDs. Missing mappings:
${invalidIds.length ? invalidIds.map((id) => `- \`${id}\``).join('\n') : '- None.'}

## Review inputs

- ${report.vocabulary?.length ?? 0} legacy vocabulary labels remain \`unresolved-legacy\`.
- ${report.places?.length ?? 0} place seeds remain staff-only and need review.
- ${report.stories?.length ?? 0} story starter records remain staff-only and need review.
- ${report.archives?.length ?? 0} archive leads retain their recorded workflow and target states.

Schematic place markers are explicitly reported as
\`cihof-legacy-schematic-v1\`; they are not geographic coordinates. Original
labels, story wording, provenance, and candidate person IDs are preserved in
the canonical/review records.

## Publication result

The public and kiosk serializers preserve eligible base profiles and remove
unapproved story beats, place seeds, archive workflow records, candidate
entities, provisional relationships, and target-ineligible media. New content
requires an approved review record with a decision reference and content
version plus an independently allowed target.

## Guardrails

${(report.guardrails ?? []).map((item) => `- ${item}`).join('\n')}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown);
console.log(`Wrote ${outputPath}`);
