// @ts-check
import { defineConfig } from 'astro/config';

// @ts-ignore
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: 'https://heliog3nesis.github.io',
  base: isProd ? '/Threekingdoms_Archive' : '/',
});