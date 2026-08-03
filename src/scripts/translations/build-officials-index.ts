// build-officials-index.ts
// Shared extraction logic: walks every category JSON file and produces a
// flat, searchable array of every position. Used by both officials.astro
// (for the dropdown) and the dedicated search results page, so the two
// never drift out of sync with each other.

import centralCourtData from '../../data/officials/central-court-database.json';
import excellenciesData from '../../data/officials/excellencies-database.json';
import militaryData from '../../data/officials/military-officials-database.json';
import provinceData from '../../data/officials/provincial-officials-database.json';
import palaceData from '../../data/officials/rear-eastern-palace-database.json';

// Map each loaded JSON file to the category page it belongs to.
// 'nobility' has no backing file yet (WIP) — omitted, so it's silently
// skipped rather than erroring.
const fileMap: Record<string, any> = {
  departments: centralCourtData,
  ministers:   excellenciesData,
  military:    militaryData,
  regional:    provinceData,
  household:   palaceData,
};

export const categoryPageLabels: Record<string, { en: string; zht: string; zhs: string }> = {
  departments: { en: 'Departments',             zht: '臺省', zhs: '台省' },
  ministers:   { en: 'Excellencies & Ministers', zht: '公卿', zhs: '公卿' },
  military:    { en: 'Military',         zht: '武官', zhs: '武官' },
  regional:    { en: 'Regional Administration',  zht: '地方', zhs: '地方' },
  household:   { en: 'Imperial Household',       zht: '東/后宮', zhs: '東/后宮' },
};

function stripHtml(str: string | undefined | null): string {
  return (str ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

function firstName(pos: any, key: 'en' | 'zht' | 'zhs'): string {
  const all = [...(pos.name?.wei ?? []), ...(pos.name?.shu ?? []), ...(pos.name?.wu ?? [])];
  for (const n of all) {
    const val = stripHtml(n?.[key] ?? n?.en);
    if (val && val !== '?' && val !== '-') return val;
  }
  return stripHtml(pos.displayName?.[key] ?? pos.displayName?.en ?? '');
}

// Like firstName(), but collects EVERY name variant across Wei/Shu/Wu as a
// full { en, zht, zhs } PAIR, instead of stopping at the first one found
// and instead of flattening each language into its own separate list.
// Keeping the pair intact matters for search: if a query matches this
// variant's zht text, the correct corresponding en/zhs text (from the
// SAME variant) needs to be shown alongside it — not some other variant's
// default name, which could be a completely different historical name.
function namePairs(pos: any): { en: string; zht: string; zhs: string; kingdoms: string[] }[] {
  const sources: [string, any[]][] = [
    ['wei', pos.name?.wei ?? []],
    ['shu', pos.name?.shu ?? []],
    ['wu', pos.name?.wu ?? []],
  ];
  const pairs: { en: string; zht: string; zhs: string; kingdoms: string[] }[] = [];
  const indexByKey = new Map<string, number>();

  for (const [kingdom, arr] of sources) {
    for (const n of arr) {
      const en = stripHtml(n?.en);
      const zht = stripHtml(n?.zht ?? n?.en);
      const zhs = stripHtml(n?.zhs ?? n?.en);
      if (!en || en === '?' || en === '-') continue;
      const key = `${en}|${zht}|${zhs}`;
      if (indexByKey.has(key)) {
        // Same exact name text also appears under another kingdom (common
        // for titles that didn't change between kingdoms) — same pair,
        // just add this kingdom to it rather than duplicating the row.
        const existing = pairs[indexByKey.get(key)!];
        if (!existing.kingdoms.includes(kingdom)) existing.kingdoms.push(kingdom);
      } else {
        indexByKey.set(key, pairs.length);
        pairs.push({ en, zht, zhs, kingdoms: [kingdom] });
      }
    }
  }

  if (pairs.length === 0) {
    const en = stripHtml(pos.displayName?.en ?? '');
    if (en) {
      pairs.push({
        en,
        zht: stripHtml(pos.displayName?.zht ?? en),
        zhs: stripHtml(pos.displayName?.zhs ?? en),
        // No per-kingdom name data to attribute this to specifically —
        // fall back to the position's full existence list.
        kingdoms: kingdomsFor(pos),
      });
    }
  }

  return pairs;
}

function displayNameOnly(pos: any, key: 'en' | 'zht' | 'zhs'): string {
  return stripHtml(pos.displayName?.[key] ?? pos.displayName?.en ?? '');
}

function firstDesc(pos: any, key: 'en' | 'zht' | 'zhs'): string {
  const jobArr = pos.jobscope?.[key] ?? pos.jobscope?.en ?? [];
  return jobArr.length ? stripHtml(jobArr[0]) : '';
}

function firstRank(pos: any, key: 'en' | 'zht' | 'zhs'): string {
  const arr = pos.rank?.[key] ?? pos.rank?.en ?? [];
  return arr.length ? stripHtml(arr[0]) : '';
}

function kingdomsFor(pos: any): string[] {
  const kingdoms: string[] = [];
  const existsInKingdom = (arr: any[]) => {
    if (!arr || arr.length === 0) return false;
    return arr.some(n => {
      const val = n?.en;
      // null/undefined or "-" means the position didn't exist in this kingdom
      return val !== null && val !== undefined && val !== '-';
    });
  };
  if (existsInKingdom(pos.name?.wei)) kingdoms.push('wei');
  if (existsInKingdom(pos.name?.shu)) kingdoms.push('shu');
  if (existsInKingdom(pos.name?.wu)) kingdoms.push('wu');
  return kingdoms;
}

export function buildAllPositions(): any[] {
  const allPositions: any[] = [];

  function withHierarchy(positions: any[]): any[] {
    let lastDignitary: any = null;
    let lastSecondary: any = null;
    const out: any[] = [];

    for (const pos of positions) {
      let superiors: any[] = [];

      if (pos.tier === 'dignitary') {
        lastDignitary = pos;
        lastSecondary = null;
      } else if (pos.tier === 'secondary') {
        if (lastDignitary) superiors = [lastDignitary];
        lastSecondary = pos;
      } else if (pos.tier === 'minor') {
        if (lastSecondary) {
          superiors = lastDignitary ? [lastDignitary, lastSecondary] : [lastSecondary];
        } else if (lastDignitary) {
          superiors = [lastDignitary];
        }
      }

      out.push({ pos, superiors });
    }

    return out;
  }

  for (const [pageId, pageData] of Object.entries(fileMap)) {
    for (const cat of pageData.categories ?? []) {
      // Hierarchy is tracked per section, and separately for any positions
      // sitting directly under the category (no section) — these are
      // distinct "nearest preceding" chains, matching the JSON's own nesting.
      const groups: any[] = [];
      for (const section of cat.sections ?? []) {
        groups.push(...withHierarchy(section.positions ?? []));
      }
      groups.push(...withHierarchy(cat.positions ?? []));

      for (const { pos, superiors } of groups) {
        allPositions.push({
          id: pos.id,
          nameEn:  firstName(pos, 'en'),
          nameZht: firstName(pos, 'zht'),
          nameZhs: firstName(pos, 'zhs'),
          // Every name VARIANT (as an en/zht/zhs pair, kept together) —
          // nameEn/nameZht/nameZhs above stay as the single default
          // display name; this is what search actually matches against,
          // so a match returns the correct corresponding pair, not a
          // mismatched combination of one variant's language and
          // another's.
          namePairs: namePairs(pos),
          gradeNum: pos.gradeNum ?? null,
          tier: pos.tier ?? null,
          superiors: superiors.map((s: any) => ({
            nameEn:  displayNameOnly(s, 'en'),
            nameZht: displayNameOnly(s, 'zht'),
            nameZhs: displayNameOnly(s, 'zhs'),
          })),
          category: pageId,
          categoryLabel: categoryPageLabels[pageId] ?? { en: pageId, zht: pageId, zhs: pageId },
          rank: {
            en:  firstRank(pos, 'en'),
            zht: firstRank(pos, 'zht'),
            zhs: firstRank(pos, 'zhs'),
          },
          desc: {
            en:  firstDesc(pos, 'en'),
            zht: firstDesc(pos, 'zht'),
            zhs: firstDesc(pos, 'zhs'),
          },
          url: `/translations/officials/${pageId}#${pos.id}`,
          kingdoms: kingdomsFor(pos)
        });
      }
    }
  }

  return allPositions;
}