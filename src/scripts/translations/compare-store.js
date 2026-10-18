// compare-store.js
// The officials picked for comparison, shared by every page that can add to
// it (category detail panel, search results, officials home) and by the
// compare page itself. Kept in localStorage so picks survive navigation;
// a 'compare-change' event on window tells every widget to refresh.

import './compare-entry.css';

export const COMPARE_MAX = 4;
const KEY = 'officials-compare';

export function getCompare() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter(id => typeof id === 'string').slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

export function setCompare(ids) {
  const clean = [...new Set(ids)].slice(0, COMPARE_MAX);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch {}
  window.dispatchEvent(new CustomEvent('compare-change', { detail: clean }));
  return clean;
}

export function inCompare(id) {
  return getCompare().includes(id);
}

// Returns 'added' | 'removed' | 'full'
export function toggleCompare(id) {
  const ids = getCompare();
  if (ids.includes(id)) { setCompare(ids.filter(x => x !== id)); return 'removed'; }
  if (ids.length >= COMPARE_MAX) return 'full';
  setCompare([...ids, id]);
  return 'added';
}

// other tabs changing the picks
window.addEventListener('storage', e => {
  if (e.key === KEY) window.dispatchEvent(new CustomEvent('compare-change', { detail: getCompare() }));
});

// ─── LABELS ──────────────────────────────────────────────────────────────────
const LABELS = {
  en: {
    add: 'Compare', added: 'In compare', compare: 'Compare',
    full: `Compare holds up to ${COMPARE_MAX} — remove one first`,
  },
  'zh-hant': {
    add: '比較', added: '已加入比較', compare: '比較',
    full: `最多比較 ${COMPARE_MAX} 項，請先移除一項`,
  },
  'zh-hans': {
    add: '比较', added: '已加入比较', compare: '比较',
    full: `最多比较 ${COMPARE_MAX} 项，请先移除一项`,
  },
};
export function compareLabels(lang) { return LABELS[lang] ?? LABELS.en; }

export function comparePageUrl(lang) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const prefix = lang === 'en' ? '' : `/${lang}`;
  return `${base}${prefix}/translations/officials/compare`;
}

// ─── WIDGETS ─────────────────────────────────────────────────────────────────
// Toggle button markup/state — callers render <button class="compare-toggle"
// data-compare-id="…"> and call syncToggle() on it (or on every one).
export function syncToggle(btn, lang) {
  const l = compareLabels(lang);
  const on = inCompare(btn.dataset.compareId);
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.innerHTML = on
    ? `<i class="ti ti-check" aria-hidden="true"></i><span>${l.added}</span>`
    : `<i class="ti ti-plus" aria-hidden="true"></i><span>${l.add}</span>`;
}

export function syncAllToggles(lang, root = document) {
  root.querySelectorAll('.compare-toggle[data-compare-id]').forEach(b => syncToggle(b, lang));
}

// Handles a click on any .compare-toggle under root (event delegation, so it
// keeps working for buttons rendered later, e.g. paginated search results).
export function wireToggles(lang, root = document) {
  root.addEventListener('click', e => {
    const btn = e.target.closest('.compare-toggle[data-compare-id]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(btn.dataset.compareId);
    if (result === 'full') flashFab(compareLabels(lang).full);
  });
  window.addEventListener('compare-change', () => syncAllToggles(lang, root));
  syncAllToggles(lang, root);
}

// Floating "Compare (n) →" pill — shown on pages where you collect picks.
let fabEl = null;
let fabTimer = null;
export function mountCompareFab(lang) {
  if (fabEl) return;
  fabEl = document.createElement('a');
  fabEl.className = 'compare-fab';
  fabEl.href = comparePageUrl(lang);
  document.body.appendChild(fabEl);
  const render = () => {
    const n = getCompare().length;
    fabEl.style.display = n ? 'flex' : 'none';
    fabEl.innerHTML = `<i class="ti ti-columns-3" aria-hidden="true"></i><span>${compareLabels(lang).compare} (${n})</span><i class="ti ti-arrow-right" aria-hidden="true"></i>`;
  };
  window.addEventListener('compare-change', render);
  render();
}

function flashFab(msg) {
  if (!fabEl) return;
  fabEl.style.display = 'flex';
  fabEl.dataset.msg = msg;
  fabEl.classList.add('compare-fab-warn');
  clearTimeout(fabTimer);
  fabTimer = setTimeout(() => fabEl.classList.remove('compare-fab-warn'), 2600);
}

// Live count in an element, e.g. the hub's Compare button.
export function bindCount(el) {
  const render = () => { const n = getCompare().length; el.textContent = n ? `(${n})` : ''; };
  window.addEventListener('compare-change', render);
  render();
}
