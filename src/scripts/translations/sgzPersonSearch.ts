// sgzPersonSearch.ts
// Client side of the Sanguozhi cover's "Find a person" search: matching and
// result rendering over the index built by sgzPersonIndex.ts. Shared by the
// EN, ZH-HANT and ZH-HANS cover pages.

import type { PersonHit, ChapterLink } from './sgzPersonIndex';

type Lang = 'en' | 'zht' | 'zhs';

const STR = {
  en:  { courtesy: 'courtesy name', mentioned: 'Mentioned in', bio: 'Biography', empty: 'No matches.' },
  zht: { courtesy: '字', mentioned: '見於', bio: '本傳', empty: '查無結果。' },
  zhs: { courtesy: '字', mentioned: '见于', bio: '本传', empty: '没有符合的结果。' },
};

// lower-case, strip tone marks/diacritics (Lü -> lu) and spaces
function norm(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '');
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// 0 = exact name, 1 = name prefix, 2 = name contains, 3 = courtesy/alias; -1 = no match
function score(p: PersonHit, raw: string, q: string): number {
  const names = [p.name.zht, p.name.zhs, norm(p.name.en)];
  if (names.some(n => n && (n === raw || n === q))) return 0;
  if (names.some(n => n && (n.startsWith(raw) || n.startsWith(q)))) return 1;
  if (names.some(n => n && (n.includes(raw) || n.includes(q)))) return 2;
  const others = [
    p.courtesy?.zht, p.courtesy?.zhs, norm(p.courtesy?.en ?? ''),
    ...p.aliases.flatMap(a => [a.zht, a.zhs]),
  ];
  if (others.some(n => n && (n.includes(raw) || n.includes(q)))) return 3;
  return -1;
}

export function searchPeople(people: PersonHit[], input: string, limit = 40): PersonHit[] {
  const raw = input.trim();
  const q = norm(raw);
  if (!q) return [];
  return people
    .map(p => ({ p, s: score(p, raw, q) }))
    .filter(x => x.s >= 0)
    // best match first; then people with their own biography; then most-mentioned
    .sort((a, b) => a.s - b.s
      || Number(b.p.bios.length > 0) - Number(a.p.bios.length > 0)
      || b.p.mentions.length - a.p.mentions.length)
    .slice(0, limit)
    .map(x => x.p);
}

export function renderPeople(hits: PersonHit[], lang: Lang, chapterLinks: Record<string, ChapterLink>, baseUrl: string): string {
  const s = STR[lang];
  if (!hits.length) return `<div class="person-search-empty">${s.empty}</div>`;
  const zhKey = lang === 'zhs' ? 'zhs' : 'zht';
  const langAttr = lang === 'zhs' ? 'zh-hans' : 'zh-hant';
  const link = (id: string, cls: string, text: string) =>
    `<a href="${baseUrl}/${id}" class="${cls}" data-sgz-link data-chapter="${id}"${lang === 'en' ? '' : ` lang="${langAttr}"`}>${esc(text)}</a>`;
  const chapterName = (id: string) => (lang === 'en' ? chapterLinks[id]?.en : chapterLinks[id]?.[zhKey]) ?? id;

  return hits.map(p => {
    const zh = p.name[zhKey];
    const primary = lang === 'en' ? (p.name.en || zh) : zh;
    const secondary = lang === 'en' ? (p.name.en ? zh : '') : p.name.en;
    const cz = p.courtesy
      ? `<span class="ph-cz">${s.courtesy} ${lang === 'en'
          ? `${esc(p.courtesy.en)}${p.courtesy.en ? ' ' : ''}<span lang="${langAttr}">${esc(p.courtesy[zhKey])}</span>`
          : `<span lang="${langAttr}">${esc(p.courtesy[zhKey])}</span>`}</span>`
      : '';
    const bios = p.bios.map(id => link(id, 'ph-bio', `${s.bio} · ${chapterName(id)}`)).join('');
    const mentions = p.mentions.length
      ? `<div class="ph-mentions"><span class="ph-mentions-label">${s.mentioned}</span>${p.mentions.map(id => link(id, 'ph-chip', chapterName(id))).join('')}</div>`
      : '';
    return `
      <div class="person-hit">
        <div class="ph-top">
          <span class="${lang === 'en' ? 'ph-name' : 'ph-name ph-name-zh'}"${lang === 'en' ? '' : ` lang="${langAttr}"`}>${esc(primary)}</span>
          ${secondary ? `<span class="${lang === 'en' ? 'ph-alt ph-alt-zh' : 'ph-alt'}"${lang === 'en' ? ` lang="${langAttr}"` : ''}>${esc(secondary)}</span>` : ''}
          ${cz}
        </div>
        ${bios || mentions ? `<div class="ph-links">${bios}${mentions}</div>` : ''}
      </div>`;
  }).join('');
}
