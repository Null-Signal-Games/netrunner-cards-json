import { readdirSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import {
	getCardCyclesV2Json,
	getCardSetsV2Json,
	getCardTypesV2Json,
	getCardSubtypesV2Json,
	getFactionsV2Json,
	getSidesV2Json,
	getCardsV2Json,
	getPrintingsV2Json
} from './index.js';
import {
	readJson,
	readJsonMap,
	writeOrRemoveJson,
	cleanOrphanedJsonFiles,
	getV1CardsForLocale
} from './lib/io.js';
import lodash from 'lodash';
const { keyBy } = lodash;

// Setup directories and locales
const i18nDir = resolve('.', 'translations');
const locales = readdirSync(i18nDir).filter(
	(f) => existsSync(join(i18nDir, f)) && f !== '.DS_Store' && f !== 'schema'
);

// English V2 Source Data & Indexes
const v2Cycles = getCardCyclesV2Json();
const v2Sets = getCardSetsV2Json();
const v2Types = getCardTypesV2Json();
const v2Subtypes = getCardSubtypesV2Json();
const v2SubtypeIds = new Set(v2Subtypes.map((s) => s.id));
const v2Factions = getFactionsV2Json();
const v2Sides = getSidesV2Json();
const v2Cards = getCardsV2Json();
const v2Printings = getPrintingsV2Json();

const v2CardsById = keyBy(v2Cards, 'id');
const v2PrintingsById = keyBy(v2Printings, 'id');
const v2CyclesByLegacyCode = keyBy(v2Cycles, 'legacy_code');
const v2SetsByLegacyCode = keyBy(v2Sets, 'legacy_code');
const v2FactionsById = keyBy(v2Factions, 'id');

const englishPrintingsBySet: Record<string, any[]> = {};
v2Printings.forEach((p) => {
	(englishPrintingsBySet[p.card_set_id] ??= []).push(p);
});

function V2PrintingAndCard(v1CardCode: string) {
	const printing = v2PrintingsById[v1CardCode];
	if (!printing) return null;
	const card = v2CardsById[printing.card_id];
	if (!card) return null;
	return { printing, card };
}

// -------------------------------------------------------------
// 1. Metadata Processor
// -------------------------------------------------------------
function processMetadata(
	locale: string,
	filePath: string,
	englishItems: any[],
	fileName: string,
	v1Items: { id: string; name: string }[],
	allDiscrepancies: string[]
) {
	const engById = keyBy(englishItems, 'id');
	const existingV2 = readJson<any[]>(filePath) || [];
	const resultTrMap = new Map<string, string>();

	existingV2.forEach((item) => {
		if (item.id && item.name && item.name.trim() !== '') {
			resultTrMap.set(item.id, item.name);
		}
	});

	v1Items.forEach((v1Item) => {
		const eng = engById[v1Item.id];
		if (eng && v1Item.name && v1Item.name.trim() !== '') {
			const existingTr = resultTrMap.get(v1Item.id);
			if (existingTr && existingTr !== v1Item.name) {
				allDiscrepancies.push(
					`[${locale}] Metadata conflict for ${fileName}:${v1Item.id} - V2: "${existingTr}", V1: "${v1Item.name}"`
				);
			} else if (!existingTr) {
				resultTrMap.set(v1Item.id, v1Item.name);
			}
		}
	});

	const updated: { id: string; name: string }[] = [];
	englishItems.forEach((eng) => {
		const trName = resultTrMap.get(eng.id);
		if (trName && trName.trim() !== '') {
			updated.push({ id: eng.id, name: trName });
		}
	});

	writeOrRemoveJson(filePath, updated, updated.length > 0);
}

const metadataConfigs = [
	{
		fileName: 'card_cycles',
		items: v2Cycles,
		v1File: 'cycles',
		map: (c: any) => {
			const v2C = v2CyclesByLegacyCode[c.code];
			return v2C ? { id: v2C.id, name: c.name } : null;
		}
	},
	{
		fileName: 'card_sets',
		items: v2Sets,
		v1File: 'packs',
		map: (p: any) => {
			const v2S = v2SetsByLegacyCode[p.code];
			return v2S ? { id: v2S.id, name: p.name } : null;
		}
	},
	{
		fileName: 'factions',
		items: v2Factions,
		v1File: 'factions',
		map: (f: any) => {
			const v2Id = f.code.replace(/-/g, '_');
			return v2FactionsById[v2Id] ? { id: v2Id, name: f.name } : null;
		}
	},
	{
		fileName: 'sides',
		items: v2Sides,
		v1File: 'sides',
		map: (s: any) => ({ id: s.code, name: s.name })
	}
];

function processAllMetadata(
	locale: string,
	localeV1Root: string,
	v2Root: string,
	v1Cards: any[],
	allDiscrepancies: string[]
) {
	// Simple metadata
	for (const cfg of metadataConfigs) {
		const v1Path = join(localeV1Root, `${cfg.v1File}.${locale}.json`);
		const v1Data = readJson<any[]>(v1Path) || [];
		const v1Items = v1Data
			.map(cfg.map)
			.filter((x): x is { id: string; name: string } => x !== null);
		processMetadata(
			locale,
			join(v2Root, `${cfg.fileName}.json`),
			cfg.items,
			cfg.fileName,
			v1Items,
			allDiscrepancies
		);
	}

	// Card Types
	const v1TypesList = readJson<any[]>(join(localeV1Root, `types.${locale}.json`)) || [];
	const trTypes: { id: string; name: string }[] = [];
	v1TypesList.forEach((t: any) => {
		if (t.code === 'identity') {
			trTypes.push(
				{ id: 'runner_identity', name: t.name },
				{ id: 'corp_identity', name: t.name }
			);
		} else if (v2Types.some((v2T) => v2T.id === t.code)) {
			trTypes.push({ id: t.code, name: t.name });
		}
	});
	processMetadata(
		locale,
		join(v2Root, 'card_types.json'),
		v2Types,
		'card_types',
		trTypes,
		allDiscrepancies
	);

	// Card Subtypes
	const trSubtypesMap = new Map<string, string>();
	v1TypesList.forEach((t: any) => {
		const subId = t.code.replace(/-/g, '_');
		if (v2SubtypeIds.has(subId) && t.name) {
			trSubtypesMap.set(subId, t.name);
		}
	});

	v1Cards.forEach((v1Card: any) => {
		if (!v1Card.keywords) return;
		const resolved = V2PrintingAndCard(v1Card.code);
		if (!resolved || !resolved.card.subtypes) return;
		const { card: c } = resolved;

		const v1KwList = v1Card.keywords.split(' - ').map((k: string) => k.trim());
		c.subtypes.forEach((engSubId: string, idx: number) => {
			const trKw = v1KwList[idx];
			if (trKw && !trSubtypesMap.has(engSubId)) {
				trSubtypesMap.set(engSubId, trKw);
			}
		});
	});

	const trSubtypes = Array.from(trSubtypesMap.entries()).map(([id, name]) => ({ id, name }));
	processMetadata(
		locale,
		join(v2Root, 'card_subtypes.json'),
		v2Subtypes,
		'card_subtypes',
		trSubtypes,
		allDiscrepancies
	);
}

// -------------------------------------------------------------
// 2. Card Files Processor
// -------------------------------------------------------------
function processCardFiles(
	locale: string,
	cardsRoot: string,
	v1Cards: any[],
	allDiscrepancies: string[]
) {
	cleanOrphanedJsonFiles(
		cardsRoot,
		new Set(v2Cards.map((c) => c.id)),
		'Removing orphaned translation card file'
	);

	const v2CardsTrMap = readJsonMap<any>(cardsRoot);

	v1Cards.forEach((v1Card: any) => {
		const resolved = V2PrintingAndCard(v1Card.code);
		if (!resolved) return;
		const { card: c } = resolved;

		let trCard = v2CardsTrMap.get(c.id);
		if (!trCard) {
			trCard = { id: c.id, title: null };
			v2CardsTrMap.set(c.id, trCard);
		}

		if (v1Card.title && v1Card.title.trim() !== '' && v1Card.title !== c.title) {
			if (trCard.title && trCard.title !== v1Card.title) {
				allDiscrepancies.push(
					`[${locale}] Card title conflict for ${c.id} - V2: "${trCard.title}", V1: "${v1Card.title}"`
				);
			} else if (!trCard.title) {
				trCard.title = v1Card.title;
			}
		}

		if (v1Card.text && v1Card.text.trim() !== '') {
			if (c.layout_id === undefined || c.layout_id === 'normal') {
				if (v1Card.text !== c.text) {
					if (trCard.text && trCard.text !== v1Card.text) {
						allDiscrepancies.push(`[${locale}] Card text conflict for ${c.id}`);
					} else if (!trCard.text) {
						trCard.text = v1Card.text;
					}
				}
			} else if (c.layout_id === 'flip') {
				// TODO(plural): Come up with a more durable flip methodology or reverse the flow to go from V2 -> V1.
				const parts = v1Card.text.split(/\n(?:Flip side|umgedrehte Seite|背面)[:：]?\n/gi);
				if (parts[0] !== c.text && !trCard.text) {
					trCard.text = parts[0];
				}
				if (parts[1] && !trCard.faces) {
					trCard.faces = [{ title: null, text: parts[1] }];
				}
			} else if (c.layout_id === 'facade') {
				const parts = v1Card.text.split(/\nSide \d+: /);
				if (parts[0] !== c.text && !trCard.text) {
					trCard.text = parts[0];
				}
				if (parts.length > 1 && !trCard.faces) {
					trCard.faces = parts
						.slice(1)
						.map((part: string) => ({ title: null, text: part }));
				}
			}
		}
	});

	for (const card of v2Cards) {
		const cardPath = join(cardsRoot, `${card.id}.json`);
		const trCard = v2CardsTrMap.get(card.id);

		if (!trCard) {
			if (existsSync(cardPath)) rmSync(cardPath);
			continue;
		}

		const updatedTr: any = { id: card.id };
		let hasContent = false;

		if (trCard.title && trCard.title.trim() !== '' && trCard.title !== card.title) {
			updatedTr.title = trCard.title;
			hasContent = true;
		} else {
			updatedTr.title = null;
		}

		if (trCard.text && trCard.text.trim() !== '' && trCard.text !== card.text) {
			updatedTr.text = trCard.text;
			hasContent = true;
		}

		if (card.faces && trCard.faces && Array.isArray(trCard.faces)) {
			const updatedFaces: any[] = [];
			card.faces.forEach((face, idx) => {
				const trFace = trCard.faces[idx];
				if (trFace) {
					let faceHasContent = false;
					let faceTitle: string | null = null;
					let faceText: string | undefined = undefined;

					if (trFace.title && trFace.title.trim() !== '' && trFace.title !== face.title) {
						faceTitle = trFace.title;
						faceHasContent = true;
					}
					if (trFace.text && trFace.text.trim() !== '' && trFace.text !== face.text) {
						faceText = trFace.text;
						faceHasContent = true;
					}
					if (faceHasContent) {
						const updatedFace: any = { title: faceTitle };
						if (faceText !== undefined) updatedFace.text = faceText;
						updatedFaces.push(updatedFace);
					}
				}
			});
			if (updatedFaces.length > 0) {
				updatedTr.faces = updatedFaces;
				hasContent = true;
			}
		}

		if (!hasContent && existsSync(cardPath)) {
			console.log(`Deleting empty/untranslated card file: ${cardPath}`);
		}
		writeOrRemoveJson(cardPath, updatedTr, hasContent);
	}
}

// -------------------------------------------------------------
// 3. Printing Files Processor
// -------------------------------------------------------------
function processPrintingFiles(printingsRoot: string, v1Cards: any[]) {
	cleanOrphanedJsonFiles(
		printingsRoot,
		new Set(Object.keys(englishPrintingsBySet)),
		'Removing orphaned printings file'
	);

	const v2PrintingsTrMap = new Map<string, any>();
	if (existsSync(printingsRoot)) {
		readdirSync(printingsRoot).forEach((file) => {
			if (file.endsWith('.json')) {
				const existing = readJson<any[]>(join(printingsRoot, file)) || [];
				existing.forEach((pr: any) => v2PrintingsTrMap.set(pr.id, pr));
			}
		});
	}

	v1Cards.forEach((v1Card: any) => {
		if (!v1Card.flavor || v1Card.flavor.trim() === '') return;
		const resolved = V2PrintingAndCard(v1Card.code);
		if (!resolved) return;
		const { printing: p } = resolved;

		let trPr = v2PrintingsTrMap.get(p.id);
		if (!trPr) {
			trPr = { id: p.id };
			v2PrintingsTrMap.set(p.id, trPr);
		}

		const flavorParts = v1Card.flavor.split('\n');
		const v2Flavor = p.faces
			? [p.flavor]
					.concat(p.faces.map((s: any) => s.flavor))
					.filter((f: any) => !!f)
					.join('\n')
			: p.flavor;

		if (v1Card.flavor !== v2Flavor) {
			if (p.faces && p.faces.length > 0) {
				let faceIdx = 0;
				if (p.flavor) {
					if (flavorParts[0] !== p.flavor && !trPr.flavor) {
						trPr.flavor = flavorParts[0];
					}
					faceIdx = 1;
				}
				if (!trPr.faces) {
					const trFaces: any[] = [];
					p.faces.forEach((face: any, idx: number) => {
						const part = flavorParts[faceIdx + idx];
						if (part && part !== face.flavor) {
							trFaces.push({ flavor: part });
						} else {
							trFaces.push({ flavor: null });
						}
					});
					if (trFaces.some((f: any) => f.flavor !== null)) {
						trPr.faces = trFaces;
					}
				}
			} else if (!trPr.flavor) {
				trPr.flavor = v1Card.flavor;
			}
		}
	});

	for (const [setId, setPrs] of Object.entries(englishPrintingsBySet)) {
		const setPath = join(printingsRoot, `${setId}.json`);
		const updatedSetTr: any[] = [];

		for (const pr of setPrs) {
			const trPr = v2PrintingsTrMap.get(pr.id);
			if (trPr) {
				const updatedPr: any = { id: pr.id };
				let prHasContent = false;

				if (trPr.flavor && trPr.flavor.trim() !== '' && trPr.flavor !== pr.flavor) {
					updatedPr.flavor = trPr.flavor;
					prHasContent = true;
				}

				if (pr.faces && trPr.faces && Array.isArray(trPr.faces)) {
					const updatedFaces: any[] = [];
					pr.faces.forEach((face: any, idx: number) => {
						const trFace = trPr.faces[idx];
						if (
							trFace &&
							trFace.flavor &&
							trFace.flavor.trim() !== '' &&
							trFace.flavor !== face.flavor
						) {
							updatedFaces.push({ flavor: trFace.flavor });
						}
					});
					if (updatedFaces.length > 0) {
						updatedPr.faces = updatedFaces;
						prHasContent = true;
					}
				}

				if (prHasContent) {
					updatedSetTr.push(updatedPr);
				}
			}
		}

		writeOrRemoveJson(setPath, updatedSetTr, updatedSetTr.length > 0);
	}
}

// -------------------------------------------------------------
// Main Execution Loop
// -------------------------------------------------------------
const allDiscrepancies: string[] = [];

for (const locale of locales) {
	console.log(`Updating v2 locales for: ${locale}`);
	const localeV1Root = join(i18nDir, locale);
	const v2Root = resolve('.', 'v2', 'translations', locale);
	const cardsRoot = join(v2Root, 'cards');
	const printingsRoot = join(v2Root, 'printings');

	mkdirSync(v2Root, { recursive: true });
	mkdirSync(cardsRoot, { recursive: true });
	mkdirSync(printingsRoot, { recursive: true });

	const v1Cards = getV1CardsForLocale(localeV1Root);

	processAllMetadata(locale, localeV1Root, v2Root, v1Cards, allDiscrepancies);
	processCardFiles(locale, cardsRoot, v1Cards, allDiscrepancies);
	processPrintingFiles(printingsRoot, v1Cards);
}

// Summary of Discrepancies
console.log('\n==================================================');
if (allDiscrepancies.length > 0) {
	console.log(`=== Translation Discrepancies Summary (${allDiscrepancies.length}) ===`);
	allDiscrepancies.forEach((d) => console.log(` - ${d}`));
} else {
	console.log(`=== Translation Discrepancies Summary: 0 Discrepancies Found ===`);
}
console.log('==================================================\n');
