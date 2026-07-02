import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { M, TRUSS_OH, collarHalfX, frameSpan } from './BuildingTrusses'
import { isFullyClosed } from '../../../data/structural'
import { resolveLeanWings, resolveWrapCorners } from '../../../data/leanToTakeoff'
import { LEAN_POST_INSET } from './BuildingLeanTo'
import { useExplode } from './useExplode'
import { pieceExplode } from '../../../data/explode'
import { Html } from '@react-three/drei'
import { useState } from 'react'
import { useBuilderStore } from '../../../store/builderStore'

// ── Connection hardware (brackets · clips · plates · sleeves · gussets · bolts) ──
// Discrete solids at the REAL connection points, matching the stamped connection
// details (component-models/03-connections-fasteners.md). Rendered in ALL views
// (normal / frame / diagnostic) so the model reads as accurately detailed.
//
// PERFORMANCE: hardware shows at EVERY joint, so one InstancedMesh per hardware
// TYPE (angle bracket, base angle, DB bracket, plate gusset, sleeve, bolt) carries
// every placement as a per-instance transform — draw calls stay flat regardless of
// building size instead of hundreds of separate meshes.
//
// VISIBILITY: each placement rides with its PARENT member. A base sleeve / base
// angle / bracket at a leg foot is skipped when that leg (or the frame) is hidden
// via `hiddenInstances`; knee/peak hardware rides with its truss frame. Type-level
// show() is handled by the caller in Building.jsx (gated with the frame group).

const inch = (n) => n / 12

// Bare-steel bracket/plate finish — matches the frame steel but a touch flatter so
// the folded sheet reads as a separate piece. Bolts/anchors are a darker metal.
const hwMat   = new THREE.MeshStandardMaterial({ color: '#c4c8ce', roughness: 0.5,  metalness: 0.6 })
const boltMat = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.45, metalness: 0.8 })

// ── Geometry primitives (cached, unit-oriented; instances scale/rotate them) ─────
// An L-angle: two thin plates meeting at a right angle, sharing the inside corner.
// legA runs +X, legB runs +Y; both `long` deep along +Z. Origin at the inside
// corner so an instance can be dropped straight into a member's inside pocket.
function lAngleGeo(legW, thick, long) {
  const a = new THREE.BoxGeometry(legW, thick, long).translate(legW / 2,  thick / 2, 0) // horizontal leg (+X)
  const b = new THREE.BoxGeometry(thick, legW, long).translate(thick / 2, legW / 2,  0) // vertical leg (+Y)
  const g = mergeGeometries([a, b], false)
  a.dispose(); b.dispose()
  g.computeVertexNormals()
  return g
}
// A flat plate centred on the origin, thickness on +Z (laid on a member face).
function plateGeo(w, h, thick) {
  return new THREE.BoxGeometry(w, h, thick)
}
// A short square oversleeve tube (hollow) that laps a joint — modeled as a thin
// square RING extruded so the tube wall reads at the cut ends. Long axis = +Y.
function sleeveGeo(size, len, wt) {
  const h = size / 2, ih = Math.max(0.004, h - wt)
  const s = new THREE.Shape()
  s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-ih, -ih); hole.lineTo(-ih, ih); hole.lineTo(ih, ih); hole.lineTo(ih, -ih); hole.closePath()
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: 1 })
  g.translate(0, 0, -len / 2)
  g.rotateX(Math.PI / 2)     // extrude axis Z → Y
  g.computeVertexNormals()
  return g
}
// A short hex-head bolt/screw marker (cylinder, axis = +Y).
function boltGeo(r, h) {
  return new THREE.CylinderGeometry(r, r, h, 6)
}

// ── Bracket dimensions (feet) straight from the spec table ──────────────────────
const ANGLE_LEG   = inch(2),    ANGLE_LONG = inch(2),    G14 = inch(0.083)  // [16] 2×2×2 14ga
const BASE_LEG    = inch(2.5),  BASE_LONG  = inch(3),    G316 = inch(0.1875) // [7]  2½×2½×3 3/16″
const DB_LEG      = inch(2.25), DB_LONG    = inch(6)                          // [21] 2¼×2¼×6 14ga
const PLATE_T     = inch(0.083)                                              // 14ga plate gussets
const PLATE6      = inch(6), PLATE7 = inch(7)
const KP_W = inch(4), KP_H = inch(6), KP_T = inch(0.109)                     // king-post 4×6×12ga
const A325_R = inch(0.75) / 2                                                // ¾″ A325 thru-bolt
const SLEEVE_SZ = M * 1.12                                                   // oversleeve: laps the 2½″ tube
const SLEEVE_WT = 0.03
const BOLT_R = inch(0.4) / 2, BOLT_H = inch(0.6)                             // SDS/screw head marker

// Cached geometries (built once).
const GEO = {
  angle:  lAngleGeo(ANGLE_LEG, G14,  ANGLE_LONG),
  base:   lAngleGeo(BASE_LEG,  G316, BASE_LONG),
  db:     lAngleGeo(DB_LEG,    G14,  DB_LONG),
  plate6: plateGeo(PLATE6, PLATE6, PLATE_T),
  plate7: plateGeo(PLATE7, PLATE7, PLATE_T),
  kp:     plateGeo(KP_W, KP_H, KP_T),
  sleeve: sleeveGeo(SLEEVE_SZ, inch(6), SLEEVE_WT),   // 6″ base/corner sleeve
  bolt:   boltGeo(BOLT_R, BOLT_H),
  a325:   boltGeo(A325_R, M + 2 * KP_T + 0.02),       // thru-bolt spans the peak sandwich
}

// ── One InstancedMesh from a list of {pos,quat,scale} placements ────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3()
// Per-piece explode is baked into each INSTANCE matrix (still one draw call): a
// screw/bolt/bracket pops off its surface radially + lifts to its `layer`.
// amount 0 → offset [0,0,0], so assembled hardware is byte-identical to before.
// Exported so BuildingScrews reuses the same batching for the panel/trim screws.
export function Batch({ geometry, material, items, amount, maxDim, label, layer = 'frame' }) {
  const ref = useRef()
  const diagnostic = useBuilderStore((s) => s.diagnosticMode)
  const setField   = useBuilderStore((s) => s.setField)
  // Hovered instance (id/world-pos) → shows a tooltip on that exact piece.
  const [hovered, setHovered] = useState(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((it, i) => {
      const o = amount > 0 ? pieceExplode(it.pos, layer, amount, maxDim) : ZERO3
      _p.set(it.pos[0] + o[0], it.pos[1] + o[1], it.pos[2] + o[2])
      _q.copy(it.quat ?? IDENTITY_Q)
      _s.set(it.scale?.[0] ?? 1, it.scale?.[1] ?? 1, it.scale?.[2] ?? 1)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    })
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, amount, maxDim, layer])
  if (!items.length) return null
  // In diagnostic mode the raycast reports the exact INSTANCE (instanceId); use it
  // to anchor a tooltip on that specific fastener/bracket + cross-highlight the
  // "Structural Screws" legend row. Cheap: only runs on pointer events.
  const onMove = diagnostic ? (e) => {
    e.stopPropagation()
    const id = e.instanceId
    if (id == null) return
    const it = items[id]
    if (!it) return
    const o = amount > 0 ? pieceExplode(it.pos, layer, amount, maxDim) : ZERO3
    setHovered({ id, pos: [it.pos[0] + o[0], it.pos[1] + o[1], it.pos[2] + o[2]] })
    setField('hoveredPartId', 'structuralScrews')
  } : undefined
  const onOut = diagnostic ? (e) => { e.stopPropagation(); setHovered(null); setField('hoveredPartId', null) } : undefined
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow frustumCulled={false}
        onPointerMove={onMove} onPointerOut={onOut} />
      {hovered && (
        <Html position={hovered.pos} center zIndexRange={[130, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            transform: 'translateY(-16px)', background: 'rgba(15,23,42,0.94)', color: '#fff',
            border: '1px solid rgba(103,232,249,0.6)', borderRadius: 6, padding: '4px 8px',
            font: '600 11px sans-serif', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            <div style={{ color: '#67e8f9', fontWeight: 700 }}>{label}</div>
          </div>
        </Html>
      )}
    </>
  )
}
const ZERO3 = [0, 0, 0]
const IDENTITY_Q = new THREE.Quaternion()

// Quaternion that rotates the default +Y axis (bolt / sleeve long axis) onto `dir`.
const YAXIS = new THREE.Vector3(0, 1, 0)
function quatFromY(dir) {
  return new THREE.Quaternion().setFromUnitVectors(YAXIS, dir.clone().normalize())
}
export default function BuildingHardware({
  width, length, height, ridgeHeight, roofStyle, structure,
  walls, doors = [], windSpeed = 115, hiddenInstances = {},
  config = null,
}) {
  const hidden = (id) => hiddenInstances[id] === true
  // Per-piece explode state, folded into each instance matrix in <Batch>.
  const { amount, maxDim } = useExplode()

  const batches = useMemo(() => {
    const hw = width / 2
    const hl = length / 2
    const spacing   = structure?.spacing ?? 5
    const endSp     = structure?.endPostSpacing ?? 9
    const legGap    = structure?.legGap ?? 0
    const isRegular = roofStyle === 'regular'
    const widespan  = width > 30
    const rise      = (ridgeHeight ?? height) - height
    const pitch     = Math.atan2(rise, hw)
    const inset     = M / 2

    // Wind → sleeve/joint screw count (Table 3.2): 105–125→4, 130–155→6, 160–180→8.
    const sleeveScrews = windSpeed >= 160 ? 8 : windSpeed >= 130 ? 6 : 4

    // Collections (one per hardware type / material split).
    const base = []      // [7] base angle at each post foot
    const sleeve = []    // connector sleeve nipples (base + eave + truss splice)
    const angle = []     // [16] angle bracket (corner posts / header clips)
    const db = []        // [21] DB bracket at knee-brace ends (post + rafter)
    const plate6 = []    // 6×6 gusset (top eave corner)
    const kp = []        // king-post peak gusset (×2 faces per truss)
    const bolt = []      // #12 SDS screw markers
    const a325 = []      // ¾″ A325 thru-bolts (truss peak)

    // Ring of N screw markers around a post at a given height, on the two visible
    // faces, oriented so the head axis points outward from the post face.
    const postScrewRing = (x, y, z, faceAxis) => {
      // faceAxis 'x' → post's exposed faces are ±X; 'z' → ±Z.
      const off = M / 2 + 0.006
      if (faceAxis === 'x') {
        const qx = quatFromY(new THREE.Vector3(1, 0, 0))
        bolt.push({ pos: [x + off, y, z - 0.05], quat: qx })
        bolt.push({ pos: [x + off, y, z + 0.05], quat: qx })
        bolt.push({ pos: [x - off, y, z - 0.05], quat: qx })
        bolt.push({ pos: [x - off, y, z + 0.05], quat: qx })
      } else {
        const qz = quatFromY(new THREE.Vector3(0, 0, 1))
        bolt.push({ pos: [x - 0.05, y, z + off], quat: qz })
        bolt.push({ pos: [x + 0.05, y, z + off], quat: qz })
        bolt.push({ pos: [x - 0.05, y, z - off], quat: qz })
        bolt.push({ pos: [x + 0.05, y, z - off], quat: qz })
      }
    }

    // ── Leg positions (mirror BuildingColumns / BuildingFoundation) ────────────
    const zs = frameSpan(length, spacing).map((z) => Math.max(-hl + inset, Math.min(hl - inset, z)))
    const endXs = frameSpan(width, endSp).slice(1, -1).map((x) => Math.max(-hw + inset, Math.min(hw - inset, x)))

    // A side leg's foot lands inside an opening → BuildingColumns drops it (unless a
    // corner); we mirror that so hardware doesn't hang in mid-air.
    const blocked = (wallKey, span, pos) => doors.some((d) => {
      if (d.wall !== wallKey) return false
      const cc = ((d.xOffset ?? 0.5) - 0.5) * span
      return Math.abs(pos - cc) < d.width / 2 + M / 2
    })

    // ── B1 — BASE CONNECTION: sleeve + base angle + screw ring at each leg foot ──
    const addLegBase = (x, z, faceAxis, inboard, legId) => {
      if (hidden(legId)) return
      // 6″ connector-sleeve nipple projecting up out of the base rail, the post laps
      // it (½″ reveal). Centre it a touch above grade so the reveal shows.
      sleeve.push({ pos: [x, M / 2 + inch(3), z] })
      // [7] base angle at the OUTSIDE base of the post — foot leg reaching inboard
      // across the base rail, vertical leg up the post. Seat so the L hugs the
      // outboard-lower corner of the post foot.
      if (faceAxis === 'x') {
        // post faces ±X; base angle vertical leg up the post's inboard face, foot leg
        // reaching inboard across the base rail.
        const s = inboard[0] // +1 toward centre for left wall, -1 for right
        const rot = new THREE.Quaternion()
        if (s < 0) rot.multiply(new THREE.Quaternion().setFromAxisAngle(YAXIS, Math.PI))
        base.push({ pos: [x + s * (M / 2), inch(0.4), z - BASE_LONG / 2], quat: rot })
      } else {
        const s = inboard[1]
        const rot = new THREE.Quaternion().setFromAxisAngle(YAXIS, s < 0 ? -Math.PI / 2 : Math.PI / 2)
        base.push({ pos: [x - BASE_LONG / 2, inch(0.4), z + s * (M / 2)], quat: rot })
      }
      // (4) #12-14 SDS through the post into the sleeve, ~1.5″ above the joint.
      postScrewRing(x, M / 2 + inch(6), z, faceAxis)
    }

    // Side legs
    zs.forEach((z, i) => {
      const corner = i === 0 || i === zs.length - 1
      if (corner || !blocked('left', length, z))  addLegBase(-hw + M / 2, z, 'x', [1, 0],  `leg:left:${i}`)
      if (corner || !blocked('right', length, z)) addLegBase(hw - M / 2, z, 'x', [-1, 0], `leg:right:${i}`)
    })
    // End-wall posts (closed ends only)
    if (isFullyClosed(walls?.front)) endXs.forEach((x, i) => {
      if (!blocked('front', width, x)) addLegBase(x, -hl + M / 2, 'z', [0, 1], `endpost:front:${i}`)
    })
    if (isFullyClosed(walls?.back)) endXs.forEach((x, i) => {
      if (!blocked('back', width, x)) addLegBase(x, hl - M / 2, 'z', [0, -1], `endpost:back:${i}`)
    })

    // ── B5 — CORNER POST clip [16] + extra anchor screws at the four corners ────
    const corners = [
      [-hw + M / 2, -hl + M / 2, 1, 1],
      [ hw - M / 2, -hl + M / 2, -1, 1],
      [-hw + M / 2,  hl - M / 2, 1, -1],
      [ hw - M / 2,  hl - M / 2, -1, -1],
    ]
    corners.forEach(([cx, cz, sx, sz]) => {
      // 2×2×2 clip angle in the inside corner where the two base rails meet.
      const rot = new THREE.Quaternion()
      if (sx < 0) rot.multiply(new THREE.Quaternion().setFromAxisAngle(YAXIS, Math.PI))
      if (sz < 0) rot.multiply(new THREE.Quaternion().setFromAxisAngle(YAXIS, Math.PI / 2))
      angle.push({ pos: [cx + sx * (M / 2), inch(1.2), cz + sz * (M / 2 - ANGLE_LONG / 2)], quat: rot })
    })

    // ── B1 at LEAN-TO outer-eave posts + wrap-around corner posts ───────────────
    // Same base connection (sleeve + base angle + screw ring) as the main legs —
    // the counted lean-to post sleeves/screws now show at their real joints. Each
    // placement rides with its post (hidden via leanCol:<side>:<i> / leanHipCol:<c>).
    if (config) {
      for (const g of resolveLeanWings(config)) {
        const pts = frameSpan(g.runLen, g.frameSpacing ?? 5)
        pts.forEach((c, i) => {
          const legId = `leanCol:${g.side}:${i}`
          if (g.side === 'left')       addLegBase(-(hw + g.width) + LEAN_POST_INSET, c, 'x', [1, 0],  legId)
          else if (g.side === 'right') addLegBase( (hw + g.width) - LEAN_POST_INSET, c, 'x', [-1, 0], legId)
          else if (g.side === 'front') addLegBase(c, -(hl + g.width) + LEAN_POST_INSET, 'z', [0, 1],  legId)
          else                         addLegBase(c,  (hl + g.width) - LEAN_POST_INSET, 'z', [0, -1], legId)
        })
      }
      for (const c of resolveWrapCorners(config)) {
        const xs = c.corner.includes('left') ? -1 : 1
        const zs = c.corner.includes('front') ? -1 : 1
        const px = xs * (hw + c.sideWidth) - xs * (M / 2)
        const pz = zs * (hl + c.endDepth) - zs * (M / 2)
        addLegBase(px, pz, 'x', [-xs, 0], `leanHipCol:${c.corner}`)
      }
    }

    // ── Truss / frame Z positions (mirror StructuralFrames) ─────────────────────
    const trussZs = frameSpan(length, spacing).map((z) => Math.max(-hl + inset, Math.min(hl - inset, z)))

    // Knee-brace endpoints (identical seating to AFrameTruss / RegularBow).
    const KB   = height > 8 ? 3.0 : 2.0
    const half = M / 2
    const lpX  = hw - half
    const lpY  = height - KB
    const rpX  = hw - KB * Math.cos(pitch) - half * Math.sin(pitch)
    const rpY  = height + KB * Math.sin(pitch) - half * Math.cos(pitch)

    trussZs.forEach((z, i) => {
      const frameId = `frame:${i}`
      if (hidden(frameId)) return
      const endFrame = i === 0 || i === trussZs.length - 1

      // ── B2 — EAVE: 6″ (A-frame) / 8″ (regular) sleeve at each post↔rafter joint,
      // sleeveScrews markers on the post below it. Skip the end frames' knee-brace
      // hardware (end wall braces them), matching StructuralFrames.
      for (const sgn of [-1, 1]) {
        const ex = sgn * (hw - half)
        // eave connector sleeve straddling the post-top / rafter joint
        sleeve.push({ pos: [ex, height - inch(1), z], scale: [1, 1.3, 1] })
        // sleeve screws on the post face (both ±X faces)
        const qx = quatFromY(new THREE.Vector3(1, 0, 0))
        const n = Math.min(4, sleeveScrews)
        for (let s = 0; s < n; s++) {
          const yy = height - inch(4) - s * inch(2.2)
          bolt.push({ pos: [ex + M / 2 + 0.006, yy, z], quat: qx })
          bolt.push({ pos: [ex - M / 2 - 0.006, yy, z], quat: qx })
        }
      }

      if (!endFrame) {
        // ── A4/A5 — DB bracket [21] + 6×6 plate at each eave knee-brace pocket. The
        // brace runs from the leg inboard face (lpX,lpY) to the rafter underside
        // (rpX,rpY); the DB bracket cradles it into the post corner, a 6×6 plate laps
        // the top corner. One per side. These ride with the truss frame (hidden with it).
        for (const sgn of [-1, 1]) {
          // DB bracket in the acute pocket at the LEG end of the knee brace.
          const px = sgn * lpX, py = lpY
          const rot = new THREE.Quaternion()
          if (sgn < 0) rot.multiply(new THREE.Quaternion().setFromAxisAngle(YAXIS, Math.PI))
          db.push({ pos: [px - sgn * (M / 2), py, z - DB_LONG / 2], quat: rot })
          // 6×6 corner gusset laid on the eave top corner (post ↔ rafter), on the
          // interior (+? both) faces of the frame.
          plate6.push({ pos: [sgn * (hw - half), height - inch(2), z + M / 2 + PLATE_T / 2] })
          // (7) SDS: 4 up the DB bracket's post leg, 3 across the 6×6 plate spread
          // along the rafter toward the eave.
          const qz  = quatFromY(new THREE.Vector3(0, 0, 1))
          const qsx = quatFromY(new THREE.Vector3(sgn, 0, 0))
          for (let s = 0; s < 4; s++) bolt.push({ pos: [px - sgn * (M / 2 + 0.006), py - inch(2) + s * inch(1.4), z], quat: qsx })
          for (let s = 0; s < 3; s++) bolt.push({ pos: [sgn * (hw - half - s * inch(1.5)), height - inch(2), z + M / 2 + PLATE_T + 0.006], quat: qz })
        }
      }

      // ── C1 — KING-POST PEAK GUSSET (widespan truss only): 4×6×12ga on EACH face,
      // (10) SDS per plate + (2) ¾″ A325 thru-bolts through the sandwich. ────────
      if (widespan) {
        const cy = ridgeHeight - KP_H * 0.35
        kp.push({ pos: [0, cy, z + M / 2 + KP_T / 2] })   // front face
        kp.push({ pos: [0, cy, z - M / 2 - KP_T / 2] })   // back face
        // 10 SDS per plate (5×2 grid) toward each chord.
        const qz = quatFromY(new THREE.Vector3(0, 0, 1))
        for (const zf of [z + M / 2 + KP_T + 0.006, z - M / 2 - KP_T - 0.006]) {
          for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++)
            bolt.push({ pos: [(c - 0.5) * inch(2), cy + (r - 2) * inch(1.1), zf], quat: qz })
        }
        // (2) A325 thru-bolts through both plates + king post, hex on the back.
        for (let b = 0; b < 2; b++) {
          const by = cy + (b === 0 ? inch(1.5) : -inch(1.5))
          a325.push({ pos: [0, by, z], quat: quatFromY(new THREE.Vector3(0, 0, 1)) })
        }
        // ── C2 — truss chord SPLICE SLEEVE at the bottom-chord centre (fink/flat) ──
        // A short oversleeve laps the bottom-chord flat splice; 20 SDS (rendered as a
        // representative cluster to keep the count sane) at 6″ pitch each side.
        const bcY = height
        const sHalf = Math.min(4, Math.max(1.5, hw - 1.5))
        sleeve.push({ pos: [0, bcY, z], quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), scale: [1, (2 * sHalf) / inch(6), 1] })
        const qy = quatFromY(new THREE.Vector3(0, 1, 0))
        for (let s = -2; s <= 2; s++) if (s !== 0) {
          bolt.push({ pos: [s * inch(6), bcY + M / 2 + 0.006, z], quat: qy })
        }
      }
    })

    return { base, sleeve, angle, db, plate6, kp, bolt, a325 }
  }, [width, length, height, ridgeHeight, roofStyle, structure, walls, doors, windSpeed, hiddenInstances, config])

  return (
    <group>
      <Batch geometry={GEO.base}   material={hwMat}   items={batches.base}   amount={amount} maxDim={maxDim} label="Base Angle Bracket" />
      <Batch geometry={GEO.sleeve} material={hwMat}   items={batches.sleeve} amount={amount} maxDim={maxDim} label="Connector Sleeve" />
      <Batch geometry={GEO.angle}  material={hwMat}   items={batches.angle}  amount={amount} maxDim={maxDim} label="Corner Clip Angle" />
      <Batch geometry={GEO.db}     material={hwMat}   items={batches.db}     amount={amount} maxDim={maxDim} label="DB Knee Bracket" />
      <Batch geometry={GEO.plate6} material={hwMat}   items={batches.plate6} amount={amount} maxDim={maxDim} label="6×6 Gusset Plate" />
      <Batch geometry={GEO.kp}     material={hwMat}   items={batches.kp}     amount={amount} maxDim={maxDim} label="King-Post Gusset" />
      <Batch geometry={GEO.bolt}   material={boltMat} items={batches.bolt}   amount={amount} maxDim={maxDim} label="SDS Screw" />
      <Batch geometry={GEO.a325}   material={boltMat} items={batches.a325}   amount={amount} maxDim={maxDim} label="A325 Thru-Bolt" />
    </group>
  )
}
