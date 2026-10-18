// sgzPersonIndex.ts
// Build-time person index for the Sanguozhi cover's "Find a person" search.
// One entry per person: their names (incl. courtesy name and aliases from
// src/data/persons.json), the chapter(s) that are their own biography, and
// the other chapters that name them in their relationships data.
// Server-only (pulls in opencc-js) — the client side is sgzPersonSearch.ts.

import * as OpenCC from 'opencc-js';
import persons from '../../data/persons.json';

type Tri = { zht: string; zhs: string; en: string };
export type PersonHit = {
  name: Tri;
  courtesy: Tri | null;
  aliases: { zht: string; zhs: string }[];
  bios: string[];      // chapter ids where this person is a subject
  mentions: string[];  // other chapter ids that name them
};
export type ChapterLink = { zht: string; zhs: string; en: string };  // short label per chapter

const toZhs = OpenCC.Converter({ from: 'tw', to: 'cn' });
const registry = persons as Record<string, any>;

// "任峻（伯達）" -> { name: "任峻", courtesy: "伯達" }
function splitNode(node: string) {
  const m = node.match(/^(.*?)（(.*)）$/);
  return m ? { name: m[1], courtesy: m[2] } : { name: node, courtesy: null };
}

// registry lookups: by key, by bare zht name, by alias, by English name
const byZhtName = new Map<string, string>();
const byAlias = new Map<string, string>();
const byEnName = new Map<string, string[]>();
for (const [key, p] of Object.entries(registry)) {
  if (!byZhtName.has(p.name.zht)) byZhtName.set(p.name.zht, key);
  for (const a of p.aliases ?? []) byAlias.set(a, key);
  const list = byEnName.get(p.name.en) ?? [];
  list.push(key);
  byEnName.set(p.name.en, list);
}

function resolveNode(node: string): string {
  if (registry[node]) return node;
  const { name } = splitNode(node);
  // unregistered: key by the bare name so "夏侯惇" and "夏侯惇（元讓）" merge
  return byZhtName.get(name) ?? byAlias.get(name) ?? byAlias.get(node) ?? `~${name}`;
}

// Chapter subjects, read from the labels:
//   en  "Biography of Du Shu, son of Du Ji · with Meng Kang, Yue Xiang"
//   zht "杜畿子恕傳 · 附孟康、樂詳"
function labelSubjects(ch: any): { en: string; zht: string | null }[] {
  const [enMain, enWith] = (ch.label.en ?? '').replace(/^Biography of /, '').split(' · with ');
  const en = [enMain.replace(/, son of .*$/, ''), ...(enWith ? enWith.split(/,\s*(?:and\s+)?|\s+and\s+/) : [])]
    .map((s: string) => s.trim()).filter(Boolean);
  const [zhMain, zhWith] = (ch.label.zht ?? '').split(' · ');
  const zh = [zhMain.replace(/傳$/, ''), ...(zhWith ? zhWith.replace(/^附/, '').split('、') : [])];
  return en.map((n, i) => ({ en: n, zht: zh.length === en.length ? zh[i] : null }));
}

export function shortChapterLabel(ch: any): ChapterLink {
  const enMain = (ch.label.en ?? '').replace(/^Biography of /, '').split(' · ')[0].replace(/, son of .*$/, '');
  return { zht: ch.label.zht.split(' · ')[0], zhs: ch.label.zhs.split(' · ')[0], en: enMain };
}

export function buildPersonIndex(chapters: any[]): { people: PersonHit[]; chapterLinks: Record<string, ChapterLink> } {
  const people = new Map<string, PersonHit>();
  const chapterLinks: Record<string, ChapterLink> = {};

  function entry(key: string, fallback?: { zht: string; en: string; courtesy?: string | null }): PersonHit {
    let hit = people.get(key);
    if (hit) return hit;
    const p = registry[key];
    if (p) {
      hit = {
        name: { zht: p.name.zht, zhs: p.name.zhs ?? toZhs(p.name.zht), en: p.name.en ?? '' },
        courtesy: p.courtesyName ? { zht: p.courtesyName.zht, zhs: p.courtesyName.zhs ?? toZhs(p.courtesyName.zht), en: p.courtesyName.en ?? '' } : null,
        aliases: (p.aliases ?? []).map((a: string) => ({ zht: a, zhs: toZhs(a) })),
        bios: [], mentions: [],
      };
    } else {
      // not in the registry yet (e.g. newer chapters) — Chinese name only
      const zht = fallback?.zht ?? key.replace(/^~/, '');
      const c = fallback?.courtesy ?? null;
      hit = {
        name: { zht, zhs: toZhs(zht), en: fallback?.en ?? '' },
        courtesy: c ? { zht: c, zhs: toZhs(c), en: '' } : null,
        aliases: [], bios: [], mentions: [],
      };
    }
    people.set(key, hit);
    return hit;
  }

  for (const ch of chapters) {
    if (!ch.passages?.length || ch.kind === 'appraisal') continue;
    chapterLinks[ch.id] = shortChapterLabel(ch);

    const nodes = [...new Set<string>((ch.relationships ?? []).flatMap((r: any) => [r.from, r.to]))];
    const nodeKeys = new Map(nodes.map(n => [n, resolveNode(n)]));

    const subjectKeys = new Set<string>();
    for (const s of labelSubjects(ch)) {
      // prefer someone this chapter actually names, then anyone in the registry
      const candidates = byEnName.get(s.en) ?? [];
      let key = candidates.find(k => [...nodeKeys.values()].includes(k)) ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!key && s.zht) key = resolveNode(s.zht);
      if (!key) continue;
      subjectKeys.add(key);
      const hit = entry(key, { zht: s.zht ?? s.en, en: s.en });
      if (!hit.name.en) hit.name.en = s.en;
      if (!hit.bios.includes(ch.id)) hit.bios.push(ch.id);
    }

    for (const [node, key] of nodeKeys) {
      if (subjectKeys.has(key)) continue;
      const { name, courtesy } = splitNode(node);
      const hit = entry(key, { zht: name, en: '', courtesy });
      if (!hit.mentions.includes(ch.id)) hit.mentions.push(ch.id);
    }
  }

  // drop "mentioned in" chapters that are already their biography
  for (const hit of people.values()) hit.mentions = hit.mentions.filter(id => !hit.bios.includes(id));
  return { people: [...people.values()], chapterLinks };
}
