import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import SectionHeader from '../ui/SectionHeader'
import FadeIn from '../ui/FadeIn'

const FAQS = [
  {
    q: 'Do I need a permit for a metal carport or garage?',
    a: 'It depends on your county and city, and pulling the permit is on you. The good news is we give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your local building department, fill it out, and submit it with our paperwork. We have done this plenty, so we know what they want and how to make it easy.',
  },
  {
    q: 'Can I customize the size and color?',
    a: 'Absolutely. Every structure we build is custom. You pick the dimensions, the roof style, the wall panels, where the doors and windows go, and the color. There is no catalog to choose from. We engineer each build to your exact specs.',
  },
  {
    q: 'What warranty comes with my building?',
    a: 'It depends on the build. Our 12-gauge frames carry a 20-year rust-through warranty, certified units come with a 5-year limited warranty, and every unit is covered against workmanship defects. Vertical-roof buildings with full foam closure also qualify for our leak warranty, and with the right anchoring you get the 90 MPH wind warranty. We put it all in writing and we stand behind it.',
  },
  {
    q: 'Do you offer financing?',
    a: 'Yes. We have partnered with HFS Financial so you do not have to cover everything up front. You can get pre-qualified in minutes with no hit to your credit score, and the rates and terms are built to fit your budget.',
  },
  {
    q: 'Who is responsible for site preparation?',
    a: 'Site prep, meaning grading, clearing, and foundation work, is usually the buyer\'s responsibility. We tell you exactly what your build needs and can coordinate with contractors you are already working with, so nothing slips through the cracks.',
  },
  {
    q: 'What areas do you serve?',
    a: 'We serve Fresno and all of Northern California, and most of our work is right here in the Central Valley and the towns around it. We cover a wide stretch of the state, so reach out and we will confirm we can get to your site.',
  },
  {
    q: 'How long does installation take?',
    a: 'Most residential carports and garages go up in one to three days once your site prep is done. Bigger agricultural buildings take a little longer. Either way, you get a clear timeline when we finalize your quote.',
  },
  {
    q: 'Are your buildings engineered for California requirements?',
    a: 'Yes. Every structure is engineered to meet California building codes and built to handle the wind, snow, and seismic conditions in your area. You get full engineering drawings stamped by licensed engineers.',
  },
]

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left focus:outline-none group"
        aria-expanded={isOpen}
      >
        <span className="font-sans text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
          {item.q}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-64 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm text-slate-500 leading-relaxed pr-6">{item.a}</p>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i)

  const half = Math.ceil(FAQS.length / 2)

  return (
    <section className="section bg-white" id="faq">
      <div className="container">
        <SectionHeader
          label="Common Questions"
          title="Frequently Asked Questions"
          description="Everything you need to know before starting your project."
        />

        <div className="grid gap-0 lg:grid-cols-2 lg:gap-12">
          <FadeIn>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-6 divide-y divide-slate-100">
              {FAQS.slice(0, half).map((item, i) => (
                <FAQItem
                  key={i}
                  item={item}
                  isOpen={openIndex === i}
                  onToggle={() => toggle(i)}
                />
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="mt-6 lg:mt-0 rounded-lg border border-slate-100 bg-slate-50/50 px-6 divide-y divide-slate-100">
              {FAQS.slice(half).map((item, i) => (
                <FAQItem
                  key={i + half}
                  item={item}
                  isOpen={openIndex === i + half}
                  onToggle={() => toggle(i + half)}
                />
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
