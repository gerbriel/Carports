import { Eye, EyeOff } from 'lucide-react'
import { useBuilderStore } from '../../store/builderStore'
import { getPanelSchedule } from '../../data/panelSchedule'

// ── Shared per-instance tree rows ─────────────────────────────────────────────
// Given ONE catalog item (from getComponents(), which now carries `instances:
// [{ id, label, pos }]`), render its expanded list of individual instances. Each
// row has an eye toggle (writes hiddenInstances via toggleInstance) and is
// click-to-select (sets selectedPartId to the INSTANCE id, which highlights that
// specific part in 3-D — see DiagnosticLabels' marker). Used by BOTH the Parts
// view (BuilderPanel) and the Diagnostic legend so the two stay identical.
//
// `variant`: 'parts' (brand accent, matches the Parts sidebar) | 'diagnostic'
// (cyan, matches the diagnostic legend). Look/UX preserved per panel.
//
// PANEL LENGTHS (Task B.1): for the Roof Panel / Wall Panel items the surface-level
// instances (roof:left, wall:front …) expand further into the per-3′-sheet CUT
// SCHEDULE from getPanelSchedule — each sheet's length label, and on GABLE end walls
// the stepped tall-edge lengths + a small per-wall waste/nesting note.
export default function PartInstanceRows({ item, variant = 'parts' }) {
  const hiddenInstances = useBuilderStore((s) => s.hiddenInstances)
  const selectedPartId  = useBuilderStore((s) => s.selectedPartId)
  const toggleInstance  = useBuilderStore((s) => s.toggleInstance)
  const setField        = useBuilderStore((s) => s.setField)
  const config          = useBuilderStore()

  const instances = item.instances ?? []
  if (instances.length === 0) return null

  const cyan = variant === 'diagnostic'
  const activeCls = cyan ? 'bg-cyan-500/20 ring-1 ring-cyan-400/50' : 'bg-brand/10 ring-1 ring-brand/40'
  const eyeCls    = cyan ? 'text-cyan-400' : 'text-brand'

  // For the skin items, resolve the per-panel cut schedule keyed by surface id so
  // each surface (slope / wall) can list its individual sheet lengths beneath it.
  const isRoof = item.id === 'roof'
  const isWall = item.id === 'walls'
  // Lean-to skin items: leanRoof:<side>, leanWallOuter:<side>, leanWallSide:<side>.
  // Their instances carry the surface id (side walls: one per closed end), so the
  // lean-to panel-schedule surfaces expand beneath them the same way.
  const isLean = typeof item.id === 'string' && (
    item.id.startsWith('leanRoof:') || item.id.startsWith('leanWallOuter:') || item.id.startsWith('leanWallSide:'))
  let schedBySurface = null
  if (isRoof || isWall || isLean) {
    const sched = getPanelSchedule(config)
    schedBySurface = {}
    if (isRoof) for (const s of sched.roof.surfaces ?? []) schedBySurface[s.id] = s
    if (isWall) for (const w of sched.walls ?? []) schedBySurface[w.id] = w
    if (isLean) for (const s of sched.leanTos ?? []) schedBySurface[s.id] = s
  }

  return (
    <div className={`mt-1 ml-2 space-y-0.5 border-l ${cyan ? 'border-white/10' : 'border-white/10'} pl-2`}>
      {instances.map((inst) => {
        const on       = !hiddenInstances?.[inst.id]
        const selected = selectedPartId === inst.id
        const surface  = schedBySurface?.[inst.id]
        return (
          <div key={inst.id}>
            <div
              className={`flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${selected ? activeCls : 'hover:bg-white/8'}`}
            >
              {/* Click the label to SELECT + highlight this instance in 3-D */}
              <button
                onClick={() => setField('selectedPartId', selected ? null : inst.id)}
                className={`flex-1 text-left text-[10px] leading-tight truncate ${on ? 'text-slate-300' : 'text-slate-600'}`}
                title={`Select ${inst.label}`}
              >
                {inst.label}
                {surface && (
                  <span className="ml-1 text-slate-500">· {surface.totalPanels} sheets</span>
                )}
              </button>
              {/* Per-instance show/hide */}
              <button
                onClick={() => toggleInstance(inst.id)}
                className="shrink-0 p-0.5 text-slate-400 hover:text-white"
                title={on ? `Hide ${inst.label}` : `Show ${inst.label}`}
              >
                {on ? <Eye size={11} className={eyeCls} /> : <EyeOff size={11} className="opacity-50" />}
              </button>
            </div>
            {surface && <PanelLengthList surface={surface} accent={eyeCls} isWall={isWall || isLean} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Per-surface panel cut list ────────────────────────────────────────────────
// Lists each 3′ sheet's ORDER length for one slope/wall. On gable end walls the
// lengths step (tall-edge, rake-cut) and a per-wall waste/nesting note is shown
// (e.g. "ordered 214′ · net 176′ · 18% waste · nested saves 11′").
function PanelLengthList({ surface, accent, isWall }) {
  const panels = surface.panels ?? []
  if (panels.length === 0) return null
  const gable = isWall && surface.isGable
  return (
    <div className="mt-0.5 ml-3 mb-1 border-l border-white/8 pl-2">
      {gable && (
        <div className="text-[9px] text-amber-400/80 leading-snug mb-0.5">
          Gable rake-cut · ordered {surface.orderedFt}′ · net {surface.netFt}′ · {surface.wastePct}% waste
          {surface.savingsFt > 0 && <> · nested saves {surface.savingsFt}′</>}
        </div>
      )}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {panels.map((p) => (
          <span key={p.id} className="text-[9.5px] text-slate-500 whitespace-nowrap" title={
            gable ? `short ${p.shortEdgeFt}′ · tall ${p.tallEdgeFt}′ · waste ${p.wasteFt}′` : undefined
          }>
            <span className={`font-semibold ${accent}`}>{p.lengthLabel}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
