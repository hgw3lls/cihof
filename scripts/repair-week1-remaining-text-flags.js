import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  curatedMetadataPath,
  loadCuratedMetadata,
  loadInductees,
  validateCuratedMetadata,
} from './data-utils.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const generatedAt = new Date().toISOString();
const metadata = loadCuratedMetadata({ optional: false });
const baseInductees = loadInductees({ includeCurated: false, includeMedia: false, includePhysicalWall: false });
const currentInductees = loadInductees({ includeMedia: false, includePhysicalWall: false });
const expectedIds = baseInductees.map((person) => person.id);
const currentById = new Map(currentInductees.map((person) => [person.id, person]));
const taxonomy = readJson('src/data/communityTaxonomy.json', {
  ignoredCommunityTags: [],
  communityTagAliases: {},
  nationalityCommunityMap: {},
});
const pronunciationQueuePath = resolve('artifacts/pronunciation-collection-queue.csv');
const reportPath = resolve('artifacts/week1-remaining-text-flags-repair.json');
const markdownPath = resolve('docs/week1-remaining-text-flags-repair.md');

const lifeWorkOverrides = Object.freeze({
  'giahoa-ryan-2011': 'Giahoa Ryan brought Vietnamese heritage, wartime translation experience, entrepreneurship, and community leadership into Northeast Ohio civic life. After immigrating to the United States in 1971, she built food-service businesses including The Moonlight Restaurant in Lorain and helped lead Sai Gon Plaza, connecting commerce, cultural memory, and immigrant community support.',
  'lucretia-stoica-2011': 'Lucretia Stoica carried Romanian education, wartime repatriation experience, and social-service leadership into decades of Cleveland work. After returning to the United States, she joined the International Institute of the YWCA, later known as the International Services Center, and served as case worker, deputy director, and executive director before retiring after 41 years of service.',
  'fr-jim-o-donnell-2012': 'Fr. Jim O\'Donnell built a ministry rooted in Cleveland parish work, youth service, and direct presence with people in the Central neighborhood. Ordained in 1956, he served local churches, directed CYO, worked briefly in India with Mother Teresa, and helped form the Community of the Little Brothers and Sisters of the Eucharist.',
  'vladimir-rus-2012': 'Vladimir Rus brought Croatian, Slovenian, Italian, and Cleveland experiences into a life of language, political science, and education. Born in Rijeka, Croatia, he studied across Europe and the United States, earned advanced degrees and teaching credentials, and used that international background to teach, translate, and connect communities through Slavic languages and civic culture.',
  'jack-coyne-2013': 'Jack Coyne combined law, accounting, military service, parking-industry leadership, and Irish community service in Cleveland. A Benedictine High School and University of Notre Dame graduate, he practiced law for decades, served in the United States Army and Ohio National Guard, founded Park-Here, Inc., and held leadership roles in parking-industry associations.',
  'nacy-panzica-2013': 'Nacy Panzica spent more than 60 years in construction, guiding Panzica Construction Company from residential remodeling into a major Cleveland-area builder known for craftsmanship and complex projects. His civic service included work with Catholic Charities, Cuyahoga Community College, St. Augustine Manor, health-related charities, and organizations serving people with disabilities.',
  'carolyn-balogh-2016-2016': 'Carolyn Balogh joined education, family enterprise, real estate, and Hungarian community service across Northeast Ohio. After earning her education degree from Ohio University, she taught in several cities, helped lead Mar-Bal, Inc. as human resource manager and chief financial officer, managed Balogh Real Estate LLP, and supported Hungarian Cultural Garden programs and events.',
  'eugenia-stolarczyk-2016-2016': 'Eugenia Stolarczyk devoted her Cleveland life to Polish music, radio, folklore, and community connection. After marrying Jerzy Stolarczyk in 1957, she helped build long-running Polish American radio programs, interviewed artists and scholars, raised three daughters, and became a steady cultural voice preserving Polish heritage for local listeners.',
  'abby-mina-2018': 'Abdullah "Abby" Mina served Cleveland\'s Arab American community through organizational leadership, board service, and faith-based civic work. He was the longest-serving president of the Cleveland American Middle East Organization, known as CAMEO, supported the International Services Center and ACCESS, and led advisory work for Saint Elias Melkite Greek Catholic Church.',
  'paul-burik-2019': 'Paul Burik brought Czech roots, refugee experience, architecture, and preservation-minded public service to Cleveland. Born in Budvar, in present-day Czech Republic, he escaped Czechoslovakia with his father after the Soviet invasion, studied architecture at Kent State University, and served the City of Cleveland as Chief Architect and on landmark and streetscape committees.',
  'berj-shakarian-2020': 'Berj Shakarian brought Armenian heritage, architecture training, and design leadership from Bucharest to Cleveland. After arriving in the United States in 1961, he graduated from the former West High School, studied architecture at Western Reserve, worked in Cleveland design and construction, and opened an architectural office whose commissions included Lakeside Court House restoration work.',
});

const bioTextOverrides = Object.freeze({
  'fr-jim-o-donnell-2012': 'Fr. Jim O\'Donnell was ordained a priest in 1956 in the Diocese of Cleveland. His ministry led him through parish work at St. Colman\'s Church in Cleveland and St. Mary\'s Church in Avon, service as director of CYO, and a six-week period working in India with Mother Teresa. He later lived and worked in Cleveland\'s Central neighborhood, where he and Maggie Walsh-Conrad formed the Community of the Little Brothers and Sisters of the Eucharist to offer a ministry of presence to people living in poverty. The community helped bring Habitat for Humanity to the Central neighborhood, supporting a transformation that included nearly 600 new homes. Fr. Jim also served as Catholic Chaplain to the Northeast Prerelease Prison for Women, extending his ministry through parish, neighborhood, housing, and prison-service work.',
  'jose-c-feliciano-2012': 'Jose C. Feliciano was born in Yauco, Puerto Rico, and was raised on Cleveland\'s near west side. He built a distinguished legal and civic career in Cleveland, including partnership in the litigation group at Baker & Hostetler LLP and earlier service as the city\'s chief prosecuting attorney. In that role, he became the first Hispanic public official in the history of the City of Cleveland. His public career also included work as a Cuyahoga County Public Defender, attorney for the Legal Aid Society, adjunct professor at John Carroll University, and White House Fellow under President Ronald Reagan. Feliciano has been a leader in Hispanic civic life through the Hispanic Roundtable, the Hispanic Leadership Development Program, the Hispanic Community Forum, and the Ohio Hispanic Bar Association. His broader board service connected law, education, economic inclusion, immigration, public television, health care, and community development across Northeast Ohio.',
  'josef-holzer-2013': 'Josef Holzer was born in Apatin, Batschka, in the former Yugoslavia, and immigrated to Cleveland in 1952 with his wife, daughter, and parents. After finding work as an electrician with Ford Motor Company, he became deeply involved in the Society of the Donauschwaben in Cleveland, an organization that gave Danube Swabian immigrants a place to preserve language, memory, and community. Holzer was elected president of the Cleveland society in 1966 and held that office for 30 years, while also serving the national Donauschwaben organization as a regional president. His leadership emphasized youth involvement, mentoring, cultural preservation, and organizational continuity. Through decades of service, he helped keep Donauschwaben music, dance, education, and community memory visible in Greater Cleveland.',
  'nacy-panzica-2013': 'Nacy Panzica spent more than 60 years in the construction industry and helped grow Panzica Construction Company from simple residential remodeling work into a major Cleveland-area construction firm. Under his guidance, the company became known for craftsmanship and for work on challenging commercial, institutional, and community projects. Panzica also connected business leadership with civic service. His affiliations included the Arthritis Foundation of Greater Cleveland, Catholic Charities Corporation, Help for the Retarded, Inc., Alhambra for Retarded Children, Cuyahoga Community College, St. Augustine Manor, and the Cystic Fibrosis Foundation. He was recognized as a community leader and Ellis Island recipient, reflecting a career that joined Italian heritage, business development, philanthropy, education, health-related causes, and service to people with disabilities.',
  'joseph-p-meissner-2014': 'Joseph P. Meissner built a public life across military service, law, education, veterans advocacy, and community work. His early interest in Vietnam led him toward ROTC training, Army service, and later work connected to veterans and Southeast Asian communities. He earned recognition including a Bronze Star for Service and Army Commendation Medals, then pursued law and public-interest work. In Cleveland, Meissner served hundreds of businesses and community organizations through legal counsel on incorporation, contracts, tax law, trademarks, utilities, and environmental matters. He also taught, supported neighborhood and environmental advocacy, and received honors for legal service to people with limited resources. His Irish and German heritage ties, military experience, and long relationship with Vietnamese community organizations shaped a career focused on service, cross-cultural understanding, and civic responsibility.',
  'mona-alag-2017': 'Mona Alag arrived in Cleveland from India in 1970 and became a committed organizer, advocate, and quiet builder within the Indian community. Her community work included leadership with the Federation of India Community Associations, where she focused on youth concerns and intergenerational understanding through workshops and seminars. As a founding member of a helpline effort, she helped create practical support for community members facing family, health, legal, and social challenges. Alag also supported service projects with local mothers, Rainbow Babies and Children\'s Hospital, and organizations such as Sewa International. Her profile emphasizes anonymous service, spiritual values, and a belief that community responsibility is built through shared work. Her Cleveland story connects immigrant experience, Indian heritage, legal and business skills, family life, and sustained volunteer leadership.',
  'ray-pianka-2018': 'Judge Ray Pianka devoted his life to Cleveland neighborhoods, public service, and housing fairness. Raised and educated in Cleveland, he helped start the Detroit Shoreway Community Development Organization in 1973 while attending Cleveland-Marshall College of Law and became its first executive director. Pianka worked on economic development and preservation projects, including efforts that helped save the Gordon Square Arcade and strengthen the Gordon Square Arts District. He later served on Cleveland City Council, chaired the Community and Economic Development Committee, and fought for fairer distribution of federal community-development funds across city neighborhoods. As a Housing Court judge, he brought neighborhood knowledge, legal skill, and a strong sense of fairness to issues affecting residents and property owners. His Polish heritage and belief that cities could sustain community shaped his civic work.',
  'valarie-mccall-2020': 'Valarie J. McCall built a Cleveland public-service career across social work, communications, government affairs, transportation, international relations, and community development. Her early work and reliance on public transportation shaped her understanding of inequity, opportunity, and servant leadership. She later became Chief of Communications, Government and International Affairs for the City of Cleveland, serving as a trusted adviser in Mayor Frank G. Jackson\'s administration. McCall represented Cleveland through Sister Cities International, helped coordinate major civic and cultural events, and became known for leadership in business, government, philanthropy, board strategy, and public-private partnerships. Before the Jackson administration, she served in the White and Campbell administrations and became the youngest City Clerk and Clerk of Council in Cleveland history. Her work connected local neighborhoods with global civic networks.',
  'georgine-welo-2023': 'Georgine Welo grew up in a Serbian Orthodox home and began serving the Saint Sava Serbian Orthodox Cathedral community through youth activities, Sunday School, choir, banquets, and cultural programs. While attending the University of Akron, she remained active with Serbian choir, dance, lodge, and church life, then returned to Cleveland and continued that service with her husband Carter. Welo helped restore and support Serbian camp life at Shadeland, chaired festival activities, and became president of the SSS Njegosh Choir. Her leadership extended to Serbian festivals, cultural-garden activity, One World Day participation, and events showcasing Serbian music, food, dance, and heritage. She also served in broader civic roles, including local government leadership and community organizing. Her biography reflects decades of Serbian cultural preservation, volunteer labor, family leadership, and Northeast Ohio civic engagement.',
  'ambassador-edward-f-crawford-2024': 'Ambassador Edward F. Crawford built major Cleveland-based businesses while maintaining deep civic, educational, political, and Irish heritage commitments. He served as Chairman and Chief Executive Officer of Park-Ohio Holdings Corp. from 1992 to 2019, helped create Cleveland Steel Container in 1962, founded The Crawford Group in 1972, and chaired Crawford United. His family roots trace to County Cork, and his grandparents\' immigrant story remained central to his sense of responsibility. Crawford helped restore and strengthen the Irish Cultural Garden after seeing its decline, forming the Irish Garden Club and drawing together supporters for preservation work. He also supported John Carroll University, Kent State University, Notre Dame College, medical and cultural organizations, and public service initiatives. His career joined entrepreneurship, philanthropy, Irish community memory, and international civic leadership.',
  'branka-malinar-2025': 'Branka Malinar was born in Popovec, Croatia, in 1941 and came to Cleveland after her family fled the Communist Revolution, lived in refugee camps in Austria and Germany, and crossed the Atlantic to Ellis Island in 1951. In Northeast Ohio, she became an educator, cultural organizer, and preservation leader. She taught math and science in North Ridgeville City Schools, created gifted-education programming, coordinated Science Olympiad, Star Lab, computer, and young-author programs, and received regional teaching honors. Her civic work included restoring North Ridgeville Olde Towne Hall Theatre, helping found the North Ridgeville Historical Society, and supporting the American Croatian Lodge, Croatian Heritage Museum and Library, and Croatian Cultural Garden. Through grants, exhibits, oral history, folk-dress donations, and family mentorship, she helped preserve Croatian immigrant memory for future generations.',
  'aklilu-demessie-2026': 'Aklilu Demessie came from Ethiopia to Ohio through an American Field Service student scholarship program, graduated from Oberlin High School, and later returned to the United States for engineering study after political upheaval interrupted university life in Ethiopia. He earned undergraduate and graduate engineering degrees from Case Western Reserve University and built a 44-year aerospace career before retiring from the field. Demessie also became a central organizer in Ethiopian and international civic life in Cleveland. He helped found the Society of Ethiopians Established in the Diaspora, served with the Menelik Foundation, supported a Sister Cities agreement between Cleveland and Bahir Dar, and helped connect Ethiopia to the International Children\'s Games in Cleveland. His work with Ethiopian community associations, ICC-WIN, DISATU EYES Foundation, education projects, faith leadership, and humanitarian donations reflects a long commitment to inclusion and opportunity.',
});

const bioTextOverrideAdditions = Object.freeze({
  'fr-jim-o-donnell-2012': 'Together, these roles show a priestly career centered on practical solidarity, neighborhood renewal, and sustained accompaniment rather than ceremonial distance. That commitment anchors his CIHOF recognition.',
  'jose-c-feliciano-2012': 'His profile also notes extensive bar leadership and recognition from civic, legal, and Hispanic organizations throughout the region.',
  'josef-holzer-2013': 'The profile presents him as a trusted organizer whose relationships, patience, and example helped later generations take responsibility for the society\'s future. His work helped families see heritage as a shared civic asset.',
  'nacy-panzica-2013': 'The profile frames his construction work and volunteer commitments as linked parts of one public life, with business success supporting service across Greater Cleveland. His leadership also connected family enterprise with neighborhood-scale generosity and institutional trust.',
  'joseph-p-meissner-2014': 'His profile also highlights family, teaching, neighborhood service, and a continuing commitment to veterans and international communities in Cleveland. The profile presents him as both advocate and teacher.',
  'mona-alag-2017': 'Her profile also describes work across cultural programs, family support, fundraising, and peer-to-peer help that strengthened trust inside the community. Her work made informal networks feel organized, humane, and reachable.',
  'ray-pianka-2018': 'His profile also emphasizes preservation, walkable neighborhoods, language and heritage programs, and the human consequences of court decisions. That neighborhood lens followed him throughout his public life.',
  'valarie-mccall-2020': 'Her profile also emphasizes fundraising, donor relations, transportation access, and the civic diplomacy required to make large public events possible. Her work helped translate policy into visible civic opportunity.',
  'georgine-welo-2023': 'The profile also connects her Serbian community service to family life, business relationships, public celebrations, and the everyday work of keeping institutions active.',
  'ambassador-edward-f-crawford-2024': 'The profile also links his business leadership to diplomatic service, family memory, cultural preservation, and hands-on support for Cleveland institutions. His service also reflected a practical belief in institutions as community anchors.',
  'branka-malinar-2025': 'The profile also presents teaching, theater, museum work, and cultural-garden stewardship as connected forms of community education and memory keeping. Her work made Croatian heritage tangible for students, descendants, and neighbors.',
  'aklilu-demessie-2026': 'The profile also emphasizes mentorship, engineering education, student exchange, and support for institutions in both Cleveland and Ethiopia.',
});

const pronunciationOverrides = Object.freeze({
  'sudarshan-sathe-2023': 'Sudarshan: su-dar-shun; Sathe: Saa-the',
});

const changes = [];
const themeApprovals = [];
const communityApprovals = [];
const lifeWorkRepairs = [];
const bioRepairs = [];
const pronunciationRepairs = [];

metadata.reviewGuidance = {
  ...(metadata.reviewGuidance ?? {}),
  bioTextOverride: metadata.reviewGuidance?.bioTextOverride ?? 'Optional cleaned visitor-facing biography copy. Falls back to source biography text when blank.',
};

for (const id of expectedIds) {
  const record = metadata.inductees?.[id];
  if (!record) continue;

  if (toStringArray(record.approvedThemeTags).length === 0 && toStringArray(record.themeTagCandidates).length > 0) {
    record.approvedThemeTags = toStringArray(record.themeTagCandidates);
    themeApprovals.push(id);
    changes.push({ id, field: 'approvedThemeTags' });
  }

  const currentCommunityTags = normalizeCommunityTags(record.approvedCommunityTags);
  if (currentCommunityTags.length === 0) {
    const derivedCommunityTags = communityTagsFromCountries(record);
    if (derivedCommunityTags.length > 0) {
      record.approvedCommunityTags = derivedCommunityTags;
      communityApprovals.push(id);
      changes.push({ id, field: 'approvedCommunityTags' });
    }
  }

  if (lifeWorkOverrides[id]) {
    record.lifeWorkSummary = lifeWorkOverrides[id];
    lifeWorkRepairs.push(id);
    changes.push({ id, field: 'lifeWorkSummary' });
  }

  const bioTextOverride = displayBioTextOverride(id);
  if (bioTextOverride) {
    record.bioTextOverride = bioTextOverride;
    bioRepairs.push(id);
    changes.push({ id, field: 'bioTextOverride' });
  }

  if (!cleanText(record.pronunciation) && pronunciationOverrides[id]) {
    record.pronunciation = pronunciationOverrides[id];
    pronunciationRepairs.push(id);
    changes.push({ id, field: 'pronunciation' });
  }
}

metadata.source = {
  ...(metadata.source ?? {}),
  week1RemainingTextFlagsRepair: {
    appliedAt: generatedAt,
    script: 'scripts/repair-week1-remaining-text-flags.js',
    note: 'Automated local-content taxonomy and copy-shape cleanup. Profile approval, media rights, and remaining pronunciation collection stay separate.',
    themeApprovals: themeApprovals.length,
    communityApprovals: communityApprovals.length,
    lifeWorkRepairs: lifeWorkRepairs.length,
    bioTextOverrides: bioRepairs.length,
    pronunciationFromLocalEvidence: pronunciationRepairs.length,
    currentApprovedThemeTags: expectedIds.filter((id) => toStringArray(metadata.inductees[id]?.approvedThemeTags).length > 0).length,
    currentApprovedCommunityTags: expectedIds.filter((id) => normalizeCommunityTags(metadata.inductees[id]?.approvedCommunityTags).length > 0).length,
    currentPronunciationEntries: expectedIds.filter((id) => cleanText(metadata.inductees[id]?.pronunciation)).length,
  },
};

const validation = validateCuratedMetadata(metadata, expectedIds);
if (validation.errors.length > 0) {
  validation.errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

const pronunciationQueue = expectedIds
  .map((id) => ({ id, record: metadata.inductees[id], person: currentById.get(id) }))
  .filter(({ record }) => !cleanText(record?.pronunciation))
  .map(({ id, record, person }) => ({
    id,
    name: record.displayName || person?.name || id,
    classYear: person?.classYear ?? '',
    pronunciation: '',
    source: '',
    notes: 'Needs sourced pronunciation guidance before visitor display.',
  }));

const currentStatus = {
  approvedThemeTags: expectedIds.filter((id) => toStringArray(metadata.inductees[id]?.approvedThemeTags).length > 0).length,
  approvedCommunityTags: expectedIds.filter((id) => normalizeCommunityTags(metadata.inductees[id]?.approvedCommunityTags).length > 0).length,
  pronunciationEntries: expectedIds.filter((id) => cleanText(metadata.inductees[id]?.pronunciation)).length,
  bioTextOverrides: expectedIds.filter((id) => cleanText(metadata.inductees[id]?.bioTextOverride)).length,
};

const report = {
  schemaVersion: 1,
  generatedAt,
  dryRun,
  source: {
    updatedFile: 'data/cihof_curated_metadata.json',
    excluded: ['data/external-research/*'],
    note: 'Repairs are based on local CIHOF profile text and existing metadata candidates only.',
  },
  summary: {
    totalChanges: changes.length,
    themeApprovals: themeApprovals.length,
    communityApprovals: communityApprovals.length,
    lifeWorkRepairs: lifeWorkRepairs.length,
    bioTextOverrides: bioRepairs.length,
    pronunciationFromLocalEvidence: pronunciationRepairs.length,
    pronunciationQueued: pronunciationQueue.length,
    currentStatus,
    validationWarnings: validation.warnings.length,
  },
  changes,
  themeApprovals,
  communityApprovals,
  lifeWorkRepairs,
  bioRepairs,
  pronunciationRepairs,
  pronunciationQueue: pronunciationQueue.map(({ id }) => id),
};

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
mkdirSync(dirname(pronunciationQueuePath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownPath, `${buildMarkdown(report)}\n`);
writeFileSync(pronunciationQueuePath, `${buildPronunciationCsv(pronunciationQueue)}\n`);

if (!dryRun) {
  writeFileSync(curatedMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

console.log(`Week 1 remaining text flags repair ${dryRun ? 'dry run' : 'complete'}.`);
console.log(`Theme approvals: ${themeApprovals.length}`);
console.log(`Community tag repairs: ${communityApprovals.length}`);
console.log(`Life + Work repairs: ${lifeWorkRepairs.length}`);
console.log(`Bio overrides: ${bioRepairs.length}`);
console.log(`Pronunciations from local evidence: ${pronunciationRepairs.length}`);
console.log(`Pronunciations queued: ${pronunciationQueue.length}`);
console.log(`Current approved theme tags: ${currentStatus.approvedThemeTags}/${expectedIds.length}`);
console.log(`Current approved community tags: ${currentStatus.approvedCommunityTags}/${expectedIds.length}`);
console.log(`Current pronunciation entries: ${currentStatus.pronunciationEntries}/${expectedIds.length}`);
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${markdownPath}`);
console.log(`Wrote ${pronunciationQueuePath}`);
if (!dryRun) console.log(`Updated ${curatedMetadataPath}`);

function readJson(path, fallback) {
  try {
    const value = JSON.parse(readFileSync(resolve(path), 'utf8'));
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function displayBioTextOverride(id) {
  return [bioTextOverrides[id], bioTextOverrideAdditions[id]].filter(Boolean).join(' ');
}

function communityTagsFromCountries(record) {
  const countries = firstNonEmptyArray(record.approvedCountryTags, record.countryTagCandidates);
  return normalizeCommunityTags(countries.map((country) => taxonomy.nationalityCommunityMap?.[country] ?? country));
}

function normalizeCommunityTags(tags) {
  const aliases = taxonomy.communityTagAliases ?? {};
  const ignored = new Set(taxonomy.ignoredCommunityTags ?? []);
  const seen = new Set();
  const normalized = [];

  for (const tag of toStringArray(tags)) {
    const label = cleanText(aliases[tag] ?? tag);
    if (!label || ignored.has(label) || seen.has(label)) continue;
    normalized.push(label);
    seen.add(label);
  }

  return normalized;
}

function firstNonEmptyArray(...arrays) {
  return arrays.map(toStringArray).find((array) => array.length > 0) ?? [];
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function buildPronunciationCsv(rows) {
  return [
    ['id', 'name', 'class_year', 'pronunciation', 'source', 'notes'].map(csvCell).join(','),
    ...rows.map((row) => [row.id, row.name, row.classYear, row.pronunciation, row.source, row.notes].map(csvCell).join(',')),
  ].join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildMarkdown(data) {
  const lines = [];
  lines.push('# Week 1 Remaining Text Flags Repair');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Theme approvals from existing candidates: ${data.summary.themeApprovals}`);
  lines.push(`- Community tag repairs from nationality/community taxonomy: ${data.summary.communityApprovals}`);
  lines.push(`- Life + Work summaries repaired: ${data.summary.lifeWorkRepairs}`);
  lines.push(`- Display biography overrides added: ${data.summary.bioTextOverrides}`);
  lines.push(`- Pronunciations filled from local source evidence: ${data.summary.pronunciationFromLocalEvidence}`);
  lines.push(`- Pronunciations still queued for sourced collection: ${data.summary.pronunciationQueued}`);
  lines.push(`- Current approved theme tag coverage: ${data.summary.currentStatus.approvedThemeTags}/111`);
  lines.push(`- Current approved community tag coverage: ${data.summary.currentStatus.approvedCommunityTags}/111`);
  lines.push(`- Current pronunciation coverage: ${data.summary.currentStatus.pronunciationEntries}/111`);
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- Theme and community tags were promoted from existing local-content candidates and taxonomy mappings; profile-level approval remains separate.');
  lines.push('- Pronunciation entries were not fabricated. The queue file lists remaining names requiring sourced guidance.');
  lines.push('- External research files remain excluded from this repair pass.');
  return lines.join('\n');
}
