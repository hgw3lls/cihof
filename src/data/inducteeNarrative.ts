import type { Inductee } from './types';

export function inducteeContextLabel(inductee: Inductee) {
  const community = firstText(inductee.communityTags);
  if (community) return community;

  if (isExplicitSource(inductee.themeTagsSource)) {
    const theme = firstText(inductee.themeTags);
    if (theme) return theme;
  }

  if (isExplicitSource(inductee.countryTagsSource)) {
    const country = firstText(inductee.countryTags);
    if (country) return country;
  }

  if (inductee.inductedBy) return `Inducted by ${inductee.inductedBy}`;
  return '';
}

export function honoredForSummary(inductee: Inductee) {
  const preferred = cleanSummaryText(inductee.bioText || inductee.storySummary, inductee.name);
  const fallback = cleanSummaryText(inductee.storySummary, inductee.name);
  const source = wordCount(preferred) >= 24 ? preferred : fallback;
  const opening = firstCompleteSentence(source);
  const highlight = inductee.storyHighlights
    .map((item) => cleanSummaryText(item, inductee.name))
    .find((item) => item && !item.includes('...') && !isRepeatedSummaryPiece(item, opening));
  return limitWords([opening, highlight].filter(Boolean).join(' ') || source, 46);
}

function firstText(values: string[]) {
  return values.find((value) => value.trim().length > 0)?.trim() ?? '';
}

function isExplicitSource(source: string) {
  return source === 'curated' || source === 'documented';
}

function cleanSummaryText(text: string, name: string) {
  const withoutMediaTail = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0] || text;
  return stripLeadingName(withoutMediaTail.replace(/\s+/g, ' ').trim(), name);
}

function stripLeadingName(text: string, name: string) {
  const variants = [
    name,
    name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);
  const lower = text.toLowerCase();
  const match = variants.find((variant) => lower.startsWith(variant.toLowerCase()));
  return match ? text.slice(match.length).replace(/^[-:,\s]+/, '').trim() : text;
}

function limitWords(text: string, maxWords: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ').replace(/[,;:]+$/, '')}...`;
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function firstCompleteSentence(text: string) {
  const protectedText = text
    .replace(/\b(i\.e|e\.g|Mr|Mrs|Ms|Dr|Jr|Sr|St|Fr|Hon|Rev)\./g, (match) => match.replace(/\./g, '<dot>'))
    .replace(/\b([A-Z])\./g, '$1<dot>');
  const sentence = protectedText.match(/[^.!?]+[.!?]+/)?.[0] ?? text;
  return sentence.replace(/<dot>/g, '.').trim();
}

function isRepeatedSummaryPiece(piece: string, base: string) {
  const pieceWords = normalizedWords(piece);
  const baseText = ` ${normalizedWords(base).join(' ')} `;
  for (let index = 0; index <= pieceWords.length - 4; index += 1) {
    if (baseText.includes(` ${pieceWords.slice(index, index + 4).join(' ')} `)) return true;
  }
  return false;
}

function normalizedWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}
