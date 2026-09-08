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
