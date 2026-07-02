import { useState } from 'react'
import { useBuilderStore } from '../../store/builderStore'
import { getComponents, CATEGORY_ORDER } from '../../data/components'
import { useEngineering } from '../../lib/engineeringService'
import { X, Layers, Box, Cpu, ChevronDown, Eye, EyeOff, Tag } from 'lucide-react'
import PartInstanceRows from './PartInstanceRows'
import RawMaterialsSection from './RawMaterialsSection'
import { getFastenerSchedule } from '../../data/fastenerSchedule'
import { packagingForItem } from './fastenerPackaging'

// ── Diagnostic legend + inspect overlay ───────────────────────────────────────
// Floats over the canvas when diagnostic mode is on. Lists every component of the
// current build grouped by category, cross-highlights with the 3-D callouts on
// hover, and opens an inspect card (spec + quantity) for the selected part. Also
// hosts the explode slider + isometric view shortcut.
export default function DiagnosticPanel() {
  const config         = useBuilderStore()
  const diagnosticMode = config.diagnosticMode
  const explodeAmount  = config.explodeAmount
  const selectedPartId = config.selectedPartId
  const hoveredPartId  = config.hoveredPartId
  const setField       = config.setField
  const toggleComponent = config.toggleComponent
  const vis            = config.componentVisibility ?? {}
  // Floating-label visibility — a SEPARATE layer from part geometry visibility.
  const labelsVisible  = config.labelsVisible !== false
  const hiddenLabels   = config.hiddenLabels ?? {}
  const toggleLabel    = config.toggleLabel
  const [expanded, setExpanded] = useState(null)   // catalog id whose instances are open

  if (!diagnosticMode) return null

  const items = getComponents(config)
  const fastenerSched = getFastenerSchedule(config)   // packaging per fastener/anchor line
  const byCat = CATEGORY_ORDER
    .map((cat) => ({ cat, rows: items.filter((it) => it.category === cat) }))
    .filter((g) => g.rows.length > 0)
  const selected = items.find((it) => it.id === selectedPartId)

  return (
    <div className="absolute top-3 left-3 z-10 w-64 max-h-[calc(100%-1.5rem)] flex flex-col rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-sm text-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide">
          <Layers size={13} className="text-cyan-400" /> How it&apos;s built
        </div>
        <button onClick={() => setField('diagnosticMode', false)} className="text-slate-500 hover:text-white" title="Exit diagnostic view">
          <X size={14} />
        </button>
      </div>

      {/* Explode control */}
      <div className="px-3 py-2 border-b border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
          <span>Explode</span><span className="text-slate-300">{Math.round(explodeAmount * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={explodeAmount}
          onChange={(e) => setField('explodeAmount', Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <div className="flex gap-1.5">
          <button onClick={() => setField('requestCameraPreset', 'iso')}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-white/8 hover:bg-white/15 px-2 py-1 text-[10px] font-semibold">
            <Box size={11} /> Iso view
          </button>
          <button onClick={() => setField('explodeAmount', explodeAmount > 0 ? 0 : 1)}
            className="flex-1 rounded bg-white/8 hover:bg-white/15 px-2 py-1 text-[10px] font-semibold">
            {explodeAmount > 0 ? 'Assemble' : 'Explode'}
          </button>
        </div>
      </div>

      {/* Floating-label control — SEPARATE from part visibility. The tag icon on
          each row toggles just that part's 3-D callout; these set all/none. */}
      <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
          <Tag size={10} className="text-amber-400" /> Labels
        </span>
        <div className="flex gap-1.5">
          <button onClick={() => config.showAllLabels()}
            className="rounded bg-white/8 hover:bg-white/15 px-2 py-0.5 text-[9px] font-semibold">All</button>
          <button onClick={() => setField('hiddenLabels', Object.fromEntries(items.map((it) => [it.id, true])))}
            className="rounded bg-white/8 hover:bg-white/15 px-2 py-0.5 text-[9px] font-semibold">None</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {byCat.map(({ cat, rows }) => (
          <div key={cat} className="mb-1.5">
            <div className="px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-slate-600 font-semibold">{cat}</div>
            {rows.map((it) => {
              const active   = selectedPartId === it.id || hoveredPartId === it.id
              const canList  = (it.instances?.length ?? 0) > 1
              const isOpen   = expanded === it.id
              const typeOn   = vis[it.id] !== false   // type-level visibility (falls back on)
              const labelOn  = labelsVisible && !hiddenLabels[it.id]   // floating-callout visibility (separate)
              const pkg      = packagingForItem(it.id, config, fastenerSched)
              return (
                <div key={it.id}>
                  <div
                    onMouseEnter={() => setField('hoveredPartId', it.id)}
                    onMouseLeave={() => setField('hoveredPartId', null)}
                    className={`w-full flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors ${active ? 'bg-cyan-500/20 ring-1 ring-cyan-400/50' : 'hover:bg-white/8'}`}
                  >
                    {/* Type-level eye toggle (hides/shows ALL of this type) — only for
                        toggleable component types (those present in componentVisibility) */}
                    {it.id in vis && (
                      <button onClick={() => toggleComponent(it.id)} className="shrink-0 text-slate-400 hover:text-white" title={typeOn ? `Hide all ${it.name}` : `Show all ${it.name}`}>
                        {typeOn ? <Eye size={12} className="text-cyan-400" /> : <EyeOff size={12} className="opacity-50" />}
                      </button>
                    )}
                    {/* Floating-label toggle (separate from part visibility) */}
                    <button onClick={() => toggleLabel(it.id)} className="shrink-0 hover:text-white" title={labelOn ? `Hide ${it.name} label` : `Show ${it.name} label`}>
                      <Tag size={11} className={labelOn ? 'text-amber-400' : 'text-slate-600'} />
                    </button>
                    <button onClick={() => setField('selectedPartId', it.id)} className="flex flex-1 items-center gap-2 text-left min-w-0">
                      <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-white/12 text-[9px] font-bold text-slate-300">{it.no}</span>
                      <span className="flex-1 text-[11px] font-medium leading-tight truncate">{it.name}</span>
                      {it.qty != null && (
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{it.qty} {it.unit}</span>
                      )}
                    </button>
                    {canList && (
                      <button onClick={() => setExpanded(isOpen ? null : it.id)} className="shrink-0 text-slate-400 hover:text-white" title="List individual parts">
                        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {/* Fastener/anchor packaging — ≈N · M/box · K boxes per line */}
                  {pkg.map((p) => (
                    <div key={p.name} className="pl-[26px] pr-1.5 text-[9.5px] text-slate-400 leading-snug">
                      <span className="text-slate-500">{p.name}: </span>
                      <span className="font-semibold text-cyan-300/90">{p.text}</span>
                    </div>
                  ))}
                  {isOpen && canList && <PartInstanceRows item={it} variant="diagnostic" />}
                </div>
              )
            })}
          </div>
        ))}

        {/* Raw material takeoff — sticks / cuts / welds + panel cut list (collapsible) */}
        <div className="px-1.5 pb-1.5">
          <RawMaterialsSection config={config} variant="diagnostic" />
        </div>

        {/* Engineering — live check from the engineering-service */}
        <EngineeringSection config={config} enabled={diagnosticMode} />
      </div>

      {/* Inspect card */}
      {selected && (
        <div className="border-t border-white/10 px-3 py-2 bg-slate-950/60">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-cyan-500 text-[10px] font-bold text-white">{selected.no}</span>
            <span className="text-xs font-bold">{selected.name}</span>
          </div>
          <dl className="text-[10.5px] space-y-0.5 text-slate-400">
            <div className="flex justify-between gap-2"><dt>Material</dt><dd className="text-slate-200 text-right">{selected.material}</dd></div>
            <div className="flex justify-between gap-2"><dt>Quantity</dt><dd className="text-slate-200 text-right">{selected.qty ?? '—'} {selected.unit}</dd></div>
            {selected.detail && <div className="flex justify-between gap-2"><dt>Note</dt><dd className="text-slate-200 text-right">{selected.detail}</dd></div>}
          </dl>
        </div>
      )}
    </div>
  )
}

// ── Engineering section ───────────────────────────────────────────────────────
// Hybrid: the BOM above is instant (client JS); this block calls the Python
// engineering-service to show real ASCE 7 loads + member demand/capacity checks
// + a not-permitted flag. Fails quietly if the service is offline.
function EngineeringSection({ config, enabled }) {
  const { data, loading, error } = useEngineering(config, enabled)

  return (
    <div className="mb-1.5">
      <div className="px-1.5 py-0.5 flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-600 font-semibold">
        <span className="flex items-center gap-1"><Cpu size={10} className="text-cyan-400" /> Engineering</span>
        {loading && <span className="normal-case text-slate-500">checking…</span>}
      </div>

      {error && !data && (
        <div className="px-1.5 text-[10px] text-slate-500">Service offline — start engineering-service (port 8000).</div>
      )}

      {data && (
        <div className="px-1.5 space-y-1.5">
          {/* Design loads */}
          <div className="grid grid-cols-3 gap-1">
            <EngStat label="Snow Ps" v={`${data.loads.snow.ps}`} u="psf" />
            <EngStat label="Wind qz" v={`${data.loads.wind.qz}`} u="psf" />
            <EngStat label="Design" v={`${data.loads.gravity_design_psf}`} u="psf" />
          </div>

          {/* Member checks (demand/capacity) */}
          <div className="space-y-0.5">
            {data.member_checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-300 truncate">{c.member}</span>
                <span className={`font-bold whitespace-nowrap ${c.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {c.status === 'OK' ? '✓' : '✕'} DCR {c.dcr}
                </span>
              </div>
            ))}
          </div>

          {/* Not-permitted / warnings */}
          {!data.ok && (
            <div className="rounded bg-red-500/15 ring-1 ring-red-400/40 px-1.5 py-1 text-[10px] text-red-300 leading-snug">
              {data.warnings?.[0] ?? 'Not permitted — needs project-specific engineering.'}
            </div>
          )}
          {data.ok && data.warnings?.length > 0 && (
            <div className="text-[9.5px] text-amber-400/80 leading-snug">⚠ {data.warnings[0]}</div>
          )}

          <div className="text-[8.5px] text-slate-600 leading-snug pt-0.5">Draft basis — requires licensed-PE review & stamp.</div>
        </div>
      )}
    </div>
  )
}

function EngStat({ label, v, u }) {
  return (
    <div className="rounded bg-white/5 px-1 py-0.5 text-center">
      <div className="text-[11px] font-bold text-slate-200 leading-none">{v}</div>
      <div className="text-[8px] uppercase tracking-wide text-slate-500 mt-0.5">{label} <span className="text-slate-600">{u}</span></div>
    </div>
  )
}
