#!/usr/bin/env node
// scripts/link-terms.mjs
//
// Scans every chapter JSON under src/data/sgz for bare [[phrase]] tags
// (i.e. tags with no |url yet) and tries to auto-resolve each one against
// the officials index, town index, province/admin index, and water body
// index.
//
// MATCHING MODEL
// Every source (officials, towns, provinces, water) is normalized into
// the same shape: { kind, names: { en: [...], zht: [...], zhs: [...] }, ...urlBits }.
// "names" is a LIST per language, not a single string — because:
//   - Officials positions can have different names across Wei/Shu/Wu (or
//     multiple names within one kingdom), and ALL of them should be
//     searchable, not just whichever came first.
//   - Water bodies carry historical name variants (Name_CH_variants etc.)
//     that all refer to the same feature.
// A phrase matches a record if it equals ANY name in that record's list
// for the given language.
//
// ADMIN-SUFFIX NORMALIZATION (towns/provinces/water only, not officials)
// Place names are sometimes written with a trailing 縣/郡/國 (or
// simplified 县/郡/国) and sometimes without (e.g. 葉 vs 葉縣). For these
// three sources, matching also tries both the phrase and each candidate
// name with that trailing suffix stripped, so either form matches the
// other regardless of which one appears in your text.
//
// CROSS-LANGUAGE GROUPING
// Matching happens per PASSAGE GROUP: the zht, zhs, and en [[...]] tags
// within the same passage (or the same annotation) are assumed to
// describe the same entities in the same order. If one language's tag
// resolves confidently but a sibling's has a typo/mismatch and fails on
// its own, the confident answer is borrowed for the failing slot
// (re-prefixed for its own language). This only applies when all three
// fields have the SAME NUMBER of tags in that group — otherwise
// positional correspondence can't be trusted, and it's flagged instead.
//
// Per tag/slot, in order:
//   1. Match in the tag's own field language (with suffix normalization
//      where applicable).
//   2. If that finds nothing at all, fall back to matching in English.
//   3. If still unresolved/ambiguous, borrow from a sibling language at
//      the same position IF all resolved siblings agree on one record.
//   4. Otherwise: ambiguous (multiple candidates) or unresolved (none) —
//      left untouched, reported for manual review.
//
// Safe to re-run: the matching regex only touches tags WITHOUT a "|" yet,
// so already-resolved [[phrase|url]] tags (including hand-corrected ones)
// are never touched.
//
// Usage (run from the project root, i.e. the "web" folder):
//   node scripts/link-terms.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SGZ_DIR = path.join(ROOT, 'src/data/sgz');

// NOTE: adjust these if the map data files actually live somewhere else.
const TOWNS_PATH = path.join(ROOT, 'public/mapbase/All_Towns.json');
const PROVINCES_PATH = path.join(ROOT, 'public/mapbase/All_Provinces.json');
const WATER_PATH = path.join(ROOT, 'public/mapbase/all_water_bodies.json');

// Maps each officials category id -> its JSON filename under src/data/officials/.
// Mirrors build-officials-index.ts's fileMap, so this stays in sync with
// how the real search page indexes the same data.
const OFFICIALS_FILES = {
  departments: 'central-court-database.json',
  ministers: 'excellencies-database.json',
  military: 'military-officials-database.json',
  regional: 'provincial-officials-database.json',
  household: 'rear-eastern-palace-database.json',
};

const LANGS = ['zht', 'zhs', 'en'];
const ADMIN_SUFFIXES = { zht: ['縣', '郡', '國'], zhs: ['县', '郡', '国'] };

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function stripHtml(str) {
  return (str ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

// Collects EVERY non-placeholder name for a position across Wei/Shu/Wu
// (deduplicated), instead of just the first one — this is the fix for
// titles that differ by kingdom or have multiple recorded names.
function allNameVariants(pos, key) {
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

function buildOfficialsIndex() {
  const positions = [];

  for (const [pageId, filename] of Object.entries(OFFICIALS_FILES)) {
    const filePath = path.join(ROOT, 'src/data/officials', filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  (skipping ${filename} — not found at src/data/officials/${filename})`);
      continue;
    }
    const pageData = readJson(filePath);
    for (const cat of pageData.categories ?? []) {
      const posList = [
        ...(cat.sections ?? []).flatMap((s) => s.positions ?? []),
        ...(cat.positions ?? []),
      ];
      for (const pos of posList) {
        positions.push({
          kind: 'official',
          names: {
            en: allNameVariants(pos, 'en'),
            zht: allNameVariants(pos, 'zht'),
            zhs: allNameVariants(pos, 'zhs'),
          },
          url: `/translations/officials/${pageId}#${pos.id}`,
        });
      }
    }
  }

  return positions;
}

function buildTownIndex() {
  if (!fs.existsSync(TOWNS_PATH)) {
    console.warn(`  Town data not found at ${TOWNS_PATH} — location matching will be skipped.`);
    return [];
  }
  const data = readJson(TOWNS_PATH);
  return (data.All_Towns_Details ?? []).map((t) => ({
    kind: 'location',
    names: {
      en: [t.Town_EN].filter(Boolean),
      zht: [t.Town_CH].filter(Boolean),
      zhs: [t.Town_CHS].filter(Boolean),
    },
    lat: t.Latitude,
    lng: t.Longitude,
  }));
}

function buildProvinceIndex() {
  if (!fs.existsSync(PROVINCES_PATH)) {
    console.warn(`  Province data not found at ${PROVINCES_PATH} — admin-boundary matching will be skipped.`);
    return [];
  }
  const data = readJson(PROVINCES_PATH);
  return (data.features ?? []).map((f) => ({
    kind: 'province',
    id: f.properties?.id,
    names: {
      en: [f.properties?.Name_EN].filter(Boolean),
      zht: [f.properties?.Name_CH].filter(Boolean),
      zhs: [f.properties?.Name_CHS].filter(Boolean),
    },
  }));
}

function buildWaterIndex() {
  if (!fs.existsSync(WATER_PATH)) {
    console.warn(`  Water body data not found at ${WATER_PATH} — river/lake matching will be skipped.`);
    return [];
  }
  const data = readJson(WATER_PATH);
  return (data.features ?? []).map((f) => ({
    kind: 'water',
    id: f.properties?.id,
    names: {
      en: [f.properties?.Name_EN].filter(Boolean),
      zht: [f.properties?.Name_CH, ...(f.properties?.Name_CH_variants ?? [])].filter(Boolean),
      zhs: [f.properties?.Name_CHS, ...(f.properties?.Name_CHS_variants ?? [])].filter(Boolean),
    },
  }));
}

function langPrefixFor(lang) {
  if (lang === 'zht') return '/zh-hant';
  if (lang === 'zhs') return '/zh-hans';
  return '';
}

function candidateUrl(kind, record, lang) {
  const prefix = langPrefixFor(lang);
  if (kind === 'official') return `${prefix}${record.url}`;
  if (kind === 'location') {
    const name = record.names.en[0] ?? '';
    return `${prefix}/maps/map-overall?lat=${record.lat}&lng=${record.lng}&name=${encodeURIComponent(name)}`;
  }
  if (kind === 'province') return `${prefix}/maps/map-overall?admin=${record.id}`;
  return `${prefix}/maps/map-overall?water=${record.id}`;
}

function candidateName(kind, record, lang) {
  const arr = record.names[lang];
  if (arr && arr.length) return arr[0];
  return record.names.en[0] ?? '(unnamed)';
}

function candidateIdentity(kind, record) {
  if (kind === 'official') return `official:${record.url}`;
  if (kind === 'location') return `location:${record.names.en[0]}:${record.lat}:${record.lng}`;
  if (kind === 'province') return `province:${record.id}`;
  return `water:${record.id}`;
}

// Strips one trailing administrative suffix (縣/郡/國 or simplified
// equivalents), if present. Returns the string unchanged otherwise
// (including for English, where this is a no-op).
function stripAdminSuffix(str, lang) {
  const suffixes = ADMIN_SUFFIXES[lang];
  if (!suffixes || !str) return str;
  for (const suf of suffixes) {
    if (str.length > suf.length && str.endsWith(suf)) return str.slice(0, -suf.length);
  }
  return str;
}

// A record matches a phrase if any of its names for this language equal
// the phrase outright, OR — for sources that opt in — equal it once a
// trailing admin suffix is stripped from either side (the phrase, the
// candidate name, or both) — since either the tagged text or the
// database entry might be the one carrying the 縣/郡/國 suffix.
function namesMatch(candidateNames, phrase, lang, allowSuffixStrip) {
  if (!candidateNames || candidateNames.length === 0) return false;
  if (candidateNames.includes(phrase)) return true;
  if (!allowSuffixStrip) return false;
  const normPhrase = stripAdminSuffix(phrase, lang);
  return candidateNames.some((n) => {
    const normName = stripAdminSuffix(n, lang);
    return normName === phrase || n === normPhrase || normName === normPhrase;
  });
}

// sources: [{ list, allowSuffixStrip }] — officials don't get suffix
// stripping (not applicable to titles), towns/provinces/water do.
function findCandidates(phrase, lang, sources) {
  const search = (l) =>
    sources.flatMap(({ list, allowSuffixStrip }) =>
      list
        .filter((r) => namesMatch(r.names[l], phrase, l, allowSuffixStrip))
        .map((record) => ({ kind: record.kind, record }))
    );

  let candidates = search(lang);
  let usedFallback = false;

  if (candidates.length === 0 && lang !== 'en') {
    candidates = search('en');
    usedFallback = candidates.length > 0;
  }

  return { candidates, usedFallback };
}

function extractTags(text) {
  if (typeof text !== 'string') return [];
  const tags = [];
  const re = /\[\[([^|\]]+)\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push(m[1].trim());
  return tags;
}

function applyResolved(text, resolvedList) {
  if (typeof text !== 'string' || !text.includes('[[')) return text;
  let i = -1;
  return text.replace(/\[\[([^|\]]+)\]\]/g, (whole, rawPhrase) => {
    i++;
    const r = resolvedList[i];
    if (r && r.href) return `[[${rawPhrase.trim()}|${r.href}]]`;
    return whole;
  });
}

function resolveGroup(fieldsText, sources, report, location) {
  const tagsByLang = {};
  for (const lang of LANGS) tagsByLang[lang] = extractTags(fieldsText[lang]);

  const lengths = LANGS.map((l) => tagsByLang[l].length);
  const countsMatch = lengths.every((n) => n === lengths[0]);
  const groupLen = countsMatch ? lengths[0] : null;

  if (!countsMatch && lengths.some((n) => n > 0)) {
    report.countMismatch.push({
      ...location,
      counts: Object.fromEntries(LANGS.map((l, idx) => [l, lengths[idx]])),
    });
  }

  const finalByLang = {};
  for (const lang of LANGS) {
    finalByLang[lang] = tagsByLang[lang].map((phrase) => {
      const { candidates, usedFallback } = findCandidates(phrase, lang, sources);
      const href = candidates.length === 1 ? candidateUrl(candidates[0].kind, candidates[0].record, lang) : null;
      return { phrase, candidates, usedFallback, href, borrowedFrom: null };
    });
  }

  if (countsMatch) {
    for (let i = 0; i < groupLen; i++) {
      const resolvedLangs = LANGS.filter((l) => finalByLang[l][i].candidates.length === 1);
      const unresolvedLangs = LANGS.filter((l) => finalByLang[l][i].candidates.length !== 1);
      if (resolvedLangs.length === 0 || unresolvedLangs.length === 0) continue;

      const identities = new Set(
        resolvedLangs.map((l) => {
          const c = finalByLang[l][i].candidates[0];
          return candidateIdentity(c.kind, c.record);
        })
      );

      if (identities.size > 1) {
        report.conflict.push({
          ...location,
          index: i,
          entries: LANGS.map((l) => ({
            lang: l,
            phrase: finalByLang[l][i].phrase,
            candidateCount: finalByLang[l][i].candidates.length,
          })),
        });
        continue;
      }

      const sourceLang = resolvedLangs[0];
      const sourceCandidate = finalByLang[sourceLang][i].candidates[0];
      for (const lang of unresolvedLangs) {
        finalByLang[lang][i].href = candidateUrl(sourceCandidate.kind, sourceCandidate.record, lang);
        finalByLang[lang][i].borrowedFrom = sourceLang;
      }
    }
  }

  for (const lang of LANGS) {
    finalByLang[lang].forEach((r) => {
      if (r.href) {
        report.filled.push({ ...location, lang, phrase: r.phrase, href: r.href, usedFallback: r.usedFallback, borrowedFrom: r.borrowedFrom });
      } else if (r.candidates.length > 1) {
        report.ambiguous.push({
          ...location,
          lang,
          phrase: r.phrase,
          candidates: r.candidates.map(({ kind, record }) => ({
            kind,
            name: candidateName(kind, record, lang),
            href: candidateUrl(kind, record, lang),
          })),
        });
      } else {
        report.unresolved.push({ ...location, lang, phrase: r.phrase });
      }
    });
  }

  return {
    zht: applyResolved(fieldsText.zht, finalByLang.zht),
    zhs: applyResolved(fieldsText.zhs, finalByLang.zhs),
    en: applyResolved(fieldsText.en, finalByLang.en),
  };
}

function processChapterFile(filePath, sources, report) {
  const data = readJson(filePath);
  let changed = false;
  const fileName = path.basename(filePath);

  for (const p of data.passages ?? []) {
    const before = JSON.stringify(p);

    const passageResolved = resolveGroup(
      { zht: p.orig?.zht, zhs: p.orig?.zhs, en: p.en },
      sources, report,
      { file: fileName, passage: p.id }
    );
    if (p.orig?.zht !== undefined) p.orig.zht = passageResolved.zht;
    if (p.orig?.zhs !== undefined) p.orig.zhs = passageResolved.zhs;
    if (p.en !== undefined) p.en = passageResolved.en;

    for (const a of p.annotations ?? []) {
      const annResolved = resolveGroup(
        { zht: a.zht, zhs: a.zhs, en: a.en },
        sources, report,
        { file: fileName, passage: p.id, annotation: true }
      );
      if (a.zht !== undefined) a.zht = annResolved.zht;
      if (a.zhs !== undefined) a.zhs = annResolved.zhs;
      if (a.en !== undefined) a.en = annResolved.en;
    }

    if (JSON.stringify(p) !== before) changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }
  return changed;
}

function printReport(report) {
  const byGroup = {};
  const addTo = (bucket, entry) => {
    const key = `${entry.file} / ${entry.passage}${entry.annotation ? ' (annotation)' : ''}`;
    byGroup[key] = byGroup[key] || { filled: [], ambiguous: [], unresolved: [], conflict: [], countMismatch: [] };
    byGroup[key][bucket].push(entry);
  };
  report.filled.forEach((e) => addTo('filled', e));
  report.ambiguous.forEach((e) => addTo('ambiguous', e));
  report.unresolved.forEach((e) => addTo('unresolved', e));
  report.conflict.forEach((e) => addTo('conflict', e));
  report.countMismatch.forEach((e) => addTo('countMismatch', e));

  const lines = [];
  for (const [key, groups] of Object.entries(byGroup)) {
    lines.push(`\n${key}:`);
    for (const e of groups.countMismatch) {
      lines.push(`  \u26a0 tag count mismatch across languages — zht:${e.counts.zht} zhs:${e.counts.zhs} en:${e.counts.en} (cross-language borrowing skipped for this group)`);
    }
    for (const e of groups.filled) {
      const note = e.borrowedFrom
        ? `  (borrowed from ${e.borrowedFrom})`
        : e.usedFallback
        ? `  (matched via English fallback)`
        : '';
      lines.push(`  \u2713 [${e.lang}] ${e.phrase} \u2192 ${e.href}${note}`);
    }
    for (const e of groups.conflict) {
      lines.push(`  \u2716 conflict at position ${e.index} — sibling languages disagree, not auto-filled:`);
      for (const entry of e.entries) {
        lines.push(`      - [${entry.lang}] "${entry.phrase}" (${entry.candidateCount} candidate(s))`);
      }
    }
    for (const e of groups.ambiguous) {
      lines.push(`  \u26a0 [${e.lang}] ${e.phrase} \u2014 ${e.candidates.length} candidates, not auto-filled:`);
      for (const c of e.candidates) {
        lines.push(`      - [${c.kind}] ${c.name} \u2192 ${c.href}`);
      }
    }
    for (const e of groups.unresolved) {
      lines.push(`  \u2717 [${e.lang}] ${e.phrase} \u2014 no match found in either language`);
    }
  }

  const summary = `\nSummary: ${report.filled.length} auto-filled, ${report.ambiguous.length} ambiguous, ${report.unresolved.length} unresolved, ${report.conflict.length} conflicts, ${report.countMismatch.length} count mismatches.\n`;
  const output = lines.join('\n') + '\n' + summary;

  console.log(output);
  const reportPath = path.join(ROOT, 'link-terms-report.txt');
  fs.writeFileSync(reportPath, output, 'utf-8');
  console.log(`Full report also saved to ${reportPath}`);
}

function main() {
  console.log('Building officials index...');
  const officials = buildOfficialsIndex();
  console.log(`  ${officials.length} positions loaded.`);

  console.log('Building town index...');
  const towns = buildTownIndex();
  console.log(`  ${towns.length} towns loaded.`);

  console.log('Building province/admin index...');
  const provinces = buildProvinceIndex();
  console.log(`  ${provinces.length} provinces/boundaries loaded.`);

  console.log('Building water body index...');
  const water = buildWaterIndex();
  console.log(`  ${water.length} water bodies loaded.`);

  const sources = [
    { list: officials, allowSuffixStrip: false },
    { list: towns, allowSuffixStrip: true },
    { list: provinces, allowSuffixStrip: true },
    { list: water, allowSuffixStrip: true },
  ];

  if (!fs.existsSync(SGZ_DIR)) {
    console.error(`\nERROR: ${SGZ_DIR} not found. Run this from the project root.`);
    process.exit(1);
  }

  const files = fs.readdirSync(SGZ_DIR).filter((f) => f.endsWith('.json'));
  console.log(`\nScanning ${files.length} chapter file(s) in src/data/sgz...`);

  const report = { filled: [], ambiguous: [], unresolved: [], conflict: [], countMismatch: [] };
  for (const file of files) {
    processChapterFile(path.join(SGZ_DIR, file), sources, report);
  }

  printReport(report);
}

main();
