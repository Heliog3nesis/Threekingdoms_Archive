/**
 * enrich-officials-json.js
 *
 * Adds derived fields to positions in an already-converted officials JSON file:
 *   - displayName      (first Wei name, else Shu, else Wu)
 *   - hasMultipleNames (true if multiple UNIQUE non-placeholder names)
 *   - gradeNum         (numeric grade from rank zht, e.g. 第三品 → 3)
 *   - tier             ("dignitary" | "secondary" | "minor" | null)
 *
 * Also fills blank/empty strings in non-name fields with '?'
 *
 * Tier is derived from color-audit-report.json (must be in same folder as this script):
 *   #E4705E → dignitary
 *   #3FA2FF → minor
 *   no color → secondary
 *
 * Usage:
 *   node scripts/enrich-officials-json.js <inputFile> [outputFile]
 *
 * If outputFile is omitted, overwrites inputFile in place.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node enrich-officials-json.js <inputFile> [outputFile]');
  process.exit(1);
}

const [inputFile, outputFile] = args;

// --- TIER LOOKUP ---
// build a map of zht name → tier from color-audit-report.json
const COLOR_TIER = {
  '#E4705E': 'dignitary',
  '#3FA2FF': 'minor',
};

const __dir = dirname(fileURLToPath(import.meta.url));
const auditPath = join(__dir, 'color-audit-report.json');

const tierMap = new Map(); // zht → tier

try {
  const audit = JSON.parse(readFileSync(auditPath, 'utf-8'));
  for (const [color, data] of Object.entries(audit)) {
    const tier = COLOR_TIER[color.toUpperCase()] ?? COLOR_TIER[color];
    if (!tier) continue;
    for (const entry of data.entries ?? []) {
      // split on <br><br> to handle multi-name cells like "相國<br><br>司徒"
      const names = entry.text
        .split(/<br><br>/i)
        .map(s => s.replace(/<br>/gi, '').trim())
        .filter(s => s && s !== '-' && s !== '?');
      for (const name of names) {
        tierMap.set(name, tier);
      }
    }
  }
  console.log(`Tier map loaded: ${tierMap.size} entries`);
} catch (e) {
  console.warn(`Could not load color-audit-report.json — tier will be null for all positions (${e.message})`);
}

// look up tier for a position — check all kingdom names
function lookupTier(name) {
  const allNames = [
    ...(name?.wei ?? []),
    ...(name?.shu ?? []),
    ...(name?.wu  ?? []),
  ];
  for (const n of allNames) {
    if (n.zht && tierMap.has(n.zht.trim())) {
      return tierMap.get(n.zht.trim());
    }
  }
  // not found in dignitary or minor → secondary
  // but only if the position has real names (not all placeholders)
  const hasRealName = allNames.some(n => n.zht && n.zht !== '?' && n.zht !== '-');
  return hasRealName ? 'secondary' : null;
}

const CHINESE_GRADE = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };

// placeholder values that should not count as real/unique names
const PLACEHOLDER = new Set(['-', '?', '—', '', null, undefined]);

function isPlaceholder(str) {
  return PLACEHOLDER.has(str?.trim?.() ?? str);
}

function extractGrade(rank) {
  if (!rank) return null;
  const zhtArr = rank.zht ?? [];
  const enArr  = rank.en  ?? [];
  for (const s of zhtArr) {
    const m = s.match(/第([一二三四五六七八九])品/);
    if (m) return CHINESE_GRADE[m[1]] ?? null;
  }
  for (const s of zhtArr) {
    const m = s.match(/^([一二三四五六七八九])品/);
    if (m) return CHINESE_GRADE[m[1]] ?? null;
  }
  const EN_GRADE = { first:1, second:2, third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9 };
  for (const s of enArr) {
    const m = s.toLowerCase().match(/^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\s+grade/);
    if (m) return EN_GRADE[m[1]] ?? null;
  }
  return null;
}

function deriveDisplayName(name) {
  const source = name?.wei?.[0] ?? name?.shu?.[0] ?? name?.wu?.[0];
  if (!source) return { zht: '?', zhs: '?', en: '?' };
  return { zht: source.zht, zhs: source.zhs, en: source.en };
}

// count unique non-placeholder ZHT names across all kingdoms
function countUniqueNames(name) {
  const allNames = [
    ...(name?.wei ?? []),
    ...(name?.shu ?? []),
    ...(name?.wu  ?? []),
  ];
  const unique = new Set(
    allNames
      .map(n => n.zht?.trim())
      .filter(zht => !isPlaceholder(zht))
  );
  return unique.size;
}

// fill empty strings in a text field array with '?'
function fillBlanks(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(s => (typeof s === 'string' && s.trim() === '') ? '?' : s);
}

// fill blanks in a trilingual text field { zht, zhs, en }
function fillTextField(field) {
  if (!field) return field;
  return {
    zht: fillBlanks(field.zht),
    zhs: fillBlanks(field.zhs),
    en:  fillBlanks(field.en),
  };
}

// fill blanks in notes array [{ zht, zhs, en }]
function fillNotesField(notes) {
  if (!Array.isArray(notes)) return notes;
  return notes.map(n => ({
    zht: (typeof n.zht === 'string' && n.zht.trim() === '') ? '?' : n.zht,
    zhs: (typeof n.zhs === 'string' && n.zhs.trim() === '') ? '?' : n.zhs,
    en:  (typeof n.en  === 'string' && n.en.trim()  === '') ? '?' : n.en,
  }));
}

function enrichPosition(pos) {
  pos.displayName      = deriveDisplayName(pos.name);
  pos.hasMultipleNames = countUniqueNames(pos.name) > 1;
  pos.gradeNum         = extractGrade(pos.rank);
  pos.tier             = lookupTier(pos.name);

  // fill blanks in non-name fields
  pos.jobscope = fillTextField(pos.jobscope);
  pos.rank     = fillTextField(pos.rank);
  pos.notes    = fillNotesField(pos.notes);

  return pos;
}

function enrichSection(section) {
  section.positions = (section.positions ?? []).map(enrichPosition);
  return section;
}

function enrichCategory(category) {
  category.sections  = (category.sections  ?? []).map(enrichSection);
  category.positions = (category.positions ?? []).map(enrichPosition);
  return category;
}

// read
let data;
try {
  data = JSON.parse(readFileSync(inputFile, 'utf-8'));
} catch (e) {
  console.error(`Failed to read ${inputFile}:`, e.message);
  process.exit(1);
}

// enrich
if (Array.isArray(data.categories)) {
  data.categories = data.categories.map(enrichCategory);
  const total = data.categories.reduce((n, c) => {
    return n
      + (c.positions?.length ?? 0)
      + (c.sections?.reduce((m, s) => m + (s.positions?.length ?? 0), 0) ?? 0);
  }, 0);
  console.log(`Enriched ${data.categories.length} categories, ${total} positions`);
} else {
  console.error('Expected { categories: [...] } at top level');
  process.exit(1);
}

// write
const out = outputFile ?? inputFile;
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Written → ${out}`);