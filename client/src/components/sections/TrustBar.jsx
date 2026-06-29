import { ShieldCheck, Wrench, Star, MapPin, Clock } from 'lucide-react'

const ITEMS = [
  { icon: <ShieldCheck size={16} />, text: 'CA LIC# 1096004' },
  { icon: <ShieldCheck size={16} />, text: '20-Year Rust-Through Warranty' },
  { icon: <Wrench size={16} />, text: 'Precision Craftsmanship' },
  { icon: <Star size={16} />, text: '5-Star Google Rated' },
  { icon: <MapPin size={16} />, text: 'Fresno & Northern California' },
  { icon: <Clock size={16} />, text: 'Response Within 1 Business Day' },
]

export default function TrustBar() {
  return (
    <section id="trust" className="bg-slate-900 border-y border-white/8">
      <div className="container py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-400">
              <span className="text-brand-light">{item.icon}</span>
              <span className="text-sm font-medium whitespace-nowrap">{item.text}</span>
              {i < ITEMS.length - 1 && (
                <span className="ml-8 hidden h-1 w-1 rounded-full bg-slate-700 sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
