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
// VERNACULAR (白話) FIELD
// Every passage AND every annotation carries  vern: { zht, zhs }  — the
// modern-Chinese rendering shown paired under the classical text in the 白話
// view (footnotes have none). You write ONLY vern.zhs (plain text is fine);
// on each run, for every passage/annotation whose vern.zhs is non-empty,
// this script:
//   a. Links terms: every resolved [[label|url]] tag in the ORIGINAL zhs
//      text (a passage's orig.zhs, or an annotation's own zhs) is looked up
//      (by its label) in vern.zhs and the matches are wrapped with the same
//      URL. A multi-paragraph annotation (paragraphs split by a blank line)
//      is matched paragraph by paragraph when the vernacular has the same
//      number of paragraphs (flagged if not, and matched as a whole).
//      Counts are compared per term, per passage/annotation/paragraph:
//        - counts agree            -> link all occurrences, no comment.
//        - counts differ, label of 2+ characters -> link ALL occurrences
//          anyway, and flag it in the report for you to check.
//        - counts differ, label of 1 character -> do NOT link (a single
//          character matches inside far too many unrelated words), flag it.
//        - term not found in vern.zhs at all -> flag it.
//      A term that already carries ANY tag in vern.zhs is treated as
//      reviewed and left alone, so tags you add/remove by hand survive
//      re-runs (to link a flagged 1-character term yourself, just wrap the
//      right occurrences in [[char|url]] by hand). Longer terms win over
//      shorter ones that sit inside them.
//   b. Regenerates vern.zht from the (now linked) vern.zhs with OpenCC
//      (Simplified -> Traditional). vern.zht is fully derived and
//      overwritten on every run — edit vern.zhs, not vern.zht. Link URLs
//      are swapped to the matching /zh-hant/ URL of the original zht tag
//      at the same position (falling back to a plain prefix swap).
//   c. Passages listed in SKIP_VERN_LINKING (hand-reviewed, false links
//      removed on purpose) are not auto-linked again; their vern.zht is
//      still regenerated from vern.zhs (step b). See the constant below.
// Passages/annotations that don't have a vern object yet get an empty
// placeholder (after "orig" for a passage, after "zhs" for an annotation).
//
// Usage (run from the project root, i.e. the "web" folder):
//   node scripts/link-terms.mjs

import fs from 'node:fs';
import path from 'node:path';
import { Converter } from 'opencc-js';

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

// Passages whose vernacular links were reviewed and fixed by hand. For these,
// term-linking is skipped (so a link that was deliberately removed is not
// added back on the next run), but vern.zht is STILL regenerated from
// vern.zhs, so later hand edits to the zhs still reach the traditional text.
// Only the passage itself is skipped, not its annotations. Add an entry
// (passage id -> reason) whenever you hand-remove a false link that this
// script would re-add: it matches single characters / substrings, and only
// leaves a term alone if a tag with that exact label is already in the text.
const SKIP_VERN_LINKING = {
  'ws18b-p4': '孤军独守: 守 = "hold out", not the office 太守 (it would be linked as 守)',
  'ws18e-p5': '汝南、颍川: the original 汝/潁 are rivers, so linking the 汝 of 汝南 is misleading',
};

const LANGS = ['zht', 'zhs', 'en'];
const ADMIN_SUFFIXES = { zht: ['縣', '郡', '國'], zhs: ['县', '郡', '国'] };

// vern.zhs -> vern.zht. 't' is OpenCC's standard Traditional (script
// conversion only); switch `to` to 'tw'/'twp'/'hk' if regional vocabulary
// swaps (e.g. 軟體 vs 軟件) are ever wanted for the Traditional site.
const toTraditional = Converter({ from: 'cn', to: 't' });

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

// ── Vernacular (白話) ────────────────────────────────────────────────

// Adds an empty vern placeholder right after `afterKey` ("orig" for a
// passage, "zhs" for an annotation) if the object has none.
function ensureVern(obj, afterKey) {
  if (obj.vern !== undefined) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === afterKey) out.vern = { zht: '', zhs: '' };
  }
  if (out.vern === undefined) out.vern = { zht: '', zhs: '' };
  return out;
}

// Passage + each of its annotations. Returns the same object if nothing
// needed adding, so callers can tell whether anything changed.
function ensureVernDeep(p) {
  const withVern = ensureVern(p, 'orig');
  if (!Array.isArray(withVern.annotations)) return withVern;
  const anns = withVern.annotations.map((a) => ensureVern(a, 'zhs'));
  if (anns.every((a, i) => a === withVern.annotations[i])) return withVern;
  return { ...withVern, annotations: anns };
}

// Resolved [[label|url]] tags, in order.
function resolvedTags(text) {
  if (typeof text !== 'string') return [];
  const tags = [];
  const re = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push({ label: m[1].trim(), url: m[2].trim() });
  return tags;
}

function countBareTags(text) {
  return typeof text === 'string' ? (text.match(/\[\[[^|\]]+\]\]/g) ?? []).length : 0;
}

// Splits text into alternating plain runs and existing [[...]] tags
// (resolved or bare) — tags are protected from being matched inside.
function splitByTags(text) {
  const parts = [];
  const re = /\[\[([^|\]]*)(?:\|[^\]]*)?\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ tag: false, text: text.slice(last, m.index) });
    parts.push({ tag: true, text: m[0], label: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ tag: false, text: text.slice(last) });
  return parts;
}

// Tokenizes a plain run into { text, term } pieces, where term is the
// matched term object (or null). `terms` must be sorted longest-label-first
// so a long term wins over a shorter one sitting inside it.
function scanForTerms(text, terms) {
  const tokens = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    const t = terms.find((term) => text.startsWith(term.label, i));
    if (t) {
      if (buf) tokens.push({ text: buf, term: null });
      buf = '';
      tokens.push({ text: t.label, term: t });
      i += t.label.length;
    } else {
      buf += text[i++];
    }
  }
  if (buf) tokens.push({ text: buf, term: null });
  return tokens;
}

function swapToTraditionalPrefix(url) {
  return url.replace(/^\/zh-hans(?=\/|$)/, '/zh-hant');
}

// zhs-url -> zht-url, by position, from the original's own tags. Only
// trusted when both languages have the same number of resolved tags.
function buildZhtUrlMap(origZhs, origZht) {
  const zhs = resolvedTags(origZhs);
  const zht = resolvedTags(origZht);
  const map = new Map();
  if (zhs.length !== zht.length) return map;
  zhs.forEach((t, i) => { if (!map.has(t.url)) map.set(t.url, zht[i].url); });
  return map;
}

// Converts tagged vern.zhs to Traditional. Each tag's label is kept inline
// (wrapped in private-use markers) so OpenCC still sees its context, while
// the URLs are held aside — they're never run through the converter.
function convertVernToTraditional(zhsText, urlMap) {
  const urls = [];
  const masked = zhsText.replace(/\[\[([^|\]]+)(?:\|([^\]]*))?\]\]/g, (_m, label, url) => {
    urls.push(url);
    return `${label}`;
  });
  const converted = toTraditional(masked);
  let i = 0;
  return converted.replace(/([^]*)/g, (_m, label) => {
    const url = urls[i++];
    if (url === undefined) return `[[${label}]]`;
    return `[[${label}|${urlMap.get(url) ?? swapToTraditionalPrefix(url)}]]`;
  });
}

// Links the terms of ONE unit (a whole passage/annotation, or one paragraph
// of a multi-paragraph annotation): every resolved tag in `origText` is
// searched for in `vernText`. Returns the vernacular text with links added
// and how many were added. `flag(kind, extra)` records anything to check.
function linkVernUnit(origText, vernText, flag) {
  // Distinct terms in the original, with how many times each is tagged.
  const termMap = new Map();
  for (const { label, url } of resolvedTags(origText)) {
    const t = termMap.get(label) ?? { label, count: 0, urls: [] };
    t.count++;
    if (!t.urls.includes(url)) t.urls.push(url);
    termMap.set(label, t);
  }
  const terms = [...termMap.values()].sort((a, b) => b.label.length - a.label.length);

  const parts = splitByTags(vernText);
  const reviewed = new Set(parts.filter((x) => x.tag).map((x) => x.label));
  const scanned = parts.map((part) => (part.tag ? null : scanForTerms(part.text, terms)));

  const plainCount = new Map();
  for (const tokens of scanned) {
    for (const tok of tokens ?? []) {
      if (tok.term) plainCount.set(tok.term.label, (plainCount.get(tok.term.label) ?? 0) + 1);
    }
  }

  const linkSet = new Set();
  for (const t of terms) {
    if (reviewed.has(t.label)) continue;
    const found = plainCount.get(t.label) ?? 0;
    if (found === 0) {
      flag('absent', { label: t.label, orig: t.count });
      continue;
    }
    const consistent = found === t.count;
    const isSingleChar = [...t.label].length === 1;
    if (isSingleChar && !consistent) {
      flag('notLinked', { label: t.label, orig: t.count, vern: found });
      continue;
    }
    linkSet.add(t.label);
    if (!consistent) flag('linkedAll', { label: t.label, orig: t.count, vern: found });
    if (t.urls.length > 1) flag('multiUrl', { label: t.label, urls: t.urls });
  }

  let added = 0;
  const newZhs = parts
    .map((part, i) => {
      if (part.tag) return part.text;
      return scanned[i]
        .map((tok) => {
          if (tok.term && linkSet.has(tok.term.label)) {
            added++;
            return `[[${tok.text}|${tok.term.urls[0]}]]`;
          }
          return tok.text;
        })
        .join('');
    })
    .join('');
  return { text: newZhs, added };
}

// Handles one passage or annotation (`target`, which carries .vern) whose
// classical text is origZhs / origZht. `loc` = { file, passage, annotation? }
// for the report.
//
// A multi-paragraph annotation (paragraphs split by a blank line, same as
// the page does) is matched paragraph by paragraph when the vernacular has
// the same number of paragraphs — the same condition under which the 白話
// view can pair them up. If the counts differ, the whole text is matched
// as one unit and that's flagged.
function processVern(target, origZhs, origZht, loc, report) {
  const vern = target.vern;
  if (!vern || typeof vern.zhs !== 'string' || !vern.zhs.trim()) return;

  const stats = report.vern;
  const flag = (para) => (kind, extra) => stats.flags.push({ ...loc, para, kind, ...extra });
  stats.items++;

  origZhs = origZhs ?? '';
  let newZhs = vern.zhs;

  if (!loc.annotation && Object.hasOwn(SKIP_VERN_LINKING, loc.passage)) {
    // Hand-reviewed passage: leave vern.zhs (and its links) exactly as it is.
    stats.skipped.push(loc.passage);
  } else {
    const bare = countBareTags(origZhs);
    if (bare > 0) flag(null)('bareInOrig', { count: bare });

    const origParas = origZhs.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const pieces = vern.zhs.split(/(\n\s*\n)/); // text, separator, text, ...
    const textIdx = pieces.map((s, i) => i).filter((i) => i % 2 === 0 && pieces[i].trim() !== '');
    const paired = origParas.length > 1 && origParas.length === textIdx.length;
    if (origParas.length > 1 && !paired) {
      flag(null)('paraMismatch', { orig: origParas.length, vern: textIdx.length });
    }

    if (paired) {
      textIdx.forEach((pi, k) => {
        const r = linkVernUnit(origParas[k], pieces[pi], flag(k + 1));
        pieces[pi] = r.text;
        stats.tagsAdded += r.added;
      });
      newZhs = pieces.join('');
    } else {
      const r = linkVernUnit(origZhs, vern.zhs, flag(null));
      stats.tagsAdded += r.added;
      newZhs = r.text;
    }
    vern.zhs = newZhs;
  }

  const newZht = convertVernToTraditional(newZhs, buildZhtUrlMap(origZhs, origZht ?? ''));
  if (newZht !== vern.zht) stats.zhtUpdated++;
  vern.zht = newZht;
}

function processChapterFile(filePath, sources, report) {
  const data = readJson(filePath);
  let changed = false;
  const fileName = path.basename(filePath);

  if (Array.isArray(data.passages)) {
    const ensured = data.passages.map(ensureVernDeep);
    if (ensured.some((q, i) => q !== data.passages[i])) {
      data.passages = ensured;
      changed = true;
    }
  }

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

    // After the original's own tags are resolved, so their URLs exist to copy.
    processVern(p, p.orig?.zhs, p.orig?.zht, { file: fileName, passage: p.id }, report);

    (p.annotations ?? []).forEach((a, ai) => {
      const annResolved = resolveGroup(
        { zht: a.zht, zhs: a.zhs, en: a.en },
        sources, report,
        { file: fileName, passage: p.id, annotation: true }
      );
      if (a.zht !== undefined) a.zht = annResolved.zht;
      if (a.zhs !== undefined) a.zhs = annResolved.zhs;
      if (a.en !== undefined) a.en = annResolved.en;

      processVern(a, a.zhs, a.zht, { file: fileName, passage: p.id, annotation: ai + 1 }, report);
    });

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

  // Vernacular (白話) term-linking flags, grouped per passage.
  const vernGroups = {};
  for (const f of report.vern.flags) {
    const where = f.annotation ? ` annotation #${f.annotation}` : '';
    (vernGroups[`${f.file} / ${f.passage}${where} [vern]`] ||= []).push(f);
  }
  const vernLine = {
    linkedAll: (f) => `⚠ "${f.label}" — original has ${f.orig}, vernacular has ${f.vern}: linked all ${f.vern}, please check`,
    notLinked: (f) => `⚠ "${f.label}" (1 character) — original has ${f.orig}, vernacular has ${f.vern}: NOT linked, please check`,
    absent: (f) => `✗ "${f.label}" — original has ${f.orig}, not found in vernacular`,
    multiUrl: (f) => `⚠ "${f.label}" — original links it to ${f.urls.length} different targets, used the first: ${f.urls[0]}`,
    bareInOrig: (f) => `⚠ original still has ${f.count} unresolved bare [[...]] tag(s) — those were not copied`,
    paraMismatch: (f) => `⚠ original has ${f.orig} paragraphs, vernacular has ${f.vern} — matched on the whole text, and the 白話 view can't pair them paragraph by paragraph`,
  };
  for (const [key, flags] of Object.entries(vernGroups)) {
    lines.push(`\n${key}:`);
    for (const f of flags) lines.push(`  ${f.para ? `[¶${f.para}] ` : ''}${vernLine[f.kind](f)}`);
  }

  const v = report.vern;
  const summary =
    `\nSummary: ${report.filled.length} auto-filled, ${report.ambiguous.length} ambiguous, ${report.unresolved.length} unresolved, ${report.conflict.length} conflicts, ${report.countMismatch.length} count mismatches.\n` +
    `Vernacular: ${v.items} passage/annotation text(s) with vern, ${v.tagsAdded} term link(s) added, ${v.zhtUpdated} vern.zht updated, ${v.flags.length} item(s) to check.\n` +
    (v.skipped.length
      ? `Vernacular linking skipped for ${v.skipped.length} hand-reviewed passage(s) (SKIP_VERN_LINKING): ${v.skipped.join(', ')}\n`
      : '');
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

  const report = {
    filled: [], ambiguous: [], unresolved: [], conflict: [], countMismatch: [],
    vern: { items: 0, tagsAdded: 0, zhtUpdated: 0, flags: [], skipped: [] },
  };
  for (const file of files) {
    processChapterFile(path.join(SGZ_DIR, file), sources, report);
  }

  printReport(report);
}

main();
