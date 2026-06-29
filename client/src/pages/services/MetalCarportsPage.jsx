import ServiceDetailLayout from '../../components/ServiceDetailLayout'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

export default function MetalCarportsPage() {
  return (
    <ServiceDetailLayout
      seoTitle="Metal Carports in California, Arizona & Nevada"
      seoDescription="Custom metal carports installed across California, Arizona, and Nevada. Single, double, and triple-wide configurations. Vertical and A-frame roof styles. CA LIC# 1096004. 20-year rust-through warranty. Free quote: 559-755-4900."
      canonical="/services/metal-carports"
      heroImage={`${BASE}/2026/01/strong-carport.jpg`}
      label="Metal Carports"
      h1={<>Custom Metal Carports<br />Built for the West</>}
      intro="Leaving your car or truck out in the open means faded paint, a blistering hot cab in summer, and wear you never signed up for. A metal carport puts a stop to all of it. We design and install single, double, and triple-wide carports across California, Arizona, and Nevada, every one built for tough Western weather and backed by written warranties from a fully licensed contractor."
      features={[
        'Single, double, and triple-wide configurations',
        'Vertical, horizontal, and A-frame roof styles',
        'Custom widths from 12 ft to 60+ ft',
        'Heights from 6 ft to 16 ft clearance',
        'Open sides, partial walls, or fully enclosed',
        'Choice of 29-gauge tuff-rib steel panels',
        '12-gauge and 14-gauge structural tubing',
        'Local wind and snow load engineering',
        'Concrete anchor systems included',
        'Choice of 15+ color combinations',
        'Engineering drawings for permit submittal',
        '20-year rust-through warranty (12-gauge frames)',
      ]}
      specs={[
        { label: 'Minimum width', value: '12 ft' },
        { label: 'Maximum width', value: '60+ ft (custom)' },
        { label: 'Standard leg heights', value: '6 ft, 8 ft, 10 ft, 12 ft' },
        { label: 'Panel gauge', value: '29-gauge tuff-rib steel' },
        { label: 'Frame gauge', value: '12 or 14 gauge square tubing' },
        { label: 'Warranty', value: '20-yr rust-through (12-ga)' },
        { label: 'Installation timeline', value: '1 to 2 days typical' },
        { label: 'License', value: 'CA LIC# 1096004' },
      ]}
      gallery={[
        { url: `${BASE}/2026/01/strong-carport.jpg`, alt: 'Metal carport with a vertical roof' },
        { url: `${BASE}/2025/10/carports-california.jpg`, alt: 'Custom metal carport built by Quality Metal Carports Inc' },
        { url: `${BASE}/2025/11/carports-in-the-woods.jpg`, alt: 'Custom metal carport structures' },
        { url: `${BASE}/2025/11/construction-of-metal-carpor.jpg`, alt: 'Metal carport installation in progress' },
        { url: `${BASE}/2025/11/metal-buildings-in-ca.jpg`, alt: 'Steel framing materials for metal carport construction' },
      ]}
      faqs={[
        {
          q: 'How much does a metal carport cost?',
          a: 'Metal carport prices typically start around $2,500 to $4,000 for a basic single-wide open carport and go up from there depending on size, roof style, enclosure, and engineering. Reach out for a free, itemized quote built around your project.',
        },
        {
          q: 'Do I need a permit for a metal carport?',
          a: 'In most areas, metal carports over a certain size (typically 200 sq ft) need a building permit, and the exact rules vary by city and county. We hand you the stamped engineering drawings for your application. Pulling the permit itself is on you, but we make that part as painless as we can.',
        },
        {
          q: 'What roof styles are available for metal carports?',
          a: 'We offer three roof styles: Standard (horizontal panels, most economical), A-frame horizontal (boxed eave, improved water runoff), and A-frame vertical (panels run vertically, best for snow and rain, strongest option). Vertical roof is the one we recommend for tough Western weather.',
        },
        {
          q: 'How wide can a metal carport be?',
          a: 'Our metal carports start at 12 ft wide and can be built to 60 ft or wider for commercial or agricultural applications. Triple-wide carports (30 ft) are a popular choice for multiple vehicles or equipment storage.',
        },
        {
          q: 'How long does metal carport installation take?',
          a: 'Most residential metal carports are installed in one to two days once site preparation is complete and the concrete pad or anchors are ready. Larger structures may take additional days.',
        },
        {
          q: 'What is the warranty on your metal carports?',
          a: 'Coverage depends on the build. Our 12-gauge frames carry a 20-year rust-through warranty, certified units add a 5-year limited warranty, and every carport is covered against workmanship defects. We put it in writing, and because we have been doing this for years, we will still be here if you ever need us.',
        },
      ]}
      relatedServices={[
        { label: 'Metal Garages', to: '/services/metal-garages' },
        { label: 'RV Covers', to: '/services/rv-covers' },
        { label: 'Agricultural Buildings', to: '/services/agricultural-buildings' },
      ]}
      schemas={[{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Metal Carports',
        provider: { '@type': 'LocalBusiness', name: 'Quality Metal Carports Inc.', telephone: '+15597554900' },
        areaServed: 'California, Arizona, and Nevada',
        description: 'Custom metal carport installation across California, Arizona, and Nevada. Single, double, and triple-wide configurations available.',
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Metal Carport Options',
          itemListElement: [
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Single-wide metal carport' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Double-wide metal carport' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Triple-wide metal carport' } },
            { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'RV carport' } },
          ],
        },
      }]}
    />
  )
}
