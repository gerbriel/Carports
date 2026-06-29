import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BuilderCanvas from '../components/builder/BuilderCanvas'
import BuilderPanel, { PartsSidebar, VehiclesSidebar } from '../components/builder/BuilderPanel'
import BuilderToolbar from '../components/builder/BuilderToolbar'
import { useBuilderStore } from '../store/builderStore'

export default function BuilderPage() {
  const isDark = useBuilderStore((s) => s.isDark)
  return (
    <div className={`fixed inset-0 z-[200] flex flex-col bg-slate-950${isDark ? '' : ' light-theme'}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-white/8 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={15} /> Back to site
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-brand flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="font-display text-base font-bold text-white tracking-wide hidden sm:block">
            3D Building Configurator
          </span>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Config panel */}
        <div className="w-72 shrink-0 border-r border-white/8 bg-slate-950 overflow-hidden flex flex-col">
          <BuilderPanel />
        </div>

        {/* Parts / Components sidebar — opens when the "Parts" toggle is on */}
        <PartsSidebar />

        {/* Vehicles sidebar — opens when the "Vehicles" toggle is on */}
        <VehiclesSidebar />

        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <BuilderCanvas />

          {/* Mobile overlay */}
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 sm:hidden">
            <p className="text-slate-400 text-sm text-center px-8">
              The 3D configurator works best on a larger screen.
            </p>
            <Link to="/contact" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">
              Request a Quote Instead
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <BuilderToolbar />
    </div>
  )
}
