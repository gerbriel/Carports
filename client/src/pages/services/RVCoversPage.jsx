import ServiceDetailLayout from '../../components/ServiceDetailLayout'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

export default function RVCoversPage() {
  return (
    <ServiceDetailLayout
      seoTitle="RV Covers & RV Carports in California, Arizona & Nevada"
      seoDescription="Custom RV covers and RV carports installed across California, Arizona, and Nevada. Class A, B, and C motorhome clearances. Up to 60 ft long. CA LIC# 1096004. Free quote: 559-755-4900."
      canonical="/services/rv-covers"
      heroImage={`${BASE}/2026/01/strong-carport.jpg`}
      label="RV Covers"
      h1={<>RV Covers &amp; RV Carports<br />Built for the West</>}
      intro="Your RV cost more than most cars, and every day it sits uncovered the Western sun is hard at work cracking the seals, fading the paint, and drying out the roof. A purpose-built RV cover puts a stop to that. We size the height, width, and length to your exact coach or trailer, then install it on your property anywhere across California, Arizona, and Nevada."
      features={[
        'Class A, B, and C motorhome clearances',
        'Up to 60 ft in length, custom longer',
        'Leg heights from 12 ft to 20+ ft',
        'Width options from 16 ft to 40+ ft',
        'Open sides, partial walls, or fully enclosed',
        'Vertical roof (best for debris protection)',
        'Sliding or roll-up end panel access',
        'Side entry pass doors available',
        '29-gauge tuff-rib steel panels',
        'UV-resistant panel coatings',
        'Concrete anchor systems',
        '20-year rust-through warranty (12-gauge frames)',
      ]}
      specs={[
        { label: 'Typical RV width', value: '14 to 16 ft plus clearance' },
        { label: 'Typical RV height (Class A)', value: '13 to 14 ft' },
        { label: 'Cover height options', value: '14 ft, 16 ft, 18 ft, 20 ft+' },
        { label: 'Length options', value: '20 ft to 60 ft+ (custom)' },
        { label: 'Roof style', value: 'Vertical recommended' },
        { label: 'Warranty', value: '20-yr rust-through (12-ga)' },
        { label: 'Install time', value: '1 to 2 days typical' },
      ]}
      gallery={[
        { url: `${BASE}/2026/01/strong-carport.jpg`, alt: 'Metal carport structure suitable for RV storage' },
        { url: `${BASE}/2025/10/carports-california.jpg`, alt: 'Large metal structure for RV parking' },
        { url: `${BASE}/2025/11/construction-of-metal-carpor.jpg`, alt: 'RV cover being installed' },
        { url: `${BASE}/2025/11/carport-panels.jpg`, alt: 'Steel panels used in RV cover construction' },
      ]}
      faqs={[
        {
          q: 'What size RV cover do I need for a Class A motorhome?',
          a: 'A Class A motorhome is usually 35 to 45 ft long and 13 to 14 ft tall. We recommend a cover at least 45 ft long with a 16 ft leg height for comfortable clearance. Plan on at least 16 ft of width so you have room on the sides for slide-outs and easy in-and-out.',
        },
        {
          q: 'Can I enclose my RV cover to fully protect my motorhome?',
          a: 'Yes. We can add partial or full end walls, side walls, and lockable access doors to any RV cover. A fully enclosed steel RV garage provides maximum protection and security for your vehicle year-round.',
        },
        {
          q: 'How much does an RV carport cost?',
          a: 'An open RV carport typically runs from $4,000 to $8,000 depending on length, height, and width. Fully enclosed RV garages cost more. Reach out for a free quote based on your actual motorhome or trailer dimensions.',
        },
        {
          q: 'Will an RV cover protect against the sun and heat?',
          a: 'Yes. UV exposure is one of the leading causes of RV roof and seal degradation. A steel RV cover blocks direct sunlight, dramatically reducing interior heat buildup and extending the life of your roof, seals, and paint. That matters even more through a brutal Western summer.',
        },
        {
          q: 'Do I need a permit for an RV cover?',
          a: 'Most RV carports and enclosed RV garages require a building permit, particularly structures over 200 sq ft. We supply full engineering drawings for your permit application. Requirements vary by city and county.',
        },
      ]}
      relatedServices={[
        { label: 'Metal Carports', to: '/services/metal-carports' },
        { label: 'Boat Storage', to: '/services/boat-storage' },
        { label: 'Metal Garages', to: '/services/metal-garages' },
      ]}
      schemas={[{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'RV Covers and RV Carports',
        provider: { '@type': 'LocalBusiness', name: 'Quality Metal Carports Inc.', telephone: '+15597554900' },
        areaServed: 'California, Arizona, and Nevada',
        description: 'Custom RV covers and carports installed across California, Arizona, and Nevada for Class A, B, and C motorhomes.',
      }]}
    />
  )
}
