// ─────────────────────────────────────────────────────────────────────────────
// NEVADA permitting offices + adopted structural design-load criteria, per
// jurisdiction. Used by nvContent.js to give every Nevada location page a real,
// clickable permit-office link and representative design wind / ground snow
// loads, with the elevation caveat that drives Nevada snow loads.
//
// HOW LOADS WORK IN NEVADA (why elevation matters):
//   • Wind is given as the ASCE 7 Ultimate Design Wind Speed (Vult, 3-sec gust)
//     for Risk Category II at Exposure C. Northern Nevada (Reno/Tahoe front) is
//     a code-designated "Special Wind Region," so values run higher there.
//   • Ground snow load (Pg) is *strongly* elevation-driven. The psf shown is a
//     representative value for each jurisdiction's main populated valley floor;
//     parcels higher up the surrounding ranges carry dramatically heavier design
//     snow loads. Example (Washoe County, west of US-395): ~29 psf on the valley
//     floor, ~92 psf by 5,300 ft, and 150+ psf approaching the Sierra crest.
//   The authoritative per-parcel value comes from the ASCE 7 Hazard Tool and the
//   jurisdiction's adopted snow-load table, confirmed on the engineer-stamped
//   drawings for each build.
//
// Sources (researched June 2026): each jurisdiction's building-department site
// (linked below); the 2018/2024 Northern Nevada Amendments to the IBC (Reno,
// Sparks, Carson City, Douglas, Storey, Washoe, Lyon); Washoe County Ground Snow
// Loads table; Clark County / City of North Las Vegas design criteria; Elko
// County residential design criteria; and the ASCE 7 Hazard Tool.
// ─────────────────────────────────────────────────────────────────────────────

export const ASCE_HAZARD_TOOL = 'https://ascehazardtool.org'

// One shared sentence appended to every location's load readout.
export const LOAD_DISCLAIMER =
  'Values shown are representative design loads for the area. The exact wind speed, ' +
  'exposure, and ground snow load for your parcel are pulled from the ASCE 7 Hazard ' +
  'Tool and the jurisdiction’s adopted snow-load table, and are called out on your ' +
  'engineer-stamped drawings.'

// County-level record = the building department that permits UNINCORPORATED land,
// plus the representative design loads for that county. Keyed to match the county
// names in nvGeo.js exactly.
//   windMph, Vult (Risk Cat II, Exposure C), mph
//   exposure, ASCE 7 exposure category
//   specialWind, true where the code designates a Special Wind Region
//   snowPsf, representative ground snow load (Pg) on the populated valley floor
//   snowNote, how snow load climbs with elevation in that county
export const NV_COUNTY_PERMITS = {
  // ── Southern Nevada ────────────────────────────────────────────────────────
  'Clark County': {
    office: 'Clark County Building & Fire Prevention',
    url: 'https://www.clarkcountynv.gov/government/departments/building___fire_prevention/index.php',
    windMph: 115, exposure: 'C',
    snowPsf: 0,
    snowNote:
      'The Las Vegas Valley carries essentially no design snow load, wind governs roof design here. Only high Spring Mountains parcels (Mount Charleston, Lee Canyon, above ~6,000 ft) carry a real snow load (40+ psf), confirmed per parcel.',
    codeRef: 'Clark County: 2024 IBC/IRC, ASCE 7-22, Risk Category II.',
  },

  // ── Sierra Front & Reno to Tahoe (Northern Nevada Amendments) ─────────────────
  'Carson City': {
    office: 'Carson City Building Division',
    url: 'https://www.carson.org/government/departments-a-f/community-development/building-division',
    windMph: 120, exposure: 'C', specialWind: true,
    snowPsf: 30,
    snowNote:
      'About 30 psf on the Carson City valley floor (~4,700 ft); parcels up against the Carson Range foothills west of town carry substantially heavier snow loads.',
    codeRef: 'Northern Nevada Amendments to the IBC; Special Wind Region (§1609.3.2).',
  },
  'Douglas County': {
    office: 'Douglas County Building Division',
    url: 'https://www.douglascountynv.gov/government/departments/community_development/building_division',
    windMph: 115, exposure: 'C',
    snowPsf: 30,
    snowNote:
      'Roughly 30 psf in the Carson Valley (Minden/Gardnerville, ~4,700 ft), but the Lake Tahoe basin side of the county (Zephyr Cove, Stateline, ~6,300+ ft) carries 100 to 200+ psf. Snow load is set by your parcel’s elevation.',
    codeRef: 'Northern Nevada Amendments to the IBC; Tahoe-Douglas snow appendix at elevation.',
  },
  'Lyon County': {
    office: 'Lyon County Building Department',
    url: 'https://www.lyon-county.org/153/Building',
    windMph: 110, exposure: 'C',
    snowPsf: 22,
    snowNote:
      'Around 20 to 25 psf across the lower Lyon County desert (Fernley, Dayton, Yerington, ~4,300 ft); Smith and Mason Valley benches and higher ground carry more.',
    codeRef: 'Northern Nevada Amendments to the IBC.',
  },
  'Storey County': {
    office: 'Storey County Building Department',
    url: 'https://www.storeycounty.org/685/Building-Permits',
    windMph: 130, exposure: 'C', specialWind: true,
    snowPsf: 50,
    snowNote:
      'The Comstock sits high and exposed, Virginia City is near 6,200 ft, so snow loads of ~50 psf and up are typical, rising with elevation. Lower Lockwood/USA Parkway parcels are lighter.',
    codeRef: 'Northern Nevada Amendments to the IBC; Special Wind Region (§1609.3.2).',
  },
  'Washoe County': {
    office: 'Washoe County Building & Safety',
    url: 'https://www.washoecounty.gov/building/',
    windMph: 130, exposure: 'C', specialWind: true,
    snowPsf: 30,
    snowNote:
      'About 29 to 30 psf on the Reno/Sparks valley floor (~4,500 ft), climbing fast with elevation, roughly 92 psf by 5,300 ft west of US-395 and well over 150 psf toward the Sierra crest and Tahoe (Incline Village). Snow load is set strictly by elevation here.',
    codeRef: 'Northern Nevada Amendments to the IBC; Special Wind Region (§1609.3.2); snow per Table 1608.2.1.',
  },

  // ── Northern Nevada & the Great Basin ──────────────────────────────────────
  'Churchill County': {
    office: 'Churchill County Building Department',
    url: 'https://www.churchillcountynv.gov/98/Building-Department',
    windMph: 110, exposure: 'C',
    snowPsf: 20,
    snowNote:
      'Around 20 psf on the Lahontan Valley floor (Fallon, ~3,960 ft), one of the lighter snow loads in northern Nevada. Stillwater Range foothill parcels carry more.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Elko County': {
    office: 'Elko County Building & Safety',
    url: 'https://www.elkocountynv.net/departments/building_inspection/bldginspection/index.php',
    windMph: 115, exposure: 'C',
    snowPsf: 50,
    snowNote:
      'Elko County sets a 50 psf ground snow load (30 psf roof) for sites below 6,000 ft (Elko, Spring Creek, ~5,000 ft). Higher parcels, Lamoille, the Ruby Mountains, Jarbidge, carry significantly more.',
    codeRef: 'Elko County residential design criteria; load increases above 6,000 ft.',
  },
  'Eureka County': {
    office: 'Eureka County Planning & Building',
    url: 'http://www.eurekacountynv.gov/business-development/eureka-county-planning-commission/',
    windMph: 115, exposure: 'C',
    snowPsf: 40,
    snowNote:
      'Eureka sits near 6,500 ft, so ~40 psf is typical, increasing toward Diamond Valley and the surrounding ranges.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Humboldt County': {
    office: 'Humboldt County Building Department',
    url: 'https://www.humboldtcountynv.gov/161/Building-Department',
    windMph: 115, exposure: 'C',
    snowPsf: 25,
    snowNote:
      'Roughly 25 psf around Winnemucca (~4,300 ft); Paradise Valley and Santa Rosa Range foothill parcels carry heavier loads with elevation.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Lander County': {
    office: 'Lander County Building Department',
    url: 'https://www.landercountynv.org/departments/building_department/index.php',
    windMph: 115, exposure: 'C',
    snowPsf: 25,
    snowNote:
      'About 25 psf at Battle Mountain (~4,500 ft); Austin sits near 6,600 ft and carries 50+ psf. Snow load tracks your elevation.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Mineral County': {
    office: 'Mineral County (County Offices, Hawthorne)',
    url: 'https://mineralcountynv.us/government/index.php',
    windMph: 110, exposure: 'C',
    snowPsf: 20,
    snowNote:
      'Around 20 psf near Hawthorne and Walker Lake (~4,300 ft); higher parcels in the Wassuk Range carry more.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Pershing County': {
    office: 'Pershing County Building Department',
    url: 'https://www.pershingcountynv.gov/government/planning_and_building/building_department.php',
    windMph: 110, exposure: 'C',
    snowPsf: 20,
    snowNote:
      'About 20 psf on the Lovelock valley floor (~3,980 ft); Humboldt Range foothill parcels carry more.',
    codeRef: 'Northern Nevada Amendments to the IBC.',
  },
  'White Pine County': {
    office: 'White Pine County Building Department',
    url: 'https://www.whitepinecounty.net/134/Building-Permit-Procedures-Applications',
    windMph: 115, exposure: 'C',
    snowPsf: 40,
    snowNote:
      'Ely sits near 6,400 ft, so ~40 psf is typical and climbs in the surrounding Schell Creek and Snake Ranges. Great Basin National Park parcels (Baker) carry heavy alpine loads.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },

  // ── Central & Eastern Nevada ───────────────────────────────────────────────
  'Esmeralda County': {
    office: 'Esmeralda County (County Offices, Goldfield)',
    url: 'https://www.accessesmeralda.com/',
    windMph: 115, exposure: 'C',
    snowPsf: 25,
    snowNote:
      'Around 25 psf at Goldfield (~5,700 ft); Silver Peak and Dyer in the lower basins are lighter, while higher ground carries more.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Lincoln County': {
    office: 'Lincoln County Building Department',
    url: 'https://lincolncountynv.org/departments/building-department/',
    windMph: 115, exposure: 'C',
    snowPsf: 20,
    snowNote:
      'About 20 psf around Caliente (~4,400 ft); Pioche sits near 6,000 ft and carries heavier loads, as do the higher parcels toward the Wilson Creek Range.',
    codeRef: 'IBC, ASCE 7, Risk Category II.',
  },
  'Nye County': {
    office: 'Nye County Building & Safety',
    url: 'https://www.nyecountynv.gov/322/Building-Department',
    windMph: 115, exposure: 'C',
    snowPsf: 5,
    snowNote:
      'Pahrump sits low (~2,700 ft) with essentially no snow load, wind governs. But Nye County spans huge elevation: Tonopah (~6,030 ft) and Round Mountain carry ~30 psf, and the higher ranges carry more. Snow load is set by your specific elevation.',
    codeRef: 'Nye County (Pahrump Regional Planning District) building code; IBC / ASCE 7.',
  },
}

// City-level overrides for INCORPORATED cities that run their own building
// department. Only `office`/`url` differ from the county; loads inherit the
// county record unless explicitly overridden here. Keyed by the exact city name
// used in nvGeo.js. Cities not listed fall back to their county's record.
export const NV_CITY_PERMITS = {
  // Clark County metros
  'Las Vegas': {
    office: 'City of Las Vegas Department of Building & Safety',
    url: 'https://www.lasvegasnevada.gov/Business/Permits-Licenses/Building-Permits',
  },
  'North Las Vegas': {
    office: 'City of North Las Vegas Building Safety',
    url: 'https://www.cityofnorthlasvegas.com/business/development-services/building-safety',
    windMph: 115, exposure: 'C', // North Las Vegas design criteria explicitly: 115 mph, Exposure B/C
  },
  'Henderson': {
    office: 'City of Henderson Building & Fire Safety',
    url: 'https://www.cityofhenderson.com/government/departments/building-and-fire-safety',
  },
  'Boulder City': {
    office: 'Boulder City Building Department',
    url: 'https://www.bcnv.org/608/Permit-Submittals',
  },
  'Mesquite': {
    office: 'City of Mesquite Building Division',
    url: 'https://www.mesquitenv.gov/departments/building-division',
  },

  // Washoe County metros
  'Reno': {
    office: 'City of Reno Building & Safety (Development Services)',
    url: 'https://www.reno.gov/government/departments/development-services',
  },
  'Sparks': {
    office: 'City of Sparks Building & Safety',
    url: 'https://www.cityofsparks.us/your_government/departments/community_development/building_permits/index.php',
  },

  // Other incorporated cities with their own building departments
  'Elko': {
    office: 'City of Elko Building Department',
    url: 'https://www.elkocity.com/departments/building_department/building_codes_design_standards.php',
  },
  'Fernley': {
    office: 'City of Fernley Building Department',
    url: 'https://www.cityoffernley.org/',
  },

  // ── CITY-SPECIFIC LOAD OVERRIDES (elevation outliers) ──────────────────────
  // Unincorporated towns whose elevation puts them far off their county's
  // valley-floor representative. No office/url here — they inherit the county
  // building department; only the design loads differ. `caseStudy: true` marks
  // ASCE 7-22 snow Case Study zones where a licensed engineer must run a
  // site-specific snow study (no single map value applies).

  // Washoe County (valley rep 30 psf) — Tahoe basin & Sierra edge run much heavier
  'Incline Village': {
    snowPsf: 150, caseStudy: true,
    snowNote:
      'Incline Village sits on Lake Tahoe at ~6,350 ft — an ASCE 7-22 snow Case Study zone. A site-specific snow study by a licensed engineer is required, and design ground snow loads here commonly land in the 150–240 psf range. This is among the heaviest snow design in Nevada.',
  },
  'Verdi': {
    snowPsf: 45,
    snowNote:
      'Verdi (~4,900 ft) sits at the west edge of the Truckee Meadows against the Sierra, so snow loads run heavier than the Reno valley floor and climb quickly with elevation toward the state line.',
  },
  'Cold Springs': {
    snowPsf: 45,
    snowNote: 'Cold Springs sits high in the north valley (~5,500 ft), so design snow load runs well above the Reno/Sparks floor.',
  },
  'Gerlach': {
    snowPsf: 15,
    snowNote: 'Gerlach (~3,900 ft, Black Rock Desert) carries a light snow load, but it is a very open, exposed high-wind site — anchoring and bracing govern here.',
  },

  // Douglas County (valley rep 30 psf) — Tahoe basin side is alpine
  'Stateline': {
    snowPsf: 150, caseStudy: true,
    snowNote:
      'Stateline sits in the Lake Tahoe basin at ~6,250 ft — an ASCE 7-22 snow Case Study zone requiring a site-specific snow study. Design ground snow loads here commonly run 150–240 psf, far above the Carson Valley floor.',
  },
  'Zephyr Cove': {
    snowPsf: 150, caseStudy: true,
    snowNote:
      'Zephyr Cove sits on Lake Tahoe at ~6,300 ft — an ASCE 7-22 snow Case Study zone requiring a site-specific snow study (commonly 150–240 psf). Among the heaviest snow design in the state.',
  },
  'Genoa': {
    snowPsf: 45,
    snowNote: 'Genoa (~4,800 ft) sits against the Carson Range, so snow load runs heavier than the valley floor and climbs sharply on the benches above town.',
  },
  'Topaz Ranch Estates': {
    snowPsf: 35,
    snowNote: 'Topaz Ranch Estates (~5,000 ft) at the south end of the county carries a moderate snow load that increases with elevation.',
  },

  // Clark County (valley rep 0 psf) — the Spring Mountains are a true snow zone
  'Mount Charleston': {
    snowPsf: 50, caseStudy: true,
    snowNote:
      'Unlike the Las Vegas Valley (no snow load), Mount Charleston sits in the Spring Mountains around 7,500 ft and is a real snow zone. Clark County applies special building conditions here and a site-specific design snow load (commonly 50+ psf) is required per parcel.',
  },

  // Storey County (Comstock rep 50 psf) — the river canyon towns are lower
  'Lockwood': {
    snowPsf: 25,
    snowNote: 'Lockwood sits low along the Truckee River (~4,400 ft), so its snow load is well below the Virginia City highlands.',
  },
  'Mark Twain': {
    snowPsf: 30,
    snowNote: 'Mark Twain (~4,600 ft) along the river carries a lighter snow load than the Comstock highlands above it.',
  },

  // Elko County (valley rep 50 psf) — the high country is heavier, Wendover lighter
  'West Wendover': {
    snowPsf: 30,
    snowNote: 'West Wendover (~4,300 ft, on the Utah line) sits lower and drier than the Elko/Ruby Mountains core, so its snow load is lighter.',
  },
  'Lamoille': {
    snowPsf: 65,
    snowNote: 'Lamoille (~6,000 ft) sits at the base of the Ruby Mountains and carries a heavy snow load that climbs fast up the range.',
  },
  'Mountain City': {
    snowPsf: 60,
    snowNote: 'Mountain City (~5,600 ft) in the far north carries a heavier snow load than the Elko valley.',
  },
  'Jarbidge': {
    snowPsf: 80, caseStudy: true,
    snowNote: 'Jarbidge (~6,200 ft, deep in the mountains) carries one of the heaviest snow loads in the county; a site-specific value should be confirmed for this remote high-elevation parcel.',
  },

  // Nye County (Pahrump rep 5 psf) — huge elevation spread
  'Tonopah': {
    snowPsf: 30,
    snowNote: 'Tonopah sits high (~6,030 ft), so it carries a real ~30 psf snow load — very different from low-desert Pahrump on the same county page.',
  },
  'Round Mountain': {
    snowPsf: 25,
    snowNote: 'Round Mountain (~5,600 ft) carries a moderate snow load, unlike the Pahrump valley.',
  },
  'Manhattan': {
    snowPsf: 35,
    snowNote: 'Manhattan sits near 7,000 ft and carries a heavier snow load that increases with elevation.',
  },
  'Gabbs': {
    snowPsf: 15,
    snowNote: 'Gabbs (~4,700 ft) carries a light-to-moderate snow load.',
  },
  'Beatty': {
    snowPsf: 0,
    snowNote: 'Beatty sits low in the Amargosa Desert (~3,300 ft) with essentially no snow load — wind governs roof design here.',
  },
  'Amargosa Valley': {
    snowPsf: 0,
    snowNote: 'Amargosa Valley (~2,450 ft) carries essentially no snow load — wind governs roof design here.',
  },

  // Lincoln County (rep 20 psf)
  'Pioche': {
    snowPsf: 35,
    snowNote: 'Pioche sits near 6,000 ft, so it carries a heavier snow load than lower Caliente on the same county page.',
  },
  'Alamo': {
    snowPsf: 10,
    snowNote: 'Alamo sits low in the Pahranagat Valley (~3,450 ft) with a light snow load.',
  },

  // White Pine County (rep 40 psf)
  'Baker': {
    snowPsf: 50, caseStudy: true,
    snowNote: 'Baker is the gateway to Great Basin National Park beneath 13,000 ft Wheeler Peak; parcels up the slope carry heavy alpine snow loads and should be confirmed with a site-specific value.',
  },

  // Lander County (rep 25 psf) — Austin/Kingston sit high
  'Austin': {
    snowPsf: 50,
    snowNote: 'Austin sits high in the Toiyabe Range (~6,600 ft), so it carries a much heavier snow load than Battle Mountain on the valley floor.',
  },
  'Kingston': {
    snowPsf: 55,
    snowNote: 'Kingston (~6,800 ft) in the Toiyabe Range carries a heavy mountain snow load.',
  },
}

// Resolve the permit office + design loads for a place. City overrides take
// precedence for the office/URL; loads merge county defaults with any city
// override so incorporated-city specifics (e.g. North Las Vegas wind) win.
export function nvPermitFor(name, county) {
  const countyRec = NV_COUNTY_PERMITS[county] || null
  const cityRec = NV_CITY_PERMITS[name] || null
  if (!countyRec && !cityRec) return null
  const merged = { ...(countyRec || {}), ...(cityRec || {}) }
  return {
    office: merged.office,
    url: merged.url,
    windMph: merged.windMph ?? null,
    exposure: merged.exposure ?? 'C',
    specialWind: merged.specialWind ?? false,
    snowPsf: merged.snowPsf ?? null,
    snowNote: merged.snowNote ?? null,
    caseStudy: merged.caseStudy ?? false,
    codeRef: merged.codeRef ?? null,
  }
}
