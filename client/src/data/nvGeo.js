// ─────────────────────────────────────────────────────────────────────────────
// Canonical NEVADA geography for location landing pages.
//
// All 17 Nevada counties (Carson City is a consolidated municipality) with their
// incorporated cities AND the significant unincorporated towns / CDPs. Each county
// is assigned to a region carrying the climate descriptor, an emphasis clause, a
// directory blurb, and the service-emphasis tags that drive generated page content.
// See nvContent.js for the generator and cities.js for the merge.
// ─────────────────────────────────────────────────────────────────────────────

// kebab-case slug for a place name → "<slug>-nv" (statewide-unique for NV places).
export function nvCitySlug(name) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')        // strip diacritics
      .toLowerCase()
      .replace(/[.']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-nv'
  )
}

// County page slug → "<county>-county-nv" (e.g. "clark-county-nv"). The trailing
// "County" is already in the name, so it slugs straight through.
export function nvCountySlug(county) {
  return county
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-nv'
}

// Ordered for display on the locations directory.
export const NV_REGION_ORDER = ['southern_nv', 'sierra_front', 'great_basin', 'central_nv']

export const NV_REGIONS = {
  southern_nv: {
    label: 'Southern Nevada',
    blurb: 'The Las Vegas Valley and Mojave Desert, with extreme heat, intense sun, and monsoon wind & dust.',
    // Reads after "<City> experiences …"
    climate:
      'extreme desert heat that regularly tops 110°F in summer, intense year-round sun, and monsoon wind, dust, and sudden flash-flooding',
    short: "Southern Nevada's extreme desert heat, sun, and wind",
    tags: ['desert', 'heat', 'wind', 'urban'],
  },
  sierra_front: {
    label: 'Sierra Front & Reno-Tahoe',
    blurb: 'Reno, Carson City, and the Carson Valley, with high-desert summers, mountain snow, and the Washoe Zephyr.',
    climate:
      'hot, dry high-desert summers, cold winters with real snow loads at elevation, and the strong Washoe Zephyr winds that sweep down off the Sierra Nevada',
    short: 'high-desert heat, mountain snow loads, and high winds',
    tags: ['snow', 'wind', 'urban', 'rural'],
  },
  great_basin: {
    label: 'Northern Nevada & the Great Basin',
    blurb: 'Elko, Winnemucca, Ely, and the high-desert ranch country, with cold, snowy winters and hot, dry summers.',
    climate:
      'cold, snowy Great Basin winters, hot dry summers, and wide day-to-night temperature swings across the high-desert ranch and mining country',
    short: 'heavy high-desert snow loads and open ranch-country wind',
    tags: ['snow', 'agriculture', 'rural', 'wind'],
  },
  central_nv: {
    label: 'Central & Eastern Nevada',
    blurb: 'Pahrump, Tonopah, Pioche and the remote desert and mining country between the metros.',
    climate:
      'high-desert and Mojave-edge extremes, including hot dry summers, cold high-elevation winters, and strong, unobstructed open-country wind',
    short: 'remote high-desert heat, wind, and big elevation swings',
    tags: ['desert', 'rural', 'wind', 'snow'],
  },
}

// county name → { region, cities: [incorporated cities + significant towns/CDPs] }
export const NV_COUNTIES = {
  // Consolidated municipality — its own city page covers the "county", so the
  // county loop skips a duplicate county page (handled in cities.js).
  'Carson City': {
    region: 'sierra_front',
    cities: ['Carson City'],
  },
  'Churchill County': {
    region: 'great_basin',
    cities: ['Fallon', 'Stillwater', 'Hazen'],
  },
  'Clark County': {
    region: 'southern_nv',
    cities: [
      'Las Vegas', 'Henderson', 'North Las Vegas', 'Boulder City', 'Mesquite',
      'Paradise', 'Spring Valley', 'Sunrise Manor', 'Enterprise', 'Summerlin South',
      'Whitney', 'Winchester', 'Laughlin', 'Searchlight', 'Indian Springs',
      'Moapa', 'Moapa Valley', 'Logandale', 'Overton', 'Bunkerville',
      'Blue Diamond', 'Mount Charleston', 'Goodsprings', 'Sloan',
    ],
  },
  'Douglas County': {
    region: 'sierra_front',
    cities: [
      'Minden', 'Gardnerville', 'Gardnerville Ranchos', 'Genoa', 'Zephyr Cove',
      'Stateline', 'Topaz Ranch Estates', 'Johnson Lane', 'Indian Hills',
    ],
  },
  'Elko County': {
    region: 'great_basin',
    cities: [
      'Elko', 'Spring Creek', 'Wells', 'West Wendover', 'Carlin', 'Jackpot',
      'Montello', 'Mountain City', 'Lamoille', 'Jarbidge',
    ],
  },
  'Esmeralda County': {
    region: 'central_nv',
    cities: ['Goldfield', 'Silver Peak', 'Dyer'],
  },
  'Eureka County': {
    region: 'great_basin',
    cities: ['Eureka', 'Crescent Valley', 'Beowawe'],
  },
  'Humboldt County': {
    region: 'great_basin',
    cities: ['Winnemucca', 'McDermitt', 'Golconda', 'Paradise Valley', 'Orovada'],
  },
  'Lander County': {
    region: 'great_basin',
    cities: ['Battle Mountain', 'Austin', 'Kingston'],
  },
  'Lincoln County': {
    region: 'central_nv',
    cities: ['Caliente', 'Pioche', 'Panaca', 'Alamo', 'Rachel'],
  },
  'Lyon County': {
    region: 'sierra_front',
    cities: [
      'Fernley', 'Yerington', 'Dayton', 'Silver Springs', 'Smith Valley',
      'Mason', 'Stagecoach', 'Silver City',
    ],
  },
  'Mineral County': {
    region: 'great_basin',
    cities: ['Hawthorne', 'Mina', 'Luning', 'Schurz', 'Walker Lake'],
  },
  'Nye County': {
    region: 'central_nv',
    cities: [
      'Pahrump', 'Tonopah', 'Beatty', 'Amargosa Valley', 'Gabbs',
      'Round Mountain', 'Manhattan',
    ],
  },
  'Pershing County': {
    region: 'great_basin',
    cities: ['Lovelock', 'Imlay', 'Mill City'],
  },
  'Storey County': {
    region: 'sierra_front',
    cities: ['Virginia City', 'Gold Hill', 'Lockwood', 'Mark Twain'],
  },
  'Washoe County': {
    region: 'sierra_front',
    cities: [
      'Reno', 'Sparks', 'Sun Valley', 'Spanish Springs', 'Cold Springs',
      'Incline Village', 'Verdi', 'Wadsworth', 'Gerlach', 'Lemmon Valley',
      'Golden Valley',
    ],
  },
  'White Pine County': {
    region: 'great_basin',
    cities: ['Ely', 'McGill', 'Ruth', 'Baker', 'Lund'],
  },
}
