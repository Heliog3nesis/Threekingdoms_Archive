// journey.js
// Person-journey overview panel: fetches a journey's pin/timeline data,
// renders the #imap-journey-panel content (header, timeline, per-year
// kingdom-colored markers), and manages the map pins/boundary highlights
// that go with the currently-viewed journey. Split out of
// interactive-map.js to keep that file from growing indefinitely -
// everything here is specific to the journey feature; shared map/UI
// state and utilities are imported from interactive-map.js below.

import { url } from '../../utils/url';
import {
  map,
  mapReady,
  currentLang,
  uiText,
  isChineseMap,
  escapeHtml,
  allTowns,
  KINGDOM_LINE,
  PROVINCE_KINGDOM,
  getAdminKingdom,
  fetchAdminBoundaries,
  fetchWaterBodies,
  openTownDetail,
  showAdminBoundaryById,
  showWaterBodyById,
  setPendingJourney,
  clearJourneyBoundaries,
  renderJourneyBoundaryLayer,
  clearWaterBodyHighlight,
  convertGeometryToLngLat,
  computeGeometryBounds,
  WATER_BODIES_ARE_WEB_MERCATOR,
  FULL_EXTENT_PADDING,
  JOURNEY_BOUNDARY_SOURCE,
  JOURNEY_BOUNDARY_LAYER,
  registerRenderJourneyView
} from './interactive-map.js';

let currentJourneyId = null;
let currentJourneyOverviews = [];
let currentJourneyPersonIndex = 0;
let journeyMarkers = [];

function clearJourneyMarkers() {
  journeyMarkers.forEach(m => m.remove());
  journeyMarkers = [];
}

// clearJourneyBoundaries lives in interactive-map.js now (imported above)
// since interactive-map.js's own clearRegionHighlight needs it too, and
// having it there means interactive-map.js never has to import anything
// back from this file - avoiding a circular import between the two.

// renderJourneyBoundaryLayer now lives in interactive-map.js (imported
// above) since interactive-map.js's own highlightTownContext needs it
// too, for the single-commandery black-border highlight on a town click
// - same reasoning as clearJourneyBoundaries living there.

async function fetchJourney(journeyId) {
  if (!journeyId) return null;
  try {
    const res = await fetch(url(`/mapbase/journeys/${journeyId}.json`));
    if (!res.ok) {
      console.warn(`[journey] fetch failed for "${journeyId}": ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[journey] fetch threw for "${journeyId}":`, err);
    return null;
  }
}

// JOURNEY OVERVIEW PANEL ──────────────────────────────────────
// Renders the currently-selected person (currentJourneyOverviews[
// currentJourneyPersonIndex]) into #imap-journey-panel — name, dates,
// and a chronological stop timeline. map-overall.astro owns the actual
// toggle/show-hide chrome around this panel; this only fills its content.

function pickZh(field) {
  if (!field) return '';
  if (currentLang === 'zh-hans') return field.zhs || field.zht || '';
  return field.zht || field.zhs || '';
}

// Every bilingual field in the journey panel (name, courtesy name,
// location) follows the same rule: whichever language the page is
// actually in gets the big/bright treatment, the other stays small and
// secondary. Returns HTML for the "primary <secondary>" pattern, with
// the secondary wrapped in secondaryClass for CSS to de-emphasize -
// or just the primary alone if there's no secondary to show.
function bilingualDisplay(en, zh, secondaryClass) {
  const primary = isChineseMap() ? zh : en;
  const secondary = isChineseMap() ? en : zh;
  if (!primary) return escapeHtml(secondary || '');
  if (!secondary) return escapeHtml(primary);
  return `${escapeHtml(primary)} <span class="${secondaryClass}">${escapeHtml(secondary)}</span>`;
}

// journeyOverviews[].person is a single string, not a {en,zht,zhs}
// object — there's currently no English name field anywhere in this
// data. Chinese convention wraps a courtesy name in full-width
// parentheses after the given name (e.g. "李典（曼成）"), so that's
// parsed apart here; a bare name with no parentheses just has no
// courtesy name to show.
function parsePersonString(raw) {
  const str = String(raw ?? '').trim();
  const match = str.match(/^(.+?)(?:（([^）]+)）)?$/);
  return {
    name: match?.[1]?.trim() || str,
    courtesyName: match?.[2]?.trim() || ''
  };
}

// born/died are {era: {en,zht,zhs}, year} — year may be a number, a
// string like "180?", or absent/null when genuinely unknown.
const UNKNOWN_ERA_VALUES = new Set(['unknown', '不詳', '不详']);

// Strips a leading modifier word ("after", "before", "around", "early",
// "late" - optionally followed by "the") from the front of a year or era
// string, so the same modifier-handling can apply to either one
// independently rather than being baked into the era-specific parsing
// only. Returns the modifier (or null) and whatever text is left.
function extractModifier(text) {
  const m = text.match(/^(before|after|around|early|late)\s+(?:the\s+)?(.+)$/i);
  return m ? { modifier: m[1].toLowerCase(), rest: m[2] } : { modifier: null, rest: text };
}

// Wraps already-compacted text with a short prefix for whichever
// modifier applied. "Aft"/"Bef" read clearly as directional shorthand
// without needing a symbol; "~" stays for "around" since that one really
// is closer to a single mark than a word; "Early"/"Late" keep their full
// word since they qualify which part of that specific year/era it was,
// not a range relative to it.
function applyModifierPrefix(modifier, text) {
  switch (modifier) {
    case 'after': return `Aft ${text}`;
    case 'before': return `Bef ${text}`;
    case 'around': return `~${text}`;
    case 'early': return `Early ${text}`;
    case 'late': return `Late ${text}`;
    default: return text;
  }
}

// Compacts verbose ordinal era phrasing ("15th year of Jian'an" -> "Jian'an
// 15") to save space in the timeline. Any leading modifier is expected to
// already have been stripped by extractModifier before this runs - this
// only handles the "Nth year of X" shape itself. Falls back to the
// original string unchanged for anything that doesn't match, rather than
// mangling text in an unexpected format. Chinese era strings are already
// compact natively (建安十五年) and don't go through this - only the
// English side does.
function compactEraLabel(era) {
  // Range form first ("19th - 20th year of Jian'an", or "19 - 20th year
  // of..." where only the second number carries the ordinal suffix, a
  // common English style for ranges) - more specific than the single-year
  // pattern below, so tried first to avoid the single-year regex
  // accidentally matching just the tail end of a range and dropping the
  // first number.
  const range = era.match(/^(\d+)(?:st|nd|rd|th)?\s*-\s*(\d+)(?:st|nd|rd|th)\s+years?\s+of\s+(.+)$/i);
  if (range) return `${range[3]} ${range[1]} - ${range[2]}`;

  const single = era.match(/^(\d+)(?:st|nd|rd|th)\s+year\s+of\s+(.+)$/i);
  return single ? `${single[2]} ${single[1]}` : era;
}

function formatJourneyEraYear(entry) {
  if (!entry) return null;
  let year = entry.year != null ? String(entry.year) : '';
  let era = isChineseMap() ? pickZh(entry.era) : (entry.era?.en || '');
  if (UNKNOWN_ERA_VALUES.has(era.trim().toLowerCase())) era = '';
  // Modifier handling (Aft/Bef/~/Early/Late) applies to whichever of
  // year/era actually carries it - the two are independent, since a
  // journey entry could have a fuzzy year with a precise era or vice
  // versa. Chinese era strings skip the compacting step (already
  // compact) but could in principle still carry a Chinese modifier -
  // left as English-only for now since that's what's actually in the data.
  if (year) {
    const { modifier, rest } = extractModifier(year);
    year = applyModifierPrefix(modifier, rest);
  }
  if (era && !isChineseMap()) {
    const { modifier, rest } = extractModifier(era);
    era = applyModifierPrefix(modifier, compactEraLabel(rest));
  }
  if (!year && !era) return null;
  return { year, era };
}

// A stop's location can be a single {en,zht,zhs} object or an array of
// them — each one becomes its own clickable span (data-journey-loc holds
// a JSON-encoded resolved entry so the click handler, wired up after
// this HTML is inserted, knows what to open), joined by " / " when there
// are multiple.
function formatJourneyLocation(location, resolvedLocations) {
  const locs = Array.isArray(location) ? location : [location];
  const resolved = resolvedLocations ?? [];
  return locs
    .filter(Boolean)
    .map((l, i) => {
      const label = bilingualDisplay(l.en, pickZh(l), 'imap-journey-loc-secondary');
      const entry = resolved[i];
      if (!label) return '';
      if (!entry) return `<div>${label}</div>`;
      return `<div class="imap-journey-loc-link" data-journey-loc='${escapeHtml(JSON.stringify(entry))}'>${label}</div>`;
    })
    .filter(Boolean)
    .join('');
}

function formatJourneyPosition(positionLinks) {
  if (!positionLinks?.length) return '';
  return positionLinks
    .filter(seg => seg.en)
    .map(seg => {
      const label = seg.url
        ? `<a href="${url(seg.url)}" target="_blank" rel="noopener">${escapeHtml(seg.en)}</a>`
        : escapeHtml(seg.en);
      return `<div>${label}</div>`;
    })
    .join('');
}

// Resolves a journey stop's town entry back to the full town record, so
// clicking it can open the same detail cards a map pin click would.
function findTownForResolvedEntry(entry) {
  if (!entry || entry.kind !== 'town') return null;
  return allTowns.find(t => Number(t?.Latitude) === entry.lat && Number(t?.Longitude) === entry.lng) ?? null;
}

// Looks up which kingdom a single resolved location belongs to - towns
// resolve synchronously (allTowns is already loaded by the time a
// journey can be opened), admin boundaries and water bodies need their
// caches fetched first since those load lazily on demand elsewhere.
async function getResolvedLocationKingdom(entry) {
  if (!entry) return 'unknown';
  if (entry.kind === 'town') {
    const town = findTownForResolvedEntry(entry);
    return town ? (town.kingdom || PROVINCE_KINGDOM[town.Prov_EN] || 'unknown') : 'unknown';
  }
  if (entry.kind === 'admin') {
    const adminFeatures = await fetchAdminBoundaries();
    const raw = adminFeatures.find(f => f.properties?.id === entry.id);
    return raw ? getAdminKingdom(raw.properties) : 'unknown';
  }
  if (entry.kind === 'water') {
    const waterFeatures = await fetchWaterBodies();
    const raw = waterFeatures.find(f => f.properties?.id === entry.id);
    return raw?.properties?.kingdom || 'unknown';
  }
  return 'unknown';
}

// A year's marker takes the color of whichever kingdom shows up most
// among that year's resolved locations - majority vote across every
// entry stacked under the same year, not just the first one, since a
// year with multiple stops could genuinely straddle two kingdoms (e.g.
// a defection). Ties resolve to whichever kingdom was encountered first.
async function computeGroupKingdom(group) {
  const allEntries = group.entries.flatMap(stop => stop.resolvedLocations ?? []);
  if (!allEntries.length) return 'unknown';
  const kingdoms = await Promise.all(allEntries.map(getResolvedLocationKingdom));
  const counts = {};
  kingdoms.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  delete counts.unknown;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || 'unknown';
}

// Groups a person's raw stop list for rendering: the very first stop is
// always their hometown (this is a hard rule about the data's shape, not
// something inferred from having/lacking a year - an undated hometown
// stays its own "Hometown" group even if some later stop happens to
// also be undated), and any run of consecutive stops sharing the exact
// same year collapses into one timeline marker with all of them stacked
// underneath it. Undated non-hometown stops never group with each other
// even if adjacent, since each is independently unknown, not
// necessarily the same event.
function groupJourneyStops(stops) {
  const groups = [];
  (stops ?? []).forEach((stop, i) => {
    if (i === 0) {
      groups.push({ isHometown: true, year: null, era: null, entries: [stop] });
      return;
    }
    const yearEra = formatJourneyEraYear(stop);
    const year = yearEra?.year || '';
    const last = groups[groups.length - 1];
    if (year && last && !last.isHometown && last.year === year) {
      last.entries.push(stop);
    } else {
      groups.push({ isHometown: false, year, era: yearEra?.era || '', entries: [stop] });
    }
  });
  return groups;
}

function renderJourneyStopEntry(stop) {
  const location = formatJourneyLocation(stop.location, stop.resolvedLocations);
  const position = formatJourneyPosition(stop.positionLinks);
  if (!location && !position) return '';
  return `
    <div class="imap-journey-stop-entry">
      ${location ? `<div class="imap-journey-stop-location">${location}</div>` : ''}
      ${position ? `
        <div class="imap-journey-stop-position-label">${escapeHtml(uiText.titlesLabel)}</div>
        <div class="imap-journey-stop-position">${position}</div>
      ` : ''}
    </div>
  `;
}

// When a group's own resolved locations can't establish a kingdom (an
// undated stop with no place attached, or a location that just doesn't
// resolve), it borrows from whichever neighboring group in the timeline
// does have one - a stop with no location of its own still happened
// somewhere in the same general run of the person's life, so a neighbor's
// kingdom is a far better guess than the flat default gold. Checks
// backward and forward independently rather than just picking the
// nearest in either direction, so that if both sides have an answer and
// they disagree (e.g. this gap sits right at a border crossing), the
// earlier one wins per the specified tie-break rule - order in a
// timeline being what actually happened matters more here than
// proximity by index count alone.
function resolveKingdomsWithNeighborFallback(rawKingdoms) {
  return rawKingdoms.map((k, i) => {
    if (k && k !== 'unknown') return k;
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (rawKingdoms[j] && rawKingdoms[j] !== 'unknown') { prev = rawKingdoms[j]; break; }
    }
    let next = null;
    for (let j = i + 1; j < rawKingdoms.length; j++) {
      if (rawKingdoms[j] && rawKingdoms[j] !== 'unknown') { next = rawKingdoms[j]; break; }
    }
    if (prev && next) return prev; // both sides disagree (or agree) - previous wins either way
    return prev || next || 'unknown';
  });
}

function renderJourneyStopGroup(group, kingdom) {
  const entriesHtml = group.entries.map(renderJourneyStopEntry).filter(Boolean).join('');
  if (!entriesHtml) return '';

  const dated = !group.isHometown && (!!group.year || !!group.era);
  const colorStyle = (kingdom && kingdom !== 'unknown') ? ` style="color: ${KINGDOM_LINE[kingdom]};"` : '';
  const whenLabel = group.isHometown
    ? `<div class="imap-journey-stop-when-label"${colorStyle}>${escapeHtml(uiText.hometown)}</div>`
    : dated
      ? `<div class="imap-journey-stop-when-label imap-journey-stop-when-dated"${colorStyle}>${escapeHtml([group.year, group.era].filter(Boolean).join(' · '))}</div>`
      : `<div class="imap-journey-stop-when-label"${colorStyle}>${escapeHtml(uiText.dateUnknown)}</div>`;

  return `
    <div class="imap-journey-stop ${dated ? 'imap-journey-stop-dated' : 'imap-journey-stop-undated'}">
      ${whenLabel}
      ${entriesHtml}
    </div>
  `;
}

// Prefers the explicit name/courtesyName fields (added directly to the
// chapter JSON) when present — giving a proper EN name alongside the
// Chinese, which the bare person ID string alone can't provide. Falls
// back to parsing person (Chinese-only, no EN available that way) for
// any chapter that hasn't had these fields added yet.
function resolvePersonDisplay(person) {
  if (person.name) {
    return {
      nameEn: person.name.en || '',
      nameZh: pickZh(person.name),
      courtesyEn: person.courtesyName?.en || '',
      courtesyZh: pickZh(person.courtesyName)
    };
  }
  const parsed = parsePersonString(person.person);
  return {
    nameEn: '',
    nameZh: parsed.name,
    courtesyEn: '',
    courtesyZh: parsed.courtesyName
  };
}

// Appends a footnote asterisk directly after an uncertain ("foo?") year
// value, rather than just once at the end of the whole date line - so it
// stays attached to whichever specific year is actually uncertain (birth
// known, death unknown, or vice versa).
function markUncertainYear(year) {
  if (!year) return '?';
  return /\?/.test(year) ? `${year}*` : year;
}

async function showJourneyPanel() {
  const panel = document.getElementById('imap-journey-panel');
  if (!panel || !currentJourneyOverviews.length) return;

  const person = currentJourneyOverviews[currentJourneyPersonIndex];

  // Making the panel visible (and therefore triggering whatever CSS
  // layout shift shrinks the map's own width to make room for it) has to
  // happen BEFORE drawJourneyItems below - otherwise fitBounds calculates
  // zoom against the map's old, wider pre-panel size, and the map ends up
  // stuck showing far more area than intended once the panel actually
  // appears and narrows it. This bit doesn't depend on any of this
  // person's actual content, so it's safe to do this early.
  const trigger = document.getElementById('imap-journey-toggle');
  if (trigger) {
    trigger.style.display = '';
    trigger.setAttribute('aria-expanded', 'true');
  }
  const journeyDropdown = document.getElementById('imap-journey-dropdown');
  if (journeyDropdown) {
    journeyDropdown.classList.add('imap-journey-has-data');
    journeyDropdown.style.display = 'block';
  }

  // Only this person's own locations, not everyone's combined — a
  // location shared with another person in the same journey (e.g. a
  // family estate) still shows, since it's tagged with every person
  // whose stops include it.
  const personPins = currentJourneyPins.filter(pin => pin.persons?.includes(person.person));
  const journeyBounds = await drawJourneyItems(personPins);

  const { nameEn, nameZh, courtesyEn, courtesyZh } = resolvePersonDisplay(person);
  const born = formatJourneyEraYear(person.born);
  const died = formatJourneyEraYear(person.died);
  const hasMultiplePeople = currentJourneyOverviews.length > 1;
  const stopGroups = groupJourneyStops(person.stops);

  const bioUrl = currentJourneyId ? url(`/translations/sanguozhi/${currentJourneyId}`) : null;

  // The footnote only makes sense if a "?" actually appears somewhere on
  // the card - an explanation for a symbol that isn't present would just
  // be confusing clutter.
  const hasUncertainYear = [born?.year, died?.year, ...stopGroups.map(g => g.year)].some(y => y && /\?/.test(y));
  const rawKingdoms = await Promise.all(stopGroups.map(computeGroupKingdom));
  const kingdoms = resolveKingdomsWithNeighborFallback(rawKingdoms);
  const timelineHtml = stopGroups.map((group, i) => renderJourneyStopGroup(group, kingdoms[i])).join('');

  panel.innerHTML = `
    <div class="imap-journey-header">
      ${/* Placeholder for a future "connections web" feature, mirroring
           the biography icon on the opposite corner - not rendered yet
           since there's nothing for it to link to. */''}
      ${bioUrl ? `
        <a class="imap-journey-bio-link" href="${bioUrl}" target="_blank" rel="noopener" aria-label="${escapeHtml(uiText.biography)}" title="${escapeHtml(uiText.biography)}">
          <i class="ti ti-book-2" aria-hidden="true"></i>
        </a>
      ` : ''}
      <div class="imap-journey-header-nav">
        ${hasMultiplePeople ? `<button class="imap-journey-arrow" id="imap-journey-prev" type="button" aria-label="${escapeHtml(uiText.previousPerson)}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>` : ''}
        <div class="imap-journey-header-info">
          <div class="imap-journey-name">${bilingualDisplay(nameEn, nameZh, 'imap-journey-name-secondary')}</div>
          ${(courtesyEn || courtesyZh) ? `<div class="imap-journey-courtesy">${bilingualDisplay(courtesyEn, courtesyZh, 'imap-journey-courtesy-secondary')}</div>` : ''}
        </div>
        ${hasMultiplePeople ? `<button class="imap-journey-arrow" id="imap-journey-next" type="button" aria-label="${escapeHtml(uiText.nextPerson)}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>` : ''}
      </div>
      ${hasMultiplePeople ? `<div class="imap-journey-person-count">${currentJourneyPersonIndex + 1} / ${currentJourneyOverviews.length}</div>` : ''}
    </div>
    ${(born || died) ? `
      <div class="imap-journey-dates">
        <div class="imap-journey-dates-num">${escapeHtml(markUncertainYear(born?.year))} &ndash; ${escapeHtml(markUncertainYear(died?.year))}</div>
        ${(born?.era || died?.era) ? `<div class="imap-journey-dates-era">${escapeHtml(born?.era || '?')} &ndash; ${escapeHtml(died?.era || '?')}</div>` : ''}
      </div>
    ` : ''}
    <div class="imap-journey-timeline">
      ${timelineHtml}
    </div>
    ${hasUncertainYear ? `<div class="imap-journey-footnote">* ${escapeHtml(uiText.uncertainYearNote)}</div>` : ''}
  `;

  panel.querySelector('#imap-journey-prev')?.addEventListener('click', (e) => { e.stopPropagation(); switchJourneyPerson(-1); });
  panel.querySelector('#imap-journey-next')?.addEventListener('click', (e) => { e.stopPropagation(); switchJourneyPerson(1); });

  panel.querySelectorAll('.imap-journey-loc-link').forEach(el => {
    el.addEventListener('click', () => {
      let entry;
      try {
        entry = JSON.parse(el.dataset.journeyLoc);
      } catch {
        return;
      }
      if (entry.kind === 'town') {
        const town = findTownForResolvedEntry(entry);
        if (town) openTownDetail(town, [entry.lng, entry.lat], { keepJourney: true });
      } else if (entry.kind === 'admin') {
        showAdminBoundaryById(entry.id);
      } else if (entry.kind === 'water') {
        showWaterBodyById(entry.id);
      }
    });
  });

  const exitBtn = document.getElementById('imap-journey-exit');
  if (exitBtn) exitBtn.innerHTML = `<i class="ti ti-logout" aria-hidden="true"></i> ${escapeHtml(uiText.exitJourney)}`;

  // Fit to this person's content only now - after the dropdown's own
  // visibility toggle above AND the full panel HTML just inserted have
  // both actually landed, not from partway through drawJourneyItems'
  // own execution earlier. resize() first forces MapLibre to re-measure
  // its container's current pixel size (reading offsetWidth/offsetHeight
  // internally forces the browser to flush any pending layout first),
  // so fitBounds calculates against a size that's guaranteed current.
  if (journeyBounds) {
    map.resize();
    map.fitBounds(journeyBounds, {
      padding: FULL_EXTENT_PADDING,
      duration: 900,
      // Higher than fitAllTowns' 5.2 (that one's deliberately a country-wide
      // overview) since a single person's journey is usually far more
      // localized - this just raises the ceiling for how close fitBounds
      // is allowed to zoom when their locations are tightly clustered; a
      // genuinely wide-spanning journey still ends up wherever its actual
      // bounds put it, since fitBounds never zooms in past what the point
      // spread allows regardless of this cap.
      maxZoom: 11
    });
  }
}

function switchJourneyPerson(delta) {
  if (!currentJourneyOverviews.length) return;
  currentJourneyPersonIndex = (currentJourneyPersonIndex + delta + currentJourneyOverviews.length) % currentJourneyOverviews.length;
  showJourneyPanel();
}

// Left/right cycles through people in the current journey, same as
// clicking the prev/next arrows - only while the journey panel actually
// has more than one person to switch between, and never while the user
// is typing somewhere else on the page (search box, etc.).
document.addEventListener('keydown', (e) => {
  if (currentJourneyOverviews.length <= 1) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (e.key === 'ArrowLeft') switchJourneyPerson(-1);
  else if (e.key === 'ArrowRight') switchJourneyPerson(1);
});

function hideJourneyPanel() {
  const panel = document.getElementById('imap-journey-panel');
  if (panel) panel.innerHTML = '';
  const trigger = document.getElementById('imap-journey-toggle');
  if (trigger) {
    trigger.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
  }
  const journeyDropdown = document.getElementById('imap-journey-dropdown');
  if (journeyDropdown) {
    journeyDropdown.classList.remove('imap-journey-has-data');
    journeyDropdown.style.display = 'none';
  }
  currentJourneyOverviews = [];
  currentJourneyPersonIndex = 0;
  currentJourneyPins = [];
}

// Leaves journey mode entirely — clears the ?journey= URL param (via
// history.replaceState, no reload), the pins/boundaries, and the panel.
// Camera position is left untouched deliberately, so exiting doesn't
// disrupt wherever the reader currently is on the map.
export function exitJourneyMode() {
  currentJourneyId = null;
  const params = new URLSearchParams(window.location.search);
  params.delete('journey');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);

  clearJourneyMarkers();
  clearJourneyBoundaries();
  hideJourneyPanel();
}


let currentJourneyPins = [];

// Draws pins + admin/water boundaries for the given items and fits the
// map to their extent — extracted from renderJourneyView so it can also
// be called with a filtered subset (just the currently-active person's
// own locations) whenever the panel switches person.
// Draws pins + admin/water boundaries for the given items, and returns
// the bounds they cover (or null if nothing had a real location) -
// deliberately does NOT call fitBounds itself. That's left to the
// caller, so it can be done only once the panel's own visibility change
// and HTML have actually landed, rather than potentially racing ahead of
// them from partway through this function's own execution.
async function drawJourneyItems(items) {
  clearJourneyMarkers();
  clearJourneyBoundaries();

  if (!Array.isArray(items) || !items.length) return null;

  const bounds = new maplibregl.LngLatBounds();
  let hasBounds = false;

  // ── Town pins — a pure overview, every place is equal; click any of
  // them to open its own detail popup. ──
  items.forEach(item => {
    if (item?.kind !== 'town') return;
    const itemLat = Number(item?.lat);
    const itemLng = Number(item?.lng);
    if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return;

    const el = document.createElement('div');
    el.className = 'imap-journey-pin';
    // Classic teardrop map-pin silhouette — an SVG rather than a CSS
    // shape hack, so the point is pixel-precise for anchoring. Sized
    // 26x34 so the visual tip sits exactly at (13, 34), matching the
    // anchor:'bottom' below.
    el.innerHTML = `
      <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.5 13 21 13 21s13-11.5 13-21C26 5.8 20.2 0 13 0z" fill="#111111" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="13" cy="13" r="5" fill="#ffffff"/>
      </svg>
    `;

    // Resolve the full town record so clicking any pin opens its own
    // detail popup, without clearing the rest of the journey pins.
    const pinTown = allTowns.find(t => {
      if (Number(t?.Latitude) !== itemLat || Number(t?.Longitude) !== itemLng) return false;
      if (!item?.name) return true;
      return [t.Town_EN, t.Town_CH, t.Town_CHS].some(
        value => String(value ?? '').toLowerCase() === String(item.name).toLowerCase()
      );
    }) ?? null;

    if (pinTown) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openTownDetail(pinTown, [itemLng, itemLat], { keepJourney: true });
      });
    }

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([itemLng, itemLat])
      .addTo(map);

    journeyMarkers.push(marker);
    bounds.extend([itemLng, itemLat]);
    hasBounds = true;
  });

  // ── Admin boundaries / water bodies — bold border, no pin (they're
  // areas/lines, not points) ──
  const adminIds = items.filter(i => i?.kind === 'admin').map(i => Number(i.id));
  const waterIds = items.filter(i => i?.kind === 'water').map(i => Number(i.id));

  if (adminIds.length || waterIds.length) {
    const [adminFeatures, waterFeatures] = await Promise.all([
      adminIds.length ? fetchAdminBoundaries() : Promise.resolve([]),
      waterIds.length ? fetchWaterBodies() : Promise.resolve([])
    ]);

    const matched = [
      ...adminFeatures.filter(f => adminIds.includes(Number(f.properties?.id))),
      ...waterFeatures.filter(f => waterIds.includes(Number(f.properties?.id)))
    ];

    const boundaryFeatures = matched.map(f => {
      const convertedGeometry = convertGeometryToLngLat(f.geometry, WATER_BODIES_ARE_WEB_MERCATOR);
      const geomBounds = computeGeometryBounds(convertedGeometry);
      if (!geomBounds.isEmpty()) {
        bounds.extend(geomBounds.getSouthWest());
        bounds.extend(geomBounds.getNorthEast());
        hasBounds = true;
      }
      return { type: 'Feature', properties: f.properties || {}, geometry: convertedGeometry };
    });

    renderJourneyBoundaryLayer({ type: 'FeatureCollection', features: boundaryFeatures }, {
      lineWidth: ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 4, 12, 5.5],
      lineDasharray: [0.3, 1.5]
    });
  }

  return hasBounds ? bounds : null;
}

export async function renderJourneyView(journeyData) {
  if (!map || !mapReady) return;

  // Clears any previous popup/highlight (but not journey state, which is
  // now independent — see clearWaterBodyHighlight's own comment).
  clearWaterBodyHighlight();
  // Explicitly clear any PREVIOUS journey's own pins before drawing this
  // one's — e.g. navigating from one chapter's "view life journey" link
  // straight to another's, without an exit in between.
  clearJourneyMarkers();

  const items = journeyData?.pins;
  if (!Array.isArray(items) || !items.length) return;

  currentJourneyPins = items;
  currentJourneyOverviews = journeyData?.journeyOverviews ?? [];
  currentJourneyPersonIndex = 0;
  showJourneyPanel();
}

// interactive-map.js's initInteractiveMap needs to call this (for the
// "arrived via a deep link while the map was still loading" case), but
// can't import it directly without creating a circular dependency back
// to this file - so this file hands it over as a callback instead.
registerRenderJourneyView(renderJourneyView);

export async function showJourney(journeyId) {
  if (!journeyId) return;
  currentJourneyId = journeyId;
  const data = await fetchJourney(journeyId);
  if (!data || !data.pins?.length) {
    if (data && Array.isArray(data)) {
      console.warn(
        `[journey] "${journeyId}.json" is a bare array — this looks like it was built by an older version of build-journeys.mjs. ` +
        `Re-run the script and redeploy the file; it should now be shaped { pins, journeyOverviews, relationships }.`
      );
    } else if (data) {
      console.warn(`[journey] "${journeyId}.json" has no pins:`, data);
    }
    return;
  }

  if (map && mapReady) {
    renderJourneyView(data);
  } else {
    // store for the load handler — same deferred pattern as pendingFlyTo
    setPendingJourney({ data });
  }
}

