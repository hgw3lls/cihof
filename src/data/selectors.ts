import type { Inductee } from './types';

export const getYearOptions = (inductees: Inductee[]) => {
  return Array.from(new Set(inductees.map((inductee) => inductee.class_year)))
    .map((year) => Number(year))
    .filter((year) => !Number.isNaN(year))
    .sort((a, b) => a - b)
    .map((year) => year.toString());
};

export const getYearOptionsDesc = (inductees: Inductee[]) => {
  return Array.from(new Set(inductees.map((inductee) => inductee.class_year)))
    .map((year) => Number(year))
    .filter((year) => !Number.isNaN(year))
    .sort((a, b) => b - a)
    .map((year) => year.toString());
};

export const getRegionOptions = (inductees: Inductee[]) => {
  return Array.from(new Set(inductees.map((inductee) => inductee.region)))
    .filter((region) => region.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
};
