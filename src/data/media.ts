export const dedupePreserveOrder = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  });
  return result;
};

export const parseListField = (value: string | null | undefined) => {
  if (!value) {
    return [];
  }
  const normalized = String(value).trim();
  if (!normalized || normalized.toLowerCase() === 'nan') {
    return [];
  }
  const parts = normalized.split(/[|;,]/g).map((entry) => entry.trim());
  return dedupePreserveOrder(parts.filter((entry) => entry.length > 0));
};

export const resolveMediaPath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
  const lower = normalized.toLowerCase();
  const imagesIndex = lower.indexOf('/images/');
  const videosIndex = lower.indexOf('/videos/');
  let sliced = normalized;
  if (imagesIndex >= 0) {
    sliced = normalized.slice(imagesIndex);
  } else if (videosIndex >= 0) {
    sliced = normalized.slice(videosIndex);
  }
  if (!sliced.startsWith('/')) {
    return `/${sliced}`;
  }
  return sliced;
};

export const extractYouTubeId = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  const watchMatch = trimmed.match(/[?&]v=([^&]+)/);
  if (watchMatch) {
    return watchMatch[1];
  }
  const shortMatch = trimmed.match(/youtu\.be\/([^?&/]+)/);
  if (shortMatch) {
    return shortMatch[1];
  }
  const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&/]+)/);
  if (embedMatch) {
    return embedMatch[1];
  }
  return null;
};

export const isYouTubeSearchUrl = (url: string) =>
  url.includes('youtube.com/results') || url.includes('youtube.com/search');
