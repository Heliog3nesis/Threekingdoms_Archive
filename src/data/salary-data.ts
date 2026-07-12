// salary-data.ts
// Han dynasty official salary table, trilingual.
// Source: Hans Bielenstein, "The Bureaucracy of Han Times" (estimated values shown
// in blue); Yan Shigu's annotations of Book of Han; Book of the Later Han, Treatise
// of the Hundred Offices.
//
// Three distinct value categories appear in the original table:
//   - plain: directly attested baseline value, no marking
//   - footnoted (underlined in source): carries a source citation footnote
//   - estimated (blue in source): Bielenstein's estimated/adjusted figure
//   - alternate (italic in source): a distinct attested alternate value —
//     NOT a footnote and NOT a Bielenstein estimate. Rendered with its own
//     accent color rather than italics, per design decision.

export interface SalaryCell {
  value: string;
  kind?: 'plain' | 'footnoted' | 'estimated' | 'alternate';
}

export interface SalaryMultiCell {
  primary: SalaryCell;
  alt?: SalaryCell;
}

export interface SalaryRow {
  id: string;
  rank: { en: string; zht: string; zhs: string };
  monthlyGrainHu: SalaryMultiCell;
  annualDanHu: string;
  monthlyCoin: SalaryMultiCell;
  monthlyHuskedGrain: SalaryMultiCell;
  rowspanGroup?: string;
}

function cell(value: string, kind: SalaryCell['kind'] = 'plain'): SalaryCell {
  return { value, kind };
}

export const salaryIntro = {
  en: 'One <em>hu</em> (斛) = one <em>shi</em> (石), at approximately 20 litres in volume, or about 10-20 kg of grain, depending on grain type and packing.<sup>1</sup>',
  zht: '秦漢時一斛（<em>hu</em>）等於一石（<em>shi</em>），約合20公升，折合穀物重量因種類及裝填密度而異，大致為10-20公斤。<sup>1</sup>',
  zhs: '秦汉时一斛（<em>hu</em>）等于一石（<em>shi</em>），约合20公升，折合谷物重量因种类及装填密度而异，大致为10-20公斤。<sup>1</sup>',
};

export const salaryColumns = {
  rank: {
    label: { en: 'Annual salary rank (<em>shi</em>)', zht: '年俸（石）', zhs: '年俸（石）' },
    footnotes: [2, 3],
  },
  monthlyGrain: {
    label: { en: 'Monthly salary — unhusked grain (<em>hu</em>)', zht: '月粟米（斛）', zhs: '月粟米（斛）' },
    sub: {
      en: [
        { text: 'Former Han', kind: 'alternate' },
        { text: ', Later Han AD 50 or ', kind: 'plain' },
        { text: 'both', kind: 'footnoted' },
      ],
      zht: [
        { text: '西漢', kind: 'alternate' },
        { text: '，東漢建武中元二年（AD 50），或', kind: 'plain' },
        { text: '兩漢同', kind: 'footnoted' },
      ],
      zhs: [
        { text: '西汉', kind: 'alternate' },
        { text: '，东汉建武中元二年（AD 50），或', kind: 'plain' },
        { text: '两汉同', kind: 'footnoted' },
      ],
    },
    footnotes: [2, 3],
  },
  annualDanHu: {
    label: { en: 'Calculated actual annual shi/hu', zht: '實際年俸（石/斛）', zhs: '实际年俸（石/斛）' },
  },
  monthlyCoin: {
    label: { en: 'Monthly salary in coin', zht: '月俸錢', zhs: '月俸钱' },
    sub: {
      en: [
        { text: 'Later Han 106 AD', kind: 'plain' },
        { text: ', ', kind: 'plain' },
        { text: "Bielenstein's estimates", kind: 'estimated' },
      ],
      zht: [
        { text: '東漢元興元年（AD 106）', kind: 'plain' },
        { text: '，', kind: 'plain' },
        { text: '畢漢思（Bielenstein）估算值', kind: 'estimated' },
      ],
      zhs: [
        { text: '东汉元兴元年（AD 106）', kind: 'plain' },
        { text: '，', kind: 'plain' },
        { text: '毕汉思（Bielenstein）估算值', kind: 'estimated' },
      ],
    },
    footnotes: [3, 4],
  },
  huskedGrain: {
    label: { en: 'Monthly salary in husked grain (<em>hu</em>)', zht: '月俸穀（斛）', zhs: '月俸谷（斛）' },
    sub: {
      en: [
        { text: 'Later Han 106 AD', kind: 'plain' },
        { text: ', ', kind: 'plain' },
        { text: "Bielenstein's estimates", kind: 'estimated' },
      ],
      zht: [
        { text: '東漢元興元年（AD 106）', kind: 'plain' },
        { text: '，', kind: 'plain' },
        { text: '畢漢思（Bielenstein）估算值', kind: 'estimated' },
      ],
      zhs: [
        { text: '东汉元兴元年（AD 106）', kind: 'plain' },
        { text: '，', kind: 'plain' },
        { text: '毕汉思（Bielenstein）估算值', kind: 'estimated' },
      ],
    },
    footnotes: [3, 4],
  },
};

export const salaryFootnotes = {
  en: [
    'Zou Dahai, Changes in the Qin-Han Measurement Unit shi Viewed through Excavated Textual Evidence (鄒大海《從出土文獻看秦漢計量單位石的變遷》).',
    "Yan Shigu's annotations of Book of Han, Table of Nobility Ranks and Government Offices (顔師古注《漢書‧百官公卿表》).",
    'Book of the Later Han, Treatise of the Hundred Offices and annotations (《後漢書‧百官志》及注).',
    'The salaries of the officials (Chapter 5), in The Bureaucracy of Han Times, Hans Bielenstein.',
  ],
  zht: [
    '鄒大海《從出土文獻看秦漢計量單位石的變遷》。',
    '顔師古注《漢書‧百官公卿表》。',
    '《後漢書‧百官志》及注。',
    '畢漢思《漢代官制》（The Bureaucracy of Han Times）第五章，官吏俸祿。',
  ],
  zhs: [
    '邹大海《从出土文献看秦汉计量单位石的变迁》。',
    '颜师古注《汉书‧百官公卿表》。',
    '《后汉书‧百官志》及注。',
    '毕汉思《汉代官制》（The Bureaucracy of Han Times）第五章，官吏俸禄。',
  ],
};

export const salaryRows: SalaryRow[] = [
  {
    id: 'salary-10000',
    rank: { en: '萬 10000', zht: '萬 10000', zhs: '万 10000' },
    monthlyGrainHu: { primary: cell('350', 'footnoted') },
    annualDanHu: '4200',
    monthlyCoin: { primary: cell('17500') },
    monthlyHuskedGrain: { primary: cell('105', 'estimated') },
  },
  {
    id: 'salary-zhong2000',
    rank: { en: '中二千 Fully 2000', zht: '中二千 Fully 2000', zhs: '中二千 Fully 2000' },
    monthlyGrainHu: { primary: cell('180', 'footnoted') },
    annualDanHu: '2160',
    monthlyCoin: { primary: cell('9000') },
    monthlyHuskedGrain: { primary: cell('72'), alt: cell('54', 'estimated') },
  },
  {
    id: 'salary-zhen2000',
    rank: { en: '真二千 True 2000', zht: '真二千 True 2000', zhs: '真二千 True 2000' },
    monthlyGrainHu: { primary: cell('150', 'footnoted') },
    annualDanHu: '1800',
    monthlyCoin: { primary: cell('6500'), alt: cell('6000', 'estimated') },
    monthlyHuskedGrain: { primary: cell('36') },
    rowspanGroup: 'true2000-group',
  },
  {
    id: 'salary-2000',
    rank: { en: '二千 2000', zht: '二千 2000', zhs: '二千 2000' },
    monthlyGrainHu: { primary: cell('120', 'footnoted') },
    annualDanHu: '1440',
    monthlyCoin: { primary: cell('6500'), alt: cell('6000', 'estimated') },
    monthlyHuskedGrain: { primary: cell('36') },
    rowspanGroup: 'true2000-group',
  },
  {
    id: 'salary-bi2000',
    rank: { en: '比二千 Equivalent to 2000', zht: '比二千 Equivalent to 2000', zhs: '比二千 Equivalent to 2000' },
    monthlyGrainHu: { primary: cell('100', 'footnoted') },
    annualDanHu: '1200',
    monthlyCoin: { primary: cell('5000') },
    monthlyHuskedGrain: { primary: cell('34'), alt: cell('30', 'estimated') },
  },
  {
    id: 'salary-1000',
    rank: { en: '千 1000', zht: '千 1000', zhs: '千 1000' },
    monthlyGrainHu: { primary: cell('90', 'alternate'), alt: cell('80') },
    annualDanHu: '960-1080',
    monthlyCoin: { primary: cell('4000'), alt: cell('4500', 'estimated') },
    monthlyHuskedGrain: { primary: cell('30'), alt: cell('27', 'estimated') },
  },
  {
    id: 'salary-bi1000',
    rank: { en: '比千 Equivalent to 1000', zht: '比千 Equivalent to 1000', zhs: '比千 Equivalent to 1000' },
    monthlyGrainHu: { primary: cell('80', 'alternate') },
    annualDanHu: '960',
    monthlyCoin: { primary: cell('4000', 'estimated') },
    monthlyHuskedGrain: { primary: cell('24', 'estimated') },
  },
  {
    id: 'salary-600',
    rank: { en: '六百 600', zht: '六百 600', zhs: '六百 600' },
    monthlyGrainHu: { primary: cell('70', 'footnoted') },
    annualDanHu: '840',
    monthlyCoin: { primary: cell('3500') },
    monthlyHuskedGrain: { primary: cell('21') },
  },
  {
    id: 'salary-bi600',
    rank: { en: '比六百 Equivalent to 600', zht: '比六百 Equivalent to 600', zhs: '比六百 Equivalent to 600' },
    monthlyGrainHu: { primary: cell('60', 'alternate'), alt: cell('50') },
    annualDanHu: '600-720',
    monthlyCoin: { primary: cell('3000', 'estimated') },
    monthlyHuskedGrain: { primary: cell('18', 'estimated') },
  },
  {
    id: 'salary-400',
    rank: { en: '四百 400', zht: '四百 400', zhs: '四百 400' },
    monthlyGrainHu: { primary: cell('50', 'alternate'), alt: cell('45') },
    annualDanHu: '540-600',
    monthlyCoin: { primary: cell('2500') },
    monthlyHuskedGrain: { primary: cell('15') },
  },
  {
    id: 'salary-bi400',
    rank: { en: '比四百 Equivalent to 400', zht: '比四百 Equivalent to 400', zhs: '比四百 Equivalent to 400' },
    monthlyGrainHu: { primary: cell('45', 'alternate'), alt: cell('40') },
    annualDanHu: '480-540',
    monthlyCoin: { primary: cell('2250', 'estimated') },
    monthlyHuskedGrain: { primary: cell('13.5', 'estimated') },
  },
  {
    id: 'salary-300',
    rank: { en: '三百 300', zht: '三百 300', zhs: '三百 300' },
    monthlyGrainHu: { primary: cell('40', 'footnoted') },
    annualDanHu: '480',
    monthlyCoin: { primary: cell('1850', 'estimated') },
    monthlyHuskedGrain: { primary: cell('12') },
  },
  {
    id: 'salary-bi300',
    rank: { en: '比三百 Equivalent to 300', zht: '比三百 Equivalent to 300', zhs: '比三百 Equivalent to 300' },
    monthlyGrainHu: { primary: cell('37', 'footnoted') },
    annualDanHu: '444',
    monthlyCoin: { primary: cell('1850', 'estimated') },
    monthlyHuskedGrain: { primary: cell('11.1', 'estimated') },
  },
  {
    id: 'salary-200',
    rank: { en: '二百 200', zht: '二百 200', zhs: '二百 200' },
    monthlyGrainHu: { primary: cell('30', 'footnoted') },
    annualDanHu: '360',
    monthlyCoin: { primary: cell('1000'), alt: cell('1500', 'estimated') },
    monthlyHuskedGrain: { primary: cell('9') },
  },
  {
    id: 'salary-bi200',
    rank: { en: '比二百 Equivalent to 200', zht: '比二百 Equivalent to 200', zhs: '比二百 Equivalent to 200' },
    monthlyGrainHu: { primary: cell('27', 'footnoted') },
    annualDanHu: '324',
    monthlyCoin: { primary: cell('1350', 'estimated') },
    monthlyHuskedGrain: { primary: cell('8.1', 'estimated') },
  },
  {
    id: 'salary-100',
    rank: { en: '一百 100', zht: '一百 100', zhs: '一百 100' },
    monthlyGrainHu: { primary: cell('16', 'footnoted') },
    annualDanHu: '192',
    monthlyCoin: { primary: cell('800') },
    monthlyHuskedGrain: { primary: cell('4.8') },
  },
  {
    id: 'salary-doushi',
    rank: { en: '斗食 Paid in Dou', zht: '斗食 Paid in Dou', zhs: '斗食 Paid in Dou' },
    monthlyGrainHu: { primary: cell('11') },
    annualDanHu: '132',
    monthlyCoin: { primary: cell('550', 'estimated') },
    monthlyHuskedGrain: { primary: cell('3.3', 'estimated') },
  },
  {
    id: 'salary-zuoli',
    rank: { en: '佐吏 Accessory Clerks', zht: '佐吏 Accessory Clerks', zhs: '佐吏 Accessory Clerks' },
    monthlyGrainHu: { primary: cell('8') },
    annualDanHu: '96',
    monthlyCoin: { primary: cell('400', 'estimated') },
    monthlyHuskedGrain: { primary: cell('2.4', 'estimated') },
  },
];