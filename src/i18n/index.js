import { en } from './en.js';
import { zh } from './zh-hant.js';
import { zh_hans } from './zh-hans.js';

export const languages = {
  en,
  'zh-hant': zh,
  'zh-hans': zh_hans,
};
export const defaultLang = 'en';

export function t(lang) {
  return languages[lang] ?? languages[defaultLang];
}
