// Country code to flag colors mapping
// Returns an array of colors representing the country's flag for gradient use

interface FlagColors {
  colors: string[];
  direction?: string; // CSS gradient direction, defaults to '90deg'
}

// Map country names to their ISO codes
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // Nordic
  'finland': 'FI', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'iceland': 'IS',
  // Western Europe
  'germany': 'DE', 'france': 'FR', 'netherlands': 'NL', 'belgium': 'BE', 'austria': 'AT', 'switzerland': 'CH', 'luxembourg': 'LU',
  // UK & Ireland
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'ireland': 'IE',
  // Southern Europe
  'spain': 'ES', 'portugal': 'PT', 'italy': 'IT', 'greece': 'GR', 'malta': 'MT', 'cyprus': 'CY', 'croatia': 'HR', 'slovenia': 'SI', 'serbia': 'RS', 'montenegro': 'ME', 'north macedonia': 'MK', 'macedonia': 'MK', 'macedonia, the former yugoslav republic of': 'MK', 'albania': 'AL', 'bosnia': 'BA', 'bosnia and herzegovina': 'BA', 'kosovo': 'XK',
  // Eastern Europe
  'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ', 'slovakia': 'SK', 'ukraine': 'UA', 'russia': 'RU', 'russian federation': 'RU', 'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG', 'moldova': 'MD', 'belarus': 'BY',
  // Baltic states
  'estonia': 'EE', 'latvia': 'LV', 'lithuania': 'LT',
  // Americas
  'united states': 'US', 'usa': 'US', 'america': 'US', 'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO', 'peru': 'PE', 'venezuela': 'VE', 'ecuador': 'EC', 'cuba': 'CU', 'puerto rico': 'PR', 'jamaica': 'JM',
  // Asia
  'japan': 'JP', 'china': 'CN', 'south korea': 'KR', 'korea': 'KR', 'north korea': 'KP', 'india': 'IN', 'philippines': 'PH', 'vietnam': 'VN', 'thailand': 'TH', 'indonesia': 'ID', 'malaysia': 'MY', 'singapore': 'SG', 'taiwan': 'TW', 'hong kong': 'HK', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'nepal': 'NP', 'myanmar': 'MM', 'cambodia': 'KH', 'laos': 'LA',
  // Oceania
  'australia': 'AU', 'new zealand': 'NZ', 'fiji': 'FJ', 'papua new guinea': 'PG',
  // Middle East
  'israel': 'IL', 'united arab emirates': 'AE', 'uae': 'AE', 'saudi arabia': 'SA', 'turkey': 'TR', 'iran': 'IR', 'iraq': 'IQ', 'jordan': 'JO', 'lebanon': 'LB', 'syria': 'SY', 'kuwait': 'KW', 'qatar': 'QA', 'bahrain': 'BH', 'oman': 'OM', 'yemen': 'YE',
  // Africa
  'south africa': 'ZA', 'egypt': 'EG', 'nigeria': 'NG', 'kenya': 'KE', 'ghana': 'GH', 'morocco': 'MA', 'tunisia': 'TN', 'algeria': 'DZ', 'ethiopia': 'ET', 'tanzania': 'TZ', 'uganda': 'UG', 'zimbabwe': 'ZW', 'cameroon': 'CM', 'senegal': 'SN', 'ivory coast': 'CI', "cote d'ivoire": 'CI',
};

const FLAG_COLORS: Record<string, FlagColors> = {
  // Nordic countries
  FI: { colors: ['#003580', '#FFFFFF'], direction: '135deg' }, // Finland - blue and white
  SE: { colors: ['#006AA7', '#FECC00'], direction: '135deg' }, // Sweden - blue and yellow
  NO: { colors: ['#BA0C2F', '#FFFFFF', '#00205B'], direction: '90deg' }, // Norway
  DK: { colors: ['#C8102E', '#FFFFFF'], direction: '135deg' }, // Denmark
  IS: { colors: ['#003897', '#FFFFFF', '#D72828'], direction: '90deg' }, // Iceland

  // Western Europe
  DE: { colors: ['#000000', '#DD0000', '#FFCC00'], direction: '180deg' }, // Germany
  FR: { colors: ['#002654', '#FFFFFF', '#ED2939'], direction: '90deg' }, // France
  NL: { colors: ['#AE1C28', '#FFFFFF', '#21468B'], direction: '180deg' }, // Netherlands
  BE: { colors: ['#000000', '#FAE042', '#ED2939'], direction: '90deg' }, // Belgium
  AT: { colors: ['#ED2939', '#FFFFFF', '#ED2939'], direction: '180deg' }, // Austria
  CH: { colors: ['#FF0000', '#FFFFFF'], direction: '135deg' }, // Switzerland

  // UK & Ireland
  GB: { colors: ['#012169', '#FFFFFF', '#C8102E'], direction: '135deg' }, // UK
  IE: { colors: ['#169B62', '#FFFFFF', '#FF883E'], direction: '90deg' }, // Ireland

  // Southern Europe
  ES: { colors: ['#AA151B', '#F1BF00', '#AA151B'], direction: '180deg' }, // Spain
  PT: { colors: ['#006600', '#FF0000'], direction: '90deg' }, // Portugal
  IT: { colors: ['#009246', '#FFFFFF', '#CE2B37'], direction: '90deg' }, // Italy
  GR: { colors: ['#0D5EAF', '#FFFFFF'], direction: '180deg' }, // Greece

  // Eastern Europe
  PL: { colors: ['#FFFFFF', '#DC143C'], direction: '180deg' }, // Poland
  CZ: { colors: ['#FFFFFF', '#D7141A', '#11457E'], direction: '135deg' }, // Czech Republic
  UA: { colors: ['#005BBB', '#FFD500'], direction: '180deg' }, // Ukraine
  RU: { colors: ['#D52B1E', '#0039A6', '#FFFFFF'], direction: '180deg' }, // Russia - reversed for visibility on white cards
  HU: { colors: ['#CD2A3E', '#FFFFFF', '#436F4D'], direction: '180deg' }, // Hungary
  RO: { colors: ['#002B7F', '#FCD116', '#CE1126'], direction: '90deg' }, // Romania

  // Baltic states
  EE: { colors: ['#0072CE', '#000000', '#FFFFFF'], direction: '180deg' }, // Estonia
  LV: { colors: ['#9E3039', '#FFFFFF', '#9E3039'], direction: '180deg' }, // Latvia
  LT: { colors: ['#FDB913', '#006A44', '#C1272D'], direction: '180deg' }, // Lithuania

  // Americas
  US: { colors: ['#B22234', '#FFFFFF', '#3C3B6E'], direction: '135deg' }, // USA
  CA: { colors: ['#FF0000', '#FFFFFF', '#FF0000'], direction: '90deg' }, // Canada
  MX: { colors: ['#006341', '#FFFFFF', '#CE1126'], direction: '90deg' }, // Mexico
  BR: { colors: ['#009739', '#FEDD00', '#002776'], direction: '135deg' }, // Brazil
  AR: { colors: ['#74ACDF', '#FFFFFF', '#74ACDF'], direction: '180deg' }, // Argentina

  // Asia
  JP: { colors: ['#FFFFFF', '#BC002D'], direction: '135deg' }, // Japan
  CN: { colors: ['#DE2910', '#FFDE00'], direction: '135deg' }, // China
  KR: { colors: ['#FFFFFF', '#CD2E3A', '#0047A0'], direction: '135deg' }, // South Korea
  IN: { colors: ['#FF9933', '#FFFFFF', '#138808'], direction: '180deg' }, // India
  PH: { colors: ['#0038A8', '#CE1126', '#FCD116'], direction: '135deg' }, // Philippines
  VN: { colors: ['#DA251D', '#FFCD00'], direction: '135deg' }, // Vietnam
  TH: { colors: ['#A51931', '#FFFFFF', '#2D2A4A'], direction: '180deg' }, // Thailand

  // Oceania
  AU: { colors: ['#00008B', '#FFFFFF', '#FF0000'], direction: '135deg' }, // Australia
  NZ: { colors: ['#00247D', '#FFFFFF', '#CC142B'], direction: '135deg' }, // New Zealand

  // Middle East & Africa
  ZA: { colors: ['#007A4D', '#FFB612', '#DE3831', '#002395'], direction: '135deg' }, // South Africa
  EG: { colors: ['#CE1126', '#FFFFFF', '#000000'], direction: '180deg' }, // Egypt
  IL: { colors: ['#FFFFFF', '#0038B8'], direction: '180deg' }, // Israel
  AE: { colors: ['#00732F', '#FFFFFF', '#000000', '#FF0000'], direction: '90deg' }, // UAE
  SA: { colors: ['#006C35', '#FFFFFF'], direction: '135deg' }, // Saudi Arabia
  TR: { colors: ['#E30A17', '#FFFFFF'], direction: '135deg' }, // Turkey

  // Additional Western Europe
  LU: { colors: ['#ED2939', '#FFFFFF', '#00A1DE'], direction: '180deg' }, // Luxembourg

  // Additional Southern/Balkan Europe
  MT: { colors: ['#FFFFFF', '#CF142B'], direction: '90deg' }, // Malta
  CY: { colors: ['#FFFFFF', '#D57800'], direction: '135deg' }, // Cyprus
  HR: { colors: ['#FF0000', '#FFFFFF', '#171796'], direction: '180deg' }, // Croatia
  SI: { colors: ['#FFFFFF', '#005CE6', '#FF0000'], direction: '180deg' }, // Slovenia
  RS: { colors: ['#C6363C', '#0C4076', '#FFFFFF'], direction: '180deg' }, // Serbia
  ME: { colors: ['#C40308', '#D4AF37'], direction: '135deg' }, // Montenegro
  MK: { colors: ['#D20000', '#FFE600'], direction: '135deg' }, // North Macedonia
  AL: { colors: ['#E41E20', '#000000'], direction: '135deg' }, // Albania
  BA: { colors: ['#002395', '#FECB00'], direction: '135deg' }, // Bosnia
  XK: { colors: ['#244AA5', '#D0A650'], direction: '135deg' }, // Kosovo

  // Additional Eastern Europe
  SK: { colors: ['#FFFFFF', '#0B4EA2', '#EE1C25'], direction: '180deg' }, // Slovakia
  BG: { colors: ['#FFFFFF', '#00966E', '#D62612'], direction: '180deg' }, // Bulgaria
  MD: { colors: ['#003DA5', '#FFD200', '#CC092F'], direction: '90deg' }, // Moldova
  BY: { colors: ['#C8313E', '#4AA657'], direction: '180deg' }, // Belarus

  // Additional Americas
  CL: { colors: ['#FFFFFF', '#0039A6', '#D52B1E'], direction: '180deg' }, // Chile
  CO: { colors: ['#FCD116', '#003893', '#CE1126'], direction: '180deg' }, // Colombia
  PE: { colors: ['#D91023', '#FFFFFF', '#D91023'], direction: '90deg' }, // Peru
  VE: { colors: ['#FFCC00', '#00247D', '#CF142B'], direction: '180deg' }, // Venezuela
  EC: { colors: ['#FFD100', '#0033A0', '#EF3340'], direction: '180deg' }, // Ecuador
  CU: { colors: ['#002A8F', '#FFFFFF', '#CF142B'], direction: '180deg' }, // Cuba
  PR: { colors: ['#ED0000', '#FFFFFF', '#0050F0'], direction: '180deg' }, // Puerto Rico
  JM: { colors: ['#009B3A', '#FED100', '#000000'], direction: '135deg' }, // Jamaica

  // Additional Asia
  KP: { colors: ['#024FA2', '#FFFFFF', '#ED1C27'], direction: '180deg' }, // North Korea
  ID: { colors: ['#FF0000', '#FFFFFF'], direction: '180deg' }, // Indonesia
  MY: { colors: ['#CC0001', '#FFFFFF', '#010066'], direction: '180deg' }, // Malaysia
  SG: { colors: ['#ED2939', '#FFFFFF'], direction: '180deg' }, // Singapore
  TW: { colors: ['#FE0000', '#000095', '#FFFFFF'], direction: '135deg' }, // Taiwan
  HK: { colors: ['#DE2910', '#FFFFFF'], direction: '135deg' }, // Hong Kong
  PK: { colors: ['#01411C', '#FFFFFF'], direction: '90deg' }, // Pakistan
  BD: { colors: ['#006A4E', '#F42A41'], direction: '135deg' }, // Bangladesh
  LK: { colors: ['#8D153A', '#EB7400', '#FFBE29'], direction: '90deg' }, // Sri Lanka
  NP: { colors: ['#DC143C', '#003893'], direction: '135deg' }, // Nepal
  MM: { colors: ['#FECB00', '#34B233', '#EA2839'], direction: '180deg' }, // Myanmar
  KH: { colors: ['#032EA1', '#E00025', '#FFFFFF'], direction: '180deg' }, // Cambodia
  LA: { colors: ['#CE1126', '#002868', '#FFFFFF'], direction: '180deg' }, // Laos

  // Additional Oceania
  FJ: { colors: ['#68BFE5', '#FFFFFF', '#D21034'], direction: '135deg' }, // Fiji
  PG: { colors: ['#CE1126', '#000000', '#FCD116'], direction: '135deg' }, // Papua New Guinea

  // Additional Middle East
  IR: { colors: ['#239F40', '#FFFFFF', '#DA0000'], direction: '180deg' }, // Iran
  IQ: { colors: ['#CE1126', '#FFFFFF', '#000000'], direction: '180deg' }, // Iraq
  JO: { colors: ['#000000', '#FFFFFF', '#007A3D', '#CE1126'], direction: '180deg' }, // Jordan
  LB: { colors: ['#ED1C24', '#FFFFFF', '#00A651'], direction: '180deg' }, // Lebanon
  SY: { colors: ['#CE1126', '#FFFFFF', '#000000'], direction: '180deg' }, // Syria
  KW: { colors: ['#007A3D', '#FFFFFF', '#CE1126', '#000000'], direction: '180deg' }, // Kuwait
  QA: { colors: ['#FFFFFF', '#8D1B3D'], direction: '90deg' }, // Qatar
  BH: { colors: ['#FFFFFF', '#CE1126'], direction: '90deg' }, // Bahrain
  OM: { colors: ['#FFFFFF', '#DB161B', '#008000'], direction: '90deg' }, // Oman
  YE: { colors: ['#CE1126', '#FFFFFF', '#000000'], direction: '180deg' }, // Yemen

  // Additional Africa
  NG: { colors: ['#008751', '#FFFFFF', '#008751'], direction: '90deg' }, // Nigeria
  KE: { colors: ['#000000', '#BB0000', '#006600'], direction: '180deg' }, // Kenya
  GH: { colors: ['#EF2929', '#FFD600', '#006B3F'], direction: '180deg' }, // Ghana
  MA: { colors: ['#C1272D', '#006233'], direction: '135deg' }, // Morocco
  TN: { colors: ['#E70013', '#FFFFFF'], direction: '135deg' }, // Tunisia
  DZ: { colors: ['#006233', '#FFFFFF', '#D21034'], direction: '90deg' }, // Algeria
  ET: { colors: ['#078930', '#FCDD09', '#DA121A'], direction: '180deg' }, // Ethiopia
  TZ: { colors: ['#1EB53A', '#FCD116', '#00A3DD', '#000000'], direction: '135deg' }, // Tanzania
  UG: { colors: ['#000000', '#FCDC04', '#D90000'], direction: '180deg' }, // Uganda
  ZW: { colors: ['#006400', '#FFD200', '#EF3340', '#000000'], direction: '180deg' }, // Zimbabwe
  CM: { colors: ['#007A5E', '#CE1126', '#FCD116'], direction: '90deg' }, // Cameroon
  SN: { colors: ['#00853F', '#FDEF42', '#E31B23'], direction: '90deg' }, // Senegal
  CI: { colors: ['#F77F00', '#FFFFFF', '#009E60'], direction: '90deg' }, // Ivory Coast
};

export function getFlagGradient(countryCode: string | { _id?: string; name?: string } | null | undefined): string | null {
  if (!countryCode) return null;

  // Handle object format from Hailer (e.g., { _id: "...", name: "FI" } or { name: "Finland" })
  const rawValue = typeof countryCode === 'object' ? countryCode.name : countryCode;
  if (!rawValue || typeof rawValue !== 'string') return null;

  // Try as country code first (e.g., "FI"), then as country name (e.g., "Finland")
  const upperValue = rawValue.toUpperCase();
  const lowerValue = rawValue.toLowerCase();
  const code = FLAG_COLORS[upperValue] ? upperValue : (COUNTRY_NAME_TO_CODE[lowerValue] || upperValue);

  const flag = FLAG_COLORS[code];

  if (!flag) return null;

  const { colors, direction = '90deg' } = flag;

  if (colors.length === 2) {
    return `linear-gradient(${direction}, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`;
  }

  if (colors.length === 3) {
    return `linear-gradient(${direction}, ${colors[0]} 0%, ${colors[0]} 33%, ${colors[1]} 33%, ${colors[1]} 66%, ${colors[2]} 66%, ${colors[2]} 100%)`;
  }

  if (colors.length === 4) {
    return `linear-gradient(${direction}, ${colors[0]} 0%, ${colors[0]} 25%, ${colors[1]} 25%, ${colors[1]} 50%, ${colors[2]} 50%, ${colors[2]} 75%, ${colors[3]} 75%, ${colors[3]} 100%)`;
  }

  return null;
}
