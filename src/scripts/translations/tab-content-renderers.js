// tab-content-renderers.js
// Renders the Background / Salary / Glossary tab content for officials.astro.
// Shared across all three language pages — pass `langKey` ('en' | 'zht' | 'zhs').
// Tab-switching infrastructure (showTab, panels) lives in officials.astro itself
// and is untouched by this file; these functions only fill the panel innerHTML.
// Salary/glossary source data lives in src/data/officials/ (salary-data.ts, glossary-data.ts),
// not alongside this file, since that data is real site content, not a script helper.

import { salaryIntro, salaryColumns, salaryFootnotes, salaryRows } from '../../data/officials/salary-data.ts';
import { glossaryTerms } from '../../data/officials/glossary-data.ts';

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
// Background uses static markup directly in officials.astro (prose + citation
// rail), not a JS renderer — its content rarely changes and benefits from being
// readable directly in the template. No renderer function needed here.

// ─── SALARY ──────────────────────────────────────────────────────────────────
function salaryLegendHtml(langKey) {
  const allLabels = {
    en:  { footnoted: 'Later Han values (underline for same value in both Han)', estimated: 'Bielenstein\'s estimates', alternate: 'Former Han values' },
    zht: { footnoted: '東漢，下劃線則兩漢同', estimated: '畢漢思（Bielenstein）估算', alternate: '西漢' },
    zhs: { footnoted: '东汉，下划线则两汉同', estimated: '毕汉思（Bielenstein）估算', alternate: '西汉' },
  };
  const labels = allLabels[langKey] ?? allLabels.en;
  return `
    <div class="salary-legend">
      <span class="salary-legend-item"><span class="salary-legend-dot salary-footnoted-sample"></span> ${labels.footnoted}</span>
      <span class="salary-legend-item"><span class="salary-legend-dot salary-estimated-sample"></span> ${labels.estimated}</span>
      <span class="salary-legend-item"><span class="salary-legend-dot salary-alternate-sample"></span> ${labels.alternate}</span>
    </div>`;
}

function salaryCellHtml(c) {
  if (!c) return '';
  const kind = c.kind ?? 'plain';
  if (kind === 'plain') return `${c.value}`;
  const cls = kind === 'footnoted' ? 'salary-footnoted'
            : kind === 'estimated' ? 'salary-estimated'
            : kind === 'alternate' ? 'salary-alternate'
            : '';
  return cls ? `<span class="${cls}">${c.value}</span>` : `${c.value}`;
}
 
function salaryMultiCellHtml(multi) {
  if (!multi) return '';
  const primary = salaryCellHtml(multi.primary);
  if (!multi.alt) return primary;
  const alt = salaryCellHtml(multi.alt);
  return `${primary}, ${alt}`;
}
 
function segmentHtml(seg) {
  const cls = seg.kind === 'alternate' ? 'salary-alternate'
            : seg.kind === 'estimated' ? 'salary-estimated'
            : seg.kind === 'footnoted' ? 'salary-footnoted'
            : '';
  return cls ? `<span class="${cls}">${seg.text}</span>` : seg.text;
}
 
function columnHeaderHtml(col, langKey) {
  const label = col.label[langKey] ?? col.label.en;
  const footnoteSup = col.footnotes ? `<sup>${col.footnotes.join(',')}</sup>` : '';
  if (!col.sub) {
    return `<span class="salary-th-label">${label}</span>${footnoteSup}`;
  }
  const subSegs = col.sub[langKey] ?? col.sub.en;
  const subHtml = subSegs.map(segmentHtml).join('');
  return `
    <span class="salary-th-label">${label}</span>${footnoteSup}
    <span class="salary-th-sub">[${subHtml}]</span>`;
}
 
export function renderSalaryTab(langKey) {
  const intro = salaryIntro[langKey] ?? salaryIntro.en;
  const cols = salaryColumns;
  const footnotes = salaryFootnotes[langKey] ?? salaryFootnotes.en;
 
  const tableRowsHtml = salaryRows.map(row => `
    <tr>
      <td>${row.rank[langKey] ?? row.rank.en}</td>
      <td>${salaryMultiCellHtml(row.monthlyGrainHu)}</td>
      <td>${row.annualDanHu}</td>
      <td>${salaryMultiCellHtml(row.monthlyCoin)}</td>
      <td>${salaryMultiCellHtml(row.monthlyHuskedGrain)}</td>
    </tr>`).join('');
 
  const cardsHtml = salaryRows.map(row => `
    <div class="salary-card">
      <div class="salary-card-rank">${row.rank[langKey] ?? row.rank.en}</div>
      <div class="salary-card-grid">
        <div><div class="salary-card-label">${cols.monthlyGrain.label[langKey] ?? cols.monthlyGrain.label.en}</div><div>${salaryMultiCellHtml(row.monthlyGrainHu)}</div></div>
        <div><div class="salary-card-label">${cols.monthlyCoin.label[langKey] ?? cols.monthlyCoin.label.en}</div><div>${salaryMultiCellHtml(row.monthlyCoin)}</div></div>
        <div><div class="salary-card-label">${cols.huskedGrain.label[langKey] ?? cols.huskedGrain.label.en}</div><div>${salaryMultiCellHtml(row.monthlyHuskedGrain)}</div></div>
      </div>
    </div>`).join('');
 
  const footnotesHtml = footnotes.map((f, i) => `<div class="salary-footnote-line">${i + 1}. ${f}</div>`).join('');
 
  const titles = { en: 'Salary during the Han', zht: '漢代俸祿', zhs: '汉代俸禄' };
  const title = titles[langKey] ?? titles.en;
 
  return `
    <div class="salary-tab">
      <h2 class="salary-title">${title}</h2>
      <p class="salary-intro">${intro}</p>
 
      <div class="salary-legend-mobile">${salaryLegendHtml(langKey)}</div>
 
      <div class="salary-table-wrap">
        <table class="salary-table">
          <thead>
            <tr>
              <th>${columnHeaderHtml(cols.rank, langKey)}</th>
              <th>${columnHeaderHtml(cols.monthlyGrain, langKey)}</th>
              <th>${columnHeaderHtml(cols.annualDanHu, langKey)}</th>
              <th>${columnHeaderHtml(cols.monthlyCoin, langKey)}</th>
              <th>${columnHeaderHtml(cols.huskedGrain, langKey)}</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </div>
 
      <div class="salary-cards">${cardsHtml}</div>
 
      <div class="salary-footnotes">${footnotesHtml}</div>
    </div>`;
}
 
// ─── GLOSSARY ────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function tocDisplayName(t, langKey) {
  if (langKey === 'en') return t.term.en;
  return langKey === 'zhs' ? (t.term.zhs ?? t.term.zht) : (t.term.zht ?? t.term.zhs);
}

function glossaryEntryHeaderHtml(t, langKey) {
  const chineseChar = langKey === 'zhs' ? (t.term.zhs ?? t.term.zht) : (t.term.zht ?? t.term.zhs);
  const pinyinHtml = t.pinyin ? `<span class="glossary-pinyin">${t.pinyin}</span>` : '';

  if (langKey === 'en') {
    return `
      <div class="glossary-entry-head">
        <span class="glossary-term">${t.term.en}</span>
        <span class="glossary-entry-meta">
          <span class="glossary-term-secondary">${chineseChar}</span>
          ${pinyinHtml}
        </span>
      </div>`;
  }

  return `
    <div class="glossary-entry-head">
      <span class="glossary-term">${chineseChar}</span>
      <span class="glossary-entry-meta">
        <span class="glossary-term-secondary">${t.term.en}</span>
        ${pinyinHtml}
      </span>
    </div>`;
}


const glossaryInfoText = {
  en: 'Terms are given in pinyin and Chinese characters. Definitions reflect historical usage and may differ from modern meanings.',
  zht: '辭條附拼音及英譯，釋義依歷史用法，或與今義有別。',
  zhs: '辞条附拼音及英译，释义依历史用法，或与今义有别。',
};

const glossaryOnThisPageLabel = { en: 'On this page', zht: '目錄', zhs: '目录' };
const glossaryBackToTopLabel = { en: 'Back to top', zht: '回到頂端', zhs: '回到顶部' };

const seeAlsoLabel = { en: 'See also', zht: '參見', zhs: '参见' };

function buildTermLookup() {
  const map = {};
  for (const t of glossaryTerms) map[t.id] = t;
  return map;
}

function seeAlsoHtml(t, langKey, termLookup) {
  if (!t.seeAlso || t.seeAlso.length === 0) return '';
  const label = seeAlsoLabel[langKey] ?? seeAlsoLabel.en;
  const links = t.seeAlso
    .map(id => termLookup[id])
    .filter(Boolean)
    .map(other => {
      const display = langKey === 'en' ? other.term.en : (langKey === 'zhs' ? (other.term.zhs ?? other.term.zht) : (other.term.zht ?? other.term.zhs));
      return `<a class="glossary-seealso-link" href="#glossary-${slugify(other.term.en)}">${display}</a>`;
    })
    .join('');
  if (!links) return '';
  return `
    <div class="glossary-seealso">
      <span class="glossary-seealso-label">${label}</span>
      ${links}
    </div>`;
}

function pinyinSortKey(t) {
  // strip tone marks for sorting purposes (e.g. "jǐshì" → "jishi")
  return (t.pinyin || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function renderGlossaryTab(langKey) {
  const isChinese = langKey === 'zht' || langKey === 'zhs';

  const sorted = [...glossaryTerms].sort((a, b) => {
    if (isChinese) {
      return pinyinSortKey(a).localeCompare(pinyinSortKey(b));
    }
    return a.term.en.localeCompare(b.term.en);
  });

  const grouped = {};
  for (const t of sorted) {
    const letter = isChinese
      ? pinyinSortKey(t).charAt(0).toUpperCase()
      : t.term.en[0].toUpperCase();
    (grouped[letter] = grouped[letter] ?? []).push(t);
  }

  const termLookup = buildTermLookup();

  const sectionsHtml = Object.entries(grouped).map(([letter, terms]) => `
    <div class="glossary-section">
      <div class="glossary-letter" id="glossary-letter-${letter}">${letter}</div>
      ${terms.map(t => `
        <div class="glossary-entry" id="glossary-${slugify(t.term.en)}">
          ${glossaryEntryHeaderHtml(t, langKey)}
          <div class="glossary-def">${t.definition[langKey] ?? t.definition.en}</div>
          ${seeAlsoHtml(t, langKey, termLookup)}
        </div>`).join('')}
    </div>`).join('');

  const tocHtml = Object.entries(grouped).map(([letter, terms]) => `
  <div class="toc-group">
    <div class="toc-letter">${letter}</div>
    ${terms.map(t => `<a class="toc-link" href="#glossary-${slugify(t.term.en)}">${tocDisplayName(t, langKey)}</a>`).join('')}
  </div>`).join('');

  const infoText = glossaryInfoText[langKey] ?? glossaryInfoText.en;
  const onThisPage = glossaryOnThisPageLabel[langKey] ?? glossaryOnThisPageLabel.en;
  const backToTop = glossaryBackToTopLabel[langKey] ?? glossaryBackToTopLabel.en;

  return `
    <div class="glossary-layout" id="glossary-top">
      <aside class="glossary-aside">
        <div class="glossary-info">
          <i class="ti ti-info-circle" aria-hidden="true"></i>
          <p>${infoText}</p>
        </div>
        <div class="glossary-toc">
          <div class="glossary-toc-label">${onThisPage}</div>
          <nav class="glossary-toc-nav">${tocHtml}</nav>
          <a class="glossary-toc-top" href="#glossary-top">↑ ${backToTop}</a>
        </div>
      </aside>
      <div class="glossary-main">${sectionsHtml}</div>
    </div>`;
}