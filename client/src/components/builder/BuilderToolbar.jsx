import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Camera, RotateCcw, Ruler, Grid3x3, Tag, Car, Share2, Check, Send, Save } from 'lucide-react'
import { useBuilderStore } from '../../store/builderStore'

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
import { calculatePrice } from '../../data/pricing'
import { BUILDING_TYPES } from '../../data/builderData'
import { addDesign, addLead, addQuote, updateDesign } from '../../data/adminData'
import { activeBuilderOrg, encodeConfig, configSnapshot } from '../../data/builderLink'

export default function BuilderToolbar() {
  const store       = useBuilderStore()
  const pricing     = calculatePrice(store)
  const isWireframe = store.viewMode === 'wireframe'

  // Whose builder is this? An ?org= embed key (dealer's site) or a logged-in
  // dealer makes this "dealer mode": leads are captured to that dealership.
  const ctx = activeBuilderOrg()
  const dealerMode = ctx.org?.kind === 'dealer'
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  // Save (or re-save) the current 3D model so it can be reopened & edited later.
  // A `?design=<id>` in the URL means we're editing an existing one → update it.
  function saveDesign() {
    const buildConfig = configSnapshot(store)
    const payload = {
      name: buildingLabel,
      config: `${store.width}×${store.length}×${store.height}ft – ${buildingLabel}`,
      price: pricing.subtotal, width: store.width, length: store.length, height: store.height,
      roofStyle: store.roofStyle, buildConfig, orgId: ctx.org.id, salespersonId: ctx.salespersonId,
    }
    const params = new URLSearchParams(window.location.search)
    const designId = params.get('design')
    if (designId) {
      updateDesign(designId, payload)
    } else {
      const rec = addDesign(payload)
      params.set('design', rec.id)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    }
    setSaved(true); setTimeout(() => setSaved(false), 1800)
  }

  function shareLink() {
    const enc = encodeConfig(store)
    const base = ctx.embed
      ? `${window.location.origin}/embed/builder?org=${ctx.org.embedKey}&d=${enc}`
      : `${window.location.origin}/builder?d=${enc}`
    try { navigator.clipboard?.writeText(base) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  function sendToManufacturer() {
    const config = `${store.width}×${store.length}×${store.height}ft – ${buildingLabel}`
    const buildConfig = configSnapshot(store)
    const quote = {
      orgId: ctx.org.id, salespersonId: ctx.salespersonId, assignee: ctx.salespersonId,
      name: buildingLabel, config, price: pricing.subtotal, buildConfig,
      width: store.width, length: store.length, height: store.height, roofStyle: store.roofStyle,
      status: 'sent', source: 'builder',
    }
    // ?lead=<id> (from a lead's "Build a quote") adds another quote to that lead;
    // otherwise start a new lead (customer) and its first quote.
    const leadId = new URLSearchParams(window.location.search).get('lead')
    if (leadId) {
      addQuote({ leadId, ...quote })
    } else {
      const lead = addLead({ firstName: 'Builder', lastName: 'lead', structureType: buildingLabel, message: `Design started in the builder: ${config}`, orgId: ctx.org.id, salespersonId: ctx.salespersonId, source: 'builder' })
      addQuote({ leadId: lead.id, ...quote })
    }
    setSent(true); setTimeout(() => setSent(false), 2600)
  }

  const currentType = BUILDING_TYPES.find((t) => t.id === store.buildingType)
  const buildingLabel = store.roofStyle === 'free_standing_lean_to'
    ? 'Free-Standing Lean-To'
    : (currentType?.label ?? store.buildingType)

  function handleCapture() {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = `qmc-building-${store.width}x${store.length}.png`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function handleReset() {
    if (currentType) store.applyBuildingType(currentType)
  }

  const btnBase = 'flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors'
  const btnActive = 'bg-brand text-white'
  const btnIdle = 'text-slate-400 hover:text-white hover:bg-white/8'

  return (
    <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-slate-900 border-t border-white/8 shrink-0">
      {/* Left: view controls (scroll horizontally on small screens) */}
      <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Frame-only */}
        <button
          onClick={() => store.setViewMode(isWireframe ? 'normal' : 'wireframe')}
          className={`${btnBase} ${isWireframe ? btnActive : btnIdle}`}
          title="Toggle frame-only view"
        >
          <Layers size={13} /> Frame View
        </button>

        {/* Dimensions on/off */}
        <button
          onClick={() => store.setField('showDimensions', !store.showDimensions)}
          className={`${btnBase} ${store.showDimensions ? btnActive : btnIdle}`}
          title="Toggle dimension labels"
        >
          <Ruler size={13} /> Dims
        </button>

        {/* Foot-marker ruler */}
        <button
          onClick={() => store.setField('showFootMarkers', !store.showFootMarkers)}
          className={`${btnBase} ${store.showFootMarkers ? btnActive : btnIdle}`}
          title="Toggle 1-foot perimeter ruler"
        >
          <Grid3x3 size={13} /> Ruler
        </button>

        {/* Component part labels */}
        <button
          onClick={() => store.setField('showLabels', !store.showLabels)}
          className={`${btnBase} ${store.showLabels ? btnActive : btnIdle}`}
          title="Label every component by build name"
        >
          <Tag size={13} /> Parts
        </button>

        {/* Scale-reference vehicles menu */}
        <button
          onClick={() => store.setField('showVehicles', !store.showVehicles)}
          className={`${btnBase} ${store.showVehicles ? btnActive : btnIdle}`}
          title="Place scale-reference vehicles to visualize space"
        >
          <Car size={13} /> Vehicles
        </button>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <button
          onClick={handleCapture}
          className={`${btnBase} ${btnIdle}`}
        >
          <Camera size={13} /> Save
        </button>
        <button
          onClick={handleReset}
          className={`${btnBase} ${btnIdle}`}
        >
          <RotateCcw size={12} /> Reset
        </button>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <button
          onClick={store.toggleTheme}
          className={`${btnBase} ${btnIdle}`}
          title={store.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {store.isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Center: dims read-out */}
      <div className="hidden md:flex items-center gap-5 text-center">
        {[
          { label: 'Width',  value: `${store.width}′`  },
          { label: 'Length', value: `${store.length}′` },
          { label: 'Height', value: `${store.height}′` },
          { label: 'Roof',   value: store.roofStyle.replace(/_/g, ' ').replace(/a frame/i, 'A-Frame') },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-widest text-slate-600">{label}</div>
            <div className="text-sm font-bold text-slate-200 capitalize">{value}</div>
          </div>
        ))}
      </div>

      {/* Right: pricing + CTA */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Est. Price</div>
          <div className="font-display text-lg sm:text-2xl font-bold text-white leading-none">
            ${pricing.subtotal.toLocaleString()}
          </div>
          <div className="hidden sm:block text-[10px] text-slate-500">${pricing.deposit.toLocaleString()} deposit</div>
        </div>
        <button
          onClick={saveDesign}
          title="Save this 3D model so you can reopen and edit it later"
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          {saved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
          <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button
          onClick={shareLink}
          title="Copy a shareable link to this design"
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share'}</span>
        </button>

        {dealerMode ? (
          <button
            onClick={sendToManufacturer}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
          >
            {sent ? <><Check size={14} /> <span className="hidden sm:inline">Sent to Quality Metal</span><span className="sm:hidden">Sent</span></> : <><Send size={14} /> <span className="hidden sm:inline">Send to Quality Metal</span><span className="sm:hidden">Send</span></>}
          </button>
        ) : (
          <Link
            to={`/contact?config=${encodeURIComponent(`${store.width}×${store.length}×${store.height}ft – ${buildingLabel}`)}&price=${pricing.subtotal}`}
            onClick={() => addDesign({
              name: buildingLabel,
              config: `${store.width}×${store.length}×${store.height}ft – ${buildingLabel}`,
              price: pricing.subtotal,
              width: store.width, length: store.length, height: store.height,
              roofStyle: store.roofStyle,
              buildConfig: configSnapshot(store),
            })}
            className="rounded-lg bg-brand px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
          >
            <span className="sm:hidden">Quote</span><span className="hidden sm:inline">Get Formal Quote</span>
          </Link>
        )}
      </div>
    </div>
  )
}
