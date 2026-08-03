// search-module.js
// Site-wide officials search for officials.astro — a "google search" style
// typeahead: dropdown with top N results, full results page on Enter/submit.
// Scoped specifically to this page; the per-category list page (categories.astro)
// has its own separate filter-the-visible-list search and does not use this.

const DROPDOWN_LIMIT = 6;

// Below these lengths, the query is too short to narrow results meaningfully —
// warn rather than silently showing a huge or empty-feeling result set.
// OR logic: either condition alone is enough to trigger the warning.
const ZH_MIN_CHARS = 2;   // warn if Chinese query has fewer than this many characters
const EN_MIN_CHARS = 4;   // warn if Latin query has fewer than this many characters

import { url } from '../../utils/url';

function isCJK(str) {
  return /[\u3400-\u9FFF]/.test(str);
}

const warningStrings = {
  en: {
    singleChar: 'Single-character searches may return many results. Try a more specific term.',
    short:      'Short searches may return many results. Try a more specific term.',
  },
  zht: {
    singleChar: '當前為單字檢索，或無法精準匹配，建議使用更具體的關鍵詞。',
    short:      '當前檢索較短，或無法精準匹配，建議使用更具體的關鍵詞。',
  },
  zhs: {
    singleChar: '当前为单字检索，或无法精准匹配，建议使用更具体的关键词。',
    short:      '当前检索较短，或无法精准匹配，建议使用更具体的关键词。',
  },
};

function getQueryWarning(query, langKey = 'en') {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const cjkCount = (trimmed.match(/[\u3400-\u9FFF]/g) || []).length;
  const latinCount = trimmed.replace(/[^a-zA-Z]/g, '').length;
  const ws = warningStrings[langKey] ?? warningStrings.en;

  if (isCJK(trimmed) && cjkCount < ZH_MIN_CHARS) {
    return ws.singleChar;
  }
  if (!isCJK(trimmed) && latinCount > 0 && latinCount < EN_MIN_CHARS) {
    return ws.short;
  }
  return null;
}

function pairMatches(pair, query, q) {
  const enMatch = (pair.en || '').toLowerCase().includes(q);
  const zhtMatch = (pair.zht || '').includes(query);
  const zhsMatch = (pair.zhs || '').includes(query);
  return enMatch || zhtMatch || zhsMatch;
}

// Returns every name pair on this position whose en/zht/zhs text contains
// the query — a position can have several distinct historical/kingdom
// names, and each one that matches should surface as its own result
// (with its correct en+zh shown together), not get collapsed into one row
// showing only the default display name.
function getMatchingPairs(pos, query) {
  const q = query.toLowerCase();
  const pairs = pos.namePairs?.length ? pos.namePairs : [{ en: pos.nameEn, zht: pos.nameZht, zhs: pos.nameZhs }];
  return pairs.filter(p => pairMatches(p, query, q));
}

function matchesBody(pos, query, q) {
  const descObj = pos.desc || {};
  const descMatch = [descObj.en, descObj.zht, descObj.zhs]
    .filter(Boolean)
    .some(d => d.toLowerCase().includes(q) || d.includes(query));
  const cat = pos.categoryLabel || {};
  const catMatch = [cat.en, cat.zht, cat.zhs]
    .filter(Boolean)
    .some(label => label.toLowerCase().includes(q) || label.includes(query));
  const rankObj = pos.rank || {};
  const rankMatch = [rankObj.en, rankObj.zht, rankObj.zhs]
    .filter(Boolean)
    .some(r => r.toLowerCase().includes(q) || r.includes(query));
  return descMatch || catMatch || rankMatch;
}

// Returns one entry per MATCHED NAME PAIR (not one per position) — a
// position matching via two different historical names produces two
// separate results, each carrying that specific pair's en+zh text so
// they always display correctly together. Positions matching only via
// description/category/rank (no name match) still produce a single
// result using the default display name, since there's no specific
// name variant to attribute the match to.
export function searchPositions(allPositions, query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const q = trimmed.toLowerCase();

  const results = [];
  for (const pos of allPositions) {
    const matchingPairs = getMatchingPairs(pos, trimmed);
    if (matchingPairs.length > 0) {
      for (const pair of matchingPairs) {
        results.push({ priority: 1, pos, pair });
      }
    } else if (matchesBody(pos, trimmed, q)) {
      results.push({ priority: 2, pos, pair: null });
    }
  }

  return results
    .sort((a, b) => a.priority - b.priority)
    .map(r => (r.pair ? { ...r.pos, _matchedPair: r.pair } : r.pos));
}

function getLangKey(lang) {
  if (lang === 'zh-hant') return 'zht';
  if (lang === 'zh-hans') return 'zhs';
  return 'en';
}

function catLabelFor(pos, langKey) {
  const cat = pos.categoryLabel || {};
  return cat[langKey] ?? cat.en ?? '';
}

// If this result carries a specific matched name pair, always read BOTH
// the primary and secondary text from that SAME pair — guarantees the
// en/zh shown together are the correct corresponding pair, never a
// mismatched combination of one variant's language and another's default.
function nameFor(pos, langKey) {
  if (pos._matchedPair) return pos._matchedPair[langKey] || pos._matchedPair.en || '';
  if (langKey === 'zht') return pos.nameZht || pos.nameEn || '';
  if (langKey === 'zhs') return pos.nameZhs || pos.nameEn || '';
  return pos.nameEn || '';
}

function altNameFor(pos, langKey) {
  const altLangKey = langKey === 'en' ? 'zht' : 'en';
  if (pos._matchedPair) return pos._matchedPair[altLangKey] || '';
  if (langKey === 'en') return pos.nameZht || '';
  return pos.nameEn || '';
}

const dropdownStrings = {
  en:      { empty: 'No positions found',      seeAll: n => `See all ${n} results →` },
  'zh-hant': { empty: '未找到官職',              seeAll: n => `查看全部 ${n} 條 →` },
  'zh-hans': { empty: '未找到官职',              seeAll: n => `查看全部 ${n} 条 →` },
};

function dropdownStringsFor(langKey) {
  if (langKey === 'zht') return dropdownStrings['zh-hant'];
  if (langKey === 'zhs') return dropdownStrings['zh-hans'];
  return dropdownStrings.en;
}

export function initSearch({ allPositions, categories, lang = 'en', onShowResults, onClearResults }) {
  const langKey = getLangKey(lang);
  const searchInput   = document.getElementById('search-input');
  const searchClear   = document.getElementById('search-clear');
  const dropdown       = document.getElementById('search-dropdown');
  const dropdownList   = document.getElementById('search-dropdown-list');
  const dropdownWarn   = document.getElementById('search-dropdown-warning');
  const dropdownMore   = document.getElementById('search-dropdown-more');

  let activeQuery = '';

  function renderDropdownItem(pos) {
    const a = document.createElement('a');
    a.href = url(pos.url);
    a.className = 'dropdown-item';
    const gradeBadge = pos.gradeNum
      ? `<span class="dropdown-item-grade">${pos.gradeNum}</span>`
      : `<span class="dropdown-item-grade dropdown-item-grade-empty">?</span>`;
    a.innerHTML = `
      ${gradeBadge}
      <div class="dropdown-item-main">
        <span class="dropdown-item-name">${nameFor(pos, langKey)}</span>
        <span class="dropdown-item-zh">${altNameFor(pos, langKey)}</span>
      </div>
      <span class="dropdown-item-cat">${catLabelFor(pos, langKey)}</span>
    `;
    return a;
  }

  function showDropdown(query) {
    const ds = dropdownStringsFor(langKey);
    const warning = getQueryWarning(query, langKey);
    dropdownWarn.textContent = warning || '';
    dropdownWarn.style.display = warning ? 'block' : 'none';

    const results = searchPositions(allPositions, query);
    dropdownList.innerHTML = '';

    if (results.length === 0) {
      dropdown.style.display = 'block';
      dropdownList.innerHTML = `<div class="dropdown-empty">${ds.empty}</div>`;
      dropdownMore.style.display = 'none';
      return;
    }

    const top = results.slice(0, DROPDOWN_LIMIT);
    top.forEach(pos => dropdownList.appendChild(renderDropdownItem(pos)));

    if (results.length > DROPDOWN_LIMIT) {
      dropdownMore.style.display = 'block';
      dropdownMore.textContent = ds.seeAll(results.length);
    } else {
      dropdownMore.style.display = 'none';
    }

    dropdown.style.display = 'block';
  }

  function hideDropdown() {
    dropdown.style.display = 'none';
  }

  searchInput.addEventListener('input', e => {
    activeQuery = e.target.value;
    searchClear.style.display = activeQuery ? 'block' : 'none';
    if (!activeQuery.trim()) {
      hideDropdown();
      onClearResults();
      return;
    }
    showDropdown(activeQuery);
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      hideDropdown();
      if (activeQuery.trim()) onShowResults(activeQuery, searchPositions(allPositions, activeQuery));
    }
    if (e.key === 'Escape') hideDropdown();
  });

  dropdownMore.addEventListener('click', () => {
    hideDropdown();
    onShowResults(activeQuery, searchPositions(allPositions, activeQuery));
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    activeQuery = '';
    searchClear.style.display = 'none';
    hideDropdown();
    onClearResults();
    searchInput.focus();
  });

  // close dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box') && !e.target.closest('#search-dropdown')) {
      hideDropdown();
    }
  });

  return { searchPositions, getQueryWarning };
}