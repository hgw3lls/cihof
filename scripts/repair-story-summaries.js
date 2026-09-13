import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadCuratedMetadata, loadInductees } from './data-utils.js';

const metadataPath = resolve('data/cihof_curated_metadata.json');
const reportPath = resolve('artifacts/story-summary-repair-report.json');
const markdownPath = resolve('docs/story-summary-repair-report.md');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const metadata = loadCuratedMetadata({ optional: false });
const baseInductees = loadInductees({ includeCurated: false, includeMedia: false, includePhysicalWall: false });
const currentInductees = loadInductees({ includeMedia: false, includePhysicalWall: false });
const baseById = new Map(baseInductees.map((person) => [person.id, person]));
const currentById = new Map(currentInductees.map((person) => [person.id, person]));
const generatedAt = new Date().toISOString();
const summaryOverrides = Object.freeze({
  'august-pust-2010': "August B. Pust built a career in public service, cultural diplomacy, and citizen exchange, coordinating trade, humanitarian, educational, cultural, and goodwill missions while advancing people-to-people international partnerships.",
  'irene-morrow-2010': "Irene Morrow served Cleveland and Cuyahoga County for 25 years, helping modernize public payroll, civil-service testing, and record systems before continuing her civic and ethnic community involvement.",
  'jeanette-grasselli-brown-2010': "Jeanette Grasselli Brown spent 38 years in industrial research, became BP America's Director of Corporate Research, and later served Ohio education through university and Board of Regents leadership.",
  'leo-weidenthal-2010': "Leo Weidenthal was a Cleveland journalist, Jewish Independent editor, and founder of the Cleveland Cultural Garden Federation whose civic work helped shape the city's cultural-garden movement.",
  'margaret-w-wong-2010': "Margaret W. Wong built a nationally recognized immigration and nationality law practice and became a prominent advocate, civic leader, and mentor in Cleveland's Chinese and immigrant communities.",
  'paul-sciria-2010': "Paul Sciria carried Italian American stories through journalism and community service, acquiring La Gazzetta Italiana in 1992 and becoming a steady voice for Italian heritage in Cleveland.",
  'senator-george-voinovich-2010': "George Voinovich served Ohio as Cleveland mayor, governor, and United States senator, earning recognition for public-sector reform, urban recovery work, and foreign-policy engagement.",
  'gerald-m-quinn-2011': "Gerald M. Quinn connected Cleveland's Irish community through broadcasting and civic organizing, helping found the Irish American Club East Side and the Mayo Society.",
  'lucretia-stoica-2011': "Lucretia Stoica led refugee and immigrant service work in Cleveland for decades, serving the International Institute of the YWCA and helping organize cultural and refugee-support initiatives.",
  'tony-petkovsek-2011': "Tony Petkovsek became one of Cleveland's defining polka broadcasters and cultural ambassadors, linking Slovenian music, travel, and community life through decades of radio and public events.",
  'hon-mary-rose-oakar-2012': "Mary Rose Oakar represented Cleveland in city, state, and federal office, serving sixteen years in Congress while advancing civic leadership, education, and international-policy work.",
  'milton-maltz-2012': "Milton Maltz founded Malrite Communications Group and built a national broadcasting career while supporting cultural, civic, and Jewish community institutions in Greater Cleveland.",
  'vladimir-rus-2012': "Vladimir Rus brought Slovenian and Croatian heritage into Cleveland civic life through teaching, cultural history, sister-city work, and leadership in Slovenian American organizations.",
  'dr-maria-pujana-2013': "Dr. Maria Pujana combined medicine, global health, public service, and arts leadership through roles with Case Western Reserve University, civic boards, and cultural initiatives.",
  'josef-holzer-2013': "Josef Holzer helped build and sustain Cleveland's Donauschwaben community, serving as a long-term organizational leader, mentor, and advocate for German cultural heritage.",
  'nacy-panzica-2013': "Nacy Panzica grew Panzica Construction from residential remodeling into a major construction company while supporting Catholic, civic, educational, and health-related community causes.",
  'ratanjit-s-sondhe-2013': "Ratanjit S. Sondhe founded POLY-CARB, built an internationally recognized materials-science company, and developed a leadership philosophy centered on values, service, and personal growth.",
  'joseph-p-meissner-2014': "Joseph P. Meissner built a career in law, military service, education, and community advocacy, linking his public work to Cleveland's Irish and German heritage communities.",
  'bishop-anthony-pilla-2015': "Bishop Anthony Pilla served the Catholic Diocese of Cleveland through parish, seminary, and diocesan leadership, becoming a major faith and civic figure in the region.",
  'dick-pogue-2015': "Dick Pogue helped shape Cleveland's legal, civic, educational, and international business communities through leadership at Jones Day and many regional institutions.",
  'dick-russ-2015': "Dick Russ built a career in broadcast journalism and community leadership, earning major media honors while supporting Slovenian, religious, housing, and cultural organizations.",
  'steve-mulloy-2015': "Steve Mulloy carried Irish heritage into Cleveland civic life through community organizing, public service, and support for Irish cultural and faith-based institutions.",
  'arnie-de-la-porte-2016-2016': "Arnie de la Porte brought Dutch maritime training and entrepreneurial experience to Cleveland, building business ventures and serving as an active connector in international community life.",
  'carolyn-balogh-2016-2016': "Carolyn Balogh joined education, business, and community service, supporting Mar-Bal, Inc. and many civic, cultural, and philanthropic efforts in Greater Cleveland.",
  'eugenia-stolarczyk-2016-2016': "Eugenia Stolarczyk strengthened Cleveland's Polish community through cultural organizing, publicity work, music, folklore, and leadership in the Polish American Congress.",
  'khalid-samad-2016-2016': "Khalid Samad became a Cleveland community activist and public-safety leader, co-founding Peace in the Hood and organizing around peace, justice, and empowerment.",
  'rev-mikhail-mikhail-2016': "Rev. Mikhail Mikhail helped establish Coptic Orthodox theological education in America and served Cleveland's faith community as a priest, teacher, dean, and pastoral leader.",
  'bill-miller-2017': "Bill Miller used storytelling, civic curiosity, and public engagement to connect Cleveland communities, making people and neighborhood stories central to his public life.",
  'jim-craciun-2017': "Jim Craciun combined law, writing, arts leadership, and refugee-service work, serving Cleveland cultural institutions and the International Services Center.",
  'mona-alag-2017': "Mona Alag became a leader in Cleveland's Indian community, organizing cultural, youth, and intergenerational programs that strengthened understanding across communities.",
  'atul-mehta-2018': "Dr. Atul Mehta became an internationally respected pulmonary physician and teacher, helping train medical professionals and serving Cleveland's Indian community through health and civic work.",
  'ray-pianka-2018': "Judge Ray Pianka devoted his career to Cleveland neighborhoods, community development, historic preservation, and housing-court service rooted in Polish heritage and civic fairness.",
  'sheila-murphy-crawford-2018': "Sheila Murphy Crawford advanced Irish cultural heritage through decades of volunteer leadership with the Cleveland Cultural Gardens and restoration work in the Irish Cultural Garden.",
  'sister-alicia-alvarado-2018': "Sister Alicia Alvarado linked faith, education, social work, and community service, becoming a leader for Puerto Rican heritage and Catholic service in Cleveland.",
  'akram-boutros-2019': "Akram Boutros led MetroHealth through major transformation, using public-health leadership, community investment, and institutional rebuilding to expand care in Cuyahoga County.",
  'ingrida-bublys-2019': "Ingrida Bublys built international business ties between the Baltic States and the United States, supporting trade development, Lithuanian companies, and civic connections in Northeast Ohio.",
  'paul-burik-2019': "Paul Burik brought architecture, city service, and cultural-garden leadership together, supporting Cleveland's Czech and Carpatho-Rusyn communities through civic and heritage work.",
  'richard-fleischman-2019': "Richard Fleischman became an award-winning Cleveland architect known for sculpted space, major regional projects, church design, and contributions to architectural education.",
  'sree-sreenath-2019': "Sree Sreenath built a career in engineering, systems research, global development, and education at Case Western Reserve University while organizing Indian community initiatives.",
  'may-chen-2020': "May Chen co-founded Asian Services in Action and spent her career expanding advocacy, culturally appropriate services, and community capacity for Asian American and Pacific Islander communities.",
  'valarie-mccall-2020': "Valarie McCall shaped Cleveland civic life through public service, communications, transportation leadership, Sister Cities work, and community and economic development.",
  'georgine-welo-2023': "Georgine Welo strengthened Serbian cultural and civic life in Northeast Ohio through Saint Sava, Serbian community organizations, and broader cultural leadership.",
  'joyce-mariani-2023': "Joyce Mariani founded the Cleveland Italian Film Festival and led major Italian Cultural Garden restoration and cultural programming efforts in Rockefeller Park.",
  'michael-d-polensek-2023': "Michael D. Polensek built a decades-long career representing northeast Cleveland neighborhoods, focusing on public safety, neighborhood development, fair housing, and grassroots community leadership.",
  'pat-dowd-2023': "Pat Dowd promoted Irish culture through education, business, and community activity, building Irish Moments and supporting Irish American events, festivals, and organizations.",
  'sudarshan-sathe-2023': "Sudarshan Sathe founded NewConcepts after a career in chemical and metals industries, supporting education, hunger relief, and philanthropic causes in Indian and Cleveland communities.",
  'david-gilbert-2025': "David Gilbert helped make Greater Cleveland a major destination for sports and civic events through leadership of the Greater Cleveland Sports Commission and Destination Cleveland.",
  'svetlana-stolyarova-2025': "Svetlana Stolyarova strengthened Russian cultural life in Cleveland through business leadership, the Russian Cultural Garden, music programming, and cross-cultural civic work.",
  'aklilu-demessie-2026': "Aklilu Demessie built a life of engineering, education, faith, and Ethiopian community service after arriving in Ohio through an American Field Service student program.",
  'andy-chakalis-2026': "Andy Chakalis connected art, education, and Greek heritage through decades of museum work, exhibition leadership, and support for Cleveland cultural organizations.",
  'andy-fedynsky-2026': "Andy Fedynsky connected Ukrainian heritage, education, journalism, and civic advocacy, teaching community history while supporting cultural and political rights for Ukraine.",
  'le-nguyen-2026': "Le Nguyen became a trusted connector for Cleveland's Asian and Vietnamese communities, helping newcomers, resolving conflicts, and building bridges with neighborhood and city leadership."
});

const repairs = Object.entries(metadata.inductees ?? {})
  .map(([id, record]) => buildRepair(id, record))
  .filter(Boolean);

const updatedMetadata = JSON.parse(JSON.stringify(metadata));
repairs.forEach((repair) => {
  const record = updatedMetadata.inductees[repair.id];
  record.summaryDraft = repair.after;
  record.approvedSummary = repair.after;
  record.curatorNotes = Array.from(new Set([
    ...(Array.isArray(record.curatorNotes) ? record.curatorNotes : []),
    `Story summary repaired from existing CIHOF profile text on ${generatedAt.slice(0, 10)}; factual approval remains separate.`,
  ]));
});

const report = {
  schemaVersion: 1,
  generatedAt,
  dryRun,
  source: {
    updatedFile: 'data/cihof_curated_metadata.json',
    basis: 'Curated local rewrites based on existing CIHOF profile text and current honored-for summaries, with bio sentence and honored-for fallbacks for future flagged records.',
    excluded: ['data/external-research/*'],
    note: 'This repairs text shape/readability only. It does not verify facts or mark records approved.',
  },
  summary: {
    repairedRecords: repairs.length,
    byReason: countBy(repairs.flatMap((repair) => repair.reasons)),
    byStrategy: countBy(repairs.map((repair) => repair.strategy)),
    unresolved: repairs.filter((repair) => repair.reviewFlags.length > 0).map((repair) => repair.id),
  },
  repairs,
};

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, `${buildMarkdown(report)}\n`);

if (!dryRun) {
  writeFileSync(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`);
}

console.log(`Story summary repair ${dryRun ? 'dry run' : 'complete'}.`);
console.log(`${repairs.length} summaries ${dryRun ? 'would be repaired' : 'repaired'}.`);
console.log(`Strategies: ${formatCountMap(report.summary.byStrategy)}`);
console.log(`Review flags: ${report.summary.unresolved.length}`);
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${markdownPath}`);
if (!dryRun) console.log(`Updated ${metadataPath}`);

function buildRepair(id, record) {
  const current = currentById.get(id);
  const base = baseById.get(id);
  if (!current || !base) return null;

  const reasons = storySummaryReasons(current.storySummary, current.name);
  if (reasons.length === 0) return null;

  const before = cleanText(record.approvedSummary || record.summaryDraft || current.storySummary);
  const candidate = buildReplacementSummary(current, base);
  const reviewFlags = storySummaryReasons(candidate.summary, current.name);

  return {
    id,
    name: cleanDisplayName(current.name),
    classYear: current.classYear,
    reasons,
    strategy: candidate.strategy,
    before,
    after: candidate.summary,
    afterWordCount: wordCount(candidate.summary),
    sourceExcerpt: candidate.sourceExcerpt,
    reviewFlags,
  };
}

function storySummaryReasons(value, displayName) {
  const reasons = [];
  const text = cleanText(value);
  if (!text) reasons.push('missing');
  if (hasEllipsis(text)) reasons.push('truncated');
  if (hasTemporalWording(text)) reasons.push('time-sensitive wording');
  if (hasContactLikeText(text)) reasons.push('contact/address text');
  if (hasUrlOrEmail(text)) reasons.push('url/email text');
  if (startsWithDuplicatedName(text, displayName)) reasons.push('duplicated leading name');
  if (wordCount(text) < 18) reasons.push('too short');
  if (wordCount(text) > 60) reasons.push('too long');
  return reasons;
}

function buildReplacementSummary(current, base) {
  const override = summaryOverrides[current.id];
  if (override) {
    return {
      strategy: 'curated-local-override',
      summary: ensureTerminalPunctuation(override),
      sourceExcerpt: current.honoredForSummary || cleanText(base.bioText).slice(0, 220),
    };
  }

  const cleanedBio = cleanBioText(base.bioText, [current.name, base.name]);
  const sentences = splitSentences(cleanedBio)
    .map(cleanText)
    .filter((sentence) => isUsableSentence(sentence));
  const scored = sentences
    .slice(0, 16)
    .map((sentence, index) => ({ sentence: normalizeOpeningPronoun(sentence, cleanDisplayName(current.name)), index, score: scoreSentence(sentence, current.name) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = scored.find((candidate) => passesSummaryShape(candidate.sentence, current.name));
  if (selected) {
    return {
      strategy: 'bio-sentence',
      summary: ensureTerminalPunctuation(selected.sentence),
      sourceExcerpt: selected.sentence,
    };
  }

  const fallback = buildHonoredForFallback(current);
  return {
    strategy: 'honored-for-fallback',
    summary: fallback,
    sourceExcerpt: current.honoredForSummary,
  };
}

function buildHonoredForFallback(person) {
  const name = cleanDisplayName(person.name);
  const honoredFor = cleanText(person.honoredForSummary).replace(/\.$/, '');
  if (/^Contributions?\s+to\b/i.test(honoredFor)) {
    return ensureTerminalPunctuation(`${name} is recognized for ${lowerFirst(honoredFor)}`);
  }
  if (honoredFor) return ensureTerminalPunctuation(`${name} is recognized for ${lowerFirst(honoredFor)}`);
  return `${name} is a Cleveland International Hall of Fame inductee recognized for service to Greater Cleveland's international communities.`;
}

function cleanBioText(value, names) {
  let text = cleanText(value)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
  text = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0].trim();

  const aliases = Array.from(new Set(names.flatMap((name) => buildNameAliases(name)))).filter(Boolean);
  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of aliases) {
      const escaped = escapeRegExp(alias);
      const next = text.replace(new RegExp(`^${escaped}\\s+`, 'i'), '').trim();
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
  }
  return text;
}

function buildNameAliases(name) {
  const cleanName = cleanDisplayName(name);
  const noHonorific = cleanName.replace(/^(Honorable|Hon\.|Dr\.|Rev\.|Reverend|Senator|Sister|Mayor|Judge|Bishop|Fr\.)\s+/i, '').trim();
  const withoutParenthetical = cleanName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return [cleanName, noHonorific, withoutParenthetical];
}

function splitSentences(text) {
  const protectedText = cleanText(text)
    .replace(/\b(Mr|Mrs|Ms|Dr|Rev|Fr|St|Lt|Col|Gen|Sen|Prof|Gov|Hon|Jr|Sr|Inc|Co|Corp|Ltd)\./g, '$1<prd>')
    .replace(/\b(Pa|Ohio|Ky|Va|W\.Va|N\.Y|N\.J|D\.C|U\.S|U\.K|L\.P\.A|M\.D|Ph\.D|B\.A|M\.A|B\.S|M\.S)\./g, (match) => match.replace(/\./g, '<prd>'))
    .replace(/\b([A-Z])\./g, '$1<prd>');

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((sentence) => sentence.replace(/<prd>/g, '.').trim())
    .filter((sentence) => sentence.length > 20);
}

function isUsableSentence(sentence) {
  return (
    wordCount(sentence) >= 12 &&
    wordCount(sentence) <= 60 &&
    !hasEllipsis(sentence) &&
    !hasContactLikeText(sentence) &&
    !hasUrlOrEmail(sentence) &&
    !hasScrapeResidue(sentence) &&
    !/^\s*["“][^"”]+["”]\s*$/u.test(sentence)
  );
}

function passesSummaryShape(sentence, displayName) {
  const words = wordCount(sentence);
  return (
    words >= 18 &&
    words <= 60 &&
    !hasEllipsis(sentence) &&
    !hasTemporalWording(sentence) &&
    !hasContactLikeText(sentence) &&
    !hasUrlOrEmail(sentence) &&
    !startsWithDuplicatedName(sentence, displayName)
  );
}

function scoreSentence(sentence, displayName) {
  const text = sentence.toLowerCase();
  let score = 0;
  if (containsAny(text, ['founder', 'founded', 'co-founder', 'established', 'created', 'launched', 'built', 'developed', 'organized'])) score += 5;
  if (containsAny(text, ['president', 'chief executive', 'ceo', 'director', 'chair', 'trustee', 'professor', 'physician', 'judge', 'mayor', 'senator', 'council', 'architect', 'broadcaster', 'publisher', 'editor', 'attorney', 'lawyer'])) score += 4;
  if (containsAny(text, ['community', 'civic', 'cultural', 'heritage', 'international', 'immigrant', 'immigration', 'refugee', 'service', 'public service', 'advocacy'])) score += 4;
  if (containsAny(text, ['served', 'led', 'leads', 'directed', 'represented', 'helped', 'expanded', 'supported', 'championed', 'advocated'])) score += 3;
  if (containsAny(text, ['award', 'honor', 'medal', 'hall of fame', 'recognized'])) score += 2;
  if (mentionsNameOrAlias(sentence, displayName)) score += 2;
  if (/^(he|she|they)\b/i.test(sentence)) score += 1;
  if (containsAny(text, ['born', 'grew up', 'married', 'children', 'grandchildren', 'attended', 'graduated', 'earned her', 'earned his'])) score -= 2;
  if (containsAny(text, ['currently', 'today', 'now', 'present role', 'at present', 'presently'])) score -= 6;
  if (/^\bI\b|\bme\b|\bmy\b/i.test(sentence)) score -= 4;
  return score;
}

function mentionsNameOrAlias(sentence, displayName) {
  const normalized = normalizeText(sentence);
  const aliases = buildNameAliases(displayName).map(normalizeText);
  return aliases.some((alias) => alias && normalized.includes(alias));
}

function normalizeOpeningPronoun(sentence, name) {
  return sentence
    .replace(/^He\b/, name)
    .replace(/^She\b/, name)
    .replace(/^They\b/, name)
    .replace(/^His\b/, `${name}'s`)
    .replace(/^Her\b/, `${name}'s`)
    .replace(/^Their\b/, `${name}'s`);
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function hasEllipsis(value) {
  return /\.{3}|…/u.test(String(value ?? ''));
}

function hasTemporalWording(value) {
  return /\b(currently|today|now|at present|presently)\b|present role/i.test(String(value ?? ''));
}

function hasContactLikeText(value) {
  const text = String(value ?? '');
  return (
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(text) ||
    /\b\d{2,5}\s+(?:Public Square|Lakeshore Boulevard)\b/i.test(text)
  );
}

function hasUrlOrEmail(value) {
  return /\bhttps?:\/\/|\bwww\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(value ?? ''));
}

function hasScrapeResidue(value) {
  return /\b(read more|click here|share this|posted in|leave a reply|comments are closed|wp-content|javascript:)\b/i.test(String(value ?? ''));
}

function startsWithDuplicatedName(value, displayName) {
  const normalizedText = normalizeText(value);
  return buildNameAliases(displayName)
    .map(normalizeText)
    .some((alias) => alias && normalizedText.startsWith(`${alias} ${alias}`));
}

function cleanDisplayName(name) {
  return cleanText(name)
    .replace(/\s+[–-]\s*\d{4}$/u, '')
    .replace(/\s*\(\d{4}\s*[–-]\s*\d{4}\)\s*$/u, '')
    .trim();
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function wordCount(value) {
  const text = cleanText(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function ensureTerminalPunctuation(text) {
  const trimmed = cleanText(text);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowerFirst(value) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  lines.push('# CIHOF Story Summary Repair Report');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('This pass repairs only local story-summary text that was flagged by the text-readiness checker. It excludes `data/external-research/*` and does not mark profile, factual, or rights approval complete.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Summaries repaired: ${data.summary.repairedRecords}`);
  lines.push(`- Repair strategies: ${formatCountMap(data.summary.byStrategy)}`);
  lines.push(`- Original issue reasons: ${formatCountMap(data.summary.byReason)}`);
  lines.push(`- Remaining automated review flags on repaired summaries: ${data.summary.unresolved.length}`);
  lines.push('');
  lines.push('## Repairs');
  lines.push('');
  lines.push('| Person | Class | Reasons | Strategy | New summary |');
  lines.push('| --- | ---: | --- | --- | --- |');
  data.repairs.forEach((repair) => {
    lines.push(`| ${escapeCell(repair.name)} | ${repair.classYear ?? ''} | ${escapeCell(repair.reasons.join(', '))} | ${escapeCell(repair.strategy)} | ${escapeCell(repair.after)} |`);
  });
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
