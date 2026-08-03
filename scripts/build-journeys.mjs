#!/usr/bin/env node
// scripts/build-journeys.mjs
//
// Generates one journey file per chapter — public/mapbase/journeys/<chapterId>.json
// — listing every distinct place (and, for forward compatibility, admin
// boundary / water body) referenced anywhere in that chapter via its
// existing [[label|url]] tags (the ones link-terms.mjs already resolved).
//
// A chapter's passages AND annotations are both scanned, across all three
// language fields (zht/zhs/en) — since the same physical place is tagged
// separately per language (each with its own language-prefixed URL,
// e.g. /zh-hant/maps/... vs /maps/...), entries are deduplicated on their
// underlying identity (lat/lng for towns, id for admin boundaries/water
// bodies), not on the raw URL string — so the same place mentioned in all
// three languages still only produces one pin.
//
// Town entries (lat/lng) are rendered as pins by interactive-map.js's
// journey view. Admin boundary / water body entries are rendered as a
// bold border around the referenced feature instead (they're areas/lines,
// not points, so they don't get a pin) — both kinds are fully plotted.
//
// Bare [[phrase]] tags with no |url yet (unresolved by link-terms.mjs)
// are ignored — there's nothing to plot for those.
//
// Usage (run from the project root, i.e. the "web" folder):
//   node scripts/build-journeys.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SGZ_DIR = path.join(ROOT, 'src/data/sgz');
const OUT_DIR = path.join(ROOT, 'public/mapbase/journeys');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// Matches already-resolved [[label|url]] tags only.
const TAG_RE = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

function extractUrls(text) {
  if (typeof text !== 'string') return [];
  const urls = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    urls.push(m[2]);
  }
  return urls;
}

// Strips a leading /zh-hant or /zh-hans prefix so the same real-world
// place tagged in different language fields resolves to the same entry
// regardless of which language-prefixed URL it happened to carry.
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

function collectEntriesFromChapter(data) {
  const entriesByKey = new Map();

  const addFromText = (text) => {
    for (const rawUrl of extractUrls(text)) {
      const entry = parseLocationEntry(rawUrl);
      if (!entry) continue;
      const key = identityKey(entry);
      if (!entriesByKey.has(key)) entriesByKey.set(key, entry);
    }
  };

  for (const p of data.passages ?? []) {
    addFromText(p.orig?.zht);
    addFromText(p.orig?.zhs);
    addFromText(p.en);
    for (const a of p.annotations ?? []) {
      addFromText(a.zht);
      addFromText(a.zhs);
      addFromText(a.en);
    }
  }

  return [...entriesByKey.values()];
}

function main() {
  if (!fs.existsSync(SGZ_DIR)) {
    console.error(`ERROR: ${SGZ_DIR} not found. Run this from the project root.`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(SGZ_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Scanning ${files.length} chapter file(s)...`);

  let written = 0;
  let emptyChapters = 0;

  for (const file of files) {
    const filePath = path.join(SGZ_DIR, file);
    const data = readJson(filePath);
    const chapterId = data.id || path.basename(file, '.json');

    const entries = collectEntriesFromChapter(data);

    if (entries.length === 0) {
      emptyChapters++;
      continue; // no linked places in this chapter yet — nothing to write
    }

    const townCount = entries.filter((e) => e.kind === 'town').length;
    const otherCount = entries.length - townCount;

    const outPath = path.join(OUT_DIR, `${chapterId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
    written++;
    console.log(
      `  ${chapterId}: ${townCount} town(s)${otherCount ? `, ${otherCount} admin/water boundary(ies)` : ''} -> journeys/${chapterId}.json`
    );
  }

  console.log(`\nDone. ${written} journey file(s) written, ${emptyChapters} chapter(s) had no linked places.`);
}

main();
