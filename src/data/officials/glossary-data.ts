// glossary-data.ts
// Placeholder glossary terms — replace definitions with real content.
// Structured for an alphabetical list grouped by first letter (English term).

export interface GlossaryTerm {
  id: string;
  term: { en: string; zht: string; zhs: string };
  pinyin?: string;
  definition: { en: string; zht: string; zhs: string };
  seeAlso?: string[];
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: 'acting',
    term: { en: 'Acting', zht: '假', zhs: '假' },
    pinyin: 'jiǎ',
    definition: {
      en: 'A temporary or provisional appointment to an office or title.',
      zht: '臨時代理或暫攝的權宜任命。',
      zhs: '临时代理或暂摄的权宜任命。',
    },
    seeAlso: ['provisional-imperial-tally'],
  },
  {
    id: 'envoy-imperial-tally',
    term: { en: 'Envoy Bearing the Imperial Tally', zht: '使持節', zhs: '使持节' },
    pinyin: 'Shǐ Chíjié',
    definition: {
      en: 'The Tally is an imperial token of delegated authority, allowing its holder to act in the emperor\'s name. Envoys ranked highest amongst those who bore the Tally.',
      zht: '節是皇帝授予的權力憑證，持節者可代天子行事。持節使者中，以使持節為最高。',
      zhs: '节是皇帝授予的权力凭证，持节者可代天子行事。持节使者中，以使持节为最高。',
    },
    seeAlso: ['bearer-imperial-tally', "provisional-imperial-tally"],
  },
    {
    id: 'bearer-imperial-tally',
    term: { en: 'Bearer of the Imperial Tally', zht: '持節', zhs: '持节' },
    pinyin: 'Chíjié',
    definition: {
      en: 'The Tally is an imperial token of delegated authority, allowing its holder to act in the emperor\'s name. The Bearers ranked second to the Envoys amongst those who bore the Tally.',
      zht: '節是皇帝授予的權力憑證，持節者可代天子行事。持節使者中，以持節次使持節。',
      zhs: '节是皇帝授予的权力凭证，持节者可代天子行事。持节使者中，以持节次使持节。',
    },
    seeAlso: ['envoy-imperial-tally', 'provisional-imperial-tally'],
  },
    {
    id: 'provisional-imperial-tally',
    term: { en: 'Provisional Bearer of the Imperial Tally', zht: '假節', zhs: '假节' },
    pinyin: 'Jiǎjié',
    definition: {
      en: 'The Tally is an imperial token of delegated authority, allowing its holder to act in the emperor\'s name. The Provisional Bearers ranked lowest amongst those who bore the Tally.',
      zht: '節是皇帝授予的權力憑證，持節者可代天子行事。持節使者中，以假節位最低。',
      zhs: '节是皇帝授予的权力凭证，持节者可代天子行事。持节使者中，以假节位最低。',
    },
    seeAlso: ['envoy-imperial-tally', 'bearer-imperial-tally', 'acting'],
  },
  {
    id: 'grade',
    term: { en: 'Grade', zht: '品', zhs: '品' },
    pinyin: 'pǐn',
    definition: {
      en: 'A numbered rank in the official hierarchy, ranging from the 1st (highest) to the 9th (lowest).',
      zht: '官僚體系中的等級，一品為最高，九品為最低。',
      zhs: '官僚体系中的等级，一品为最高，九品为最低。',
    },
  },
  {
    id: 'yellow-yue',
    term: { en: 'Yellow Yue', zht: '黃鉞', zhs: '黄钺' },
    pinyin: 'Huángyuè',
    definition: {
      en: 'A ceremonial battle axe symbolising might and authority, allowing its bearer to execute on the emperor\'s behalf. The Yellow Yue ranks above the Tally Yue, and can execute even those bearing the Imperial Tally.',
      zht: '鉞為象徵皇帝權威的儀仗兵器，持鉞者得代天子行刑誅戮，黃鉞位最高，可戮節將。',
      zhs: '钺为象征皇帝权威的仪仗兵器，持鉞者得代天子行刑诛戮，黄钺位最高，可戮节将。',
    },
    seeAlso: ['tally-yue', 'envoy-imperial-tally', 'bearer-imperial-tally', 'provisional-imperial-tally'],
  },
    {
    id: 'tally-yue',
    term: { en: 'Tally Yue', zht: '節鉞', zhs: '节钺' },
    pinyin: 'Jiéyuè',
    definition: {
      en: 'A ceremonial battle axe symbolising might and authority, allowing its bearer to execute on the emperor\'s behalf. The Tally Yue ranks below the Yellow Yue.',
      zht: '鉞為象徵皇帝權威的儀仗兵器，持鉞者得代天子行刑誅戮，節鉞位次黃鉞。',
      zhs: '钺为象征皇帝权威的仪仗兵器，持鉞者得代天子行刑诛戮，节钺位次黄钺。',
    },
    seeAlso: ['yellow-yue', 'envoy-imperial-tally', 'bearer-imperial-tally', 'provisional-imperial-tally'],
  },
  {
    id: 'shi',
    term: { en: 'Shi', zht: '石', zhs: '石' },
    pinyin: 'shí',
    definition: {
      en: 'A unit of grain measurement used as a benchmark for official salaries. Roughly equivalent to 20 litres in volume, or about 10-20 kg of grain.',
      zht: '用作官員俸祿基準的穀物計量單位。約合20公升，或10-20公斤穀物。',
      zhs: '用作官员俸禄基准的谷物计量单位。约合20公升，或10-20公斤谷物。',
    },
    seeAlso: ['li', 'jin']
  },
  {
    id: 'open-office',
    term: { en: 'Open Office', zht: '開府', zhs: '开府' },
    pinyin: 'kāifǔ',
    definition: {
      en: 'The privilege of establishing a personal administrative office with its own staff and subordinate officials. Usually granted only to the highest-ranking officials, such as the Excellencies.',
      zht: '指有設立府署、自辟僚屬之權。通常僅授予位高权重者，如三公等。',
      zhs: '指有设立府署、自辟僚属之权。通常仅授予位高权重者，如三公等。',
    },
  },
  {
    id: 'general-marquis',
    term: { en: 'Marquis', zht: '列侯', zhs: '列侯' },
    pinyin: 'lièhóu',
    definition: {
      en: 'A rank of nobility, sometimes translated as Ranged Marquis. It was divided into three tiers: County, Township, and Neighbourhood, each with its own fief.',
      zht: '貴族爵位的一種，由高至低可分為縣侯、鄉侯、亭侯。皆有食邑。',
      zhs: '贵族爵位的一种，由高至低可分为县侯、乡侯、亭侯。皆有食邑。',
    },
    seeAlso: ['county-marquis', 'township-marquis', 'neighbourhood-marquis'],
  },
  {
    id: 'county-marquis',
    term: { en: 'County Marquis', zht: '縣侯', zhs: '县侯' },
    pinyin: 'xiànhóu',
    definition: {
      en: 'A rank of nobility. Only the County Marquis had their own marquisate chancellors.',
      zht: '貴族爵位的一種，惟縣侯有國相。',
      zhs: '贵族爵位的一种，惟县侯有国相。',
    },
    seeAlso: ['general-marquis', 'township-marquis', 'neighbourhood-marquis'],
  },
  {
    id: 'township-marquis',
    term: { en: 'Capital Township / Township Marquis', zht: '(都)鄉侯', zhs: '(都)乡侯' },
    pinyin: 'dū xiānghóu',
    definition: {
      en: 'A rank of nobility. Capital refers to townships/neighborhoods that were the local administrative seats.',
      zht: '貴族爵位的一種。「都」指食邑為治所所在之地。',
      zhs: '贵族爵位的一种。「都」指食邑为治所所在之地。',
    },
    seeAlso: ['general-marquis', 'county-marquis', 'neighbourhood-marquis']
  },
  {
    id: 'neighbourhood-marquis',
    term: { en: 'Capital Neighbourhood / Neighbourhood Marquis', zht: '(都)亭侯', zhs: '(都)亭侯' },
    pinyin: 'dū tínghóu',
    definition: {
      en: 'A rank of nobility. Capital refers to townships/neighborhoods that were the local administrative seats.',
      zht: '貴族爵位的一種。「都」指食邑為治所所在之地。',
      zhs: '贵族爵位的一种。「都」指食邑为治所所在之地。',
    },
    seeAlso: ['general-marquis', 'county-marquis', 'township-marquis']
  },
  {
    id: 'within-pass-marquis',
    term: { en: 'Marquis Within the Pass', zht: '關內侯', zhs: '关内侯' },
    pinyin: 'guānnèi hóu',
    definition: {
      en: 'A secondary marquis ranked below the Marquis (Ranged Marquis). "The Pass" refers to the Hangu Pass, and the title usually carried no fief.',
      zht: '關內侯位次列侯，其「關」指函谷關，通常無封國食邑。',
      zhs: '关内侯位次列侯，其「关」指函谷关，通常无封国食邑。',
    },
    seeAlso: ['general-marquis']
  },
  {
    id: 'li',
    term: { en: 'Li', zht: '里', zhs: '里' },
    pinyin: 'lǐ',
    definition: {
      en: 'A length unit used for measuring distance, roughly equivalent to 410-430 meters during the Han Dynasty.',
      zht: '長度單位，漢代一里約合410-430米。',
      zhs: '长度单位，汉代一里约合410-430米。',
    },
    seeAlso: ['jin', 'shi']
  },
  {
    id: 'jin',
    term: { en: 'Jin', zht: '斤', zhs: '斤' },
    pinyin: 'jīn',
    definition: {
      en: 'A weight unit used for measuring mass, roughly equivalent to 220-250 grams during the Han Dynasty.',
      zht: '重量單位，漢代一斤約合220-250克。',
      zhs: '重量单位，汉代一斤约合220-250克。',
    },
    seeAlso: ['li', 'shi']
  },
];