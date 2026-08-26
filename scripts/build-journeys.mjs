#!/usr/bin/env node
// scripts/build-journeys.mjs
//
// Generates one journey file per chapter — public/mapbase/journeys/<chapterId>.json
// — as { pins, journeyOverviews, relationships }:
//   - pins: the actual visited locations, sourced from that chapter's
//     vetted journeyOverviews data (journeyOverviews[].stops[].location),
//     NOT every place mentioned anywhere in the passage/annotation text.
//     A biography often references places incidentally (battle sites,
//     other people's territories, etc.) that aren't part of the
//     subject's own physical journey — only the curated stops list
//     represents where the person(s) actually went.
//   - journeyOverviews / relationships: passed straight through from the
//     chapter JSON, so the frontend's journey panel can render names,
//     dates, timelines, and relationships from this one fetched file
//     rather than needing separate access to chapter source data.
//
// Each stop's location is a {en, zht, zhs} name, not raw coordinates, so
// this script resolves coordinates by matching that name against the
// chapter's own [[label|url]] map-overall tags (the ones link-terms.mjs
// already resolved) — first restricted to the stop's own passageId (most
// precise), falling back to a chapter-wide search if that passage
// doesn't contain a match, or if passageId itself doesn't resolve to a
// real passage.
//
// If a location still can't be resolved (no matching tag anywhere in the
// chapter — common when the AI-flagged journey data references a place
// the actual translated text doesn't tag, or tags with a different
// character variant), the script prompts for a /maps/map-overall link
// right in the terminal. Any of the three language-prefixed link forms
// (en, /zh-hant/..., /zh-hans/...) works — coordinates are extracted the
// same way regardless of prefix, so there's no need to hand-convert
// between language versions. Answers are cached in
// scripts/.journey-location-overrides.json, keyed by chapter + location
// name, so the same location is never prompted for twice across future
// runs — press Enter with no input to skip a location instead.
//
// A stop's location field can be a single {en,zht,zhs} object OR an
// array of them (multiple places visited within the same stop/year) —
// both are handled.
//
// Admin boundary / water body entries work the same way, in case a
// stop's location ever resolves to one of those instead of a town.
//
// Usage (run from the project root, i.e. the "web" folder):
//   node scripts/build-journeys.mjs

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = process.cwd();
const SGZ_DIR = path.join(ROOT, 'src/data/sgz');
const OUT_DIR = path.join(ROOT, 'public/mapbase/journeys');
const OVERRIDES_PATH = path.join(ROOT, 'scripts/.journey-location-overrides.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  try {
    return readJson(OVERRIDES_PATH);
  } catch {
    console.warn(`  ! could not parse ${OVERRIDES_PATH} — starting with an empty override cache`);
    return {};
  }
}

function saveOverrides(overrides) {
  fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true });
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n', 'utf-8');
}

// Matches already-resolved [[label|url]] tags only.
const TAG_RE = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

function extractTags(text) {
  if (typeof text !== 'string') return [];
  const tags = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    tags.push({ label: m[1], url: m[2] });
  }
  return tags;
}

// Strips a leading /zh-hant or /zh-hans prefix so the same real-world
// place tagged in different language fields resolves to the same entry
// regardless of which language-prefixed URL it happened to carry — this
// is also what lets a manually-pasted override link work regardless of
// which language version the user happens to have on hand.
function stripLangPrefix(rawUrl) {
  return rawUrl.replace(/^\/zh-han[st]/, '');
}

function parseLocationEntry(rawUrl) {
  const stripped = stripLangPrefix(rawUrl);
  if (!stripped.includes('/maps/map-overall')) return null; // not a location link (e.g. an officials link)

  let parsed;
  try {
    parsed = new URL(stripped, 'http://x'); // dummy base — only care about the path+query
  } catch {
    return null;
  }

  const params = parsed.searchParams;

  const waterId = params.get('water');
  if (waterId !== null && waterId !== '') {
    return { kind: 'water', id: waterId };
  }

  const adminId = params.get('admin');
  if (adminId !== null && adminId !== '') {
    return { kind: 'admin', id: adminId };
  }

  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { kind: 'town', lat, lng, name: params.get('name') || '' };
  }

  return null;
}

function identityKey(entry) {
  if (entry.kind === 'town') return `town:${entry.lat}:${entry.lng}`;
  return `${entry.kind}:${entry.id}`;
}

// Collects every [[label|url]] tag from one passage's own text fields
// (all three languages) plus all of its annotations (all three
// languages) — this is the pool a single stop's location gets matched
// against first, before falling back to the whole chapter.
function collectTagsFromPassage(passage) {
  const tags = [];
  tags.push(...extractTags(passage.orig?.zht));
  tags.push(...extractTags(passage.orig?.zhs));
  tags.push(...extractTags(passage.en));
  for (const a of passage.annotations ?? []) {
    tags.push(...extractTags(a.zht));
    tags.push(...extractTags(a.zhs));
    tags.push(...extractTags(a.en));
  }
  return tags;
}

// Given a pool of tags and a stop's {en, zht, zhs} location name, finds
// the first tag whose label exactly matches any of the three name
// variants, and returns its parsed location entry (or null if nothing
// in the pool matches, or the matching tag isn't a map link at all).
function findMatchingEntry(tags, locationName) {
  const candidates = [locationName?.en, locationName?.zht, locationName?.zhs].filter(Boolean);
  if (candidates.length === 0) return null;

  for (const tag of tags) {
    if (!candidates.includes(tag.label)) continue;
    const entry = parseLocationEntry(tag.url);
    if (entry) return entry;
  }
  return null;
}

async function resolveStopLocations(rl, overrides, chapterId, passagesById, chapterTags, stop, warnings) {
  const rawLocations = Array.isArray(stop.location) ? stop.location : [stop.location];
  const resolved = [];

  for (const locationName of rawLocations) {
    if (!locationName) continue;

    const displayName = locationName.en || locationName.zht || locationName.zhs || '(unnamed)';
    const passage = stop.passageId ? passagesById.get(stop.passageId) : null;
    let entry = null;

    if (passage) {
      entry = findMatchingEntry(collectTagsFromPassage(passage), locationName);
    } else if (stop.passageId) {
      warnings.push(
        `  ! stop references passageId "${stop.passageId}", which doesn't exist in this chapter — falling back to a chapter-wide search for "${displayName}"`
      );
    }

    // Fall back to a chapter-wide search if the passage-scoped lookup
    // didn't find anything.
    if (!entry) {
      entry = findMatchingEntry(chapterTags, locationName);
    }

    // Still nothing — check the override cache before prompting, so a
    // location already resolved on a previous run is never asked about
    // twice.
    if (!entry) {
      const cacheKey = `${chapterId}::${displayName}`;
      let overrideUrl = overrides[cacheKey];

      if (!overrideUrl) {
        const answer = (
          await rl.question(
            `\n  ? Could not resolve "${displayName}" (chapter ${chapterId}, passageId: ${stop.passageId || 'none'}).\n` +
              `    Paste a /maps/map-overall link for it (any language version works), or press Enter to skip: `
          )
        ).trim();

        if (answer) {
          overrideUrl = answer;
          overrides[cacheKey] = answer;
          saveOverrides(overrides); // persist immediately, not just at the end, in case of a later crash
        }
      }

      if (overrideUrl) {
        entry = parseLocationEntry(overrideUrl);
        if (!entry) {
          warnings.push(`  ! the link provided for "${displayName}" didn't look like a valid /maps/map-overall link — skipped`);
        }
      }
    }

    if (entry) {
      resolved.push(entry);
    } else {
      warnings.push(
        `  ! could not resolve coordinates for "${displayName}" (passageId: ${stop.passageId || 'none'}) — skipped`
      );
    }
  }

  return resolved;
}

// Like findMatchingEntry, but returns the tag's raw URL unparsed — used
// for position links, which point to /translations/officials/... pages
// rather than /maps/map-overall, so parseLocationEntry (which requires
// a map link) doesn't apply here.
function findMatchingTagUrl(tags, candidateNames) {
  const candidates = candidateNames.filter(Boolean);
  if (candidates.length === 0) return null;
  for (const tag of tags) {
    if (!candidates.includes(tag.label)) continue;
    if (!stripLangPrefix(tag.url).includes('/translations/officials/')) continue;
    return tag.url;
  }
  return null;
}

// Per the confirmed grammar: a title is either (a) "yyxxzz" where xx is
// the core title (possibly wrapped in an optional location/other-word
// prefix/suffix) and xx itself is always separately tagged, or (b) just
// "xx" alone, tagged as the whole phrase. Either way, the core title
// text is genuinely tagged somewhere in the passage — no minimum length
// requirement, since a legitimate title tag can be a single character
// (e.g. 令, Magistrate). The officials-page URL check is what actually
// prevents false positives here, not a length heuristic.
function findMatchingTagUrlBySubstring(tags, zhCandidates) {
  const candidates = zhCandidates.filter(Boolean);
  if (candidates.length === 0) return null;

  let bestUrl = null;
  let bestLength = 0;
  for (const tag of tags) {
    if (!stripLangPrefix(tag.url).includes('/translations/officials/')) continue; // must be an officials-page tag, not e.g. a location tag whose name happens to be a substring
    for (const candidate of candidates) {
      if (candidate.includes(tag.label) && tag.label.length > bestLength) {
        bestUrl = tag.url;
        bestLength = tag.label.length;
      }
    }
  }
  return bestUrl;
}

// A stop can have multiple distinct titles in one year (e.g. "General
// who Captures the Enemies; Capital District Marquis"), separated by a
// semicolon or comma (English or Chinese punctuation) — each one is its
// own title with its own tag, not one compound phrase. Only splits when
// EN/ZHT/ZHS all agree on the same segment count; if they don't (data
// isn't cleanly parallel across languages), the whole position is kept
// as one segment rather than guessing at a misaligned pairing.
function splitPositionSegments(position) {
  const delimRe = /[;；，,、]/;
  const splitField = (f) => (f || '').split(delimRe).map((s) => s.trim()).filter(Boolean);

  const enParts = splitField(position.en);
  const zhtParts = splitField(position.zht);
  const zhsParts = splitField(position.zhs);

  const counts = [enParts.length, zhtParts.length, zhsParts.length].filter((c) => c > 0);
  const allAgree = counts.length > 0 && counts[0] > 1 && counts.every((c) => c === counts[0]);

  if (!allAgree) return [position];

  const segments = [];
  for (let i = 0; i < counts[0]; i++) {
    segments.push({ en: enParts[i] || '', zht: zhtParts[i] || '', zhs: zhsParts[i] || '' });
  }
  return segments;
}

// Resolves EACH title segment independently, per the grammar rules — the
// core title xx within each segment is looked up exactly first, falling
// back to a substring match (still requiring an officials-page tag) for
// the "yyxxzz" wrapped form. Returns one {en, zht, zhs, url} per
// segment, url null if that specific segment didn't resolve.
function resolvePositionLinks(passagesById, chapterTags, stop) {
  if (!stop.position) return [];

  const segments = splitPositionSegments(stop.position);
  const passage = stop.passageId ? passagesById.get(stop.passageId) : null;
  const passageTags = passage ? collectTagsFromPassage(passage) : [];

  return segments.map((seg) => {
    const candidates = [seg.en, seg.zht, seg.zhs];
    const zhCandidates = [seg.zht, seg.zhs];

    let rawUrl = findMatchingTagUrl(passageTags, candidates) || findMatchingTagUrl(chapterTags, candidates);
    if (!rawUrl) {
      rawUrl =
        findMatchingTagUrlBySubstring(passageTags, zhCandidates) ||
        findMatchingTagUrlBySubstring(chapterTags, zhCandidates);
    }

    return { ...seg, url: rawUrl ? stripLangPrefix(rawUrl) : null };
  });
}

async function collectEntriesFromChapter(rl, overrides, data, chapterId, warnings) {
  const entriesByKey = new Map();

  const journeyOverviews = data.journeyOverviews ?? [];
  if (journeyOverviews.length === 0) return { pins: [], journeyOverviews: [] };

  const passagesById = new Map((data.passages ?? []).map((p) => [p.id, p]));

  const chapterTags = [];
  for (const p of data.passages ?? []) {
    chapterTags.push(...collectTagsFromPassage(p));
  }

  for (const person of journeyOverviews) {
    for (const stop of person.stops ?? []) {
      const entries = await resolveStopLocations(rl, overrides, chapterId, passagesById, chapterTags, stop, warnings);

      // Attach directly to the stop, so the frontend can make a location
      // clickable (fly to it / open its detail cards) without needing to
      // re-derive coordinates from a name at render time — which would
      // risk ambiguous matches when multiple pins share the same name.
      stop.resolvedLocations = entries;
      stop.positionLinks = resolvePositionLinks(passagesById, chapterTags, stop);

      for (const entry of entries) {
        const key = identityKey(entry);
        if (!entriesByKey.has(key)) {
          // Tagged with which person(s) this location belongs to, so the
          // frontend can show only the currently-active person's own
          // pins rather than every person's combined into one view —
          // a location visited by more than one person just accumulates
          // multiple entries here rather than being duplicated as
          // separate map pins.
          entriesByKey.set(key, { ...entry, persons: [person.person] });
        } else {
          const existing = entriesByKey.get(key);
          if (!existing.persons.includes(person.person)) existing.persons.push(person.person);
        }
      }
    }
  }

  return { pins: [...entriesByKey.values()], journeyOverviews };
}

async function main() {
  if (!fs.existsSync(SGZ_DIR)) {
    console.error(`ERROR: ${SGZ_DIR} not found. Run this from the project root.`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const overrides = loadOverrides();
  const rl = readline.createInterface({ input, output });

  const files = fs.readdirSync(SGZ_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Scanning ${files.length} chapter file(s)...`);

  let written = 0;
  let emptyChapters = 0;

  for (const file of files) {
    const filePath = path.join(SGZ_DIR, file);
    const data = readJson(filePath);
    const chapterId = data.id || path.basename(file, '.json');

    const warnings = [];
    const { pins: entries, journeyOverviews: enrichedOverviews } = await collectEntriesFromChapter(rl, overrides, data, chapterId, warnings);

    if (entries.length === 0) {
      emptyChapters++;
      continue; // no journeyOverviews (or nothing resolvable) in this chapter yet
    }

    const townCount = entries.filter((e) => e.kind === 'town').length;
    const otherCount = entries.length - townCount;

    const outPath = path.join(OUT_DIR, `${chapterId}.json`);
    const outData = {
      pins: entries,
      journeyOverviews: enrichedOverviews,
      relationships: data.relationships ?? []
    };
    fs.writeFileSync(outPath, JSON.stringify(outData, null, 2) + '\n', 'utf-8');
    written++;
    console.log(
      `  ${chapterId}: ${townCount} town(s)${otherCount ? `, ${otherCount} admin/water boundary(ies)` : ''} -> journeys/${chapterId}.json`
    );
    for (const w of warnings) console.log(w);
  }

  rl.close();
  console.log(`\nDone. ${written} journey file(s) written, ${emptyChapters} chapter(s) had no journeyOverviews data.`);
}

main();
