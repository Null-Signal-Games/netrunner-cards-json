// Check present translation coverages and print a summary.
// This tool defaults to all NSG releases unless the flags ask for something more specific.
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import commandLineArgs from 'command-line-args';
import { getCardSetsV2Json, getCardsV2Json, getPrintingsV2Json } from './index.js';
import lodash from 'lodash';
const { keyBy } = lodash;

const optionDefinitions = [
	{
		name: 'all',
		alias: 'a',
		type: Boolean,
		defaultValue: false,
		description: 'Check all sets (including FFG).'
	},
	{
		name: 'sets',
		alias: 's',
		type: String,
		description: 'Comma-separated card_set_ids to check.'
	},
	{
		name: 'cycles',
		alias: 'c',
		type: String,
		description: 'Comma-separated card_cycle_ids to check.'
	}
];
const options = commandLineArgs(optionDefinitions);

const i18nDir = resolve('.', 'translations');
const locales = readdirSync(i18nDir).filter(
	(f) => existsSync(join(i18nDir, f)) && f !== '.DS_Store' && f !== 'schema'
);

// Load English V2 source data
const allSets = getCardSetsV2Json();
const allCards = getCardsV2Json();
const allPrintings = getPrintingsV2Json();

// Filter sets
let filteredSets = allSets;

if (options.cycles) {
	const cycleIds = new Set(options.cycles.split(',').map((s: string) => s.trim()));
	filteredSets = filteredSets.filter((s) => cycleIds.has(s.card_cycle_id));
}

if (options.sets) {
	const setIds = new Set(options.sets.split(',').map((s: string) => s.trim()));
	filteredSets = filteredSets.filter((s) => setIds.has(s.id));
}

if (!options.cycles && !options.sets && !options.all) {
	filteredSets = filteredSets.filter((s) => s.released_by === 'null_signal_games');
}

const filteredSetIds = new Set(filteredSets.map((s) => s.id));

// Find printings belonging to filtered sets and count unique cards
const filteredPrintings = allPrintings.filter((p) => filteredSetIds.has(p.card_set_id));
const filteredCardIds = new Set(filteredPrintings.map((p) => p.card_id));
const filteredCards = allCards.filter((c) => filteredCardIds.has(c.id));

// Determine total translatable cards and printings
let totalCardsCount = filteredCards.length;
filteredCards.forEach((c) => {
	if (c.faces) totalCardsCount += c.faces.length;
});

const printingsWithFlavor = filteredPrintings.filter((p) => {
	if (p.flavor && p.flavor.trim() !== '') return true;
	if (p.faces && p.faces.some((f: any) => f.flavor && f.flavor.trim() !== '')) return true;
	return false;
});

let totalFlavorCount = 0;
printingsWithFlavor.forEach((p) => {
	if (p.flavor && p.flavor.trim() !== '') totalFlavorCount++;
	if (p.faces) {
		p.faces.forEach((f: any) => {
			if (f.flavor && f.flavor.trim() !== '') totalFlavorCount++;
		});
	}
});

console.log(`=== Translation Summary Check ===`);
if (options.cycles || options.sets) {
	const filters: string[] = [];
	if (options.cycles) filters.push(`Cycles: [${options.cycles}]`);
	if (options.sets) filters.push(`Sets: [${options.sets}]`);
	console.log(`Filtering to: ${filters.join(', ')}`);
} else {
	console.log(`Filtering to: ${options.all ? 'All Sets' : 'Null Signal Games Sets Only'}`);
}
console.log(`Total Translatable Cards (inc. faces): ${totalCardsCount}`);
console.log(`Total Translatable Printings (flavor text items): ${totalFlavorCount}`);
console.log(`---------------------------------\n`);

const col1Width = 7;
const col2Width = 16;
const col3Width = 6;
const col4Width = 20;
const col5Width = 6;
const col6Width = 9;

console.log(
	`| ${'Locale'.padEnd(col1Width)} | ${'Cards Translated'.padEnd(col2Width)} | ${'%'.padStart(col3Width)} | ${'Printings Translated'.padEnd(col4Width)} | ${'%'.padStart(col5Width)} | ${'Overall %'.padStart(col6Width)} |`
);
console.log(
	`| :${'-'.repeat(col1Width - 1)} | :${'-'.repeat(col2Width - 1)} | :${'-'.repeat(col3Width - 2)}: | :${'-'.repeat(col4Width - 1)} | :${'-'.repeat(col5Width - 2)}: | :${'-'.repeat(col6Width - 2)}: |`
);

locales.forEach((locale) => {
	const v2Root = resolve('.', 'v2', 'translations', locale);
	const cardsRoot = join(v2Root, 'cards');
	const printingsRoot = join(v2Root, 'printings');

	let translatedCards = 0;
	let translatedFlavor = 0;

	// Count translated cards
	filteredCards.forEach((c) => {
		const cardPath = join(cardsRoot, `${c.id}.json`);
		if (existsSync(cardPath)) {
			try {
				const tr = JSON.parse(readFileSync(cardPath, 'utf-8'));
				let isCardTranslated = false;
				if (tr.title && tr.title.trim() !== '' && tr.title !== c.title) {
					translatedCards++;
					isCardTranslated = true;
				}
				if (!isCardTranslated && tr.text && tr.text.trim() !== '' && tr.text !== c.text) {
					translatedCards++;
				}
				if (c.faces && tr.faces && Array.isArray(tr.faces)) {
					c.faces.forEach((face, idx) => {
						const trFace = tr.faces[idx];
						if (
							trFace &&
							trFace.title &&
							trFace.title.trim() !== '' &&
							trFace.title !== face.title
						) {
							translatedCards++;
						}
					});
				}
			} catch (e) {
				console.error(`Error reading ${cardPath}:`, e);
			}
		}
	});

	// Count translated printings
	const printingsBySet: Record<string, any[]> = {};
	printingsWithFlavor.forEach((p) => {
		if (!printingsBySet[p.card_set_id]) {
			printingsBySet[p.card_set_id] = [];
		}
		printingsBySet[p.card_set_id].push(p);
	});

	for (const [setId, setPrs] of Object.entries(printingsBySet)) {
		const setPath = join(printingsRoot, `${setId}.json`);
		if (existsSync(setPath)) {
			try {
				const existing = JSON.parse(readFileSync(setPath, 'utf-8'));
				const trById = keyBy(existing, 'id');

				setPrs.forEach((pr) => {
					const tr = trById[pr.id];
					if (tr) {
						if (
							pr.flavor &&
							tr.flavor &&
							tr.flavor.trim() !== '' &&
							tr.flavor !== pr.flavor
						) {
							translatedFlavor++;
						}
						if (pr.faces && tr.faces && Array.isArray(tr.faces)) {
							pr.faces.forEach((face, idx) => {
								const trFace = tr.faces[idx];
								if (
									face.flavor &&
									trFace &&
									trFace.flavor &&
									trFace.flavor.trim() !== '' &&
									trFace.flavor !== face.flavor
								) {
									translatedFlavor++;
								}
							});
						}
					}
				});
			} catch (e) {
				console.error(`Error reading ${setPath}:`, e);
			}
		}
	}

	const cardPct =
		totalCardsCount > 0 ? ((translatedCards / totalCardsCount) * 100).toFixed(1) : '100.0';
	const flavorPct =
		totalFlavorCount > 0 ? ((translatedFlavor / totalFlavorCount) * 100).toFixed(1) : '100.0';
	const overallPct =
		totalCardsCount + totalFlavorCount > 0
			? (
					((translatedCards + translatedFlavor) / (totalCardsCount + totalFlavorCount)) *
					100
				).toFixed(1)
			: '100.0';

	const cardsStr = `${translatedCards} / ${totalCardsCount}`;
	const printingsStr = `${translatedFlavor} / ${totalFlavorCount}`;
	const cardPctStr = `${cardPct}%`;
	const flavorPctStr = `${flavorPct}%`;
	const overallPctStr = `${overallPct}%`;

	console.log(
		`| ${locale.padEnd(col1Width)} | ${cardsStr.padEnd(col2Width)} | ${cardPctStr.padStart(col3Width)} | ${printingsStr.padEnd(col4Width)} | ${flavorPctStr.padStart(col5Width)} | ${overallPctStr.padStart(col6Width)} |`
	);
});
