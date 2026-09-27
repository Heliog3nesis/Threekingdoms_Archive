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
// TITLES (stop.position) follow the same idea. Each title is first matched
// against the chapter's own officials-page / glossary tags (exact, then
// "the title wraps a tagged core title"). A title that STILL has no link
// after that is no longer silently left unlinked — the script now asks,
// in three steps, mirroring the location flow:
//   1. tags in the chapter (officials/glossary links only) whose label
//      CONTAINS the title — pick one, or Enter for the next step.
//   2. a search of the officials databases (src/data/officials/*.json:
//      every position name across Wei/Shu/Wu) and the glossary (fief
//      titles like Marquis, tally titles, etc.) — the closest few matches
//      (exact name first, then nearest in length) are offered, pick one
//      or Enter for the next step.
//   3. paste an officials link (…/translations/officials/<page>#<id> or
//      …/translations/officials#glossary-<id>, any language version, even
//      a full URL) — Enter skips it this time, and typing x marks the
//      title as intentionally unlinked so it's never asked about again.
// Answers are cached in the same overrides file, keyed by chapter + title
// (chapter-wide rather than per passage, since a title means the same
// thing wherever it appears in one biography), so no title is asked about
// twice. Pass --skip-titles to skip this whole interactive pass (titles
// then stay exactly as before: linked only if a tag already matches).
//
// Usage (run from the project root, i.e. the "web" folder):
//   node scripts/build-journeys.mjs
//   node scripts/build-journeys.mjs --skip-titles

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = process.cwd();
const SGZ_DIR = path.join(ROOT, 'src/data/sgz');
const OUT_DIR = path.join(ROOT, 'public/mapbase/journeys');
const OVERRIDES_PATH = path.join(ROOT, 'scripts/.journey-location-overrides.json');

// Title (position) linking — see the TITLES section in the header.
const SKIP_TITLES = process.argv.includes('--skip-titles');
const TITLE_SKIP_MARK = 'none'; // override-cache value meaning "intentionally unlinked"
const MAX_TITLE_SUGGESTIONS = 8;
const OFFICIALS_DIR = path.join(ROOT, 'src/data/officials');
// Officials page id -> its JSON file. Mirrors link-terms.mjs /
// build-officials-index.ts, so the same pages that get searched here are
// the ones the links actually point to.
const OFFICIALS_FILES = {
  departments: 'central-court-database.json',
  ministers: 'excellencies-database.json',
  military: 'military-officials-database.json',
  regional: 'provincial-officials-database.json',
  household: 'rear-eastern-palace-database.json',
};
const GLOSSARY_PATH = path.join(OFFICIALS_DIR, 'glossary-data.ts');

// The same location databases the map itself reads at runtime — used for
// step 2's database-search fallback. Loaded lazily (only if a term
// actually reaches that step) and cached across the whole run. If a path
// doesn't match your actual repo layout, this warns once and that
// particular kind is just skipped for database search rather than
// crashing the whole script - adjust the paths below if needed.
// Mirrored from interactive-map.js's own PROVINCE_KINGDOM - kept as a
// separate copy rather than a shared import since this script and the
// frontend build in entirely different environments (Node vs browser
// bundle). Used only to derive each person's kingdom for the journey
// index's "sort by state" option - if the two ever drift apart, that
// sort option is the only thing affected, not the map itself.
const PROVINCE_KINGDOM = {
  'Bingzhou': 'wei', 'Jizhou': 'wei', 'Qingzhou': 'wei',
  'Yanzhou': 'wei', 'Yuzhou': 'wei', 'Youzhou': 'wei',
  'Liangzhou': 'wei', 'Sili': 'wei', 'Yongzhou': 'wei',
  'Xuzhou': 'wei', 'Jingzhou (Wei)': 'wei', 'Yangzhou (Wei)': 'wei',
  'Yizhou (North)': 'shu', 'Yizhou (South)': 'shu',
  'Jiaozhou': 'wu', 'Jingzhou (Wu)': 'wu', 'Yangzhou (Wu)': 'wu',
  'Xiyu': 'wei',
};

const DB_PATHS = {
  town: path.join(ROOT, 'public/mapbase/All_Towns.json'),
  admin: path.join(ROOT, 'public/mapbase/All_Provinces.json'),
  water: path.join(ROOT, 'public/mapbase/all_water_bodies.json'),
};
let locationDatabaseCache = null;

function loadLocationDatabase() {
  if (locationDatabaseCache) return locationDatabaseCache;

  const towns = [];
  const admin = [];
  const water = [];

  // Handles either a bare top-level array or a wrapped {features:[...]} /
  // {towns:[...]} object, in case the file's actual shape doesn't match
  // what's assumed here - falls back to the raw parsed value itself so a
  // genuinely-different wrapper key still surfaces as a clear "not an
  // array" error below rather than silently finding nothing.
  function unwrapArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.All_Towns_Details)) return parsed.All_Towns_Details; // All_Towns.json's actual wrapper key
    if (Array.isArray(parsed?.features)) return parsed.features;
    if (Array.isArray(parsed?.towns)) return parsed.towns;
    return parsed;
  }

  try {
    const list = unwrapArray(readJson(DB_PATHS.town));
    if (!Array.isArray(list)) throw new Error(`parsed content is not an array (got ${typeof list})`);
    towns.push(...list);
  } catch (e) {
    console.warn(`  ! could not load ${DB_PATHS.town} — database search will skip towns (${e.message})`);
  }
  try {
    const list = unwrapArray(readJson(DB_PATHS.admin));
    if (!Array.isArray(list)) throw new Error(`parsed content is not an array (got ${typeof list})`);
    admin.push(...list);
  } catch (e) {
    console.warn(`  ! could not load ${DB_PATHS.admin} — database search will skip provinces/commanderies (${e.message})`);
  }
  try {
    const list = unwrapArray(readJson(DB_PATHS.water));
    if (!Array.isArray(list)) throw new Error(`parsed content is not an array (got ${typeof list})`);
    water.push(...list);
  } catch (e) {
    console.warn(`  ! could not load ${DB_PATHS.water} — database search will skip water bodies (${e.message})`);
  }

  locationDatabaseCache = { towns, admin, water };
  return locationDatabaseCache;
}

// Derives a person's kingdom from their hometown - the first stop in
// their own journey, which is always their birthplace per the existing
// "first stop is always hometown" convention. Used only for the journey
// index's "sort by state" option; a person's actual allegiance can shift
// over their life, but their birthplace's kingdom is a stable, always-
// available single value to sort by, which "the kingdom they died
// serving" or similar wouldn't be for someone whose stops don't resolve
// that far.
function getPersonKingdom(person) {
  const firstEntry = person.stops?.[0]?.resolvedLocations?.[0];
  if (!firstEntry) return 'unknown';

  const db = loadLocationDatabase();

  if (firstEntry.kind === 'town') {
    const town = db.towns.find(
      (t) => Number(t.Latitude) === firstEntry.lat && Number(t.Longitude) === firstEntry.lng
    );
    return (town && PROVINCE_KINGDOM[town.Prov_EN]) || 'unknown';
  }

  if (firstEntry.kind === 'admin') {
    const feature = db.admin.find((f) => String((f.properties ?? f).id) === String(firstEntry.id));
    const props = feature ? (feature.properties ?? feature) : null;
    if (!props) return 'unknown';
    const provEn = props.level === 'commandery' || props.level === 'tributary' || props.level === 'island'
      ? props.Prov_EN
      : props.Name_EN;
    return PROVINCE_KINGDOM[provEn] || 'unknown';
  }

  return 'unknown';
}

// Case-insensitive containment in either direction - a term matches a
// database name if either fully contains the other, since a journey term
// might be shorter (a common short form) or longer (fuller name) than
// what's actually in the database.
function namesOverlap(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x.includes(y) || y.includes(x);
}

// Searches the town/province/commandery/water databases for name matches
// against any of a location's {en,zht,zhs} variants. Returns candidates
// as {label, disambiguation, entry} - label for display, disambiguation
// is extra context (province/commandery) to tell same-named places apart,
// entry is the ready-to-use resolved location object.
function searchLocationDatabase(locationName) {
  const candidates = [locationName?.en, locationName?.zht, locationName?.zhs].filter(Boolean);
  if (candidates.length === 0) return [];

  const db = loadLocationDatabase();
  const results = [];

  for (const t of db.towns) {
    const names = [t.Town_EN, t.Town_CH, t.Town_CHS];
    if (!candidates.some((c) => names.some((n) => namesOverlap(c, n)))) continue;
    const lat = Number(t.Latitude);
    const lng = Number(t.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    results.push({
      label: `${t.Town_EN || t.Town_CH || '(unnamed)'} ${t.Town_CH || ''}`.trim(),
      disambiguation: [t.Comm_EN, t.Prov_EN].filter(Boolean).join(', '),
      entry: { kind: 'town', lat, lng, name: t.Town_EN || '' },
    });
  }

  for (const f of db.admin) {
    const props = f.properties ?? f;
    const names = [props.Name_EN, props.Name_CH, props.Name_CHS];
    if (!candidates.some((c) => names.some((n) => namesOverlap(c, n)))) continue;
    if (props.id == null) continue;
    results.push({
      label: `${props.Name_EN || props.Name_CH || '(unnamed)'} ${props.Name_CH || ''}`.trim(),
      disambiguation: [props.level, props.Prov_EN].filter(Boolean).join(', '),
      entry: { kind: 'admin', id: String(props.id) },
    });
  }

  for (const f of db.water) {
    const props = f.properties ?? f;
    const names = [props.Name_EN, props.Name_CH, props.Name_CHS];
    if (!candidates.some((c) => names.some((n) => namesOverlap(c, n)))) continue;
    if (props.id == null) continue;
    results.push({
      label: `${props.Name_EN || props.Name_CH || '(unnamed)'} ${props.Name_CH || ''}`.trim(),
      disambiguation: 'water body',
      entry: { kind: 'water', id: String(props.id) },
    });
  }

  return results;
}

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

// Inverse of parseLocationEntry - reconstructs a /maps/map-overall link
// from any resolved entry, regardless of whether it came from an exact
// tag match, the step-1 contains-match, or the step-2 database search.
// Keeps the override cache in one consistent, human-editable format
// (a plain link) no matter which resolution path actually produced it.
function entryToUrl(entry) {
  if (entry.kind === 'town') {
    const params = new URLSearchParams({ lat: String(entry.lat), lng: String(entry.lng) });
    if (entry.name) params.set('name', entry.name);
    return `/maps/map-overall?${params.toString()}`;
  }
  if (entry.kind === 'admin') return `/maps/map-overall?admin=${entry.id}`;
  if (entry.kind === 'water') return `/maps/map-overall?water=${entry.id}`;
  return null;
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

// Step 1 fallback: no tag's label matches a location name exactly, so
// look for tags whose label CONTAINS the whole term instead (e.g. the
// journey data says "Ye" but the passage only tags "鄴城"/"Ye City" - a
// fuller form that wraps the shorter term). Returns every distinct
// matching location as a candidate for the user to confirm, rather than
// just grabbing the first hit, since more than one tag could plausibly
// contain the same short term.
function findContainsMatches(tags, locationName) {
  const candidates = [locationName?.en, locationName?.zht, locationName?.zhs].filter(Boolean);
  if (candidates.length === 0) return [];

  const seen = new Set();
  const results = [];
  for (const tag of tags) {
    if (!candidates.some((c) => tag.label && tag.label.includes(c))) continue;
    const entry = parseLocationEntry(tag.url);
    if (!entry) continue;
    const key = identityKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ label: tag.label, disambiguation: stripLangPrefix(tag.url), entry });
  }
  return results;
}

// Presents a numbered list of candidates and lets the user pick one, type
// "0"/Enter to reject all of them (falling through to the next
// resolution step), or "s" to skip resolving this location entirely.
// Returns the chosen entry, or null if rejected/skipped.
async function promptChooseCandidate(rl, candidates, displayName, passageId, stepLabel) {
  console.log(`\n  ? "${displayName}" (passageId: ${passageId || 'none'}) — ${stepLabel}:`);
  candidates.forEach((c, i) => {
    const disambig = c.disambiguation ? ` (${c.disambiguation})` : '';
    console.log(`    ${i + 1}. ${c.label}${disambig}`);
  });
  const answer = (
    await rl.question(`    Pick a number, or press Enter to try the next resolution step: `)
  ).trim();

  if (!answer) return null;
  const idx = Number(answer) - 1;
  if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length) {
    return candidates[idx].entry;
  }
  console.log(`    ! "${answer}" wasn't a valid choice — moving on`);
  return null;
}

async function resolveStopLocations(rl, overrides, chapterId, passagesById, chapterTags, stop, warnings) {
  const rawLocations = Array.isArray(stop.location) ? stop.location : [stop.location];
  const resolved = [];

  for (const locationName of rawLocations) {
    // Note: NOT pushing null here for a missing locationName itself (as
    // opposed to a locationName that exists but fails to resolve, handled
    // below) - the frontend's own locs.filter(Boolean) removes falsy
    // location names before indexing into resolvedLocations, so keeping
    // this a plain `continue` (no push) is what stays aligned with that;
    // pushing null here would double-count the gap against an array the
    // frontend has already compacted.
    if (!locationName) continue;

    const displayName = locationName.en || locationName.zht || locationName.zhs || '(unnamed)';
    const passage = stop.passageId ? passagesById.get(stop.passageId) : null;
    const passageTags = passage ? collectTagsFromPassage(passage) : [];
    let entry = null;

    if (passage) {
      entry = findMatchingEntry(passageTags, locationName);
    } else if (stop.passageId) {
      warnings.push(
        `  ! stop references passageId "${stop.passageId}", which doesn't exist in this chapter — falling back to a chapter-wide search for "${displayName}"`
      );
    }

    // Fall back to a chapter-wide search if the passage-scoped exact
    // match didn't find anything.
    if (!entry) {
      entry = findMatchingEntry(chapterTags, locationName);
    }

    // Check the override cache before ANY interactive step below - a
    // location resolved via a contains-match confirm, a database-search
    // confirm, or a manually-pasted link on a previous run is never
    // asked about again, regardless of which of those three paths it
    // originally came from.
    // Scoped by passageId, not just chapter+name - a short/ambiguous term
    // like "Ye" can legitimately mean different things in different parts
    // of the same chapter, and a resolution chosen for one occurrence
    // (via any of steps 1-3 below) shouldn't silently get reused for a
    // different passage's occurrence of the same name. Stops with no
    // passageId at all still share one bucket for that name, same as
    // before, since there's no finer context available to split on.
    const cacheKey = `${chapterId}::${stop.passageId || 'no-passage'}::${displayName}`;
    if (!entry && overrides[cacheKey]) {
      entry = parseLocationEntry(overrides[cacheKey]);
    }

    // Step 1: no exact label match anywhere - look for tags whose label
    // CONTAINS the whole term instead, and let the user confirm/pick.
    if (!entry) {
      const seen = new Set();
      const containsCandidates = [...findContainsMatches(passageTags, locationName), ...findContainsMatches(chapterTags, locationName)]
        .filter((c) => {
          const key = identityKey(c.entry);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (containsCandidates.length) {
        entry = await promptChooseCandidate(
          rl,
          containsCandidates,
          displayName,
          stop.passageId,
          `no exact tag match, but found ${containsCandidates.length} tag(s) containing this term`
        );
      }
    }

    // Step 2: still nothing - search the town/province/commandery/water
    // database directly (independent of what the passage text tags at
    // all), and let the user confirm/pick.
    if (!entry) {
      const dbCandidates = searchLocationDatabase(locationName);
      if (dbCandidates.length) {
        entry = await promptChooseCandidate(
          rl,
          dbCandidates,
          displayName,
          stop.passageId,
          `no tag match at all, but found ${dbCandidates.length} matching entry(ies) in the location database`
        );
      }
    }

    // Step 3: both of the above failed (or the user rejected every
    // candidate) - fall back to manual input or skip, same as before.
    if (!entry) {
      const answer = (
        await rl.question(
          `\n  ? Could not resolve "${displayName}" (chapter ${chapterId}, passageId: ${stop.passageId || 'none'}).\n` +
            `    Paste a /maps/map-overall link for it (any language version works), or press Enter to skip: `
        )
      ).trim();

      if (answer) {
        entry = parseLocationEntry(answer);
        if (!entry) {
          warnings.push(`  ! the link provided for "${displayName}" didn't look like a valid /maps/map-overall link — skipped`);
        }
      }
    }

    // Persist whatever got resolved - from steps 1, 2, or 3 alike - so
    // future runs never re-prompt for the same chapter+location again.
    if (entry && !overrides[cacheKey]) {
      const cacheUrl = entryToUrl(entry);
      if (cacheUrl) {
        overrides[cacheKey] = cacheUrl;
        saveOverrides(overrides); // persist immediately, not just at the end, in case of a later crash
      }
    }

    // Always push - null for a location that never resolved - so this
    // array's indices stay aligned 1:1 with rawLocations. Silently
    // skipping unresolved entries instead would shift every later
    // location's resolvedLocations index down by one, misattributing
    // click-through behavior to the wrong location text on the frontend.
    resolved.push(entry);
    if (!entry) {
      warnings.push(
        `  ! could not resolve coordinates for "${displayName}" (passageId: ${stop.passageId || 'none'}) — skipped`
      );
    }
  }

  return resolved;
}

// A title tag can point to either a dedicated officials-page entry
// (/translations/officials/some-id — an office-type title, its own
// appointment record) or the glossary tab on that same page
// (/translations/officials#glossary-some-term — a fief/nobility title
// like Marquis, which is a general concept rather than a person-specific
// appointment). Both are legitimate "this title is properly linked"
// cases and should resolve, even though the checks used elsewhere for
// resolveStopLocations (which only wants a genuine location link) don't
// need this same distinction. Checking for a bare "/translations/officials"
// substring without requiring what follows it would also match unrelated
// paths that happen to start the same way, so this checks for both of
// the two specific real continuations instead.
function isOfficialsTagUrl(rawUrl) {
  const stripped = stripLangPrefix(rawUrl);
  return stripped.includes('/translations/officials/') || stripped.includes('/translations/officials#');
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
    if (!isOfficialsTagUrl(tag.url)) continue;
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
    if (!isOfficialsTagUrl(tag.url)) continue; // must be an officials-page or glossary tag, not e.g. a location tag whose name happens to be a substring
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
  // Some stops already store multiple titles as a proper array of
  // separate {en,zht,zhs} objects (e.g. "Gentleman-General" and
  // "Marquis Within the Pass" held together in one year) rather than as
  // delimiter-separated text packed into a single object's fields. That
  // shape needs no splitting at all - each array element already IS one
  // complete segment. Treating the whole array as if it were a single
  // {en,zht,zhs} object (the bug this replaces) silently produced a
  // broken segment with numeric keys instead of language fields, which
  // downstream rendering correctly refused to display at all.
  if (Array.isArray(position)) return position;

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

function stripHtml(str) {
  return (str ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

// Every non-placeholder name a position goes by across Wei/Shu/Wu
// (deduplicated), same approach as link-terms.mjs — a title can be called
// something different in each kingdom, and any of them should be findable.
function allPositionNames(pos, key) {
  const all = [...(pos.name?.wei ?? []), ...(pos.name?.shu ?? []), ...(pos.name?.wu ?? [])];
  const names = [];
  for (const n of all) {
    const val = stripHtml(n?.[key] ?? n?.en);
    if (val && val !== '?' && val !== '-' && !names.includes(val)) names.push(val);
  }
  if (names.length === 0) {
    const dn = stripHtml(pos.displayName?.[key] ?? pos.displayName?.en ?? '');
    if (dn) names.push(dn);
  }
  return names;
}

// Loads every officials position plus every glossary term as
// { names: {en,zht,zhs}, url, where }, once per run. The glossary is a
// TypeScript file, imported directly (needs a Node with TypeScript type
// stripping — 22.18+ / 24); if that fails, positions are still searched
// and only the glossary is skipped, with a warning.
let officialsDatabaseCache = null;
async function loadOfficialsDatabase() {
  if (officialsDatabaseCache) return officialsDatabaseCache;
  const entries = [];

  for (const [pageId, filename] of Object.entries(OFFICIALS_FILES)) {
    const filePath = path.join(OFFICIALS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ! ${filename} not found at ${filePath} — title search will skip it`);
      continue;
    }
    try {
      for (const cat of readJson(filePath).categories ?? []) {
        const posList = [...(cat.sections ?? []).flatMap((s) => s.positions ?? []), ...(cat.positions ?? [])];
        for (const pos of posList) {
          entries.push({
            names: { en: allPositionNames(pos, 'en'), zht: allPositionNames(pos, 'zht'), zhs: allPositionNames(pos, 'zhs') },
            url: `/translations/officials/${pageId}#${pos.id}`,
            where: `${pageId}${cat.label?.en ? ` · ${cat.label.en}` : ''}`,
          });
        }
      }
    } catch (e) {
      console.warn(`  ! could not read ${filename} — title search will skip it (${e.message})`);
    }
  }

  try {
    const mod = await import(pathToFileURL(GLOSSARY_PATH).href);
    for (const t of mod.glossaryTerms ?? []) {
      entries.push({
        names: { en: [t.term?.en].filter(Boolean), zht: [t.term?.zht].filter(Boolean), zhs: [t.term?.zhs].filter(Boolean) },
        url: `/translations/officials#glossary-${t.id}`,
        where: 'glossary',
      });
    }
  } catch (e) {
    console.warn(`  ! could not load the glossary (${e.message}) — title search will cover positions only`);
  }

  officialsDatabaseCache = entries;
  return entries;
}

// True if `hay` contains `needle` as a proper piece: for English, on whole
// word boundaries (so "commander" does NOT match inside "commandery");
// for Chinese, plain substring. Both arguments already lowercased.
function containsPiece(hay, needle, lang) {
  if (!needle || !hay.includes(needle)) return false;
  if (lang !== 'en') return true;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(hay);
}

// Step 2 of the title flow. Compares each of the title's en/zht/zhs forms
// against the same language's names of every officials entry:
//   exact match ................ best
//   one contains the other ..... ranked by how close the two are in length
//                                (so "Township Marquis" outranks a far
//                                longer title that merely contains the word)
// A contained/containing piece must be 2+ characters — single characters
// like 令 or 侯 would otherwise match half the database. Returns at most
// MAX_TITLE_SUGGESTIONS distinct links, best first, as candidates in the
// shape promptChooseCandidate expects.
function searchOfficialsDatabase(entries, seg) {
  const forms = { en: seg.en, zht: seg.zht, zhs: seg.zhs };
  const len = (s) => [...s].length;
  const scored = [];

  for (const e of entries) {
    let best = null;
    for (const lang of ['en', 'zht', 'zhs']) {
      const c = String(forms[lang] ?? '').trim().toLowerCase();
      if (!c) continue;
      for (const raw of e.names[lang] ?? []) {
        const n = String(raw).trim().toLowerCase();
        if (!n) continue;
        let score;
        if (n === c) score = 0;
        else if (len(n) >= 2 && len(c) >= 2 && (containsPiece(n, c, lang) || containsPiece(c, n, lang))) score = 1 + Math.abs(len(n) - len(c));
        else continue;
        if (best === null || score < best) best = score;
      }
    }
    if (best !== null) scored.push({ e, score: best });
  }

  scored.sort((a, b) => a.score - b.score);
  const seen = new Set();
  const results = [];
  for (const { e } of scored) {
    if (seen.has(e.url)) continue;
    seen.add(e.url);
    results.push({
      label: `${e.names.en[0] ?? ''} ${e.names.zht[0] ?? ''}`.trim() || e.url,
      disambiguation: e.where,
      entry: e.url,
    });
    if (results.length >= MAX_TITLE_SUGGESTIONS) break;
  }
  return results;
}

// Step 1 of the title flow: officials/glossary tags in the chapter whose
// label CONTAINS the title (e.g. the journey says "Chief Clerk" but the
// text only tags "Chief Clerk of the Chancellor"). The reverse direction —
// a title wrapping a tag — was already handled automatically before this
// point, so only this direction is left to ask about. 2+ characters only,
// for the same reason as above.
function findTitleContainsMatches(tags, seg) {
  const forms = ['en', 'zht', 'zhs']
    .map((lang) => ({ lang, text: String(seg[lang] ?? '').trim().toLowerCase() }))
    .filter((f) => [...f.text].length >= 2);
  if (forms.length === 0) return [];
  const seen = new Set();
  const results = [];
  for (const tag of tags) {
    if (!isOfficialsTagUrl(tag.url)) continue;
    const label = String(tag.label ?? '').toLowerCase();
    if (!forms.some((f) => containsPiece(label, f.text, f.lang))) continue;
    const url = stripLangPrefix(tag.url);
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ label: tag.label, disambiguation: url, entry: url });
  }
  return results;
}

// Accepts an officials link pasted in any form — a bare path, one with a
// /zh-hant or /zh-hans prefix, a site-prefixed one, or a full URL — and
// returns the language-neutral "/translations/officials/…" part, or null
// if it isn't an officials/glossary link.
function parseOfficialsLink(raw) {
  const s = String(raw ?? '').trim().replace(/^["']|["']$/g, '');
  const i = s.indexOf('/translations/officials');
  if (i === -1) return null;
  const rest = s.slice(i);
  return isOfficialsTagUrl(rest) ? rest : null;
}

// A title that no tag matched (see resolvePositionLinks): asks, in three
// steps, how to link it — see the TITLES section in the header. Returns
// the link (language-neutral) or null if it stays unlinked.
async function resolveUnlinkedTitle(rl, overrides, chapterId, passageTags, chapterTags, seg, passageId, warnings) {
  const displayName = seg.en || seg.zht || seg.zhs;
  if (!displayName) return null;
  const promptName = [seg.en, seg.zht].filter(Boolean).join(' / ');
  const cacheKey = `${chapterId}::title::${displayName}`;

  const cached = overrides[cacheKey];
  if (cached === TITLE_SKIP_MARK) return null; // intentionally unlinked
  if (cached) {
    const cachedUrl = parseOfficialsLink(cached);
    if (cachedUrl) return cachedUrl;
  }

  let url = null;

  // Step 1: officials/glossary tags in the chapter that contain the title.
  const seen = new Set();
  const containsCandidates = [...findTitleContainsMatches(passageTags, seg), ...findTitleContainsMatches(chapterTags, seg)].filter((c) => {
    if (seen.has(c.entry)) return false;
    seen.add(c.entry);
    return true;
  });
  if (containsCandidates.length) {
    url = await promptChooseCandidate(
      rl,
      containsCandidates,
      `title: ${promptName}`,
      passageId,
      `no tag matches this title, but ${containsCandidates.length} officials tag(s) in the chapter contain it`
    );
  }

  // Step 2: search the officials databases + glossary.
  if (!url) {
    const dbCandidates = searchOfficialsDatabase(await loadOfficialsDatabase(), seg);
    if (dbCandidates.length) {
      url = await promptChooseCandidate(
        rl,
        dbCandidates,
        `title: ${promptName}`,
        passageId,
        `closest ${dbCandidates.length} match(es) in the officials database / glossary`
      );
    }
  }

  // Step 3: paste a link, skip, or mark as never-link.
  if (!url) {
    const answer = (
      await rl.question(
        `\n  ? Could not link title "${promptName}" (chapter ${chapterId}, passageId: ${passageId || 'none'}).\n` +
          `    Paste an officials link (…/translations/officials/<page>#<id> or …#glossary-<id>, any language version),\n` +
          `    press Enter to skip for now, or type x to leave it unlinked for good: `
      )
    ).trim();

    if (answer.toLowerCase() === 'x') {
      overrides[cacheKey] = TITLE_SKIP_MARK;
      saveOverrides(overrides);
      return null;
    }
    if (answer) {
      url = parseOfficialsLink(answer);
      if (!url) warnings.push(`  ! the link provided for title "${promptName}" didn't look like an officials/glossary link — skipped`);
    }
  }

  if (url) {
    overrides[cacheKey] = url;
    saveOverrides(overrides); // persist immediately, in case of a later crash
  } else {
    warnings.push(`  ! title "${promptName}" (passageId: ${passageId || 'none'}) is still unlinked`);
  }
  return url;
}

// Resolves EACH title segment independently, per the grammar rules — the
// core title xx within each segment is looked up exactly first, falling
// back to a substring match (still requiring an officials-page tag) for
// the "yyxxzz" wrapped form. Anything still unlinked after that goes
// through the interactive resolveUnlinkedTitle flow (unless --skip-titles).
// Returns one {en, zht, zhs, url} per segment, url null if that specific
// segment didn't resolve.
async function resolvePositionLinks(rl, overrides, chapterId, passagesById, chapterTags, stop, warnings) {
  if (!stop.position) return [];

  const segments = splitPositionSegments(stop.position);
  const passage = stop.passageId ? passagesById.get(stop.passageId) : null;
  const passageTags = passage ? collectTagsFromPassage(passage) : [];

  const links = [];
  for (const seg of segments) {
    const candidates = [seg.en, seg.zht, seg.zhs];
    const zhCandidates = [seg.zht, seg.zhs];

    let rawUrl = findMatchingTagUrl(passageTags, candidates) || findMatchingTagUrl(chapterTags, candidates);
    if (!rawUrl) {
      rawUrl =
        findMatchingTagUrlBySubstring(passageTags, zhCandidates) ||
        findMatchingTagUrlBySubstring(chapterTags, zhCandidates);
    }

    let url = rawUrl ? stripLangPrefix(rawUrl) : null;
    if (!url && !SKIP_TITLES) {
      url = await resolveUnlinkedTitle(rl, overrides, chapterId, passageTags, chapterTags, seg, stop.passageId, warnings);
    }
    links.push({ ...seg, url });
  }
  return links;
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
      stop.positionLinks = await resolvePositionLinks(rl, overrides, chapterId, passagesById, chapterTags, stop, warnings);

      for (const entry of entries) {
        if (!entry) continue; // an unresolved location - kept as null in resolvedLocations for index alignment, but not a real pin
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

// Extracts just the "Book of Wei, Chapter 16" / "魏書十六" portion from a
// chapter's full title (e.g. "Book of Wei, Chapter 16 · Biography of Du
// Ji" / "魏書十六 · 杜畿传"). Splitting on the title's own consistent " · "
// separator rather than rebuilding this from bookLabel+num directly,
// since the Chinese side uses author-written numerals (十六) that don't
// derive cleanly from num's raw "16" - reusing the already-correct title
// avoids needing a number-to-Chinese-numeral converter of our own.
function extractChapterTag(titleField) {
  if (!titleField) return null;
  const split = (s) => (s ? s.split(' · ')[0].trim() : '');
  return { en: split(titleField.en), zht: split(titleField.zht), zhs: split(titleField.zhs) };
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
  const index = [];

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

    // The chapter's own label/order (e.g. "Biographies of Ren, Su, Du,
    // Zheng, Cang", order 16) - carried into the output so the frontend
    // can show "from [this chapter]" when paging between several people
    // who share one biography, without needing a second fetch just for
    // that context.
    // title already combines bookLabel + num + label (e.g. "Book of
    // Wei, Chapter 16 · Biography of Du Ji" / "魏書十六 · 杜畿传") - carried
    // over as-is rather than reconstructing the same thing from book/num/
    // label separately, since the chapter data already did that work.
    const chapter = { id: chapterId, order: data.order ?? null, label: data.label ?? null, title: data.title ?? null };

    const outPath = path.join(OUT_DIR, `${chapterId}.json`);
    const outData = {
      chapter,
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

    // One index entry per person in this chapter - enough for the
    // journey landing page to search/sort/display without fetching every
    // chapter's full journey data up front.
    for (const person of enrichedOverviews) {
      index.push({
        person: person.person,
        name: person.name ?? null,
        courtesyName: person.courtesyName ?? null,
        chapterId,
        chapterOrder: data.order ?? null,
        chapterLabel: data.label ?? null,
        chapterTag: extractChapterTag(data.title),
        kingdom: getPersonKingdom(person),
      });
    }
  }

  const indexPath = path.join(OUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote journey index: ${index.length} people across ${written} chapter(s) -> journeys/index.json`);

  rl.close();
  console.log(`\nDone. ${written} journey file(s) written, ${emptyChapters} chapter(s) had no journeyOverviews data.`);
}

main();
