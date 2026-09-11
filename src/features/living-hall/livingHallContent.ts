import type { HallLens, Inductee } from '../../data/types';

export function buildVisitSessionUrl({
  focusedPersonId,
  lens,
  savedPeople,
  timelineYear,
  traceFocusKey,
}: {
  focusedPersonId: string;
  lens: HallLens;
  savedPeople: Inductee[];
  timelineYear: string;
  traceFocusKey: string;
}) {
  if (savedPeople.length === 0) return '';

  const savedIds = savedPeople.map((person) => person.id);
  const startingPersonId = savedIds.includes(focusedPersonId) ? focusedPersonId : savedIds[0];
  const baseHref = new URL(
    import.meta.env.BASE_URL || '/',
    typeof window === 'undefined' ? 'https://clevelandinternationalhalloffame.com' : window.location.origin,
  ).href;
  const url = new URL(baseHref);

  url.searchParams.set('person', startingPersonId);
  url.searchParams.set('visit', savedIds.join(','));
  if (lens !== 'portraits') url.searchParams.set('lens', lens);
  if (lens === 'traces' && traceFocusKey) url.searchParams.set('trace', traceFocusKey);
  if (lens === 'legacies' && timelineYear) url.searchParams.set('timeYear', timelineYear);

  return url.href;
}

export function fullBiographyWordCount(inductee: Inductee) {
  return wordCountText(fullBiographyText(inductee));
}

export function fullBiographyText(inductee: Inductee) {
  const source = inductee.bioText || inductee.lifeWorkSummary || inductee.storySummary || inductee.honoredForSummary;
  return stripLeadingBiographyName(source.replace(/\s+/g, ' ').trim(), inductee.name);
}

export function biographyParagraphs(text: string) {
  if (!text) return ['No biography text is available in this local data bundle.'];
  const sentences = splitBiographySentences(text);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  sentences.forEach((sentence) => {
    const sentenceWords = wordCountText(sentence);
    if (current.length > 0 && (currentWords + sentenceWords > 115 || current.length >= 4)) {
      paragraphs.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += sentenceWords;
  });

  if (current.length > 0) paragraphs.push(current.join(' '));
  return paragraphs;
}

export function wordCountText(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function stripLeadingBiographyName(text: string, name: string) {
  const variants = [
    name,
    name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);
  const lowerText = text.toLowerCase();
  const match = variants.find((variant) => lowerText.startsWith(variant.toLowerCase()));
  if (!match) return text;
  return text.slice(match.length).replace(/^[-:,\s]+/, '').trim() || text;
}

function splitBiographySentences(text: string) {
  const protectedText = text
    .replace(/\b(i\.e|e\.g|Mr|Mrs|Ms|Dr|Jr|Sr|St|Fr|Hon|Rev)\./gi, (match) => match.replace(/\./g, '<dot>'))
    .replace(/\b([A-Z])\./g, '$1<dot>');
  return (protectedText.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [protectedText])
    .map((sentence) => sentence.replace(/<dot>/g, '.').trim())
    .filter(Boolean);
}
