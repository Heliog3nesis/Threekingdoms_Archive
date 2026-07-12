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

// priority: 1 = name match (en/zht/zhs), 2 = body match (desc/category), 0 = no match
function getMatchPriority(pos, query) {
  const q = query.toLowerCase();
  const nameEn  = (pos.nameEn  || '').toLowerCase();
  const nameZht = pos.nameZht || '';
  const nameZhs = pos.nameZhs || '';
  if (nameEn.includes(q) || nameZht.includes(query) || nameZhs.includes(query)) return 1;

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
  if (descMatch || catMatch || rankMatch) return 2;

  return 0;
}

export function searchPositions(allPositions, query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return allPositions
    .map(pos => ({ pos, priority: getMatchPriority(pos, trimmed) }))
    .filter(r => r.priority > 0)
    .sort((a, b) => a.priority - b.priority)
    .map(r => r.pos);
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

function nameFor(pos, langKey) {
  if (langKey === 'zht') return pos.nameZht || pos.nameEn || '';
  if (langKey === 'zhs') return pos.nameZhs || pos.nameEn || '';
  return pos.nameEn || '';
}

function altNameFor(pos, langKey) {
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