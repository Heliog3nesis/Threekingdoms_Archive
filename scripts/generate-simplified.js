import * as OpenCC from 'opencc-js';
import { zh } from '../src/i18n/zh-hant.js';
import { writeFileSync, existsSync } from 'fs';

// load overrides if file exists
let overrides = {};
try {
  const { overrides: o } = await import('../src/i18n/zh-hans-overrides.js');
  overrides = o;
  console.log(`Loaded ${Object.keys(overrides).length} override(s)`);
} catch {
  console.log('No overrides file found, skipping');
}

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

function convertDeep(obj) {
  if (typeof obj === 'string') return converter(obj);
  if (Array.isArray(obj)) return obj.map(convertDeep);
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertDeep(v)])
    );
  }
  return obj;
}

function applyOverrides(obj, overrides) {
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split('.');
    let target = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      // handle array indices e.g. featured.0.desc
      const key = isNaN(keys[i]) ? keys[i] : parseInt(keys[i]);
      target = target[key];
      if (target === undefined) {
        console.warn(`Override path "${path}" not found at "${keys[i]}"`);
        break;
      }
    }
    if (target !== undefined) {
      const lastKey = isNaN(keys[keys.length - 1])
        ? keys[keys.length - 1]
        : parseInt(keys[keys.length - 1]);
      target[lastKey] = value;
    }
  }
  return obj;
}

const simplified = convertDeep(zh);
applyOverrides(simplified, overrides);

writeFileSync(
  'src/i18n/zh-hans.js',
  `export const zh_hans = ${JSON.stringify(simplified, null, 2)};\n`
);

console.log('zh-hans.js generated successfully');

// Always run node scripts/generate-simplified.js before compiling