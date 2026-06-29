import ServiceDetailLayout from '../../components/ServiceDetailLayout'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

export default function MetalGaragesPage() {
  return (
    <ServiceDetailLayout
      seoTitle="Metal Garages in California, Arizona & Nevada"
      seoDescription="Custom metal garages built across California, Arizona, and Nevada. Fully enclosed steel garages for residential, commercial, and workshop use. Standard, A-frame, and triple-wide options. CA LIC# 1096004. Free quote."
      canonical="/services/metal-garages"
      heroImage={`${BASE}/2024/01/quality-metal-carport-custom-garage-400x284.jpg`}
      label="Metal Garages"
      h1={<>Custom Metal Garages<br />Built for the West</>}
      intro="When you want your cars, tools, and projects locked up, dry, and out of sight, an open carport will not cut it. A fully enclosed steel garage will. We build them to your exact dimensions with the doors, windows, and roof style you need, whether it is a home garage, a workshop, or a commercial space, all backed by warranties we put in writing."
      features={[
        'Single, double, and triple-wide floor plans',
        'Standard, A-frame horizontal, and A-frame vertical roofs',
        'Walk-in personnel doors',
        'Roll-up garage doors (standard and oversized)',
        'Window options and placement',
        'Lean-to additions available',
        '29-gauge steel wall and roof panels',
        '12 and 14 gauge structural framing',
        'Moisture barrier and fiberglass insulation options',
        'Interior height up to 16+ ft',
        'Engineering drawings for permit submittal',
        '20-year rust-through warranty (12-gauge frames)',
      ]}
      specs={[
        { label: 'Starting width', value: '12 ft' },
        { label: 'Popular widths', value: '20 ft, 24 ft, 30 ft, 40 ft' },
        { label: 'Wall heights', value: '8 ft, 10 ft, 12 ft, 14 ft' },
        { label: 'Panel material', value: '29-gauge steel' },
        { label: 'Frame', value: '12 or 14 gauge square tubing' },
        { label: 'Roof styles', value: 'Standard, A-frame H, A-frame V' },
        { label: 'Warranty', value: '20-yr rust-through (12-ga)' },
        { label: 'Install time', value: '1 to 3 days typical' },
      ]}
      gallery={[
        { url: `${BASE}/2024/01/quality-metal-carport-custom-garage-400x284.jpg`, alt: 'Custom enclosed metal garage' },
        { url: `${BASE}/2024/01/Triple-wide-metal-garage-1.png`, alt: 'Triple-wide metal garage with roll-up doors' },
        { url: `${BASE}/2024/01/Standard-garage.png`, alt: 'Standard roof metal garage' },
        { url: `${BASE}/2023/11/a-frame-garage.webp`, alt: 'A-frame metal garage with vertical roof' },
        { url: `${BASE}/2024/01/metal-garage-with-a-leanto.png`, alt: 'Metal garage with lean-to addition' },
        { url: `${BASE}/2023/07/workshop-400x284.jpg`, alt: 'Metal workshop garage for commercial use' },
        { url: `${BASE}/2024/01/a-frame-horizontal-roof-garage.png`, alt: 'A-frame horizontal roof garage' },
        { url: `${BASE}/2024/01/a-frame-verticle-roof-garage.png`, alt: 'A-frame vertical roof garage' },
      ]}
      faqs={[
        {
          q: 'How much does a metal garage cost?',
          a: 'Metal garage prices depend on size, roof style, enclosure, and options. A basic 20x20 single-car garage typically starts around $6,000 to $9,000 installed. A 30x40 workshop garage runs $15,000 to $25,000 and up. Reach out for a free, itemized quote.',
        },
        {
          q: 'What is the difference between a standard roof and an A-frame vertical roof on a garage?',
          a: 'A standard roof has horizontal panels and is the most budget-friendly option. An A-frame vertical roof runs the panels vertically. That is the strongest setup, sheds water and debris the best, and is the one we recommend out West, where rain, debris, and high winds are all part of the deal. For any enclosed garage, go vertical.',
        },
        {
          q: 'Can I add electricity and insulation to a metal garage?',
          a: 'Yes. We do not run the electrical ourselves, so you will need a licensed electrician for that, but we build with it in mind and leave conduit access points and framing for sub-panels where you need them. For insulation, our standard moisture barrier is a lightweight bubble film that controls condensation. If you want real temperature control, step up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. Keep in mind the thicker you go, the more the panels can bubble or compress slightly around the screw points.',
        },
        {
          q: 'How do metal garages compare to wood-frame garages?',
          a: 'Metal garages go up faster, ask for less upkeep, shrug off termites and rot, and usually cost less than a comparable wood-frame build. You also skip the warping, splitting, and rot that wood deals with over the years, so the structure stays true a lot longer.',
        },
        {
          q: 'Do I need a permit to build a metal garage?',
          a: 'Yes, most enclosed metal garages need a building permit. We provide stamped engineering drawings covering the structural loads, and you submit those to your local building department. Permit fees and requirements vary by jurisdiction.',
        },
      ]}
      relatedServices={[
        { label: 'Metal Carports', to: '/services/metal-carports' },
        { label: 'Agricultural Buildings', to: '/services/agricultural-buildings' },
        { label: 'RV Covers', to: '/services/rv-covers' },
      ]}
      schemas={[{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Metal Garages',
        provider: { '@type': 'LocalBusiness', name: 'Quality Metal Carports Inc.', telephone: '+15597554900' },
        areaServed: 'California, Arizona, and Nevada',
        description: 'Custom metal garage installation across California, Arizona, and Nevada. Residential, commercial, and workshop applications.',
      }]}
    />
  )
}
