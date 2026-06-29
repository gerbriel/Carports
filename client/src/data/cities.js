import { COUNTIES, REGION_GROUPS, regionLabel, countySlug as caCountySlug } from './caGeo'
import { generateCity } from './cityContent'
import { getPermitInfo } from './caPermits'
import { NV_COUNTIES, NV_REGIONS, NV_REGION_ORDER, nvCountySlug } from './nvGeo'
import { generateNvCity } from './nvContent'
import { COUNTIES as AZ_COUNTIES, REGION_GROUPS as AZ_REGION_GROUPS, countySlug as azCountySlug } from './azGeo'
import { generateCity as generateAzCity } from './azCityContent'

// Hand-written, premium service-area pages. These override the generated record
// for the same slug, so their bespoke copy, FAQs, and population are preserved.
const FEATURED_CITIES = [
  {
    slug: 'fresno-ca',
    name: 'Fresno',
    stateCode: 'CA',
    county: 'Fresno County',
    region: 'San Joaquin Valley',
    population: '542,000',
    climate:
      'extreme summer heat regularly exceeding 105°F, minimal rainfall, and occasional tule fog in winter',
    permitNotes:
      'Fresno County requires a building permit for any structure over 120 sq ft or over 12 ft tall. The Fresno County Planning & Development Department processes applications, and metal building manufacturers must provide engineer-stamped drawings for structures requiring permits.',
    permitOffice: 'Fresno County Planning & Development Department',
    introText:
      "Fresno is the agricultural heart of California, and we've been serving property owners, farmers, and businesses here for over 15 years. From equipment shelters in the West Side to residential garages in the Tower District, our steel structures are engineered for the Central Valley's extreme summers and winter tule fog conditions.",
    highlights: [
      "Central Valley's largest city and our primary service hub",
      'Agricultural equipment and hay storage specialists',
      'Urban residential and commercial projects',
      'Engineered for high-wind and heat extremes',
    ],
    nearbyAreas: ['Clovis', 'Sanger', 'Reedley', 'Kingsburg', 'Fowler', 'Selma'],
    faqs: [
      {
        q: 'Do you offer free on-site quotes in Fresno?',
        a: "Yes. We provide free on-site assessments for all Fresno and Fresno County projects. Our estimator visits your property to measure, check soil conditions, and note any setback requirements. Most quotes are delivered within 24 hours of the site visit.",
      },
      {
        q: 'What permits do I need for a metal carport or garage in Fresno County?',
        a: 'In Fresno County, any structure over 120 square feet or taller than 12 feet requires a building permit from the Fresno County Planning & Development Department. We provide engineer-stamped drawings and handle the permit documentation, and you submit the application. Typical approval takes four to eight weeks depending on the jurisdiction.',
      },
      {
        q: "How do your metal buildings hold up to Fresno's summer heat?",
        a: 'All our steel panels have an industrial Galvalume coating that reflects radiant heat. For garages and workshops, our standard moisture barrier handles condensation, and for real temperature control we step you up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. Vertical-roof panel orientation channels rainwater off efficiently and cuts down debris buildup from Valley wind events.',
      },
      {
        q: 'Can you build hay storage and equipment barns for Fresno County farms?',
        a: "Absolutely. Agricultural structures are one of our specialties in the Central Valley. We build open-front hay barns, fully enclosed equipment shops, and clear-span structures up to 150+ feet wide. We're familiar with Williamson Act land requirements and ag-zoned parcel setbacks throughout Fresno County.",
      },
      {
        q: 'How long does installation take in Fresno?',
        a: 'Most residential projects (carports, single-car garages) install in one to two days. Larger commercial or agricultural buildings take three to seven days. Lead time from order to install is typically four to eight weeks depending on current backlog and permit timelines.',
      },
    ],
  },
  {
    slug: 'clovis-ca',
    name: 'Clovis',
    stateCode: 'CA',
    county: 'Fresno County',
    region: 'San Joaquin Valley',
    population: '125,000',
    climate:
      'hot San Joaquin Valley summers with temperatures regularly above 100°F, and mild winters',
    permitNotes:
      "Clovis falls under the City of Clovis Development Services for within city limits, and Fresno County for unincorporated areas. Clovis city permits generally turn around faster than county permits, typically three to six weeks.",
    permitOffice: 'City of Clovis Development Services',
    introText:
      "Clovis is one of the fastest-growing cities in the San Joaquin Valley, with new residential developments and established equestrian properties. We build everything from two-car garages in northeast Clovis neighborhoods to horse shelters and hay barns on rural ranchettes along Herndon Avenue.",
    highlights: [
      'Residential garages and shop buildings',
      'Equestrian and hobby farm structures',
      'New-development project experience',
      'Fast city permit turnaround (three to six weeks)',
    ],
    nearbyAreas: ['Fresno', 'Sanger', 'Reedley', 'Fowler', 'Selma'],
    faqs: [
      {
        q: 'Do you build in Clovis city limits?',
        a: 'Yes. We serve the entire Clovis area including the northeast growth corridor, Old Town Clovis, and rural properties along Herndon Avenue and Shepherd Avenue. We work with both City of Clovis permits and Fresno County permits for surrounding unincorporated areas.',
      },
      {
        q: 'I have a horse property near Clovis. Can you build a run-in shelter or hay barn?',
        a: "Equestrian structures are a significant part of our Clovis business. We build run-in shelters, loafing sheds, hay storage barns, and tack room/workshop combinations. Our steel frames use Galvalume-coated panels that won't splinter or rot like wood.",
      },
      {
        q: "What's the typical cost for a two-car metal garage in Clovis?",
        a: 'A standard 20×20 two-car metal garage in Clovis typically runs $8,000 to $14,000 installed, depending on roof style, wall height, and door configuration. Site prep (concrete slab) is additional and ranges $3,000 to $6,000 for a 20×20.',
      },
      {
        q: 'How far in advance should I book installation in Clovis?',
        a: 'During peak season (spring and early summer), our Fresno/Clovis schedule fills eight to twelve weeks out. We recommend contacting us as early as possible, especially if your project needs a city permit. Off-season (late fall through winter) often has shorter lead times of four to six weeks.',
      },
    ],
  },
  {
    slug: 'visalia-ca',
    name: 'Visalia',
    stateCode: 'CA',
    county: 'Tulare County',
    region: 'San Joaquin Valley',
    population: '143,000',
    climate:
      'hot summers exceeding 105°F, mild winters, and proximity to the Sierra Nevada creating occasional strong wind events',
    permitNotes:
      'Visalia city limits fall under the City of Visalia Development Services. Structures in unincorporated Tulare County require permits from the Tulare County Resource Management Agency. Agricultural structures on ag-zoned land may be exempt from permits below certain thresholds.',
    permitOffice: 'Tulare County Resource Management Agency',
    introText:
      "Visalia is the commercial hub of Tulare County, surrounded by some of the most productive agricultural land in the world. We serve Visalia homeowners needing garages and carports, as well as Tulare County farmers requiring hay storage, equipment barns, and open-front structures for their ag operations.",
    highlights: [
      'Agricultural and commercial hub of Tulare County',
      'Experience with Tulare County ag permit exemptions',
      'Proximity to Sierra Nevada foothills projects',
      'Serving both city and rural county properties',
    ],
    nearbyAreas: ['Tulare', 'Porterville', 'Exeter', 'Farmersville', 'Dinuba'],
    faqs: [
      {
        q: 'Do you serve Visalia and all of Tulare County?',
        a: "Yes. We serve Visalia, Tulare, Porterville, Exeter, Farmersville, Dinuba, and surrounding rural areas of Tulare County. We typically have installation teams working in Tulare County several times per month.",
      },
      {
        q: 'Are ag structures in Tulare County exempt from building permits?',
        a: "In many cases, yes. California law (Health & Safety Code Section 19132) provides exemptions for agricultural structures on parcels primarily used for agricultural purposes. This varies by structure type, square footage, and local interpretation. We recommend checking with the Tulare County Resource Management Agency, and we can assist with this assessment during your free consultation.",
      },
      {
        q: 'What size metal building do I need for grape or citrus harvesting equipment?',
        a: 'Most harvesting equipment (tractors, gondolas, sprayers) fits comfortably under a 40×60 or 40×80 structure with a 14 to 16 ft eave height. If you\'re storing a full gondola set or a large harvester, a 60×80 clear-span with 16+ ft clearance is typical. We\'ll ask about your specific equipment during the site assessment.',
      },
      {
        q: 'What roof styles work best for the Visalia area climate?',
        a: 'We recommend vertical-roof style for the Visalia area. The vertical panel orientation channels Valley rain straight off the roof, reduces heat buildup, and holds up better to wind events that occasionally sweep through from the Tehachapi Pass.',
      },
    ],
  },
  {
    slug: 'tulare-ca',
    name: 'Tulare',
    stateCode: 'CA',
    county: 'Tulare County',
    region: 'San Joaquin Valley',
    population: '68,000',
    climate:
      'intense summer heat, tule fog in winter, and flat terrain with open exposure to wind',
    permitNotes:
      'City of Tulare projects go through the City of Tulare Development Services Center. Rural Tulare County properties use the Tulare County Resource Management Agency. Dairy and agricultural structures may qualify for permit exemptions under California Health & Safety Code Section 19132.',
    permitOffice: 'City of Tulare Development Services Center',
    introText:
      "Tulare is home to the World Ag Expo and one of the most intensively farmed counties in the state. Cotton, dairy, citrus, and grapes dominate the landscape, and we build the structures that support those operations, from open-front cotton module sheds to dairy shade structures and residential carports for city homeowners.",
    highlights: [
      'World Ag Expo hometown, so we know CA agriculture',
      'Dairy and large-scale ag structure specialists',
      'Open-front hay and commodity storage',
      'Large clear-span structures 100+ ft wide',
    ],
    nearbyAreas: ['Visalia', 'Hanford', 'Porterville', 'Lindsay', 'Exeter'],
    faqs: [
      {
        q: 'Do you build dairy structures and calf shelters near Tulare?',
        a: 'Yes. Dairy operations are a major part of our work in the Tulare area. We build shade shelters for freestall barns, covered commodity storage, calf hutch grouping covers, and open-front hay storage. Our team understands the structural demands of dairy operations including heavy load requirements and drainage considerations.',
      },
      {
        q: 'Can you build a structure large enough for a full cotton module handler?',
        a: 'Absolutely. For cotton module handling equipment, we typically build structures 80 to 100 ft wide with 18 to 20 ft eave height and large roll-up or sliding doors (18 to 20 ft wide). These require engineered drawings but are well within our build capability.',
      },
      {
        q: "How do you anchor metal buildings in Tulare County's soil conditions?",
        a: "Most of the Tulare area has clay-heavy soils with high shrink-swell potential. We engineer our anchor systems accordingly, typically 48\" deep concrete footings or driven helical piers for larger structures. The specific anchoring method is determined based on your site's soil conditions and load requirements.",
      },
    ],
  },
  {
    slug: 'bakersfield-ca',
    name: 'Bakersfield',
    stateCode: 'CA',
    county: 'Kern County',
    region: 'Southern San Joaquin Valley',
    population: '405,000',
    climate:
      "one of California's hottest cities, regularly exceeding 110°F in summer, and subject to strong Tehachapi wind events",
    permitNotes:
      'Bakersfield city limits go through the City of Bakersfield Development Services. County properties use the Kern County Planning & Natural Resources Department. Kern County has specific wind-load requirements due to the Tehachapi Pass wind corridor.',
    permitOffice: 'Kern County Planning & Natural Resources Department',
    introText:
      "Bakersfield is the energy and agriculture capital of Kern County. Residential properties, oil field operations, and large-scale farming all demand reliable metal structures. We serve Bakersfield homeowners with garages and RV covers, and support Kern County agricultural and industrial operations with purpose-built steel buildings.",
    highlights: [
      'Engineered for Kern County Tehachapi wind loads',
      'Oil field and industrial structure experience',
      'Residential RV covers and garages',
      'Agricultural Kern County farm buildings',
    ],
    nearbyAreas: ['Delano', 'McFarland', 'Shafter', 'Wasco', 'Tehachapi', 'Taft'],
    faqs: [
      {
        q: 'Do you serve Bakersfield and Kern County?',
        a: 'Yes. We regularly build in Bakersfield and throughout Kern County including Delano, Shafter, Wasco, Taft, and the greater Bakersfield metro. Our crews make the trip from Fresno for Kern County projects regularly, and we price our services to remain competitive at that distance.',
      },
      {
        q: "How are your buildings engineered for Bakersfield's wind conditions?",
        a: "The Tehachapi Pass creates a well-known wind corridor that affects southern Kern County. All our structures for the Bakersfield area are engineered to California's wind exposure category requirements, with additional bracing and anchoring specified for exposed sites. Our engineer-stamped drawings call out the specific wind speed and exposure category for your parcel.",
      },
      {
        q: "Is it worth insulating a metal garage in Bakersfield given the heat?",
        a: "Highly recommended. Bakersfield's average summer high is 98 to 104°F, and an uninsulated steel building can reach 130°F inside on peak days. Our standard moisture barrier handles condensation, but for real heat control step up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. Just remember the thicker you go, the more the panels can bubble or compress slightly around the screw points. For a workshop or garage you'll use regularly, the upgrade pays for itself in cooling costs within a few seasons.",
      },
    ],
  },
  {
    slug: 'madera-ca',
    name: 'Madera',
    stateCode: 'CA',
    county: 'Madera County',
    region: 'San Joaquin Valley',
    population: '68,000',
    climate:
      'hot valley summers in lower Madera County, transitioning to cooler conditions with snow potential in the Sierra foothills above 2,000 feet',
    permitNotes:
      "City of Madera projects go through the City of Madera Community Development Department. Rural Madera County uses the Madera County Planning Department. Foothill properties may have additional snow-load requirements at higher elevations.",
    permitOffice: 'Madera County Planning Department',
    introText:
      "Madera County stretches from the valley floor up into the Sierra Nevada foothills, and our structures serve that full range, from vineyard equipment shelters in the valley to horse barns and RV covers near Yosemite's gateway communities. The county's wine grape industry drives strong demand for covered ag storage.",
    highlights: [
      'Valley vineyards and ag storage',
      'Sierra foothills horse properties',
      'Snow-load engineering for higher elevations',
      'Gateway to Yosemite recreational storage',
    ],
    nearbyAreas: ['Fresno', 'Chowchilla', 'Oakhurst', 'Coarsegold', 'Raymond'],
    faqs: [
      {
        q: 'Can you build in the Madera County foothills (Oakhurst, Coarsegold)?',
        a: "Yes. We build throughout Madera County including Oakhurst, Coarsegold, Raymond, and Bass Lake. Foothill builds require snow-load engineering for structures above certain elevations, and our drawings will specify the appropriate design snow load for your parcel's elevation.",
      },
      {
        q: 'I have a vineyard in Madera County. What do you recommend for equipment storage?',
        a: "For vineyard equipment (tractors, sprayers, disc harrows, grape bins), a 40×60 or 60×80 open-front structure with 14 ft eave height works well for most operations. If you're also storing processed wine or barrels, an enclosed building with insulation is worth the investment to manage temperature fluctuations.",
      },
      {
        q: 'What about building near Bass Lake or the Yosemite gateway communities?',
        a: "Those properties sit at higher elevation, so they need snow-load engineering, and access can be tighter for delivery. We design the structure to the right snow load for your parcel's elevation and confirm any local setback requirements during the site assessment, so there are no surprises on install day.",
      },
    ],
  },
  {
    slug: 'merced-ca',
    name: 'Merced',
    stateCode: 'CA',
    county: 'Merced County',
    region: 'Northern San Joaquin Valley',
    population: '90,000',
    climate:
      'hot valley summers with significant tule fog in winter, creating sustained high humidity that can accelerate corrosion on inferior metal',
    permitNotes:
      'City of Merced uses the Merced City Building Division. County-area projects go through the Merced County Planning Division. Agricultural structures on ag-zoned land may qualify for permit exemptions under California Health & Safety Code.',
    permitOffice: 'Merced County Planning Division',
    introText:
      "Merced is the home of UC Merced and a growing agricultural community in the northern Central Valley. Dairy farming, almonds, and poultry operations dominate the county's rural landscape, and we supply the metal structures that support those industries, alongside residential carports and garages for the city's growing population.",
    highlights: [
      'Dairy and poultry structure specialists',
      'UC Merced area residential growth',
      'Almond and orchard equipment storage',
      'Galvalume-coated panels resist fog-related corrosion',
    ],
    nearbyAreas: ['Atwater', 'Livingston', 'Turlock', 'Los Banos', 'Delhi'],
    faqs: [
      {
        q: "How do metal buildings hold up in Merced's tule fog conditions?",
        a: 'Tule fog creates sustained high humidity at ground level for days at a time, which can accelerate corrosion on lower-grade metal. All our buildings use Galvalume-coated steel panels (AZ50 or better), which provide superior corrosion resistance compared to galvanized zinc coatings. Our anchoring systems also use hot-dip galvanized or stainless hardware in exposed locations.',
      },
      {
        q: 'Do you build poultry or dairy structures near Merced?',
        a: "Yes. Merced County has significant poultry and dairy operations, and we have experience building support structures for both. We build shade structures, commodity storage, and equipment shelters designed around these operations.",
      },
      {
        q: 'Is the turnaround faster for Merced projects?',
        a: "Merced is roughly 1.5 hours from our Fresno base, which makes scheduling convenient. Installation crew availability is similar to our Fresno service area. Permitting timelines are controlled by the county/city and generally run four to eight weeks for residential projects.",
      },
    ],
  },
  {
    slug: 'modesto-ca',
    name: 'Modesto',
    stateCode: 'CA',
    county: 'Stanislaus County',
    region: 'Northern San Joaquin Valley',
    population: '222,000',
    climate:
      'warm Mediterranean summers, cool wet winters, and occasional wind events off the Coast Range',
    permitNotes:
      'City of Modesto permits go through the Modesto Development Services Department. Stanislaus County properties use the Stanislaus County Planning & Community Development. Stanislaus County has active code enforcement in rural areas, so permits are strictly enforced.',
    permitOffice: 'Stanislaus County Planning & Community Development',
    introText:
      "Modesto anchors Stanislaus County's economy, which balances a large residential population with significant almond, walnut, peach, and dairy operations. We build for both worlds, homeowners looking to add a garage or RV cover, and agricultural operations needing covered equipment and crop storage in the surrounding county.",
    highlights: [
      "Largest city in Stanislaus County",
      'Residential garage and carport specialists',
      'Tree crop and dairy ag structures',
      'Active permit enforcement, and we do it right',
    ],
    nearbyAreas: ['Turlock', 'Ceres', 'Salida', 'Oakdale', 'Riverbank', 'Patterson'],
    faqs: [
      {
        q: 'Do you serve Modesto and Stanislaus County?',
        a: 'Yes. Modesto and Stanislaus County are within our regular service area. We serve Modesto, Turlock, Ceres, Oakdale, Patterson, and the surrounding rural county. Our crews are familiar with both City of Modesto permits and Stanislaus County permit processes.',
      },
      {
        q: "What's the permitting process like for Modesto residential projects?",
        a: 'For residential projects within City of Modesto limits, permits typically take three to six weeks. We prepare and submit all required drawings and documentation. Stanislaus County has active permit enforcement in unincorporated areas, and building without a permit when one is required can result in stop-work orders and fines. We always pull permits when required.',
      },
      {
        q: 'Can you build a large almond or walnut storage facility near Modesto?',
        a: 'Yes. Tree nut storage is a significant project type for us in the northern Central Valley. We build enclosed insulated commodity storage buildings and open-front equipment shelters sized for orchard operations, including drive-through capability and loading access.',
      },
      {
        q: 'I want to add a steel RV cover to my property in north Modesto. What do I need?',
        a: "A free-standing RV cover in Modesto city limits requires a building permit if the structure is over 120 sq ft, which most RV covers are. You'll also need to observe property setbacks (typically 5 ft from side and rear property lines for accessory structures). We handle the permit drawings, and you submit the application to City of Modesto Development Services.",
      },
    ],
  },
  {
    slug: 'stockton-ca',
    name: 'Stockton',
    stateCode: 'CA',
    county: 'San Joaquin County',
    region: 'Northern San Joaquin Valley',
    population: '322,000',
    climate:
      "warm summers with significant bay influence moderating temperatures compared to the southern Valley, and wet winters with occasional frost",
    permitNotes:
      "City of Stockton uses the Stockton Development Services. San Joaquin County properties go through the San Joaquin County Community Development Department. Delta-area properties may have additional requirements around FEMA flood zones and levee setbacks.",
    permitOffice: 'San Joaquin County Community Development Department',
    introText:
      "Stockton is the port city of the Central Valley with a diverse mix of residential neighborhoods and significant agricultural land in the surrounding delta. We build in Stockton proper and across San Joaquin County, including the wine grape regions of Lodi and the delta farming communities.",
    highlights: [
      "Port city with easy Bay Area access",
      'Delta and wine region agricultural structures',
      'Large residential and commercial capacity',
      'FEMA flood-zone experience for delta properties',
    ],
    nearbyAreas: ['Lodi', 'Tracy', 'Manteca', 'Ripon', 'Escalon', 'Lathrop'],
    faqs: [
      {
        q: 'Do you build in Stockton and San Joaquin County?',
        a: 'Yes. Stockton and San Joaquin County are in our expanded service area. We regularly build in Stockton, Lodi, Manteca, Tracy, and surrounding agricultural communities. The drive from Fresno is approximately 2 hours, and we price Stockton-area projects accordingly.',
      },
      {
        q: 'Can you build in San Joaquin delta flood zones near Stockton?',
        a: "Delta properties often fall within FEMA special flood hazard areas (SFHAs), which require structures to be elevated above the base flood elevation. We can build elevated platforms and foundations for our structures in these areas, though foundation work varies by site. We recommend a site assessment before quoting any delta-adjacent project.",
      },
      {
        q: 'I want an RV cover in Stockton for my Class A motorhome. What are my options?',
        a: "Class A motorhomes typically need 14 to 16 ft clearance and 40+ ft of length. We build open RV covers starting at 12×30, with options up to 20×60 or larger. Fully enclosed RV garages with roll-up doors are also available. City of Stockton requires a permit for any structure over 120 sq ft, and we handle the permit drawings.",
      },
    ],
  },
  {
    slug: 'sacramento-ca',
    name: 'Sacramento',
    stateCode: 'CA',
    county: 'Sacramento County',
    region: 'Sacramento Valley',
    population: '513,000',
    climate:
      "warm dry summers with delta breeze influence, wet winters, and proximity to the Sierra Nevada",
    permitNotes:
      "City of Sacramento projects go through the City of Sacramento Community Development Department. Sacramento County unincorporated areas use the Sacramento County Planning & Environmental Review. Title 24 energy requirements apply to all conditioned enclosed structures.",
    permitOffice: 'Sacramento County Planning & Environmental Review',
    introText:
      "California's capital city has a growing demand for accessory structures as homeowners in the greater Sacramento metro add garages, workshop buildings, and RV covers to their properties. We serve Sacramento proper and the wider metro including Elk Grove, Rancho Cordova, Citrus Heights, and the surrounding agricultural communities.",
    highlights: [
      "State capital metro area",
      'Residential garages and workshop buildings',
      'RV covers for growing suburban properties',
      'Foothill and rural property builds',
    ],
    nearbyAreas: ['Elk Grove', 'Rancho Cordova', 'Citrus Heights', 'Folsom', 'Roseville', 'Woodland'],
    faqs: [
      {
        q: 'Do you serve Sacramento and the greater metro area?',
        a: "Yes. Sacramento is our northernmost major service city. We serve Sacramento proper, Elk Grove, Rancho Cordova, Citrus Heights, Folsom, and surrounding communities. Projects at this distance are typically scheduled in clusters to maximize crew efficiency, so lead times may be slightly longer than for Fresno-area projects.",
      },
      {
        q: 'What permits are required for a metal garage in Sacramento?',
        a: "Any structure over 120 sq ft in Sacramento city limits requires a building permit from the City of Sacramento Community Development Department. Sacramento County has its own process for unincorporated areas like Elk Grove and Rancho Cordova. Residential accessory structure permits typically take four to eight weeks. We provide all required engineer-stamped drawings.",
      },
      {
        q: 'Can I use a metal building as an ADU companion structure in Sacramento?',
        a: "A fully enclosed, insulated metal building can serve as an accessory dwelling unit (ADU) in Sacramento, but ADUs have specific requirements including electrical, plumbing, insulation (Title 24), and habitability standards beyond a standard metal building permit. We build the steel shell and can coordinate with licensed subcontractors for interior finish work.",
      },
    ],
  },
  {
    slug: 'hanford-ca',
    name: 'Hanford',
    stateCode: 'CA',
    county: 'Kings County',
    region: 'San Joaquin Valley',
    population: '60,000',
    climate:
      'extreme Central Valley heat regularly exceeding 108°F in summer, flat terrain with open wind exposure, and tule fog in winter',
    permitNotes:
      "City of Hanford uses Hanford Development Services. Rural Kings County properties go through the Kings County Department of Public Works and Planning. Kings County has active agricultural exemptions for certain structure types under California Health & Safety Code.",
    permitOffice: 'Kings County Department of Public Works and Planning',
    introText:
      "Hanford is the county seat of Kings County, one of the most intensively farmed counties in the United States. Cotton, dairy, and fresh vegetables dominate the landscape, and we build the structures that support those operations, from open-front cotton module sheds to dairy shade structures and residential carports for city homeowners.",
    highlights: [
      'Kings County agricultural hub',
      'Cotton and dairy structure specialists',
      'Active CA ag permit exemptions',
      'Near Naval Air Station Lemoore',
    ],
    nearbyAreas: ['Lemoore', 'Corcoran', 'Avenal', 'Fresno', 'Visalia'],
    faqs: [
      {
        q: 'Do you build in Hanford and Kings County?',
        a: "Yes. Kings County is a regular service area. We serve Hanford, Lemoore, Corcoran, Avenal, and the surrounding rural communities. Kings County has some of the highest per-acre agricultural productivity in the state, and we build structures that support those operations year-round.",
      },
      {
        q: "What's a typical cotton module storage shed look like?",
        a: "An open-front cotton module storage structure is typically 40 to 60 ft wide, 80 to 120 ft long, and at least 12 to 14 ft tall to accommodate cotton module handlers. The open front allows easy drive-through access. These often qualify for agricultural permit exemptions in Kings County.",
      },
      {
        q: 'Can you build shade structures for dairy pens in Kings County?',
        a: 'Yes. Dairy shade structures are an important product for Kings County operations. We build steel-framed shade structures in standard 40x200 sections (one lane width for freestall operations) or custom sizes. These are engineered for the wind loads at your specific site.',
      },
    ],
  },
  {
    slug: 'porterville-ca',
    name: 'Porterville',
    stateCode: 'CA',
    county: 'Tulare County',
    region: 'Southern Sierra Nevada Foothills',
    population: '60,000',
    climate:
      'hot valley summers moderated by Sierra proximity, and occasional snow in nearby foothill communities',
    permitNotes:
      "City of Porterville projects go through Porterville Development Services. The surrounding rural areas use the Tulare County Resource Management Agency. Foothill properties may have additional snow-load requirements at higher elevations.",
    permitOffice: 'Tulare County Resource Management Agency',
    introText:
      "Porterville sits at the base of the Sierra Nevada foothills in southern Tulare County, where steel holds up well to the valley heat, sun, and foothill weather. We build carports, garages, agricultural structures, and workshops throughout the Porterville area and the surrounding foothill communities.",
    highlights: [
      'Gateway to Sierra Nevada foothills',
      'Foothill snow-load engineering experience',
      'Citrus and avocado foothill orchard storage',
      'Rural ranch and hobby farm structures',
    ],
    nearbyAreas: ['Tulare', 'Visalia', 'Lindsay', 'Exeter', 'Terra Bella', 'Springville'],
    faqs: [
      {
        q: 'Do you serve Porterville and surrounding foothills?',
        a: "Yes. We serve Porterville, Lindsay, Exeter, Terra Bella, and the foothill communities including Springville and the area around Lake Success. Porterville is about 80 miles from our Fresno headquarters, within our regular service radius.",
      },
      {
        q: 'Do foothill properties near Porterville need snow-load engineering?',
        a: "Yes. Once you get up into the foothill communities above Porterville, elevation starts to matter, and we engineer the roof to the design snow load for your parcel. Your stamped drawings call out the exact load, and we adjust the framing and pitch so snow sheds cleanly.",
      },
      {
        q: 'What can I store in a metal building on a citrus or avocado orchard near Porterville?',
        a: "Orchard operations typically need covered storage for tractors, shakers/harvesters, spray equipment, irrigation supplies, and bins. A 40×60 or 40×80 open-front structure with 14 ft eave height covers most small to medium orchard equipment. For packed citrus, an enclosed insulated building is recommended.",
      },
    ],
  },
]

// Featured slugs marked so the directory can flag them.
const FEATURED_SLUGS = new Set(FEATURED_CITIES.map((c) => c.slug))
const featuredBySlug = new Map(FEATURED_CITIES.map((c) => [c.slug, c]))

// Enrich the hand-written featured cities with the real permit-office link and
// the jurisdiction's design loads (wind/snow), keeping their bespoke office name
// and permit notes (which is why the city object is spread last).
const enrichedFeatured = FEATURED_CITIES.map((c) => ({
  ...getPermitInfo({ name: c.name, county: c.county }),
  ...c,
}))

// Generate a landing-page record for every incorporated CA city, letting the
// hand-written featured cities take precedence. 482 cities across 58 counties.
const generatedCities = []
const caCountyPages = []
for (const [county, info] of Object.entries(COUNTIES)) {
  for (const name of info.cities) {
    const rec = generateCity({ name, county, region: info.region }, info.cities)
    if (featuredBySlug.has(rec.slug)) continue
    generatedCities.push(rec)
  }
  // County-level landing page (e.g. /locations/fresno-county-ca) for EVERY county,
  // including the few with no incorporated cities (Alpine, Mariposa, Trinity); the
  // county building department still permits their unincorporated parcels.
  caCountyPages.push(generateCity({ name: county, county, region: info.region }, info.cities, { isCounty: true }))
}

// ── NEVADA: every county + its cities/towns, plus a page per county ──────────
// All 17 NV counties (Carson City is a consolidated municipality, so it gets a
// single city page and no duplicate county page).
const nevadaCities = []
for (const [county, info] of Object.entries(NV_COUNTIES)) {
  for (const name of info.cities) {
    nevadaCities.push(generateNvCity({ name, county, region: info.region }, info.cities))
  }
  if (county.endsWith('County')) {
    // a county-level landing page (e.g. /locations/clark-county-nv)
    nevadaCities.push(generateNvCity({ name: county, county, region: info.region }, info.cities, { isCounty: true }))
  }
}

// ── ARIZONA: every county + its incorporated cities and major communities ────
// All 15 AZ counties. Each town links to its real permitting authority and carries
// the jurisdiction's design wind speed + elevation-driven ground snow load.
const arizonaCities = []
const azCountyPages = []
for (const [county, info] of Object.entries(AZ_COUNTIES)) {
  for (const name of info.cities) {
    arizonaCities.push(generateAzCity({ name, county, region: info.region }, info.cities))
  }
  // County-level landing page (e.g. /locations/maricopa-county-az).
  if (info.cities.length) {
    azCountyPages.push(generateAzCity({ name: county, county, region: info.region }, info.cities, { isCounty: true }))
  }
}

export const CITIES = [
  ...enrichedFeatured, ...generatedCities, ...caCountyPages,
  ...nevadaCities, ...arizonaCities, ...azCountyPages,
].sort((a, b) => a.name.localeCompare(b.name))

// Slugs of every county-level landing page that actually exists (CA + AZ here;
// NV county pages live inside nevadaCities). Used so the directory only links a
// county heading when its page exists.
const COUNTY_PAGE_SLUGS = new Set([
  ...caCountyPages.map((c) => c.slug),
  ...azCountyPages.map((c) => c.slug),
  ...nevadaCities.filter((c) => /\bCounty$/.test(c.name)).map((c) => c.slug),
])

const bySlug = new Map(CITIES.map((c) => [c.slug, c]))

export function getCityBySlug(slug) {
  return bySlug.get(slug) || null
}

export function isFeaturedCity(slug) {
  return FEATURED_SLUGS.has(slug)
}

export const FEATURED_CITY_LIST = FEATURED_CITIES.map((c) => ({
  slug: c.slug,
  name: c.name,
  county: c.county,
  region: c.region,
}))

// County names can repeat across states (e.g. Santa Cruz County in CA *and* AZ),
// so a county lookup must be scoped to a state to avoid mixing city lists.
export function getCitiesByCounty(county, stateCode) {
  return CITIES.filter(
    (c) => c.county === county && (!stateCode || c.stateCode === stateCode),
  ).sort((a, b) => a.name.localeCompare(b.name))
}

// Per-state city pools (county-level NV landing pages excluded from the directory
// since they duplicate the county heading).
const CA_POOL = [...enrichedFeatured, ...generatedCities]
const NV_POOL = nevadaCities.filter((c) => !/\bCounty$/.test(c.name))
const AZ_POOL = arizonaCities

function citiesIn(pool, county) {
  return pool.filter((c) => c.county === county).sort((a, b) => a.name.localeCompare(b.name))
}
// `countyPageSlug(county)` → the slug of that county's landing page (or null when
// the helper isn't provided / the page doesn't exist), so the directory can link
// the county heading.
function buildRegions(groups, pool, countyPageSlug) {
  return groups.map((g) => ({
    ...g,
    counties: g.counties.map((county) => {
      const cs = countyPageSlug?.(county) ?? null
      return {
        county,
        countySlug: cs && COUNTY_PAGE_SLUGS.has(cs) ? cs : null,
        cities: citiesIn(pool, county),
      }
    }),
  }))
}

// Nevada region groups (caGeo/azGeo pre-build these; nvGeo exposes the raw maps).
const NV_REGION_GROUPS = NV_REGION_ORDER.map((key) => ({
  key,
  label: NV_REGIONS[key].label,
  blurb: NV_REGIONS[key].blurb,
  counties: Object.keys(NV_COUNTIES)
    .filter((c) => NV_COUNTIES[c].region === key && NV_COUNTIES[c].cities.length > 0)
    .sort(),
}))

// Ordered directory structure for the Locations page, grouped by STATE:
// [{ state, stateCode, regions: [{ key, label, blurb, counties: [{ county, cities }] }] }]
// Per-state helper: county name → its county landing-page slug.
const caCountyPageSlug = (county) => `${caCountySlug(county)}-county-ca`
const azCountyPageSlug = (county) => `${azCountySlug(county)}-county-az`

export const STATE_DIRECTORY = [
  { state: 'Arizona',    stateCode: 'AZ', regions: buildRegions(AZ_REGION_GROUPS, AZ_POOL, azCountyPageSlug) },
  { state: 'California',  stateCode: 'CA', regions: buildRegions(REGION_GROUPS, CA_POOL, caCountyPageSlug) },
  { state: 'Nevada',     stateCode: 'NV', regions: buildRegions(NV_REGION_GROUPS, NV_POOL, nvCountySlug) },
]

// Back-compat: the CA-only flat directory (state-scoped so shared county names
// don't pull in AZ/NV cities).
export const LOCATION_DIRECTORY = buildRegions(REGION_GROUPS, CA_POOL, caCountyPageSlug)

export { regionLabel }
