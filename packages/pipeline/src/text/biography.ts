/**
 * Biography and tag normalisation, ported from scripts/data-utils.js.
 *
 * These rules are editorial decisions, not implementation details, so they are
 * reproduced exactly rather than reimplemented from intent.
 *
 * The temporal rules exist because this text runs in a permanent installation:
 * "Today, X serves as" becomes "X served as" so the exhibit does not make a
 * claim that quietly goes stale. Several replacements are hand-written for a
 * single person's biography, which means somebody read them one at a time.
 * That work cannot be re-derived and is only preserved.
 *
 * Verified by tests/parity.test.ts against all 111 published biographies.
 */

import { readFileSync } from 'node:fs';
import { dataFile } from '../paths.ts';

/**
 * Community tag aliases and the ignore list. A canonical source: it records
 * which labels a reviewer decided are the same community and which are not
 * communities at all.
 */
const communityTaxonomy = JSON.parse(
  readFileSync(dataFile('community_taxonomy.json'), 'utf8'),
) as { ignoredCommunityTags?: string[]; communityTagAliases?: Record<string, string> };

function ensureTerminalPunctuation(text: string): string {
  const trimmed = cleanString(text);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDisplayNameArtifacts(name: string): string {
  return cleanString(name)
    .replace(/\s+[–-]\s*\d{4}$/u, '')
    .replace(/\s*\(\d{4}\s*[–-]\s*\d{4}\)\s*$/u, '')
    .trim();
}

function buildBioNameAliases(name: string): string[] {
  const cleanName = stripDisplayNameArtifacts(name);
  const noHonorific = cleanName.replace(/^(Honorable|Hon\.|Dr\.|Rev\.|Reverend|Senator|Sister|Mayor|Judge|Bishop|Fr\.)\s+/i, '').trim();
  const withoutParenthetical = cleanName.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(new Set([cleanName, noHonorific, withoutParenthetical].filter(Boolean)))
    .sort((a, b) => b.length - a.length);
}

function matchLeadingBioNameAlias(text: string, aliases: string[]): { alias: string; length: number } | null {
  for (const alias of aliases) {
    const pattern = alias
      .split(/\s+/)
      .map(escapeRegExp)
      .join('\\s+');
    const match = text.match(new RegExp(`^${pattern}(?=\\s|[,.:;!?]|[’']s\\b|$)`, 'iu'));
    if (match) return { alias, length: match[0].length };
  }
  return null;
}

function looksLikeStandaloneBioHeading(afterHeading: string): boolean {
  const text = afterHeading.trimStart();
  if (!text) return false;
  if (/^[,.:;!?)]/.test(text)) return false;
  if (/^[’']s\b/i.test(text)) return false;
  return !/^(?:is|was|has|had|serves|served|became|become|built|founded|co-founded|created|joined|received|earned|graduated|emigrated|immigrated|came|moved|grew|spent|led|represented|worked|attended|retired|trained|practiced|published|organized|opened|began|started|made|carried|combined)\b/i.test(text);
}

function normalizeBioTemporalWording(value: string): string {
  return cleanString(value)
    .replace(
      /\bShe also hosted her own television and radio shows entitled [“"]Issues Today[”"] and [“"]Senior Forum[”"]\./g,
      'She also hosted television and radio programming on current affairs and senior issues.',
    )
    .replace(/\bUSA Today\b/g, 'a national newspaper')
    .replace(/[“"]Issues Today[”"]/g, 'current-affairs programming')
    .replace(/\bToday'?s?\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*){0,4})\b/g, '$1')
    .replace(/\bToday,\s+([^.!?]{1,80}?)\s+continues\b/g, '$1 continued')
    .replace(/\bToday,\s+([^.!?]{1,80}?)\s+is\b/g, '$1 was')
    .replace(/\bToday,\s+([^.!?]{1,80}?)\s+serves\b/g, '$1 served')
    .replace(/\bToday,\s+([^.!?]{1,80}?)\s+represents\b/g, '$1 represented')
    .replace(/\bToday,\s+([^.!?]{1,80}?)\s+has\b/g, '$1 had')
    .replace(/\bToday and for the past\b/g, 'For the following')
    .replace(/\bFrom that day,\s*till today\b/gi, 'From that day forward')
    .replace(/\bthat brings her here today\b/gi, 'that led to this recognition')
    .replace(/\bthat brings him here today\b/gi, 'that led to this recognition')
    .replace(/\bwhat it is today,\s*/gi, '')
    .replace(/\btoday has become\b/gi, 'became')
    .replace(/\btoday there (?:are|may be)\b/gi, 'at the time, there were')
    .replace(/\bJim,\s+today is honored to serve\b/g, 'Jim was honored to serve')
    .replace(/\bWell,\s+today her triplet daughters are all grown\b/g, 'By then, her triplet daughters were grown')
    .replace(/\bcontinues? ((?:his|her|their)\s+)?legacy\b/gi, 'carried $1legacy')
    .replace(/\bcontinues? (?:in that role|to do so) today\b/gi, 'continued in that work')
    .replace(/\bcontinues? to ([^.!?]{1,80}?) today\b/gi, 'continued to $1')
    .replace(/\bstill holds today\b/gi, 'held')
    .replace(/\bused in ([^.!?]{1,80}?) today\b/gi, 'used in $1')
    .replace(/\beven today\b/gi, 'even years later')
    .replace(/\btoday\b/gi, 'at the time')
    .replace(/\bCurrently,\s+([^.!?]{1,80}?)\s+(?:is|are)\b/g, '$1 has been')
    .replace(/\bCurrently,\s+([^.!?]{1,80}?)\s+serves\b/g, '$1 served')
    .replace(/\bCurrently,\s+([^.!?]{1,80}?)\s+plans\b/g, '$1 planned')
    .replace(/\bCurrently,\s+/g, '')
    .replace(/\bis currently serving as\b/gi, 'has served as')
    .replace(/\bis currently serving on\b/gi, 'has served on')
    .replace(/\bis currently serving\b/gi, 'has served')
    .replace(/\bare currently serving as\b/gi, 'have served as')
    .replace(/\bcurrently serves as\b/gi, 'served as')
    .replace(/\bcurrently serves on\b/gi, 'served on')
    .replace(/\bcurrently serves\b/gi, 'served')
    .replace(/\bcurrently sits on\b/gi, 'has served on')
    .replace(/\bcurrently is\b/gi, 'has been')
    .replace(/\bis currently\b/gi, 'has been')
    .replace(/\bare currently\b/gi, 'have been')
    .replace(/\bcurrently has\b/gi, 'has had')
    .replace(/\bcurrently manages\b/gi, 'has managed')
    .replace(/\bcurrently features\b/gi, 'has featured')
    .replace(/\bcurrently doing\b/gi, 'has done')
    .replace(/\bcurrently writing\b/gi, 'has written')
    .replace(/\bcurrently screening\b/gi, 'screened')
    .replace(/\bcurrently in post-production\b/gi, 'was in post-production')
    .replace(/\bcurrently plans to\b/gi, 'planned to')
    .replace(/\bcurrently resides in\b/gi, 'has resided in')
    .replace(/\bcurrently living in\b/gi, 'lived in')
    .replace(/\bcurrently regarded as\b/gi, 'regarded as')
    .replace(/\bcurrently\b/gi, '')
    .replace(/\bPresently,\s+([^.!?]{1,80}?)\s+(?:is|are)\b/g, '$1 has been')
    .replace(/\bPresently\s+([^.!?]{1,80}?)\s+serves\b/g, '$1 served')
    .replace(/\bpresently serves as\b/gi, 'served as')
    .replace(/\bpresently serves on\b/gi, 'served on')
    .replace(/\bpresently serves\b/gi, 'served')
    .replace(/\bpresently the\b/gi, 'served as the')
    .replace(/\bis presently the\b/gi, 'served as the')
    .replace(/\bis presently working on\b/gi, 'worked on')
    .replace(/\bpresently working on\b/gi, 'worked on')
    .replace(/\bpresently resides at\b/gi, 'resided at')
    .replace(/\bpresently\b/gi, '')
    .replace(/\bat present\b/gi, 'at the time of the source profile')
    .replace(/\bThen as now\b/g, 'Then and in later years')
    .replace(/\bthen as now\b/g, 'then and in later years')
    .replace(/\bin what is now\b/gi, 'in present-day')
    .replace(/\bwhat is now\b/gi, 'present-day')
    .replace(/\bnow known as\b/gi, 'later known as')
    .replace(/\bnow part of\b/gi, 'later part of')
    .replace(/\bnow a Division of\b/gi, 'later a division of')
    .replace(/\bnow in its ([^.!?]{1,40}? year)\b/gi, 'then in its $1')
    .replace(/\bby now was\b/gi, 'by then was')
    .replace(/\bis now rated\b/gi, 'was rated')
    .replace(/\bis now designing\b/gi, 'worked on designing')
    .replace(/\bis now the oldest\b/gi, 'became the oldest')
    .replace(/\bis now one of\b/gi, 'became one of')
    .replace(/\bis now a\b/gi, 'became a')
    .replace(/\bis now an\b/gi, 'became an')
    .replace(/\bis now\b/gi, 'became')
    .replace(/\bare now\b/gi, 'became')
    .replace(/\bhas now\b/gi, 'had')
    .replace(/\bhave now\b/gi, 'had')
    .replace(/\bnow resides in\b/gi, 'came to reside in')
    .replace(/\bnow reside in\b/gi, 'came to reside in')
    .replace(/\bnow holds\b/gi, 'held')
    .replace(/\bnow regarded as\b/gi, 'regarded as')
    .replace(/\bnow from\b/gi, 'later from')
    .replace(/\bnow joining\b/gi, 'being inducted with')
    .replace(/\bwho is now deceased\b/gi, 'who later died')
    .replace(/\bnow deceased\b/gi, 'later deceased')
    .replace(/\bDoctors now say\b/g, 'Doctors said')
    .replace(/\bnow say\b/gi, 'said')
    .replace(/\bnow\b/gi, 'then')
    .replace(/\bwhere he is served as the\b/gi, 'where he served as the')
    .replace(/\bat the time is honored to serve\b/gi, 'was honored to serve')
    .replace(/\bat the time her triplet daughters are all grown\b/gi, 'by then, her triplet daughters were grown')
    .replace(/\bat the time became one of\b/gi, 'became one of')
    .replace(/\bat the time is the centerpiece\b/gi, 'became the centerpiece')
    .replace(/\bat the time,\s+Mr\. Maltz is using\b/g, 'Mr. Maltz used')
    .replace(/\bIn between the beginning of this special career in his life and at the time came\b/gi, 'In the years that followed came')
    .replace(/\bthen a more than ([^,]+),\s+/gi, 'As a more than $1, ')
    .replace(/\bwhich then comprise\b/gi, 'which came to comprise')
    .replace(/\bthen Juenteenth is\b/g, 'Juneteenth became')
    .replace(/\bJuenteenth\b/g, 'Juneteenth')
    .replace(/([.!?]\s+)at the time,/g, '$1At the time,')
    .replace(/([.!?]\s+)then\s+/g, '$1Then ');
}

function normalizeBioEllipses(value: string): string {
  return cleanString(value)
    .replace(/([a-z0-9])\s*(?:\.{3,}|…+)\.?\s*([A-Z])/g, '$1. $2')
    .replace(/([a-z0-9])\s*(?:\.{3,}|…+)\.?\s*([a-z0-9])/gi, '$1, $2')
    .replace(/(?:\.{3,}|…+)\.?/g, '.');
}

function normalizeBioUrlReferences(value: string): string {
  return cleanString(value)
    .replace(/\s+and also simulcasts worldwide on the internet at\s+WWW\.\s*247PolkaHeaven\.Com\.?/i, ' and also simulcasts online')
    .replace(/\s*\(website:\s*www\.[^)]+\)/gi, '')
    .replace(/\s*\(www\.sewausa\.org\),?/gi, '')
    .replace(/\s*\(www\.ethioseed\.org\)\.?/gi, '')
    .replace(/\bPlease visit\s+www\.\s*eyes\.\s*foundation\s+for detail\.?\s*/gi, '')
    .replace(/\band also online at\s+www\.newstalkcleveland\.com\s+and\s+wcpn\.org\b/gi, 'and also online')
    .replace(/\bwww\.\s*[^\s).]+(?:\.[^\s).]+)+\)?\.?/gi, '')
    .replace(/\s+,/g, ',');
}

function normalizeBioContactDetails(value: string): string {
  return cleanString(value)
    .replace(
      /\bMr\. Machaskee is President of Alex Machaskee and Associates, LLC at Key Tower,\s*127 Public Square,\s*Cleveland,\s*Ohio\s*44114,\s*1-216-344-2013\.\s*AM&A specializes in\b/g,
      'Alex Machaskee and Associates, LLC specializes in',
    )
    .replace(
      /\bthe \$11\.0 million Collinwood Recreation Center,\s*located at 16300 Lakeshore Boulevard,\s*in the community\./g,
      'the $11.0 million Collinwood Recreation Center in the community.',
    );
}

function stripBioScrapeTail(value: string): string {
  const text = cleanString(value);
  const markers = [
    /\s+Watch the video\b/,
    /\s+Here is a video\b/,
    /\s+View photos\b/,
    /\s+See more photos\b/,
    /\s+See more from\b/,
    /\s+Click on the white arrow\b/,
    /\s+Back to\b/,
    /\s+Congratulations\b/,
  ];
  const indexes = markers
    .map((marker) => {
      const match = text.match(marker);
      return match?.index ?? -1;
    })
    .filter((index) => index > 600);
  if (indexes.length === 0) return text;
  return ensureTerminalPunctuation(text.slice(0, Math.min(...indexes)));
}

function cleanBioSpacing(value: string): string {
  return cleanString(value)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

export function normalizeBioText(value: unknown, name: string): string {
  const text = cleanString(value);
  const aliases = buildBioNameAliases(name);
  let cleaned = text;
  let removedHeading = false;

  while (true) {
    const first = matchLeadingBioNameAlias(cleaned, aliases);
    if (!first) break;

    const afterFirst = cleaned.slice(first.length).trimStart();
    const second = matchLeadingBioNameAlias(afterFirst, aliases);
    if (!second) break;

    cleaned = afterFirst;
    removedHeading = true;
  }

  const remainingHeading = matchLeadingBioNameAlias(cleaned, aliases);
  if (remainingHeading && !removedHeading) {
    const afterHeading = cleaned.slice(remainingHeading.length).trimStart();
    if (looksLikeStandaloneBioHeading(afterHeading)) {
      cleaned = afterHeading;
    }
  }

  return cleanBioSpacing(stripBioScrapeTail(normalizeBioContactDetails(normalizeBioUrlReferences(normalizeBioEllipses(normalizeBioTemporalWording(cleaned))))));
}

export function normalizeCommunityTags(tags: readonly string[]): string[] {
  const aliases = communityTaxonomy.communityTagAliases ?? {};
  const ignoredTags = new Set(communityTaxonomy.ignoredCommunityTags ?? []);
  const seen = new Set();
  const normalized = [];

  for (const tag of tags) {
    const label = cleanString(aliases[tag] ?? tag);
    if (!label || ignoredTags.has(label) || seen.has(label)) continue;
    seen.add(label);
    normalized.push(label);
  }

  return normalized;
}
