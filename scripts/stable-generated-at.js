import { existsSync, readFileSync } from 'node:fs';

let fallbackGeneratedAt = '';

export function generatedAtFor(outputPath) {
  const explicitGeneratedAt = readExplicitGeneratedAt();
  if (explicitGeneratedAt) return explicitGeneratedAt;

  const existingGeneratedAt = readExistingGeneratedAt(outputPath);
  if (existingGeneratedAt) return existingGeneratedAt;

  if (!fallbackGeneratedAt) fallbackGeneratedAt = new Date().toISOString();
  return fallbackGeneratedAt;
}

function readExplicitGeneratedAt() {
  const configured = normalizeGeneratedAt(process.env.CIHOF_GENERATED_AT);
  if (configured) return configured;

  const epochSeconds = Number(process.env.SOURCE_DATE_EPOCH);
  if (!Number.isFinite(epochSeconds)) return '';
  return new Date(epochSeconds * 1000).toISOString();
}

function readExistingGeneratedAt(outputPath) {
  if (!existsSync(outputPath)) return '';

  try {
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8'));
    return normalizeGeneratedAt(parsed?.generatedAt);
  } catch {
    return '';
  }
}

function normalizeGeneratedAt(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}
