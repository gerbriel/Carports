import ServiceDetailLayout from '../../components/ServiceDetailLayout'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

export default function AgriculturalPage() {
  return (
    <ServiceDetailLayout
      seoTitle="Agricultural Buildings & Metal Barns in California, Arizona & Nevada"
      seoDescription="Custom agricultural buildings, metal barns, and farm storage structures across California, Arizona, and Nevada. Hay barns, equipment storage, livestock facilities. Clear-span up to 150 ft. CA LIC# 1096004."
      canonical="/services/agricultural-buildings"
      heroImage={`${BASE}/2025/11/barn-in-mountains.jpg`}
      label="Agricultural Buildings"
      h1={<>Agricultural Buildings<br />&amp; Metal Barns for the West</>}
      intro="Equipment left in the open rusts, hay left uncovered spoils, and every breakdown costs you a day you do not have. The Western sun and weather are hard on anything without a roof over it. We design and install metal barns, hay storage, equipment sheds, and big clear-span facilities across California, Arizona, and Nevada, every one engineered to your local code and sized around how you actually farm."
      features={[
        'Clear-span designs up to 150+ ft wide',
        'Hay, grain, and bulk storage barns',
        'Equipment and implement storage',
        'Livestock and poultry barn designs',
        'Large sliding doors and roll-up entries',
        'Skylights and ventilation panels',
        'Lean-to additions for feed or equipment',
        'Concrete stem wall or anchor foundation',
        'Agricultural-grade steel panels',
        'Open-sided, partial, or fully enclosed',
        'Local agricultural building compliance',
        '20-year rust-through warranty (12-gauge frames)',
      ]}
      specs={[
        { label: 'Clear-span width', value: 'Up to 150 ft+' },
        { label: 'Wall heights', value: '10 ft to 20 ft+' },
        { label: 'Popular sizes', value: '40x60, 50x100, 60x120+' },
        { label: 'Door options', value: 'Sliding, roll-up, swing' },
        { label: 'Roof styles', value: 'Vertical (standard for ag)' },
        { label: 'Warranty', value: '20-yr rust-through (12-ga)' },
        { label: 'Permit docs', value: 'Stamped engineering included' },
      ]}
      gallery={[
        { url: `${BASE}/2025/11/barn-in-mountains.jpg`, alt: 'Metal agricultural barn built in the mountains' },
        { url: `${BASE}/2025/11/green-barn.jpg`, alt: 'Custom green metal barn' },
        { url: `${BASE}/2025/11/open-carport.jpg`, alt: 'Open-sided agricultural structure for equipment storage' },
        { url: `${BASE}/2025/11/metal-sheets.jpg`, alt: 'Agricultural-grade steel panels for barn construction' },
      ]}
      faqs={[
        {
          q: 'How much does an agricultural metal building cost?',
          a: 'Agricultural building costs depend on size and configuration. A 40x60 equipment barn typically runs $25,000 to $45,000 installed. A 60x120 hay barn with large sliding doors runs $50,000 to $90,000 and up. Reach out for a quote built around your operation and site.',
        },
        {
          q: 'What permits are required for agricultural buildings?',
          a: 'Most agricultural buildings over 200 sq ft need a building permit. Ag-zoned properties may qualify for exemptions on certain structure types and sizes, though that varies by jurisdiction. We provide the stamped engineering drawings, and you will want to confirm the exact permit requirements with your county.',
        },
        {
          q: 'Can you build a clear-span hay barn large enough for big equipment?',
          a: 'Yes. We build clear-span agricultural structures up to 150 ft wide and beyond, wide enough for large combines, tractors, and bulk hay storage. Clear-span means no interior support columns getting in the way of your storage or your equipment.',
        },
        {
          q: 'What roof style is best for an agricultural building?',
          a: 'For agricultural use, we recommend an A-frame vertical roof. The vertical panels shed debris, moisture, and dust better than horizontal panels, which matters a lot for buildings sitting right next to open fields. The vertical framing is stronger, too.',
        },
        {
          q: 'Do you build livestock facilities such as horse barns or poultry houses?',
          a: 'Yes. We design metal barn structures for horses, cattle, poultry, and other livestock. We work with you on layout, ventilation, door placement, and panel options to meet the specific needs of your animals. Full enclosures, partial walls, or open-sided designs are all available.',
        },
      ]}
      relatedServices={[
        { label: 'Metal Garages', to: '/services/metal-garages' },
        { label: 'Metal Carports', to: '/services/metal-carports' },
        { label: 'Boat Storage', to: '/services/boat-storage' },
      ]}
      schemas={[{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Agricultural Buildings and Metal Barns',
        provider: { '@type': 'LocalBusiness', name: 'Quality Metal Carports Inc.', telephone: '+15597554900' },
        areaServed: 'California, Arizona, and Nevada',
        description: 'Custom agricultural buildings, metal barns, and farm storage structures across California, Arizona, and Nevada.',
      }]}
    />
  )
}
