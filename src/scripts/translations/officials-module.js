// officials-module.js
// All browser-side logic for the officials category page.
// Serves EN, ZH-HANT and ZH-HANS versions via data-lang on .site

async function initModule() {

// ─── DATA ────────────────────────────────────────────────────────────────────
const siteEl     = document.querySelector('.site');
const categoryId = siteEl.dataset.category;
const pageLang   = siteEl.dataset.lang ?? 'en'; // 'en' | 'zh-hant' | 'zh-hans'

const dataFiles = {
  departments: () => import('../../data/central-court-database.json'),
  ministers:   () => import('../../data/excellencies-database.json'),
  military:    () => import('../../data/military-officials-database.json'),
  regional:    () => import('../../data/provincial-officials-database.json'),
  household:   () => import('../../data/rear-eastern-palace-database.json'),
};

const { default: pageData } = await dataFiles[categoryId]();

const allPositions = [];
for (const cat of pageData.categories) {
  for (const section of cat.sections ?? []) {
    for (const pos of section.positions ?? []) {
      allPositions.push({ ...pos, categoryId: cat.id, catLabel: cat.label, sectionLabel: section.label });
    }
  }
  for (const pos of cat.positions ?? []) {
    allPositions.push({ ...pos, categoryId: cat.id, catLabel: cat.label, sectionLabel: null });
  }
}

// ─── LANG HELPERS ────────────────────────────────────────────────────────────
function t(obj) {
  if (!obj) return '?';
  if (pageLang === 'zh-hant') return obj.zht ?? obj.en ?? '?';
  if (pageLang === 'zh-hans') return obj.zhs ?? obj.zht ?? obj.en ?? '?';
  return obj.en ?? '?';
}

function tAlt(obj) {
  if (!obj) return '?';
  if (pageLang === 'en') return obj.zht ?? '?';
  return obj.en ?? '?';
}

const isZh = pageLang === 'zh-hant' || pageLang === 'zh-hans';

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const panelPageOverview = document.getElementById('detail-page-overview');
const panelNotes        = document.getElementById('detail-notes');
const panelPosition     = document.getElementById('detail-position');
const panelPlaceholder  = document.getElementById('detail-placeholder');
const overviewItem      = document.getElementById('overview-item');
const detTitle          = document.getElementById('det-title');
const detSub            = document.getElementById('det-sub');
const detBody           = document.getElementById('det-body');
const notesBody         = document.getElementById('notes-body');

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentPos    = null;
let activeKingdoms = new Set();
let activeGrades   = new Set();
let searchQuery    = '';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function gradeClass(g) { return g <= 2 ? 'g12' : g <= 4 ? 'g34' : 'g5'; }

function getLangKey(lang) {
  if (lang === 'zh-hant') return 'zht';
  if (lang === 'zh-hans') return 'zhs';
  return 'en';
}

function zhPick(langKey, en, zht, zhs) {
  if (langKey === 'zht') return zht;
  if (langKey === 'zhs') return zhs;
  return en;
}

function getDisplayNames(pos, langKey) {
  const all = [
    ...(pos.name.wei ?? []),
    ...(pos.name.shu ?? []),
    ...(pos.name.wu  ?? []),
  ];
  const seen = new Set();
  const result = [];
  for (const n of all) {
    const val = n[langKey] ?? n.en;
    const cleaned = val?.replace(/<br><br>/gi, ' ').replace(/<br>/gi, ' ').trim();
    if (cleaned && cleaned !== '?' && cleaned !== '-' && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
      if (result.length === 2) break;
    }
  }
  return result.join(' · ');
}

// ─── COLLAPSE ────────────────────────────────────────────────────────────────
function toggleCollapse(header) {
  const inner = header.nextElementSibling;
  if (!inner) return;
  const collapsed = inner.style.display === 'none';
  inner.style.display = collapsed ? 'block' : 'none';
  const chevron = header.querySelector('.divider-chevron');
  if (chevron) {
    chevron.classList.toggle('ti-chevron-down', collapsed);
    chevron.classList.toggle('ti-chevron-right', !collapsed);
  }
}

document.querySelectorAll('.cat-divider').forEach(header => {
  header.addEventListener('click', () => {
    toggleCollapse(header);
    const cat = pageData.categories.find(c => c.id === header.dataset.id);
    if (!cat) return;
    document.querySelectorAll('.cat-divider').forEach(h => h.classList.remove('active'));
    header.classList.add('active');
    showNotes(t(cat.label), tAlt(cat.label), cat.categoryNotes ?? []);
    setMobileView('detail');
  });
});

document.querySelectorAll('.section-divider').forEach(header => {
  header.addEventListener('click', () => {
    toggleCollapse(header);
    const cat = pageData.categories.find(c => c.id === header.dataset.cat);
    const section = cat?.sections?.find(s => s.label.en === header.dataset.id);
    if (!section) return;
    document.querySelectorAll('.section-divider').forEach(h => h.classList.remove('active'));
    header.classList.add('active');
    showNotes(t(section.label), tAlt(section.label), section.sectionNotes ?? []);
    setMobileView('detail');
  });
});

// collapse all sections on load
document.querySelectorAll('.section-inner').forEach(inner => {
  inner.style.display = 'none';
  const chevron = inner.previousElementSibling?.querySelector('.divider-chevron');
  if (chevron) { chevron.classList.remove('ti-chevron-down'); chevron.classList.add('ti-chevron-right'); }
});

// store original order for search reset
document.querySelectorAll('.list-item').forEach((item, i) => {
  item.dataset.originalIndex = String(i);
});

// tag each item's home container so it can be restored there when search clears
let _containerCounter = 0;
document.querySelectorAll('.section-inner, .cat-inner').forEach(container => {
  if (!container.id) container.id = `auto-container-${_containerCounter++}`;
});
document.querySelectorAll('.list-item').forEach(item => {
  item.dataset.homeContainer = item.parentElement.id;
});

// ─── FILTERS ─────────────────────────────────────────────────────────────────
function checkKingdomGrade(item) {
  const { wei, shu, wu, grade } = item.dataset;
  if (activeKingdoms.size > 0) {
    const match = (activeKingdoms.has('wei') && wei === 'true')
               || (activeKingdoms.has('shu') && shu === 'true')
               || (activeKingdoms.has('wu')  && wu  === 'true');
    if (!match) return false;
  }
  if (activeGrades.size > 0 && !activeGrades.has(grade)) return false;
  return true;
}

function getMatchPriority(item) {
  if (!searchQuery) return 1;
  const q = searchQuery.toLowerCase();
  const nameEn  = item.dataset.nameEn  || '';
  const nameZht = item.dataset.nameZht || '';
  const nameZhs = item.dataset.nameZhs || '';
  const body    = item.dataset.searchBody || '';
  if (nameEn.includes(q) || nameZht.includes(q) || nameZhs.includes(q)) return 1;
  if (body.includes(q)) return 2;
  return 0;
}

function applyFilters() {
  document.querySelectorAll('.list-item').forEach(item => {
    const priority = getMatchPriority(item);
    const passes   = checkKingdomGrade(item);
    item.style.display = (priority === 0 || !passes) ? 'none' : 'block';
    item.dataset.priority = String(priority);
  });

  const breadcrumbsOn = !!searchQuery;
  document.querySelectorAll('.li-breadcrumb').forEach(el => {
    el.style.display = breadcrumbsOn ? 'block' : 'none';
  });

  if (searchQuery) {
    const listItems = document.getElementById('list-items');
    const allVisible = [...document.querySelectorAll('.list-item')]
      .filter(i => i.style.display !== 'none')
      .sort((a, b) => {
        const p = Number(a.dataset.priority) - Number(b.dataset.priority);
        if (p !== 0) return p;
        return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
      });
    allVisible.forEach(item => listItems.appendChild(item));
  } else {
    document.querySelectorAll('.list-item').forEach(item => {
      const home = document.getElementById(item.dataset.homeContainer);
      if (home) home.appendChild(item);
    });
    document.querySelectorAll('.section-inner, .cat-inner').forEach(container => {
      const items = [...container.querySelectorAll('.list-item')]
        .sort((a, b) => Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex));
      items.forEach(item => container.appendChild(item));
    });
  }

  document.querySelectorAll('.section-group').forEach(g => {
    g.style.display = g.querySelectorAll('.list-item:not([style*="display: none"])').length === 0 ? 'none' : 'block';
  });
  document.querySelectorAll('.cat-group').forEach(g => {
    g.style.display = g.querySelectorAll('.list-item:not([style*="display: none"])').length === 0 ? 'none' : 'block';
  });
}

document.querySelectorAll('.pill-kingdom').forEach(pill => {
  pill.addEventListener('click', () => {
    const val = pill.dataset.val;
    activeKingdoms.has(val) ? (activeKingdoms.delete(val), pill.classList.remove('on'))
                             : (activeKingdoms.add(val),    pill.classList.add('on'));
    applyFilters();
  });
});

document.querySelectorAll('.pill-grade').forEach(pill => {
  pill.addEventListener('click', () => {
    if (pill.disabled) return;
    const val = pill.dataset.val;
    activeGrades.has(val) ? (activeGrades.delete(val), pill.classList.remove('on'))
                           : (activeGrades.add(val),    pill.classList.add('on'));
    applyFilters();
  });
});

document.getElementById('pos-search').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  applyFilters();
});

// ─── MOBILE SINGLE-PANE TOGGLE ───────────────────────────────────────────────
siteEl.dataset.mobileView = 'list';
function setMobileView(view) {
  siteEl.dataset.mobileView = view;
}

// ─── DETAIL PANEL — SHOW/HIDE ────────────────────────────────────────────────
function hideAll() {
  panelPageOverview.style.display = 'none';
  panelNotes.style.display        = 'none';
  panelPosition.style.display     = 'none';
  panelPlaceholder.style.display  = 'block';
  document.querySelectorAll('.list-item, .cat-divider, .section-divider')
    .forEach(el => el.classList.remove('active'));
  overviewItem.classList.remove('active');
}

function showPageOverview() {
  hideAll();
  panelPlaceholder.style.display  = 'none';
  panelPageOverview.style.display = 'block';
  overviewItem.classList.add('active');
}

function showNotes(title, sub, notes) {
  hideAll();
  panelPlaceholder.style.display = 'none';
  panelNotes.style.display       = 'block';
  const langKey  = getLangKey(pageLang);
  const isZhLang = langKey === 'zht' || langKey === 'zhs';

  const notesTitleEl = document.getElementById('notes-title');
  const notesSubEl   = document.getElementById('notes-sub');
  notesTitleEl.textContent = title;
  notesSubEl.textContent   = sub;
  notesTitleEl.className   = isZhLang ? 'det-title det-title-zh' : 'det-title';
  notesSubEl.className     = isZhLang ? 'det-sub'                : 'det-sub det-sub-zh';

  const noteTextCls = isZhLang ? 'note-text note-text-zh' : 'note-text';
  notesBody.innerHTML = (!notes || notes.length === 0)
    ? '<p class="ov-card-text" style="color:var(--color-text-tertiary);"></p>'
    : notes.map(n => `<div class="note-para"><p class="${noteTextCls}">${n[langKey] ?? n.en}</p></div>`).join('');
}

function showPosition(pos) {
  hideAll();
  panelPlaceholder.style.display = 'none';
  currentPos = pos;
  panelPosition.style.display = 'block';
  renderPosition(pos, pageLang);
}

// close buttons
document.getElementById('mobile-close').addEventListener('click', () => { hideAll(); setMobileView('list'); });
document.getElementById('mobile-close-overview').addEventListener('click', () => { hideAll(); setMobileView('list'); });
document.getElementById('mobile-close-notes').addEventListener('click', () => { hideAll(); setMobileView('list'); });

// overview click
overviewItem.addEventListener('click', () => {
  showPageOverview();
  setMobileView('detail');
});

// position clicks
document.querySelectorAll('.list-item').forEach(item => {
  item.addEventListener('click', () => {
    const pos = allPositions.find(p => p.id === item.dataset.id);
    if (pos) {
      showPosition(pos);
      item.classList.add('active');
      setMobileView('detail');
    }
  });
});

// ─── MAJOR SECTIONS — clicking a summary row opens & scrolls to that section
function openCategoryFromOverview(catId) {
  const catHeader = document.querySelector(`.cat-divider[data-id="${catId}"]`);
  if (!catHeader) return;

  document.querySelectorAll('.cat-divider').forEach(h => h.classList.remove('active'));
  catHeader.classList.add('active');

  const cat = pageData.categories.find(c => c.id === catId);
  if (cat) showNotes(t(cat.label), tAlt(cat.label), cat.categoryNotes ?? []);
  setMobileView('detail');

  requestAnimationFrame(() => {
    catHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

document.querySelectorAll('.ov-section-row').forEach(row => {
  row.addEventListener('click', () => openCategoryFromOverview(row.dataset.cat));
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') openCategoryFromOverview(row.dataset.cat);
  });
});

// ─── DETAIL PANEL — RENDER POSITION ─────────────────────────────────────────
function renderPosition(pos, lang) {
  const langKey    = getLangKey(lang);
  const altLangKey = (langKey === 'en') ? 'zht' : 'en';
  const isZhLang   = langKey === 'zht' || langKey === 'zhs';

  detTitle.textContent = getDisplayNames(pos, langKey);
  detSub.textContent   = getDisplayNames(pos, altLangKey);
  detTitle.className   = isZhLang ? 'det-title det-title-zh' : 'det-title';
  detSub.className     = isZhLang ? 'det-sub'                : 'det-sub det-sub-zh';

  const para   = isZhLang ? 'det-para det-para-zh'     : 'det-para';
  const ncls   = isZhLang ? 'det-notes det-notes-zh'   : 'det-notes';
  const kname  = isZhLang ? 'kb-name kb-name-zh'       : 'kb-name';
  const klabel = isZhLang ? 'kb-label kb-label-zh'     : 'kb-label';
  const dsLabelCls      = isZhLang ? 'ds-label ds-label-zh'                   : 'ds-label';
  const sectionTitleCls = isZhLang ? 'det-section-title det-section-title-zh' : 'det-section-title';
  const sourcesListCls  = isZhLang ? 'det-sources-list det-sources-list-zh'   : 'det-sources-list';
  const sourcesPlaceholderCls = isZhLang ? 'det-sources-placeholder det-sources-placeholder-zh' : 'det-sources-placeholder';
  const summaryCls = isZhLang ? 'det-summary det-summary-zh' : 'det-summary';

  const wuChar = langKey === 'zhs' ? '吴' : '吳';
  const kLabels = {
    wei: langKey === 'en' ? 'Wei' : '魏',
    shu: langKey === 'en' ? 'Shu' : '蜀',
    wu:  langKey === 'en' ? 'Wu'  : wuChar,
  };
  const kClass = { wei: 'kb-wei', shu: 'kb-shu', wu: 'kb-wu' };

  const kingdomsPresent = ['wei','shu','wu'].filter(k => pos.name[k]);
  const subCls = isZhLang ? 'kb-name-sub' : 'kb-name-sub kb-name-sub-zh';
  const kingdomCardsHtml = kingdomsPresent.length ? `
    <div class="det-kingdom-cards">
      ${['wei','shu','wu'].map(k => {
        const names = pos.name[k];
        if (!names) return `<div class="det-kingdom-card-empty"></div>`;
        const pairsHtml = names.map(n => {
          const mainVal = (n[langKey] ?? n.en)?.replace(/<br><br>/gi, '<br><br>') ?? '';
          const altVal  = (n[altLangKey] ?? n.en)?.replace(/<br><br>/gi, '<br><br>') ?? '';
          return `
            <div class="kb-name-pair">
              <span class="${kname}">${mainVal}</span>
              <span class="${subCls}">${altVal}</span>
            </div>`;
        }).join('');
        return `
          <div class="det-kingdom-card ${kClass[k]}">
            <span class="${klabel}">${kLabels[k]}</span>
            ${pairsHtml}
          </div>`;
      }).join('')}
    </div>` : '';

  const rankArr = pos.rank ? (pos.rank[langKey] ?? pos.rank.en ?? []) : ['?'];
  let gradeText = '?', salaryText = '?';
  if (rankArr.length > 0) {
    const full = rankArr.join(' ');
    const zhMatch = full.match(/^(.*?[一二三四五六七八九]品)/);
    const enMatch = full.match(/^(.*?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\s+grade)/i);
    const match = zhMatch ?? enMatch;
    if (match) {
      gradeText  = match[1].trim();
      salaryText = full.slice(match[1].length).replace(/^[,，\s]+/, '').trim();
    } else {
      gradeText  = '?';
      salaryText = full;
    }
    salaryText = salaryText
      .replace(/,?\s*\(Shu\)/g, '<br>(Shu)')
      .replace(/,?\s*\(Wu\)/g, '<br>(Wu)')
      .replace(/,?\s*（蜀）/g, '<br>（蜀）')
      .replace(/,?\s*（吳）/g, '<br>（吳）')
      .replace(/,?\s*（吴）/g, '<br>（吴）')
      .replace(/\bshi\b,/g, '<em>shi,</em>')
      .replace(/\bshi\b(?!,)/g, '<em>shi</em>');
  }
  const gradeInlineHtml = pos.gradeNum
    ? `<span class="gc ${gradeClass(pos.gradeNum)}">${pos.gradeNum}</span> ${gradeText}`
    : gradeText;

  const labelDepartment = zhPick(langKey, 'Section',           '分類', '分类');
  const labelKingdoms   = zhPick(langKey, 'Kingdoms',           '國',   '国');
  const labelGrade      = zhPick(langKey, 'Grade',              '品',   '品');
  const labelSalary     = zhPick(langKey, 'Salary & Headcount', '秩員', '秩员');

  const deptName = pos.catLabel ? (pos.catLabel[langKey] ?? pos.catLabel.en ?? '?') : '?';

  const kingdomBadgesHtml = kingdomsPresent.map(k =>
    `<span class="badge b-${k}">${kLabels[k]}</span>`
  ).join('');

  const summaryHtml = `
    <div class="${summaryCls}">
      <span class="ds-item"><span class="${dsLabelCls}">${labelDepartment}</span><span class="ds-value">${deptName}</span></span>
      <span class="ds-sep">·</span>
      <span class="ds-item"><span class="${dsLabelCls}">${labelKingdoms}</span><span class="ds-value ds-badges">${kingdomBadgesHtml}</span></span>
      <span class="ds-sep">·</span>
      <span class="ds-item"><span class="${dsLabelCls}">${labelGrade}</span><span class="ds-value">${gradeInlineHtml}</span></span>
      <span class="ds-sep">·</span>
      <span class="ds-item"><span class="${dsLabelCls}">${labelSalary}</span><span class="ds-value">${salaryText}</span></span>
    </div>`;

  const labelJobscope = zhPick(langKey, 'Jobscope', '職掌', '职掌');
  const jobscope = pos.jobscope;
  const jobArr   = jobscope ? (jobscope[langKey] ?? jobscope.en ?? []) : [];
  const jobVal   = jobArr.length
    ? jobArr.map(p => `<p class="${para}">${p}</p>`).join('')
    : `<p class="${para}">?</p>`;
  const jobscopeHtml = `
    <div class="det-section">
      <div class="${sectionTitleCls}">${labelJobscope}</div>
      <div class="det-section-body">${jobVal}</div>
    </div>`;

  const labelNotes = zhPick(langKey, 'Notes', '注', '注');
  const notesHtml = pos.notes?.length ? `
    <div class="det-section">
      <div class="${sectionTitleCls}">${labelNotes}</div>
      <div class="${ncls}">${pos.notes.map(n => {
        const val = n[langKey] ?? n.en ?? '';
        return `<p class="${para}">· ${val}</p>`;
      }).join('')}</div>
    </div>` : '';

  const labelSources = zhPick(langKey, 'Sources & Examples', '出處與例證', '出处与例证');
  const placeholderText = zhPick(langKey, 'To be updated', '待更新', '待更新');
  const sourcesArr = Array.isArray(pos.sources) ? pos.sources.filter(Boolean) : [];
  const sourcesBodyHtml = sourcesArr.length
    ? `<ul class="${sourcesListCls}">${sourcesArr.map(src => {
        const val = typeof src === 'string' ? src : (src[langKey] ?? src.en ?? '');
        return `<li>${val}</li>`;
      }).join('')}</ul>`
    : `<p class="${sourcesPlaceholderCls}">${placeholderText}</p>`;
  const sourcesHtml = `
    <div class="det-section">
      <div class="${sectionTitleCls}">${labelSources}</div>
      <div class="det-section-body">${sourcesBodyHtml}</div>
    </div>`;

  detBody.innerHTML = `
    ${summaryHtml}
    ${kingdomCardsHtml}
    ${jobscopeHtml}
    ${notesHtml}
    ${sourcesHtml}
  `;
}

// ─── DEEP LINK FROM SEARCH ───────────────────────────────────────────────────
function expandToPosition(id) {
  const item = document.querySelector(`.list-item[data-id="${id}"]`);
  if (!item) return false;

  const sectionInner = item.closest('.section-inner');
  if (sectionInner && sectionInner.style.display === 'none') {
    toggleCollapse(sectionInner.previousElementSibling);
  }
  item.click();

  requestAnimationFrame(() => {
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.classList.add('flash-highlight');
    setTimeout(() => item.classList.remove('flash-highlight'), 1600);
  });
  return true;
}

if (location.hash) {
  const id = location.hash.slice(1);
  const found = expandToPosition(id);
  if (!found) showPageOverview();
} else {
  showPageOverview();
}

} // end initModule

// only run in the browser
if (typeof document !== 'undefined') {
  initModule();
}