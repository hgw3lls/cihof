import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const inputPath = resolve('data/external-research/cihof-external-source-candidates.json');
const outputPath = resolve('data/external-research/cihof-external-contribution-candidates.json');
const csvOutputPath = resolve('data/external-research/cihof-external-contribution-candidates.csv');

const fallbackExcludedDomains = ['clevelandinternationalhalloffame.com', 'clevelandpeople.com'];
const genericDomains = new Set([
  'ancestry.com',
  'ballotpedia.org',
  'biographs.org',
  'cleveland.com',
  'clevelandmen.com',
  'clevelandseniors.com',
  'dbpedia.org',
  'everybodywiki.com',
  'facebook.com',
  'findagrave.com',
  'instagram.com',
  'lawyerdb.org',
  'legacy.com',
  'linkedin.com',
  'mylife.com',
  'newspapers.com',
  'peoplepill.com',
  'prabook.com',
  'radaris.com',
  'repbio.org',
  'thefamouspeople.com',
  'twitter.com',
  'vote-usa.org',
  'whitepages.com',
  'wikidata.org',
  'wikipedia.org',
  'x.com',
  'youtube.com',
  'youtu.be',
]);

const trustedOrgDomains = new Set([
  'catholiccommunity.org',
  'catalog.wrhs.org',
  'clevelandfoundation100.org',
  'clevelandhistorical.org',
  'clevelandpolicefoundation.org',
  'clevelandvoices.org',
  'cpl.org',
  'hof.csulaw.org',
  'indiaspora.org',
  'irisharchives.org',
  'thehispanicroundtable.org',
  'thehistorymakers.org',
  'vayuusa.org',
]);

const report = JSON.parse(readFileSync(inputPath, 'utf8'));
const excludedDomains = report.sourcePolicy?.excludedDomains ?? fallbackExcludedDomains;
const sourceRecords = Object.values(report.records ?? {});
const retainedRecords = {};
const droppedReasonCounts = {};
const droppedIds = [];

for (const record of sourceRecords) {
  const contributions = collectContributions(record);
  if (contributions.length === 0) {
    const reason = dropReason(record);
    droppedReasonCounts[reason] = (droppedReasonCounts[reason] ?? 0) + 1;
    droppedIds.push(record.id);
    continue;
  }

  retainedRecords[record.id] = {
    id: record.id,
    name: record.name,
    classYear: record.classYear,
    region: record.region,
    sourceQualityStatus: 'good-contribution-candidate',
    integrationStatus: 'not-integrated',
    reviewStatus: 'needs-curator-approval-before-integration',
    contributionCount: contributions.length,
    contributions,
    summary: {
      contributionTypes: Array.from(new Set(contributions.map((item) => item.type))),
      sourceDomains: Array.from(new Set(contributions.map((item) => item.domain).filter(Boolean))).sort(),
      sourceUrls: Array.from(new Set(contributions.map((item) => item.sourceUrl).filter(Boolean))),
    },
  };
}

const outputRecords = Object.values(retainedRecords);
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  collector: 'scripts/filter-external-contributions.js',
  sourceInput: 'data/external-research/cihof-external-source-candidates.json',
  integrationStatus: 'not-integrated',
  reviewStatus: 'needs-curator-approval-before-integration',
  qualityPolicy: {
    kept: [
      'Strong identity-matched Wikipedia summaries',
      'Strong identity-matched Wikidata claim sets',
      'External official or institutional source leads with usable URLs',
    ],
    dropped: [
      'Loose Wikipedia candidates',
      'Loose Wikidata candidates',
      'Source errors and empty search placeholders',
      'Generic biography, directory, social, and media domains',
      'Any URL from the excluded primary source domains',
    ],
    excludedDomains,
    note: 'This is still a review file. It contains only contribution candidates and does not promote facts into canonical CIHOF data.',
  },
  summary: {
    inputRecords: sourceRecords.length,
    retainedRecords: outputRecords.length,
    droppedRecords: sourceRecords.length - outputRecords.length,
    retainedContributionItems: outputRecords.reduce((total, record) => total + record.contributionCount, 0),
    retainedWikipediaSummaries: countContributions(outputRecords, 'wikipediaSummary'),
    retainedWikidataClaimSets: countContributions(outputRecords, 'wikidataClaimSet'),
    retainedOfficialSiteLeads: countContributions(outputRecords, 'officialSiteLead'),
    droppedReasonCounts,
    droppedIds,
  },
  selectedIds: Object.keys(retainedRecords),
  records: retainedRecords,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(csvOutputPath, `${buildCsv(output)}\n`);

console.log('External contribution filtering complete.');
console.log(`${output.summary.retainedRecords}/${output.summary.inputRecords} records retained.`);
console.log(`${output.summary.retainedContributionItems} contribution candidates retained.`);
console.log(`${output.summary.retainedWikipediaSummaries} Wikipedia summaries retained.`);
console.log(`${output.summary.retainedOfficialSiteLeads} official/institutional leads retained.`);
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${csvOutputPath}`);

function collectContributions(record) {
  return dedupeContributions([
    wikipediaContribution(record),
    ...wikidataContributions(record),
    ...officialSiteLeadContributions(record),
  ].filter(Boolean));
}

function wikipediaContribution(record) {
  const match = record.wikipedia?.match;
  if (!isStrongMatch(record.wikipedia, match)) return null;
  return {
    type: 'wikipediaSummary',
    label: 'Strong Wikipedia identity match',
    value: match.extract || match.description || '',
    sourceType: 'wikipedia',
    sourceUrl: match.url,
    sourceTitle: match.title,
    domain: domainForUrl(match.url),
    confidence: 'strong-identity-match',
    reviewStatus: 'needs-curator-approval-before-integration',
    evidence: {
      score: match.score,
      reasons: match.reasons ?? [],
      contextMatches: match.contextMatches ?? [],
      wikidataId: match.wikidataId || '',
    },
  };
}

function wikidataContributions(record) {
  const match = record.wikidata?.match;
  if (!isStrongMatch(record.wikidata, match)) return [];
  const claims = match.claims ?? {};
  const values = [
    ['birthDate', 'Birth date', claims.birthDate],
    ['deathDate', 'Death date', claims.deathDate],
    ['occupations', 'Occupations', joinClaimLabels(claims.occupations)],
    ['citizenships', 'Citizenships', joinClaimLabels(claims.citizenships)],
    ['educatedAt', 'Education', joinClaimLabels(claims.educatedAt)],
    ['employers', 'Employers', joinClaimLabels(claims.employers)],
    ['awards', 'Awards', joinClaimLabels(claims.awards)],
    ['birthPlaces', 'Birth places', joinClaimLabels(claims.birthPlaces)],
    ['deathPlaces', 'Death places', joinClaimLabels(claims.deathPlaces)],
  ];
  const claimValues = values
    .filter(([, , value]) => Boolean(value))
    .map(([claim, label, value]) => ({ claim, label, value }));
  if (claimValues.length === 0) return [];

  return [
    {
      type: 'wikidataClaimSet',
      label: 'Strong Wikidata identity match',
      value: claimValues.map((item) => `${item.label}: ${item.value}`).join('; '),
      sourceType: 'wikidata',
      sourceUrl: match.url,
      sourceTitle: match.label,
      domain: domainForUrl(match.url),
      confidence: 'strong-identity-match',
      reviewStatus: 'needs-curator-approval-before-integration',
      evidence: {
        id: match.id,
        score: match.score,
        reasons: match.reasons ?? [],
        contextMatches: match.contextMatches ?? [],
        claims: claimValues,
      },
    },
  ];
}

function officialSiteLeadContributions(record) {
  return (record.officialSiteLeads ?? [])
    .filter((lead) => isContributingOfficialLead(record, lead))
    .map((lead) => ({
      type: 'officialSiteLead',
      label: lead.title || lead.domain || 'External official source lead',
      value: lead.snippet || lead.title || lead.url,
      sourceType: lead.source || 'web-search',
      sourceUrl: lead.url,
      sourceTitle: lead.title || '',
      domain: lead.domain || domainForUrl(lead.url),
      confidence: lead.confidence || 'official-site-lead',
      reviewStatus: 'needs-curator-approval-before-integration',
      evidence: {
        domainQuality: domainQuality(lead.domain || domainForUrl(lead.url), record),
      },
    }));
}

function isStrongMatch(source, match) {
  if (source?.status !== 'strong-match' || !match?.url) return false;
  if (isExcludedUrl(match.url)) return false;
  if (match.reasons?.includes('birth-year-mismatch') || match.reasons?.includes('middle-initial-mismatch')) return false;
  const contextMatches = match.contextMatches ?? [];
  return Number(match.score) >= 0.72 && (contextMatches.length >= 2 || match.reasons?.includes('has-official-website-claim'));
}

function isContributingOfficialLead(record, lead) {
  const url = lead?.url || '';
  const domain = lead?.domain || domainForUrl(url);
  if (!url || !domain) return false;
  if (isExcludedUrl(url) || isGenericDomain(domain)) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (!lead.title && !lead.snippet && lead.source !== 'wikidata:P856') return false;
  return domainQuality(domain, record) !== 'unsupported-domain';
}

function domainQuality(domain, record) {
  if (/\.(edu|gov)$/i.test(domain)) return 'education-or-government';
  if (trustedOrgDomains.has(domain)) return 'trusted-institutional-org';
  if (domain.endsWith('.org') && /\b(archive|archives|association|center|centre|church|city|college|congress|council|county|foundation|hospital|institute|library|museum|parish|school|senate|society|university)\b/.test(domain)) {
    return 'institutional-org';
  }
  if (isNamedDomain(domain, record.name)) return 'named-or-personal-domain';
  return 'unsupported-domain';
}

function isNamedDomain(domain, name) {
  const tokens = meaningfulTokens(name).filter((token) => token.length > 3);
  if (tokens.length === 0) return false;
  const domainText = normalizeText(domain);
  return tokens.some((token) => domainText.includes(token));
}

function isGenericDomain(domain) {
  return Array.from(genericDomains).some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function isExcludedUrl(value) {
  const domain = domainForUrl(value);
  return excludedDomains.some((excluded) => domain === excluded || domain.endsWith(`.${excluded}`));
}

function dedupeContributions(contributions) {
  const seen = new Set();
  return contributions.filter((item) => {
    const key = `${item.type}:${normalizeUrl(item.sourceUrl)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dropReason(record) {
  if ((record.wikipedia?.status === 'candidates-only' || record.wikidata?.status === 'candidates-only') && (record.officialSiteLeads ?? []).length === 0) {
    return 'weak-identity-candidates-only';
  }
  if ((record.officialSiteLeads ?? []).length > 0) return 'official-leads-failed-quality-filter';
  return 'no-contributing-external-source';
}

function countContributions(records, type) {
  return records.reduce((total, record) => total + record.contributions.filter((item) => item.type === type).length, 0);
}

function joinClaimLabels(values) {
  if (!Array.isArray(values)) return '';
  return values.map((item) => item.label).filter(Boolean).join('; ');
}

function buildCsv(filteredReport) {
  const headers = [
    'id',
    'name',
    'classYear',
    'region',
    'contributionCount',
    'contributionTypes',
    'sourceDomains',
    'sourceUrls',
    'reviewStatus',
  ];
  const rows = Object.values(filteredReport.records).map((record) => [
    record.id,
    record.name,
    record.classYear ?? '',
    record.region,
    record.contributionCount,
    record.summary.contributionTypes.join('|'),
    record.summary.sourceDomains.join('|'),
    record.summary.sourceUrls.join('|'),
    record.reviewStatus,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function domainForUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value) {
  const stopwords = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'that', 'this', 'within', 'class', 'honoree', 'connected']);
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopwords.has(token));
}
