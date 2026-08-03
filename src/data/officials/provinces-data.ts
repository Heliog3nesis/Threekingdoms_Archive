// province-data.ts
// Province → static PNG map mapping, trilingual names.

export interface ProvinceInfo {
  name: { en: string; zht: string; zhs: string };
  pngUrl: string;
}

export const provinceData: Record<string, ProvinceInfo> = {
  Bingzhou:      { name: { en: 'Bing Province', zht: '并州', zhs: '并州' }, pngUrl: '/mapbase/Bingzhou.png' },
  Jiaozhou1:     { name: { en: 'Jiao Province', zht: '交州', zhs: '交州' }, pngUrl: '/mapbase/Jiaozhou.png' },
  Jiaozhou2:     { name: { en: 'Jiao Province', zht: '交州', zhs: '交州' }, pngUrl: '/mapbase/Jiaozhou.png' },
  Jingzhou_Wei:  { name: { en: 'Jing Province (Wei)', zht: '荊州（魏）', zhs: '荆州（魏）' }, pngUrl: '/mapbase/Jing_Wei.png' },
  Jingzhou_Wu:   { name: { en: 'Jing Province (Wu)',  zht: '荊州（吳）', zhs: '荆州（吴）' }, pngUrl: '/mapbase/Jing_Wu.png' },
  Jizhou:        { name: { en: 'Ji Province', zht: '冀州', zhs: '冀州' }, pngUrl: '/mapbase/Jizhou.png' },
  Liangzhou:     { name: { en: 'Liang Province', zht: '涼州', zhs: '凉州' }, pngUrl: '/mapbase/Liangzhou.png' },
  Qingzhou:      { name: { en: 'Qing Province', zht: '青州', zhs: '青州' }, pngUrl: '/mapbase/Qing_Xu.png' },
  Xuzhou:        { name: { en: 'Xu Province', zht: '徐州', zhs: '徐州' }, pngUrl: '/mapbase/Qing_Xu.png' },
  Sili:          { name: { en: 'Sili (Capital Region)', zht: '司隸', zhs: '司隶' }, pngUrl: '/mapbase/Sili.png' },
  Yanzhou:       { name: { en: 'Yan Province', zht: '兗州', zhs: '兖州' }, pngUrl: '/mapbase/Yan_Yu_Yang.png' },
  Yuzhou:        { name: { en: 'Yu Province', zht: '豫州', zhs: '豫州' }, pngUrl: '/mapbase/Yan_Yu_Yang.png' },
  Yangzhou_Wei:  { name: { en: 'Yang Province (Wei)', zht: '揚州（魏）', zhs: '扬州（魏）' }, pngUrl: '/mapbase/Yan_Yu_Yang.png' },
  Yangzhou_Wu:   { name: { en: 'Yang Province (Wu)',  zht: '揚州（吳）', zhs: '扬州（吴）' }, pngUrl: '/mapbase/Yang_Wu.png' },
  Yizhou_north:  { name: { en: 'Yi Province (North)', zht: '益州（北）', zhs: '益州（北）' }, pngUrl: '/mapbase/Yi_North.png' },
  Yizhou_south:  { name: { en: 'Yi Province (South)', zht: '益州（南）', zhs: '益州（南）' }, pngUrl: '/mapbase/Yi_South.png' },
  Yongzhou:      { name: { en: 'Yong Province', zht: '雍州', zhs: '雍州' }, pngUrl: '/mapbase/Yongzhou.png' },
  Youzhou:       { name: { en: 'You Province', zht: '幽州', zhs: '幽州' }, pngUrl: '/mapbase/Youzhou.png' },
};