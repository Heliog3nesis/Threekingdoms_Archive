#!/usr/bin/env node
// scripts/validate-relationships.mjs
//
// Checks src/data/persons.json (the people registry) and the `relationships`
// array of every chapter in src/data/sgz. Run from the project root:
//
//   node scripts/validate-relationships.mjs
//
// Exit code 1 if there is any ERROR (warnings do not fail).
//
// PERSON REGISTRY  (src/data/persons.json)
//   key = person id: "name（courtesy name）", or just "name" if no courtesy
//         name is known. Traditional characters, as in journeyOverviews.person.
//   { name:{zht,zhs,en}, courtesyName:{zht,zhs,en}|null, aliases:[...],
//     unnamed?:true, review?:[...] }
//
// RELATIONSHIP  (chapter.relationships[])
//   { from, to, type, polarity, directed, ancestral?, notes:[{passageId,text}] }
//   type      kinship | personal | colleagues | service      (the legend)
//   polarity  positive | neutral | negative | mixed           (the colour)
//             kinship is always neutral; mixed = genuinely both (renders as a
//             half-positive / half-negative split line, not a third solid colour)
//   directed  true -> the arrow points at `to`, which is the receiving end:
//             kinship  from = parent / elder generation  -> to = child / younger
//             service  from = subordinate                -> to = the lord served
//             personal from = killer / captor / praiser / recommender / teacher
//                        / host                          -> to = the one killed,
//                        captured, praised, recommended, taught, hosted
//             colleagues (succession only) from = predecessor -> to = successor
//             undirected relationships (friends, enemies, siblings, colleagues,
//             ...) have directed:false and from/to order carries no meaning
//   ancestral true (kinship only) = the other person is an ancestor / not a
//             contemporary; hide by default
//   notes     one entry per event/passage, text = { en?, zht?, zhs? }; the note
//             is what the detail panel shows. passageId must exist in the chapter.
//   All relationships are between contemporaries; comparisons with historical
//   figures are not relationships.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SGZ_DIR = path.join(ROOT, 'src/data/sgz');
const PERSONS = path.join(ROOT, 'src/data/persons.json');
const TYPES = new Set(['kinship', 'personal', 'colleagues', 'service']);
const POLARITIES = new Set(['positive', 'neutral', 'negative', 'mixed']);

const VERBOSE = process.argv.includes('--verbose');
const errors = [];
const warnings = [];
const untranslated = { all: 0, en: 0, zh: 0, other: [] }; // notes missing a language (summarised unless --verbose)
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

if (!fs.existsSync(PERSONS)) { console.error(`ERROR: ${PERSONS} not found. Run this from the project root.`); process.exit(1); }
const persons = JSON.parse(fs.readFileSync(PERSONS, 'utf8'));

// ---------------------------------------------------------------- registry
const aliasOwner = new Map();
for (const [id, p] of Object.entries(persons)) {
  const where = `persons.json "${id}"`;
  for (const l of ['zht', 'zhs', 'en']) if (!p.name?.[l]) err(`${where}: name.${l} is empty`);
  if (p.courtesyName !== null && p.courtesyName !== undefined) {
    for (const l of ['zht', 'zhs', 'en']) if (!p.courtesyName?.[l]) err(`${where}: courtesyName.${l} is empty (use null when the courtesy name is unknown)`);
  }
  const expected = p.courtesyName?.zht ? `${p.name?.zht}（${p.courtesyName.zht}）` : p.name?.zht;
  if (expected && id !== expected) warn(`${where}: id differs from name.zht${p.courtesyName ? ' + courtesy name' : ''} ("${expected}")`);
  if (!Array.isArray(p.aliases)) err(`${where}: aliases must be an array`);
  for (const a of p.aliases ?? []) {
    if (persons[a]) err(`${where}: alias "${a}" is also a person id`);
    if (aliasOwner.has(a) && aliasOwner.get(a) !== id) err(`${where}: alias "${a}" is also an alias of "${aliasOwner.get(a)}"`);
    aliasOwner.set(a, id);
  }
}
const resolveHint = (n) => (aliasOwner.has(n) ? ` (it is an alias of "${aliasOwner.get(n)}" — use the id)` : '');

// ---------------------------------------------------------------- chapters
const used = new Set();
const legacyChapters = []; // chapters still in the old relationship format (skipped)
let total = 0;
for (const file of fs.readdirSync(SGZ_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const ch = JSON.parse(fs.readFileSync(path.join(SGZ_DIR, file), 'utf8'));
  const passageIds = new Set((ch.passages ?? []).map((p) => p.id));
  const seen = new Set();

  for (const o of ch.journeyOverviews ?? []) {
    if (!persons[o.person]) err(`${file}: journeyOverviews.person "${o.person}" is not in persons.json${resolveHint(o.person)}`);
    else used.add(o.person);
  }

  // Chapters not converted yet still hold the old shape {from,to,type,passageId} (no `notes`): skip them for now.
  const rels = ch.relationships ?? [];
  if (rels.length && !rels.every((r) => Array.isArray(r.notes))) { legacyChapters.push(file.replace(/^wei-shu-|\.json$/g, '')); continue; }

  rels.forEach((r, i) => {
    total++;
    const where = `${file} relationships[${i}] ${r.from} → ${r.to}`;
    for (const side of ['from', 'to']) {
      if (!persons[r[side]]) err(`${where}: ${side} "${r[side]}" is not in persons.json${resolveHint(r[side])}`);
      else used.add(r[side]);
    }
    if (r.from === r.to) err(`${where}: from and to are the same person`);
    if (!TYPES.has(r.type)) err(`${where}: type "${r.type}" must be one of ${[...TYPES].join(' | ')}`);
    if (!POLARITIES.has(r.polarity)) err(`${where}: polarity "${r.polarity}" must be one of ${[...POLARITIES].join(' | ')}`);
    if (r.type === 'service' && r.polarity === 'neutral') err(`${where}: service (allegiance) can't be neutral — joining is positive, leaving is negative, both is mixed`);
    if (r.type === 'kinship' && r.polarity !== 'neutral') err(`${where}: kinship must have polarity "neutral"`);
    if (typeof r.directed !== 'boolean') err(`${where}: directed must be true or false`);
    if (r.ancestral !== undefined && (r.ancestral !== true || r.type !== 'kinship')) err(`${where}: ancestral may only be true, and only on kinship`);
    if (!Array.isArray(r.notes) || r.notes.length === 0) err(`${where}: notes must be a non-empty array`);
    for (const n of r.notes ?? []) {
      if (!passageIds.has(n.passageId)) err(`${where}: note passageId "${n.passageId}" does not exist in this chapter`);
      const t = n.text ?? {};
      if (!['en', 'zht', 'zhs'].some((l) => typeof t[l] === 'string' && t[l].trim())) err(`${where}: note (${n.passageId}) has no text in any language`);
      else if (!t.en || !t.zht || !t.zhs) {
        const missing = ['en', 'zht', 'zhs'].filter((l) => !t[l]);
        untranslated.all++;
        if (missing.join() === 'zht,zhs') untranslated.en++;
        else if (missing.join() === 'en') untranslated.zh++;
        else untranslated.other.push(`${where}: note (${n.passageId}) is missing ${missing.join(', ')}`);
        if (VERBOSE) warn(`${where}: note (${n.passageId}) is missing ${missing.join(', ')}`);
      }
    }
    const key = [r.type, r.polarity, r.directed ? `${r.from}>${r.to}` : [r.from, r.to].sort().join('~')].join('|');
    if (seen.has(key)) err(`${where}: duplicate relationship (same people, type and polarity) — merge the notes into one`);
    seen.add(key);
  });
}

// only meaningful once every chapter has been converted
if (!legacyChapters.length) for (const id of Object.keys(persons)) if (!used.has(id)) warn(`persons.json "${id}" is not used by any relationship or journeyOverviews`);

// ---------------------------------------------------------------- report
const only = (list, n = 60) => list.slice(0, n).map((m) => '  ' + m).join('\n') + (list.length > n ? `\n  … and ${list.length - n} more` : '');
if (errors.length) console.log(`\nERRORS (${errors.length}):\n${only(errors)}`);
if (warnings.length) console.log(`\nWARNINGS (${warnings.length}):\n${only(warnings)}`);
if (untranslated.all && !VERBOSE) {
  console.log(`\nNOTES NEEDING A TRANSLATION: ${untranslated.all} (${untranslated.en} English only, ${untranslated.zh} Chinese only${untranslated.other.length ? `, ${untranslated.other.length} other` : ''}) — run with --verbose to list them`);
  if (untranslated.other.length) console.log(only(untranslated.other));
}
if (legacyChapters.length) console.log(`\nSKIPPED (${legacyChapters.length} chapter(s) still use the old relationship format): ${legacyChapters.join(', ')}`);
console.log(`\n${Object.keys(persons).length} people, ${total} relationships: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
