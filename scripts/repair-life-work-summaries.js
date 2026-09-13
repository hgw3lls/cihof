import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadCuratedMetadata, loadInductees } from './data-utils.js';

const metadataPath = resolve('data/cihof_curated_metadata.json');
const reportPath = resolve('artifacts/life-work-summary-repair-report.json');
const markdownPath = resolve('docs/life-work-summary-repair-report.md');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const generatedAt = new Date().toISOString();
const metadata = loadCuratedMetadata({ optional: false });
const currentInductees = loadInductees({ includeMedia: false, includePhysicalWall: false });
const currentById = new Map(currentInductees.map((person) => [person.id, person]));
const lifeWorkOverrides = Object.freeze({
  'august-pust-2010': "August B. Pust built a more than thirty-year public-service career around citizen diplomacy, multicultural relations, and international exchange. He coordinated trade, humanitarian, educational, cultural, and goodwill missions, developed programs for young professionals and civil-society partners, and helped connect municipal, regional, state, and university leaders through people-to-people global partnerships.",
  'irene-morrow-2010': "Irene Morrow served Cleveland and Cuyahoga County for 25 years, including eight years overseeing county payroll and seventeen years as Personnel Administrator and Secretary of the Civil Service Commission. Her work helped computerize public record systems, modernize test administration, and support large-scale city hiring before she continued civic service through Polish community organizations and volunteer leadership.",
  'jeanette-grasselli-brown-2010': "Jeanette Grasselli Brown spent 38 years in industrial research, retiring as Director of Corporate Research for BP America after a career that included patents, publications, and national scientific honors. She later served higher education through Ohio University, the Ohio Board of Regents, and statewide teacher-success work, while remaining connected to Cleveland's Hungarian and civic communities.",
  'margaret-w-wong-2010': "Margaret W. Wong built Margaret W. Wong & Associates into a nationally recognized immigration and nationality law practice serving clients across multiple states and federal courts. Her Cleveland-based work joined legal advocacy, immigrant support, education, and mentorship, making her a prominent civic leader in Chinese American and broader newcomer communities.",
  'senator-george-voinovich-2010': "George Voinovich built a public career across the Ohio House, Cuyahoga County, the lieutenant governor's office, Cleveland City Hall, the governor's office, and the United States Senate. Known for public-sector reform and urban recovery work, he helped lead Cleveland after fiscal crisis and carried Serbian and Slovenian heritage into civic and international affairs.",
  'gerald-m-quinn-2011': "Gerald M. Quinn used broadcasting, organizing, and community leadership to keep Cleveland's Irish community connected to its heritage. He helped found the Irish American Club East Side and the Mayo Society, hosted Gerry Quinn Irish Radio for decades, and became a familiar cultural voice linking Irish music, memory, and local civic life.",
  'luis-martinez-2011': "Luis Martinez carried military service, education, and Puerto Rican civic leadership into a career focused on training and community opportunity. After serving with the United States Marines in Vietnam, he moved to Cleveland, worked in recruitment and workforce development, and became a visible advocate for education, public service, and Puerto Rican community advancement.",
  'tony-petkovsek-2011': "Tony Petkovsek became one of Cleveland's defining polka broadcasters and Slovenian cultural ambassadors. His radio programs, travel work, interviews, and community events connected listeners to music, heritage, and civic life for decades, while his public presence helped make Slovenian and polka traditions part of Northeast Ohio's shared cultural landscape.",
  'anthony-yen-yan-yuan-tai-2012': "Anthony Yen built a career at the center of international business and trade, working with World Trade Center Cleveland, export councils, and business organizations that connected Northeast Ohio with global markets. His service linked Chinese heritage, economic development, teaching, consulting, and civic leadership across Cleveland's international community.",
  'hon-mary-rose-oakar-2012': "Mary Rose Oakar represented Cleveland through city, state, and federal office, including service on Cleveland City Council, in the Ohio House, and for sixteen years in the United States Congress. Her career joined public policy, education, civic advocacy, and international engagement, with lasting visibility for Arab American leadership and Greater Cleveland's communities.",
  'milton-maltz-2012': "Milton Maltz built Malrite Communications Group from Cleveland radio roots into a major broadcasting company with radio, television, and cable holdings. His life and work connected entrepreneurship, media, Jewish community leadership, and philanthropy, including sustained support for cultural institutions, Holocaust education, public broadcasting, and civic life in Northeast Ohio.",
  'dr-maria-pujana-2013': "Dr. Maria Pujana combined medicine, public health, education, and the arts across Cleveland's civic landscape. Trained as a physician and active in global health and cultural work, she served Case Western Reserve University, community boards, and arts initiatives while bringing Spanish and international perspectives into regional service and leadership.",
  'josef-holzer-2013': "Josef Holzer helped build and sustain Cleveland's Donauschwaben community after arriving in the United States from Europe. Through decades of organizational leadership, mentoring, cultural preservation, and service, he supported German heritage institutions, youth activities, and community events that kept language, music, dance, and memory visible in Greater Cleveland.",
  'ratanjit-s-sondhe-2013': "Ratanjit S. Sondhe founded POLY-CARB and built it into an internationally recognized materials-science company before developing a broader leadership philosophy centered on values, service, and personal growth. His work connects entrepreneurship, science, education, and Indian community leadership, emphasizing both technical innovation and human development through writing, speaking, and coaching.",
  'joseph-p-meissner-2014': "Joseph P. Meissner built a career across law, military service, education, and community advocacy. His work included legal service, teaching, veterans support, and civic engagement, while his Irish and German heritage ties shaped a public life committed to service, cross-cultural understanding, and Greater Cleveland's international communities.",
  'thomas-j-scanlon-2014': "Thomas J. Scanlon built a long Northeast Ohio legal career focused on real estate development, property ownership, financing, and nonprofit formation. A John Carroll and Cleveland-Marshall graduate, he also gave pro bono counsel to community organizations and supported Irish heritage, education, arts, and civic institutions through board service and philanthropy.",
  'bishop-anthony-pilla-2015': "Bishop Anthony Pilla rose through parish, seminary, and diocesan leadership to become the ninth Bishop of Cleveland. Ordained in 1959, he served at Borromeo Seminary and in clergy-services roles before leading the diocese, later taking national leadership in the Catholic bishops' conference and becoming a major faith and civic figure in Northeast Ohio.",
  'dick-pogue-2015': "Dick Pogue shaped Cleveland's legal, business, civic, and educational institutions through decades of leadership at Jones Day and regional boards. His career included military legal service, antitrust and corporate practice, managing-partner leadership during Jones Day's national and international growth, and sustained support for universities, arts organizations, and global business connections.",
  'dick-russ-2015': "Dick Russ built a four-decade career in Northeast Ohio journalism and civic service. He anchored and reported for Cleveland television and radio, earned major broadcasting honors, co-founded Eastern Christian Media, and supported Slovenian, religious, housing, and cultural organizations through board service, housing advocacy, and community leadership.",
  'steve-mulloy-2015': "Steve Mulloy immigrated from Achill Island to Cleveland in 1954 and spent his life returning the welcome he found in the Irish community. A longtime Building Laborers Local 310 member, he led and volunteered with Irish American clubs, sports groups, parish efforts, and civic organizations across the city's West Side.",
  'arnie-de-la-porte-2016-2016': "Arnie de la Porte brought Dutch maritime training, Royal Dutch Navy service, and international business experience to Northeast Ohio. After leadership roles in European industry and Ridge Tool, he co-founded Hexon, specialized in exports and business turnarounds, and served as an honorary Dutch consul while supporting trade, Rotary, cultural, and civic organizations.",
  'khalid-samad-2016-2016': "Khalid Samad built a public life around youth empowerment, violence prevention, and community safety in Cleveland. He served in city and school-system gang-intervention roles, co-founded Coalition for a Better Life, known as Peace in the Hood, and became a national voice on urban peace, justice, and neighborhood leadership.",
  'rev-mikhail-mikhail-2016': "Rev. Mikhail Mikhail carried Coptic Orthodox theological training from Cairo into decades of ministry and education in the United States. Ordained in 1974, he helped establish Coptic Orthodox theological education in America and served Cleveland as a priest, teacher, dean, and pastoral leader rooted in Egyptian heritage and faith.",
  'basil-russo-2017': "Basil Russo combined law, business, and Italian American cultural leadership in Cleveland and nationally. As a leader of the Order Italian Sons and Daughters of America, he strengthened heritage programming, fraternal insurance work, and public visibility while also maintaining a legal career and supporting civic and cultural causes.",
  'bill-miller-2017': "Bill Miller used storytelling, public curiosity, and civic engagement to connect Clevelanders across neighborhoods and communities. His work emphasized listening to people's lives, sharing local stories, and helping residents see the city's cultural depth, making media and public conversation part of his service to Greater Cleveland.",
  'wael-khoury-2017': "Dr. Wael Khoury built a medical career in cardiology through training at the University of Damascus, Cleveland hospitals, and Case Western Reserve University. His work included Marymount Hospital leadership, Cleveland Clinic roles, clinical research, and service with Arab American, Syrian, medical, and international-affairs organizations in Northeast Ohio.",
  'atul-mehta-2018': "Dr. Atul Mehta built a 37-year Cleveland Clinic career as a pulmonary clinician, teacher, and medical leader, helping train more than 200 international medical professionals and connect international patients with specialized care. His work included leadership in interventional pulmonology, lung transplantation, medical education, and Cleveland's Indian community.",
  'ray-pianka-2018': "Judge Ray Pianka centered his career on public service, neighborhood fairness, and Cleveland housing. After organizing Detroit-Shoreway residents and helping start the community development organization there, he became a key figure in preservation and redevelopment, helped save the Gordon Square Arcade, and brought Polish-rooted civic values to Housing Court leadership.",
  'sheila-murphy-crawford-2018': "Sheila Murphy Crawford combined teaching, Irish dance, and cultural-garden stewardship. After 32 years as an English teacher and coach, she founded the Murphy Irish Arts Center and Murphy Irish Arts Association, led dancers in Cleveland's St. Patrick's Day Parade for decades, and helped restore and animate the Irish Cultural Garden.",
  'sister-alicia-alvarado-2018': "Sister Alicia Alvarado brought Puerto Rican heritage, Catholic ministry, education, and social work into sustained service for Hispanic communities. A Dominican Sister of Peace, she held diocesan Hispanic ministry roles, directed community programs, supported Cleveland public leadership, and linked faith-based service with advocacy, organizing, and education.",
  'akram-boutros-2019': "Akram Boutros led MetroHealth through a major transformation of Cuyahoga County's public health system. His tenure included a $946 million hospital-rebuilding bond issue, expanded community health centers, emergency departments, clinics, and pharmacies, and a broader strategy connecting health care, neighborhood investment, medical education, and institutional change.",
  'richard-fleischman-2019': "Richard Fleischman shaped Cleveland architecture through more than 480 projects, over 120 awards, and a design philosophy he described as sculpted space. His work included churches, civic buildings, reused structures, furniture, planning, and sculpture, while his teaching and professional leadership connected Hungarian heritage, design education, and regional civic life.",
  'sree-sreenath-2019': "Sree Sreenath built a career at Case Western Reserve University in electrical engineering, computer science, complex systems, and global development. His work connected systems biology, sustainability, water and energy policy, international education networks, and Indian community organizing, linking technical research with civic service and global problem solving.",
  'may-chen-2020': "May Chen co-founded Asian Services in Action and helped build culturally and linguistically appropriate advocacy for Asian American and Pacific Islander communities in Akron and Greater Cleveland. Her work expanded social, health, education, youth, and senior services while strengthening community capacity, funder awareness, and Chinese American civic leadership.",
  'valarie-mccall-2020': "Valarie McCall built a public-service career spanning social work, communications, government affairs, transportation, Sister Cities leadership, and community and economic development. As a trusted Cleveland adviser and international-affairs leader, she connected policy, neighborhood opportunity, civic partnerships, and African American leadership across the city and global civic networks.",
  'taras-szmagala-2022': "Taras Szmagala grew up in Cleveland's Ukrainian American community and became a lifelong educator, civic leader, and keeper of community memory. He led Ukrainian youth and fraternal organizations, served Parma schools, and helped guide the Ukrainian Museum-Archives as a board member, chair, and executive director.",
  'victor-ruiz-2022': "Victor Ruiz built more than two decades of advocacy around education, leadership, and opportunity for Cleveland's Latinx community. As Executive Director of Esperanza, Inc., he helped raise scholarship and support-service funds, improve graduation outcomes, and strengthen civic partnerships, while also serving in major leadership roles with Cuyahoga Community College.",
  'georgine-welo-2023': "Georgine Welo grew from Serbian Orthodox youth activities into decades of cultural and civic leadership. Her service with Saint Sava, Serbian lodges, choir, dance, sports, and community events helped sustain Serbian heritage in Northeast Ohio, while her broader civic work connected business, organizing, and cultural preservation.",
  'joyce-mariani-2023': "Joyce Mariani turned a deep commitment to Italian culture into film, garden restoration, music, and public programming. She founded the Cleveland Italian Film Festival, formed the Italian Cultural Garden Foundation, led a major restoration of the Italian Cultural Garden, and created cultural series that brought Italian arts and heritage to broad Northeast Ohio audiences.",
  'michael-d-polensek-2023': "Michael D. Polensek built one of Cleveland's longest city-council careers representing northeast neighborhoods including Collinwood, North Shore Collinwood, Collinwood Village, and East Glenville. His work emphasized public safety, fair housing, neighborhood equity, lakefront access, arts and entertainment development, and grassroots organizations, reflecting Slovenian heritage and local civic service.",
  'sudarshan-sathe-2023': "Sudarshan Sathe came to Akron for graduate engineering study, built a career in chemical and metals industries, and founded NewConcepts after becoming a United States citizen. His patented products and steel-industry work were paired with philanthropy for education, hunger relief, girls' education, values-based school programs, and Indian community leadership.",
  'dona-brady-2024': "Dona Brady helped organize Cleveland's Albanian community as a founder and first president of the Albanian American Association of Cleveland. Her work included building a Sister City connection with Fier, Albania, supporting Kosovar refugee resettlement, spearheading the Albanian Cultural Garden, and serving Cleveland City Council for two decades.",
  'dr-eugene-jordan-2024': "Dr. Eugene Jordan served Cleveland and East Cleveland through dental care, civil-rights work, education, and professional leadership. He expanded access to quality care for people who could not afford it, became president of the National Dental Association, mentored students, taught Black history, and supported African American community advancement.",
  'svetlana-stolyarova-2025': "Svetlana Stolyarova carried music, philosophy, democratic activism, and business experience into Russian cultural leadership in Cleveland. After immigrating to the United States, she built cross-cultural ties through real estate, consulting, the Russian Cultural Garden, music programming, and civic work that strengthened Russian-speaking and broader multicultural communities.",
  'aklilu-demessie-2026': "Aklilu Demessie came from Ethiopia to Ohio through an American Field Service student program, then studied engineering at Case Western Reserve University after political upheaval interrupted college in Ethiopia. His life in Cleveland connected structural engineering, education, Ethiopian community service, faith, and a personal commitment to giving back.",
  'andy-fedynsky-2026': "Andy Fedynsky grew up in Cleveland's Ukrainian community after his refugee family arrived from Europe. He became a teacher, journalist, activist, and museum leader, bringing Ukrainian history into classrooms and public life while guiding the Ukrainian Museum-Archives and advocating for cultural memory, immigrant communities, and Ukraine's political rights.",
  'lucy-torres-2026': "Lucy Torres brought Puerto Rican roots, nursing education, and a lifelong ethic of service to Cleveland. After relocating from Puerto Rico in 1978, she built community leadership through family support, advocacy, cultural work, education, and care for others, becoming a visible connector in Puerto Rican civic life.",
});

const targetRepairs = Object.entries(metadata.inductees ?? {})
  .map(([id, record]) => buildRepair(id, record))
  .filter(Boolean);
const writableRepairs = targetRepairs.filter((repair) => repair.after);

const updatedMetadata = JSON.parse(JSON.stringify(metadata));
writableRepairs.forEach((repair) => {
  const record = updatedMetadata.inductees[repair.id];
  record.lifeWorkSummary = repair.after;
  record.curatorNotes = Array.from(new Set([
    ...(Array.isArray(record.curatorNotes) ? record.curatorNotes : []),
    `Life + Work summary repaired from existing CIHOF profile text on ${generatedAt.slice(0, 10)}; factual approval remains separate.`,
  ]));
});

const report = {
  schemaVersion: 1,
  generatedAt,
  dryRun,
  source: {
    updatedFile: 'data/cihof_curated_metadata.json',
    basis: 'Curated local rewrites based on existing CIHOF profile text, story summaries, and honored-for summaries.',
    excluded: ['data/external-research/*'],
    note: 'This repairs Life + Work copy shape/readability only. It does not verify facts or mark records approved.',
  },
  summary: {
    targetRecords: targetRepairs.length,
    repairedRecords: writableRepairs.length,
    byReason: countBy(targetRepairs.flatMap((repair) => repair.reasons)),
    byStrategy: countBy(targetRepairs.map((repair) => repair.strategy)),
    missingOverrides: targetRepairs.filter((repair) => !repair.after).map((repair) => repair.id),
    unresolved: writableRepairs.filter((repair) => repair.reviewFlags.length > 0).map((repair) => repair.id),
  },
  repairs: targetRepairs,
};

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, `${buildMarkdown(report)}\n`);

if (!dryRun) {
  writeFileSync(metadataPath, `${JSON.stringify(updatedMetadata, null, 2)}\n`);
}

console.log(`Life + Work summary repair ${dryRun ? 'dry run' : 'complete'}.`);
console.log(`${writableRepairs.length}/${targetRepairs.length} summaries ${dryRun ? 'would be repaired' : 'repaired'}.`);
console.log(`Strategies: ${formatCountMap(report.summary.byStrategy)}`);
console.log(`Missing overrides: ${report.summary.missingOverrides.length}`);
console.log(`Review flags: ${report.summary.unresolved.length}`);
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${markdownPath}`);
if (!dryRun) console.log(`Updated ${metadataPath}`);

function buildRepair(id, record) {
  const current = currentById.get(id);
  if (!current) return null;

  const reasons = lifeWorkReasons(current.lifeWorkSummary, current.name);
  if (!reasons.includes('truncated')) return null;

  const override = lifeWorkOverrides[id];
  if (!override) {
    return {
      id,
      name: cleanDisplayName(current.name),
      classYear: current.classYear,
      reasons,
      strategy: 'missing-override',
      before: cleanText(record.lifeWorkSummary || current.lifeWorkSummary),
      after: '',
      afterWordCount: 0,
      sourceExcerpt: current.storySummary || current.honoredForSummary,
      reviewFlags: ['missing override'],
    };
  }

  const after = ensureTerminalPunctuation(override);
  return {
    id,
    name: cleanDisplayName(current.name),
    classYear: current.classYear,
    reasons,
    strategy: 'curated-local-override',
    before: cleanText(record.lifeWorkSummary || current.lifeWorkSummary),
    after,
    afterWordCount: wordCount(after),
    sourceExcerpt: current.storySummary || current.honoredForSummary,
    reviewFlags: lifeWorkReasons(after, current.name),
  };
}

function lifeWorkReasons(value, displayName) {
  const reasons = [];
  const text = cleanText(value);
  if (!text) reasons.push('missing');
  if (hasEllipsis(text)) reasons.push('truncated');
  if (hasTemporalWording(text)) reasons.push('time-sensitive wording');
  if (hasContactLikeText(text)) reasons.push('contact/address text');
  if (hasUrlOrEmail(text)) reasons.push('url/email text');
  if (hasScrapeResidue(text)) reasons.push('scrape residue');
  if (startsWithDuplicatedName(text, displayName)) reasons.push('duplicated leading name');
  if (wordCount(text) < 45) reasons.push('too short');
  if (wordCount(text) > 140) reasons.push('too long');
  return reasons;
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

function buildNameAliases(name) {
  const cleanName = cleanDisplayName(name);
  const noHonorific = cleanName.replace(/^(Honorable|Hon\.|Dr\.|Rev\.|Reverend|Senator|Sister|Mayor|Judge|Bishop|Fr\.)\s+/i, '').trim();
  const withoutParenthetical = cleanName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return [cleanName, noHonorific, withoutParenthetical];
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

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  lines.push('# CIHOF Life + Work Summary Repair Report');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('This pass repairs only Life + Work summaries that were flagged as truncated by the text-readiness checker. It excludes `data/external-research/*` and does not mark profile, factual, or rights approval complete.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Target records: ${data.summary.targetRecords}`);
  lines.push(`- Summaries repaired: ${data.summary.repairedRecords}`);
  lines.push(`- Repair strategies: ${formatCountMap(data.summary.byStrategy)}`);
  lines.push(`- Original issue reasons: ${formatCountMap(data.summary.byReason)}`);
  lines.push(`- Missing overrides: ${data.summary.missingOverrides.length}`);
  lines.push(`- Remaining automated review flags on repaired summaries: ${data.summary.unresolved.length}`);
  lines.push('');
  lines.push('## Repairs');
  lines.push('');
  lines.push('| Person | Class | Reasons | Strategy | New Life + Work summary |');
  lines.push('| --- | ---: | --- | --- | --- |');
  data.repairs.forEach((repair) => {
    lines.push(`| ${escapeCell(repair.name)} | ${repair.classYear ?? ''} | ${escapeCell(repair.reasons.join(', '))} | ${escapeCell(repair.strategy)} | ${escapeCell(repair.after)} |`);
  });
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
