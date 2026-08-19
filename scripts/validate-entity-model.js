import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateEntityModel } from './entity-model.js';

const entitiesPath = resolve('public/data/entities.json');
const relationshipsPath = resolve('public/data/entity-relationships.json');

const entityDocument = JSON.parse(readFileSync(entitiesPath, 'utf8'));
const relationshipDocument = JSON.parse(readFileSync(relationshipsPath, 'utf8'));
const validation = validateEntityModel(entityDocument, relationshipDocument);

console.log(`Entity validation: ${entityDocument.entities?.length ?? 0} entities.`);
console.log(`Relationship validation: ${relationshipDocument.relationships?.length ?? 0} relationships.`);
console.log(`Errors: ${validation.errors.length}`);
console.log(`Warnings: ${validation.warnings.length}`);

validation.errors.forEach((error) => console.error(`ERROR: ${error}`));
validation.warnings.forEach((warning) => console.warn(`WARN: ${warning}`));

if (validation.errors.length > 0) process.exitCode = 1;
