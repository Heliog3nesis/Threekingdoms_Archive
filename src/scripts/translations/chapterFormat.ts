// chapterFormat.ts
//
// Shared formatting logic for the sanguozhi chapter pages — extracted so
// all 3 language versions (en, zh-hant, zh-hans) import the same
// implementation instead of each maintaining its own drifting copy, and
// so this same set of functions also covers both rendering contexts each
// page itself uses (Astro/JSX frontmatter for the initial server-render,
// and the client-side <script> block that re-renders on navigation).
//
// Every function here returns UNESCAPED text/HTML fragments built from
// already-linkified (and therefore already-escaped-where-needed) pieces.
// Escaping responsibility stays with the caller, since the two rendering
// contexts need it differently: plain JSX interpolation like
// `{cn(field, cnField)}` gets auto-escaped by JSX itself, so frontmatter
// call sites should NOT double-escape; the client `<script>` block builds
// raw HTML strings directly, so those call sites should wrap a result in
// their own esc() before interpolating it. linkify/renderFootnotes/
// linkifyParagraphs/linkifyParagraphPairs are the exception — they
// deliberately return already-safe HTML (via manual escaping baked into
// linkify itself, since they mix escaped user text with their own
// injected <a>/<sup> tags), and are used identically via set:html in
// JSX or direct string concatenation client-side either way.

import { url } from '../../utils/url';

// Source names that are a person commenting directly rather than a
// titled work being quoted (e.g. 孫盛), where wrapping the bare name in
// 《》 — the brackets Chinese uses for book/work titles — would be a
// category error. Add more names here as they come up.
export const SOURCE_NAMES_WITHOUT_BRACKETS = new Set(['孫盛', '孙盛', '裴松之']);

// Picks the Chinese-script field matching the page's own language
// (zh-hant vs zh-hans), falling back across the other variants if the
// requested one is missing. cnField must be passed in explicitly (not
// closed over) since this same function serves all 3 language pages.
export function cn(field: any, cnField: 'zht' | 'zhs'): string {
  return field?.[cnField] ?? field?.zht ?? field?.zhs ?? '';
}

// Strips a trailing parenthetical attribution (e.g. "晉書（王隱）" -> main
// name "晉書", trailing "（王隱）") so a source's actual title/name can be
// checked and displayed separately from who's cited as having written it.
export function sourceMainNameZh(source: any, cnField: 'zht' | 'zhs'): string {
  const raw = cn(source, cnField);
  const match = raw.match(/^(.*?)([(（][^)）]*[)）])\s*$/);
  return match ? match[1].trim() : raw;
}
export function sourceMainNameEn(source: any): string {
  const raw = String(source?.en ?? '');
  const match = raw.match(/^(.*?)(\([^)]*\))\s*$/);
  return match ? match[1].trim() : raw;
}

// Pei Songzhi is the annotator of the entire text — when a "source" is
// Pei Songzhi himself (his own aside, not a quotation from a separately
// titled work or a different historian like Sun Sheng), saying
// "Annotation by Pei Songzhi, quoting Pei Songzhi" would be nonsensical.
// Unlike Sun Sheng (who still gets named, just without book-title
// brackets), this case skips the "quoting X" phrase entirely — the
// annotator byline alone already says everything there is to say.
export function isSelfCommentary(source: any, cnField: 'zht' | 'zhs'): boolean {
  return sourceMainNameZh(source, cnField) === '裴松之' || sourceMainNameEn(source) === 'Pei Songzhi';
}

// Some annotations (e.g. glosses like "狟音桓。") aren't quoting any
// source at all — annotator/source objects exist but every field is
// empty. Folds in isSelfCommentary so callers get one single gate for
// "should the quoting-X phrase render at all."
export function hasSource(source: any, cnField: 'zht' | 'zhs'): boolean {
  return !!(source && (source.zht || source.zhs || source.en)) && !isSelfCommentary(source, cnField);
}

export function formatSourceZh(source: any, cnField: 'zht' | 'zhs'): string {
  if (!source) return '';
  const raw = cn(source, cnField);
  const match = raw.match(/^(.*?)([(（][^)）]*[)）])\s*$/);
  const mainName = match ? match[1].trim() : raw;
  const trailing = match ? match[2] : '';
  if (SOURCE_NAMES_WITHOUT_BRACKETS.has(mainName)) return mainName + trailing;
  return `《${mainName}》${trailing}`;
}

// Turns [[label|url]] term tags and [^N] footnote markers into their
// rendered HTML form, escaping everything else along the way. Returns
// ready-to-inject HTML (via set:html in JSX, or direct string
// concatenation client-side) — identical in both contexts, since it
// already does its own escaping rather than relying on JSX's auto-escape.
export function linkify(text: unknown): string {
  const escaped = String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const withTerms = escaped.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_match, label, rawUrl) => {
    // A link to another chapter (e.g. an appraisal naming the biographies
    // it judges) stays in the reader: same tab, swapped client-side by the
    // page's [data-sgz-link] click handler.
    const chapterMatch = rawUrl.match(/\/translations\/sanguozhi\/([\w-]+)$/);
    if (chapterMatch) {
      return `<a href="${url(rawUrl)}" class="term-link term-link-ch" data-sgz-link data-chapter="${chapterMatch[1]}">${label}</a>`;
    }
    const isLocation = rawUrl.includes('/maps');
    const isOfficial = rawUrl.includes('/officials');
    const typeClass = isLocation ? ' term-link-loc' : isOfficial ? ' term-link-off' : '';
    const icon = isLocation
      ? '<i class="ti ti-map-pin term-link-icon" aria-hidden="true"></i>'
      : isOfficial
      ? '<i class="ti ti-file-text term-link-icon" aria-hidden="true"></i>'
      : '';
    return `<a href="${url(rawUrl)}" class="term-link${typeClass}" target="_blank" rel="noopener">${label}${icon}</a>`;
  });
  // [^N] footnote marker — same convention as Markdown/Pandoc footnotes.
  // Just a visual indicator, not interactive/clickable — the actual note
  // renders as always-visible text after the passage/annotation (see
  // renderFootnotes), so there's no second toggle competing with the
  // annotation's own expand/collapse.
  return withTerms.replace(/\[\^(\d+)\]/g, (_match, n) => `<sup class="footnote-ref">${n}</sup>`);
}

// Renders a footnotes array ({n, zht, zhs, en}) as always-visible text
// appended after whatever it belongs to (a passage or an annotation) —
// deliberately not collapsible, so it never introduces a second toggle
// nested inside an already-toggleable annotation. Text inherits its
// parent's own color/font-size (no override here) — same view-mode
// (Parallel/Original/English Only) toggle as everything else applies,
// via the shared .view-orig/.view-en classes.
export function renderFootnotes(
  footnotes: any[] | undefined,
  cnField: 'zht' | 'zhs',
  cnLangAttr: string,
  context: 'passage' | 'annotation'
): string {
  if (!footnotes || footnotes.length === 0) return '';
  return `
    <div class="footnotes footnotes-${context}">
      ${footnotes.map((f: any) => `
        <div class="footnote-item">
          <span class="footnote-num">${f.n}.</span>
          <span class="footnote-body">
            <span class="footnote-zh" lang="${cnLangAttr}">${linkify(cn(f, cnField))}</span>
            <span class="footnote-en">${linkify(f.en)}</span>
          </span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Vernacular (白話) ────────────────────────────────────────────────
// passage.vern is { zht, zhs }. Deliberately NO cross-script fallback
// (unlike cn()): a zht page must never show simplified vernacular, so a
// missing/empty field for this page's own script just means "no vernacular".
export function vernOf(passage: any, cnField: 'zht' | 'zhs'): string {
  const v = passage?.vern?.[cnField];
  return typeof v === 'string' ? v.trim() : '';
}

// The 白話 view button is only offered for chapters where at least one
// passage or annotation actually has vernacular text, so chapters can be
// filled in gradually. (Annotations carry their own vern, same shape as
// passages; footnotes have none.)
export function chapterHasVern(chapter: any, cnField: 'zht' | 'zhs'): boolean {
  return (chapter?.passages ?? []).some(
    (p: any) =>
      vernOf(p, cnField) !== '' ||
      (p.annotations ?? []).some((a: any) => vernOf(a, cnField) !== '')
  );
}

// ── Client payload ───────────────────────────────────────────────────
// ── Appraisals (評) ─────────────────────────────────────────────────
// Chen Shou closes each juan with an appraisal (評曰) of everyone in it.
// It lives in its own chapter file (e.g. wei-shu-18-appraisal.json) with
// "kind": "appraisal" and the same `num` as the juan's biographies, so it
// groups with them in the sidebar and renders through the same passage
// machinery — but it is not a biography: no journey, no relationships,
// not a person to search for, always listed last in its juan.

export function isAppraisal(chapter: any): boolean {
  return chapter?.kind === 'appraisal';
}

// Chapter sort: by `order`, then an appraisal after its juan's biographies
// (Array.prototype.sort is stable, so biographies keep file order).
export function compareChapters(a: any, b: any): number {
  return (a.order - b.order) || (Number(isAppraisal(a)) - Number(isAppraisal(b)));
}

// The juan-group header's count, e.g. "10 biographies" — the appraisal
// is in the group but isn't counted.
export function biographyCount(chapters: any[]): number {
  return chapters.filter((ch) => !isAppraisal(ch)).length;
}

// The biographies an appraisal covers: every non-appraisal chapter in the
// same book and juan.
export function appraisalSubjects(appraisal: any, chapters: any[]): any[] {
  return chapters.filter((ch) => !isAppraisal(ch) && ch.book === appraisal.book && ch.num === appraisal.num);
}

// "Biography of Zang Ba · with Sun Guan" -> "Zang Ba"; "臧霸傳 · 附孫觀" -> "臧霸".
export function biographySubject(label: string): string {
  return String(label ?? '').split(' · ')[0].replace(/^Biography of /, '').replace(/[傳传]$/, '');
}

// The "covers" line under an appraisal's title: one in-reader link per
// biography in the juan. `lang` picks the label script ('en' or a cnField).
// When a label doesn't reduce to a clean name (16d, "Biography of Du Shu,
// son of Du Ji" / 杜畿子恕傳), the appraisal file names that subject itself:
// "subjectNames": { "wei-shu-16d": { "zht": "杜恕", "zhs": "杜恕", "en": "Du Shu" } }.
// Returns ready-to-inject HTML, like linkify().
export function renderAppraisalSubjects(
  appraisal: any,
  chapters: any[],
  lang: 'en' | 'zht' | 'zhs',
  chapterUrl: (id: string) => string,
): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const subjects = appraisalSubjects(appraisal, chapters);
  if (subjects.length === 0) return '';
  const langAttr = lang === 'zhs' ? ' lang="zh-hans"' : lang === 'zht' ? ' lang="zh-hant"' : '';
  const links = subjects.map((ch) => {
    const override = appraisal.subjectNames?.[ch.id];
    const name = override
      ? (lang === 'en' ? override.en : cn(override, lang))
      : biographySubject(lang === 'en' ? ch.label.en : cn(ch.label, lang));
    return `<a href="${chapterUrl(ch.id)}" class="appraisal-subject" data-sgz-link data-chapter="${ch.id}"${langAttr}>${esc(name)}</a>`;
  });
  const lead = lang === 'en' ? 'On' : lang === 'zhs' ? '评' : '評';
  const sep = lang === 'en' ? ', ' : '、';
  return `<p class="appraisal-subjects"><span class="appraisal-subjects-lead">${lead}</span> ${links.join(sep)}</p>`;
}

// The chapter pages embed their data as JSON for the client-side router.
// These keep that payload down to what a page's client script can use.

// Drops the OTHER script's field wherever this page's own is present, e.g.
// on the zht page { zht, zhs, en } -> { zht, en }. An object is only
// stripped when its own-script value is a non-empty string, so a page never
// loses its only copy of something (cn()'s fallback and hasSource() keep
// working on objects that are only filled in for the other script).
export function stripOtherScript(value: any, cnField: 'zht' | 'zhs'): any {
  if (Array.isArray(value)) return value.map((v) => stripOtherScript(v, cnField));
  if (value && typeof value === 'object') {
    const other = cnField === 'zht' ? 'zhs' : 'zht';
    const own = value[cnField];
    const dropOther = typeof own === 'string' && own.trim() !== '';
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (dropOther && k === other) continue;
      out[k] = stripOtherScript(v, cnField);
    }
    return out;
  }
  return value;
}

// One chapter as the client script needs it: no relationships /
// journeyOverviews (only the map/journey code reads those), and only this
// page's script. includePassages=false gives metadata only, for the
// sidebar structures where passages would be pure duplication.
export function toClientChapter(chapter: any, cnField: 'zht' | 'zhs', includePassages = true): any {
  const { relationships, journeyOverviews, passages, ...rest } = chapter;
  return stripOtherScript(includePassages ? { ...rest, passages } : rest, cnField);
}

// bookSections keeps its full shape (sections -> chapters, and
// numGroups -> chapters), but with chapter metadata only. Each chapter
// already ships in full, once, in `chapters`.
export function toClientBookSections(bookSections: any[], cnField: 'zht' | 'zhs'): any[] {
  return bookSections.map((section) => ({
    ...section,
    label: stripOtherScript(section.label, cnField),
    chapters: section.chapters.map((ch: any) => toClientChapter(ch, cnField, false)),
    numGroups: (section.numGroups ?? []).map((g: any) => ({
      ...g,
      chapters: g.chapters.map((ch: any) => toClientChapter(ch, cnField, false)),
    })),
  }));
}

// Paragraph-aware version of linkify(), for long annotation text — a
// blank line (\n\n) in the source JSON marks a paragraph break. Each
// resulting chunk is escaped/linkified independently, then wrapped in
// its own <p>. The container this fills must be a <div>, not a <p> —
// <p> elements can't validly contain nested <p> tags.
export function linkifyParagraphs(text: unknown): string {
  const raw = String(text ?? '');
  const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return '';
  return paragraphs.map(p => `<p>${linkify(p)}</p>`).join('');
}

// For Parallel view specifically: interleaves original/English paragraphs
// (zh-para-1, en-para-1, zh-para-2, en-para-2, ...) instead of showing
// two separate stacked blocks — only when both languages split into the
// SAME number of paragraphs. If the counts don't match (a translator
// added a break in one language but not the other), interleaving would
// silently misalign content, so it falls back to the plain two-block
// layout instead — safer than guessing a pairing.
export function linkifyParagraphPairs(
  zhText: unknown,
  enText: unknown,
  langAttr: string
): string {
  const zhParas = String(zhText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const enParas = String(enText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  if (zhParas.length > 1 && zhParas.length === enParas.length) {
    return zhParas.map((zhP, i) => `
      <p class="ann-para ann-para-zh" lang="${langAttr}">${linkify(zhP)}</p>
      <p class="ann-para ann-para-en">${linkify(enParas[i])}</p>
    `).join('');
  }

  return `
    <div class="ann-zh" lang="${langAttr}">${zhParas.map(p => `<p>${linkify(p)}</p>`).join('')}</div>
    <div class="ann-en">${enParas.map(p => `<p>${linkify(p)}</p>`).join('')}</div>
  `;
}

// The 白話 view's counterpart of linkifyParagraphPairs(): same layout, with
// the vernacular taking the English slot (classical paragraph, then its
// vernacular paragraph, and so on). Rendered as its own block, shown only
// in the 白話 view; the normal block is hidden in that view when this one
// exists (see .has-vern in the page CSS). Same fallback rule as the English
// pairing: if the paragraph counts differ, two plain stacked blocks are
// used rather than guessing a pairing.
export function linkifyParagraphPairsVern(
  zhText: unknown,
  vernText: unknown,
  langAttr: string
): string {
  const zhParas = String(zhText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const vernParas = String(vernText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  if (zhParas.length > 1 && zhParas.length === vernParas.length) {
    return zhParas.map((zhP, i) => `
      <p class="ann-para ann-para-zh" lang="${langAttr}">${linkify(zhP)}</p>
      <p class="ann-para ann-para-vern" lang="${langAttr}">${linkify(vernParas[i])}</p>
    `).join('');
  }

  return `
    <div class="ann-zh" lang="${langAttr}">${zhParas.map(p => `<p>${linkify(p)}</p>`).join('')}</div>
    <div class="ann-vern" lang="${langAttr}">${vernParas.map(p => `<p>${linkify(p)}</p>`).join('')}</div>
  `;
}
