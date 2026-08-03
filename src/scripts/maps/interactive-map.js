// interactive-map.js
// Fully self-contained MapTiler SDK interactive map for the Three Kingdoms Archive.
// Fetches its own data; exposes initInteractiveMap() and flyToLocation().

// CONFIG 
import { url } from '../../utils/url';
const MAPTILER_KEY = 'cFkDNINBrduwymf4YJRx';
const MAP_STYLES = {
  outdoor: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
};

const PROVINCE_KINGDOM = {
  'Bingzhou': 'wei', 'Jizhou': 'wei', 'Qingzhou': 'wei',
  'Yanzhou': 'wei', 'Yuzhou': 'wei', 'Youzhou': 'wei',
  'Liangzhou': 'wei', 'Sili': 'wei', 'Yongzhou': 'wei',
  'Xuzhou': 'wei', 'Jingzhou (Wei)': 'wei', 'Yangzhou (Wei)': 'wei',
  'Yizhou (North)': 'shu', 'Yizhou (South)': 'shu',
  'Jiaozhou': 'wu', 'Jingzhou (Wu)': 'wu', 'Yangzhou (Wu)': 'wu',
};

const KINGDOM_FILL = {
  wei: 'rgba(75,111,159,0.14)',
  shu: 'rgba(90,170,120,0.14)',
  wu: 'rgba(200,96,96,0.14)',
  unknown: 'rgba(120,120,120,0.05)'
};

const KINGDOM_LINE = {
  wei: '#4b6f9f',
  shu: '#4FA878',
  wu: '#C86464',
  unknown: '#777777'
};

const KINGDOM_DOT = {
  wei: '#6f93c4',
  shu: '#6ED4A0',
  wu: '#D4807A',
  unknown: '#888888'
};

const KINGDOM_LABEL = {
  wei: 'Wei',
  shu: 'Shu',
  wu: 'Wu',
  unknown: ''
};

const UI_TEXT = {
  en: {
    unnamedLocation: 'Unnamed location', settlement: 'Settlement', modern: 'Modern:', administrativeNote: 'Administrative Note', close: 'Close', showAllTowns: 'Show all towns', failedToLoadMap: 'Failed to load map', waterBody: 'River', province: 'Province', commandery: 'Commandery', tributary: 'Tributary Tribes',
    kingdomLabels: { wei: 'Wei', shu: 'Shu', wu: 'Wu', unknown: '' },
    typeLabels: { 'Provincial Seat': 'Provincial Seat', 'Commandery Seat': 'Commandery Seat', 'County Seat': 'County Seat', 'Military Pass': 'Military Pass', Landmark: 'Landmark', Others: 'Others' }
  },
  'zh-hant': {
    unnamedLocation: '未命名地點', settlement: '地點', modern: '現代位置：', administrativeNote: '政區考釋', close: '關閉', showAllTowns: '顯示全部地點', failedToLoadMap: '地圖加載失敗', waterBody: '河流', province: '州', commandery: '郡', tributary: '臣屬部落',
    kingdomLabels: { wei: '魏', shu: '蜀', wu: '吳', unknown: '' },
    typeLabels: { 'Provincial Seat': '州治', 'Commandery Seat': '郡治', 'County Seat': '縣治', 'Military Pass': '關隘', Landmark: '地標', Others: '其他' }
  },
  'zh-hans': {
    unnamedLocation: '未命名地点', settlement: '地点', modern: '现代位置：', administrativeNote: '政区考释', close: '关闭', showAllTowns: '显示全部地点', failedToLoadMap: '地图加载失败', waterBody: '河流', province: '州', commandery: '郡', tributary: '臣属部落',
    kingdomLabels: { wei: '魏', shu: '蜀', wu: '吴', unknown: '' },
    typeLabels: { 'Provincial Seat': '州治', 'Commandery Seat': '郡治', 'County Seat': '县治', 'Military Pass': '关隘', Landmark: '地标', Others: '其他' }
  }
};

let currentLang = 'en';
let uiText = UI_TEXT.en;

function configureLocale(options = {}) {
  currentLang = options.lang || document.documentElement.lang || 'en';
  uiText = { ...UI_TEXT.en, ...(UI_TEXT[currentLang] || {}), ...(options.labels || {}) };
  uiText.kingdomLabels = { ...UI_TEXT.en.kingdomLabels, ...((UI_TEXT[currentLang] || {}).kingdomLabels || {}), ...(options.labels?.kingdomLabels || {}) };
  uiText.typeLabels = { ...UI_TEXT.en.typeLabels, ...((UI_TEXT[currentLang] || {}).typeLabels || {}), ...(options.labels?.typeLabels || {}) };
  Object.assign(KINGDOM_LABEL, uiText.kingdomLabels);
}

function isChineseMap() {
  return currentLang === 'zh-hant' || currentLang === 'zh-hans';
}

const SETTLEMENT_COLOUR = {
  provincial: '#d2a85f',
  commandery: '#ead59d',
  county: '#d8cbb4',
  military: '#ff3b30',
  landmark: '#8b5cf6',
  other: '#171717'
};
const DETAIL_SETTLEMENT_ZOOM = 7.5;

const PROVINCE_LAYERS = ['province-fill', 'province-line', 'commandery-line'];
const YELLOW_RIVER_LAYERS = ['yellow-river-old-course-halo', 'yellow-river-old-course'];
const ARCHIVE_LAYERS = [
  'towns-others-label',
  'towns-others',
  'towns-landmark-label',
  'towns-landmark',
  'towns-military-label',
  'towns-military',
  'towns-county-label',
  'towns-county',
  'towns-commandery-label',
  'towns-commandery',
  'towns-provincial-label',
  'towns-provincial',
  ...YELLOW_RIVER_LAYERS,
  ...PROVINCE_LAYERS
];
const ARCHIVE_SOURCES = ['towns', 'provinces', 'commanderies', 'yellow-river-old-course'];
const WEB_MERCATOR_RADIUS = 6378137;
const FULL_EXTENT_PADDING = { top: 56, right: 56, bottom: 56, left: 56 };

const TOWN_TYPES = {
  provincial: 'provincial',
  commandery: 'commandery',
  county: 'county',
  military: 'military',
  landmark: 'landmark',
  other: 'other'
};

// STATE 
let map = null;
let mapLoaded = false;
let mapReady = false;
let showProvinces = true;
let showLabels = false;
let showYellowRiverOldCourse = true;
let currentStyle = 'outdoor';
let provincesGeoJSONCache = null;
let commanderiesGeoJSONCache = null;
let yellowRiverOldCourseCache = null;
let baseMapModernLayers = [];
let allTowns = [];
let pendingFlyTo = null;
let pendingJourney = null; // { items } — deferred until map is ready, same pattern as pendingFlyTo
let journeyMarkers = [];
let togglesWired = false;
let styleButtonsWired = false;
let townInteractionsWired = false;
let pendingStyleRestore = false;
let activePopup = null;
let maplibregl = null;

// LOAD MAPTILER SDK FROM CDN 
async function loadMapTilerSDK() {
  if (mapLoaded) return;

  await new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.maptiler.com/maptiler-sdk-js/v3.6.1/maptiler-sdk.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdn.maptiler.com/maptiler-sdk-js/v3.6.1/maptiler-sdk.umd.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  if (!window.maptilersdk) {
    throw new Error('MapTiler SDK failed to load');
  }

  window.maptilersdk.config.apiKey = MAPTILER_KEY;
  window.maplibregl = window.maptilersdk;
  maplibregl = window.maptilersdk;
  mapLoaded = true;
}

// DATA HELPERS 
let rawAdminDataPromise = null;
function fetchRawAdminData() {
  if (!rawAdminDataPromise) {
    rawAdminDataPromise = fetch(url('/mapbase/All_Provinces.json')).then(r => r.json());
  }
  return rawAdminDataPromise;
}

async function fetchProvincesAndCommanderies() {
  const raw = await fetchRawAdminData();
  const shouldConvert = provinceDataUsesWebMercator(raw);

  const convert = f => ({
    ...f,
    geometry: convertGeometryToLngLat(f.geometry, shouldConvert),
    properties: {
      ...f.properties,
      kingdom: PROVINCE_KINGDOM[f.properties.Prov_EN] ?? 'unknown'
    }
  });

  // All_Provinces.json contains both provinces (level: 'province') and
  // commandery sub-boundaries (level: 'commandery'). The province fill/line
  // layer only ever draws the 18 true provinces; commanderies render as a
  // separate thin line layer, shown together under the same toggle.
  const provinceFeatures = raw.features.filter(f => (f.properties?.level ?? 'province') === 'province');
  const commanderyFeatures = raw.features.filter(f => f.properties?.level === 'commandery');

  return {
    provinces: {
      ...raw,
      crs: undefined,
      features: provinceFeatures.map(convert)
    },
    commanderies: {
      type: 'FeatureCollection',
      features: commanderyFeatures.map(convert)
    }
  };
}

function provinceDataUsesWebMercator(geojson) {
  const crsName = geojson?.crs?.properties?.name?.toLowerCase() ?? '';
  if (crsName.includes('3857')) return true;

  const first = firstCoordinate(geojson?.features?.[0]?.geometry?.coordinates);
  return Array.isArray(first) && (Math.abs(first[0]) > 180 || Math.abs(first[1]) > 90);
}

function firstCoordinate(coords) {
  if (!Array.isArray(coords)) return null;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') return coords;
  return firstCoordinate(coords[0]);
}

function convertGeometryToLngLat(geometry, shouldConvert) {
  if (!shouldConvert || !geometry) return geometry;

  if (geometry.type === 'GeometryCollection') {
    return {
      ...geometry,
      geometries: (geometry.geometries || []).map(g => convertGeometryToLngLat(g, shouldConvert))
    };
  }

  if (!geometry.coordinates) return geometry;

  return {
    ...geometry,
    coordinates: convertCoordinatesToLngLat(geometry.coordinates)
  };
}

function convertCoordinatesToLngLat(coords) {
  if (typeof coords?.[0] === 'number' && typeof coords?.[1] === 'number') {
    const lng = (coords[0] / WEB_MERCATOR_RADIUS) * 180 / Math.PI;
    const lat = (2 * Math.atan(Math.exp(coords[1] / WEB_MERCATOR_RADIUS)) - Math.PI / 2) * 180 / Math.PI;
    return [lng, lat];
  }

  return coords.map(convertCoordinatesToLngLat);
}

async function fetchTowns() {
  if (window.__threeKArchiveLoadTowns) {
    return window.__threeKArchiveLoadTowns();
  }

  const data = await fetch(url('/mapbase/All_Towns.json')).then(r => r.json());
  return data?.All_Towns_Details ?? data ?? [];
}

// Water bodies (rivers/lakes) are stored in EPSG:3857, same as provinces.
// They are NEVER added as a permanent map layer — only fetched for search
// matching, and rendered on-demand as a temporary highlight.
const WATER_BODIES_ARE_WEB_MERCATOR = true;
let allWaterBodiesCache = null;
let waterBodiesPromise = null;

export async function fetchWaterBodies() {
  if (allWaterBodiesCache) return allWaterBodiesCache;
  if (!waterBodiesPromise) {
    waterBodiesPromise = fetch(url('/mapbase/all_water_bodies.json'))
      .then(r => r.json())
      .then(data => {
        allWaterBodiesCache = data?.features ?? [];
        return allWaterBodiesCache;
      })
      .catch(e => {
        waterBodiesPromise = null;
        console.warn('Could not load water bodies data:', e);
        return [];
      });
  }
  return waterBodiesPromise;
}

// Admin boundaries (provinces + commanderies) for search matching + on-demand
// highlight. Shares the same underlying fetch as fetchProvincesAndCommanderies()
// (used for the always-visible base layer) via fetchRawAdminData(), so the
// file is only ever downloaded once regardless of which caller asks first.
let allAdminBoundariesCache = null;

export async function fetchAdminBoundaries() {
  if (allAdminBoundariesCache) return allAdminBoundariesCache;
  try {
    const raw = await fetchRawAdminData();
    allAdminBoundariesCache = raw?.features ?? [];
  } catch (e) {
    console.warn('Could not load admin boundaries data:', e);
    return [];
  }
  return allAdminBoundariesCache;
}

async function fetchYellowRiverOldCourse() {
  const raw = await fetch(url('/mapbase/yellow_river_old_courses.geojson')).then(r => r.json());
  const features = raw.features?.filter(feature =>
    feature.properties?.group === '汉唐故道' &&
    feature.properties?.name === '东汉故道'
  ) ?? [];

  return {
    type: 'FeatureCollection',
    features
  };
}

function normaliseTownType(type) {
  const value = String(type ?? '').trim().toLowerCase();

  if (value.includes('provincial')) return TOWN_TYPES.provincial;
  if (value.includes('commandery')) return TOWN_TYPES.commandery;
  if (value.includes('county')) return TOWN_TYPES.county;
  if (value.includes('military') || value.includes('pass')) return TOWN_TYPES.military;
  if (value.includes('landmark')) return TOWN_TYPES.landmark;

  return TOWN_TYPES.other;
}

function townTypeFilter(type) {
  return ['==', ['get', 'settlementType'], type];
}

function townLabelField() {
  if (currentLang === 'zh-hans') return ['concat', ['coalesce', ['get', 'Town_CHS'], ['get', 'Town_CH'], ['get', 'Town_EN']], '\n', ['coalesce', ['get', 'Town_EN'], '']];
  if (currentLang === 'zh-hant') return ['concat', ['coalesce', ['get', 'Town_CH'], ['get', 'Town_CHS'], ['get', 'Town_EN']], '\n', ['coalesce', ['get', 'Town_EN'], '']];
  return ['concat', ['coalesce', ['get', 'Town_EN'], ''], '\n', ['coalesce', ['get', 'Town_CH'], '']];
}

function buildTownsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: allTowns
      .filter(t => Number.isFinite(Number(t.Longitude)) && Number.isFinite(Number(t.Latitude)))
      .map(t => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(t.Longitude), Number(t.Latitude)]
        },
        properties: {
          Town_EN: t.Town_EN || t.Comm_EN || uiText.unnamedLocation,
          Town_CH: t.Town_CH,
          Town_CHS: t.Town_CHS,
          Type: t.Type,
          settlementType: normaliseTownType(t.Type),
          Prov_EN: t.Prov_EN,
          Prov_CH: t.Prov_CH,
          Prov_CHS: t.Prov_CHS,
          Comm_EN: t.Comm_EN,
          Comm_CH: t.Comm_CH,
          Comm_CHS: t.Comm_CHS,
          Modern_EN: t.Modern_EN,
          Modern_CH: t.Modern_CH,
          Modern_CHS: t.Modern_CHS,
          Modern_Province_EN: t.Modern_Province_EN,
          Modern_Province_CH: t.Modern_Province_CH,
          Modern_Province_CHS: t.Modern_Province_CHS,
          Annotation: t.Annotation,
          Longitude: t.Longitude,
          Latitude: t.Latitude,
          kingdom: PROVINCE_KINGDOM[t.Prov_EN] ?? 'unknown',
        }
      }))
  };
}

function kExpr(prop, colourMap) {
  return [
    'match',
    ['get', prop],
    'wei', colourMap.wei,
    'shu', colourMap.shu,
    'wu', colourMap.wu,
    colourMap.unknown
  ];
}

function isBaseMapModernLayer(layer) {
  if (layer.type === 'symbol') return true;

  if (layer.type !== 'line') return false;

  const text = [
    layer.id,
    layer.source,
    layer['source-layer']
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('admin') ||
    text.includes('boundary') ||
    text.includes('country') ||
    text.includes('province') ||
    text.includes('state')
  );
}

function rememberBaseMapModernLayers() {
  baseMapModernLayers = map
    .getStyle()
    .layers
    .filter(isBaseMapModernLayer)
    .map(layer => layer.id);
}

function mapTilerLanguage() {
  const language = window.maptilersdk?.Language;
  if (!language) return null;

  if (currentLang === 'zh-hans') return language.SIMPLIFIED_CHINESE ?? language.CHINESE;
  if (currentLang === 'zh-hant') return language.TRADITIONAL_CHINESE ?? language.CHINESE;

  return language.ENGLISH ?? null;
}

function applyBaseMapLanguage() {
  if (!map || !window.maptilersdk?.setLanguage) return;

  const language = mapTilerLanguage();
  if (!language) return;

  try {
    window.maptilersdk.setLanguage(map, language);
  } catch (error) {
    console.warn('Failed to apply MapTiler basemap language', error);
  }
}

function localizedBaseMapTextField() {
  if (currentLang === 'zh-hans') {
    return ['coalesce', ['get', 'name:zh-Hans'], ['get', 'name:zh'], ['get', 'name:nonlatin'], ['get', 'name']];
  }

  if (currentLang === 'zh-hant') {
    return ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name:nonlatin'], ['get', 'name']];
  }

  return null;
}

function localizeBaseMapModernLabels() {
  const textField = localizedBaseMapTextField();
  if (!map || !textField) return;

  baseMapModernLayers.forEach(layerId => {
    const layer = map.getLayer(layerId);
    if (!layer || layer.type !== 'symbol') return;
    if (!map.getLayoutProperty(layerId, 'text-field')) return;
    map.setLayoutProperty(layerId, 'text-field', textField);
  });
}

function hasThreeKArchiveLayers() {
  return map.getLayer('province-fill') && map.getLayer('towns-provincial');
}

function removeArchiveLayersAndSources() {
  ARCHIVE_LAYERS.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });

  ARCHIVE_SOURCES.forEach(sourceId => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
}

function orderSettlementLayersByHierarchy() {
  [
    'towns-others',
    'towns-landmark',
    'towns-military',
    'towns-county',
    'towns-commandery',
    'towns-provincial',
    'towns-others-label',
    'towns-landmark-label',
    'towns-military-label',
    'towns-county-label',
    'towns-commandery-label',
    'towns-provincial-label'
  ].forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatChineseName(town) {
  const traditional = town.Town_CH ?? '';
  const simplified = town.Town_CHS ?? '';

  if (traditional && simplified && traditional !== simplified) {
    return `${traditional} | ${simplified}`;
  }

  return traditional || simplified;
}

function formatAnnotation(annotation) {
  const raw = String(annotation ?? '').trim();
  if (!raw) return null;

  // This is only a bare English category tag (no Chinese counterpart at
  // all) when there's no Han-script text anywhere in the string — a
  // plain substring match on "new town" alone would incorrectly hijack a
  // genuine bilingual entry whose translation happens to contain those
  // two English words, e.g. "合肥新城 Hefei New Town" (新城 literally
  // translates to "New Town").
  const hasHan = /\p{Script=Han}/u.test(raw);
  if (!hasHan && /new town/i.test(raw)) {
    return {
      english: raw,
      chinese: ''
    };
  }

  const chineseMatch = raw.match(/[\p{Script=Han}（）()]+/gu);
  const chinese = chineseMatch?.join('') ?? '';
  const english = raw
    .replace(/[\p{Script=Han}（）()]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // The "Seat of X" / "X治所" wrapper is a specific convention that only
  // applies when the source itself already marks this as a seat note
  // (raw Chinese text contains 治所) — not a generic phrase to bolt onto
  // every annotation. English then gets the matching "Seat of" phrasing;
  // Chinese is used as-is since it already contains 治所, not appended
  // again. Anything else is just the plain split text, no wrapper at all
  // — and each side only renders if that language's text was actually
  // present in the source, never falling back to the other language.
  const isSeatNote = chinese.includes('治所');

  if (isSeatNote) {
    return {
      english: english ? `Seat of ${english}` : '',
      chinese: chinese || ''
    };
  }

  return {
    english: english || '',
    chinese: chinese || ''
  };
}

function getTownLngLat(town, fallbackLngLat) {
  const lng = Number(town.Longitude);
  const lat = Number(town.Latitude);

  if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  if (Array.isArray(fallbackLngLat)) return fallbackLngLat;

  return null;
}

function formatTownType(type) {
  return uiText.typeLabels[type] || type || uiText.settlement;
}

function formatModernPlace(town) {
  if (currentLang === 'zh-hans') {
    return [
      town.Modern_Province_CHS || town.Modern_Province_CH || town.Modern_Province_EN || '',
      town.Modern_CHS || town.Modern_CH || town.Modern_EN || ''
    ].filter(Boolean).join('，');
  }

  if (currentLang === 'zh-hant') {
    return [
      town.Modern_Province_CH || town.Modern_Province_CHS || town.Modern_Province_EN || '',
      town.Modern_CH || town.Modern_CHS || town.Modern_EN || ''
    ].filter(Boolean).join('，');
  }

  const directMunicipalities = ['Beijing', 'Chongqing', 'Tianjin', 'Shanghai'];

  return [
    town.Modern_EN || '',
    town.Modern_Province_EN &&
    !directMunicipalities.includes(town.Modern_Province_EN)
      ? `${town.Modern_Province_EN} Province`
      : `${town.Modern_Province_EN}`
  ].filter(Boolean).join(', ');
}

function formatHistoricalRegion(town) {
  if (currentLang === 'zh-hans') {
    const province = town.Prov_CHS || town.Prov_CH || town.Prov_EN || '';
    const commandery = town.Comm_CHS || town.Comm_CH || town.Comm_EN || '';
    const commanderySuffix = commandery && !/[国國]/.test(commandery) ? '郡' : '';

    return [
      province,
      commandery ? `${commandery}${commanderySuffix}` : ''
    ].filter(Boolean).join(' · ');
  }

  if (currentLang === 'zh-hant') {
    const province = town.Prov_CH || town.Prov_CHS || town.Prov_EN || '';
    const commandery = town.Comm_CH || town.Comm_CHS || town.Comm_EN || '';
    const commanderySuffix = commandery && !/[国國]/.test(commandery) ? '郡' : '';

    return [
      province,
      commandery ? `${commandery}${commanderySuffix}` : ''
    ].filter(Boolean).join(' · ');
  }

  const provinceLabel = town.Prov_EN
    ? /zhou/i.test(town.Prov_EN)
      ? `${town.Prov_EN.replace(/zhou/ig, '').trim()} Province`
      : `${town.Prov_EN} (Capital Region)`
    : '';

  return [
    town.Comm_EN && !/(State|Agriculture)$/.test(town.Comm_EN)
      ? `${town.Comm_EN} Commandery`
      : town.Comm_EN,
    provinceLabel
  ].filter(Boolean).join(', ');
}

function formatTownName(town) {
  if (currentLang === 'zh-hans') return town.Town_CHS || town.Town_CH || town.Town_EN || town.Comm_EN || uiText.unnamedLocation;
  if (currentLang === 'zh-hant') return town.Town_CH || town.Town_CHS || town.Town_EN || town.Comm_EN || uiText.unnamedLocation;
  return town.Town_EN || town.Comm_EN || uiText.unnamedLocation;
}

function formatTownSubtitle(town) {
  if (isChineseMap()) return town.Town_EN || '';
  return formatChineseName(town);
}

function buildTownDetailHtml(town, { mobile = false } = {}) {
  const name = formatTownName(town);
  const subtitle = formatTownSubtitle(town);
  const type = formatTownType(town.Type);
  const kingdom = town.kingdom || PROVINCE_KINGDOM[town.Prov_EN] || 'unknown';
  const kingdomLabel = KINGDOM_LABEL[kingdom] || '';
  const region = formatHistoricalRegion(town);
  const modern = formatModernPlace(town);
  const annotation = formatAnnotation(town.Annotation);
  const annotationText = annotation
    ? (isChineseMap() ? annotation.chinese : annotation.english)
    : '';

  return `
    <div class="imap-town-card ${mobile ? 'imap-town-card-mobile' : ''}">
      <div class="imap-town-card-header">
        <div>
          <div class="imap-town-name">${escapeHtml(name)}</div>
          ${subtitle ? `<div class="imap-town-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${mobile ? `<button class="imap-town-close" type="button" aria-label="${escapeHtml(uiText.close)}">✕</button>` : ''}
      </div>
      <div class="imap-town-meta">
        <span>${escapeHtml(type)}</span>
        ${region ? `
          <span class="imap-town-region">
            ${kingdomLabel ? `<span class="imap-town-kingdom imap-town-kingdom-${escapeHtml(kingdom)}">${escapeHtml(kingdomLabel)}</span>` : ''}
            <span>${escapeHtml(region)}</span>
          </span>
        ` : ''}
        ${modern ? `<span class="imap-town-modern"><strong>${escapeHtml(uiText.modern)}</strong> ${escapeHtml(modern)}</span>` : ''}
      </div>
      ${annotationText ? `
        <div class="imap-town-section">
          <div class="imap-town-section-label">${escapeHtml(uiText.administrativeNote)}</div>
          <div class="imap-town-note">${escapeHtml(annotationText)}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function hideMobileTownDetail() {
  document.getElementById('imap-town-sheet')?.remove();
}

function showMobileTownDetail(town) {
  hideMobileTownDetail();

  const content = document.querySelector('.imap-content');
  if (!content) return;

  const sheet = document.createElement('div');
  sheet.id = 'imap-town-sheet';
  sheet.className = 'imap-town-sheet';
  sheet.innerHTML = buildTownDetailHtml(town, { mobile: true });
  content.appendChild(sheet);

  sheet.querySelector('.imap-town-close')?.addEventListener('click', hideMobileTownDetail);
}

function openTownDetail(town, fallbackLngLat, { keepJourney = false } = {}) {
  if (!town) return;

  if (keepJourney) {
    // Journey view already called clearWaterBodyHighlight() itself before
    // placing the pins — here we only need to close any stray previous
    // popup, without wiping the journey pin layer we just drew.
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  } else {
    clearWaterBodyHighlight();
  }

  const lngLat = getTownLngLat(town, fallbackLngLat);

  if (window.matchMedia('(max-width: 950px)').matches) {
    showMobileTownDetail(town);
    return;
  }

  hideMobileTownDetail();
  if (!lngLat) return;

  activePopup = new maplibregl.Popup({
    closeButton: true,
    className: 'imap-town-popup',
    maxWidth: '300px'
  })
    .setLngLat(lngLat)
    .setHTML(buildTownDetailHtml(town))
    .addTo(map);
}

function openTownDetailAfterFly(town, lngLat, options = {}) {
  if (!town) return;

  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    openTownDetail(town, lngLat, options);
  };

  map.once('moveend', openOnce);
  window.setTimeout(openOnce, 900);
}

function getAllTownBounds() {
  const validTowns = allTowns
    .map(town => [Number(town.Longitude), Number(town.Latitude)])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

  if (!validTowns.length) return null;

  return validTowns.reduce(
    (bounds, coord) => bounds.extend(coord),
    new maplibregl.LngLatBounds(validTowns[0], validTowns[0])
  );
}

function fitAllTowns() {
  if (!map || !mapReady) return;

  const bounds = getAllTownBounds();
  if (!bounds) return;

  clearWaterBodyHighlight();

  map.fitBounds(bounds, {
    padding: FULL_EXTENT_PADDING,
    duration: 900,
    maxZoom: 5.2
  });
}

// ── JOURNEY VIEW ───────────────────────────────────────────────
// Renders every place referenced by one chapter (e.g. a person's
// biography) as an always-visible pin — independent of the normal
// zoom-based settlement symbol visibility, so the reader sees the whole
// geographic spread immediately, at any zoom level. The specific place
// being linked to (the "entry" point) gets a highlight ring so it's
// distinguishable from the rest of the unordered set, and its detail
// popup opens automatically once the camera settles.
//
// Journey data is a simple array of point entries:
//   [{ lat, lng, name }, ...]
// fetched from /mapbase/journeys/<journeyId>.json (generated ahead of
// time from each chapter's own [[place|url]] tags — a separate build
// step, not part of this file). Only point-type entries (towns) are
// plotted as pins currently; admin boundary / water body entries in a
// journey are not yet supported here since they don't have a single
// point coordinate to plot.

function clearJourneyMarkers() {
  journeyMarkers.forEach(m => m.remove());
  journeyMarkers = [];
}

function clearJourneyBoundaries() {
  if (!map) return;
  if (map.getLayer(JOURNEY_BOUNDARY_LAYER)) map.removeLayer(JOURNEY_BOUNDARY_LAYER);
  if (map.getSource(JOURNEY_BOUNDARY_SOURCE)) map.removeSource(JOURNEY_BOUNDARY_SOURCE);
}

// Bold, persistent border for every admin boundary / water body referenced
// in the current journey — deliberately BLACK (not the gold used by the
// single-select search highlight) so the two systems read as visually
// distinct: gold means "this is the one thing you searched for", black
// means "this is part of the journey overview".
function renderJourneyBoundaryLayer(featureCollection) {
  clearJourneyBoundaries();
  if (!featureCollection.features.length) return;

  map.addSource(JOURNEY_BOUNDARY_SOURCE, { type: 'geojson', data: featureCollection });

  map.addLayer({
    id: JOURNEY_BOUNDARY_LAYER,
    type: 'line',
    source: JOURNEY_BOUNDARY_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#111111',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 6, 8, 9, 12, 13],
      'line-opacity': 1
    }
  });
}

async function fetchJourney(journeyId) {
  if (!journeyId) return null;
  try {
    const res = await fetch(url(`/mapbase/journeys/${journeyId}.json`));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function renderJourneyView(items) {
  if (!map || !mapReady) return;

  // Same "only one thing shown at a time" rule as everywhere else —
  // clears any previous popup, highlight, journey pins, AND journey
  // boundaries before drawing the new set.
  clearWaterBodyHighlight();

  if (!Array.isArray(items) || !items.length) return;

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
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.5 13 21 13 21s13-11.5 13-21C26 5.8 20.2 0 13 0z" fill="#d0aa6b" stroke="#1a1208" stroke-width="2"/>
        <circle cx="13" cy="13" r="5" fill="#1a1208"/>
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

    renderJourneyBoundaryLayer({ type: 'FeatureCollection', features: boundaryFeatures });
  }

  if (hasBounds) {
    map.fitBounds(bounds, {
      padding: FULL_EXTENT_PADDING,
      duration: 900,
      maxZoom: 9
    });
  }
}

export async function showJourney(journeyId) {
  if (!journeyId) return;
  const items = await fetchJourney(journeyId);
  if (!items || !items.length) return;

  if (map && mapReady) {
    renderJourneyView(items);
  } else {
    // store for the load handler — same deferred pattern as pendingFlyTo
    pendingJourney = { items };
  }
}

class FitAllTownsControl {
  onAdd(mapInstance) {
    this.map = mapInstance;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group imap-fit-control';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'imap-fit-all-btn';
    this.button.title = uiText.showAllTowns;
    this.button.setAttribute('aria-label', uiText.showAllTowns);
    this.button.innerHTML = '<i class="ti ti-arrows-maximize" aria-hidden="true"></i>';
    this.button.addEventListener('click', fitAllTowns);

    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove() {
    this.button?.removeEventListener('click', fitAllTowns);
    this.container?.parentNode?.removeChild(this.container);
    this.map = undefined;
  }
}

// WATER BODY HIGHLIGHT (rivers / lakes — never a permanent layer, only on-demand)
const WATER_HIGHLIGHT_SOURCE = 'water-body-highlight';
// Separate source used ONLY by the fill layer, containing just the extracted
// Polygon/MultiPolygon part. Keeping it separate from the main source (which
// also carries any line part of the same feature) prevents the fill renderer
// from ever seeing line coordinates — that's what was implicitly closing the
// line part into a bogus filled wedge before.
const WATER_HIGHLIGHT_FILL_SOURCE = 'water-body-highlight-fill-source';
const WATER_HIGHLIGHT_LAYERS = [
  'water-body-highlight-fill',
  'water-body-highlight-casing',
  'water-body-highlight-line'
];

// Separate persistent layer for journey-view admin boundary / water body
// borders — deliberately independent of WATER_HIGHLIGHT_SOURCE above,
// since that one is built around "only one highlighted feature at a
// time" (cleared whenever a new search/click happens), whereas a journey
// can reference several admin boundaries/water bodies simultaneously and
// they should all stay bold-bordered together for the whole time the
// journey view is showing.
const JOURNEY_BOUNDARY_SOURCE = 'journey-boundary-highlight';
const JOURNEY_BOUNDARY_LAYER = 'journey-boundary-casing';

let waterHighlightPopup = null;
let currentWaterHighlightId = null;
let pendingHighlight = null; // { kind: 'water' | 'admin', feature }

function removeWaterBodyHighlightLayers() {
  if (!map) return;

  WATER_HIGHLIGHT_LAYERS.forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });

  if (map.getSource(WATER_HIGHLIGHT_SOURCE)) {
    map.removeSource(WATER_HIGHLIGHT_SOURCE);
  }
  if (map.getSource(WATER_HIGHLIGHT_FILL_SOURCE)) {
    map.removeSource(WATER_HIGHLIGHT_FILL_SOURCE);
  }
}

export function clearWaterBodyHighlight() {
  currentWaterHighlightId = null;
  pendingHighlight = null;

  if (waterHighlightPopup) {
    const popup = waterHighlightPopup;
    waterHighlightPopup = null;
    popup.remove();
  }

  removeWaterBodyHighlightLayers();

  // Also close any open town popup and clear any journey pin layer — every
  // internal caller already paired this call with clearing activePopup
  // separately, so folding both in here makes this the single "clear
  // whatever's currently shown" entry point. This also fixes the
  // search-clear button in map-overall.astro, which previously only
  // cleared water/admin highlights and left an open town popup untouched.
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
  hideMobileTownDetail();
  clearJourneyMarkers();
  clearJourneyBoundaries();
}

function extendBoundsWithCoords(bounds, coords) {
  if (typeof coords?.[0] === 'number' && typeof coords?.[1] === 'number') {
    bounds.extend(coords);
    return;
  }
  if (Array.isArray(coords)) coords.forEach(c => extendBoundsWithCoords(bounds, c));
}

function computeGeometryBounds(geometry) {
  const bounds = new maplibregl.LngLatBounds();

  if (geometry.type === 'GeometryCollection') {
    (geometry.geometries || []).forEach(g => {
      if (g.coordinates) extendBoundsWithCoords(bounds, g.coordinates);
    });
  } else if (geometry.coordinates) {
    extendBoundsWithCoords(bounds, geometry.coordinates);
  }

  return bounds;
}

function formatWaterBodyName(props) {
  if (!props) return uiText.unnamedLocation;
  if (currentLang === 'zh-hans') return props.Name_CHS || props.Name_CH || props.Name_EN || uiText.unnamedLocation;
  if (currentLang === 'zh-hant') return props.Name_CH || props.Name_CHS || props.Name_EN || uiText.unnamedLocation;
  return props.Name_EN || props.Name_CH || uiText.unnamedLocation;
}

function formatWaterBodySubtitle(props) {
  if (!props) return '';
  if (isChineseMap()) return props.Name_EN || '';
  // English site: show Traditional Chinese only. Simplified is shown on the
  // Simplified site (handled by the isChineseMap() branch above via lang).
  return props.Name_CH || '';
}

function buildWaterBodyDetailHtml(props) {
  const name = formatWaterBodyName(props);
  const subtitle = formatWaterBodySubtitle(props);
  // Type was previously read directly from props.Type regardless of locale,
  // which always showed the raw English value (e.g. "Lake") even on the
  // zh-hans/zh-hant sites. Now prefers the matching Chinese field.
  let type;
  if (currentLang === 'zh-hans') type = props?.Type_CHS || props?.Type_CH || uiText.waterBody || props?.Type;
  else if (currentLang === 'zh-hant') type = props?.Type_CH || props?.Type_CHS || uiText.waterBody || props?.Type;
  else type = props?.Type || uiText.waterBody || 'River';

  return `
    <div class="imap-water-card">
      <div class="imap-town-name">${escapeHtml(name)}</div>
      ${subtitle ? `<div class="imap-town-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      <div class="imap-town-meta"><span>${escapeHtml(type)}</span></div>
    </div>
  `;
}

// Renders a temporary highlight for a single water body feature (river/lake),
// fits the map to it, and shows a small popup with its name.
// Geometry is stored in EPSG:3857 in the source data and converted here.
function extractPolygonOnly(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') return geometry;

  if (geometry.type === 'GeometryCollection') {
    const polygons = (geometry.geometries || []).filter(
      g => g.type === 'Polygon' || g.type === 'MultiPolygon'
    );
    if (!polygons.length) return null;
    return polygons.length === 1 ? polygons[0] : { type: 'GeometryCollection', geometries: polygons };
  }

  return null;
}

// Shared core: renders the fill/casing/line highlight for any geometry and
// shows a popup built from the given HTML. Used by both water bodies and
// admin boundary (province/commandery) search results — same casing border,
// same clearing behavior, same "only one highlight at a time" rule.
// options.showFill / options.showLine let admin boundaries opt out of the
// blue fill+line (those are reserved for water bodies) and show only the
// gold casing border.
function renderSearchHighlight(geometry, properties, popupHtml, highlightId, options = {}) {
  const { showFill = true, showLine = true } = options;

  if (!map || !mapReady || !geometry) return;

  clearWaterBodyHighlight();

  const convertedGeometry = convertGeometryToLngLat(geometry, WATER_BODIES_ARE_WEB_MERCATOR);

  map.addSource(WATER_HIGHLIGHT_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: properties || {},
      geometry: convertedGeometry
    }
  });

  // IMPORTANT: the fill layer gets its OWN source containing ONLY the
  // extracted Polygon/MultiPolygon part — never the full GeometryCollection.
  // Handing a fill layer any LineString coordinates (even alongside a
  // legitimate polygon in the same GeometryCollection feature) causes it to
  // implicitly close/connect that line into a bogus filled wedge. Isolating
  // the polygon into its own source+feature makes that impossible.
  const polygonOnlyGeometry = extractPolygonOnly(convertedGeometry);

  if (showFill && polygonOnlyGeometry) {
    map.addSource(WATER_HIGHLIGHT_FILL_SOURCE, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: properties || {},
        geometry: polygonOnlyGeometry
      }
    });

    map.addLayer({
      id: 'water-body-highlight-fill',
      type: 'fill',
      source: WATER_HIGHLIGHT_FILL_SOURCE,
      paint: {
        'fill-color': '#38bdf8',
        'fill-opacity': 0.35
      }
    });
  }

  // Amber "highlighter" casing, drawn first so it sits underneath the line.
  // Crisp (no blur), a substantially wider, deeper-gold stroke so it reads
  // clearly against the basemap's own muted blue-gray water tones. Always
  // shown — this is the border used for BOTH water bodies and admin
  // boundaries.
  map.addLayer({
    id: 'water-body-highlight-casing',
    type: 'line',
    source: WATER_HIGHLIGHT_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#b8863f',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 7, 8, 11, 12, 15],
      'line-opacity': 1
    }
  });

  // Plain crisp blue line, no halo/blur/shading — water bodies only. Admin
  // boundaries (provinces/commanderies) show the gold casing alone.
  if (showLine) {
    map.addLayer({
      id: 'water-body-highlight-line',
      type: 'line',
      source: WATER_HIGHLIGHT_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#0ea5e9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 8, 4, 12, 5.8],
        'line-opacity': 1
      }
    });
  }

  const bounds = computeGeometryBounds(convertedGeometry);

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 64, duration: 900, maxZoom: 9 });

    waterHighlightPopup = new maplibregl.Popup({
      closeButton: true,
      className: 'imap-water-popup',
      maxWidth: '260px'
    })
      .setLngLat(bounds.getCenter())
      .setHTML(popupHtml)
      .addTo(map);

    waterHighlightPopup.on('close', () => {
      if (currentWaterHighlightId === highlightId) {
        clearWaterBodyHighlight();
      }
    });
  }

  currentWaterHighlightId = highlightId;
}

export function highlightWaterBodyFeature(feature) {
  if (!feature?.geometry) return;
  renderSearchHighlight(
    feature.geometry,
    feature.properties,
    buildWaterBodyDetailHtml(feature.properties),
    feature.properties?.id ?? null
  );
}

// Public helper: look up a water body by its stable `id` (from all_water_bodies.json)
// and highlight it — used when arriving from the /maps/search results page.
export async function showWaterBodyById(id) {
  if (id === null || id === undefined || id === '') return;
  const numericId = Number(id);

  const bodies = await fetchWaterBodies();
  const feature = bodies.find(f => f.properties?.id === numericId) || null;
  if (!feature) return;

  if (map && mapReady) {
    highlightWaterBodyFeature(feature);
  } else {
    pendingHighlight = { kind: 'water', feature };
  }
}

// "Yanzhou" -> "Yan Province"; non-"zhou" provinces (e.g. Sili, the capital
// metropolitan area) follow the same convention already used for towns.
function formatProvinceLabel(provEn) {
  if (!provEn) return '';
  return /zhou/i.test(provEn)
    ? `${provEn.replace(/zhou/ig, '').trim()} Province`
    : `${provEn} (Capital Region)`;
}

// Appends " Commandery" unless the commandery is actually a princely State
// (Name_CH contains 國, or Name_EN already ends in "State") — those render
// as-is, e.g. "Pei State" not "Pei State Commandery".
function formatCommanderyLabel(nameEn, nameCh) {
  if (!nameEn) return '';
  const isState = (nameCh && nameCh.includes('國')) || /state$/i.test(nameEn.trim());
  return isState ? nameEn : `${nameEn} Commandery`;
}

function formatAdminBoundaryName(props) {
  if (!props) return uiText.unnamedLocation;
  if (currentLang === 'zh-hans') return props.Name_CHS || props.Name_CH || props.Name_EN || uiText.unnamedLocation;
  if (currentLang === 'zh-hant') return props.Name_CH || props.Name_CHS || props.Name_EN || uiText.unnamedLocation;
  // English: provinces render as "X Province"; commanderies stay plain.
  if (props.level === 'province') return formatProvinceLabel(props.Name_EN) || props.Name_CH || uiText.unnamedLocation;
  return props.Name_EN || props.Name_CH || uiText.unnamedLocation;
}

function formatAdminBoundarySubtitle(props) {
  if (!props) return '';
  if (isChineseMap()) return props.Name_EN || '';
  return props.Name_CH || '';
}

function formatAdminParentName(props) {
  if (currentLang === 'zh-hans') return props.Prov_CHS || props.Prov_CH || props.Prov_EN || '';
  if (currentLang === 'zh-hant') return props.Prov_CH || props.Prov_CHS || props.Prov_EN || '';
  return formatProvinceLabel(props.Prov_EN) || props.Prov_EN || '';
}

function buildAdminBoundaryDetailHtml(props) {
  const name = formatAdminBoundaryName(props);
  const subtitle = formatAdminBoundarySubtitle(props);
  const isCommandery = props?.level === 'commandery';
  const isTributary = props?.level === 'tributary';

  let typeLabel;
  if (isCommandery) typeLabel = uiText.commandery;
  else if (isTributary) typeLabel = uiText.tributary;
  else typeLabel = uiText.province;

  // Commanderies and tributaries both show a "province · name" breadcrumb;
  // provinces just show their own name once (no self-referential breadcrumb).
  // Commanderies get the " Commandery" suffix in that breadcrumb (English
  // only, skipped for princely States); tributaries never get a suffix —
  // they're not administered territory, just their plain name.
  let family = '';
  if (isCommandery) {
    const commLabel = currentLang === 'en' ? formatCommanderyLabel(props.Name_EN, props.Name_CH) : name;
    family = `${escapeHtml(formatAdminParentName(props))} · ${escapeHtml(commLabel)}`;
  } else if (isTributary) {
    family = `${escapeHtml(formatAdminParentName(props))} · ${escapeHtml(name)}`;
  }

  return `
    <div class="imap-water-card">
      <div class="imap-town-name">${escapeHtml(name)}</div>
      ${subtitle ? `<div class="imap-town-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      <div class="imap-town-meta">
        <span>${escapeHtml(typeLabel)}</span>
        ${family ? `<span class="imap-admin-family">${family}</span>` : ''}
      </div>
    </div>
  `;
}

export function highlightAdminBoundaryFeature(feature) {
  if (!feature?.geometry) return;
  renderSearchHighlight(
    feature.geometry,
    feature.properties,
    buildAdminBoundaryDetailHtml(feature.properties),
    `admin-${feature.properties?.id ?? ''}`,
    { showFill: false, showLine: false }
  );
}

// Public helper: look up a province/commandery by its stable `id` (from
// All_Provinces.json) and highlight it — used when arriving from the
// /maps/search results page.
export async function showAdminBoundaryById(id) {
  if (id === null || id === undefined || id === '') return;
  const numericId = Number(id);

  const boundaries = await fetchAdminBoundaries();
  const feature = boundaries.find(f => f.properties?.id === numericId) || null;
  if (!feature) return;

  if (map && mapReady) {
    highlightAdminBoundaryFeature(feature);
  } else {
    pendingHighlight = { kind: 'admin', feature };
  }
}

// LEGEND CLEANUP 
function removeKingdomLegend() {
  const possibleSelectors = [
    '.imap-legend-kingdoms',
    '.imap-legend-kingdom',
    '.imap-legend-section-kingdoms',
    '#imap-legend-kingdoms'
  ];

  possibleSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => el.remove());
  });

  document.querySelectorAll('.imap-legend-section, .imap-legend-group, .imap-legend-block').forEach(section => {
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6, .imap-legend-title, .imap-section-title');
    const headingText = heading?.textContent?.trim().toLowerCase() ?? '';

    if (headingText.includes('kingdom')) {
      section.remove();
    }
  });
}

// LAYER BUILDING 
function hideOutdoorTrails() {
  if (!map || currentStyle !== 'outdoor') return;

  const styleLayers = map.getStyle()?.layers ?? [];

  styleLayers.forEach(layer => {
    if (layer['source-layer'] === 'trail') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });
}

function addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON = yellowRiverOldCourseCache, commanderiesGeoJSON = commanderiesGeoJSONCache) {
  if (hasThreeKArchiveLayers()) return;

  hideOutdoorTrails();

  applyBaseMapLanguage();
  rememberBaseMapModernLayers();
  localizeBaseMapModernLabels();

  map.addSource('provinces', {
    type: 'geojson',
    data: provincesGeoJSON
  });

  map.addLayer({
    id: 'province-fill',
    type: 'fill',
    source: 'provinces',
    paint: {
      'fill-color': kExpr('kingdom', KINGDOM_FILL),
      'fill-opacity': 1
    }
  });

  map.addLayer({
    id: 'province-line',
    type: 'line',
    source: 'provinces',
    paint: {
      'line-color': kExpr('kingdom', KINGDOM_LINE),
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3, 0.8,
        7, 1.4,
        10, 2
      ],
      'line-opacity': 0.85
    }
  });

  if (commanderiesGeoJSON?.features?.length) {
    map.addSource('commanderies', {
      type: 'geojson',
      data: commanderiesGeoJSON
    });

    // Sub-boundaries nested inside each province — same kingdom hue as the
    // province line, but dashed to distinguish the hierarchy. Shown/hidden
    // together with province-fill/province-line via the same "Historical
    // Provinces" toggle (see PROVINCE_LAYERS).
    map.addLayer({
      id: 'commandery-line',
      type: 'line',
      source: 'commanderies',
      paint: {
        'line-color': kExpr('kingdom', KINGDOM_LINE),
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 0.9,
          7, 1.3,
          10, 1.8
        ],
        'line-opacity': 0.75,
        'line-dasharray': [2, 1.5]
      }
    });
  }

  if (yellowRiverOldCourseGeoJSON?.features?.length) {
    map.addSource('yellow-river-old-course', {
      type: 'geojson',
      data: yellowRiverOldCourseGeoJSON
    });

    map.addLayer({
      id: 'yellow-river-old-course-halo',
      type: 'line',
      source: 'yellow-river-old-course',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#141414',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4.2, 8, 6.4, 12, 8.6],
        'line-opacity': 0.68,
        'line-dasharray': [1.8, 2.1]
      }
    });

    map.addLayer({
      id: 'yellow-river-old-course',
      type: 'line',
      source: 'yellow-river-old-course',
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': '#5f6f78',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.1, 8, 3.4, 12, 5.2],
        'line-opacity': 0.96
      }
    });
  }

  map.addSource('towns', {
    type: 'geojson',
    data: buildTownsGeoJSON()
  });

  const lbl = dy => ({
    'text-field': townLabelField(),
    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 12, 13],
    'text-offset': [0, dy],
    'text-anchor': 'top',
    'text-max-width': 8,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-optional': true,
  });

  const lp = haloWidth => ({
    'text-color': '#1a1a1a',
    'text-halo-color': 'rgba(255,255,255,0.9)',
    'text-halo-width': haloWidth
  });

  map.addLayer({
    id: 'towns-provincial',
    type: 'symbol',
    source: 'towns',
    filter: townTypeFilter(TOWN_TYPES.provincial),
    layout: {
      'text-field': '■',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 13, 10, 22],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'symbol-sort-key': 5
    },
    paint: {
      'text-color': SETTLEMENT_COLOUR.provincial,
      'text-halo-color': 'rgba(255,255,255,0.95)',
      'text-halo-width': 1.2
    }
  });

  map.addLayer({
    id: 'towns-provincial-label',
    type: 'symbol',
    source: 'towns',
    filter: townTypeFilter(TOWN_TYPES.provincial),
    layout: {
      ...lbl(0.9),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 8, 14, 12, 16],
      'symbol-sort-key': 4
    },
    paint: lp(2)
  });

  map.addLayer({
    id: 'towns-commandery',
    type: 'circle',
    source: 'towns',
    filter: townTypeFilter(TOWN_TYPES.commandery),
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 5, 10, 9],
      'circle-color': SETTLEMENT_COLOUR.commandery,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#5a4630',
      'circle-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'towns-commandery-label',
    type: 'symbol',
    source: 'towns',
    filter: townTypeFilter(TOWN_TYPES.commandery),
    layout: {
      ...lbl(0.85),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 12, 12, 14],
      'symbol-sort-key': 3
    },
    paint: lp(1.5)
  });

  map.addLayer({
    id: 'towns-county',
    type: 'circle',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.county),
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 7],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 1.8, 12, 2.4],
      'circle-stroke-color': '#1b1b1b',
      'circle-opacity': 1,
      'circle-stroke-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'towns-county-label',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.county),
    layout: {
      ...lbl(0.8),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11],
      'symbol-sort-key': 2
    },
    paint: lp(1.3)
  });

  map.addLayer({
    id: 'towns-military',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.military),
    layout: {
      'text-field': '×',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 16, 12, 24],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'symbol-sort-key': 1
    },
    paint: {
      'text-color': SETTLEMENT_COLOUR.military,
      'text-halo-color': '#fff',
      'text-halo-width': 1
    }
  });

  map.addLayer({
    id: 'towns-military-label',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.military),
    layout: {
      ...lbl(0.8),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11],
      'symbol-sort-key': 1
    },
    paint: lp(1.3)
  });

  map.addLayer({
    id: 'towns-landmark',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.landmark),
    layout: {
      'text-field': '★',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 12, 17],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'symbol-sort-key': 1
    },
    paint: {
      'text-color': SETTLEMENT_COLOUR.landmark,
      'text-halo-color': '#fff',
      'text-halo-width': 1
    }
  });

  map.addLayer({
    id: 'towns-landmark-label',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: townTypeFilter(TOWN_TYPES.landmark),
    layout: {
      ...lbl(0.8),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11],
      'symbol-sort-key': 1
    },
    paint: lp(1.3)
  });

  const otherF = townTypeFilter(TOWN_TYPES.other);

  map.addLayer({
    id: 'towns-others',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: otherF,
    layout: {
      'text-field': '◇',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 15],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'symbol-sort-key': 1
    },
    paint: {
      'text-color': SETTLEMENT_COLOUR.other,
      'text-halo-color': '#fff',
      'text-halo-width': 1.25
    }
  });

  map.addLayer({
    id: 'towns-others-label',
    type: 'symbol',
    source: 'towns',
    minzoom: DETAIL_SETTLEMENT_ZOOM,
    filter: otherF,
    layout: {
      ...lbl(0.8),
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 11],
      'symbol-sort-key': 1
    },
    paint: lp(1)
  });

  orderSettlementLayersByHierarchy();

  if (townInteractionsWired) return;
  townInteractionsWired = true;

  [
    'towns-provincial',
    'towns-commandery',
    'towns-county',
    'towns-military',
    'towns-landmark',
    'towns-others',
    'towns-provincial-label',
    'towns-commandery-label',
    'towns-county-label',
    'towns-military-label',
    'towns-landmark-label',
    'towns-others-label'
  ].forEach(id => {
    map.on('click', id, e => {
      const p = e.features[0].properties;
      openTownDetail(p, [e.lngLat.lng, e.lngLat.lat]);
    });

    map.on('mouseenter', id, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', id, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// TOGGLES
function isProvinceBoundaryToggle(el) {
  if (!el) return false;

  const text = [
    el.id,
    el.name,
    el.value,
    el.className,
    el.closest('label')?.textContent,
    el.closest('.imap-toggle-row')?.textContent
  ]
    .join(' ')
    .toLowerCase();

  return (
    text.includes('province') ||
    text.includes('boundary') ||
    text.includes('boundaries')
  );
}

function isLabelToggle(el) {
  if (!el) return false;

  const text = [
    el.id,
    el.name,
    el.value,
    el.className,
    el.closest('label')?.textContent,
    el.closest('.imap-toggle-row')?.textContent
  ]
    .join(' ')
    .toLowerCase();

  return text.includes('label');
}

function isYellowRiverOldCourseToggle(el) {
  if (!el) return false;

  const text = [
    el.id,
    el.name,
    el.value,
    el.className,
    el.closest('label')?.textContent,
    el.closest('.imap-toggle-row')?.textContent
  ]
    .join(' ')
    .toLowerCase();

  return (
    text.includes('yellow') ||
    text.includes('river') ||
    text.includes('old course')
  );
}

function applyProvinceBoundaryVisibility(checked) {
  showProvinces = checked;

  if (!map) return;

  const visibility = checked ? 'visible' : 'none';

  PROVINCE_LAYERS.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function applyLabelVisibility(checked) {
  showLabels = checked;

  if (!map) return;

  const visibility = checked ? 'visible' : 'none';

  baseMapModernLayers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function applyYellowRiverOldCourseVisibility(checked) {
  showYellowRiverOldCourse = checked;

  if (!map) return;

  const visibility = checked ? 'visible' : 'none';

  YELLOW_RIVER_LAYERS.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

function syncToggleStatesFromDOM() {
  const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];

  const provinceToggle = checkboxes.find(isProvinceBoundaryToggle);
  const labelToggle = checkboxes.find(isLabelToggle);
  const yellowRiverToggle = checkboxes.find(isYellowRiverOldCourseToggle);

  if (provinceToggle) {
    applyProvinceBoundaryVisibility(provinceToggle.checked);
  }

  if (labelToggle) {
    applyLabelVisibility(labelToggle.checked);
  }

  if (yellowRiverToggle) {
    applyYellowRiverOldCourseVisibility(yellowRiverToggle.checked);
  }
}

function wireToggles() {
  if (togglesWired) return;
  togglesWired = true;

  document.addEventListener('change', e => {
    const el = e.target;

    if (!el || el.type !== 'checkbox') return;

    if (isProvinceBoundaryToggle(el)) {
      applyProvinceBoundaryVisibility(el.checked);
      return;
    }

    if (isLabelToggle(el)) {
      applyLabelVisibility(el.checked);
      return;
    }

    if (isYellowRiverOldCourseToggle(el)) {
      applyYellowRiverOldCourseVisibility(el.checked);
    }
  });
}

function syncStyleButtons() {
  document.querySelectorAll('.imap-style-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === currentStyle);
  });
}

function restoreArchiveLayersAfterStyleChange() {
  if (!provincesGeoJSONCache) return;

  if (!map.isStyleLoaded()) {
    map.once('idle', restoreArchiveLayersAfterStyleChange);
    return;
  }

  pendingStyleRestore = false;
  removeArchiveLayersAndSources();
  addLayers(provincesGeoJSONCache, yellowRiverOldCourseCache, commanderiesGeoJSONCache);
  removeKingdomLegend();
  syncToggleStatesFromDOM();
  map.resize();
}

function queueArchiveLayerRestore() {
  if (pendingStyleRestore) return;
  pendingStyleRestore = true;
  map.once('idle', restoreArchiveLayersAfterStyleChange);
}

function setBaseStyle(styleId) {
  if (!map || !MAP_STYLES[styleId] || styleId === currentStyle) return;

  clearWaterBodyHighlight();
  currentStyle = styleId;
  syncStyleButtons();

  queueArchiveLayerRestore();
  map.setStyle(MAP_STYLES[styleId]);
}

function wireStyleButtons() {
  if (styleButtonsWired) return;
  styleButtonsWired = true;

  document.querySelectorAll('.imap-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setBaseStyle(btn.dataset.style);
    });
  });

  syncStyleButtons();
}

// PUBLIC API

// flyToLocation: call this BEFORE initInteractiveMap when redirecting with coordinates.
// If the map is already ready, flies immediately.
// If not yet ready, stores coordinates so the load handler picks them up.
export function flyToLocation(lat, lng, town = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  if (map && mapReady) {
    const lngLat = [lng, lat];
    map.flyTo({ center: lngLat, zoom: 10.5 });
    openTownDetailAfterFly(town, lngLat);
  } else {
    // store for the load handler — overrides fitAllTowns on first load
    pendingFlyTo = { lat, lng, town };
  }
}

export async function initInteractiveMap(options = {}) {
  configureLocale(options);

  if (mapReady) {
    map.resize();
    removeKingdomLegend();
    syncToggleStatesFromDOM();

    if (pendingJourney) {
      const { items } = pendingJourney;
      pendingJourney = null;
      renderJourneyView(items);
    } else if (pendingFlyTo && Number.isFinite(pendingFlyTo.lat) && Number.isFinite(pendingFlyTo.lng)) {
      const { lat, lng, town } = pendingFlyTo;
      pendingFlyTo = null;
      flyToLocation(lat, lng, town);
    } else if (pendingHighlight) {
      const { kind, feature } = pendingHighlight;
      pendingHighlight = null;
      if (kind === 'admin') highlightAdminBoundaryFeature(feature);
      else highlightWaterBodyFeature(feature);
    }

    return;
  }

  const loadingEl = document.getElementById('imap-loading');

  try {
    await loadMapTilerSDK();

    const [provincesAndCommanderies, townsData, yellowRiverOldCourseGeoJSON] = await Promise.all([
      fetchProvincesAndCommanderies(),
      fetchTowns(),
      fetchYellowRiverOldCourse(),
    ]);

    const provincesGeoJSON = provincesAndCommanderies.provinces;
    const commanderiesGeoJSON = provincesAndCommanderies.commanderies;

    provincesGeoJSONCache = provincesGeoJSON;
    commanderiesGeoJSONCache = commanderiesGeoJSON;
    yellowRiverOldCourseCache = yellowRiverOldCourseGeoJSON;
    allTowns = townsData?.All_Towns_Details ?? townsData ?? [];

    map = new maplibregl.Map({
      container: 'imap-container',
      style: MAP_STYLES[currentStyle],
      center: [108, 33],  
      minZoom: 3,
      maxZoom: 14,
      dragRotate: true,
      pitchWithRotate: false,
      maxPitch: 0,
      navigationControl: false,
      geolocateControl: false,
      maptilerLogo: false,
    });

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.setPitch(0);

    map.addControl(new FitAllTownsControl(), 'top-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    wireToggles();
    wireStyleButtons();
    removeKingdomLegend();

    map.on('load', () => {
      addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON, commanderiesGeoJSON);

      mapReady = true;

      removeKingdomLegend();
      syncToggleStatesFromDOM();

      if (loadingEl) loadingEl.style.display = 'none';

      // scenario 4: redirected from a chapter — journey overview (all pins/borders equal)
      // scenario 2: redirected with coordinates — zoom to location
      // scenario 1: clean boot — fit all towns
        if (pendingJourney) {
          // scenario 4: arrived via a chapter's "view life journey" link
          const { items } = pendingJourney;
          pendingJourney = null;
          renderJourneyView(items);
        } else if (pendingFlyTo && Number.isFinite(pendingFlyTo.lat) && Number.isFinite(pendingFlyTo.lng)) {
          // scenario 2: has coordinates — fly there
          const { lat, lng, town } = pendingFlyTo;
          pendingFlyTo = null;
          flyToLocation(lat, lng, town);
        } else if (pendingHighlight) {
          // scenario 3: arrived from a water body or admin boundary search result
          const { kind, feature } = pendingHighlight;
          pendingHighlight = null;
          if (kind === 'admin') highlightAdminBoundaryFeature(feature);
          else highlightWaterBodyFeature(feature);
        } else if (!window.location.search) {
          // scenario 1: clean URL — fit all towns
          fitAllTowns();
        }
        // URL has params but no valid coordinates — leave map at initial center
    });

  } catch (err) {
    console.error('Interactive map failed to initialise:', err);

    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="imap-loading-inner" style="color:#c86060;">
          <i class="ti ti-alert-circle"></i>
          <span>${uiText.failedToLoadMap}</span>
        </div>
      `;
    }
  }
}