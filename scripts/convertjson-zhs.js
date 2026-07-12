/**
 * convert-json-zht-to-zhs.js
 *
 * Converts Traditional Chinese strings in a JSON file to Simplified Chinese,
 * adding a new key alongside the existing one.
 *
 * Usage:
 *   node scripts/convertjson-zhs.js <jsonFile> <sourceKey> <targetKey>
 *
 * Example:
 *   node scripts/convertjson-zhs.js src/data/short-stories-database.json zht zhs
 *
 * This will find every object with a `zht` key and add a `zhs` key next to it
 * with the converted Simplified Chinese text.
 */

import * as OpenCC from 'opencc-js';
import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node convert-json-zht-to-zhs.js <jsonFile> <sourceKey> <targetKey>');
  console.error('Example: node convert-json-zht-to-zhs.js src/data/short-stories-database.json zht zhs');
  process.exit(1);
}

const [jsonFile, sourceKey, targetKey] = args;

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

function convertDeep(obj) {
  if (typeof obj === 'string') return obj; // don't convert strings at top level
  if (Array.isArray(obj)) {
    return obj.map(item => convertDeep(item));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = convertDeep(v); // copy as-is (recurse but don't convert strings)
      if (k === sourceKey) {
        result[targetKey] = convertStrings(v); // convert only for the new key
      }
    }
    return result;
  }
  return obj;
}

function convertStrings(obj) {
  if (typeof obj === 'string') return converter(obj);
  if (Array.isArray(obj)) return obj.map(convertStrings);
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertStrings(v)])
    );
  }
  return obj;
}

// read JSON
let data;
try {
  data = JSON.parse(readFileSync(jsonFile, 'utf-8'));
} catch (e) {
  console.error(`Failed to read ${jsonFile}:`, e.message);
  process.exit(1);
}

const converted = convertDeep(data);

writeFileSync(jsonFile, JSON.stringify(converted, null, 2));
console.log(`Done — added "${targetKey}" keys from "${sourceKey}" in ${jsonFile}`);