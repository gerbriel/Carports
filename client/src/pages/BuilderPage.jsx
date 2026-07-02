import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal, X } from 'lucide-react'
import BuilderCanvas from '../components/builder/BuilderCanvas'
import BuilderPanel, { PartsSidebar, VehiclesSidebar } from '../components/builder/BuilderPanel'
import BuilderToolbar from '../components/builder/BuilderToolbar'
import { useBuilderStore } from '../store/builderStore'
import { activeBuilderOrg, decodeConfig } from '../data/builderLink'

export default function BuilderPage() {
  const isDark = useBuilderStore((s) => s.isDark)
  const [panelOpen, setPanelOpen] = useState(false)
  // Whose builder this is (embed key in URL, or a logged-in dealer) → branding.
  const { org, embed } = activeBuilderOrg()
  const dealerBrand = org?.kind === 'dealer'

  // Restore a shared design from a ?d= link on first mount.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('d')
    if (!d) return
    const cfg = decodeConfig(d)
    if (cfg) useBuilderStore.setState(cfg)
  }, [])

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col bg-slate-950${isDark ? '' : ' light-theme'}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-900 border-b border-white/8 shrink-0">
        {embed ? (
          <span className="shrink-0" />
        ) : (
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Back to site</span>
          </Link>
        )}

        <div className="flex items-center gap-3 min-w-0">
          {dealerBrand && org.logoDataUrl ? (
            <img src={org.logoDataUrl} alt={org.name} className="h-7 w-auto max-w-[140px] rounded bg-white object-contain shrink-0" />
          ) : (
            <div className="h-6 w-6 rounded bg-brand flex items-center justify-center shrink-0" style={dealerBrand ? { background: org.brandColor } : undefined}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}
          {dealerBrand ? (
            // Dealer logo is co-branding — always keep Quality Metal as the named manufacturer.
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-sm sm:text-base font-bold text-white truncate">{org.name}</span>
              <span className="block text-[10px] text-slate-400 truncate">Manufactured by Quality Metal Carports</span>
            </div>
          ) : (
            <span className="font-display text-base font-bold text-white tracking-wide hidden sm:block truncate">3D Building Configurator</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile: open the config drawer */}
          <button
            onClick={() => setPanelOpen(true)}
            className="lg:hidden flex items-center gap-1.5 rounded border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 transition-colors"
          >
            <SlidersHorizontal size={14} /> Options
          </button>
          <div className="hidden lg:block text-xs text-slate-500">
            Drag to rotate · Scroll to zoom
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 min-h-0">
        {/* Backdrop behind the mobile config drawer */}
        {panelOpen && (
          <div
            className="absolute inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* Config panel — static sidebar on desktop, slide-in drawer on mobile */}
        <div
          className={`absolute lg:relative inset-y-0 left-0 z-40 flex w-[86%] max-w-xs lg:w-72 lg:max-w-none shrink-0 flex-col border-r border-white/8 bg-slate-950 overflow-hidden transition-transform duration-300 ${
            panelOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Configure</span>
            <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close options">
              <X size={18} />
            </button>
          </div>
          <BuilderPanel />
        </div>

        {/* Parts / Components sidebar — opens when the "Parts" toggle is on */}
        <PartsSidebar />

        {/* Vehicles sidebar — opens when the "Vehicles" toggle is on */}
        <VehiclesSidebar />

        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <BuilderCanvas />
        </div>
      </div>

      {/* Bottom toolbar */}
      <BuilderToolbar />
    </div>
  )
}
