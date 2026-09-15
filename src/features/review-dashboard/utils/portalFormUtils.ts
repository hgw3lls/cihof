export function parseListInput(value: string) {
  return Array.from(new Set(value.split(/[|;\n]/).map((item) => item.trim()).filter(Boolean)));
}

export function joinList(values: string[]) {
  return values.join('\n');
}

export function addListValue(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

export function removeListValue(values: string[], value: string) {
  return values.filter((item) => item !== value);
}

export function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanPortalList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanPortalString(item)).filter(Boolean)));
}
