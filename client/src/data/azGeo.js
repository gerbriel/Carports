// ─────────────────────────────────────────────────────────────────────────────
// Canonical Arizona geography for location landing pages.
//
// Every one of Arizona's 15 counties is represented, with its complete list of
// incorporated cities & towns (all 91 statewide) plus the major unincorporated
// communities / CDPs that property owners actually search for. Each county is
// assigned to a climate region that carries the descriptor, an emphasis "short"
// clause, a directory blurb, and the service-emphasis tags that drive generated
// page content. See azCityContent.js for the generator and cities.js for the merge.
// ─────────────────────────────────────────────────────────────────────────────

// kebab-case slug for a city name → "<slug>-az" (statewide-unique for AZ cities).
export function citySlug(name) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics
      .toLowerCase()
      .replace(/[.']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-az'
  )
}

export function countySlug(county) {
  return county
    .toLowerCase()
    .replace(/\s+county$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Ordered for display on the locations directory (high country → low desert).
export const REGION_ORDER = [
  'high_country',
  'central_highlands',
  'colorado_river',
  'sonoran_desert',
  'low_desert_yuma',
  'southern_az',
]

export const REGIONS = {
  high_country: {
    label: 'High Country & White Mountains',
    blurb: 'Flagstaff, the Mogollon Rim, the White Mountains & Navajo/Apache country, with real snow loads and long mountain winters.',
    // Reads after "<City> experiences …"
    climate:
      'cold winters with heavy mountain snowfall at elevation and summer monsoon thunderstorms',
    short: 'heavy high-country snow loads at elevation',
    tags: ['snow', 'rural', 'wind'],
  },
  central_highlands: {
    label: 'Central Highlands & Verde Valley',
    blurb: 'Prescott, Sedona & the Verde Valley, with four-season high-desert weather and winter snow.',
    climate:
      'four-season high-desert weather with cold, occasionally snowy winters, warm summers, and monsoon storms',
    short: 'high-desert winter snow and monsoon storms',
    tags: ['snow', 'wind', 'rural'],
  },
  colorado_river: {
    label: 'Colorado River & Mohave',
    blurb: 'Lake Havasu City, Bullhead City & Kingman, with extreme low-desert heat and strong winds along the river corridor.',
    climate:
      'extreme summer heat regularly exceeding 110°F, very low humidity, and strong, gusty winds along the Colorado River corridor',
    short: 'extreme river-corridor heat and high winds',
    tags: ['heat', 'desert', 'wind', 'rural'],
  },
  sonoran_desert: {
    label: 'Phoenix Metro & Sonoran Desert',
    blurb: 'The Valley of the Sun and the surrounding Sonoran Desert, with extreme heat, monsoon storms, and blowing dust (haboobs).',
    climate:
      'extreme summer heat regularly above 110°F, intense monsoon thunderstorms, blowing dust (haboobs), and damaging microburst winds',
    short: 'extreme desert heat, monsoon storms, and blowing dust',
    tags: ['heat', 'desert', 'wind', 'urban'],
  },
  low_desert_yuma: {
    label: 'Yuma & Southwest Low Desert',
    blurb: "Yuma, Parker & the southwest farm belt, the hottest, driest corner of the state, with year-round agriculture.",
    climate:
      'extreme low-desert heat regularly above 110°F, almost no rainfall, blowing dust, and a year-round agricultural growing season',
    short: 'extreme low-desert heat, blowing dust, and year-round farming',
    tags: ['heat', 'desert', 'agriculture', 'wind'],
  },
  southern_az: {
    label: 'Southern Arizona',
    blurb: 'Tucson, Sierra Vista, the San Pedro & Sulphur Springs valleys, with high-desert heat, strong monsoon storms, and ranch country.',
    climate:
      'hot high-desert summers, powerful monsoon thunderstorms with blowing dust, and mild winters',
    short: 'high-desert heat, monsoon dust storms, and ranch-country conditions',
    tags: ['heat', 'desert', 'agriculture', 'wind'],
  },
}

// county name → { region, cities: [incorporated cities/towns + major communities] }
// All 15 counties; the 91 incorporated municipalities plus key CDPs/communities.
// Municipalities that straddle a county line are listed once, in their primary county.
export const COUNTIES = {
  'Apache County': {
    region: 'high_country',
    cities: ['Eagar', 'Springerville', 'St. Johns', 'Chinle', 'Window Rock', 'Fort Defiance', 'Sanders', 'Ganado', 'Many Farms', 'Round Rock', 'Greer', 'Alpine', 'Nutrioso', 'Concho', 'Vernon'],
  },
  'Cochise County': {
    region: 'southern_az',
    cities: ['Sierra Vista', 'Douglas', 'Benson', 'Bisbee', 'Willcox', 'Tombstone', 'Huachuca City', 'Fort Huachuca', 'Whetstone', 'St. David', 'Bowie', 'San Simon', 'Naco', 'Palominas', 'Hereford', 'Elfrida', 'Pearce', 'Dragoon', 'Portal'],
  },
  'Coconino County': {
    region: 'high_country',
    cities: ['Flagstaff', 'Page', 'Williams', 'Fredonia', 'Tusayan', 'Bellemont', 'Doney Park', 'Munds Park', 'Kachina Village', 'Mountainaire', 'Grand Canyon Village', 'Tuba City', 'Cameron', 'Leupp', 'Parks', 'Mormon Lake'],
  },
  'Gila County': {
    region: 'high_country',
    cities: ['Payson', 'Globe', 'Miami', 'Star Valley', 'Hayden', 'Pine', 'Strawberry', 'Tonto Basin', 'San Carlos', 'Claypool', 'Roosevelt', 'Young'],
  },
  'Graham County': {
    region: 'southern_az',
    cities: ['Safford', 'Thatcher', 'Pima', 'Solomon', 'Central', 'Fort Thomas', 'Bylas', 'San Jose'],
  },
  'Greenlee County': {
    region: 'southern_az',
    cities: ['Clifton', 'Duncan', 'Morenci', 'York'],
  },
  'La Paz County': {
    region: 'low_desert_yuma',
    cities: ['Parker', 'Quartzsite', 'Salome', 'Wenden', 'Bouse', 'Ehrenberg', 'Poston', 'Cibola', 'Brenda'],
  },
  'Maricopa County': {
    region: 'sonoran_desert',
    cities: ['Phoenix', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise', 'Goodyear', 'Buckeye', 'Avondale', 'Queen Creek', 'Fountain Hills', 'El Mirage', 'Cave Creek', 'Carefree', 'Litchfield Park', 'Tolleson', 'Wickenburg', 'Paradise Valley', 'Gila Bend', 'Guadalupe', 'Youngtown', 'Sun City', 'Sun City West', 'Sun Lakes', 'Anthem', 'New River', 'Rio Verde', 'Tonopah', 'Wittmann', 'Laveen', 'Ahwatukee', 'Waddell', 'Morristown', 'Aguila'],
  },
  'Mohave County': {
    region: 'colorado_river',
    cities: ['Lake Havasu City', 'Kingman', 'Bullhead City', 'Colorado City', 'Fort Mohave', 'Mohave Valley', 'Golden Valley', 'Dolan Springs', 'Meadview', 'Chloride', 'Topock', 'Yucca', 'Beaver Dam', 'Littlefield'],
  },
  'Navajo County': {
    region: 'high_country',
    cities: ['Show Low', 'Snowflake', 'Taylor', 'Winslow', 'Holbrook', 'Pinetop-Lakeside', 'Whiteriver', 'Heber-Overgaard', 'Kayenta', 'Pinon', 'Forest Lakes', 'Joseph City', 'White Mountain Lake'],
  },
  'Pima County': {
    region: 'southern_az',
    cities: ['Tucson', 'Marana', 'Oro Valley', 'Sahuarita', 'South Tucson', 'Catalina Foothills', 'Casas Adobes', 'Drexel Heights', 'Flowing Wells', 'Tanque Verde', 'Vail', 'Green Valley', 'Three Points', 'Ajo', 'Sells', 'Catalina', 'Picture Rocks', 'Corona de Tucson', 'Arivaca'],
  },
  'Pinal County': {
    region: 'sonoran_desert',
    cities: ['Casa Grande', 'Maricopa', 'Apache Junction', 'Coolidge', 'Eloy', 'Florence', 'San Tan Valley', 'Superior', 'Kearny', 'Mammoth', 'Winkelman', 'Arizona City', 'SaddleBrooke', 'Gold Canyon', 'Oracle', 'Red Rock', 'Stanfield', 'Picacho', 'San Manuel', 'Queen Valley'],
  },
  'Santa Cruz County': {
    region: 'southern_az',
    cities: ['Nogales', 'Patagonia', 'Rio Rico', 'Tubac', 'Sonoita', 'Elgin', 'Amado', 'Tumacacori'],
  },
  'Yavapai County': {
    region: 'central_highlands',
    cities: ['Prescott', 'Prescott Valley', 'Cottonwood', 'Sedona', 'Chino Valley', 'Camp Verde', 'Clarkdale', 'Dewey-Humboldt', 'Jerome', 'Cornville', 'Verde Village', 'Mayer', 'Black Canyon City', 'Bagdad', 'Yarnell', 'Congress', 'Paulden', 'Cordes Lakes', 'Ash Fork', 'Seligman', 'Rimrock', 'Lake Montezuma', 'Village of Oak Creek'],
  },
  'Yuma County': {
    region: 'low_desert_yuma',
    cities: ['Yuma', 'San Luis', 'Somerton', 'Wellton', 'Fortuna Foothills', 'Gadsden', 'Tacna', 'Dateland', 'Roll'],
  },
}

export function regionLabel(key) {
  return REGIONS[key]?.label ?? key
}

// Ordered [{ key, label, blurb, counties: [countyName…] }] for the directory.
export const REGION_GROUPS = REGION_ORDER.map((key) => ({
  key,
  label: REGIONS[key].label,
  blurb: REGIONS[key].blurb,
  counties: Object.keys(COUNTIES)
    .filter((c) => COUNTIES[c].region === key && COUNTIES[c].cities.length > 0)
    .sort(),
}))
