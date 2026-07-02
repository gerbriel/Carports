import { useMemo } from 'react'
import { useBuilderStore } from '../../../store/builderStore'
import { getComponents } from '../../../data/components'
import { getPanelSchedule } from '../../../data/panelSchedule'
import { LookupCtx, Inspectable } from './pieceInspectCore'

// ── Hover-to-inspect PROVIDER + lookup ────────────────────────────────────────
// This file owns the DATA-heavy side (getComponents + getPanelSchedule) and feeds
// the memoized id→details map into LookupCtx. The renderers import <Inspectable>
// from pieceInspectCore (which has NO data-module imports) so there's no import
// cycle; re-exported here for convenience.
export { Inspectable }

// Build a { [catalogId]: { name, qty, unit, detail, lengthText } } map for the
// current config. Length text comes from the panel schedule for skins, else the
// catalog `detail` (which carries the spacing/length note for tubes/trim).
export function usePieceLookup() {
  const config = useBuilderStore((s) => s)
  return useMemo(() => {
    const map = {}
    let items = []
    try { items = getComponents(config) } catch { items = [] }
    for (const it of items) {
      map[it.id] = { name: it.name, qty: it.qty, unit: it.unit, detail: it.detail, no: it.no }
    }
    // Panel LENGTHS from the schedule (roof/wall sheets). Keyed by the same catalog
    // ids the skins use ('roof', 'walls'), best-effort. Each panel row carries a
    // `lengthLabel` (e.g. "12′" or "31′+14′" for split sheets) + numeric lengthFt.
    try {
      const sched = getPanelSchedule(config)
      const panelLen = (panels) => {
        const p = panels?.[0]
        if (!p) return null
        return p.lengthLabel ?? (p.lengthFt != null ? `${p.lengthFt}′` : null)
      }
      if (map.roof)  map.roof.lengthText  = panelLen(sched?.roof?.panels)
      if (map.walls) {
        const wp = (sched?.walls ?? []).flatMap((s) => s.panels ?? [])
        map.walls.lengthText = panelLen(wp)
      }
    } catch { /* schedule optional — tooltip still shows name + qty */ }
    return map
  }, [config])
}

export function PieceInspectProvider({ children }) {
  const lookup = usePieceLookup()
  return <LookupCtx.Provider value={lookup}>{children}</LookupCtx.Provider>
}
