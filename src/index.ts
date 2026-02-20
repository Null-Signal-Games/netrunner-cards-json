import fs from "fs";
import { resolve } from "path";

function makeV1Reader(filename: string) {
  let json: Record<string, any>[] = [];

  return function (): Record<string, any>[] {
    if (json.length === 0) {
      const path = resolve(import.meta.dirname, '..', filename + '.json');
      json = JSON.parse(fs.readFileSync(path, 'utf-8'));
    }
    return json;
  }
}

function makeV2Reader(filename: string) {
  let json: Record<string, any>[] = [];

  return function (): Record<string, any>[] {
    if (json.length === 0) {
      const path = resolve(import.meta.dirname, '../v2', filename + '.json');
      json = JSON.parse(fs.readFileSync(path, 'utf-8'));
    }
    return json;
  }
}

export function textToId(text: string): string {
  return text
    .toLowerCase()
    // Remove ASCII apostrophes and various single quotes (‘’‛‹›❛❜＇「」).
    .replace(/[\u0027\u2018\u2019\u201B\u2039\u203A\u275B\u275C\uFF07\u300C\u300D]/gu, '')
    // Unicode Canonical Decomposition - switching single code points to multiple code points.
    .normalize('NFD')
    // remove non-ASCII (this phase will change things like “é” to “e” and remove the accent).
    .replace(/\P{ASCII}/gu, '')
    // split along space or punction. This will catch any double-quotes, dashes, etc.
    .split(/[\s\p{P}]+/u)
    // exclude any elements that are empty when trimmed to avoid trailing _ for the join.
    .filter(x => x.trim() != '')
    // Finally join back with underscores.
    .join('_');
}

export const getCardCyclesV2Json = makeV2Reader('card_cycles');
export const getCardSetTypesV2Json = makeV2Reader('card_set_types');
export const getCardSetsV2Json = makeV2Reader('card_sets');
export const getCardSubtypesV2Json = makeV2Reader('card_subtypes');
export const getCardTypesV2Json = makeV2Reader('card_types');
export const getCardLayoutsV2Json = makeV2Reader('card_layouts');
export const getCyclesJson = makeV1Reader('cycles');
export const getFactionsJson = makeV1Reader('factions');
export const getFactionsV2Json = makeV2Reader('factions');
export const getMwlJson = makeV1Reader('mwl');
export const getPacksJson = makeV1Reader('packs');
export const getPrebuiltsJson = makeV1Reader('prebuilts');
export const getRotationsJson = makeV1Reader('rotations');
export const getSidesJson = makeV1Reader('sides');
export const getSidesV2Json = makeV2Reader('sides');
export const getTypesJson = makeV1Reader('types');

export function getPackFilesJson(): Map<string, Record<string, any>[]> {
  const PACKS_JSON = new Map<string, Record<string, any>[]>();

  const directory = resolve(import.meta.dirname, '..', 'pack');
  fs.readdirSync(directory).forEach(file => {
    if (file.endsWith('.json')) {
      const path = resolve(directory, file);
      const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
      PACKS_JSON.set(file.replace(".json", ""), json);
    }
  });
  return PACKS_JSON;
}

export function getCardsJson(): Record<string, any>[] {
  const CARDS_JSON: Record<string, any>[] = [];

  const directory = resolve(import.meta.dirname, '..', 'pack');
  fs.readdirSync(directory).forEach(file => {
    if (file.endsWith('.json')) {
      const path = resolve(directory, file);
      const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
      json.forEach((c: Record<string, any>) => CARDS_JSON.push(c));
    }
  });
  return CARDS_JSON;
}

export function getCardsV2Json(): Record<string, any>[] {
  const CARDS_JSON: Record<string, any>[] = [];

  const directory = resolve(import.meta.dirname, '..', 'v2/cards');
  fs.readdirSync(directory).forEach(file => {
    if (file.endsWith('.json')) {
      const path = resolve(directory, file);
      const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
      CARDS_JSON.push(json);
    }
  });
  return CARDS_JSON;
}

export function getPrintingsV2Json(): Record<string, any>[] {
  const PRINTINGS_JSON: Record<string, any>[] = [];

  const printingDir = resolve(import.meta.dirname, "../v2/printings");
  const printingFiles =
    fs.readdirSync(printingDir, { withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
      .map(dirent => dirent.name);

  printingFiles.forEach(file => {
    const json = JSON.parse(fs.readFileSync(resolve(printingDir, file), 'utf-8'));
    json.forEach((p: Record<string, any>) => PRINTINGS_JSON.push(p));
  });
  return PRINTINGS_JSON;
}

export function getRestrictionsV2Json(): Record<string, Record<string, any>> {
  const RESTRICTIONS_JSON: Record<string, Record<string, any>> = {};

  const restrictionDir = resolve(import.meta.dirname, "../v2/restrictions");
  const restrictionDirs =
    fs.readdirSync(restrictionDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

  restrictionDirs.forEach(format => {
    const R_JSON: Record<string, any>[] = [];
    const dir = resolve(import.meta.dirname, "../v2/restrictions/" + format);
    const restrictionFiles =
      fs.readdirSync(dir, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.json'))
        .map(dirent => dirent.name);

    restrictionFiles.forEach(file => {
      R_JSON.push(JSON.parse(fs.readFileSync(resolve(dir, file), 'utf-8')));
    });

    RESTRICTIONS_JSON[format] = R_JSON;
  });

  return RESTRICTIONS_JSON;
}
