import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'

// Fixed bottom-right entry point to the admin/owner demo dashboard.
export default function DemoWidget() {
  return (
    <Link
      to="/admin"
      aria-label="Open the admin demo dashboard"
      title="Admin demo — leads, quotes, designs, blog, reviews & pages"
      className="group fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/95 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-black/40 backdrop-blur transition-all hover:border-brand/50 hover:bg-slate-800"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
        <LayoutDashboard size={12} />
      </span>
      <span className="hidden sm:inline">Admin Demo</span>
    </Link>
  )
}
