import { useState } from 'react'
import { ChevronDown, Factory } from 'lucide-react'
import { getFabrication } from '../../data/fabrication'
import { getPanelSchedule } from '../../data/panelSchedule'

// ── Raw materials / cut & weld (shared, collapsible) ──────────────────────────
// One component reused by BOTH the Parts view (BuilderPanel) and the Diagnostic
// legend so the fab takeoff never diverges. Default COLLAPSED so it doesn't
// overwhelm the primary BOM. Shows, from getFabrication():
//   • RAW-STOCK rollup — sticks of each tube section + total cuts + total welds
//   • an expandable per-MEMBER cut list (pieces × length · cuts · welds)
// plus the PANEL cut-list / gable-waste summary from getPanelSchedule() (Task A).
//
// `variant`: 'parts' (brand accent) | 'diagnostic' (cyan) to match its host panel.
export default function RawMaterialsSection({ config, variant = 'parts' }) {
  const [open, setOpen] = useState(false)          // whole section (default collapsed)
  const [showMembers, setShowMembers] = useState(false)

  const cyan   = variant === 'diagnostic'
  const accent = cyan ? 'text-cyan-400' : 'text-brand'

  // Compute lazily — only when the section is opened (fab takeoff isn't free).
  const fab   = open ? safe(() => getFabrication(config)) : null
  const sched = open ? safe(() => getPanelSchedule(config)) : null

  return (
    <div className="rounded border border-white/8 bg-white/3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left"
        title="Raw material takeoff: sticks, cuts, welds + panel cut list"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          <Factory size={12} className={accent} /> Raw Materials · Cut &amp; Weld
        </span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && fab && (
        <div className="px-2 pb-2 space-y-2">
          {/* Shop totals */}
          <div className="grid grid-cols-3 gap-1">
            <Stat label="Sticks" v={fab.totals.sticks} accent={accent} />
            <Stat label="Cuts"   v={fab.totals.cuts}   accent={accent} />
            <Stat label="Welds"  v={fab.totals.welds}  accent={accent} />
          </div>

          {/* Raw-stock rollup by cross-section */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold mb-0.5">Raw Stock</p>
            <div className="space-y-0.5">
              {fab.rawStock.map((r) => (
                <div key={r.section} className="flex items-center justify-between text-[10px] gap-2">
                  <span className="text-slate-400 truncate">{r.section}</span>
                  <span className="text-slate-300 whitespace-nowrap">
                    <span className={`font-bold ${accent}`}>{r.sticks}</span> × {r.stockLengthFt}′
                    <span className="text-slate-600"> · {r.totalFt}′</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[8.5px] text-slate-600 leading-snug mt-0.5">
              {r0(fab.assumptions.STOCK_LENGTH_FT)}′ mill sticks · {Math.round(fab.assumptions.CUT_WASTE * 100)}% cut waste
            </p>
          </div>

          {/* Expandable per-member cut list */}
          <div>
            <button onClick={() => setShowMembers((s) => !s)} className="flex w-full items-center justify-between text-[9px] uppercase tracking-widest text-slate-600 font-semibold">
              <span>Cut list · {fab.members.length} members</span>
              <ChevronDown size={11} className={`transition-transform ${showMembers ? 'rotate-180' : ''}`} />
            </button>
            {showMembers && (
              <div className="mt-0.5 space-y-0.5 border-l border-white/8 pl-2">
                {fab.members.map((m, i) => (
                  <div key={i} className="text-[9.5px] leading-tight">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300 truncate">{m.member}</span>
                      <span className="text-slate-500 whitespace-nowrap">{m.totalPieces} × {m.pieceLengthFt}′</span>
                    </div>
                    <div className="text-slate-600 truncate">
                      {m.pieceLengthLabel} · {m.cutsPerUnit} cut{m.cutsPerUnit === 1 ? '' : 's'}/ea
                      {m.totalWelds > 0 ? ` · ${m.totalWelds} welds` : ' · no welds'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel cut list / gable-waste summary (Task A) */}
          {sched && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold mb-0.5">Panel Cut List</p>
              <div className="space-y-0.5">
                <Row l="Roof panels" r={`${sched.roof.totalPanels} · ${sched.totals.roofLinearFt}′`} />
                <Row l="Wall panels ordered" r={`${sched.totals.wallOrderedFt}′`} />
                {sched.totals.wallWasteFt > 0 && (
                  <>
                    <Row l="Net (covered)" r={`${sched.totals.wallNetFt}′`} />
                    <Row l="Gable rake-cut waste" r={`${sched.totals.wallWasteFt}′ · ${sched.totals.wallWastePct}%`} amber />
                    <Row l="Nested (mirror-pair reuse)" r={`${sched.totals.wallNestedFt}′`} />
                    <Row l="Nesting saves" r={`${sched.totals.wallSavingsFt}′`} accentCls={accent} />
                  </>
                )}
                {sched.totals.leanPanels > 0 && (
                  <>
                    <Row l="Lean-to panels (incl. wrap corners)" r={`${sched.totals.leanPanels} · ${sched.totals.leanLinearFt}′`} accentCls={accent} />
                    {sched.totals.leanWasteFt > 0 && (
                      <Row l="Lean-to side rake-cut waste" r={`${sched.totals.leanWasteFt}′`} amber />
                    )}
                  </>
                )}
                {sched.totals.intPanels > 0 && (
                  <>
                    <Row l="Interior wall panels" r={`${sched.totals.intPanels} · ${sched.totals.intLinearFt}′`} accentCls={accent} />
                    {sched.totals.intWasteFt > 0 && (
                      <Row l="Interior gable rake-cut waste" r={`${sched.totals.intWasteFt}′`} amber />
                    )}
                  </>
                )}
                {sched.totals.madeToOrder > 0 && (
                  <Row l="Made-to-order panels" r={`${sched.totals.madeToOrder}`} accentCls={accent} />
                )}
                {sched.totals.splitPanels > 0 && (
                  <Row l={`Split for transport (>${sched.totals.transportCapFt}′)`} r={`${sched.totals.splitPanels} panels`} amber />
                )}
                {sched.totals.overTransportCap > 0 && (
                  <Row l="Over transport cap ⚠" r={`${sched.totals.overTransportCap} pcs`} amber />
                )}
                <Row l="Roofing" r={`${sched.totals.squares} squares`} />
              </div>
              <p className="text-[8.5px] text-slate-600 leading-snug mt-0.5">
                Panels ordered in {sched.meta.panelIncrementFt}′ increments · nest yield {Math.round(sched.meta.nestYield * 100)}% · ≤{sched.totals.transportCapFt}′ transport cap
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, v, accent }) {
  return (
    <div className="rounded bg-white/5 px-1 py-0.5 text-center">
      <div className={`text-[12px] font-bold leading-none ${accent}`}>{v}</div>
      <div className="text-[8px] uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function Row({ l, r, amber, accentCls }) {
  return (
    <div className="flex items-center justify-between text-[10px] gap-2">
      <span className="text-slate-400 truncate">{l}</span>
      <span className={`whitespace-nowrap font-semibold ${amber ? 'text-amber-400/90' : accentCls ?? 'text-slate-300'}`}>{r}</span>
    </div>
  )
}

const r0 = (v) => Math.round(v)
function safe(fn) { try { return fn() } catch { return null } }
