// ─────────────────────────────────────────────────────────────────────────────
// Canonical California geography for location landing pages.
//
// Every one of California's 58 counties is represented, with its complete list of
// incorporated cities (482 total statewide). Each county is assigned to a region
// that carries the climate descriptor, an emphasis "short" clause, a directory
// blurb, and the service-emphasis tags that drive generated page content
// (highlights + FAQs). See cityContent.js for the generator and cities.js for the
// merge with hand-written featured cities.
// ─────────────────────────────────────────────────────────────────────────────

// kebab-case slug for a city name → "<slug>-ca" (statewide-unique for CA cities).
export function citySlug(name) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip diacritics (La Cañada → la-canada)
      .toLowerCase()
      .replace(/[.']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-ca'
  )
}

export function countySlug(county) {
  return county
    .toLowerCase()
    .replace(/\s+county$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Ordered for display on the locations directory (north → south, roughly).
export const REGION_ORDER = [
  'north_coast',
  'shasta_cascade',
  'sacramento_valley',
  'sierra_gold',
  'bay_area',
  'wine_country',
  'central_coast',
  'san_joaquin_valley',
  'greater_la',
  'orange_county',
  'inland_empire',
  'san_diego_county',
  'imperial_desert',
]

export const REGIONS = {
  north_coast: {
    label: 'North Coast',
    blurb: 'Redwood country that runs cool, wet, and humid, where corrosion resistance matters most.',
    // Reads after "<City> experiences …"
    climate:
      'cool, wet winters with heavy coastal rainfall, persistent fog, and high year-round humidity that demands corrosion-resistant steel',
    short: 'the wet, humid North Coast climate',
    tags: ['corrosion', 'rain', 'rural'],
  },
  shasta_cascade: {
    label: 'Shasta Cascade & Far North',
    blurb: 'Mountain and high-valley communities with real snow loads and long, hard winters.',
    climate:
      'cold mountain winters with significant snowfall and hot, dry summers',
    short: 'heavy mountain snow loads at elevation',
    tags: ['snow', 'rural'],
  },
  sacramento_valley: {
    label: 'Sacramento Valley',
    blurb: 'The capital region and the northern valley floor, with hot summers, foggy winters, and farm country.',
    climate:
      'hot, dry summers often exceeding 100°F, mild winters, and dense tule fog during the winter months',
    short: "the valley's summer heat and winter tule fog",
    tags: ['heat', 'fog', 'agriculture'],
  },
  sierra_gold: {
    label: 'Sierra Nevada & Gold Country',
    blurb: 'Foothill and mountain properties built for serious snow-load engineering.',
    climate:
      'cold, snowy winters at elevation and warm, dry summers',
    short: 'Sierra snow loads at elevation',
    tags: ['snow', 'rural'],
  },
  bay_area: {
    label: 'San Francisco Bay Area',
    blurb: 'Dense urban and suburban communities ringing the bay, with marine humidity and tight lots.',
    climate:
      'mild, marine-influenced weather year-round, wet winters, and coastal fog that raises humidity near the bay',
    short: 'the bay\'s mild, humid marine climate',
    tags: ['corrosion', 'urban', 'wind'],
  },
  wine_country: {
    label: 'Napa & Sonoma Wine Country',
    blurb: 'Vineyard and ranch country with warm summers and rich farm land.',
    climate:
      'warm, dry summers, wet winters, and morning valley fog',
    short: 'wine-country heat and morning valley fog',
    tags: ['agriculture', 'corrosion'],
  },
  central_coast: {
    label: 'Central Coast',
    blurb: 'From Santa Cruz to Ventura, with marine air, coastal wind, and rich farm valleys.',
    climate:
      'mild Mediterranean weather, coastal fog and marine humidity, and strong onshore winds along the coast',
    short: 'coastal marine humidity and onshore wind',
    tags: ['corrosion', 'coastal', 'agriculture'],
  },
  san_joaquin_valley: {
    label: 'San Joaquin Valley',
    blurb: "California's agricultural core, with extreme heat, winter fog, and big clear-span ag demand.",
    climate:
      'extreme summer heat regularly exceeding 105°F, minimal rainfall, and dense tule fog in winter',
    short: "the Valley's extreme heat and winter fog",
    tags: ['heat', 'agriculture', 'fog'],
  },
  greater_la: {
    label: 'Greater Los Angeles',
    blurb: 'The L.A. basin and high desert, where urban infill meets Santa Ana winds.',
    climate:
      'warm, dry Mediterranean summers, mild winters, and Santa Ana wind events',
    short: 'Santa Ana winds and dry summer heat',
    tags: ['heat', 'wind', 'urban'],
  },
  orange_county: {
    label: 'Orange County',
    blurb: 'Coastal Southern California, with mild weather, dense lots, and occasional Santa Ana winds.',
    climate:
      'mild coastal Southern California weather, low rainfall, marine humidity near the coast, and occasional Santa Ana winds',
    short: 'mild coastal weather with Santa Ana wind events',
    tags: ['coastal', 'urban', 'corrosion'],
  },
  inland_empire: {
    label: 'Inland Empire',
    blurb: 'Riverside and San Bernardino counties, with desert heat and strong winds.',
    climate:
      'intense summer heat and strong Santa Ana and desert winds',
    short: 'inland heat and high winds',
    tags: ['heat', 'wind'],
  },
  san_diego_county: {
    label: 'San Diego County',
    blurb: 'Coastal mildness near the water, with dry backcountry inland.',
    climate:
      'mild year-round coastal weather and marine humidity near the coast',
    short: 'coastal humidity and dry inland heat',
    tags: ['coastal', 'corrosion'],
  },
  imperial_desert: {
    label: 'Imperial Valley & Desert',
    blurb: 'Low-desert farm country, with extreme heat, blowing dust, and year-round growing.',
    climate:
      'extreme desert heat regularly exceeding 110°F, very low rainfall, and blowing sand and dust',
    short: 'extreme desert heat and blowing dust',
    tags: ['heat', 'desert', 'agriculture'],
  },
}

// county name → { region, cities: [incorporated cities/towns] }
// All 58 counties; cities arrays total 482 (the full incorporated-city count).
export const COUNTIES = {
  'Alameda County': {
    region: 'bay_area',
    cities: ['Alameda', 'Albany', 'Berkeley', 'Dublin', 'Emeryville', 'Fremont', 'Hayward', 'Livermore', 'Newark', 'Oakland', 'Piedmont', 'Pleasanton', 'San Leandro', 'Union City'],
  },
  'Alpine County': { region: 'sierra_gold', cities: [] },
  'Amador County': {
    region: 'sierra_gold',
    cities: ['Amador City', 'Ione', 'Jackson', 'Plymouth', 'Sutter Creek'],
  },
  'Butte County': {
    region: 'sacramento_valley',
    cities: ['Biggs', 'Chico', 'Gridley', 'Oroville', 'Paradise'],
  },
  'Calaveras County': { region: 'sierra_gold', cities: ['Angels Camp'] },
  'Colusa County': { region: 'sacramento_valley', cities: ['Colusa', 'Williams'] },
  'Contra Costa County': {
    region: 'bay_area',
    cities: ['Antioch', 'Brentwood', 'Clayton', 'Concord', 'Danville', 'El Cerrito', 'Hercules', 'Lafayette', 'Martinez', 'Moraga', 'Oakley', 'Orinda', 'Pinole', 'Pittsburg', 'Pleasant Hill', 'Richmond', 'San Pablo', 'San Ramon', 'Walnut Creek'],
  },
  'Del Norte County': { region: 'north_coast', cities: ['Crescent City'] },
  'El Dorado County': {
    region: 'sierra_gold',
    cities: ['Placerville', 'South Lake Tahoe'],
  },
  'Fresno County': {
    region: 'san_joaquin_valley',
    cities: ['Clovis', 'Coalinga', 'Firebaugh', 'Fowler', 'Fresno', 'Huron', 'Kerman', 'Kingsburg', 'Mendota', 'Orange Cove', 'Parlier', 'Reedley', 'San Joaquin', 'Sanger', 'Selma'],
  },
  'Glenn County': { region: 'sacramento_valley', cities: ['Orland', 'Willows'] },
  'Humboldt County': {
    region: 'north_coast',
    cities: ['Arcata', 'Blue Lake', 'Eureka', 'Ferndale', 'Fortuna', 'Rio Dell', 'Trinidad'],
  },
  'Imperial County': {
    region: 'imperial_desert',
    cities: ['Brawley', 'Calexico', 'Calipatria', 'El Centro', 'Holtville', 'Imperial', 'Westmorland'],
  },
  'Inyo County': { region: 'sierra_gold', cities: ['Bishop'] },
  'Kern County': {
    region: 'san_joaquin_valley',
    cities: ['Arvin', 'Bakersfield', 'California City', 'Delano', 'Maricopa', 'McFarland', 'Ridgecrest', 'Shafter', 'Taft', 'Tehachapi', 'Wasco'],
  },
  'Kings County': {
    region: 'san_joaquin_valley',
    cities: ['Avenal', 'Corcoran', 'Hanford', 'Lemoore'],
  },
  'Lake County': { region: 'north_coast', cities: ['Clearlake', 'Lakeport'] },
  'Lassen County': { region: 'shasta_cascade', cities: ['Susanville'] },
  'Los Angeles County': {
    region: 'greater_la',
    cities: ['Agoura Hills', 'Alhambra', 'Arcadia', 'Artesia', 'Avalon', 'Azusa', 'Baldwin Park', 'Bell', 'Bell Gardens', 'Bellflower', 'Beverly Hills', 'Bradbury', 'Burbank', 'Calabasas', 'Carson', 'Cerritos', 'Claremont', 'Commerce', 'Compton', 'Covina', 'Cudahy', 'Culver City', 'Diamond Bar', 'Downey', 'Duarte', 'El Monte', 'El Segundo', 'Gardena', 'Glendale', 'Glendora', 'Hawaiian Gardens', 'Hawthorne', 'Hermosa Beach', 'Hidden Hills', 'Huntington Park', 'Industry', 'Inglewood', 'Irwindale', 'La Cañada Flintridge', 'La Habra Heights', 'La Mirada', 'La Puente', 'La Verne', 'Lakewood', 'Lancaster', 'Lawndale', 'Lomita', 'Long Beach', 'Los Angeles', 'Lynwood', 'Malibu', 'Manhattan Beach', 'Maywood', 'Monrovia', 'Montebello', 'Monterey Park', 'Norwalk', 'Palmdale', 'Palos Verdes Estates', 'Paramount', 'Pasadena', 'Pico Rivera', 'Pomona', 'Rancho Palos Verdes', 'Redondo Beach', 'Rolling Hills', 'Rolling Hills Estates', 'Rosemead', 'San Dimas', 'San Fernando', 'San Gabriel', 'San Marino', 'Santa Clarita', 'Santa Fe Springs', 'Santa Monica', 'Sierra Madre', 'Signal Hill', 'South El Monte', 'South Gate', 'South Pasadena', 'Temple City', 'Torrance', 'Vernon', 'Walnut', 'West Covina', 'West Hollywood', 'Westlake Village', 'Whittier'],
  },
  'Madera County': { region: 'san_joaquin_valley', cities: ['Chowchilla', 'Madera'] },
  'Marin County': {
    region: 'bay_area',
    cities: ['Belvedere', 'Corte Madera', 'Fairfax', 'Larkspur', 'Mill Valley', 'Novato', 'Ross', 'San Anselmo', 'San Rafael', 'Sausalito', 'Tiburon'],
  },
  'Mariposa County': { region: 'sierra_gold', cities: [] },
  'Mendocino County': {
    region: 'north_coast',
    cities: ['Fort Bragg', 'Point Arena', 'Ukiah', 'Willits'],
  },
  'Merced County': {
    region: 'san_joaquin_valley',
    cities: ['Atwater', 'Dos Palos', 'Gustine', 'Livingston', 'Los Banos', 'Merced'],
  },
  'Modoc County': { region: 'shasta_cascade', cities: ['Alturas'] },
  'Mono County': { region: 'sierra_gold', cities: ['Mammoth Lakes'] },
  'Monterey County': {
    region: 'central_coast',
    cities: ['Carmel-by-the-Sea', 'Del Rey Oaks', 'Gonzales', 'Greenfield', 'King City', 'Marina', 'Monterey', 'Pacific Grove', 'Salinas', 'Sand City', 'Seaside', 'Soledad'],
  },
  'Napa County': {
    region: 'wine_country',
    cities: ['American Canyon', 'Calistoga', 'Napa', 'St. Helena', 'Yountville'],
  },
  'Nevada County': {
    region: 'sierra_gold',
    cities: ['Grass Valley', 'Nevada City', 'Truckee'],
  },
  'Orange County': {
    region: 'orange_county',
    cities: ['Aliso Viejo', 'Anaheim', 'Brea', 'Buena Park', 'Costa Mesa', 'Cypress', 'Dana Point', 'Fountain Valley', 'Fullerton', 'Garden Grove', 'Huntington Beach', 'Irvine', 'La Habra', 'La Palma', 'Laguna Beach', 'Laguna Hills', 'Laguna Niguel', 'Laguna Woods', 'Lake Forest', 'Los Alamitos', 'Mission Viejo', 'Newport Beach', 'Orange', 'Placentia', 'Rancho Santa Margarita', 'San Clemente', 'San Juan Capistrano', 'Santa Ana', 'Seal Beach', 'Stanton', 'Tustin', 'Villa Park', 'Westminster', 'Yorba Linda'],
  },
  'Placer County': {
    region: 'sierra_gold',
    cities: ['Auburn', 'Colfax', 'Lincoln', 'Loomis', 'Rocklin', 'Roseville'],
  },
  'Plumas County': { region: 'shasta_cascade', cities: ['Portola'] },
  'Riverside County': {
    region: 'inland_empire',
    cities: ['Banning', 'Beaumont', 'Blythe', 'Calimesa', 'Canyon Lake', 'Cathedral City', 'Coachella', 'Corona', 'Desert Hot Springs', 'Eastvale', 'Hemet', 'Indian Wells', 'Indio', 'Jurupa Valley', 'La Quinta', 'Lake Elsinore', 'Menifee', 'Moreno Valley', 'Murrieta', 'Norco', 'Palm Desert', 'Palm Springs', 'Perris', 'Rancho Mirage', 'Riverside', 'San Jacinto', 'Temecula', 'Wildomar'],
  },
  'Sacramento County': {
    region: 'sacramento_valley',
    cities: ['Citrus Heights', 'Elk Grove', 'Folsom', 'Galt', 'Isleton', 'Rancho Cordova', 'Sacramento'],
  },
  'San Benito County': {
    region: 'central_coast',
    cities: ['Hollister', 'San Juan Bautista'],
  },
  'San Bernardino County': {
    region: 'inland_empire',
    cities: ['Adelanto', 'Apple Valley', 'Barstow', 'Big Bear Lake', 'Chino', 'Chino Hills', 'Colton', 'Fontana', 'Grand Terrace', 'Hesperia', 'Highland', 'Loma Linda', 'Montclair', 'Needles', 'Ontario', 'Rancho Cucamonga', 'Redlands', 'Rialto', 'San Bernardino', 'Twentynine Palms', 'Upland', 'Victorville', 'Yucaipa', 'Yucca Valley'],
  },
  'San Diego County': {
    region: 'san_diego_county',
    cities: ['Carlsbad', 'Chula Vista', 'Coronado', 'Del Mar', 'El Cajon', 'Encinitas', 'Escondido', 'Imperial Beach', 'La Mesa', 'Lemon Grove', 'National City', 'Oceanside', 'Poway', 'San Diego', 'San Marcos', 'Santee', 'Solana Beach', 'Vista'],
  },
  'San Francisco County': { region: 'bay_area', cities: ['San Francisco'] },
  'San Joaquin County': {
    region: 'san_joaquin_valley',
    cities: ['Escalon', 'Lathrop', 'Lodi', 'Manteca', 'Ripon', 'Stockton', 'Tracy'],
  },
  'San Luis Obispo County': {
    region: 'central_coast',
    cities: ['Arroyo Grande', 'Atascadero', 'Grover Beach', 'Morro Bay', 'Paso Robles', 'Pismo Beach', 'San Luis Obispo'],
  },
  'San Mateo County': {
    region: 'bay_area',
    cities: ['Atherton', 'Belmont', 'Brisbane', 'Burlingame', 'Colma', 'Daly City', 'East Palo Alto', 'Foster City', 'Half Moon Bay', 'Hillsborough', 'Menlo Park', 'Millbrae', 'Pacifica', 'Portola Valley', 'Redwood City', 'San Bruno', 'San Carlos', 'San Mateo', 'South San Francisco', 'Woodside'],
  },
  'Santa Barbara County': {
    region: 'central_coast',
    cities: ['Buellton', 'Carpinteria', 'Goleta', 'Guadalupe', 'Lompoc', 'Santa Barbara', 'Santa Maria', 'Solvang'],
  },
  'Santa Clara County': {
    region: 'bay_area',
    cities: ['Campbell', 'Cupertino', 'Gilroy', 'Los Altos', 'Los Altos Hills', 'Los Gatos', 'Milpitas', 'Monte Sereno', 'Morgan Hill', 'Mountain View', 'Palo Alto', 'San Jose', 'Santa Clara', 'Saratoga', 'Sunnyvale'],
  },
  'Santa Cruz County': {
    region: 'central_coast',
    cities: ['Capitola', 'Santa Cruz', 'Scotts Valley', 'Watsonville'],
  },
  'Shasta County': {
    region: 'shasta_cascade',
    cities: ['Anderson', 'Redding', 'Shasta Lake'],
  },
  'Sierra County': { region: 'sierra_gold', cities: ['Loyalton'] },
  'Siskiyou County': {
    region: 'shasta_cascade',
    cities: ['Dorris', 'Dunsmuir', 'Etna', 'Fort Jones', 'Montague', 'Mount Shasta', 'Tulelake', 'Weed', 'Yreka'],
  },
  'Solano County': {
    region: 'sacramento_valley',
    cities: ['Benicia', 'Dixon', 'Fairfield', 'Rio Vista', 'Suisun City', 'Vacaville', 'Vallejo'],
  },
  'Sonoma County': {
    region: 'wine_country',
    cities: ['Cloverdale', 'Cotati', 'Healdsburg', 'Petaluma', 'Rohnert Park', 'Santa Rosa', 'Sebastopol', 'Sonoma', 'Windsor'],
  },
  'Stanislaus County': {
    region: 'san_joaquin_valley',
    cities: ['Ceres', 'Hughson', 'Modesto', 'Newman', 'Oakdale', 'Patterson', 'Riverbank', 'Turlock', 'Waterford'],
  },
  'Sutter County': { region: 'sacramento_valley', cities: ['Live Oak', 'Yuba City'] },
  'Tehama County': {
    region: 'shasta_cascade',
    cities: ['Corning', 'Red Bluff', 'Tehama'],
  },
  'Trinity County': { region: 'shasta_cascade', cities: [] },
  'Tulare County': {
    region: 'san_joaquin_valley',
    cities: ['Dinuba', 'Exeter', 'Farmersville', 'Lindsay', 'Porterville', 'Tulare', 'Visalia', 'Woodlake'],
  },
  'Tuolumne County': { region: 'sierra_gold', cities: ['Sonora'] },
  'Ventura County': {
    region: 'central_coast',
    cities: ['Camarillo', 'Fillmore', 'Moorpark', 'Ojai', 'Oxnard', 'Port Hueneme', 'Santa Paula', 'Simi Valley', 'Thousand Oaks', 'Ventura'],
  },
  'Yolo County': {
    region: 'sacramento_valley',
    cities: ['Davis', 'West Sacramento', 'Winters', 'Woodland'],
  },
  'Yuba County': { region: 'sacramento_valley', cities: ['Marysville', 'Wheatland'] },
}

export function regionLabel(key) {
  return REGIONS[key]?.label ?? key
}

// Ordered [{ key, label, blurb, counties: [countyName…] }] for the directory.
// Every county is included (each has its own county landing page); the few with
// no incorporated cities still get a linked county heading (with no city chips).
export const REGION_GROUPS = REGION_ORDER.map((key) => ({
  key,
  label: REGIONS[key].label,
  blurb: REGIONS[key].blurb,
  counties: Object.keys(COUNTIES)
    .filter((c) => COUNTIES[c].region === key)
    .sort(),
}))
