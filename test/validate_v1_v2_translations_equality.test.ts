import fs from 'fs';
import { resolve } from 'path';
import {
	getCardCyclesV2Json,
	getCardSetsV2Json,
	getCardTypesV2Json,
	getCardSubtypesV2Json,
	getFactionsV2Json,
	getCardsV2Json,
	getPrintingsV2Json
} from '../dist/index.js';
import { expect, describe, it } from 'vitest';
import lodash from 'lodash';
const { keyBy } = lodash;

// Pre-load English V2 source
const v2Cycles = getCardCyclesV2Json();
const v2Sets = getCardSetsV2Json();
const v2Types = getCardTypesV2Json();
const v2Subtypes = getCardSubtypesV2Json();
const v2Factions = getFactionsV2Json();
const v2Cards = getCardsV2Json();
const v2Printings = getPrintingsV2Json();

const v2CardsById = keyBy(v2Cards, 'id');
const v2PrintingsById = keyBy(v2Printings, 'id');
const v2CyclesByLegacyCode = keyBy(v2Cycles, 'legacy_code');
const v2SetsByLegacyCode = keyBy(v2Sets, 'legacy_code');

const i18nDir = resolve(import.meta.dirname, '../translations');
const locales = fs
	.readdirSync(i18nDir)
	.filter((f) => fs.existsSync(resolve(i18nDir, f)) && f !== '.DS_Store' && f !== 'schema');

function hasName(item: { name?: string | null }): boolean {
	return item.name !== null && item.name !== undefined && item.name.trim() !== '';
}

function getEnglishCombinedText(card: any) {
	const baseText = card.text || '';
	if (card.layout_id === 'flip') {
		const faceText = card.faces?.[0]?.text || '';
		return baseText + (faceText ? '\nFlip side:\n' + faceText : '');
	} else if (card.layout_id === 'facade') {
		const faceTexts = card.faces ? card.faces.map((f: any) => f.text || '') : [];
		return (
			baseText + faceTexts.map((txt, i) => (txt ? `\nSide ${i + 1}: ${txt}` : '')).join('')
		);
	}
	return baseText;
}

function getEnglishCombinedFlavor(printing: any) {
	const baseFlavor = printing.flavor || '';
	if (printing.faces && printing.faces.length > 0) {
		const faceFlavors = printing.faces.map((f: any) => f.flavor || '');
		return [baseFlavor]
			.concat(faceFlavors)
			.filter((f) => !!f)
			.join('\n');
	}
	return baseFlavor;
}

describe('V1/V2 Translations Parity & Equality', () => {
	const v2TranslationsDir = resolve(import.meta.dirname, '../v2/translations');
	const hasTranslations =
		fs.existsSync(v2TranslationsDir) &&
		locales.some((locale) => fs.existsSync(resolve(v2TranslationsDir, locale)));

	if (!hasTranslations) {
		it('skips equality checks as v2/translations directory is not present or populated', () => {
			expect(true).to.be.true;
		});
		return;
	}

	locales.forEach((locale) => {
		const localeV1Root = resolve(i18nDir, locale);
		const localeV2Root = resolve(import.meta.dirname, '../v2/translations', locale);

		if (!fs.existsSync(localeV2Root)) return;

		describe(`Locale: ${locale}`, () => {
			// 1. Cycles Equality
			const cyclesV1Path = resolve(localeV1Root, `cycles.${locale}.json`);
			if (fs.existsSync(cyclesV1Path)) {
				it('cycles match v1 translations', () => {
					const v1Cycles = JSON.parse(fs.readFileSync(cyclesV1Path, 'utf-8'));
					const v2TrPath = resolve(localeV2Root, 'card_cycles.json');
					const v2TrCycles = fs.existsSync(v2TrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2TrPath, 'utf-8')), 'id')
						: {};

					v1Cycles.forEach((c: any) => {
						if (!hasName(c)) return;
						const v2C = v2CyclesByLegacyCode[c.code];
						if (v2C) {
							const tr = v2TrCycles[v2C.id];
							expect(tr, `Missing translation for cycle ${c.code}`).to.not.be
								.undefined;
							expect(tr.name, `Name mismatch for cycle ${c.code}`).to.equal(c.name);
						}
					});
				});
			}

			// 2. Packs (Sets) Equality
			const packsV1Path = resolve(localeV1Root, `packs.${locale}.json`);
			if (fs.existsSync(packsV1Path)) {
				it('sets match v1 translations', () => {
					const v1Packs = JSON.parse(fs.readFileSync(packsV1Path, 'utf-8'));
					const v2TrPath = resolve(localeV2Root, 'card_sets.json');
					const v2TrSets = fs.existsSync(v2TrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2TrPath, 'utf-8')), 'id')
						: {};

					v1Packs.forEach((p: any) => {
						if (!hasName(p)) return;
						const v2S = v2SetsByLegacyCode[p.code];
						if (v2S) {
							const tr = v2TrSets[v2S.id];
							expect(tr, `Missing translation for pack ${p.code}`).to.not.be
								.undefined;
							expect(tr.name, `Name mismatch for pack ${p.code}`).to.equal(p.name);
						}
					});
				});
			}

			// 3. Factions Equality
			const factionsV1Path = resolve(localeV1Root, `factions.${locale}.json`);
			if (fs.existsSync(factionsV1Path)) {
				it('factions match v1 translations', () => {
					const v1Factions = JSON.parse(fs.readFileSync(factionsV1Path, 'utf-8'));
					const v2TrPath = resolve(localeV2Root, 'factions.json');
					const v2TrFactions = fs.existsSync(v2TrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2TrPath, 'utf-8')), 'id')
						: {};

					v1Factions.forEach((f: any) => {
						if (!hasName(f)) return;
						const v2Id = f.code.replace(/-/g, '_');
						const v2F = v2Factions.find((fac) => fac.id === v2Id);
						if (v2F) {
							const tr = v2TrFactions[v2Id];
							expect(tr, `Missing translation for faction ${f.code}`).to.not.be
								.undefined;
							expect(tr.name, `Name mismatch for faction ${f.code}`).to.equal(f.name);
						}
					});
				});
			}

			// 4. Sides Equality
			const sidesV1Path = resolve(localeV1Root, `sides.${locale}.json`);
			if (fs.existsSync(sidesV1Path)) {
				it('sides match v1 translations', () => {
					const v1Sides = JSON.parse(fs.readFileSync(sidesV1Path, 'utf-8'));
					const v2TrPath = resolve(localeV2Root, 'sides.json');
					const v2TrSides = fs.existsSync(v2TrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2TrPath, 'utf-8')), 'id')
						: {};

					v1Sides.forEach((s: any) => {
						if (!hasName(s)) return;
						const tr = v2TrSides[s.code];
						expect(tr, `Missing translation for side ${s.code}`).to.not.be.undefined;
						expect(tr.name, `Name mismatch for side ${s.code}`).to.equal(s.name);
					});
				});
			}

			// 5. Types & Subtypes Equality
			const typesV1Path = resolve(localeV1Root, `types.${locale}.json`);
			if (fs.existsSync(typesV1Path)) {
				it('types match v1 translations', () => {
					const v1Types = JSON.parse(fs.readFileSync(typesV1Path, 'utf-8'));
					const v2TrPath = resolve(localeV2Root, 'card_types.json');
					const v2TrTypes = fs.existsSync(v2TrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2TrPath, 'utf-8')), 'id')
						: {};

					const v2SubTrPath = resolve(localeV2Root, 'card_subtypes.json');
					const v2TrSubtypes = fs.existsSync(v2SubTrPath)
						? keyBy(JSON.parse(fs.readFileSync(v2SubTrPath, 'utf-8')), 'id')
						: {};

					v1Types.forEach((t: any) => {
						if (!hasName(t)) return;
						if (t.code === 'identity') {
							const trRunner = v2TrTypes['runner_identity'];
							const trCorp = v2TrTypes['corp_identity'];
							expect(trRunner, `Missing translation for runner_identity`).to.not.be
								.undefined;
							expect(trRunner.name, `Name mismatch for runner_identity`).to.equal(
								t.name
							);
							expect(trCorp, `Missing translation for corp_identity`).to.not.be
								.undefined;
							expect(trCorp.name, `Name mismatch for corp_identity`).to.equal(t.name);
						} else if (v2Types.some((v2T) => v2T.id === t.code)) {
							const tr = v2TrTypes[t.code];
							expect(tr, `Missing translation for type ${t.code}`).to.not.be
								.undefined;
							expect(tr.name, `Name mismatch for type ${t.code}`).to.equal(t.name);
						} else {
							const subId = t.code.replace(/-/g, '_');
							if (v2Subtypes.some((v2S) => v2S.id === subId)) {
								const tr = v2TrSubtypes[subId];
								expect(tr, `Missing translation for subtype ${t.code}`).to.not.be
									.undefined;

								const normalize = (s: string | null | undefined) =>
									(s || '').replace(/ー$/, '');
								expect(
									normalize(tr.name) === normalize(t.name) || tr.name === t.name,
									`Name mismatch for subtype ${t.code}: expected '${tr.name}' to equal '${t.name}'`
								).to.be.true;
							}
						}
					});
				});
			}

			// 6. Cards and Printings text parity
			it('card and printing translation contents match v1 translations', () => {
				const v1PackDir = resolve(localeV1Root, 'pack');
				if (!fs.existsSync(v1PackDir)) return;

				const v2TrCardsDir = resolve(localeV2Root, 'cards');
				const v2TrPrintingsDir = resolve(localeV2Root, 'printings');

				// Load all v2 translations for the locale
				const v2TrCards: Record<string, any> = {};
				if (fs.existsSync(v2TrCardsDir)) {
					fs.readdirSync(v2TrCardsDir).forEach((file) => {
						if (file.endsWith('.json')) {
							const id = file.replace('.json', '');
							v2TrCards[id] = JSON.parse(
								fs.readFileSync(resolve(v2TrCardsDir, file), 'utf-8')
							);
						}
					});
				}

				const v2TrPrintings: Record<string, any> = {};
				if (fs.existsSync(v2TrPrintingsDir)) {
					fs.readdirSync(v2TrPrintingsDir).forEach((file) => {
						if (file.endsWith('.json')) {
							const setPrs = JSON.parse(
								fs.readFileSync(resolve(v2TrPrintingsDir, file), 'utf-8')
							);
							setPrs.forEach((pr: any) => {
								v2TrPrintings[pr.id] = pr;
							});
						}
					});
				}

				// Group v1 cards by card_id and printing ID to handle duplicate inconsistencies
				const v1CardsByCardId = new Map<string, any[]>();
				const v1CardsByPrintingId = new Map<string, any[]>();

				fs.readdirSync(v1PackDir).forEach((file) => {
					if (!file.endsWith('.json')) return;
					const v1Cards = JSON.parse(fs.readFileSync(resolve(v1PackDir, file), 'utf-8'));
					v1Cards.forEach((v1Card: any) => {
						const p = v2PrintingsById[v1Card.code];
						if (!p) return;
						const c = v2CardsById[p.card_id];
						if (!c) return;

						let cardGroup = v1CardsByCardId.get(c.id);
						if (!cardGroup) {
							cardGroup = [];
							v1CardsByCardId.set(c.id, cardGroup);
						}
						cardGroup.push({ v1Card, p, c });

						let prGroup = v1CardsByPrintingId.get(p.id);
						if (!prGroup) {
							prGroup = [];
							v1CardsByPrintingId.set(p.id, prGroup);
						}
						prGroup.push({ v1Card, p });
					});
				});

				// A & B: Card Title & Text Parity
				for (const group of v1CardsByCardId.values()) {
					const first = group[0];
					const c = first.c;
					const trCard = v2TrCards[c.id];

					let reconstructedTitle: string;
					let reconstructedText: string;

					if (!trCard) {
						reconstructedTitle = c.title;
						reconstructedText = getEnglishCombinedText(c);
					} else {
						reconstructedTitle = trCard.title || c.title;
						if (trCard.text === undefined || trCard.text === null) {
							reconstructedText = getEnglishCombinedText(c);
						} else {
							const baseText = trCard.text;
							reconstructedText = baseText;

							if (c.layout_id === 'flip') {
								const faceText = trCard.faces?.[0]?.text || '';
								reconstructedText =
									baseText + (faceText ? '\nFlip side:\n' + faceText : '');
							} else if (c.layout_id === 'facade') {
								const faceTexts = trCard.faces
									? trCard.faces.map((f: any) => f.text || '')
									: [];
								reconstructedText =
									baseText +
									faceTexts
										.map((txt: string, idx: number) =>
											txt ? `\nSide ${idx + 1}: ${txt}` : ''
										)
										.join('');
							}
						}
					}

					// Title check
					const expectedTitles = new Set(
						group.map((item) =>
							item.v1Card.title === null ||
							item.v1Card.title === undefined ||
							item.v1Card.title.trim() === ''
								? c.title
								: item.v1Card.title
						)
					);
					expect(
						expectedTitles.has(reconstructedTitle),
						`Title mismatch for card ${c.id} (${locale}): expected '${reconstructedTitle}' to be one of [${Array.from(expectedTitles).join(', ')}]`
					).to.be.true;

					// Text check
					const expectedTexts = new Set(
						group.map((item) =>
							item.v1Card.text === null ||
							item.v1Card.text === undefined ||
							item.v1Card.text.trim() === ''
								? getEnglishCombinedText(c)
								: item.v1Card.text
						)
					);

					const normalize = (txt: string) =>
						txt
							.replace(/\r\n/g, '\n')
							.replace(
								/\n(?:Flip side|umgedrehte Seite|背面)[:：]?\n/gi,
								'\n[FLIP_DIVIDER]\n'
							);

					const normReconstructed = normalize(reconstructedText);
					const hasMatchingText = Array.from(expectedTexts).some(
						(expText) => normalize(expText || '') === normReconstructed
					);

					expect(
						hasMatchingText,
						`Text mismatch for card ${c.id} (${locale}): expected '${reconstructedText}' to match one of [${Array.from(expectedTexts).join(', ')}]`
					).to.be.true;
				}

				// C. Printing Flavor Parity
				for (const [printingId, group] of v1CardsByPrintingId.entries()) {
					const first = group[0];
					const p = first.p;
					const trPr = v2TrPrintings[p.id];

					const baseFlavor = trPr?.flavor || p.flavor || '';
					let reconstructedFlavor = baseFlavor;

					if (p.faces && p.faces.length > 0) {
						const faceFlavors = p.faces.map((face: any, idx: number) => {
							const trFace = trPr?.faces?.[idx];
							return (
								(trFace && trFace.flavor !== undefined
									? trFace.flavor
									: face.flavor) || ''
							);
						});
						reconstructedFlavor = [baseFlavor]
							.concat(faceFlavors)
							.filter((f) => !!f)
							.join('\n');
					}

					const expectedFlavors = new Set(
						group.map((item) =>
							item.v1Card.flavor === null ||
							item.v1Card.flavor === undefined ||
							item.v1Card.flavor.trim() === ''
								? getEnglishCombinedFlavor(p)
								: item.v1Card.flavor
						)
					);

					expect(
						expectedFlavors.has(reconstructedFlavor),
						`Flavor mismatch for printing ${printingId} (${locale}): expected '${reconstructedFlavor}' to be one of [${Array.from(expectedFlavors).join(', ')}]`
					).to.be.true;
				}
			});
		});
	});
});
