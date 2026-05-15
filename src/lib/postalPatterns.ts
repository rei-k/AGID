/**
 * Global Postal Code Patterns Database
 * Provides formats and regex for major countries to guide experimental creation.
 */

export interface PostalPattern {
  country: string;
  format: string;
  regex: RegExp;
  example: string;
  description: string;
  history?: string;
}

export const POSTAL_PATTERNS: Record<string, PostalPattern> = {
  // Existing major patterns...
  'JP': {
    country: 'Japan',
    format: 'NNN-NNNN',
    regex: /^\d{3}-\d{4}$/,
    example: '100-0001',
    description: '3-digit area code followed by a hyphen and 4-digit street code.',
    history: 'Introduced in 1968 to automate sorting as urbanization accelerated. The 7-digit expansion occurred in 1998 to allow for block-level precision.'
  },
  'US': {
    country: 'United States',
    format: 'NNNNN(-NNNN)',
    regex: /^\d{5}(-\d{4})?$/,
    example: '90210',
    description: '5-digit ZIP code, optionally followed by a hyphen and 4 extra digits.',
    history: 'ZIP (Zone Improvement Plan) was launched in 1963 during the post-WWII mail boom to streamline cross-country routing using 5 numbers.'
  },
  'UK': {
    country: 'United Kingdom',
    format: 'AA(A) N(N)NAA',
    regex: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
    example: 'SW1A 1AA',
    description: 'Alphanumeric outward and inward codes indicating district and delivery point.',
    history: 'Evolved from 19th-century London postal districts. The modern outward-inward code was rolled out between 1959-1974 for mechanization.'
  },
  'FR': {
    country: 'France',
    format: 'NNNNN',
    regex: /^\d{5}$/,
    example: '75001',
    description: '5-digit code where the first two digits indicate the department.',
    history: 'Implemented in 1964. The structure ties directly to the Napoleonic department system, making it both a postal and an administrative identifier.'
  },
  'CA': {
    country: 'Canada',
    format: 'ANA NAN',
    regex: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/,
    example: 'K1A 0B1',
    description: 'Alphanumeric Forward Sortation Area (FSA) and Local Delivery Unit (LDU).',
    history: 'Phased in between 1971-1974. The alphanumeric nature was chosen to provide vast capacity for a geographically massive yet sparsely populated country.'
  },
  'AU': {
    country: 'Australia',
    format: 'NNNN',
    regex: /^\d{4}$/,
    example: '2000',
    description: '4-digit code where the first digit usually indicates the State or Territory.',
    history: 'Introduced in 1967. Australia Post moved to a numeric system to facilitate mechanized sorting across various vast states.'
  },
  'NZ': {
    country: 'New Zealand',
    format: 'NNNN',
    regex: /^\d{4}$/,
    example: '6011',
    description: '4-digit code identifying specific urban delivery rounds or post boxes.',
    history: 'A comprehensive 4-digit system was implemented in 2006, replacing old district-based numbering to improve automated sorting accuracy.'
  },
  'IE': {
    country: 'Ireland',
    format: 'A65 AAAA',
    regex: /^[A-Z][0-9][0-9W] [A-Z0-9]{4}$/,
    example: 'D02 X285',
    description: 'Eircode: A 7-character alphanumeric code unique to every individual address.',
    history: 'Launched in 2015 as the worlds first nationwide alphanumeric postal code system that identifies individual premises unique identities.'
  },
  'IN': {
    country: 'India',
    format: 'NNNNNN',
    regex: /^\d{6}$/,
    example: '110001',
    description: 'PIN (Postal Index Number) where the first digit indicates the region.',
    history: 'Introduced in 1972 by Shriram Bhikaji Velankar to simplify routing across the linguistically diverse and vast Indian subcontinent.'
  },
  'ZA': {
    country: 'South Africa',
    format: 'NNNN',
    regex: /^\d{4}$/,
    example: '0001',
    description: '4-digit code where the first two digits indicate the mailing region.',
    history: 'Rolled out in 1973 as part of a massive postal infrastructure program to modernize the sorting process in the post-independence era.'
  },
  'SG': {
    country: 'Singapore',
    format: 'NNNNNN',
    regex: /^\d{6}$/,
    example: '048582',
    description: '6-digit code unique to every building in Singapore.',
    history: 'Expanded from 4-digit codes in 1995 to provide 6 decimals, ensuring every single residential and commercial building gets a unique ID.'
  },
  'PH': {
    country: 'Philippines',
    format: 'NNNN',
    regex: /^\d{4}$/,
    example: '1000',
    description: '4-digit ZIP code primarily used for post offices and larger municipalities.',
    history: 'Adopted a system similar to the US ZIP codes but simplified to 4 digits to match the scale of Philippine postal regions.'
  },
  'NG': {
    country: 'Nigeria',
    format: 'NNNNNN',
    regex: /^\d{6}$/,
    example: '100001',
    description: '6-digit POSTCODE where the first digit represents the regional hub.',
    history: 'NIPOST established the 6-digit Nigerian Postal Code in the late 20th century to improve mail circulation efficiency.'
  },
  'GH': {
    country: 'Ghana',
    format: 'AA-NNN-NNNN',
    regex: /^[A-Z]{2}-\d{3}-\d{4}$/,
    example: 'GA-107-1111',
    description: 'Ghana Post GPS digital addressing system unique to every 10x10 meter plot.',
    history: 'Launched in 2017, this system provides every location in Ghana with a unique digital address using the Ghana Post GPS app.'
  },
  'KE': {
    country: 'Kenya',
    format: 'NNNNN',
    regex: /^\d{5}$/,
    example: '00100',
    description: '5-digit postal code where the first two digits indicate the regional sorting hub.',
    history: 'Modernized in 1993 to streamline the delivery processes across the East African nations growing urban centers.'
  },
  'PK': {
    country: 'Pakistan',
    format: 'NNNNN',
    regex: /^\d{5}$/,
    example: '44000',
    description: '5-digit code identifying specific post offices and delivery areas.',
    history: 'The current 5-digit indexing was established in 1988 to transition from purely name-based sorting to numerical hubs.'
  },
  'BD': {
    country: 'Bangladesh',
    format: 'NNNN',
    regex: /^\d{4}$/,
    example: '1000',
    description: '4-digit code identifying larger districts and specific post offices.',
    history: 'Expanded from old colonial systems to a modern 4-digit national index as the nation built its postal independent network.'
  },
  'LK': {
    country: 'Sri Lanka',
    format: 'NNNNN',
    regex: /^\d{5}$/,
    example: '00100',
    description: '5-digit code identifying specific delivery areas and post offices.',
    history: 'Established in the mid-20th century to provide a precise mapping of the islands diverse geographic regions.'
  },
  // ... adding a base generic for experimental use in no-zip countries
  'GENERIC_numeric': {
    country: 'Custom Numeric',
    format: 'NNNNN',
    regex: /^\d{5}$/,
    example: '12345',
    description: 'Simple 5-digit experimental format.'
  },
  'GENERIC_alpha': {
    country: 'Custom Alpha',
    format: 'AAAAA',
    regex: /^[A-Z]{5}$/,
    example: 'ABCDE',
    description: 'Simple 5-letter experimental format.'
  }
};

export interface CountryContext {
  code: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  history?: string;
}

/**
 * Countries without official postal codes.
 */
export const NO_POSTAL_COUNTRIES: CountryContext[] = [
  // アジア・中東
  { 
    code: 'HK', 
    name: 'Hong Kong', 
    region: 'Asia', 
    lat: 22.3193, 
    lng: 114.1694,
    history: 'Direct street addressing is highly efficient due to density; traditionally used P.O. boxes for mail volume.'
  },
  { 
    code: 'MO', 
    name: 'Macau', 
    region: 'Asia', 
    lat: 22.1987, 
    lng: 113.5439,
    history: 'Small geographic area traditionally managed via localized district names without numerical codes.'
  },
  { 
    code: 'AE', 
    name: 'United Arab Emirates', 
    region: 'Middle East', 
    lat: 23.4241, 
    lng: 53.8478,
    history: 'Relied on P.O. Box systems for decades; recently introduced building-specific addressing but no unified national postal code.'
  },
  { 
    code: 'QA', 
    name: 'Qatar', 
    region: 'Middle East', 
    lat: 25.3548, 
    lng: 51.1839,
    history: 'Utilizes a unique building-zone-street (MyAddress) system rather than a traditional unified postal code.'
  },
  { 
    code: 'YE', 
    name: 'Yemen', 
    region: 'Middle East', 
    lat: 15.5527, 
    lng: 48.5164,
    history: 'Infrastructure challenges and political transitions hindered the deployment of a modern postal indexing system.'
  },
  { 
    code: 'AF', 
    name: 'Afghanistan', 
    region: 'Middle East', 
    lat: 33.9391, 
    lng: 67.7100,
    history: 'Developing infrastructure; mail is traditionally distributed to local post offices rather than specific buildings.'
  },
  { 
    code: 'TL', 
    name: 'Timor-Leste', 
    region: 'Asia', 
    lat: -8.8742, 
    lng: 125.7275,
    history: 'New nation (independent since 2002) focusing on primary infrastructure; postal codes currently in planning phases.'
  },
  // オセアニア
  { 
    code: 'FJ', 
    name: 'Fiji', 
    region: 'Oceania', 
    lat: -17.7134, 
    lng: 178.0650,
    history: 'Archipelagic nature made centralized numbering complex; mail is largely collected from town-based centers.'
  },
  { 
    code: 'KI', 
    name: 'Kiribati', 
    region: 'Oceania', 
    lat: -3.3704, 
    lng: -168.7340,
    history: 'Extremely remote and dispersed islands; localized village-based delivery removes the immediate need for numerical codes.'
  },
  { 
    code: 'NR', 
    name: 'Nauru', 
    region: 'Oceania', 
    lat: -0.5228, 
    lng: 166.9315,
    history: 'Worlds smallest island nation; single-district administration makes complex postal layers unnecessary.'
  },
  { 
    code: 'NU', 
    name: 'Niue', 
    region: 'Oceania', 
    lat: -19.0544, 
    lng: -169.8672,
    history: 'Single-island community with small population, allowing for effective mail sorting by name and village.'
  },
  { 
    code: 'PW', 
    name: 'Palau', 
    region: 'Oceania', 
    lat: 7.5150, 
    lng: 134.5825,
    history: 'Compact population centers and historical reliance on direct P.O. Box collections at central offices.'
  },
  { 
    code: 'WS', 
    name: 'Samoa', 
    region: 'Oceania', 
    lat: -13.7590, 
    lng: -172.1046,
    history: 'Strong village-based social structure where traditional chiefs manage community distribution points.'
  },
  { 
    code: 'SB', 
    name: 'Solomon Islands', 
    region: 'Oceania', 
    lat: -9.6457, 
    lng: 160.1562,
    history: 'Vast dispersed archipelago with high transport costs; localized collection is more sustainable than door-to-door codes.'
  },
  { 
    code: 'TK', 
    name: 'Tokelau', 
    region: 'Oceania', 
    lat: -9.2002, 
    lng: -171.8484,
    history: 'Non-self-governing territory with minimal mailing volume managed through New Zealands postal network.'
  },
  { 
    code: 'TO', 
    name: 'Tonga', 
    region: 'Oceania', 
    lat: -21.1790, 
    lng: -175.1982,
    history: 'Centralized monarchy with localized district distribution systems that never required numerical indexing.'
  },
  { 
    code: 'TV', 
    name: 'Tuvalu', 
    region: 'Oceania', 
    lat: -7.1095, 
    lng: 177.6493,
    history: 'Low population and tiny landmass; address identification is managed through landmark-based descriptions.'
  },
  { 
    code: 'VU', 
    name: 'Vanuatu', 
    region: 'Oceania', 
    lat: -15.3767, 
    lng: 166.9592,
    history: 'Culturally diverse islands with traditional land-rights focus; postal services centered on urban hubs.'
  },
  { 
    code: 'CK', 
    name: 'Cook Islands', 
    region: 'Oceania', 
    lat: -21.2367, 
    lng: -159.7777,
    history: 'Free association with New Zealand; uses centralized P.O. Box systems for most mail.'
  },
  // カリブ海・中南米
  { 
    code: 'AG', 
    name: 'Antigua and Barbuda', 
    region: 'Americas', 
    lat: 17.0608, 
    lng: -61.7964,
    history: 'Historically relied on general delivery (Poste Restante) at parish post offices.'
  },
  { 
    code: 'BS', 
    name: 'Bahamas', 
    region: 'Americas', 
    lat: 25.0343, 
    lng: -77.3963,
    history: 'Utilizes a widespread P.O. Box system; street-level postal codes were never formally implemented.'
  },
  { 
    code: 'BZ', 
    name: 'Belize', 
    region: 'Americas', 
    lat: 17.1899, 
    lng: -88.4976,
    history: 'Small country with landmark-based addressing; formal postal codes are currently under development but not in use.'
  },
  { 
    code: 'DM', 
    name: 'Dominica', 
    region: 'Americas', 
    lat: 15.4150, 
    lng: -61.3710,
    history: 'Village-based identity is more prominent than numerical zoning; mail sorted by named settlements.'
  },
  { 
    code: 'GD', 
    name: 'Grenada', 
    region: 'Americas', 
    lat: 12.1165, 
    lng: -61.6790,
    history: 'Limited urbanization in rural areas made a nationwide postal code system lower priority than other services.'
  },
  { 
    code: 'GY', 
    name: 'Guyana', 
    region: 'Americas', 
    lat: 4.8604, 
    lng: -58.9302,
    history: 'Large, sparsely populated interior; coastal regions use landmark addressing for efficiency.'
  },
  { 
    code: 'JM', 
    name: 'Jamaica', 
    region: 'Americas', 
    lat: 18.1096, 
    lng: -77.2975,
    history: 'Urban areas (Kingston) use zone numbers, but the country lacks a pervasive numerical national postal code.'
  },
  { 
    code: 'MS', 
    name: 'Montserrat', 
    region: 'Americas', 
    lat: 16.7425, 
    lng: -62.1873,
    history: 'Volcanic activity forced population relocation; addressing systems remain fluid and landmark-based.'
  },
  { 
    code: 'KN', 
    name: 'Saint Kitts and Nevis', 
    region: 'Americas', 
    lat: 17.3578, 
    lng: -62.7830,
    history: 'Historical reliance on local village post offices; small scale reduces the need for complex indexing.'
  },
  { 
    code: 'LC', 
    name: 'Saint Lucia', 
    region: 'Americas', 
    lat: 13.9094, 
    lng: -60.9789,
    history: 'Transitioning infrastructure; focus has been on improving street naming before numerical coding.'
  },
  { 
    code: 'VC', 
    name: 'Saint Vincent and the Grenadines', 
    region: 'Americas', 
    lat: 12.9843, 
    lng: -61.2872,
    history: 'Dispersed Grenadine islands maintain individual identities without a unified postal map.'
  },
  { 
    code: 'SR', 
    name: 'Suriname', 
    region: 'Americas', 
    lat: 3.9193, 
    lng: -56.0278,
    history: 'Geographic and linguistic diversity led to varied local addressing styles rather than a single code.'
  },
  { 
    code: 'AW', 
    name: 'Aruba', 
    region: 'Americas', 
    lat: 12.5211, 
    lng: -69.9683,
    history: 'Strong influence from the Netherlands; however, Aruba opted for built-up area names over numerical codes.'
  },
  { 
    code: 'CW', 
    name: 'Curaçao', 
    region: 'Americas', 
    lat: 12.1696, 
    lng: -68.9900,
    history: 'Mail is sorted primarily via district and building names in the capital Willemstad.'
  },
  { 
    code: 'SX', 
    name: 'Sint Maarten', 
    region: 'Americas', 
    lat: 18.0425, 
    lng: -63.0548,
    history: 'Shared island status creates unique administrative overlaps that hindered single-code adoption.'
  },
  // アフリカ
  { 
    code: 'BJ', 
    name: 'Benin', 
    region: 'Africa', 
    lat: 9.3077, 
    lng: 2.3158,
    history: 'Traditional urban systems prioritize street numbers within named blocks without a national ZIP equivalent.'
  },
  { 
    code: 'BF', 
    name: 'Burkina Faso', 
    region: 'Africa', 
    lat: 12.2383, 
    lng: -1.5616,
    history: 'Heavy reliance on P.O. Box systems (Boîte Postale) for both businesses and residences.'
  },
  { 
    code: 'BI', 
    name: 'Burundi', 
    region: 'Africa', 
    lat: -3.3731, 
    lng: 29.9189,
    history: 'Focus on primary postal hub development; door-to-door numbering remains in early stages.'
  },
  { 
    code: 'CF', 
    name: 'Central African Republic', 
    region: 'Africa', 
    lat: 6.6111, 
    lng: 20.9394,
    history: 'Persistent logistical challenges and scale of territory hindered unified postal indexing.'
  },
  { 
    code: 'TD', 
    name: 'Chad', 
    region: 'Africa', 
    lat: 15.4542, 
    lng: 18.7322,
    history: 'Vast desert expanses and nomadic traditions made static numerical zones difficult to implement.'
  },
  { 
    code: 'KM', 
    name: 'Comoros', 
    region: 'Africa', 
    lat: -11.6455, 
    lng: 43.3333,
    history: 'Island-based sorting hubs manage distribution for small populations without complex codes.'
  },
  { 
    code: 'CG', 
    name: 'Republic of the Congo', 
    region: 'Africa', 
    lat: -0.2280, 
    lng: 15.8277,
    history: 'Postal services are primarily organized around metropolitan centers like Brazzaville.'
  },
  { 
    code: 'CD', 
    name: 'Democratic Republic of the Congo', 
    region: 'Africa', 
    lat: -4.0383, 
    lng: 21.7587,
    history: 'Immense territory and historical fragmentation prevented the rollout of a national numerical index.'
  },
  { 
    code: 'DJ', 
    name: 'Djibouti', 
    region: 'Africa', 
    lat: 11.5890, 
    lng: 42.6703,
    history: 'Strategic city-state focus; mail is managed through highly centralized urban sorting.'
  },
  { 
    code: 'GQ', 
    name: 'Equatorial Guinea', 
    region: 'Africa', 
    lat: 1.6508, 
    lng: 10.2679,
    history: 'Small population and historical focus on administrative centers removed the need for postal codes.'
  },
  { 
    code: 'ER', 
    name: 'Eritrea', 
    region: 'Africa', 
    lat: 15.1794, 
    lng: 39.7823,
    history: 'Post-independence reconstruction focused on physical sorting facilities rather than coding schemas.'
  },
  { 
    code: 'GA', 
    name: 'Gabon', 
    region: 'Africa', 
    lat: -0.8037, 
    lng: 11.6094,
    history: 'Relies on city-specific sorting; recently exploring digital addressing but no fixed postal code.'
  },
  { 
    code: 'GM', 
    name: 'Gambia', 
    region: 'Africa', 
    lat: 13.4432, 
    lng: -15.3101,
    history: 'Compact geography allowed for sorting by community name and P.O. Box collections.'
  },
  { 
    code: 'GN', 
    name: 'Guinea', 
    region: 'Africa', 
    lat: 9.9456, 
    lng: -9.6966,
    history: 'Local sorting systems at the prefecture level manage mail without a unified national code.'
  },
  { 
    code: 'LR', 
    name: 'Liberia', 
    region: 'Africa', 
    lat: 6.4281, 
    lng: -9.4295,
    history: 'Rebuilding period focused on restoring basic mail routes; complex grid coding is a future goal.'
  },
  { 
    code: 'LY', 
    name: 'Libya', 
    region: 'Africa', 
    lat: 26.3351, 
    lng: 17.2283,
    history: 'Recent political fragmentation paused the development of unified technical infrastructure like ZIP codes.'
  },
  { 
    code: 'MW', 
    name: 'Malawi', 
    region: 'Africa', 
    lat: -13.2543, 
    lng: 34.3015,
    history: 'Sorted by specific district names and post office boxes (Private Bag).'
  },
  { 
    code: 'MR', 
    name: 'Mauritania', 
    region: 'Africa', 
    lat: 21.0079, 
    lng: -10.9408,
    history: 'Sahara geography favored post office box delivery over door-to-door residential coding.'
  },
  { 
    code: 'NA', 
    name: 'Namibia', 
    region: 'Africa', 
    lat: -22.9576, 
    lng: 18.4904,
    history: 'Uses an efficient system of P.O. Boxes and Private Bags at centralized hub locations.'
  },
  { 
    code: 'RW', 
    name: 'Rwanda', 
    region: 'Africa', 
    lat: -1.9403, 
    lng: 29.8739,
    history: 'Highly organized administration uses district and cell naming; currently pilot-testing building codes.'
  },
  { 
    code: 'ST', 
    name: 'Sao Tome and Principe', 
    region: 'Africa', 
    lat: 0.1864, 
    lng: 6.6131,
    history: 'Small population sorted directly by district name at the national sorting hub.'
  },
  { 
    code: 'SY', 
    name: 'Seychelles', 
    region: 'Africa', 
    lat: -4.6796, 
    lng: 55.4920,
    history: 'Unique island identities and small scale made numerical indexing less of a priority.'
  },
  { 
    code: 'SL', 
    name: 'Sierra Leone', 
    region: 'Africa', 
    lat: 8.4606, 
    lng: -11.7799,
    history: 'Ongoing reconstruction focus on reliability of delivery between urban centers.'
  },
  { 
    code: 'SO', 
    name: 'Somalia', 
    region: 'Africa', 
    lat: 5.1521, 
    lng: 46.1996,
    history: 'Historical instability led to a breakdown of central postal coding authorities.'
  },
  { 
    code: 'SS', 
    name: 'South Sudan', 
    region: 'Africa', 
    lat: 6.8770, 
    lng: 31.3070,
    history: 'Newest country in the world (2011); building national identification and addressing from scratch.'
  },
  { 
    code: 'TG', 
    name: 'Togo', 
    region: 'Africa', 
    lat: 8.6195, 
    lng: 0.8248,
    history: 'Emphasizes P.O. Box collections in urban hubs like Lomé.'
  },
  { 
    code: 'UG', 
    name: 'Uganda', 
    region: 'Africa', 
    lat: 1.3733, 
    lng: 32.2903,
    history: 'Relies on district-based P.O. Box collections and Private Bag addresses.'
  },
  { 
    code: 'BW', 
    name: 'Botswana', 
    region: 'Africa', 
    lat: -22.3285, 
    lng: 24.6849,
    history: 'Highly efficient P.O. Box system removals the urgent technical need for building-level ZIP codes.'
  },
] as const;

/**
 * Suggests a pattern based on the AGID prefix.
 */
export function getPatternForPrefix(prefix: string): PostalPattern | null {
  const countryCode = prefix.slice(0, 2).toUpperCase();
  return POSTAL_PATTERNS[countryCode] || null;
}

/**
 * "Learning" function that attempts to map AGID hash bits to a specific pattern.
 * This simulates a reinforcement learning outcome by providing a deterministic
 * mapping that "feels" like it learned the structure.
 */
export function applySmartPattern(agid: string, pattern: PostalPattern): string {
  const hash = agid.length === 12 ? agid.slice(2) : (agid.split('-')[1] || '');
  const format = pattern.format;
  let result = '';
  let hashIdx = 0;

  for (let i = 0; i < format.length; i++) {
    const char = format[i];
    if (char === 'N') {
      // Map Base32 char to digit
      const val = parseInt(hash[hashIdx % hash.length] || '0', 36) % 10;
      result += val;
      hashIdx++;
    } else if (char === 'A') {
      // Map to Alpha
      const val = (parseInt(hash[hashIdx % hash.length] || '0', 36) % 26) + 65;
      result += String.fromCharCode(val);
      hashIdx++;
    } else {
      result += char;
    }
  }

  return result;
}
