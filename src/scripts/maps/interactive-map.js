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
  shu: 'rgba(35,95,80,0.24)',
  wu: 'rgba(200,96,96,0.14)',
  unknown: 'rgba(120,120,120,0.05)'
};

const KINGDOM_LINE = {
  wei: '#4b6f9f',
  shu: '#2f8a76',
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
    unnamedLocation: 'Unnamed location', settlement: 'Settlement', modern: 'Modern', administrativeNote: 'Administrative Note', close: 'Close', showAllTowns: 'Show all towns', failedToLoadMap: 'Failed to load map', waterBody: 'River', province: 'Province', commandery: 'Commandery', tributary: 'Tributary Tribes', counties: 'Counties', commanderies: 'Commanderies', type: 'Type', region: 'Region', biography: 'Biography', previousPerson: 'Previous person', nextPerson: 'Next person', exitJourney: 'Exit journey',
    kingdomLabels: { wei: 'Wei', shu: 'Shu', wu: 'Wu', unknown: '' },
    typeLabels: { 'Provincial Seat': 'Provincial Seat', 'Commandery Seat': 'Commandery Seat', 'County Seat': 'County Seat', 'Military Pass': 'Military Pass', Landmark: 'Landmark', Others: 'Others' }
  },
  'zh-hant': {
    unnamedLocation: '未命名地點', settlement: '地點', modern: '現代位置', administrativeNote: '政區考釋', close: '關閉', showAllTowns: '顯示全部地點', failedToLoadMap: '地圖加載失敗', waterBody: '河流', province: '州', commandery: '郡', tributary: '臣屬部落', counties: '轄縣數', commanderies: '轄郡數', type: '類型', region: '政區', biography: '傳記', previousPerson: '上一人', nextPerson: '下一人', exitJourney: '退出人生軌跡',
    kingdomLabels: { wei: '魏', shu: '蜀', wu: '吳', unknown: '' },
    typeLabels: { 'Provincial Seat': '州治', 'Commandery Seat': '郡治', 'County Seat': '縣治', 'Military Pass': '關隘', Landmark: '地標', Others: '其他' }
  },
  'zh-hans': {
    unnamedLocation: '未命名地点', settlement: '地点', modern: '现代位置', administrativeNote: '政区考释', close: '关闭', showAllTowns: '显示全部地点', failedToLoadMap: '地图加载失败', waterBody: '河流', province: '州', commandery: '郡', tributary: '臣属部落', counties: '辖县数', commanderies: '辖郡数', type: '类型', region: '政区', biography: '传记', previousPerson: '上一人', nextPerson: '下一人', exitJourney: '退出人生轨迹',
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
let pendingJourney = null; // { data } — deferred until map is ready, same pattern as pendingFlyTo
let currentJourneyId = null;
let currentJourneyOverviews = [];
let currentJourneyPersonIndex = 0;
let journeyMarkers = [];
let togglesWired = false;
let styleButtonsWired = false;
let townInteractionsWired = false;
let pendingStyleRestore = false;
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
  if (currentLang === 'zh-hans') return town.Town_CHS || town.Town_CH || '';
  return town.Town_CH || town.Town_CHS || '';
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

  // Every annotation is treated as a governance-seat note by default —
  // Chinese gets 治所 appended, English gets "Seat of" prefixed — except
  // when the raw text contains 新城 (a "New City/Town" designation,
  // which isn't a seat-of-government record and shouldn't be phrased as
  // one). Guards against double-wrapping in case the source text already
  // has the phrasing baked in from the previous convention.
  if (raw.includes('新城')) {
    return {
      english: english || '',
      chinese: chinese || ''
    };
  }

  return {
    english: english ? (/^seat of /i.test(english) ? english : `Seat of ${english}`) : '',
    chinese: chinese ? (chinese.includes('治所') ? chinese : `${chinese}治所`) : ''
  };
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
    const commandery = town.Comm_CHS || town.Comm_CH || town.Comm_EN || '';
    const commanderySuffix = commandery && !/[国國]/.test(commandery) ? '郡' : '';
    return commandery ? `${commandery}${commanderySuffix}` : '';
  }

  if (currentLang === 'zh-hant') {
    const commandery = town.Comm_CH || town.Comm_CHS || town.Comm_EN || '';
    const commanderySuffix = commandery && !/[国國]/.test(commandery) ? '郡' : '';
    return commandery ? `${commandery}${commanderySuffix}` : '';
  }

  return town.Comm_EN && !/(State|Agriculture)$/.test(town.Comm_EN)
    ? `${town.Comm_EN} Commandery`
    : (town.Comm_EN || '');
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

// Every card field (Type, Region/Province, Modern, Counties/Commanderies)
// renders as one consistent row: label on the left, value right-flushed.
// valueHtml is inserted raw (already escaped/built by the caller), since
// the Type row needs to embed the kingdom badge, not just plain text.
function metaRow(label, valueHtml) {
  return `<div class="imap-meta-row"><span class="imap-meta-label">${escapeHtml(label)}:</span><span class="imap-meta-value">${valueHtml}</span></div>`;
}

function buildTownDetailHtml(town, { mobile = false, showClose = mobile } = {}) {
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
        ${showClose ? `<button class="imap-town-close" type="button" aria-label="${escapeHtml(uiText.close)}">✕</button>` : ''}
      </div>
      <div class="imap-town-meta">
        ${metaRow(uiText.type, `${kingdomLabel ? `<span class="imap-town-kingdom imap-town-kingdom-${escapeHtml(kingdom)}">${escapeHtml(kingdomLabel)}</span>` : ''}<span>${escapeHtml(type)}</span>`)}
        ${region ? metaRow(uiText.region, escapeHtml(region)) : ''}
        ${modern ? metaRow(uiText.modern, escapeHtml(modern)) : ''}
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

// Shows the docked right-side column (#imap-right-dock) if EITHER the
// region panel or the town panel currently has content, hides the whole
// dock if both are empty — so the map gets full width back when nothing
// is selected. Each inner panel always occupies its fixed 50% height
// slot once the dock is visible (never individually hidden/expanded),
// so checking actual content rather than style.display is what
// determines whether the dock itself should show at all.
function syncRightDockVisibility() {
  const dock = document.getElementById('imap-right-dock');
  const region = document.getElementById('imap-region-panel');
  const town = document.getElementById('imap-town-panel');
  if (!dock) return;
  const anyVisible = (region && region.innerHTML.trim() !== '') || (town && town.innerHTML.trim() !== '');
  dock.style.display = anyVisible ? 'flex' : 'none';
}

function hideTownPanel() {
  const panel = document.getElementById('imap-town-panel');
  if (panel) panel.innerHTML = '';
  syncRightDockVisibility();
  clearTownHighlightMarker();
}

function showTownPanel(town) {
  const panel = document.getElementById('imap-town-panel');
  if (!panel) return;
  panel.innerHTML = buildTownDetailHtml(town, { showClose: true });
  panel.querySelector('.imap-town-close')?.addEventListener('click', hideTownPanel);
  syncRightDockVisibility();
}

function hideMobileTownDetail() {
  document.getElementById('imap-town-sheet')?.remove();
}

// LOCATION HIGHLIGHT ────────────────────────────────────────────
// Every town record carries Comm_EN (its containing commandery's English
// name) regardless of the town's own settlement type — no spatial lookup
// needed, just a property comparison. All settlement layers share one
// 'towns' source, so dimming is done by swapping in a data-driven
// opacity expression per layer rather than iterating individual features.

const TOWN_DIM_OPACITY = 0.5;
const TOWN_DIM_LAYERS = [
  { id: 'towns-provincial', prop: 'text-opacity', normal: 1 },
  { id: 'towns-provincial-label', prop: 'text-opacity', normal: 1 },
  { id: 'towns-commandery', prop: 'circle-opacity', normal: 0.95 },
  { id: 'towns-commandery-label', prop: 'text-opacity', normal: 1 },
  { id: 'towns-county', prop: 'circle-opacity', normal: 1 },
  { id: 'towns-county-label', prop: 'text-opacity', normal: 1 },
  { id: 'towns-military', prop: 'text-opacity', normal: 1 },
  { id: 'towns-military-label', prop: 'text-opacity', normal: 1 },
  { id: 'towns-landmark', prop: 'text-opacity', normal: 1 },
  { id: 'towns-landmark-label', prop: 'text-opacity', normal: 1 },
  { id: 'towns-others', prop: 'text-opacity', normal: 1 },
  { id: 'towns-others-label', prop: 'text-opacity', normal: 1 }
];

function dimTownsOutsideRegion(propName, value) {
  if (!map || !value) return;
  TOWN_DIM_LAYERS.forEach(({ id, prop, normal }) => {
    if (!map.getLayer(id)) return;
    map.setPaintProperty(id, prop, ['case', ['==', ['get', propName], value], normal, TOWN_DIM_OPACITY]);
  });
  if (map.getLayer('towns-county')) {
    map.setPaintProperty('towns-county', 'circle-stroke-opacity', ['case', ['==', ['get', propName], value], 0.95, TOWN_DIM_OPACITY]);
  }
}

function clearTownDimming() {
  if (!map) return;
  TOWN_DIM_LAYERS.forEach(({ id, prop, normal }) => {
    if (map.getLayer(id)) map.setPaintProperty(id, prop, normal);
  });
  if (map.getLayer('towns-county')) map.setPaintProperty('towns-county', 'circle-stroke-opacity', 0.95);
}

let townHighlightMarker = null;

function showTownHighlightMarker(lng, lat) {
  clearTownHighlightMarker();
  const el = document.createElement('div');
  el.style.width = '18px';
  el.style.height = '18px';
  el.style.borderRadius = '50%';
  el.style.background = '#ff6ec7';
  el.style.boxShadow = '0 0 0 6px rgba(224,82,154,0.4), 0 0 16px 5px rgba(255,110,199,0.55)';
  el.style.pointerEvents = 'none';
  townHighlightMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
}

function clearTownHighlightMarker() {
  if (townHighlightMarker) {
    townHighlightMarker.remove();
    townHighlightMarker = null;
  }
}

// Ties the three pieces together for a clicked/searched town: fit the
// map to the containing commandery's bounds, dim every settlement icon
// outside it, and drop the magenta glow marker on the exact town. Async
// because it needs the (cached-after-first-call) admin boundary data to
// find the commandery polygon.
async function highlightTownContext(town) {
  if (!map || !mapReady || !town) return;

  const lng = Number(town.Longitude);
  const lat = Number(town.Latitude);
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    showTownHighlightMarker(lng, lat);
  }

  if (!town.Comm_EN) return;

  const adminFeatures = await fetchAdminBoundaries();
  const commandery = adminFeatures.find(f => f.properties?.level === 'commandery' && f.properties?.Name_EN === town.Comm_EN);

  dimTownsOutsideRegion('Comm_EN', town.Comm_EN);

  if (commandery?.geometry) {
    const convertedGeometry = convertGeometryToLngLat(commandery.geometry, WATER_BODIES_ARE_WEB_MERCATOR);
    const bounds = computeGeometryBounds(convertedGeometry);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 48, duration: 900, maxZoom: 10 });
    }

    // Same bold black boundary used for journey view — reused here rather
    // than duplicating the rendering logic, and already deliberately
    // distinct from the magenta glow used for the location marker itself,
    // so "this is the commandery context" and "this is the exact place
    // you selected" read as two different kinds of highlight.
    renderJourneyBoundaryLayer({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: commandery.properties || {}, geometry: convertedGeometry }]
    }, {
      lineWidth: ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 12, 3.5],
      lineOpacity: 0.8
    });

    showSearchResultPanel(buildAdminBoundaryDetailHtml(commandery.properties), `admin-${commandery.properties?.id ?? ''}`);
  }
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
    // panel, without wiping the journey pin layer we just drew.
    hideTownPanel();
  } else {
    clearWaterBodyHighlight();
  }

  // Same commandery-context treatment as a normal click, even in journey
  // mode — this does replace the journey's own admin/water boundary
  // layer with just this one commandery's boundary (renderJourneyBoundaryLayer
  // clears and redraws), but the journey pins and the journey overview
  // panel itself are untouched, since neither is cleared here.
  highlightTownContext(town);

  if (window.matchMedia('(max-width: 950px)').matches) {
    showMobileTownDetail(town);
    return;
  }

  hideMobileTownDetail();
  // Desktop: a persistent right-side panel, not a map-anchored popup — so
  // unlike the old popup, this no longer depends on the town having valid
  // coordinates (fallbackLngLat/getTownLngLat) at all, since the panel's
  // position is fixed UI chrome rather than tied to a point on the map.
  showTownPanel(town);
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
function renderJourneyBoundaryLayer(featureCollection, { lineWidth, lineOpacity = 1, lineDasharray } = {}) {
  clearJourneyBoundaries();
  if (!featureCollection.features.length) return;

  map.addSource(JOURNEY_BOUNDARY_SOURCE, { type: 'geojson', data: featureCollection });

  const paint = {
    'line-color': '#111111',
    'line-width': lineWidth || ['interpolate', ['linear'], ['zoom'], 3, 6, 8, 9, 12, 13],
    'line-opacity': lineOpacity
  };
  if (lineDasharray) paint['line-dasharray'] = lineDasharray;

  map.addLayer({
    id: JOURNEY_BOUNDARY_LAYER,
    type: 'line',
    source: JOURNEY_BOUNDARY_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint
  });
}

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

function formatJourneyEraYear(entry) {
  if (!entry) return null;
  const year = entry.year != null ? String(entry.year) : '';
  let era = isChineseMap() ? pickZh(entry.era) : (entry.era?.en || '');
  if (UNKNOWN_ERA_VALUES.has(era.trim().toLowerCase())) era = '';
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
      const label = [l.en, pickZh(l)].filter(Boolean).join(' ');
      const entry = resolved[i];
      if (!label) return '';
      if (!entry) return `<div>${escapeHtml(label)}</div>`;
      return `<div class="imap-journey-loc-link" data-journey-loc='${escapeHtml(JSON.stringify(entry))}'>${escapeHtml(label)}</div>`;
    })
    .filter(Boolean)
    .join('');
}

function formatJourneyPosition(positionLinks) {
  if (!positionLinks?.length) return '';
  return positionLinks
    .filter(seg => seg.en)
    .map(seg => {
      if (!seg.url) return escapeHtml(seg.en);
      return `<a href="${url(seg.url)}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i> ${escapeHtml(seg.en)}</a>`;
    })
    .join(', ');
}

// Resolves a journey stop's town entry back to the full town record, so
// clicking it can open the same detail cards a map pin click would.
function findTownForResolvedEntry(entry) {
  if (!entry || entry.kind !== 'town') return null;
  return allTowns.find(t => Number(t?.Latitude) === entry.lat && Number(t?.Longitude) === entry.lng) ?? null;
}

function renderJourneyStopRow(stop) {
  const yearEra = formatJourneyEraYear(stop);
  const location = formatJourneyLocation(stop.location, stop.resolvedLocations);
  const position = formatJourneyPosition(stop.positionLinks);
  if (!location && !position) return '';

  return `
    <div class="imap-journey-stop">
      <div class="imap-journey-stop-when">
        <div class="imap-journey-stop-year">${escapeHtml(yearEra?.year || '?')}</div>
        ${yearEra?.era ? `<div class="imap-journey-stop-era">${escapeHtml(yearEra.era)}</div>` : ''}
      </div>
      <div class="imap-journey-stop-where">
        ${location ? `<div class="imap-journey-stop-location">${location}</div>` : ''}
        ${position ? `<div class="imap-journey-stop-position">${position}</div>` : ''}
      </div>
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

function showJourneyPanel() {
  const panel = document.getElementById('imap-journey-panel');
  if (!panel || !currentJourneyOverviews.length) return;

  const person = currentJourneyOverviews[currentJourneyPersonIndex];

  // Only this person's own locations, not everyone's combined — a
  // location shared with another person in the same journey (e.g. a
  // family estate) still shows, since it's tagged with every person
  // whose stops include it.
  const personPins = currentJourneyPins.filter(pin => pin.persons?.includes(person.person));
  drawJourneyItems(personPins);

  const { nameEn, nameZh, courtesyEn, courtesyZh } = resolvePersonDisplay(person);
  const born = formatJourneyEraYear(person.born);
  const died = formatJourneyEraYear(person.died);
  const hasMultiplePeople = currentJourneyOverviews.length > 1;

  const bioUrl = currentJourneyId ? url(`/translations/sanguozhi/${currentJourneyId}`) : null;

  panel.innerHTML = `
    <div class="imap-journey-header">
      ${hasMultiplePeople ? `<button class="imap-journey-arrow" id="imap-journey-prev" type="button" aria-label="${escapeHtml(uiText.previousPerson)}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>` : ''}
      <div class="imap-journey-header-info">
        <div class="imap-journey-name-row">
          <span class="imap-journey-name">
            ${escapeHtml(nameEn || nameZh)}
            ${nameEn && nameZh ? `<span class="imap-journey-name-zh">${escapeHtml(nameZh)}</span>` : ''}
          </span>
          ${bioUrl ? `<a class="imap-journey-bio-link" href="${bioUrl}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i> ${escapeHtml(uiText.biography)}</a>` : ''}
        </div>
        ${(courtesyEn || courtesyZh) ? `
          <div class="imap-journey-courtesy">
            ${escapeHtml(courtesyEn || courtesyZh)}
            ${courtesyEn && courtesyZh ? `<span class="imap-journey-courtesy-zh">${escapeHtml(courtesyZh)}</span>` : ''}
          </div>
        ` : ''}
        ${(born || died) ? `
          <div class="imap-journey-dates">
            <div class="imap-journey-dates-num">${escapeHtml(born?.year || '?')} &ndash; ${escapeHtml(died?.year || '?')}</div>
            ${(born?.era || died?.era) ? `<div class="imap-journey-dates-era">${escapeHtml(born?.era || '?')} &ndash; ${escapeHtml(died?.era || '?')}</div>` : ''}
          </div>
        ` : ''}
      </div>
      ${hasMultiplePeople ? `<button class="imap-journey-arrow" id="imap-journey-next" type="button" aria-label="${escapeHtml(uiText.nextPerson)}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>` : ''}
    </div>
    <div class="imap-journey-timeline">
      ${(person.stops ?? []).map(renderJourneyStopRow).join('')}
    </div>
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

  const exitBtn = document.getElementById('imap-journey-exit');
  if (exitBtn) exitBtn.innerHTML = `<i class="ti ti-logout" aria-hidden="true"></i> ${escapeHtml(uiText.exitJourney)}`;
}

function switchJourneyPerson(delta) {
  if (!currentJourneyOverviews.length) return;
  currentJourneyPersonIndex = (currentJourneyPersonIndex + delta + currentJourneyOverviews.length) % currentJourneyOverviews.length;
  showJourneyPanel();
}

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
async function drawJourneyItems(items) {
  clearJourneyMarkers();
  clearJourneyBoundaries();

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

  if (hasBounds) {
    map.fitBounds(bounds, {
      padding: FULL_EXTENT_PADDING,
      duration: 900,
      maxZoom: 9
    });
  }
}

async function renderJourneyView(journeyData) {
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
    pendingJourney = { data };
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
  'water-body-highlight-glow-outer',
  'water-body-highlight-glow-inner',
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

  clearSearchResultPanel();

  removeWaterBodyHighlightLayers();

  // Also close any open town detail panel — folding this in here makes
  // this the single "clear whatever's currently shown" entry point for
  // everything EXCEPT journey state, which persists independently until
  // explicit exit (exitJourneyMode) or the toggle icon, never as a side
  // effect of clicking a different town or closing an unrelated popup.
  hideTownPanel();
  hideMobileTownDetail();
  clearTownDimming();
  clearTownHighlightMarker();
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
// REGION PANEL — docked on the right, above the town panel ────
// Province/commandery/river search results render in #imap-region-panel,
// the top slot of the docked right-side column (#imap-right-dock in
// map-overall.astro), stacked above #imap-town-panel. Together they fill
// the dock's full height — syncRightDockVisibility() shows/hides the
// dock itself depending on whether either panel actually has content.

function clearSearchResultPanel() {
  const panel = document.getElementById('imap-region-panel');
  if (!panel || panel.innerHTML.trim() === '') return;
  panel.innerHTML = '';
  syncRightDockVisibility();
}

// Closes just the region/commandery side of the highlight — used by that
// panel's own close button, independently of the town panel/marker below
// it. Covers both origins that populate this panel: a direct province /
// commandery / water body search (removeWaterBodyHighlightLayers, the
// magenta glow) and a location click's containing-commandery display
// (clearJourneyBoundaries, the black border + dimming) — clearing both
// unconditionally is harmless since whichever one wasn't active is
// already a no-op.
function clearRegionHighlight() {
  currentWaterHighlightId = null;
  clearSearchResultPanel();
  removeWaterBodyHighlightLayers();
  clearJourneyBoundaries();
  clearTownDimming();
}

function showSearchResultPanel(html, highlightId) {
  const panel = document.getElementById('imap-region-panel');
  if (!panel) return;

  panel.innerHTML = `
    <button class="imap-searchresult-close" type="button" aria-label="${escapeHtml(uiText.close)}">✕</button>
    ${html}
  `;
  syncRightDockVisibility();

  panel.querySelector('.imap-searchresult-close')?.addEventListener('click', () => {
    clearRegionHighlight();
  });
}

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

  // Magenta glow — a wide, blurred outer line underneath a thin, crisp
  // inner line, both on the same geometry. This replaces the old solid
  // gold "casing" border, which read as a heavy, hard-edged block rather
  // than a highlight, and which also overlapped with gold's existing
  // meaning as the site's own branding accent. Magenta was chosen because
  // it's the one color that doesn't collide with anything already
  // meaningful on this map: blue (Wei / rivers), green (Shu / satellite
  // terrain), red (Wu), or gold (site branding, search-adjacent chrome).
  // Used for BOTH water bodies and admin boundaries.
  map.addLayer({
    id: 'water-body-highlight-glow-outer',
    type: 'line',
    source: WATER_HIGHLIGHT_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#e0529a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 16, 12, 22],
      'line-blur': 6,
      'line-opacity': 0.45
    }
  });

  map.addLayer({
    id: 'water-body-highlight-glow-inner',
    type: 'line',
    source: WATER_HIGHLIGHT_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ff6ec7',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 8, 3, 12, 4],
      'line-opacity': 1
    }
  });

  // Plain crisp blue line, no halo/blur/shading — water bodies only. Sits
  // on top of the magenta glow, so a highlighted river still visually
  // reads as "this is a river" (blue) with "and it's the selected one"
  // (magenta glow) layered underneath, rather than losing its own color
  // identity. Admin boundaries (provinces/commanderies) show the glow
  // alone, since they don't have an equivalent identity color to preserve.
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

    showSearchResultPanel(popupHtml, highlightId);
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

// Mirrors how towns derive kingdom from their own province (town.kingdom
// || PROVINCE_KINGDOM[town.Prov_EN]) — a province looks itself up
// directly, a commandery looks up its parent province. Tributaries
// aren't administered territory and generally won't resolve to a kingdom.
function getAdminKingdom(props) {
  if (!props) return 'unknown';
  if (props.level === 'commandery' || props.level === 'tributary') {
    return PROVINCE_KINGDOM[props.Prov_EN] || 'unknown';
  }
  return PROVINCE_KINGDOM[props.Name_EN] || 'unknown';
}

// Counts county-level settlements sharing this commandery's name. A
// Commandery Seat or Provincial Seat is itself administratively a
// county (it's simply the county that also hosts a higher office), so
// all three types count — not just settlements explicitly typed
// "county".
function countCountiesInCommandery(commEN) {
  if (!commEN) return 0;
  const countyLevelTypes = new Set([TOWN_TYPES.county, TOWN_TYPES.commandery, TOWN_TYPES.provincial]);
  return allTowns.filter(t => t.Comm_EN === commEN && countyLevelTypes.has(normaliseTownType(t.Type))).length;
}

// Counts commandery-level admin boundaries whose Prov_EN matches this
// province. allAdminBoundariesCache is already populated by the time an
// admin boundary card renders, since finding the feature to highlight in
// the first place requires that same data to already be loaded.
function countCommanderiesInProvince(provEN) {
  if (!provEN || !allAdminBoundariesCache) return 0;
  return allAdminBoundariesCache.filter(f => f.properties?.level === 'commandery' && f.properties?.Prov_EN === provEN).length;
}

function buildAdminBoundaryDetailHtml(props) {
  const name = formatAdminBoundaryName(props);
  const subtitle = formatAdminBoundarySubtitle(props);
  const isCommandery = props?.level === 'commandery';
  const isTributary = props?.level === 'tributary';
  const isProvince = !isCommandery && !isTributary;

  let typeLabel;
  if (isCommandery) typeLabel = uiText.commandery;
  else if (isTributary) typeLabel = uiText.tributary;
  else typeLabel = uiText.province;

  const kingdom = getAdminKingdom(props);
  const kingdomLabel = KINGDOM_LABEL[kingdom] || '';

  // Tributaries aren't administered territory, so they keep the original
  // "Province · Name" breadcrumb rather than the province/count fields
  // that make sense for real administrative units.
  const tributaryFamily = isTributary
    ? `${escapeHtml(formatAdminParentName(props))} · ${escapeHtml(name)}`
    : '';

  const provinceName = isCommandery ? formatAdminParentName(props) : '';
  const countyCount = isCommandery ? countCountiesInCommandery(props.Name_EN) : null;
  const commanderyCount = isProvince ? countCommanderiesInProvince(props.Name_EN) : null;

  return `
    <div class="imap-water-card imap-admin-card">
      <div class="imap-town-name">${escapeHtml(name)}</div>
      ${subtitle ? `<div class="imap-town-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      <div class="imap-town-meta">
        ${metaRow(uiText.type, `${kingdomLabel ? `<span class="imap-town-kingdom imap-town-kingdom-${escapeHtml(kingdom)}">${escapeHtml(kingdomLabel)}</span>` : ''}<span>${escapeHtml(typeLabel)}</span>`)}
        ${tributaryFamily ? metaRow(uiText.region, tributaryFamily) : ''}
        ${provinceName ? metaRow(uiText.province, escapeHtml(provinceName)) : ''}
        ${countyCount !== null ? metaRow(uiText.counties, String(countyCount)) : ''}
        ${commanderyCount !== null ? metaRow(uiText.commanderies, String(commanderyCount)) : ''}
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

  const propName = feature.properties?.level === 'province' ? 'Prov_EN' : 'Comm_EN';
  dimTownsOutsideRegion(propName, feature.properties?.Name_EN);
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

// LAYER BUILDING 
function hideModernInfrastructure() {
  if (!map || (currentStyle !== 'outdoor' && currentStyle !== 'satellite')) return;

  const styleLayers = map.getStyle()?.layers ?? [];

  // 'trail' is a supplementary hiking-trail layer MapTiler's outdoor style
  // adds on top of the base road network. The actual road/track network
  // itself lives in the standard OpenMapTiles 'transportation' /
  // 'transportation_name' source-layers — hiding both groups removes
  // modern roads, tracks, and paths entirely, leaving just the physical
  // terrain base.
  const layersToHide = ['trail', 'transportation', 'transportation_name'];

  styleLayers.forEach(layer => {
    if (layersToHide.includes(layer['source-layer'])) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });
}

function addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON = yellowRiverOldCourseCache, commanderiesGeoJSON = commanderiesGeoJSONCache) {
  if (hasThreeKArchiveLayers()) return;

  hideModernInfrastructure();

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
    syncToggleStatesFromDOM();

    if (pendingJourney) {
      const { data } = pendingJourney;
      pendingJourney = null;
      renderJourneyView(data);
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

    map.addControl(new FitAllTownsControl(), 'top-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    wireToggles();
    wireStyleButtons();

    map.on('load', () => {
      addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON, commanderiesGeoJSON);

      mapReady = true;

      syncToggleStatesFromDOM();

      if (loadingEl) loadingEl.style.display = 'none';

      // scenario 4: redirected from a chapter — journey overview (all pins/borders equal)
      // scenario 2: redirected with coordinates — zoom to location
      // scenario 1: clean boot — fit all towns
        if (pendingJourney) {
          // scenario 4: arrived via a chapter's "view life journey" link
          const { data } = pendingJourney;
          pendingJourney = null;
          renderJourneyView(data);
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