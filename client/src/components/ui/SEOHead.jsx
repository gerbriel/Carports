import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Quality Metal Carports Inc.'
const DEFAULT_DESCRIPTION =
  'Custom metal carports, garages, RV covers, and agricultural buildings in Fresno and Northern California. CA LIC# 1096004. 20-year rust-through warranty. Free quotes.'
const BASE_URL = 'https://qualitymetalcarportsca.com'

const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${BASE_URL}/#business`,
  name: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  url: BASE_URL,
  telephone: '+15597554900',
  email: 'Info@QualityMetalCarportsCA.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '9191 W Whitesbridge Ave',
    addressLocality: 'Fresno',
    addressRegion: 'CA',
    postalCode: '93706',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 36.7378,
    longitude: -119.7871,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '17:00',
    },
  ],
  areaServed: [
    'Fresno', 'Clovis', 'Madera', 'Visalia', 'Tulare', 'Merced',
    'Modesto', 'Stockton', 'Sacramento', 'Northern California',
  ],
  priceRange: '$$',
  hasCredential: 'CA General Contractor LIC# 1096004',
  sameAs: [
    'https://www.facebook.com/qualitymetalcarports',
    'https://www.instagram.com/qualitymetalcarports',
  ],
}

export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image,
  schemas = [],
  breadcrumbs,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Fresno & Northern California`
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : BASE_URL

  const breadcrumbSchema = breadcrumbs
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          ...breadcrumbs.map((b, i) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: b.label,
            item: `${BASE_URL}${b.path}`,
          })),
        ],
      }
    : null

  const allSchemas = [LOCAL_BUSINESS_SCHEMA, ...schemas, breadcrumbSchema].filter(Boolean)

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* JSON-LD structured data */}
      {allSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}
