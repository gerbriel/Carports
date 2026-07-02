// ── Fastener-packaging lookup for BOM lines (Task B.2) ────────────────────────
// Maps a diagnostic-catalog item id (getComponents) → the matching packaging
// line(s) from getFastenerSchedule(config), so both the Parts BOM and the
// Diagnostic legend can render "≈N · M/box · K boxes" per fastener line without
// duplicating the map. Returns an ARRAY of { name, count, perBox, boxes, note? }
// (usually one; sheathing also carries its stitch/lap sibling, structural also
// carries the A325 truss bolts on widespan builds).
import { getFastenerSchedule } from '../../data/fastenerSchedule'

// catalog id → fastener schedule line id(s) it should surface.
const CATALOG_TO_LINES = {
  foundation:       ['anchors'],
  sheathingScrews:  ['sheathingScrews', 'stitchScrews'],
  structuralScrews: ['structuralScrews', 'a325Bolts'],
}

// Format one packaging line as "≈N · M/box · K box(es)". Anchors ship singly, so
// they read "N · 1/ea" rather than a box count.
export function fmtPackaging(line) {
  if (!line || !(line.count > 0)) return null
  const per = line.perBox <= 1
    ? '1/ea'
    : `${line.perBox}/box`
  const pkg = line.perBox <= 1
    ? `${line.boxes} pcs`
    : `${line.boxes} box${line.boxes === 1 ? '' : 'es'}`
  return `≈${line.count} · ${per} · ${pkg}`
}

// Return the packaging lines for a catalog id, or [] if it isn't a fastener line.
// Pass a pre-computed schedule to avoid recomputing per row.
export function packagingForItem(itemId, config, sched) {
  const lineIds = CATALOG_TO_LINES[itemId]
  if (!lineIds) return []
  const s = sched ?? getFastenerSchedule(config)
  const byId = Object.fromEntries((s.lines ?? []).map((l) => [l.id, l]))
  return lineIds
    .map((id) => byId[id])
    .filter((l) => l && l.count > 0)
    .map((l) => ({ name: l.name, count: l.count, perBox: l.perBox, boxes: l.boxes, text: fmtPackaging(l) }))
}
