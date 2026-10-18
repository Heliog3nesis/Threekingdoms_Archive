// compare-module.js
// Browser-side logic for the officials compare page. Serves EN, ZH-HANT and
// ZH-HANS via data-lang on .site. Positions come from the shared compare
// store (or ?ids= in the URL, which wins so shared links work).

import { buildAllPositions, fileMap, categoryPageLabels } from './build-officials-index';
import { searchPositions } from './search-module.js';
import { splitRank } from './officials-rank.js';
import { COMPARE_MAX, getCompare, setCompare, compareLabels } from './compare-store.js';

const siteEl   = document.querySelector('.site');
const pageLang = siteEl.dataset.lang ?? 'en';
const langKey  = pageLang === 'zh-hant' ? 'zht' : pageLang === 'zh-hans' ? 'zhs' : 'en';
const altKey   = langKey === 'en' ? 'zht' : 'en';
const isZh     = langKey !== 'en';
const base     = import.meta.env.BASE_URL.replace(/\/$/, '');

const STR = {
  en: {
    hierarchy: 'Hierarchy', grade: 'Grade', salary: 'Salary & Headcount', names: 'Names',
    jobscope: 'Jobscope', notes: 'Notes', notIn: 'Not in this kingdom',
    noteCount: n => `${n} note${n === 1 ? '' : 's'}`, remove: 'Remove', open: 'Open entry',
    noResults: 'No positions found', alreadyIn: 'Added',
    k: { wei: 'Wei', shu: 'Shu', wu: 'Wu' },
  },
  zht: {
    hierarchy: '隸屬', grade: '品', salary: '秩員', names: '官名',
    jobscope: '職掌', notes: '注', notIn: '此國未設',
    noteCount: n => `${n} 條注`, remove: '移除', open: '查看條目',
    noResults: '未找到官職', alreadyIn: '已加入',
    k: { wei: '魏', shu: '蜀', wu: '吳' },
  },
  zhs: {
    hierarchy: '隶属', grade: '品', salary: '秩员', names: '官名',
    jobscope: '职掌', notes: '注', notIn: '此国未设',
    noteCount: n => `${n} 条注`, remove: '移除', open: '查看条目',
    noResults: '未找到官职', alreadyIn: '已加入',
    k: { wei: '魏', shu: '蜀', wu: '吴' },
  },
}[langKey];

// ─── DATA ────────────────────────────────────────────────────────────────────
const indexPositions = buildAllPositions();           // search + hierarchy chain
const indexById = new Map(indexPositions.map(p => [p.id, p]));
const rawById = new Map();                            // full record + its category
for (const [pageId, pageData] of Object.entries(fileMap)) {
  for (const cat of pageData.categories ?? []) {
    const all = [...(cat.sections ?? []).flatMap(s => s.positions ?? []), ...(cat.positions ?? [])];
    for (const pos of all) rawById.set(pos.id, { pos, pageId, cat });
  }
}

const pick = obj => (obj ? (obj[langKey] ?? obj.en ?? '') : '');
const pickAlt = obj => (obj ? (obj[altKey] ?? obj.en ?? '') : '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ─── STATE ───────────────────────────────────────────────────────────────────
let kingdom = 'wei';

function currentIds() { return getCompare().filter(id => rawById.has(id)); }

const urlIds = new URLSearchParams(location.search).get('ids');
if (urlIds) setCompare(urlIds.split(',').filter(id => rawById.has(id)));

function syncUrl(ids) {
  const u = new URL(location.href);
  if (ids.length) u.searchParams.set('ids', ids.join(','));
  else u.searchParams.delete('ids');
  history.replaceState(null, '', u);
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
const root = document.getElementById('cmp-root');
const emptyEl = document.getElementById('cmp-empty');

function entryUrl(pageId, id) {
  const prefix = pageLang === 'en' ? '' : `/${pageLang}`;
  return `${base}${prefix}/translations/officials/${pageId}#${id}`;
}

function headCell({ pos, pageId }) {
  const pageLabel = pick(categoryPageLabels[pageId]);
  return `
    <div class="cmp-cell cmp-head-cell">
      <div class="cmp-head-top">
        <a class="cmp-name${isZh ? ' zh' : ''}" href="${entryUrl(pageId, pos.id)}" title="${esc(STR.open)}">${esc(pick(pos.displayName))}</a>
        <button class="cmp-remove" type="button" data-remove="${pos.id}" aria-label="${esc(STR.remove)}"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div class="cmp-alt${isZh ? '' : ' zh'}">${esc(pickAlt(pos.displayName))}</div>
      <span class="cmp-chip">${esc(pageLabel)}</span>
    </div>`;
}

function hierarchyCell({ pos, pageId, cat }) {
  const idx = indexById.get(pos.id);
  const nameKey = langKey === 'zht' ? 'nameZht' : langKey === 'zhs' ? 'nameZhs' : 'nameEn';
  const supers = (idx?.superiors ?? []).map(s => s[nameKey] || s.nameEn);
  const catName = pick(cat.label);
  // military chains already start at the category
  if (supers[0] !== catName) supers.unshift(catName);
  const nodes = [pick(categoryPageLabels[pageId]), ...supers];
  return nodes.map(n => `<span class="cmp-bc-node">${esc(n)}</span>`).join('<span class="cmp-bc-sep">›</span>');
}

function gradeCell({ pos }) {
  const { gradeText } = splitRank(pos.rank ? (pos.rank[langKey] ?? pos.rank.en ?? []) : []);
  const g = pos.gradeNum;
  // rising meter: grade 9 (shortest) on the left to grade 1 (tallest) on the
  // right; a post lights every bar from 9 up to its own grade, so seniority
  // reads as how far up the staircase it reaches
  const bars = [9, 8, 7, 6, 5, 4, 3, 2, 1].map(step =>
    `<span class="cmp-grade-step${g && step >= g ? ' lit' : ''}${step === g ? ' top' : ''}" style="height:${6 + (9 - step) * 3}px"></span>`).join('');
  return `<div class="cmp-grade">
      <div class="cmp-grade-bar" aria-hidden="true">${bars}</div>
      <span class="cmp-grade-num">${g ?? '?'}</span>
    </div>
    <div class="cmp-grade-text">${esc(gradeText)}</div>`;
}

function salaryCell({ pos }) {
  const { salaryText } = splitRank(pos.rank ? (pos.rank[langKey] ?? pos.rank.en ?? []) : []);
  return salaryText || '?';   // already-escaped data with <br>/<em> markup
}

function namesCell({ pos }) {
  const names = pos.name?.[kingdom];
  if (!names) return `<span class="cmp-muted">${esc(STR.notIn)}</span>`;
  return names.map(n => `
    <div class="cmp-name-pair">
      <span class="cmp-name-main${isZh ? ' zh' : ''}">${pick(n) || '?'}</span>
      <span class="cmp-name-alt${isZh ? '' : ' zh'}">${pickAlt(n)}</span>
    </div>`).join('');
}

function jobscopeCell({ pos }) {
  const arr = pos.jobscope ? (pos.jobscope[langKey] ?? pos.jobscope.en ?? []) : [];
  return arr.length ? arr.map(p => `<p>${p}</p>`).join('') : '?';
}

function notesCell({ pos }) {
  const notes = pos.notes ?? [];
  if (!notes.length) return '<span class="cmp-muted">—</span>';
  return `<details class="cmp-notes"><summary>${esc(STR.noteCount(notes.length))}</summary>
    ${notes.map(n => `<p>· ${n[langKey] ?? n.en ?? ''}</p>`).join('')}</details>`;
}

function kingdomSwitch() {
  return `<div class="cmp-kingdoms" role="group" aria-label="${esc(STR.names)}">${
    ['wei', 'shu', 'wu'].map(k =>
      `<button type="button" class="pill pill-kingdom pill-kingdom-${k}${k === kingdom ? ' on' : ''}" data-kingdom="${k}" aria-pressed="${k === kingdom}">${k === kingdom ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}${STR.k[k]}</button>`
    ).join('')}</div>`;
}

const ROWS = [
  { key: 'hierarchy', label: () => STR.hierarchy, cell: hierarchyCell, cls: 'cmp-bc' },
  { key: 'grade',     label: () => STR.grade,     cell: gradeCell },
  { key: 'salary',    label: () => STR.salary,    cell: salaryCell },
  { key: 'names',     label: () => `${STR.names}${kingdomSwitch()}`, cell: namesCell, cls: 'cmp-names' },
  { key: 'jobscope',  label: () => STR.jobscope,  cell: jobscopeCell, cls: 'cmp-prose' },
  { key: 'notes',     label: () => STR.notes,     cell: notesCell, cls: 'cmp-prose' },
];

function render() {
  const ids = currentIds();
  syncUrl(ids);
  const items = ids.map(id => rawById.get(id));
  emptyEl.style.display = items.length ? 'none' : 'block';
  root.style.display = items.length ? 'block' : 'none';
  root.style.setProperty('--cmp-n', String(Math.max(items.length, 1)));
  if (!items.length) { root.innerHTML = ''; return; }

  root.innerHTML = `<div class="cmp-scroll">
    <div class="cmp-table${isZh ? ' cmp-zh' : ''}">
      <div class="cmp-row cmp-head">
        <div class="cmp-label"></div>
        ${items.map(headCell).join('')}
      </div>
      ${ROWS.map(r => `
        <div class="cmp-row" data-row="${r.key}">
          <div class="cmp-label">${r.label()}</div>
          ${items.map(it => `<div class="cmp-cell ${r.cls ?? ''}">${r.cell(it)}</div>`).join('')}
        </div>`).join('')}
    </div></div>`;
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────
root.addEventListener('click', e => {
  const rm = e.target.closest('[data-remove]');
  if (rm) { setCompare(getCompare().filter(id => id !== rm.dataset.remove)); return; }
  const kb = e.target.closest('[data-kingdom]');
  if (kb) { kingdom = kb.dataset.kingdom; render(); }
});

document.getElementById('cmp-clear').addEventListener('click', () => setCompare([]));

window.addEventListener('compare-change', render);

// pin the column headers just below the site's own sticky nav
function syncStickyTop() {
  const nav = document.querySelector('nav.nav');
  const sticky = nav && getComputedStyle(nav).position === 'sticky';
  root.style.setProperty('--cmp-sticky-top', `${sticky ? nav.getBoundingClientRect().height : 0}px`);
}
window.addEventListener('resize', syncStickyTop);
syncStickyTop();

// ─── PICKER ──────────────────────────────────────────────────────────────────
const input    = document.getElementById('cmp-input');
const dropdown = document.getElementById('cmp-dropdown');
const msgEl    = document.getElementById('cmp-msg');

function showMsg(text) {
  msgEl.textContent = text;
  msgEl.style.display = text ? 'block' : 'none';
}

function renderDropdown() {
  const q = input.value.trim();
  showMsg('');
  if (!q) { dropdown.style.display = 'none'; return; }
  const ids = getCompare();
  const seen = new Set();
  const results = searchPositions(indexPositions, q)
    .filter(p => !seen.has(p.id + (p._matchedPair?.en ?? '')) && seen.add(p.id + (p._matchedPair?.en ?? '')))
    .slice(0, 8);
  dropdown.innerHTML = results.length
    ? results.map(p => {
        const pair = p._matchedPair ?? { en: p.nameEn, zht: p.nameZht, zhs: p.nameZhs };
        const added = ids.includes(p.id);
        return `<button type="button" class="cmp-dd-item${added ? ' added' : ''}" data-add="${p.id}">
          <span class="cmp-dd-grade">${p.gradeNum ?? '?'}</span>
          <span class="cmp-dd-main"><span class="cmp-dd-name${isZh ? ' zh' : ''}">${esc(pair[langKey] || pair.en)}</span>
          <span class="cmp-dd-alt${isZh ? '' : ' zh'}">${esc(pair[altKey] || '')}</span></span>
          <span class="cmp-dd-cat">${added ? esc(STR.alreadyIn) : esc(pick(p.categoryLabel))}</span>
        </button>`;
      }).join('')
    : `<div class="cmp-dd-empty">${esc(STR.noResults)}</div>`;
  dropdown.style.display = 'block';
}

input.addEventListener('input', renderDropdown);
input.addEventListener('focus', renderDropdown);
input.addEventListener('keydown', e => { if (e.key === 'Escape') dropdown.style.display = 'none'; });

dropdown.addEventListener('click', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const ids = getCompare();
  if (ids.includes(btn.dataset.add)) return;
  if (ids.length >= COMPARE_MAX) { showMsg(compareLabels(pageLang).full); return; }
  setCompare([...ids, btn.dataset.add]);
  input.value = '';
  dropdown.style.display = 'none';
  input.focus();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.cmp-picker')) dropdown.style.display = 'none';
});

render();
