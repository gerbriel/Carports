import { useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { cloneForWall } from './corrugatedTexture'
import { regularGableShape } from './BuildingRoof'
import { frameSpan } from './BuildingTrusses'
import { flatBasis } from './Skylight'
import { useBuilderStore } from '../../../store/builderStore'
import { panelFinish, DOOR_TYPES } from '../../../data/builderData'
import { useExplode } from './useExplode'
import { pieceExplode } from '../../../data/explode'
import { Inspectable } from './pieceInspectCore'
import { getPanelSchedule } from '../../../data/panelSchedule'

const WALL_CLAD = 0.13   // panels sit this far outboard of the frame (matches CLAD)

// Skylight surface bases for the four center-building walls (world frame). Run =
// panel direction (vertical or horizontal); across = the other axis; one strip is
// one panel (3′) wide. Open walls have no panel, so they're skipped.
export function getWallSkylightBases({ width, length, height, walls, isVertical }) {
  const hwC = width / 2 + WALL_CLAD
  const hlC = length / 2 + WALL_CLAD
  const defs = [
    { key: 'front', p0: [-width / 2, 0, -hlC], across: [width, 0, 0],  out: [0, 0, -1] },
    { key: 'back',  p0: [-width / 2, 0,  hlC], across: [width, 0, 0],  out: [0, 0,  1] },
    { key: 'left',  p0: [-hwC, 0, -length / 2], across: [0, 0, length], out: [-1, 0, 0] },
    { key: 'right', p0: [ hwC, 0, -length / 2], across: [0, 0, length], out: [ 1, 0, 0] },
  ]
  const up = [0, height, 0]
  return defs
    .filter((d) => walls?.[d.key] && walls[d.key] !== 'open')
    .map((d) => ({
      surfaceKey: `wall:center:${d.key}`,
      basis: isVertical ? flatBasis(d.p0, d.across, up, d.out) : flatBasis(d.p0, up, d.across, d.out),
    }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wallSegments(wallW, wallH, doors) {
  if (!doors.length) return [{ cx: 0, cy: wallH / 2, w: wallW, h: wallH }]

  const withPos = doors.map((d) => {
    const posX  = (d.xOffset - 0.5) * wallW
    const isWin = d.type === 'window'
    const cyc   = isWin && d.yOffset != null ? d.yOffset * wallH : d.height / 2
    return { ...d, posX, y0: Math.max(0, cyc - d.height / 2), y1: Math.min(wallH, cyc + d.height / 2) }
  })
  const sorted = [...withPos].sort((a, b) => a.posX - b.posX)
  const segs   = []
  let left     = -wallW / 2

  for (const d of sorted) {
    const dl = d.posX - d.width / 2
    const dr = d.posX + d.width / 2
    if (dl > left) segs.push({ cx: (left + dl) / 2, cy: wallH / 2, w: dl - left, h: wallH })
    // Panel above the opening
    if (d.y1 < wallH - 1e-3) { const ah = wallH - d.y1; segs.push({ cx: d.posX, cy: d.y1 + ah / 2, w: d.width, h: ah }) }
    // Panel below the opening (raised window leaves wall under the sill)
    if (d.y0 > 1e-3)         { segs.push({ cx: d.posX, cy: d.y0 / 2, w: d.width, h: d.y0 }) }
    left = dr
  }
  if (left < wallW / 2) segs.push({ cx: (left + wallW / 2) / 2, cy: wallH / 2, w: wallW / 2 - left, h: wallH })
  return segs
}

// Painted panels have a washcoat backer — the interior face reads off-white, not
// the exterior color. Galvalume is bare metal both sides, so it's excluded.
const PANEL_INTERIOR = '#ece9dd'

// A wall panel. Exterior face (BackSide of the plane — +z normal points inward on
// every wall group) carries the chosen color; the interior face (FrontSide) gets
// the off-white washcoat liner. Galvalume keeps its bare-metal look on both faces
// (single double-sided mesh). Pass geometry inline via `children` (cloned for the
// interior pass) or as a shared BufferGeometry via `geometry`.
function PanelMesh({ position, geometry, color, texMap, wireframe, castShadow, receiveShadow, children }) {
  // Galvalume → polished bare-metal (chrome); painted colors → matte.
  const finish = panelFinish(color)
  const ext = finish
    ? { side: THREE.DoubleSide, ...finish }
    : { side: THREE.BackSide, roughness: 0.65, metalness: 0.28 }
  return (
    <>
      <mesh position={position} geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
        {children}
        <meshStandardMaterial color={color} map={texMap} wireframe={wireframe} {...ext} />
      </mesh>
      {!finish && !wireframe && (
        <mesh position={position} geometry={geometry} receiveShadow={receiveShadow}>
          {children}
          <meshStandardMaterial color={PANEL_INTERIOR} map={texMap} side={THREE.FrontSide} roughness={0.72} metalness={0.08} />
        </mesh>
      )}
    </>
  )
}

// ── Gable ─────────────────────────────────────────────────────────────────────
// Gable peak runs up to the LIFTED roof skin (rafter line + this) so the panel
// meets the roof and hides the top chords. Matches BuildingRoof's LIFT.
const GABLE_LIFT = 0.28
function GableMesh({ wallW, wallH, ridgeH, color, texMap, wireframe, roofStyle }) {
  const geo = useMemo(() => {
    if (roofStyle === 'regular') {
      return new THREE.ShapeGeometry(regularGableShape(wallW, wallH, ridgeH + GABLE_LIFT))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -wallW / 2, wallH,             0,
       wallW / 2, wallH,             0,
       0,         ridgeH + GABLE_LIFT, 0,
    ]), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2))
    g.computeVertexNormals()
    return g
  }, [wallW, wallH, ridgeH, roofStyle])

  return <PanelMesh geometry={geo} color={color} texMap={texMap} wireframe={wireframe} castShadow />
}

// A panel piece (w×h) centred at (cx, cy) within a wallW×wallH wall, with UVs
// remapped to the panel's WALL-RELATIVE position. The shared wall texture (whose
// repeat is sized to the FULL wall) then samples the correct slice — so the ribs
// keep the right density AND line up across every piece, regardless of how the
// wall is split by door cut-outs or partial closures. (A plain 0→1 plane UV would
// stretch the full-wall rib count onto each sub-piece → wrong scale + misalignment.)
function wallPanelGeo(w, h, cx, cy, wallW, wallH) {
  const g = new THREE.PlaneGeometry(w, h)
  const u0 = (cx - w / 2 + wallW / 2) / wallW, u1 = (cx + w / 2 + wallW / 2) / wallW
  const v0 = (cy - h / 2) / wallH,             v1 = (cy + h / 2) / wallH
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setX(i, u0 + uv.getX(i) * (u1 - u0))
    uv.setY(i, v0 + uv.getY(i) * (v1 - v0))
  }
  uv.needsUpdate = true
  return g
}

// Rake-cut end-wall panel: a quad (pentagon if it straddles the ridge) whose TOP
// follows the sloped roofline, so in NORMAL view no rectangular "excess" (the rake
// offcut) pokes above the roof. Verts in wall-local X [-w/2, w/2] with ABSOLUTE Y;
// UVs map to the wall texture (u across wallW, v across topH) so the ribs stay aligned.
function rakeCutPanelGeo(w, yBottom, topL, topR, yPeak, cx, wallW, topH) {
  const hwp = w / 2
  const shape = new THREE.Shape()
  shape.moveTo(-hwp, yBottom)
  shape.lineTo(hwp, yBottom)
  shape.lineTo(hwp, topR)
  if (yPeak != null) shape.lineTo(0, yPeak)   // ridge strip: peak in the middle
  shape.lineTo(-hwp, topL)
  shape.closePath()
  const g = new THREE.ShapeGeometry(shape)
  const uv = g.attributes.uv, pos = g.attributes.position
  for (let i = 0; i < uv.count; i++) {
    uv.setX(i, (cx + pos.getX(i) + wallW / 2) / wallW)
    uv.setY(i, pos.getY(i) / topH)
  }
  uv.needsUpdate = true
  return g
}

// Split one wall region (w wide, centred at cx) into individual ~3′ metal panels.
// Returns [{ w, cx }] sub-panels covering the region; `spread` (feet per unit of
// local X from the wall centre) is added in the caller to fan each sheet apart in
// the exploded view. 1 panel when the region is ≤ ~3′ (or not exploding).
function panelStrips(w, cx, split) {
  if (!split || w <= 3.5) return [{ w, cx }]
  const n = Math.max(1, Math.round(w / 3))
  const pw = w / n
  const left = cx - w / 2
  return Array.from({ length: n }, (_, i) => ({ w: pw, cx: left + pw * (i + 0.5) }))
}

// HORIZONTAL siding: split one wall region (h tall, centred at cy) into individual
// ~3′-tall COURSES, each spanning the FULL region width. Returns [{ h, cy }] bottom-
// up so the courses stack up the wall; `spread` fans them apart vertically in the
// exploded view (added in the caller). 1 course when the region is ≤ ~3′ (or not
// exploding). `courseFloor` is the region's bottom Y in wall-space so each course's
// absolute height (from the ground) can be turned into a bottom-up schedule index.
function panelCourses(h, cy, split, courseFloor = cy - h / 2) {
  if (!split || h <= 3.5) return [{ h, cy, floor: courseFloor }]
  const n = Math.max(1, Math.round(h / 3))
  const ph = h / n
  return Array.from({ length: n }, (_, i) => ({ h: ph, cy: courseFloor + ph * (i + 0.5), floor: courseFloor }))
}

// ── End-wall (gable) panel strips ──────────────────────────────────────────────
// A-frame END walls are sheeted with individual ~3′-wide VERTICAL panels, each a
// SINGLE piece running FLOOR (or the clad-band bottom) up to the TOP CHORD (sloped
// roofline) at that panel's x. The panels themselves STEP UP to the peak and back
// down — they ARE the gable; there is NO separate triangle piece above.
//
// Top-chord height at wall-local x (same taper the trusses use): `height` at the
// eave corners (x=±hw) rising linearly to `ridgeH` at the ridge (x=0). We add
// GABLE_LIFT so the panel top meets the LIFTED roof skin (hides the top chords),
// matching the old GableMesh peak (ridgeH + GABLE_LIFT). Always split into 3′
// panels (the sheets step) regardless of explode; `spread` only fans them apart.
//
//   yBottom   — clad-band bottom (0 for fully-closed; band[0] for top-N/fractional)
//   doorTops  — [{ x0, x1, yTop }] header lines an opening imposes; a strip whose
//               span overlaps an opening stops at that header (like the sheets show
//               for a middle door), matching wallSegments' above-opening panel.
function endWallStrips(wallW, yBottom, ridgeH, height, doorTops = []) {
  const hw = wallW / 2
  const rise = ridgeH - height
  const topChordAt = (x) => height + Math.max(0, rise) * (1 - Math.min(1, Math.abs(x) / (hw || 1))) + GABLE_LIFT
  const n = Math.max(1, Math.round(wallW / 3))
  const pw = wallW / n
  return Array.from({ length: n }, (_, i) => {
    const cx = -hw + pw * (i + 0.5)
    const xL = -hw + pw * i
    const xR = -hw + pw * (i + 1)
    const straddles = xL <= 0 && xR >= 0
    const innerX = straddles ? 0 : Math.min(Math.abs(xL), Math.abs(xR))
    // Roofline heights: the two edges + the peak (ridge strip) define the RAKE-CUT
    // top (normal view); the TALLEST across the span (yTopRect) is the full ordered
    // rectangle shown in Diagnostic (the piece before it's rake-cut → the "excess").
    let topL = topChordAt(xL)
    let topR = topChordAt(xR)
    let yPeak = straddles ? topChordAt(0) : null
    let yTopRect = topChordAt(innerX)
    // An opening under this strip cuts every top flat at the header (panel above door).
    for (const d of doorTops) {
      if (cx > d.x0 && cx < d.x1) {
        topL = Math.min(topL, d.yTop); topR = Math.min(topR, d.yTop)
        yTopRect = Math.min(yTopRect, d.yTop)
        if (yPeak != null) yPeak = Math.min(yPeak, d.yTop)
      }
    }
    return { w: pw, cx, panelNo: i + 1, yBottom, yTopRect, topL, topR, yPeak }
  })
}

// Per-panel hover label: pull THIS strip's exact length from the panel schedule
// (matched by sheeting order i), falling back to a generic index. `sideLabel` is a
// display prefix ("End Wall"/"Side Wall"/"Wall"). id = the catalog `wall:<side>`
// instance (what wallsEnd/wallsSide + hiddenInstances key on).
function panelLabel(schedPanels, i, sideLabel) {
  const p = schedPanels?.[i]
  if (p?.lengthLabel) return `${sideLabel} panel ${i + 1} · ${p.lengthLabel}`
  return `${sideLabel} panel ${i + 1}`
}

// HORIZONTAL siding hover label: a COURSE (one horizontal panel spanning the full
// wall run). getPanelSchedule returns horizontal walls as bottom-up courses whose
// `lengthLabel` = the wall run; match this course to schedule course `courseNo`
// (1-based, bottom-up) by order → e.g. "Side Wall course 2 · 30'".
function courseLabel(schedPanels, courseNo, sideLabel) {
  const p = schedPanels?.[courseNo - 1]
  if (p?.lengthLabel) return `${sideLabel} course ${courseNo} · ${p.lengthLabel}`
  return `${sideLabel} course ${courseNo}`
}

// ── Partial panel ──────────────────────────────────────────────────────────────
// anchor 'top'    → panel hangs from the eave down (top-N' styles)
// anchor 'bottom' → panel rises from the ground up (fractional closures)
// VERTICAL siding → the clad band splits into ~3′-wide vertical strips. HORIZONTAL
// siding → the band splits into ~3′-tall COURSES spanning the full run. The schedule
// counts courses over the CLAD BAND height (not the full wall), so a course's index
// is measured from the BAND's own bottom (bandY0) → course 1 = the band's lowest.
function PartialPanel({ wallW, wallH, fraction, anchor = 'top', color, texMap, wireframe, split = false, spread = 0, wallKey, sideLabel, schedPanels, isVertical = true }) {
  const panelH = wallH * fraction
  const cy = anchor === 'bottom' ? panelH / 2 : wallH - panelH / 2
  const bandY0 = cy - panelH / 2   // the clad band's own floor (courses index up from here)
  const pieces = useMemo(() => {
    if (isVertical) {
      return panelStrips(wallW, 0, split).map((s) => ({
        cx: s.cx, cy, along: s.cx, vertical: true,
        geo: wallPanelGeo(s.w, panelH, s.cx, cy, wallW, wallH),
      }))
    }
    return panelCourses(panelH, cy, split, bandY0).map((c) => ({
      cx: 0, cy: c.cy, along: c.cy, vertical: false,
      courseNo: Math.max(1, Math.round((c.floor - bandY0) / 3) + 1),   // bottom-up within the band
      geo: wallPanelGeo(wallW, c.h, 0, c.cy, wallW, wallH),
    }))
  }, [wallW, panelH, cy, wallH, split, isVertical, bandY0])
  return (
    <>
      {pieces.map((s, i) => {
        const px = s.vertical ? s.cx + s.cx * spread : 0
        const py = s.vertical ? cy : s.cy + (s.cy - bandY0 - panelH / 2) * spread
        const label = s.vertical
          ? panelLabel(schedPanels, i, sideLabel)
          : courseLabel(schedPanels, s.courseNo, sideLabel)
        return (
          <Inspectable key={i} id={`wall:${wallKey}`} label={label} at={[px, py, 0]}>
            <PanelMesh position={[px, py, 0]} geometry={s.geo} color={color} texMap={texMap} wireframe={wireframe} castShadow receiveShadow />
          </Inspectable>
        )
      })}
    </>
  )
}

// ── End-wall gable: floor-to-top-chord strips (the panels ARE the gable) ───────
// Each ~3′ vertical strip runs from the clad-band bottom up to the sloped top
// chord at its x — stepping up to the peak and back down. NO separate triangle.
// Openings cut a strip off at the header (panel above the door). Per-panel hover
// shows THAT panel's exact length from the schedule (matched by sheeting order).
function EndWallGable({ wallW, wallH, ridgeH, yBottom = 0, doors = [], color, texMap, wireframe, spread = 0, wallKey, sideLabel, schedPanels }) {
  // Normal view: panels are RAKE-CUT to the roofline (no excess). Diagnostic view:
  // the full ordered rectangle shows (so you can see the cut-off piece + its length).
  const diag = useBuilderStore((s) => s.diagnosticMode)
  // Header lines that clip a strip: a wall opening (door/window) whose top is below
  // the top chord leaves only the panel-above-header, like the sheets' middle door.
  const doorTops = useMemo(() => doors.map((d) => {
    const posX  = (d.xOffset - 0.5) * wallW
    const isWin = d.type === 'window'
    const cyc   = isWin && d.yOffset != null ? d.yOffset * wallH : d.height / 2
    return { x0: posX - d.width / 2, x1: posX + d.width / 2, yTop: Math.max(0, cyc + d.height / 2) }
  }), [doors, wallW, wallH])

  const topH = ridgeH + GABLE_LIFT   // peak height — shared v-scale so ribs align
  const strips = useMemo(
    () => endWallStrips(wallW, yBottom, ridgeH, wallH, doorTops)
      .filter((s) => s.yTopRect - s.yBottom > 1e-3)
      .map((s) => {
        const h  = s.yTopRect - s.yBottom
        const cy = s.yBottom + h / 2
        // Diagnostic: full ordered rectangle (its flat top shows the rake offcut).
        // Normal: rake-cut to the roofline (no excess above the roof).
        const geo = diag
          ? wallPanelGeo(s.w, h, s.cx, cy, wallW, topH)
          : rakeCutPanelGeo(s.w, s.yBottom, s.topL, s.topR, s.yPeak, s.cx, wallW, topH)
        return { ...s, cy, geo }
      }),
    [wallW, wallH, ridgeH, yBottom, doorTops, topH, diag],
  )
  return (
    <>
      {strips.map((s, i) => {
        const px = s.cx + s.cx * spread
        // Diagnostic rect geo is centred at cy; rake-cut geo bakes ABSOLUTE Y (pos 0).
        return (
          <Inspectable key={i} id={`wall:${wallKey}`} label={panelLabel(schedPanels, s.panelNo - 1, sideLabel)} at={[px, s.cy, 0]}>
            <PanelMesh position={diag ? [px, s.cy, 0] : [px, 0, 0]} geometry={s.geo} color={color} texMap={texMap} wireframe={wireframe} castShadow receiveShadow />
          </Inspectable>
        )
      })}
    </>
  )
}

// ── Full wall with door cutouts ───────────────────────────────────────────────
// VERTICAL siding → each door-cut segment splits into ~3′-wide vertical strips
// (panelStrips), fanned apart horizontally on explode. HORIZONTAL siding → each
// segment splits into ~3′-tall COURSES spanning the segment's full width
// (panelCourses), fanned apart vertically on explode. A course's schedule index is
// bottom-up from the ground (round(floorY / 3)) so it maps to getPanelSchedule's
// bottom-up courses even when a door cutout only leaves an above/below strip.
function FullWallSegments({ wallW, wallH, doors, color, texMap, wireframe, split = false, spread = 0, wallKey, sideLabel, schedPanels, isVertical = true }) {
  const pieces = useMemo(() => {
    if (isVertical) {
      return wallSegments(wallW, wallH, doors).flatMap((s) =>
        panelStrips(s.w, s.cx, split).map((p) => ({
          cx: p.cx, cy: s.cy, along: p.cx,
          label: null,   // vertical uses positional index (assigned below)
          geo: wallPanelGeo(p.w, s.h, p.cx, s.cy, wallW, wallH),
        })))
    }
    // HORIZONTAL: split each segment into full-width horizontal courses (bottom-up),
    // tagging each with its ground-relative course number for the schedule lookup.
    return wallSegments(wallW, wallH, doors).flatMap((s) =>
      panelCourses(s.h, s.cy, split, s.cy - s.h / 2).map((c) => ({
        cx: s.cx, cy: c.cy, along: c.cy,
        courseNo: Math.max(1, Math.round(c.floor / 3) + 1),   // bottom-up course index (0 → course 1)
        geo: wallPanelGeo(s.w, c.h, s.cx, c.cy, wallW, wallH),
      })))
  }, [wallW, wallH, doors, split, isVertical])
  return (
    <>
      {pieces.map((s, i) => {
        // Vertical strips fan out along X (× cx); horizontal courses fan up along Y.
        const px = isVertical ? s.cx + s.cx * spread : s.cx
        const py = isVertical ? s.cy : s.cy + (s.cy - wallH / 2) * spread
        const label = isVertical
          ? panelLabel(schedPanels, i, sideLabel)
          : courseLabel(schedPanels, s.courseNo, sideLabel)
        return (
          <Inspectable key={i} id={`wall:${wallKey}`} label={label} at={[px, py, 0]}>
            <PanelMesh position={[px, py, 0]} geometry={s.geo} color={color} texMap={texMap} wireframe={wireframe} castShadow receiveShadow />
          </Inspectable>
        )
      })}
    </>
  )
}

const frameMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.5, metalness: 0.5 })

// ── Door materials (all doors are white) ──────────────────────────────────────
const DOOR_WHITE     = '#f4f3ef'
const doorMat        = new THREE.MeshStandardMaterial({ color: DOOR_WHITE, roughness: 0.55, metalness: 0.05 })   // wood-frame leaf
const doorMetalMat   = new THREE.MeshStandardMaterial({ color: DOOR_WHITE, roughness: 0.4,  metalness: 0.25 })   // metal / roll-up leaf
const slatLineMat    = new THREE.MeshStandardMaterial({ color: '#d6d4cd', roughness: 0.6,  metalness: 0.1 })
const railMat        = new THREE.MeshStandardMaterial({ color: '#aeb2b6', roughness: 0.5,  metalness: 0.55 })    // base rail / threshold
const handleMat      = new THREE.MeshStandardMaterial({ color: '#8d8f93', roughness: 0.35, metalness: 0.7 })
const glassMat       = new THREE.MeshStandardMaterial({ color: '#bcd6e4', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
const winGlassMat    = new THREE.MeshStandardMaterial({ color: '#bcd6e4', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
const winFrameMat    = new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.5,  metalness: 0.1 })   // white window frame

const RISE = 2.5 / 12   // mobile-home base-rail threshold rise (ft) — stepped over

// Glazing inside a walk-in leaf: diamond (mobile-home) or cottage (rectangular w/ muntins).
function DoorGlazing({ style, w, h }) {
  if (style === 'diamond') {
    const s = Math.min(w * 0.55, 0.95)
    return (
      <mesh position={[0, h * 0.16, 0.04]} rotation={[0, 0, Math.PI / 4]} material={glassMat}>
        <planeGeometry args={[s, s]} />
      </mesh>
    )
  }
  if (style === 'cottage') {
    const ww = w * 0.66, wh = h * 0.34
    return (
      <group position={[0, h * 0.24, 0.04]}>
        <mesh material={glassMat}><planeGeometry args={[ww, wh]} /></mesh>
        <mesh position={[0, 0, 0.005]} material={frameMat}><boxGeometry args={[ww, 0.04, 0.02]} /></mesh>
        <mesh position={[0, 0, 0.005]} material={frameMat}><boxGeometry args={[0.04, wh, 0.02]} /></mesh>
      </group>
    )
  }
  return null
}

// Walk-in door: white leaf shown ajar in its swing direction, with the correct
// threshold (own sill, or a raised base rail for mobile-home doors) and glazing.
function WalkInDoor({ door, w, h }) {
  const onRail = door.mount === 'baserail'
  const rise   = onRail ? RISE : 0
  const leafH  = h - rise
  const slab   = door.frame === 'metal' ? doorMetalMat : doorMat
  const openA  = (door.swing === 'out' ? 1 : -1) * 0.36   // ~21° ajar → reads the swing
  return (
    <group>
      {/* Threshold: raised base rail (step-over) or a flush sill */}
      {onRail ? (
        <mesh position={[0, -h / 2 + rise / 2, 0.01]} material={railMat}>
          <boxGeometry args={[w + 0.06, rise, 0.2]} />
        </mesh>
      ) : (
        <mesh position={[0, -h / 2 + 0.03, 0.02]} material={railMat}>
          <boxGeometry args={[w + 0.02, 0.06, 0.14]} />
        </mesh>
      )}

      {/* Ajar leaf — hinged at the left jamb, swinging in (+z) or out (−z) */}
      <group position={[-w / 2, -h / 2 + rise, 0]} rotation={[0, openA, 0]}>
        <group position={[w / 2, leafH / 2, 0]}>
          <mesh material={slab}><boxGeometry args={[w - 0.06, leafH, 0.05]} /></mesh>
          <mesh position={[w / 2 - 0.2, 0, 0.05]} material={handleMat}>
            <boxGeometry args={[0.05, 0.16, 0.06]} />
          </mesh>
          <DoorGlazing style={door.window} w={w - 0.06} h={leafH} />
        </group>
      </group>
    </group>
  )
}

// White overhead roll-up door with horizontal slat grooves.
function RollUpDoor({ w, h }) {
  const slats = Math.max(3, Math.round(h / 0.9))
  return (
    <group>
      <mesh material={doorMetalMat}><boxGeometry args={[w - 0.08, h - 0.04, 0.06]} /></mesh>
      {Array.from({ length: slats - 1 }).map((_, i) => (
        <mesh key={i} position={[0, -h / 2 + ((i + 1) * h) / slats, 0.035]} material={slatLineMat}>
          <boxGeometry args={[w - 0.12, 0.015, 0.012]} />
        </mesh>
      ))}
    </group>
  )
}

// White-framed window: translucent glass pane set in a white frame with a slim
// cross mullion, so it reads as a real window (not a flat blue panel).
function Window({ w, h }) {
  const fr = 0.12                         // frame thickness
  const gw = Math.max(0.1, w - 0.16), gh = Math.max(0.1, h - 0.16)
  return (
    <group>
      <mesh position={[0, 0, 0.015]} material={winGlassMat}><boxGeometry args={[gw, gh, 0.03]} /></mesh>
      {/* white frame */}
      <mesh position={[0,  h / 2 - fr / 2, 0.03]} material={winFrameMat}><boxGeometry args={[w, fr, 0.06]} /></mesh>
      <mesh position={[0, -h / 2 + fr / 2, 0.03]} material={winFrameMat}><boxGeometry args={[w, fr, 0.06]} /></mesh>
      <mesh position={[-w / 2 + fr / 2, 0, 0.03]} material={winFrameMat}><boxGeometry args={[fr, h, 0.06]} /></mesh>
      <mesh position={[ w / 2 - fr / 2, 0, 0.03]} material={winFrameMat}><boxGeometry args={[fr, h, 0.06]} /></mesh>
      {/* cross mullion */}
      <mesh position={[0, 0, 0.03]} material={winFrameMat}><boxGeometry args={[w - 2 * fr, 0.05, 0.05]} /></mesh>
      <mesh position={[0, 0, 0.03]} material={winFrameMat}><boxGeometry args={[0.05, h - 2 * fr, 0.05]} /></mesh>
    </group>
  )
}

// ── Door visual: click to select, drag to move ────────────────────────────────
function DoorVisual({ door, wallW, wallH, onDragStart, onSelect, selected }) {
  const posX  = (door.xOffset - 0.5) * wallW
  const isWin = door.type === 'window'
  const posY  = isWin && door.yOffset != null ? door.yOffset * wallH : door.height / 2
  const w = door.width, h = door.height
  const ft = 0.12   // frame-out trim thickness

  return (
    <group
      position={[posX, posY, 0.03]}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(door.id); onDragStart(door.id) }}
    >
      {/* Body — omitted for a frame-out so the opening reads see-through */}
      {!door.framed && (
        isWin ? (
          <Window w={w} h={h} />
        ) : door.type === 'walk_in' ? (
          <WalkInDoor door={door} w={w} h={h} />
        ) : (
          <RollUpDoor w={w} h={h} />
        )
      )}

      {/* Frame-out trim — the see-through framed opening (no door installed) */}
      {door.framed && (
        <group position={[0, 0, 0.02]}>
          <mesh position={[0,  h / 2, 0]} material={frameMat}><boxGeometry args={[w + ft, ft, 0.05]} /></mesh>
          <mesh position={[0, -h / 2, 0]} material={frameMat}><boxGeometry args={[w + ft, ft, 0.05]} /></mesh>
          <mesh position={[-w / 2, 0, 0]} material={frameMat}><boxGeometry args={[ft, h + ft, 0.05]} /></mesh>
          <mesh position={[ w / 2, 0, 0]} material={frameMat}><boxGeometry args={[ft, h + ft, 0.05]} /></mesh>
        </group>
      )}

      {/* Selection outline */}
      {selected && (
        <lineSegments position={[0, 0, 0.05]}>
          <edgesGeometry args={[new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.01)]} />
          <lineBasicMaterial color="#00e0ff" />
        </lineSegments>
      )}
    </group>
  )
}

// ── Invisible drag-capture plane — only active while dragging ─────────────────
// Positioned at z=0.08 (slightly in front of door) so it's hit first.
// UV.x directly gives xOffset (0=left wall edge, 1=right wall edge).
function DragPlane({ wallW, wallH, onMove, onUp }) {
  return (
    <mesh
      position={[0, wallH / 2, 0.08]}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.uv) }}
      onPointerUp={(e)   => { e.stopPropagation(); onUp()       }}
      onPointerLeave={(e) => { e.stopPropagation(); onUp()      }}
    >
      <planeGeometry args={[wallW, wallH]} />
      {/* DoubleSide so the drag works whether you're viewing the wall from outside
          or inside (the plane's front face points inward). */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Click-to-place plane (tinted) — shown on every wall while in placement mode.
// Brightens + reports hover so the active wall is obvious.
function PlacePlane({ wallW, wallH, hovered, onPlace, onHover }) {
  return (
    <mesh
      position={[0, wallH / 2, 0.1]}
      onPointerDown={(e)  => { e.stopPropagation(); onPlace(e.uv) }}
      onPointerOver={(e)  => { e.stopPropagation(); onHover(true) }}
      onPointerMove={(e)  => { e.stopPropagation(); onHover(true) }}
      onPointerOut={(e)   => { e.stopPropagation(); onHover(false) }}
    >
      <planeGeometry args={[wallW, wallH]} />
      {/* DoubleSide so a wall can be clicked from EITHER side — looking straight at
          it from outside the building must place on THIS wall, not pass through to
          the far one. */}
      <meshBasicMaterial color="#3b9eff" transparent opacity={hovered ? 0.22 : 0.1} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Perimeter outline of a placeable wall while adding a door / window / frame-out —
// makes it obvious WHICH wall the opening will land on. Every placeable wall is
// outlined faintly (depthTest ON, so only camera-facing walls draw — the far walls
// don't show through and clutter the view); the wall under the cursor lights up
// bright cyan and is drawn OVER the panels (depthTest OFF) so the target pops.
function PlaceHighlight({ wallW, wallH, hovered }) {
  const geo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(wallW, wallH)),
    [wallW, wallH],
  )
  return (
    <lineSegments geometry={geo} position={[0, wallH / 2, 0.12]} renderOrder={50}>
      <lineBasicMaterial
        color={hovered ? '#22e3ff' : '#3b9eff'}
        transparent opacity={hovered ? 1 : 0.45}
        depthTest={!hovered} depthWrite={false}
      />
    </lineSegments>
  )
}

// Floating Resize / Duplicate / Delete toolbar above the selected opening. The
// Size dropdown edits the opening in place (resize) — works for roll-up doors,
// walk-in doors and windows alike.
function DoorToolbar({ door, wallW, wallH, sizes = [], onDup, onDel, onSize }) {
  const posX = (door.xOffset - 0.5) * wallW
  const cy   = door.type === 'window' && door.yOffset != null ? door.yOffset * wallH : door.height / 2
  const btn  = { background: 'rgba(15,23,42,0.95)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 6px', cursor: 'pointer' }
  return (
    <Html position={[posX, cy + door.height / 2 + 0.7, 0.12]} center occlude={false} zIndexRange={[120, 0]}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {sizes.length > 0 && (
          <select
            title="Resize"
            value={door.sizeLabel}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => { const s = sizes.find((z) => z.label === e.target.value); if (s) onSize(s) }}
            style={{ ...btn, padding: '2px 4px' }}
          >
            {sizes.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
        )}
        <button style={btn} onClick={onDup}>Duplicate</button>
        <button style={{ ...btn, color: '#fca5a5' }} onClick={onDel}>Delete</button>
      </div>
    </Html>
  )
}

// All openings on a wall + placement/drag/selection interaction
function OpeningsLayer({ wallKey, wallW, wallH, doors, legOffsets = [] }) {
  const [draggingId, setDraggingId] = useState(null)
  const [hovered, setHovered]       = useState(false)
  const placing           = useBuilderStore((s) => s.placing)
  const selectedId        = useBuilderStore((s) => s.selectedDoorId)
  const setDoorOffset     = useBuilderStore((s) => s.setDoorOffset)
  const setDoorYOffset    = useBuilderStore((s) => s.setDoorYOffset)
  const setIsDraggingDoor = useBuilderStore((s) => s.setIsDraggingDoor)
  const placeDoor         = useBuilderStore((s) => s.placeDoor)
  const selectDoor        = useBuilderStore((s) => s.selectDoor)
  const removeDoor        = useBuilderStore((s) => s.removeDoor)
  const duplicateDoor     = useBuilderStore((s) => s.duplicateDoor)
  const setDoorSize       = useBuilderStore((s) => s.setDoorSize)

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  // Walk-in doors & windows snap so an edge sits right beside the nearest leg.
  const snapBesideLeg = useCallback((x, dw) => {
    let best = clamp(x, dw / 2, 1 - dw / 2), bestD = Infinity
    for (const L of legOffsets) {
      for (const c of [L + dw / 2 + 0.012, L - dw / 2 - 0.012]) {
        const cc = clamp(c, dw / 2, 1 - dw / 2)
        const d = Math.abs(x - cc)
        if (d < bestD) { bestD = d; best = cc }
      }
    }
    return best
  }, [legOffsets])

  // Roll-ups snap an edge to a frame line or wall centre.
  const snapFrame = useCallback((x, dw) => {
    let x2 = clamp(x, dw / 2, 1 - dw / 2), best = null, bestD = 0.04
    for (const f of legOffsets) for (const c of [f + dw / 2, f - dw / 2]) {
      const d = Math.abs(x2 - c); if (d < bestD) { best = c; bestD = d }
    }
    if (Math.abs(x2 - 0.5) < bestD) best = 0.5
    return best != null ? clamp(best, dw / 2, 1 - dw / 2) : x2
  }, [legOffsets])

  // Keep ≥1′6″ from each corner and from neighbouring openings (no overlap).
  const constrainX = useCallback((x, dw, excludeId) => {
    const m = 1.5 / wallW
    const lo = m + dw / 2, hi = 1 - m - dw / 2
    if (lo > hi) return 0.5
    x = clamp(x, lo, hi)
    for (const o of doors) {
      if (o.id === excludeId) continue
      const sep = dw / 2 + (o.width / wallW) / 2 + m
      const oc = o.xOffset ?? 0.5
      if (Math.abs(x - oc) < sep) {
        const left = oc - sep, right = oc + sep
        x = (Math.abs(x - left) <= Math.abs(x - right)) ? left : right
        x = clamp(x, lo, hi)
      }
    }
    return x
  }, [doors, wallW])

  const xFor = (uvx, type, dw, excludeId) => {
    const snapped = (type === 'walk_in' || type === 'window') ? snapBesideLeg(uvx, dw) : snapFrame(uvx, dw)
    return constrainX(snapped, dw, excludeId)
  }

  const onDragStart = useCallback((id) => { setDraggingId(id); setIsDraggingDoor(true) }, [setIsDraggingDoor])
  const onDragEnd   = useCallback(() => { setDraggingId(null); setIsDraggingDoor(false) }, [setIsDraggingDoor])
  const onDragMove  = useCallback((uv) => {
    if (!draggingId || !uv) return
    const d = doors.find((x) => x.id === draggingId); if (!d) return
    const dw = d.width / wallW
    setDoorOffset(draggingId, xFor(uv.x, d.type, dw, draggingId))
    if (d.type === 'window') {
      const half = (d.height / 2) / wallH
      setDoorYOffset(draggingId, clamp(uv.y, half, 1 - half))
    }
  }, [draggingId, doors, wallW, wallH, xFor, setDoorOffset, setDoorYOffset])

  // An existing opening under a click point (uv), if any — so clicking ON one
  // selects/drags it instead of dropping a duplicate on top.
  const openingAt = useCallback((uvx, uvy) => {
    for (const o of doors) {
      const dwHalf = (o.width / wallW) / 2
      const oc = o.xOffset ?? 0.5
      if (Math.abs(uvx - oc) > dwHalf) continue
      if (o.type === 'window' && o.yOffset != null) {
        if (Math.abs(uvy - o.yOffset) > (o.height / 2) / wallH) continue
      }
      return o
    }
    return null
  }, [doors, wallW, wallH])

  const onPlace = useCallback((uv) => {
    if (!placing || !uv) return
    // Clicked ON an existing opening → select + begin dragging it (move, don't
    // duplicate on top). Otherwise drop a new one at the click.
    const hit = openingAt(uv.x, uv.y)
    if (hit) { selectDoor(hit.id); onDragStart(hit.id); return }
    const dw = placing.width / wallW
    const y = placing.type === 'window'
      ? clamp(uv.y, (placing.height / 2) / wallH, 1 - (placing.height / 2) / wallH)
      : null
    placeDoor(wallKey, xFor(uv.x, placing.type, dw, null), y)
  }, [placing, wallW, wallH, wallKey, xFor, placeDoor, openingAt, selectDoor, onDragStart])

  const selDoor = doors.find((d) => d.id === selectedId)

  return (
    <>
      {doors.map((d) => (
        <DoorVisual key={d.id} door={d} wallW={wallW} wallH={wallH}
          onDragStart={onDragStart} onSelect={selectDoor} selected={selectedId === d.id} />
      ))}
      {placing && placing.category !== 'skylight' && !draggingId && (
        <>
          <PlaceHighlight wallW={wallW} wallH={wallH} hovered={hovered} />
          <PlacePlane wallW={wallW} wallH={wallH} hovered={hovered} onPlace={onPlace} onHover={setHovered} />
        </>
      )}
      {draggingId && <DragPlane wallW={wallW} wallH={wallH} onMove={onDragMove} onUp={onDragEnd} />}
      {selDoor && !draggingId && (
        <DoorToolbar door={selDoor} wallW={wallW} wallH={wallH}
          sizes={DOOR_TYPES.find((t) => t.id === selDoor.type)?.sizes ?? []}
          onDup={() => duplicateDoor(selDoor.id)} onDel={() => removeDoor(selDoor.id)}
          onSize={(s) => setDoorSize(selDoor.id, s.w, s.h, s.label)} />
      )}
    </>
  )
}

// ── Single wall face ──────────────────────────────────────────────────────────
function WallFace({
  wallW, wallH, ridgeH, style, isEndWall, wallKey, doors, legOffsets = [],
  color, wireframe, isVertical, roofStyle, panelProfile = 'l5',
  wainscotEnabled, wainscotColor, wainscotWalls, split = false, spread = 0,
  schedPanels = [],
}) {
  const openings = <OpeningsLayer wallKey={wallKey} wallW={wallW} wallH={wallH} doors={doors} legOffsets={legOffsets} />

  const texMap = useMemo(
    () => cloneForWall(isVertical, wallW, wallH, panelProfile),
    [isVertical, wallW, wallH, panelProfile]
  )
  const gableTexMap = useMemo(
    () => cloneForWall(isVertical, wallW, ridgeH - wallH, panelProfile),
    [isVertical, wallW, ridgeH, wallH, panelProfile]
  )

  if (style === 'open') return openings

  // VERTICAL end walls (front/back A-frame) are sheeted with individual floor-to-
  // top-chord strips that THEMSELVES form the gable — no separate triangle piece.
  // Horizontal end walls (regular / a_frame_horizontal) still use a gable infill
  // above the horizontal courses (panels don't run up the rake there).
  const gableFromPanels = isEndWall && isVertical
  const showGable = isEndWall && !gableFromPanels
  const sideLabel = isEndWall ? 'End Wall' : 'Side Wall'
  // Common props for the end-wall gable strips.
  const gableProps = { wallW, wallH, ridgeH, color, texMap, wireframe, spread, wallKey, sideLabel, schedPanels }

  const FIXED_FT = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }
  if (FIXED_FT[style] !== undefined) {
    const band = Math.min(FIXED_FT[style], wallH)
    return (
      <>
        {gableFromPanels
          ? <EndWallGable {...gableProps} yBottom={wallH - band} doors={doors} />
          : <PartialPanel wallW={wallW} wallH={wallH} fraction={band / wallH} color={color} texMap={texMap} wireframe={wireframe} split={split} spread={spread} wallKey={wallKey} sideLabel={sideLabel} schedPanels={schedPanels} isVertical={isVertical} />}
        {showGable && <GableMesh wallW={wallW} wallH={wallH} ridgeH={ridgeH} color={color} texMap={gableTexMap} wireframe={wireframe} roofStyle={roofStyle} />}
        {openings}
      </>
    )
  }

  const FRACTIONS = { quarter_closed: 0.25, half_closed: 0.50, three_quarter_closed: 0.75 }
  if (FRACTIONS[style] !== undefined) {
    return (
      <>
        {/* Fractional closures hang from the eave DOWN (top-anchored) */}
        {gableFromPanels
          ? <EndWallGable {...gableProps} yBottom={wallH * (1 - FRACTIONS[style])} doors={doors} />
          : <PartialPanel wallW={wallW} wallH={wallH} fraction={FRACTIONS[style]} anchor="top" color={color} texMap={texMap} wireframe={wireframe} split={split} spread={spread} wallKey={wallKey} sideLabel={sideLabel} schedPanels={schedPanels} isVertical={isVertical} />}
        {showGable && <GableMesh wallW={wallW} wallH={wallH} ridgeH={ridgeH} color={color} texMap={gableTexMap} wireframe={wireframe} roofStyle={roofStyle} />}
        {openings}
      </>
    )
  }

  const isFullyClosed = style === 'gable' || style === 'closed' || style.startsWith('extended_gable_')
  const WAINSCOT_H    = 3
  // Per-wall override falls back to the global default.
  const effWainscot   = wainscotWalls?.[wallKey] ?? wainscotEnabled
  const showWainscot  = effWainscot && isFullyClosed

  return (
    <>
      {gableFromPanels
        // END WALL (vertical A-frame): floor-to-top-chord strips that FORM the gable
        // (no separate triangle) — each a different length, stepping to the peak.
        ? <EndWallGable {...gableProps} yBottom={0} doors={doors} />
        // SIDE WALL / horizontal: vertical strips OR horizontal courses (door cutouts).
        : <FullWallSegments wallW={wallW} wallH={wallH} doors={doors} color={color} texMap={texMap} wireframe={wireframe} split={split} spread={spread} wallKey={wallKey} sideLabel={sideLabel} schedPanels={schedPanels} isVertical={isVertical} />}
      {showWainscot && (
        // Wainscot = the bottom 3′ band, SAME corrugated panel profile/texture as
        // the wall (ribs line up via wall-relative UVs) but its own color, sitting a
        // hair proud of the wall so it reads as a distinct lower course.
        <PanelMesh position={[0, WAINSCOT_H / 2, -0.02]} geometry={wallPanelGeo(wallW, WAINSCOT_H, 0, WAINSCOT_H / 2, wallW, wallH)}
          color={wainscotColor} texMap={texMap} wireframe={wireframe} castShadow />
      )}
      {showGable && <GableMesh wallW={wallW} wallH={wallH} ridgeH={ridgeH} color={color} texMap={gableTexMap} wireframe={wireframe} roofStyle={roofStyle} />}
      {openings}
    </>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function BuildingWalls({
  width, length, height, walls, doors, ridgeHeight, roofStyle, color, wireframe,
  wainscotEnabled, wainscotColor, wainscotWalls, wallOrientation, frameSpacing = 5, endPostSpacing = 5, panelProfile = 'l5',
  hiddenInstances = {},
}) {
  // Per-instance: 'wall:<side>' hides one wall's panel skin.
  const hidden = (side) => hiddenInstances[`wall:${side}`] === true
  // Per-piece explode: each wall flies out radially + lifts to the 'skin' layer
  // (world offset on the wall group), and its panels fan apart within the wall
  // (local `spread`). amount 0 → offset [0,0,0] and no split (assembled unchanged).
  const { active: exploding, amount, maxDim } = useExplode()
  const wallOff = (anchorX, anchorZ) =>
    exploding ? pieceExplode([anchorX, 0, anchorZ], 'skin', amount, maxDim) : [0, 0, 0]
  // Fan factor for panels WITHIN a wall (feet of extra separation per foot of
  // local-X distance from the wall centre). Scales with amount + building size.
  const spread = exploding ? 0.5 * amount * Math.max(1, maxDim / 26) : 0
  const hw = width / 2
  const hl = length / 2
  // Panels sit just OUTBOARD of the frame so legs / trusses / knee braces / base
  // rail / braces hide from outside but show from the interior + open walls.
  const CLAD = 0.13
  const hwC = hw + CLAD
  const hlC = hl + CLAD

  // Normalised leg positions (0..1 along the wall) so openings can snap beside a
  // post. Side walls carry the length-wise frames; end walls carry the corner +
  // end-wall posts across the width.
  const sideSnaps = useMemo(
    () => frameSpan(length, frameSpacing).map((z) => (z + hl) / length),
    [length, frameSpacing, hl],
  )
  const endSnaps = useMemo(
    () => frameSpan(width, endPostSpacing).map((x) => (x + hw) / width),
    [width, endPostSpacing, hw],
  )
  const resolvedOrientation = wallOrientation === 'auto' || !wallOrientation
    ? (roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal')
    : wallOrientation
  const isVertical = resolvedOrientation === 'vertical'

  const frontDoors = doors.filter((d) => d.wall === 'front')
  const backDoors  = doors.filter((d) => d.wall === 'back')
  const leftDoors  = doors.filter((d) => d.wall === 'left')
  const rightDoors = doors.filter((d) => d.wall === 'right')

  const wainscotHex = wainscotColor?.hex

  // Per-panel LENGTHS for hover come from the SAME schedule the BOM uses. Build a
  // { side → panels[] } map keyed by 'wall:<side>'; each panel row carries its exact
  // `lengthLabel` (e.g. "17'0½\""). Matched to a rendered strip by sheeting order.
  const roofPitch = useBuilderStore((s) => s.roofPitch)
  const schedBySide = useMemo(() => {
    const map = { front: [], back: [], left: [], right: [] }
    try {
      const sched = getPanelSchedule({ width, length, height, roofPitch, roofStyle, walls, wallOrientation })
      for (const entry of sched?.walls ?? []) if (entry?.side) map[entry.side] = entry.panels ?? []
    } catch { /* schedule optional — hover still shows the generic panel index */ }
    return map
  }, [width, length, height, roofPitch, roofStyle, walls, wallOrientation])

  const commonProps = { color, wireframe, isVertical, roofStyle, panelProfile, wainscotEnabled, wainscotColor: wainscotHex, wainscotWalls }

  return (
    <group>
      {/* Front end wall */}
      {!hidden('front') && (() => { const o = wallOff(0, -hlC); return (
        <group position={[o[0], o[1], -hlC + o[2]]}>
          <WallFace wallW={width} wallH={height} ridgeH={ridgeHeight} style={walls.front} isEndWall wallKey="front" doors={frontDoors} legOffsets={endSnaps} split={exploding} spread={spread} schedPanels={schedBySide.front} {...commonProps} />
        </group>
      ) })()}

      {/* Back end wall */}
      {!hidden('back') && (() => { const o = wallOff(0, hlC); return (
        <group position={[o[0], o[1], hlC + o[2]]} rotation={[0, Math.PI, 0]}>
          <WallFace wallW={width} wallH={height} ridgeH={ridgeHeight} style={walls.back} isEndWall wallKey="back" doors={backDoors} legOffsets={endSnaps} split={exploding} spread={spread} schedPanels={schedBySide.back} {...commonProps} />
        </group>
      ) })()}

      {/* Left side wall */}
      {!hidden('left') && (() => { const o = wallOff(-hwC, 0); return (
        <group position={[-hwC + o[0], o[1], o[2]]} rotation={[0, Math.PI / 2, 0]}>
          <WallFace wallW={length} wallH={height} ridgeH={ridgeHeight} style={walls.left} isEndWall={false} wallKey="left" doors={leftDoors} legOffsets={sideSnaps} split={exploding} spread={spread} schedPanels={schedBySide.left} {...commonProps} />
        </group>
      ) })()}

      {/* Right side wall */}
      {!hidden('right') && (() => { const o = wallOff(hwC, 0); return (
        <group position={[hwC + o[0], o[1], o[2]]} rotation={[0, -Math.PI / 2, 0]}>
          <WallFace wallW={length} wallH={height} ridgeH={ridgeHeight} style={walls.right} isEndWall={false} wallKey="right" doors={rightDoors} legOffsets={sideSnaps} split={exploding} spread={spread} schedPanels={schedBySide.right} {...commonProps} />
        </group>
      ) })()}
    </group>
  )
}
