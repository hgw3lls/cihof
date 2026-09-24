import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadInductees } from './data-utils.js';

const outputPath = resolve('data/external-research/cihof-external-source-candidates.json');
const csvOutputPath = resolve('data/external-research/cihof-external-source-candidates.csv');
const excludedDomains = ['clevelandinternationalhalloffame.com', 'clevelandpeople.com'];
const args = parseArgs(process.argv.slice(2));
const limit = Number.isFinite(args.limit) ? args.limit : Infinity;
const delayMs = Number.isFinite(args.delayMs) ? args.delayMs : 1250;
const minStrongMatchScore = Number.isFinite(args.minScore) ? args.minScore : 0.72;
const requestTimeoutMs = Number.isFinite(args.timeoutMs) ? args.timeoutMs : 8000;
const personFilter = args.person ? new Set(String(args.person).split(',').map((item) => item.trim()).filter(Boolean)) : null;

const inductees = loadInductees({ includeMedia: false });
// A partial run (--person or --limit) refreshes the people it selects and keeps
// everyone else's last collected record. Otherwise retrying one rate-limited
// person would rewrite the whole report as a one-record file.
const partialRun = Boolean(personFilter) || Number.isFinite(args.limit);
const records = partialRun ? previousRecords(inductees) : {};
const selectedInductees = inductees
  .filter((person) => !personFilter || personFilter.has(person.id) || personFilter.has(person.name))
  .slice(0, limit);

if (selectedInductees.length === 0) {
  console.error('No inductees selected.');
  process.exit(1);
}

console.log(`Collecting external source candidates for ${selectedInductees.length} of ${inductees.length} inductees.`);
console.log(`Excluding domains: ${excludedDomains.join(', ')}`);

let completed = 0;
for (const person of selectedInductees) {
  completed += 1;
  try {
    records[person.id] = await collectPerson(person);
    const summary = records[person.id].summary;
    console.log(
      `[${String(completed).padStart(3, ' ')}/${selectedInductees.length}] ${person.name}: ${summary.wikipediaStatus}, ${summary.wikidataStatus}, ${summary.officialSiteLeadCount} official-site lead${summary.officialSiteLeadCount === 1 ? '' : 's'}`,
    );
  } catch (error) {
    records[person.id] = failedPersonRecord(person, error);
    console.warn(`[${String(completed).padStart(3, ' ')}/${selectedInductees.length}] ${person.name}: collection failed (${error.message})`);
  }
  await delay(delayMs);
}

const report = buildReport(inductees, selectedInductees, records);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(csvOutputPath, `${buildCsv(report)}\n`);

console.log(`External research collection complete.`);
console.log(`${report.summary.recordsCollected}/${report.summary.totalInductees} records collected.`);
console.log(`${report.summary.wikipediaStrongMatches} strong Wikipedia matches.`);
console.log(`${report.summary.wikidataStrongMatches} strong Wikidata matches.`);
console.log(`${report.summary.recordsWithOfficialSiteLeads} records with official-site leads.`);
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${csvOutputPath}`);

function previousRecords(currentInductees) {
  let previous;
  try {
    previous = JSON.parse(readFileSync(outputPath, 'utf8')).records ?? {};
  } catch {
    return {};
  }
  const currentIds = new Set(currentInductees.map((person) => person.id));
  return Object.fromEntries(Object.entries(previous).filter(([id]) => currentIds.has(id)));
}

function parseArgs(rawArgs) {
  const parsed = {};
  rawArgs.forEach((arg, index) => {
    if (arg === '--limit') parsed.limit = Number(rawArgs[index + 1]);
    else if (arg.startsWith('--limit=')) parsed.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--delay-ms') parsed.delayMs = Number(rawArgs[index + 1]);
    else if (arg.startsWith('--delay-ms=')) parsed.delayMs = Number(arg.slice('--delay-ms='.length));
    else if (arg === '--min-score') parsed.minScore = Number(rawArgs[index + 1]);
    else if (arg.startsWith('--min-score=')) parsed.minScore = Number(arg.slice('--min-score='.length));
    else if (arg === '--timeout-ms') parsed.timeoutMs = Number(rawArgs[index + 1]);
    else if (arg.startsWith('--timeout-ms=')) parsed.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg === '--person') parsed.person = rawArgs[index + 1];
    else if (arg.startsWith('--person=')) parsed.person = arg.slice('--person='.length);
  });
  return parsed;
}

async function collectPerson(person) {
  const aliases = buildNameAliases(person.name);
  const contextTerms = buildContextTerms(person);
  const wikidata = await collectWikidata(person, aliases, contextTerms);
  const wikipedia = await collectWikipedia(person, aliases, contextTerms, wikidata.match);
  const officialSite = await collectOfficialSiteLeads(person, wikidata);
  const officialSiteLeads = officialSite.leads;
  const facts = buildFactStubs(person, wikipedia, wikidata, officialSiteLeads);
  const needsReview = true;

  return {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    region: person.region,
    collectionStatus: 'collected-needs-review',
    needsReview,
    sourcePolicy: {
      excludedDomains,
      integrationStatus: 'not-integrated',
      note: 'External source candidates only. Do not merge into canonical data without curator review.',
    },
    queries: {
      wikipedia: buildWikipediaQueries(person, aliases),
      wikidata: aliases.slice(0, 3),
      officialSiteLead: buildOfficialSiteQuery(person, aliases[0]),
    },
    wikipedia,
    wikidata,
    officialSiteLeads,
    officialSiteSourceErrors: officialSite.sourceErrors,
    facts,
    summary: {
      wikipediaStatus: wikipedia.status,
      wikidataStatus: wikidata.status,
      officialSiteLeadCount: officialSiteLeads.length,
      factStubCount: facts.length,
      sourceErrorCount: wikipedia.sourceErrors.length + wikidata.sourceErrors.length + officialSite.sourceErrors.length,
      reviewReason: summarizeReviewReason(wikipedia, wikidata, officialSiteLeads),
    },
  };
}

async function collectWikidata(person, aliases, contextTerms) {
  const searchResults = [];
  const sourceErrors = [];
  for (const alias of aliases.slice(0, 1)) {
    try {
      const results = await wikidataSearch(alias);
      results.forEach((result) => {
        if (!searchResults.some((existing) => existing.id === result.id)) searchResults.push(result);
      });
    } catch (error) {
      sourceErrors.push({ source: 'wikidata-search', query: alias, message: error.message });
    }
    if (searchResults.length >= 8) break;
    await delay(160);
  }

  const entityIds = searchResults.map((result) => result.id).slice(0, 5);
  let entities = {};
  if (entityIds.length > 0) {
    try {
      entities = await wikidataEntities(entityIds);
    } catch (error) {
      sourceErrors.push({ source: 'wikidata-entities', query: entityIds.join('|'), message: error.message });
    }
  }
  const candidates = [];
  for (const result of searchResults.slice(0, 5)) {
    try {
      const entity = entities[result.id];
      const candidate = await wikidataCandidate(person, aliases, contextTerms, result, entity);
      candidates.push(candidate);
    } catch (error) {
      sourceErrors.push({ source: 'wikidata-candidate', query: result.id, message: error.message });
    }
  }
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const match = sorted.find((candidate) => candidate.isHumanLikely && isStrongIdentityCandidate(candidate)) ?? null;

  return {
    status: match ? 'strong-match' : sorted.length > 0 ? 'candidates-only' : 'not-found',
    match,
    candidates: sorted.slice(0, 5),
    sourceErrors,
  };
}

async function wikidataSearch(search) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', 'en');
  url.searchParams.set('uselang', 'en');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '5');
  url.searchParams.set('search', search);

  const json = await fetchJson(url);
  return Array.isArray(json.search) ? json.search : [];
}

async function wikidataEntities(ids) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('format', 'json');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('props', 'labels|descriptions|aliases|claims|sitelinks');
  url.searchParams.set('sitefilter', 'enwiki');
  url.searchParams.set('ids', ids.join('|'));

  const json = await fetchJson(url);
  return json.entities ?? {};
}

async function wikidataCandidate(person, aliases, contextTerms, result, entity) {
  const claims = entity?.claims ?? {};
  const label = entity?.labels?.en?.value || result.label || '';
  const description = entity?.descriptions?.en?.value || result.description || '';
  const aliasValues = Object.values(entity?.aliases?.en ?? {}).map((alias) => alias.value).filter(Boolean);
  const enwikiTitle = entity?.sitelinks?.enwiki?.title || '';
  const officialWebsites = valuesForClaim(claims, 'P856')
    .map((value) => String(value).trim())
    .filter((value) => value && !isExcludedUrl(value));
  const birthDate = firstTimeClaim(claims, 'P569');
  const candidateBirthYear = yearFromDateString(birthDate);
  const expectedBirthYear = extractBirthYear(person.bioText);
  const expectedMiddleInitial = middleInitialForName(`${person.name} ${person.bioText}`, aliases);
  const instanceOfIds = entityIdsForClaim(claims, 'P31');
  const occupationIds = entityIdsForClaim(claims, 'P106');
  const citizenshipIds = entityIdsForClaim(claims, 'P27');
  const educatedAtIds = entityIdsForClaim(claims, 'P69');
  const employerIds = entityIdsForClaim(claims, 'P108');
  const awardIds = entityIdsForClaim(claims, 'P166');
  const birthplaceIds = entityIdsForClaim(claims, 'P19');
  const deathplaceIds = entityIdsForClaim(claims, 'P20');
  const labelIds = [...new Set([...occupationIds, ...citizenshipIds, ...educatedAtIds, ...employerIds, ...awardIds, ...birthplaceIds, ...deathplaceIds])];
  const labels = Object.fromEntries(labelIds.map((id) => [id, id]));
  const candidateText = `${label} ${aliasValues.join(' ')} ${enwikiTitle} ${description}`;
  const contextMatches = distinctiveContextMatches(contextTerms, candidateText, aliases, person);
  const candidateMiddleInitial = middleInitialForName(candidateText, aliases);
  const middleInitialMismatch = hasMiddleInitialMismatch(expectedMiddleInitial, candidateMiddleInitial);
  const baseScore = scoreCandidate({
    expectedAliases: aliases,
    candidateLabels: [label, ...aliasValues, enwikiTitle],
    description,
    contextTerms,
    hasWikipedia: Boolean(enwikiTitle),
    hasOfficialWebsite: officialWebsites.length > 0,
  });
  const birthYearMismatch = hasBirthYearMismatch(expectedBirthYear, candidateBirthYear);
  const score = round(Math.max(0, baseScore - (birthYearMismatch ? 0.3 : 0) - (middleInitialMismatch ? 0.2 : 0)));
  const reasons = explainScore({
    expectedAliases: aliases,
    candidateLabels: [label, ...aliasValues, enwikiTitle],
    description,
    contextTerms,
    hasWikipedia: Boolean(enwikiTitle),
    hasOfficialWebsite: officialWebsites.length > 0,
  });
  if (birthYearMismatch) reasons.push('birth-year-mismatch');
  if (middleInitialMismatch) reasons.push('middle-initial-mismatch');

  return {
    id: result.id,
    url: `https://www.wikidata.org/wiki/${result.id}`,
    label,
    description,
    aliases: aliasValues.slice(0, 8),
    score,
    isHumanLikely: instanceOfIds.includes('Q5') || /person|politician|business|chemist|bishop|lawyer|judge|executive|educator|journalist|physician|artist|activist/i.test(description),
    reasons,
    contextMatches,
    expectedBirthYear,
    candidateBirthYear,
    expectedMiddleInitial,
    candidateMiddleInitial,
    wikipediaTitle: enwikiTitle,
    wikipediaUrl: enwikiTitle ? wikipediaUrlForTitle(enwikiTitle) : '',
    officialWebsites,
    claims: {
      birthDate: firstTimeClaim(claims, 'P569'),
      deathDate: firstTimeClaim(claims, 'P570'),
      image: firstValue(claims, 'P18'),
      occupations: occupationIds.map((id) => ({ id, label: labels[id] || id })),
      citizenships: citizenshipIds.map((id) => ({ id, label: labels[id] || id })),
      educatedAt: educatedAtIds.map((id) => ({ id, label: labels[id] || id })),
      employers: employerIds.map((id) => ({ id, label: labels[id] || id })),
      awards: awardIds.map((id) => ({ id, label: labels[id] || id })),
      birthPlaces: birthplaceIds.map((id) => ({ id, label: labels[id] || id })),
      deathPlaces: deathplaceIds.map((id) => ({ id, label: labels[id] || id })),
    },
  };
}

async function collectWikipedia(person, aliases, contextTerms, wikidataMatch) {
  const candidates = [];
  const sourceErrors = [];

  for (const alias of aliases.slice(0, 1)) {
    try {
      const summary = await wikipediaSummary(alias);
      if (summary) candidates.push(wikipediaCandidate(person, aliases, contextTerms, summary, 'exact-title-summary'));
    } catch (error) {
      sourceErrors.push({ source: 'wikipedia-summary', query: alias, message: error.message });
    }
    await delay(120);
  }

  if (wikidataMatch?.wikipediaTitle) {
    try {
      const summary = await wikipediaSummary(wikidataMatch.wikipediaTitle);
      if (summary) candidates.push(wikipediaCandidate(person, aliases, contextTerms, summary, 'wikidata-sitelink'));
    } catch (error) {
      sourceErrors.push({ source: 'wikipedia-summary', query: wikidataMatch.wikipediaTitle, message: error.message });
    }
  }

  for (const query of buildWikipediaQueries(person, aliases).slice(0, 1)) {
    let results = [];
    try {
      results = await wikipediaSearch(query);
    } catch (error) {
      sourceErrors.push({ source: 'wikipedia-search', query, message: error.message });
      if (/429/.test(error.message)) break;
    }
    for (const result of results.slice(0, 2)) {
      try {
        const title = result.title;
        if (candidates.some((candidate) => candidate.title === title)) continue;
        const summary = await wikipediaSummary(title);
        if (summary) candidates.push(wikipediaCandidate(person, aliases, contextTerms, summary, 'wikipedia-search'));
      } catch (error) {
        sourceErrors.push({ source: 'wikipedia-summary', query: result.title, message: error.message });
        if (/429/.test(error.message)) break;
      }
      await delay(180);
    }
    if (candidates.length >= 6) break;
    await delay(180);
  }

  if (candidates.length === 0) {
    for (const query of buildWikipediaFallbackQueries(person, aliases)) {
      try {
        const results = await webSearch(query, sourceErrors);
        for (const result of results.filter((item) => domainForUrl(item.url).endsWith('wikipedia.org')).slice(0, 3)) {
          const title = wikipediaTitleFromUrl(result.url);
          if (!title || candidates.some((candidate) => candidate.title === title)) continue;
          const summary = await wikipediaSummary(title);
          if (summary) candidates.push(wikipediaCandidate(person, aliases, contextTerms, summary, 'duckduckgo-wikipedia-search'));
          await delay(180);
        }
      } catch (error) {
        sourceErrors.push({ source: 'web-wikipedia-search', query, message: error.message });
      }
      if (candidates.length > 0) break;
      await delay(180);
    }
  }

  const sorted = candidates
    .filter((candidate) => !isExcludedUrl(candidate.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const match = sorted.find(isStrongIdentityCandidate) ?? null;

  return {
    status: match ? 'strong-match' : sorted.length > 0 ? 'candidates-only' : 'not-found',
    match,
    candidates: sorted,
    sourceErrors,
  };
}

async function wikipediaSearch(search) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'opensearch');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('namespace', '0');
  url.searchParams.set('search', search);

  const json = await fetchJson(url);
  const titles = Array.isArray(json[1]) ? json[1] : [];
  const descriptions = Array.isArray(json[2]) ? json[2] : [];
  const urls = Array.isArray(json[3]) ? json[3] : [];
  return titles.map((title, index) => ({
    title,
    snippet: descriptions[index] ?? '',
    url: urls[index] ?? wikipediaUrlForTitle(title),
  }));
}

async function wikipediaSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetchWithTimeout(url, { headers: requestHeaders() });
  if (!response.ok) return null;
  const json = await response.json();
  if (json.type === 'disambiguation') return null;
  return json;
}

function wikipediaCandidate(person, aliases, contextTerms, summary, discoveryMethod) {
  const title = summary.title || '';
  const description = summary.description || '';
  const extract = summary.extract || '';
  const url = summary.content_urls?.desktop?.page || wikipediaUrlForTitle(title);
  const candidateText = `${title} ${summary.displaytitle || ''} ${description} ${extract}`;
  const expectedBirthYear = extractBirthYear(person.bioText);
  const candidateBirthYear = extractBirthYear(candidateText);
  const expectedMiddleInitial = middleInitialForName(`${person.name} ${person.bioText}`, aliases);
  const candidateMiddleInitial = middleInitialForName(candidateText, aliases);
  const middleInitialMismatch = hasMiddleInitialMismatch(expectedMiddleInitial, candidateMiddleInitial);
  const contextMatches = distinctiveContextMatches(contextTerms, candidateText, aliases, person);
  const baseScore = scoreCandidate({
    expectedAliases: aliases,
    candidateLabels: [title, summary.displaytitle],
    description: candidateText,
    contextTerms,
    hasWikipedia: true,
    hasOfficialWebsite: false,
  });
  const birthYearMismatch = hasBirthYearMismatch(expectedBirthYear, candidateBirthYear);
  const score = round(Math.max(0, baseScore - (birthYearMismatch ? 0.3 : 0) - (middleInitialMismatch ? 0.2 : 0)));
  const reasons = explainScore({
    expectedAliases: aliases,
    candidateLabels: [title, summary.displaytitle],
    description: candidateText,
    contextTerms,
    hasWikipedia: true,
    hasOfficialWebsite: false,
  });
  if (birthYearMismatch) reasons.push('birth-year-mismatch');
  if (middleInitialMismatch) reasons.push('middle-initial-mismatch');

  return {
    title,
    pageId: summary.pageid ?? null,
    url,
    description,
    extract,
    thumbnailUrl: summary.thumbnail?.source || '',
    wikidataId: summary.wikibase_item || '',
    discoveryMethod,
    score,
    reasons,
    contextMatches,
    expectedBirthYear,
    candidateBirthYear,
    expectedMiddleInitial,
    candidateMiddleInitial,
  };
}

async function collectOfficialSiteLeads(person, wikidata) {
  const leads = [];
  const sourceErrors = [];
  const wikidataOfficialSites = wikidata.match?.officialWebsites ?? [];

  wikidataOfficialSites.forEach((url) => {
    addOfficialLead(leads, {
      url,
      title: '',
      snippet: '',
      source: 'wikidata:P856',
      confidence: 'claimed-official',
      reviewStatus: 'collected-needs-review',
    });
  });

  const searchQuery = buildOfficialSiteQuery(person, buildNameAliases(person.name)[0]);
  let searchResults = [];
  try {
    searchResults = await webSearch(searchQuery, sourceErrors);
  } catch (error) {
    sourceErrors.push({ source: 'web-search', query: searchQuery, message: error.message });
  }
  searchResults
    .filter((result) => !isExcludedUrl(result.url))
    .filter((result) => isOfficialSiteLead(person, result))
    .slice(0, 4)
    .forEach((result) => {
      addOfficialLead(leads, {
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        source: result.source || 'web-search',
        confidence: 'official-site-lead',
        reviewStatus: 'collected-needs-review',
      });
    });

  return {
    leads: leads.slice(0, 6),
    sourceErrors,
  };
}

async function webSearch(search, sourceErrors = []) {
  const providers = [
    { source: 'bing-html-search', search: bingSearch },
    { source: 'duckduckgo-html-search', search: duckDuckGoSearch },
  ];
  const results = [];
  for (const provider of providers) {
    try {
      const providerResults = await provider.search(search);
      providerResults.forEach((result) => {
        if (!result.url || results.some((existing) => normalizeUrl(existing.url) === normalizeUrl(result.url))) return;
        results.push({ ...result, source: provider.source });
      });
      if (results.length > 0) break;
    } catch (error) {
      sourceErrors.push({ source: provider.source, query: search, message: error.message });
    }
    await delay(160);
  }
  return results;
}

async function duckDuckGoSearch(search) {
  const url = new URL('https://html.duckduckgo.com/html/');
  url.searchParams.set('q', search);

  const response = await fetchWithTimeout(url, { headers: requestHeaders() });
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  const html = await response.text();
  const results = [];
  const blocks = html.split(/<div class="result(?:\s|")/).slice(1);
  for (const block of blocks) {
    if (results.length >= 10) break;
    const anchor = block.match(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!anchor) continue;
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/div>)/);
    const urlValue = decodeDuckDuckGoUrl(decodeHtml(anchor[1]));
    if (!urlValue) continue;
    results.push({
      url: urlValue,
      title: cleanHtmlText(anchor[2]),
      snippet: snippet ? cleanHtmlText(snippet[1]) : '',
    });
  }
  return results;
}

async function bingSearch(search) {
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('q', search);

  const response = await fetchWithTimeout(url, { headers: requestHeaders() });
  if (!response.ok) throw new Error(`Request failed ${response.status}: ${url}`);
  const html = await response.text();
  const results = [];
  const blocks = html.split(/<li class="b_algo/).slice(1);
  for (const block of blocks) {
    if (results.length >= 10) break;
    const anchors = [...block.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const anchor = anchors.find((match) => {
      const text = cleanHtmlText(match[2]);
      const urlValue = decodeBingUrl(decodeHtml(match[1]));
      return text && /^https?:\/\//i.test(urlValue);
    });
    if (!anchor) continue;
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const urlValue = decodeBingUrl(decodeHtml(anchor[1]));
    if (!urlValue || !/^https?:\/\//i.test(urlValue)) continue;
    results.push({
      url: urlValue,
      title: cleanHtmlText(anchor[2]),
      snippet: snippet ? cleanHtmlText(snippet[1]) : '',
    });
  }
  return results;
}

function addOfficialLead(leads, lead) {
  if (!lead.url || isExcludedUrl(lead.url)) return;
  if (leads.some((existing) => normalizeUrl(existing.url) === normalizeUrl(lead.url))) return;
  leads.push({
    ...lead,
    domain: domainForUrl(lead.url),
  });
}

function isOfficialSiteLead(person, result) {
  const domain = domainForUrl(result.url);
  if (!domain) return false;
  if (isCommonNonOfficialDomain(domain)) return false;

  const text = normalizeText(`${result.title} ${result.snippet} ${result.url}`);
  const nameTokens = meaningfulTokens(person.name);
  const hasName = nameTokens.filter((token) => text.includes(token)).length >= Math.min(2, nameTokens.length);
  if (!hasName) return false;
  if (!hasRequiredNameSuffix(person.name, text)) return false;

  const urlText = normalizeText(result.url);
  const officialLanguage = /\bofficial\b|\bprofile\b|\bbio\b|\bbiography\b|\bfaculty\b|\bstaff\b|\bleadership\b|\bboard\b|\bfoundation\b|\buniversity\b|\bschool\b|\bgovernment\b|\bmayor\b|\bsenator\b/.test(text);
  const governmentOrEducationDomain = /\.(edu|gov)$/i.test(domain);
  const contextMatches = distinctiveContextMatches(buildContextTerms(person), text, buildNameAliases(person.name), person);
  const organizationalDomain =
    domain.endsWith('.org') &&
    /\b(archive|archives|association|center|centre|church|city|college|congress|council|county|foundation|hospital|institute|library|museum|parish|school|senate|society|university)\b/.test(
      `${text} ${domain}`,
    );
  const personalOrNamedDomain = nameTokens.some((token) => domain.includes(token) || urlText.includes(`${token}.`));
  if ((governmentOrEducationDomain || organizationalDomain) && officialLanguage) return true;
  return personalOrNamedDomain && officialLanguage && contextMatches.length > 0;
}

function hasRequiredNameSuffix(name, normalizedCandidateText) {
  const suffix = normalizeText(name).match(/\b(jr|sr|ii|iii|iv)\b/)?.[1];
  if (!suffix) return true;
  return new RegExp(`\\b${suffix}\\b`).test(normalizedCandidateText);
}

function isCommonNonOfficialDomain(domain) {
  const blocked = [
    'wikipedia.org',
    'wikidata.org',
    'youtube.com',
    'youtu.be',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'linkedin.com',
    'ancestry.com',
    'findagrave.com',
    'legacy.com',
    'newspapers.com',
    'cleveland.com',
    'clevelandmen.com',
    'clevelandseniors.com',
    'everybodywiki.com',
    'prabook.com',
    'peoplepill.com',
    'thefamouspeople.com',
    'biographs.org',
    'dbpedia.org',
    'lawyerdb.org',
    'repbio.org',
    'ballotpedia.org',
    'vote-usa.org',
    'radaris.com',
    'mylife.com',
    'whitepages.com',
  ];
  return blocked.some((blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`));
}

function buildFactStubs(person, wikipedia, wikidata, officialSiteLeads) {
  const facts = [];
  if (wikipedia.match) {
    facts.push({
      type: 'summary',
      label: 'Wikipedia summary',
      value: wikipedia.match.extract,
      sourceUrl: wikipedia.match.url,
      sourceType: 'wikipedia',
      reviewStatus: 'collected-needs-review',
    });
  }

  const wd = wikidata.match;
  if (wd) {
    [
      ['birthDate', wd.claims.birthDate],
      ['deathDate', wd.claims.deathDate],
      ['occupations', wd.claims.occupations.map((item) => item.label).join('; ')],
      ['citizenships', wd.claims.citizenships.map((item) => item.label).join('; ')],
      ['educatedAt', wd.claims.educatedAt.map((item) => item.label).join('; ')],
      ['employers', wd.claims.employers.map((item) => item.label).join('; ')],
      ['awards', wd.claims.awards.map((item) => item.label).join('; ')],
      ['birthPlaces', wd.claims.birthPlaces.map((item) => item.label).join('; ')],
      ['deathPlaces', wd.claims.deathPlaces.map((item) => item.label).join('; ')],
    ].forEach(([type, value]) => {
      if (!value) return;
      facts.push({
        type,
        label: type,
        value,
        sourceUrl: wd.url,
        sourceType: 'wikidata',
        reviewStatus: 'collected-needs-review',
      });
    });
  }

  officialSiteLeads.forEach((lead) => {
    facts.push({
      type: 'officialSiteLead',
      label: lead.title || lead.domain,
      value: lead.snippet || lead.url,
      sourceUrl: lead.url,
      sourceType: lead.source,
      reviewStatus: 'collected-needs-review',
    });
  });

  if (facts.length === 0) {
    facts.push({
      type: 'externalResearchStatus',
      label: 'No external source match collected',
      value: `No Wikipedia, Wikidata, or official-site lead was collected for ${person.name} in this pass.`,
      sourceUrl: '',
      sourceType: 'collector-status',
      reviewStatus: 'collected-needs-review',
    });
  }

  return facts;
}

function failedPersonRecord(person, error) {
  return {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    region: person.region,
    collectionStatus: 'collection-failed',
    needsReview: true,
    error: error.message,
    sourcePolicy: {
      excludedDomains,
      integrationStatus: 'not-integrated',
    },
    wikipedia: { status: 'not-collected', match: null, candidates: [] },
    wikidata: { status: 'not-collected', match: null, candidates: [], sourceErrors: [{ source: 'collector', query: person.name, message: error.message }] },
    officialSiteLeads: [],
    officialSiteSourceErrors: [],
    facts: [],
    summary: {
      wikipediaStatus: 'not-collected',
      wikidataStatus: 'not-collected',
      officialSiteLeadCount: 0,
      factStubCount: 0,
      sourceErrorCount: 1,
      reviewReason: 'Collection failed; rerun this person.',
    },
  };
}

function buildReport(allInductees, selected, collectedRecords) {
  const recordValues = Object.values(collectedRecords);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    collector: 'scripts/collect-external-research.js',
    integrationStatus: 'not-integrated',
    reviewStatus: 'collected-needs-review',
    sourcePolicy: {
      includedSourceTypes: ['Wikipedia page summaries', 'Wikidata entity claims', 'Wikidata official website claims', 'official-site search leads'],
      excludedDomains,
      note: 'This data is collected separately from canonical CIHOF records and must not be promoted without curator review.',
    },
    summary: {
      totalInductees: allInductees.length,
      recordsCollected: recordValues.length,
      wikipediaStrongMatches: recordValues.filter((record) => record.wikipedia.status === 'strong-match').length,
      wikipediaCandidateOnly: recordValues.filter((record) => record.wikipedia.status === 'candidates-only').length,
      wikidataStrongMatches: recordValues.filter((record) => record.wikidata.status === 'strong-match').length,
      wikidataCandidateOnly: recordValues.filter((record) => record.wikidata.status === 'candidates-only').length,
      recordsWithOfficialSiteLeads: recordValues.filter((record) => record.officialSiteLeads.length > 0).length,
      totalOfficialSiteLeads: recordValues.reduce((total, record) => total + record.officialSiteLeads.length, 0),
      recordsWithNoExternalLead: recordValues.filter((record) => record.summary.factStubCount === 1 && record.facts[0]?.sourceType === 'collector-status').length,
      recordsWithSourceErrors: recordValues.filter((record) => record.summary.sourceErrorCount > 0).length,
    },
    selectedIds: selected.map((person) => person.id),
    records: collectedRecords,
  };
}

function buildCsv(report) {
  const headers = [
    'id',
    'name',
    'classYear',
    'region',
    'collectionStatus',
    'wikipediaStatus',
    'wikipediaTitle',
    'wikipediaUrl',
      'wikidataStatus',
      'wikidataId',
      'wikidataLabel',
      'officialSiteLeadCount',
      'officialSiteLeadUrls',
      'factStubCount',
      'sourceErrorCount',
      'officialSiteSourceErrorCount',
      'reviewReason',
  ];

  const rows = Object.values(report.records).map((record) => [
    record.id,
    record.name,
    record.classYear ?? '',
    record.region,
    record.collectionStatus,
    record.wikipedia.status,
    record.wikipedia.match?.title ?? '',
    record.wikipedia.match?.url ?? '',
    record.wikidata.status,
    record.wikidata.match?.id ?? '',
    record.wikidata.match?.label ?? '',
    record.officialSiteLeads.length,
    record.officialSiteLeads.map((lead) => lead.url).join('|'),
    record.facts.length,
    record.summary.sourceErrorCount,
    record.officialSiteSourceErrors?.length ?? 0,
    record.summary.reviewReason,
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function buildNameAliases(name) {
  const withoutYear = name
    .replace(/\s*\((?:born\s+)?\d{4}[^)]*\)/iu, '')
    .replace(/\s+[–-]\s*\d{4}$/u, '')
    .replace(/\s+\d{4}$/u, '')
    .trim();
  const stripped = withoutYear
    .replace(/^(ambassador|amb\.?|bishop|dr\.?|fr\.?|hon\.?|honorable|mayor|rev\.?|reverend|senator|sister)\s+/i, '')
    .trim();
  const variants = [stripped, withoutYear, stripped.replace(/\b[A-Z]\.\s+/g, ''), withoutYear.replace(/\b[A-Z]\.\s+/g, '')]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return Array.from(new Set(variants));
}

function buildWikipediaQueries(person, aliases) {
  const base = aliases[0] || person.name;
  return Array.from(
    new Set([
      base,
      `${base} Cleveland`,
      person.name,
    ]),
  );
}

function buildWikipediaFallbackQueries(person, aliases) {
  const base = aliases[0] || person.name;
  return Array.from(new Set([`"${base}" Cleveland Wikipedia`, `"${base}" Ohio Wikipedia`, `"${base}" Wikipedia`]));
}

function buildOfficialSiteQuery(person, name) {
  return `"${name || person.name}" Cleveland biography profile official`;
}

function buildContextTerms(person) {
  return meaningfulTokens(
    [
      person.region,
      person.inductedBy,
      person.bioText,
      person.documentedContextLine,
      person.honoredForSummary,
      person.lifeWorkSummary,
      person.themeTags?.join(' '),
      person.countryTags?.join(' '),
      person.communityTags?.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  ).slice(0, 30);
}

function scoreCandidate({ expectedAliases, candidateLabels, description, contextTerms, hasWikipedia, hasOfficialWebsite }) {
  const normalizedLabels = candidateLabels.map(normalizePersonName).filter(Boolean);
  const expected = expectedAliases.map(normalizePersonName).filter(Boolean);
  const exactName = expected.some((name) => normalizedLabels.includes(name));
  const containedName = expected.some((name) => normalizedLabels.some((label) => label.includes(name) || name.includes(label)));
  const tokenScore = Math.max(...expected.map((name) => tokenOverlap(name, normalizedLabels.join(' '))), 0);
  const contextScore = tokenOverlap(contextTerms.join(' '), normalizeText(description));
  let score = 0;
  if (exactName) score += 0.55;
  else if (containedName) score += 0.42;
  score += Math.min(0.28, tokenScore * 0.28);
  score += Math.min(0.12, contextScore * 0.12);
  if (hasWikipedia) score += 0.04;
  if (hasOfficialWebsite) score += 0.04;
  return round(score);
}

function explainScore({ expectedAliases, candidateLabels, description, contextTerms, hasWikipedia, hasOfficialWebsite }) {
  const reasons = [];
  const normalizedLabels = candidateLabels.map(normalizePersonName).filter(Boolean);
  const expected = expectedAliases.map(normalizePersonName).filter(Boolean);
  if (expected.some((name) => normalizedLabels.includes(name))) reasons.push('exact-name-match');
  else if (expected.some((name) => normalizedLabels.some((label) => label.includes(name) || name.includes(label)))) reasons.push('contained-name-match');
  if (tokenOverlap(expected.join(' '), normalizedLabels.join(' ')) >= 0.5) reasons.push('name-token-overlap');
  if (tokenOverlap(contextTerms.join(' '), normalizeText(description)) >= 0.08) reasons.push('context-token-overlap');
  if (hasWikipedia) reasons.push('has-wikipedia');
  if (hasOfficialWebsite) reasons.push('has-official-website-claim');
  return reasons;
}

function isStrongIdentityCandidate(candidate) {
  const hasNameSignal = candidate.reasons.includes('exact-name-match');
  const hasContextSignal = (candidate.contextMatches?.length ?? 0) >= 2 || candidate.reasons.includes('has-official-website-claim');
  return (
    candidate.score >= minStrongMatchScore &&
    hasNameSignal &&
    hasContextSignal &&
    !candidate.reasons.includes('birth-year-mismatch') &&
    !candidate.reasons.includes('middle-initial-mismatch')
  );
}

function summarizeReviewReason(wikipedia, wikidata, officialSiteLeads) {
  const pieces = [];
  if (wikipedia.status === 'strong-match') pieces.push('strong Wikipedia candidate collected');
  else if (wikipedia.status === 'candidates-only') pieces.push('Wikipedia candidates need identity review');
  else pieces.push('no Wikipedia match collected');

  if (wikidata.status === 'strong-match') pieces.push('strong Wikidata candidate collected');
  else if (wikidata.status === 'candidates-only') pieces.push('Wikidata candidates need identity review');
  else pieces.push('no Wikidata match collected');

  if (officialSiteLeads.length > 0) pieces.push(`${officialSiteLeads.length} official-site lead${officialSiteLeads.length === 1 ? '' : 's'} collected`);
  else pieces.push('no official-site lead collected');

  return pieces.join('; ');
}

function valuesForClaim(claims, property) {
  return (claims[property] ?? [])
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => value !== undefined && value !== null)
    .map((value) => (typeof value === 'object' && value.id ? value.id : value));
}

function entityIdsForClaim(claims, property) {
  return valuesForClaim(claims, property)
    .map((value) => (typeof value === 'string' ? value : value?.id))
    .filter((value) => /^Q\d+$/.test(value));
}

function firstValue(claims, property) {
  const value = valuesForClaim(claims, property)[0];
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.id) return value.id;
  return String(value);
}

function firstTimeClaim(claims, property) {
  const value = (claims[property] ?? [])[0]?.mainsnak?.datavalue?.value;
  if (!value?.time) return '';
  return value.time.replace(/^\+/, '');
}

function extractBirthYear(value) {
  const text = String(value ?? '');
  const bornMatch = text.match(/\b(?:born|b\.)\s+(?:[A-Z][a-z]+\s+\d{1,2},\s+)?(\d{4})\b/i);
  if (bornMatch) return Number(bornMatch[1]);
  const bornInMatch = text.match(/\b(?:born|b\.)\s+(?:in\s+)?(?:[A-Z][a-z]+\s+)?(?:of\s+)?(\d{4})\b/i);
  if (bornInMatch) return Number(bornInMatch[1]);
  const parentheticalMatch = text.match(/\((?:born\s+)?(\d{4})(?:[–-]|\))/i);
  if (parentheticalMatch) return Number(parentheticalMatch[1]);
  return null;
}

function yearFromDateString(value) {
  const match = String(value ?? '').match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function hasBirthYearMismatch(expectedBirthYear, candidateBirthYear) {
  return Number.isFinite(expectedBirthYear) && Number.isFinite(candidateBirthYear) && Math.abs(expectedBirthYear - candidateBirthYear) > 1;
}

function middleInitialForName(text, aliases) {
  const normalized = normalizeText(text);
  for (const alias of aliases) {
    const tokens = normalizePersonName(alias).split(' ').filter(Boolean);
    if (tokens.length < 2) continue;
    const first = escapeRegExp(tokens[0]);
    const last = escapeRegExp(tokens[tokens.length - 1]);
    const match = normalized.match(new RegExp(`\\b${first}\\s+([a-z][a-z]*)\\s+${last}\\b`));
    if (match) return match[1][0];
  }
  return '';
}

function hasMiddleInitialMismatch(expectedMiddleInitial, candidateMiddleInitial) {
  return Boolean(expectedMiddleInitial && candidateMiddleInitial && expectedMiddleInitial !== candidateMiddleInitial);
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchWithTimeout(url, { headers: requestHeaders() });
    if (response.ok) return response.json();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`Request failed ${response.status}: ${url}`);
    }
    await delay(retryDelayMs(response, attempt));
  }
  throw new Error(`Request failed: ${url}`);
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(30000, retryAfter * 1000);
  return [1500, 4000, 9000][attempt] ?? 9000;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function requestHeaders() {
  return {
    'User-Agent': 'CIHOFExternalResearchCollector/1.0 (local curator research; contact: none)',
    Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  };
}

function isExcludedUrl(value) {
  const domain = domainForUrl(value);
  return excludedDomains.some((excluded) => domain === excluded || domain.endsWith(`.${excluded}`));
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

function wikipediaUrlForTitle(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
}

function wikipediaTitleFromUrl(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.replace(/^www\./, '').endsWith('wikipedia.org')) return '';
    const match = url.pathname.match(/^\/wiki\/([^?#]+)/);
    if (!match) return '';
    return decodeURIComponent(match[1]).replace(/_/g, ' ');
  } catch {
    return '';
  }
}

function decodeDuckDuckGoUrl(value) {
  try {
    const url = new URL(value, 'https://duckduckgo.com');
    const encoded = url.searchParams.get('uddg');
    return encoded ? decodeURIComponent(encoded) : url.href;
  } catch {
    return value;
  }
}

function decodeBingUrl(value) {
  try {
    const url = new URL(value, 'https://www.bing.com');
    const encoded = url.searchParams.get('u');
    if (!encoded) return url.href;
    const normalized = encoded.replace(/^a1/, '').replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    return decoded || url.href;
  } catch {
    return value;
  }
}

function cleanHtmlText(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizePersonName(value) {
  return normalizeText(value)
    .replace(/\b(ambassador|amb|bishop|dr|fr|hon|honorable|mayor|rev|reverend|senator|sister)\b/g, ' ')
    .replace(/\b(class|of|phd|cfa)\b/g, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const stopwords = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'that', 'this', 'within', 'class', 'honoree', 'connected', 'contributions', 'greater']);
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function distinctiveContextMatches(contextTerms, candidateText, aliases, person) {
  const candidateTokens = new Set(meaningfulTokens(candidateText));
  const nameTokens = new Set(aliases.flatMap((alias) => meaningfulTokens(alias)));
  const heritageTokens = new Set(meaningfulTokens([person.region, person.countryTags?.join(' '), person.communityTags?.join(' ')].filter(Boolean).join(' ')));
  const weakTokens = new Set([
    ...nameTokens,
    ...heritageTokens,
    'advocacy',
    'advocate',
    'america',
    'american',
    'area',
    'asian',
    'born',
    'business',
    'class',
    'cleveland',
    'communities',
    'community',
    'contribution',
    'contributions',
    'culture',
    'education',
    'greater',
    'heritage',
    'immigrant',
    'immigrants',
    'international',
    'member',
    'members',
    'ohio',
    'philanthropy',
    'served',
    'serves',
    'service',
    'services',
    'united',
    'year',
    'years',
  ]);
  return Array.from(new Set(contextTerms))
    .filter((token) => token.length > 3 && !weakTokens.has(token) && candidateTokens.has(token))
    .slice(0, 12);
}

function tokenOverlap(expectedText, candidateText) {
  const expected = new Set(meaningfulTokens(expectedText));
  if (expected.size === 0) return 0;
  const candidate = new Set(meaningfulTokens(candidateText));
  let matches = 0;
  expected.forEach((token) => {
    if (candidate.has(token)) matches += 1;
  });
  return matches / expected.size;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
