// interactive-map.js
// Fully self-contained MapTiler SDK interactive map for the Three Kingdoms Archive.
// Fetches its own data; exposes initInteractiveMap() and flyToLocation().

// CONFIG 
import { url } from '../../utils/url';
// No import from journey.js here, deliberately - journey.js imports many
// things back from this file, and interactive-map.js importing anything
// from journey.js in return would make the two circularly dependent.
// clearJourneyBoundaries is small enough to just define locally (both
// files need it); renderJourneyView is registered via a callback instead
// - see registerRenderJourneyView below and its call at the bottom of
// journey.js.
let renderJourneyViewCallback = null;
export function registerRenderJourneyView(fn) { renderJourneyViewCallback = fn; }
const MAPTILER_KEY = 'cFkDNINBrduwymf4YJRx';
const MAP_STYLES = {
  outdoor: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
};

export const PROVINCE_KINGDOM = {
  'Bingzhou': 'wei', 'Jizhou': 'wei', 'Qingzhou': 'wei',
  'Yanzhou': 'wei', 'Yuzhou': 'wei', 'Youzhou': 'wei',
  'Liangzhou': 'wei', 'Sili': 'wei', 'Yongzhou': 'wei',
  'Xuzhou': 'wei', 'Jingzhou (Wei)': 'wei', 'Yangzhou (Wei)': 'wei',
  'Yizhou (North)': 'shu', 'Yizhou (South)': 'shu',
  'Jiaozhou': 'wu', 'Jingzhou (Wu)': 'wu', 'Yangzhou (Wu)': 'wu',
  'Xiyu': 'wei', // Western Regions — under Wei's protectorate
};

const KINGDOM_FILL = {
  wei: 'rgba(75,111,159,0.14)',
  shu: 'rgba(35,95,80,0.24)',
  wu: 'rgba(200,96,96,0.14)',
  unknown: 'rgba(120,120,120,0.05)'
};

export const KINGDOM_LINE = {
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
    unnamedLocation: 'Unnamed location', settlement: 'Settlement', modern: 'Modern', administrativeNote: 'Administrative Note', close: 'Close', showAllTowns: 'Show all towns', failedToLoadMap: 'Failed to load map', waterBody: 'River', province: 'Province', commandery: 'Commandery', tributary: 'Tributary State', island: 'Island', counties: 'Counties', commanderies: 'Commanderies', type: 'Type', region: 'Region', biography: 'Biography', previousPerson: 'Previous person', nextPerson: 'Next person', exitJourney: 'Exit journey', hometown: 'Hometown', dateUnknown: 'Unknown', uncertainYearNote: 'Year is uncertain or approximate', connectionsWeb: 'Connections', titlesLabel: 'Titles',
    kingdomLabels: { wei: 'Wei', shu: 'Shu', wu: 'Wu', unknown: '' },
    typeLabels: { 'Provincial Seat': 'Provincial Seat', 'Commandery Seat': 'Commandery Seat', 'County Seat': 'County Seat', 'Military Pass': 'Military Pass', Landmark: 'Landmark', Others: 'Others' }
  },
  'zh-hant': {
    unnamedLocation: '未命名地點', settlement: '地點', modern: '現代位置', administrativeNote: '政區考釋', close: '關閉', showAllTowns: '顯示全部地點', failedToLoadMap: '地圖加載失敗', waterBody: '河流', province: '州', commandery: '郡', tributary: '藩屬國', island: '島嶼', counties: '轄縣數', commanderies: '轄郡數', type: '類型', region: '政區', biography: '傳記', previousPerson: '上一人', nextPerson: '下一人', exitJourney: '退出人生軌跡', hometown: '籍貫', dateUnknown: '不詳', uncertainYearNote: '年份不確定或為推算', connectionsWeb: '人物關係', titlesLabel: '官爵',
    kingdomLabels: { wei: '魏', shu: '蜀', wu: '吳', unknown: '' },
    typeLabels: { 'Provincial Seat': '州治', 'Commandery Seat': '郡治', 'County Seat': '縣治', 'Military Pass': '關隘', Landmark: '地標', Others: '其他' }
  },
  'zh-hans': {
    unnamedLocation: '未命名地点', settlement: '地点', modern: '现代位置', administrativeNote: '政区考释', close: '关闭', showAllTowns: '显示全部地点', failedToLoadMap: '地图加载失败', waterBody: '河流', province: '州', commandery: '郡', tributary: '藩属国', island: '岛屿', counties: '辖县数', commanderies: '辖郡数', type: '类型', region: '政区', biography: '传记', previousPerson: '上一人', nextPerson: '下一人', exitJourney: '退出人生轨迹', hometown: '籍贯', dateUnknown: '不详', uncertainYearNote: '年份不确定或为推算', connectionsWeb: '人物关系', titlesLabel: '官爵',
    kingdomLabels: { wei: '魏', shu: '蜀', wu: '吴', unknown: '' },
    typeLabels: { 'Provincial Seat': '州治', 'Commandery Seat': '郡治', 'County Seat': '县治', 'Military Pass': '关隘', Landmark: '地标', Others: '其他' }
  }
};

export let currentLang = 'en';
export let uiText = UI_TEXT.en;

function configureLocale(options = {}) {
  currentLang = options.lang || document.documentElement.lang || 'en';
  uiText = { ...UI_TEXT.en, ...(UI_TEXT[currentLang] || {}), ...(options.labels || {}) };
  uiText.kingdomLabels = { ...UI_TEXT.en.kingdomLabels, ...((UI_TEXT[currentLang] || {}).kingdomLabels || {}), ...(options.labels?.kingdomLabels || {}) };
  uiText.typeLabels = { ...UI_TEXT.en.typeLabels, ...((UI_TEXT[currentLang] || {}).typeLabels || {}), ...(options.labels?.typeLabels || {}) };
  Object.assign(KINGDOM_LABEL, uiText.kingdomLabels);
}

export function isChineseMap() {
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
// Western Regions (西域) tributary states — a standalone overlay from
// Xiyu.json. Always displayed (no toggle); rendered in Wei's colours since
// the region was under Wei's Western Regions protectorate.
const XIYU_LAYERS = ['xiyu-fill', 'xiyu-line', 'xiyu-label'];
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
  ...XIYU_LAYERS,
  ...PROVINCE_LAYERS
];
const ARCHIVE_SOURCES = ['towns', 'provinces', 'commanderies', 'yellow-river-old-course', 'xiyu'];
const WEB_MERCATOR_RADIUS = 6378137;
export const FULL_EXTENT_PADDING = { top: 56, right: 56, bottom: 56, left: 56 };

const TOWN_TYPES = {
  provincial: 'provincial',
  commandery: 'commandery',
  county: 'county',
  military: 'military',
  landmark: 'landmark',
  other: 'other'
};

// STATE 
export let map = null;
let mapLoaded = false;
export let mapReady = false;
let showProvinces = true;
let showLabels = false;
let showYellowRiverOldCourse = true;
let currentStyle = 'outdoor';
let provincesGeoJSONCache = null;
let commanderiesGeoJSONCache = null;
let yellowRiverOldCourseCache = null;
let xiyuCache = null;
let xiyuRawFeatures = []; // 3857 originals, kept for on-click highlight
let xiyuInteractionsWired = false;
let commanderyInteractionsWired = false;
let baseMapModernLayers = [];
export let allTowns = [];
let pendingFlyTo = null;
let pendingJourney = null; // { data } — deferred until map is ready, same pattern as pendingFlyTo
// journey.js sets this through the setter (rather than importing and
// reassigning the variable directly, which ES modules don't allow) since
// showJourney lives there but the map-ready consumption logic that reads
// it stays here in initInteractiveMap.
export function setPendingJourney(value) { pendingJourney = value; }
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

export function convertGeometryToLngLat(geometry, shouldConvert) {
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
export const WATER_BODIES_ARE_WEB_MERCATOR = true;
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

// Standard area-weighted polygon centroid (shoelace-formula centroid) of
// just the outer ring - holes are small relative to these shapes and
// aren't worth the extra complexity for label placement purposes. Falls
// back to a simple vertex average for degenerate (near-zero-area) rings,
// since the area-weighted formula divides by area and would blow up.
function computeRingCentroid(ring) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const n = ring.length;
    const avg = ring.reduce((acc, [x, y]) => [acc[0] + x / n, acc[1] + y / n], [0, 0]);
    return avg;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// Outer ring is whichever ring in the Polygon/MultiPolygon has the
// largest bounding-box span - a reasonable proxy for "largest part" that
// avoids needing true polygon-area comparison across multiple parts.
function computeFeatureLabelPoint(geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let best = null, bestSpan = -Infinity;
  for (const poly of polygons) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const xs = outer.map(p => p[0]), ys = outer.map(p => p[1]);
    const span = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
    if (span > bestSpan) { bestSpan = span; best = outer; }
  }
  return best ? computeRingCentroid(best) : null;
}

// Western Regions tributary polygons (Xiyu.json). Stored in EPSG:3857 like
// the province data, so the same web-mercator detection/conversion applies.
// Every feature is level 'tributary' with a baked-in `kingdom` field.
async function fetchXiyu() {
  try {
    const raw = await fetch(url('/mapbase/Xiyu.json')).then(r => r.json());
    xiyuRawFeatures = raw.features ?? [];
    const shouldConvert = provinceDataUsesWebMercator(raw);

    const features = xiyuRawFeatures.map(f => ({
      ...f,
      geometry: convertGeometryToLngLat(f.geometry, shouldConvert),
      properties: {
        ...f.properties,
        kingdom: f.properties?.kingdom ?? PROVINCE_KINGDOM[f.properties?.Prov_EN] ?? 'wei'
      }
    }));

    // A separate point source for labels, one feature per state, computed
    // once here rather than per-render - this is what actually fixes the
    // duplicate-label bug: a polygon symbol source gets a label position
    // computed independently per map tile, so once a state's shape spans
    // multiple tiles (which starts happening as you zoom in), MapLibre
    // renders one label per tile for the same state. A point source has
    // no such ambiguity - each state is exactly one point, in exactly one
    // tile, so exactly one label.
    const labelFeatures = features
      .map(f => {
        const point = computeFeatureLabelPoint(f.geometry);
        return point ? { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: point } } : null;
      })
      .filter(Boolean);

    return {
      polygons: { type: 'FeatureCollection', features },
      labels: { type: 'FeatureCollection', features: labelFeatures }
    };
  } catch (e) {
    console.warn('Could not load Western Regions (Xiyu) data:', e);
    return { polygons: { type: 'FeatureCollection', features: [] }, labels: { type: 'FeatureCollection', features: [] } };
  }
}

function xiyuLabelField() {
  if (currentLang === 'zh-hans') return ['coalesce', ['get', 'Name_CHS'], ['get', 'Name_CH'], ['get', 'Name_EN']];
  if (currentLang === 'zh-hant') return ['coalesce', ['get', 'Name_CH'], ['get', 'Name_CHS'], ['get', 'Name_EN']];
  return ['coalesce', ['get', 'Name_EN'], ['get', 'Name_CH']];
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

export function escapeHtml(value) {
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
  // one), or when it names a Xiyu tributary state directly (ending in
  // "State"/國 — these are the state's own name, not a governance seat
  // within it, so "Seat of X State"/"X國治所" would misrepresent them).
  // Guards against double-wrapping in case the source text already has
  // the phrasing baked in from the previous convention.
  const isTributaryStateName = /state$/i.test(english) || /[國国]$/.test(chinese);
  if (raw.includes('新城') || isTributaryStateName) {
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
  // Xiyu's tributary states aren't actual commanderies (direct Wei
  // administration) — never append 郡 to them, regardless of whether
  // their name happens to contain 国/國.
  const isXiyu = town.Prov_EN === 'Xiyu';

  if (currentLang === 'zh-hans') {
    const commandery = town.Comm_CHS || town.Comm_CH || town.Comm_EN || '';
    const commanderySuffix = commandery && !isXiyu && !/[国國]/.test(commandery) ? '郡' : '';
    return commandery ? `${commandery}${commanderySuffix}` : '';
  }

  if (currentLang === 'zh-hant') {
    const commandery = town.Comm_CH || town.Comm_CHS || town.Comm_EN || '';
    const commanderySuffix = commandery && !isXiyu && !/[国國]/.test(commandery) ? '郡' : '';
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

function dimTownsOutsideRegion(propName, value, secondaryPropName, secondaryValue) {
  if (!map || !value) return;
  // Some commandery names are reused across kingdoms (Jiangxia under both
  // Jingzhou (Wei) and Jingzhou (Wu); Lujiang under both Yangzhou (Wei) and
  // Yangzhou (Wu)) - matching on Comm_EN alone would light up both
  // kingdoms' towns together. When a secondary property/value pair is
  // given (used for the Comm_EN case, since Prov_EN values already
  // disambiguate themselves via the "(Wei)"/"(Wu)" suffix and don't need
  // this), require both to match.
  const matchExpr = secondaryPropName
    ? ['all', ['==', ['get', propName], value], ['==', ['get', secondaryPropName], secondaryValue]]
    : ['==', ['get', propName], value];
  TOWN_DIM_LAYERS.forEach(({ id, prop, normal }) => {
    if (!map.getLayer(id)) return;
    map.setPaintProperty(id, prop, ['case', matchExpr, normal, TOWN_DIM_OPACITY]);
  });
  if (map.getLayer('towns-county')) {
    map.setPaintProperty('towns-county', 'circle-stroke-opacity', ['case', matchExpr, 0.95, TOWN_DIM_OPACITY]);
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
  // Some commandery names are reused across kingdoms (e.g. Jiangxia exists
  // under both Jingzhou (Wei) and Jingzhou (Wu); Lujiang under both
  // Yangzhou (Wei) and Yangzhou (Wu)) - matching on Name_EN alone would
  // silently grab whichever one happens to come first in adminFeatures,
  // regardless of which the clicked town actually belongs to. Every town
  // already carries its own disambiguated Prov_EN (e.g. "Jingzhou (Wei)"),
  // and every commandery feature carries its parent province's Prov_EN, so
  // match on both. Fall back to name-only if that stricter match somehow
  // finds nothing, rather than showing no commandery at all.
  const commandery = adminFeatures.find(f => f.properties?.level === 'commandery' && f.properties?.Name_EN === town.Comm_EN && f.properties?.Prov_EN === town.Prov_EN)
    ?? adminFeatures.find(f => f.properties?.level === 'commandery' && f.properties?.Name_EN === town.Comm_EN);

  dimTownsOutsideRegion('Comm_EN', town.Comm_EN, 'Prov_EN', town.Prov_EN);

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

export function openTownDetail(town, fallbackLngLat, { keepJourney = false } = {}) {
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

export function computeGeometryBounds(geometry) {
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

// Separate persistent layer for journey-view admin boundary / water body
// borders. Defined here (not in journey.js) since interactive-map.js's
// own clearRegionHighlight needs it too - keeping it here means
// interactive-map.js never has to import anything back from journey.js
// (see registerRenderJourneyView above for how the one other piece
// journey.js needs to hand back, renderJourneyView, is wired up instead).
export const JOURNEY_BOUNDARY_SOURCE = 'journey-boundary-highlight';
export const JOURNEY_BOUNDARY_LAYER = 'journey-boundary-casing';

export function clearJourneyBoundaries() {
  if (!map) return;
  if (map.getLayer(JOURNEY_BOUNDARY_LAYER)) map.removeLayer(JOURNEY_BOUNDARY_LAYER);
  if (map.getSource(JOURNEY_BOUNDARY_SOURCE)) map.removeSource(JOURNEY_BOUNDARY_SOURCE);
}

// Bold, persistent border for every admin boundary / water body referenced
// in the current journey — deliberately BLACK (not the gold used by the
// single-select search highlight) so the two systems read as visually
// distinct: gold means "this is the one thing you searched for", black
// means "this is part of the journey overview". Also reused by this
// file's own highlightTownContext for the single-commandery highlight on
// a town click, and exported since journey.js needs it there too.
export function renderJourneyBoundaryLayer(featureCollection, { lineWidth, lineOpacity = 1, lineDasharray } = {}) {
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
  if (/^xiyu$/i.test(provEn)) return 'Western Regions';
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
export function getAdminKingdom(props) {
  if (!props) return 'unknown';
  if (props.level === 'commandery' || props.level === 'tributary' || props.level === 'island') {
    return PROVINCE_KINGDOM[props.Prov_EN] || 'unknown';
  }
  return PROVINCE_KINGDOM[props.Name_EN] || 'unknown';
}

// Counts county-level settlements sharing this commandery's name. A
// Commandery Seat or Provincial Seat is itself administratively a
// county (it's simply the county that also hosts a higher office), so
// all three types count — not just settlements explicitly typed
// "county". Some commandery names are reused across kingdoms (Jiangxia
// under both Jingzhou (Wei) and Jingzhou (Wu); Lujiang under both
// Yangzhou (Wei) and Yangzhou (Wu)) — matching on commEN alone would
// combine both kingdoms' towns into one count, so provEN is required
// too, same disambiguation used when finding the commandery polygon
// itself in highlightTownContext.
function countCountiesInCommandery(commEN, provEN) {
  if (!commEN) return 0;
  const countyLevelTypes = new Set([TOWN_TYPES.county, TOWN_TYPES.commandery, TOWN_TYPES.provincial]);
  return allTowns.filter(t => t.Comm_EN === commEN && t.Prov_EN === provEN && countyLevelTypes.has(normaliseTownType(t.Type))).length;
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
  // Not formally administered territory with its own sub-counties, same
  // as a tributary - explicit check rather than falling through to
  // isProvince by default, which is what silently misclassified this as
  // a province before Zhuya Zhou (or any future non-commandery,
  // non-tributary level) existed to expose the gap.
  const isIsland = props?.level === 'island';
  const isProvince = !isCommandery && !isTributary && !isIsland;

  let typeLabel;
  if (isCommandery) typeLabel = uiText.commandery;
  else if (isTributary) typeLabel = uiText.tributary;
  else if (isIsland) typeLabel = uiText.island;
  else typeLabel = uiText.province;

  const kingdom = getAdminKingdom(props);
  const kingdomLabel = KINGDOM_LABEL[kingdom] || '';

  // Tributaries and islands aren't administered territory, so they keep
  // the original "Province · Name" breadcrumb rather than the
  // province/count fields that make sense for real administrative units.
  const tributaryFamily = (isTributary || isIsland)
    ? `${escapeHtml(formatAdminParentName(props))} · ${escapeHtml(name)}`
    : '';

  const provinceName = isCommandery ? formatAdminParentName(props) : '';
  const countyCount = isCommandery ? countCountiesInCommandery(props.Name_EN, props.Prov_EN) : null;
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

  // Islands aren't administered territory with their own towns (Zhuya
  // Zhou has none), so there's nothing meaningful to dim by name the way
  // a real commandery's towns can be - skip it entirely rather than
  // dimming every town on the map because none matched a name that was
  // never a real Comm_EN in the first place.
  if (feature.properties?.level === 'island') return;

  const propName = feature.properties?.level === 'province' ? 'Prov_EN' : 'Comm_EN';
  const isCommandery = feature.properties?.level === 'commandery';
  dimTownsOutsideRegion(propName, feature.properties?.Name_EN, isCommandery ? 'Prov_EN' : undefined, isCommandery ? feature.properties?.Prov_EN : undefined);
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

function addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON = yellowRiverOldCourseCache, commanderiesGeoJSON = commanderiesGeoJSONCache, xiyuGeoJSON = xiyuCache) {
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
    // Invisible fill purely to capture clicks - commandery-line only
    // draws the outline itself, and MapLibre only fires click events for
    // a line layer when the cursor is exactly on the drawn line, not
    // anywhere inside the shape. A transparent fill layer gives the same
    // "click anywhere inside this commandery" behaviour Xiyu's tributary
    // states already have via xiyu-fill.
    map.addLayer({
      id: 'commandery-fill',
      type: 'fill',
      source: 'commanderies',
      paint: {
        'fill-color': '#000',
        'fill-opacity': 0
      }
    });

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

    if (!commanderyInteractionsWired) {
      commanderyInteractionsWired = true;

      map.on('click', 'commandery-fill', async e => {
        // Commanderies cover the entire map (unlike Xiyu's sparse 7
        // states), so every town sits inside some commandery. Without
        // this check, clicking any town anywhere would also fire the
        // commandery popup underneath it at the same time - check for a
        // town feature at this exact point first and yield to it, since
        // a specific town is more precise/useful than the commandery it
        // happens to sit in.
        const townHit = map.queryRenderedFeatures(e.point, {
          layers: ['towns-provincial', 'towns-commandery', 'towns-county', 'towns-military', 'towns-landmark', 'towns-others']
        });
        if (townHit.length) return;

        const id = e.features[0]?.properties?.id;
        // Re-highlight from the untouched 3857 original. fetchAdminBoundaries()
        // holds every province and commandery raw feature together
        // (already cached by the time this layer exists), so match by id.
        const adminFeatures = await fetchAdminBoundaries();
        const raw = adminFeatures.find(f => f.properties?.id === id);
        if (!raw) return;

        // Same black-boundary treatment as clicking a town (highlightTownContext),
        // rather than the gold/magenta search-highlight style - a direct
        // commandery click and a town's containing-commandery should look
        // the same regardless of which path got you there.
        clearWaterBodyHighlight();
        const convertedGeometry = convertGeometryToLngLat(raw.geometry, WATER_BODIES_ARE_WEB_MERCATOR);
        renderJourneyBoundaryLayer({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: raw.properties || {}, geometry: convertedGeometry }]
        }, {
          lineWidth: ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 12, 3.5],
          lineOpacity: 0.8
        });
        showSearchResultPanel(buildAdminBoundaryDetailHtml(raw.properties), `commandery-${id ?? ''}`);
      });

      map.on('mouseenter', 'commandery-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'commandery-fill', () => { map.getCanvas().style.cursor = ''; });
    }
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

  if (xiyuGeoJSON?.polygons?.features?.length) {
    map.addSource('xiyu', {
      type: 'geojson',
      data: xiyuGeoJSON.polygons
    });

    // Tributary states of the Western Regions — rendered in the same
    // kingdom-hue fill/line as the provinces (Wei), since the region fell
    // under Wei's Western Regions protectorate. Dashed line keeps the
    // tributary status legible against the solid province borders.
    map.addLayer({
      id: 'xiyu-fill',
      type: 'fill',
      source: 'xiyu',
      paint: {
        'fill-color': kExpr('kingdom', KINGDOM_FILL),
        'fill-opacity': 1
      }
    });

    map.addLayer({
      id: 'xiyu-line',
      type: 'line',
      source: 'xiyu',
      paint: {
        'line-color': kExpr('kingdom', KINGDOM_LINE),
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 7, 1.4, 10, 2],
        'line-opacity': 0.85,
        'line-dasharray': [3, 2]
      }
    });

    // One point per state, precomputed in fetchXiyu - see the comment
    // there for why a polygon source can't be used directly for labels
    // (splits across tiles at higher zoom, causing duplicate labels).
    map.addSource('xiyu-labels', {
      type: 'geojson',
      data: xiyuGeoJSON.labels
    });

    map.addLayer({
      id: 'xiyu-label',
      type: 'symbol',
      source: 'xiyu-labels',
      layout: {
        'text-field': xiyuLabelField(),
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 7, 13, 10, 15],
        'text-max-width': 8,
        // Only 7 tributary states, spread wide — force every label to render
        // (all-or-nothing) rather than letting collision detection silently
        // drop some at low zoom. Safe now that this is a point source (one
        // feature per state) rather than the polygon source - no risk of
        // the same state's label rendering more than once per tile split.
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': kExpr('kingdom', KINGDOM_LINE),
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.4
      }
    });

    if (!xiyuInteractionsWired) {
      xiyuInteractionsWired = true;

      map.on('click', 'xiyu-fill', e => {
        const id = e.features[0]?.properties?.id;
        // Re-highlight from the untouched 3857 original — renderSearchHighlight
        // expects web-mercator input and would double-convert the already
        // projected geometry carried on the rendered feature.
        const raw = xiyuRawFeatures.find(f => f.properties?.id === id);
        if (!raw) return;
        renderSearchHighlight(
          raw.geometry,
          raw.properties,
          buildAdminBoundaryDetailHtml(raw.properties),
          `xiyu-${id ?? ''}`,
          { showFill: false, showLine: false }
        );
      });

      map.on('mouseenter', 'xiyu-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'xiyu-fill', () => { map.getCanvas().style.cursor = ''; });
    }
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
  addLayers(provincesGeoJSONCache, yellowRiverOldCourseCache, commanderiesGeoJSONCache, xiyuCache);
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
      renderJourneyViewCallback?.(data);
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

    const [provincesAndCommanderies, townsData, yellowRiverOldCourseGeoJSON, xiyuGeoJSON] = await Promise.all([
      fetchProvincesAndCommanderies(),
      fetchTowns(),
      fetchYellowRiverOldCourse(),
      fetchXiyu(),
    ]);

    const provincesGeoJSON = provincesAndCommanderies.provinces;
    const commanderiesGeoJSON = provincesAndCommanderies.commanderies;

    provincesGeoJSONCache = provincesGeoJSON;
    commanderiesGeoJSONCache = commanderiesGeoJSON;
    yellowRiverOldCourseCache = yellowRiverOldCourseGeoJSON;
    xiyuCache = xiyuGeoJSON;
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
      addLayers(provincesGeoJSON, yellowRiverOldCourseGeoJSON, commanderiesGeoJSON, xiyuGeoJSON);

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
          renderJourneyViewCallback?.(data);
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