import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

export function readJson<T>(path: string): T | null {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch (e) {
		console.error(`Error reading ${path}:`, e);
		return null;
	}
}

export function writeJson(path: string, data: any): void {
	mkdirSync(join(path, '..'), { recursive: true });
	writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function writeOrRemoveJson(path: string, data: any, shouldKeep: boolean): void {
	if (shouldKeep) {
		writeJson(path, data);
	} else if (existsSync(path)) {
		rmSync(path);
	}
}

export function cleanOrphanedJsonFiles(
	dir: string,
	validKeys: Set<string>,
	logPrefix?: string
): void {
	if (!existsSync(dir)) return;
	readdirSync(dir).forEach((file) => {
		if (file.endsWith('.json') && !validKeys.has(file.slice(0, -5))) {
			if (logPrefix) console.log(`${logPrefix}: ${file}`);
			rmSync(join(dir, file));
		}
	});
}

export function readJsonMap<T>(dir: string): Map<string, T> {
	const map = new Map<string, T>();
	if (!existsSync(dir)) return map;
	readdirSync(dir).forEach((file) => {
		if (file.endsWith('.json')) {
			const data = readJson<T>(join(dir, file));
			if (data) map.set(file.slice(0, -5), data);
		}
	});
	return map;
}

export function getV1CardsForLocale(localeV1Root: string): any[] {
	const packDir = join(localeV1Root, 'pack');
	if (!existsSync(packDir)) return [];
	const v1Cards: any[] = [];
	readdirSync(packDir).forEach((file) => {
		if (file.endsWith('.json')) {
			const cards = readJson<any[]>(join(packDir, file));
			if (cards && Array.isArray(cards)) {
				v1Cards.push(...cards);
			}
		}
	});
	return v1Cards;
}
