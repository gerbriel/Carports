import ServiceDetailLayout from '../../components/ServiceDetailLayout'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

export default function BoatStoragePage() {
  return (
    <ServiceDetailLayout
      seoTitle="Boat Storage Structures & Covered Boat Shelters in California, Arizona & Nevada"
      seoDescription="Custom boat storage structures and covered shelters installed across California, Arizona, and Nevada. Wide clear-span entries, tall clearances, corrosion-resistant finishes. CA LIC# 1096004. Free quote."
      canonical="/services/boat-storage"
      heroImage={`${BASE}/2026/01/strong-carport.jpg`}
      label="Boat Storage"
      h1={<>Custom Boat Storage<br />Structures for the West</>}
      intro="You did not buy your boat to watch the sun fade the gelcoat and crack the upholstery between trips to the water. A purpose-built steel structure keeps all of that off it. We build open boat covers and fully enclosed boat garages across California, Arizona, and Nevada, with the clearances and entry widths your particular boat needs."
      features={[
        'Wide clear-span entries for easy launch access',
        'Custom lengths for any boat from 20 ft to 50+ ft',
        'Height clearance for tall outboards and hardtops',
        'Open, partially walled, or fully enclosed',
        'Roll-up and swing-style entry doors',
        'Corrosion-resistant hardware and panel finishes',
        'Ventilated panel designs for airflow',
        '29-gauge tuff-rib steel panels',
        'Concrete anchor systems',
        'Side pass doors for easy interior access',
        '20-year rust-through warranty (12-gauge frames)',
      ]}
      specs={[
        { label: 'Entry widths', value: '14 ft to 30+ ft' },
        { label: 'Clearance heights', value: '10 ft to 18 ft' },
        { label: 'Lengths', value: '20 ft to 60 ft+ (custom)' },
        { label: 'Panel material', value: '29-gauge steel' },
        { label: 'Hardware', value: 'Corrosion-resistant coated' },
        { label: 'Warranty', value: '20-yr rust-through (12-ga)' },
        { label: 'Install time', value: '1 to 2 days typical' },
      ]}
      gallery={[
        { url: `${BASE}/2026/01/strong-carport.jpg`, alt: 'Open metal structure for boat storage' },
        { url: `${BASE}/2025/10/carports-california.jpg`, alt: 'Large open-sided metal shelter for boat storage' },
        { url: `${BASE}/2025/11/metal-buildings-in-ca.jpg`, alt: 'Metal framing for boat storage construction' },
        { url: `${BASE}/2025/11/carport-panels.jpg`, alt: 'Steel panels used in boat storage structure construction' },
      ]}
      faqs={[
        {
          q: 'What size boat storage structure do I need?',
          a: 'Size depends on your vessel. For a 24 ft bass boat, a 16x30 open cover is typically sufficient. A 35 ft cabin cruiser may need a 20x40 enclosed garage with 14 ft clearance. We size every structure based on your actual boat dimensions, including trailers.',
        },
        {
          q: 'Should I get an open boat cover or a fully enclosed boat garage?',
          a: 'An open or partially walled cover is the most budget-friendly choice and does a great job keeping UV, rain, and debris off your boat. A fully enclosed metal boat garage gives you maximum security and protection, which is the way to go if you are storing electronics, outboards, or a high-value boat year-round.',
        },
        {
          q: 'How do I protect my boat from the sun with a metal structure?',
          a: 'Even an open metal carport structure dramatically reduces UV exposure, which is the leading cause of gel coat fading, upholstery degradation, and vinyl cracking. A simple open boat cover in a hot, sunny climate can extend the life of your boat\'s finish by years.',
        },
        {
          q: 'Can you build a boat storage structure on my existing concrete slab?',
          a: 'In most cases yes. We can anchor our steel frame structures to existing concrete slabs using Simpson-style anchor systems. We\'ll assess your slab condition and thickness before installation. New pads can also be installed by the site prep contractor if needed.',
        },
        {
          q: 'How much does a boat storage structure cost?',
          a: 'A basic open boat cover for a small-to-medium boat typically starts around $3,500 to $5,500 installed. Fully enclosed boat garages run $8,000 to $18,000 and up depending on size and options. Reach out for a free quote based on your boat\'s measurements.',
        },
      ]}
      relatedServices={[
        { label: 'RV Covers', to: '/services/rv-covers' },
        { label: 'Metal Carports', to: '/services/metal-carports' },
        { label: 'Metal Garages', to: '/services/metal-garages' },
      ]}
      schemas={[{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Boat Storage Structures',
        provider: { '@type': 'LocalBusiness', name: 'Quality Metal Carports Inc.', telephone: '+15597554900' },
        areaServed: 'California, Arizona, and Nevada',
        description: 'Custom boat storage covers and enclosed boat garages installed across California, Arizona, and Nevada.',
      }]}
    />
  )
}
