import { MessageSquare, PenTool, FileText, HardHat } from 'lucide-react'
import SectionHeader from '../ui/SectionHeader'
import FadeIn from '../ui/FadeIn'

const STEPS = [
  {
    icon: <MessageSquare size={22} />,
    num: '01',
    title: 'Get a Quote',
    description:
      'Tell us what you have in mind, your sizes, how you plan to use it, and a little about your site. You get back a clear, itemized quote with no hidden fees and no surprises.',
  },
  {
    icon: <PenTool size={22} />,
    num: '02',
    title: 'Deposit & Design',
    description:
      'Happy with the numbers? A deposit locks it in. We finalize your custom plans and take care of the engineering drawings needed for approval.',
  },
  {
    icon: <FileText size={22} />,
    num: '03',
    title: 'Permits & Prep',
    description:
      'We give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your local building department, fill it out, and submit it with our paperwork. You also get your pad level and ready, and we tell you exactly what that takes.',
  },
  {
    icon: <HardHat size={22} />,
    num: '04',
    title: 'Installation',
    description:
      'Once your site is set, our crew shows up when we say we will and builds it right. We walk you through the finished structure, clean up after ourselves, and you settle up when the work is done.',
  },
]

export default function Process() {
  return (
    <section className="section bg-slate-50" id="process">
      <div className="container">
        <SectionHeader
          label="How It Works"
          title="From Quote to Completion"
          description="An honest, step-by-step process from the first call to the last fastener, so you always know exactly where your project stands."
        />

        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="absolute top-8 left-0 right-0 hidden h-px bg-slate-200 lg:block" style={{ top: '28px' }} />

          <div className="grid gap-8 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <FadeIn key={step.num} delay={i * 100}>
                <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                  {/* Step icon */}
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-sm mb-6 lg:mb-5">
                    <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand">
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                    <span className="text-slate-600">{step.icon}</span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
