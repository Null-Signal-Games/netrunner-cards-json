import fs from 'fs';
import { resolve } from 'path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
	getCardCyclesV2Json,
	getCardSetsV2Json,
	getCardTypesV2Json,
	getCardSubtypesV2Json,
	getFactionsV2Json,
	getSidesV2Json,
	getCardsV2Json,
	getPrintingsV2Json
} from '../dist/index.js';
import { expect, describe, it } from 'vitest';

const ajv = new Ajv2020({ strict: true, allErrors: true });

function validateAgainstSchema(schemaFile: string, data: any) {
	const schemaPath = resolve(import.meta.dirname, '../schema/v2', schemaFile);
	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
	const validate = ajv.getSchema(schema.$id) || ajv.compile(schema);
	validate(data);
	if (validate.errors) {
		expect.fail(ajv.errorsText(validate.errors));
	}
}

// Pre-load English source IDs
const cardCyclesIds = new Set(getCardCyclesV2Json().map((c) => c.id));
const cardSetsIds = new Set(getCardSetsV2Json().map((s) => s.id));
const cardTypesIds = new Set(getCardTypesV2Json().map((t) => t.id));
const cardSubtypesIds = new Set(getCardSubtypesV2Json().map((s) => s.id));
const factionsIds = new Set(getFactionsV2Json().map((f) => f.id));
const sidesIds = new Set(getSidesV2Json().map((s) => s.id));
const cardIds = new Set(getCardsV2Json().map((c) => c.id));
const printingIds = new Set(getPrintingsV2Json().map((p) => p.id));

const i18nDir = resolve(import.meta.dirname, '../translations');
const locales = fs
	.readdirSync(i18nDir)
	.filter((f) => fs.existsSync(resolve(i18nDir, f)) && f !== '.DS_Store' && f !== 'schema');

describe('V2 Translations Validation', () => {
	const v2TranslationsDir = resolve(import.meta.dirname, '../v2/translations');
	const hasTranslations =
		fs.existsSync(v2TranslationsDir) &&
		locales.some((locale) => fs.existsSync(resolve(v2TranslationsDir, locale)));

	if (!hasTranslations) {
		it('skips validation as v2/translations directory is not present or populated', () => {
			expect(true).to.be.true;
		});
		return;
	}

	it('has at least one locale translation directory', () => {
		expect(locales.length).to.be.greaterThan(0);
	});

	locales.forEach((locale) => {
		const v2Root = resolve(import.meta.dirname, '../v2/translations', locale);
		if (!fs.existsSync(v2Root)) return;

		describe(`Locale: ${locale}`, () => {
			// 1. Metadata Schema Validation and Orphan Check
			const metadataChecks = [
				{
					name: 'card_cycles',
					schema: 'card_cycles_translation_schema.json',
					idSet: cardCyclesIds
				},
				{
					name: 'card_sets',
					schema: 'card_sets_translation_schema.json',
					idSet: cardSetsIds
				},
				{
					name: 'card_types',
					schema: 'card_types_translation_schema.json',
					idSet: cardTypesIds
				},
				{
					name: 'card_subtypes',
					schema: 'card_subtypes_translation_schema.json',
					idSet: cardSubtypesIds
				},
				{
					name: 'factions',
					schema: 'factions_translation_schema.json',
					idSet: factionsIds
				},
				{
					name: 'sides',
					schema: 'sides_translation_schema.json',
					idSet: sidesIds
				}
			];

			metadataChecks.forEach((check) => {
				const filepath = resolve(v2Root, `${check.name}.json`);
				if (fs.existsSync(filepath)) {
					it(`${check.name}.json passes schema validation`, () => {
						const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
						validateAgainstSchema(check.schema, data);

						// Orphan ID check
						data.forEach((item: any) => {
							expect(
								check.idSet.has(item.id),
								`Orphaned ID '${item.id}' found in ${locale}/v2/${check.name}.json`
							).to.be.true;
						});
					});
				}
			});

			// 2. Cards Schema Validation and Orphan Check
			const cardsDir = resolve(v2Root, 'cards');
			if (fs.existsSync(cardsDir)) {
				it('card translations pass schema validation and contain no orphans', () => {
					const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json'));
					files.forEach((file) => {
						const cardId = file.replace('.json', '');
						expect(
							cardIds.has(cardId),
							`Orphaned card translation file found: ${locale}/v2/cards/${file}`
						).to.be.true;

						const data = JSON.parse(fs.readFileSync(resolve(cardsDir, file), 'utf-8'));
						validateAgainstSchema('cards_translation_schema.json', data);
						expect(data.id, `ID mismatch in translation file: ${file}`).to.equal(
							cardId
						);
					});
				});
			}

			// 3. Printings Schema Validation and Orphan Check
			const printingsDir = resolve(v2Root, 'printings');
			if (fs.existsSync(printingsDir)) {
				it('printing translations pass schema validation and contain no orphans', () => {
					const files = fs.readdirSync(printingsDir).filter((f) => f.endsWith('.json'));
					files.forEach((file) => {
						const setId = file.replace('.json', '');
						expect(
							cardSetsIds.has(setId),
							`Orphaned printings translation file found: ${locale}/v2/printings/${file}`
						).to.be.true;

						const data = JSON.parse(
							fs.readFileSync(resolve(printingsDir, file), 'utf-8')
						);
						validateAgainstSchema('printings_translation_schema.json', data);

						// Orphan ID check
						data.forEach((item: any) => {
							expect(
								printingIds.has(item.id),
								`Orphaned printing ID '${item.id}' found in ${locale}/v2/printings/${file}`
							).to.be.true;
						});
					});
				});
			}
		});
	});
});
