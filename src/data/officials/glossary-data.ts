// glossary-data.ts
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
    id: 'formally-appoint',
    term: { en: 'Formally Appoint', zht: '拜', zhs: '拜' },
    pinyin: 'bài',
    definition: {
      en: 'A formal appointment conferred by the court, usually to a high or important office, accompanied by solemn ceremony as a mark of esteem.',
      zht: '朝廷正式授予官職。通常為授予高官或要職，伴有隆重的禮儀，以表敬重。',
      zhs: '朝廷正式授予官职。通常为授予高官或要职，伴有隆重的礼仪，以表敬重。',
    },
    seeAlso: ['reassign', 'reinstate'],
  },
  {
    id: 'reassign',
    term: { en: 'Reassign', zht: '遷', zhs: '迁' },
    pinyin: 'qiān',
    definition: {
      en: 'To move from one office to another. A promotion was termed "moving right" (右遷), and a demotion "moving left" (左遷).',
      zht: '由一官調任另一官。通常升職稱「右遷」；降職則稱「左遷」。',
      zhs: '由一官调任另一官。通常升职称「右迁」；降职则称「左迁」。',
    },
    seeAlso: ['transfer', 'formally-appoint'],
  },
  {
    id: 'transfer',
    term: { en: 'Transfer', zht: '轉', zhs: '转' },
    pinyin: 'zhuǎn',
    definition: {
      en: 'To change to another office, usually a lateral move of similar rank.',
      zht: '改任另一官職，多為平調。',
      zhs: '改任另一官职，多为平调。',
    },
    seeAlso: ['reassign'],
  },
  {
    id: 'acting',
    term: { en: 'Acting', zht: '行', zhs: '行' },
    pinyin: 'xíng',
    definition: {
      en: 'To temporarily exercise the authority of an office, usually an official of lower substantive rank standing in for a higher post. The emphasis is on carrying out the office\'s duties, e.g. Acting General Who Conquers the South (行征南將軍).',
      zht: '暫時以某官職權行事。多以低級本官代理高官職務。注重職務、事務，如行征南將軍。',
      zhs: '暂时以某官职权行事。多以低级本官代理高官职务。注重职务、事务，如行征南将军。',
    },
    seeAlso: ['interim', 'concurrently-oversee', 'deputise', 'provisional'],
  },
  {
    id: 'concurrently-oversee',
    term: { en: 'Concurrently Oversee', zht: '領', zhs: '领' },
    pinyin: 'lǐng',
    definition: {
      en: 'To take charge of another office in addition to one\'s own, usually an official of higher substantive rank overseeing the duties of a lower post, e.g. Grand General, Overseeing Imperial Secretariat Affairs (大將軍領尚書事).',
      zht: '於本職之外兼掌另一職。多以高級本官代理低官職務，如大將軍領尚書事。',
      zhs: '于本职之外兼掌另一职。多以高级本官代理低官职务，如大将军领尚书事。',
    },
    seeAlso: ['acting', 'interim'],
  },
  {
    id: 'provisional',
    term: { en: 'Provisional', zht: '假', zhs: '假' },
    pinyin: 'jiǎ',
    definition: {
      en: 'Authority or office granted on a temporary basis, revoked once the matter at hand was concluded.',
      zht: '指代臨時授予的權力、官職。事情結束即撤銷。',
      zhs: '指代临时授予的权力、官职。事情结束即撤销。',
    },
    seeAlso: ['provisional-imperial-tally', 'acting', 'deputise'],
  },
  {
    id: 'interim',
    term: { en: 'Interim', zht: '守', zhs: '守' },
    pinyin: 'shǒu',
    definition: {
      en: 'Similar to Acting: an official of lower substantive rank temporarily occupying a higher post, but with the emphasis on the post itself rather than its duties. It can also denote a probationary appointment (試守).',
      zht: '與行相似，以低級本官代理高官，暫居其位，但更注重官位本身。也有試用之意，即「試守」。',
      zhs: '与行相似，以低级本官代理高官，暂居其位，但更注重官位本身。也有试用之意，即「试守」。',
    },
    seeAlso: ['acting', 'deputise'],
  },
  {
    id: 'deputise',
    term: { en: 'Deputise', zht: '署 / 攝', zhs: '署 / 摄' },
    pinyin: 'shǔ / shè',
    definition: {
      en: 'A temporary appointment to handle a specific matter or the duties of a particular office.',
      zht: '臨時任命，暫時代理某特定事務，或某官職務。',
      zhs: '临时任命，暂时代理某特定事务，或某官职务。',
    },
    seeAlso: ['acting', 'interim', 'provisional'],
  },
  {
    id: 'summon',
    term: { en: 'Summon', zht: '徵', zhs: '征' },
    pinyin: 'zhēng',
    definition: {
      en: 'To be summoned into service by the emperor or the central court. Sometimes also used to summon external officials to an office in the central court.',
      zht: '由皇帝或中央朝廷徵召入仕。也可用於徵召外臣入朝爲官。',
      zhs: '由皇帝或中央朝廷征召入仕。也可用于征召外臣入朝为官。',
    },
    seeAlso: ['recruit', 'filial-incorrupt', 'flourishing-talent'],
  },
  {
    id: 'recruit',
    term: { en: 'Recruit', zht: '辟', zhs: '辟' },
    pinyin: 'bì',
    definition: {
      en: 'To be recruited into service by a high-ranking official.',
      zht: '由高官招聘入職。',
      zhs: '由高官招聘入职。',
    },
    seeAlso: ['summon', 'filial-incorrupt', 'flourishing-talent'],
  },
  {
    id: 'reinstate',
    term: { en: 'Reinstate', zht: '起', zhs: '起' },
    pinyin: 'qǐ',
    definition: {
      en: 'To be appointed to office again after being out of office, dismissed, in mourning, or retired.',
      zht: '從無官、免官、服喪或退居狀態重新任官。',
      zhs: '从无官、免官、服丧或退居状态重新任官。',
    },
    seeAlso: ['formally-appoint'],
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
    seeAlso: ['envoy-imperial-tally', 'bearer-imperial-tally', 'provisional'],
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
    seeAlso: ['hu','li', 'jin', 'zhang', 'chi','cun']
  },
  {
    id: 'hu',
    term: { en: 'Hu', zht: '斛', zhs: '斛' },
    pinyin: 'hú',
    definition: {
      en: 'A unit of grain measurement used as a benchmark for official salaries. Roughly equivalent to 20 litres in volume, or about 10-20 kg of grain.',
      zht: '用作官員俸祿基準的穀物計量單位。約合20公升，或10-20公斤穀物。',
      zhs: '用作官员俸禄基准的谷物计量单位。约合20公升，或10-20公斤谷物。',
    },
    seeAlso: ['shi','li', 'jin', 'zhang', 'chi','cun']
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
      en: 'A secondary marquis ranked below the Marquis (Ranged Marquis). During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan, and the title usually carried no fief.',
      zht: '關內侯位次列侯，漢魏時此「關」指函谷關或潼關，通常無封國食邑。',
      zhs: '关内侯位次列侯，汉魏时此「关」指函谷关或潼关，通常无封国食邑。',
    },
    seeAlso: ['general-marquis', 'within-pass']
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
    seeAlso: ['jin', 'shi', 'hu','zhang', 'chi','shi']
  },
  {
    id: 'zhang',
    term: { en: 'Zhang', zht: '丈', zhs: '丈' },
    pinyin: 'zhàng',
    definition: {
      en: 'A length unit, roughly equivalent to 2.3-2.4 meters during the Han-Wei times. A zhang is equal to ten chi.',
      zht: '長度單位，十尺為一丈。漢魏一丈約合2.3-2.4米。',
      zhs: '长度单位，十尺为一丈。汉魏一丈约合2.3-2.4米。',
    },
    seeAlso: ['jin', 'shi', 'hu', 'li', 'chi','cun']
  },
  {
    id: 'chi',
    term: { en: 'Chi', zht: '尺', zhs: '尺' },
    pinyin: 'chǐ',
    definition: {
      en: 'A length unit, roughly equivalent to 23 -24cm during the Han-Wei times. A chi is equal to ten cun.',
      zht: '長度單位，十寸為一尺。漢魏一尺約合23-24厘米。',
      zhs: '长度单位，十寸为一尺。汉魏一尺约合23-24厘米。',
    },
    seeAlso: ['jin', 'shi','hu', 'li', 'zhang', 'cun']
  },
  {
    id: 'cun',
    term: { en: 'Cun', zht: '寸', zhs: '寸' },
    pinyin: 'cùn',
    definition: {
      en: 'A length unit, roughly equivalent to 2.3 -2.4cm during the Han-Wei times. ',
      zht: '長度單位。漢魏一寸約合2.3-2.4厘米。',
      zhs: '长度单位。汉魏一寸约合2.3-2.4厘米。',
    },
    seeAlso: ['jin', 'shi','hu',  'li', 'zhang', 'chi']
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
    seeAlso: ['li', 'shi', 'zhang' ,'chi']
  },
  {
    id: 'flourishing-talent',
    term: { en: 'Flourishing Talent', zht: '茂才', zhs: '茂才' },
    pinyin: 'màocái',
    definition: {
      en: "During the Later Han, the Flourishing Talent (Maocai) were generally recommended annually, with the recommendations made by provincial Inspectors or high-ranking officials. Per Emperor Guangwu of Later Han, the Radiant Martial Emperor, candidates were assessed according to four categories: first, possessing lofty virtue and pure principles; second, being well versed in the Classics and of cultivated conduct; third, having a clear understanding of the law and being capable of resolving difficult cases; and fourth, being resolute and resourceful, and composed and decisive when difficulties arise." ,
      zht: '東漢茂才多為歲舉，舉主為州刺史及中央高官。按光武帝茂才四行：一曰德行高妙，志節清白；二曰明經行修，能任博士；三曰明曉法律，足以決疑；四曰剛毅多略，遇事不惑。',
      zhs: '东汉茂才多为岁举，举主为州刺史及中央高官。按光武帝茂才四行：一曰德行高妙，志节清白；二曰明经行修，能任博士；三曰明晓法律，足以决疑；四曰刚毅多略，遇事不惑。',
    },
    seeAlso: ['filial-incorrupt'],
  },
  {
    id: 'filial-incorrupt',
    term: { en: 'Filial and Incorrupt', zht: '孝廉', zhs: '孝廉' },
    pinyin: 'xiàolián',
    definition: {
      en: "During the Later Han, the Filial and Incorrupt (Xiaolian) were generally recommended annually, with the recommendations made by respective commmanderies or states. The number of recommendations was allocated according to local population. Those recommended were usually recruited to the central government to serve as Gentlemen or as subordinate clerks to high-ranking officials.",
      zht: '東漢孝廉多為歲舉，舉主為郡國舉薦，名額按人口比例分配。被舉者通常會被招入中央擔任郎官或高官屬吏。',
      zhs: '东汉孝廉多为岁举，举主为郡国举荐，名额按人口比例分配。被举者通常会被招入中央担任郎官或高官属吏。',
    },
    seeAlso: ['flourishing-talent'],
  },
  {
    id: 'within-pass',
    term: { en: 'Within the Pass', zht: '關內', zhs: '关内' },
    pinyin: 'guānnèi',
    definition: {
      en: 'During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan. "Within the Pass" is generally synonymous with "Inside the Pass" and "West of the Pass", commonly referring to the Wei River plains near Chang\'an.',
      zht: '漢魏時此「關」指函谷關或潼關，關內約等同於關西、關中，即「關」之西側，通常指代長安近畿的渭河平原。',
      zhs: '汉魏时此「关」指函谷关或潼关，关內约等同于关西、关中，即「关」之西侧，通常指代长安近畿的渭河平原。',
    },
    seeAlso: ['within-pass-marquis','inside-pass','west-pass','east-pass','outside-pass','east-mountain','three-capitals']
  },
  {
    id: 'west-pass',
    term: { en: 'West of the Pass / Guanxi', zht: '關西', zhs: '关西' },
    pinyin: 'guānxī',
    definition: {
      en: 'During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan. "West of the Pass" is generally synonymous with "Inside the Pass" and "Within the Pass", referring specifically to the region near Chang\'an (Yong Province), but can also refer to a broader area encompassing Liang Province. Sometimes also referred to as Right of the Pass / Guanyou.',
      zht: '漢魏時此「關」指函谷關或潼關，關西約等同於關中、關内，即「關」之西側，狹義包含長安近畿，廣義則包括涼州。有時也稱關右。',
      zhs: '汉魏时此「关」指函谷关或潼关，关西约等同于关中、关内，即「关」之西侧，狭义包含长安近畿，广义则包括凉州。有時也称关右。',
    },
    seeAlso: ['within-pass','inside-pass','outside-pass','east-pass','east-mountain','three-capitals']
  },
  {
    id: 'inside-pass',
    term: { en: 'Inside the Pass / Guanzhong', zht: '關中', zhs: '关中' },
    pinyin: 'guānzhōng',
    definition: {
      en: 'During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan. "Inside the Pass" is generally synonymous with "Within the Pass" and "West of the Pass", commonly referring to the Wei River plains near Chang\'an.',
      zht: '漢魏時此「關」指函谷關或潼關，關中約等同於關西、關内，即「關」之西側，通常指代長安近畿的渭河平原。',
      zhs: '汉魏时此「关」指函谷关或潼关，关中约等同于关西、关内，即「关」之西侧，通常指代长安近畿的渭河平原。',
    },
    seeAlso: ['within-pass','west-pass','east-pass','outside-pass','east-mountain','three-capitals']
  },
  {
    id: 'outside-pass',
    term: { en: 'Beyond the Pass', zht: '關外', zhs: '关外' },
    pinyin: 'guānwài',
    definition: {
      en: 'During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan. "Beyond the Pass" is generally synonymous with "East of the Pass", referring to the flat lands of the Central Plains along the middle and lower reaches of the Yellow River.',
      zht: '漢魏時此「關」指函谷關或潼關，關外約等同於關東，即「關」之東側，指代黃河中下游的中原等地。',
      zhs: '汉魏时此「关」指函谷关或潼关，关外约等同于关东，即「关」之东侧，指代黃河中下游的中原等地。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass','east-pass']
  },
  {
    id: 'east-pass',
    term: { en: 'East of the Pass / Guandong', zht: '關東', zhs: '关东' },
    pinyin: 'guāndōng',
    definition: {
      en: 'During the Han-Wei times, "The Pass" refers to the Hanguguan or the Tongguan. "East of the Pass" is generally synonymous with "Beyond the Pass", referring to the flat lands of the Central Plains along the middle and lower reaches of the Yellow River.',
      zht: '漢魏時此「關」指函谷關或潼關，關東約等同於關外，即「關」之東側，指代黃河中下游的中原等地。',
      zhs: '汉魏时此「关」指函谷关或潼关，关东约等同于关外，即「关」之东侧，指代黃河中下游的中原等地。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass','outside-pass','east-mountain']
  },
  {
    id: 'east-mountain',
    term: { en: 'East of the Mountain / Shandong', zht: '山東', zhs: '山东' },
    pinyin: 'shāndōng',
    definition: {
      en: 'During the Han-Wei times, "The Mountain" refers to Mount Yao where the Hanguguan was located. "East of the Mountain" is generally synonymous with "Beyond the Pass", referring to the flat lands of the Central Plains along the middle and lower reaches of the Yellow River.',
      zht: '漢魏時此「山」指函谷關所在的崤山，山東約等同於關東，指代黃河中下游的中原等地。',
      zhs: '汉魏时此「山」指函谷关所在的崤山，山东约等同于关东，指代黃河中下游的中原等地。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass','outside-pass','east-pass']
  },
  {
    id: 'three-capitals',
    term: { en: 'Three Capital Regions', zht: '三輔', zhs: '三辅' },
    pinyin: 'sān fǔ',
    definition: {
      en: 'The Three Capital Regions refer to the three administrative units surrounding the capital city of Chang\'an during the Han Dynasty, namely Jingzhao, Zuopingyi (Left/East Pingyi), and Youfufeng (Right/West Fufeng). Later, the term came to refer to the area around Chang\'an.',
      zht: '三輔為漢代負責治理京畿長安附近的三個長官的合稱，即京兆尹、左馮翊、右扶風。後演變為指代長安一帶。',
      zhs: '三辅为汉代负责治理京畿长安附近的三个长官的合称，即京兆尹、左冯翊、右扶风。后演变为指代长安一带。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass']
  },
  {
    id: 'west-river',
    term: { en: 'West of the River / Hexi / Heyou', zht: '河西 / 河右', zhs: '河西 / 河右' },
    pinyin: 'héxī / héyòu',
    definition: {
      en: 'The West of the River, or Hexi / Heyou, originally referred to the region west of the north-south stretch of the Yellow River between Yong and Bing provinces. More broadly, however, it could also denote what is now known as the Hexi Corridor: the vast northwestern region extending across Yong and Liang provinces as far as Yumenguan / Yumen Pass.',
      zht: '河西/河右原指雍州、并州一帶南北走向的黃河以西地區，廣義上也泛指河西走廊，即雍涼至玉門關的西北一帶。',
      zhs: '河西/河右原指雍州、并州一带南北走向的黄河以西地区，广义上也泛指河西走廊，即雍凉至玉门关的西北一带。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass','outside-pass','east-pass']
  },
  {
    id: 'west-long',
    term: { en: 'West of the Long Mountains / Longxi / Longyou', zht: '隴西 / 隴右', zhs: '陇西 / 陇右' },
    pinyin: 'lǒngxī / lǒngyòu',
    definition: {
      en: 'The West of the Long Mountains, or Longxi/Longyou, refers to the region west of the Long Mountains and east of the Yellow River. During the Three Kingdoms period, it corresponded roughly to the commanderies of Longxi, Nan\'an, Tianshui, and Guangwei, and at times also included Anding.',
      zht: '隴西/隴右指的是隴山以西，黃河以東的區域。大體為此時的隴西、南安、天水、廣魏四郡，有時也包含安定。',
      zhs: '陇西/陇右指的是陇山以西，黄河以东的区域。大体为此时的陇西、南安、天水、广魏四郡，有时也包含安定。',
    },
    seeAlso: ['inside-pass','within-pass','west-pass','outside-pass','east-pass']
  },
];