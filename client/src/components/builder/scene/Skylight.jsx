import { useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { getVertTex } from './corrugatedTexture'
import { useBuilderStore } from '../../../store/builderStore'

// ── Skylight panels ─────────────────────────────────────────────────────────
// Semi-transparent L5 sheets. One strip = ONE panel wide (3′) running 4–12′ along
// the panel direction of whatever surface it's placed on. A strip is positioned by
// `lane` (0..1 across the run, the panel slot) + `alongOffset` (0..1 start along the
// run) and capped to the surface's run length. Chain several to cover a wider area.
export const SKY_PANEL_W = 3      // one panel wide
export const SKY_MIN     = 4
export const SKY_MAX     = 12
const PANEL_FT = 3                // seam every 3′ along the run
const PROUD    = 0.06             // sit this far proud of the skin so it reads

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── tiny vec3 helpers (plain arrays) ──────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// Flat planar surface basis. uVec spans the ACROSS direction (its length = acrossLen),
// vVec spans the RUN direction (its length = runLen). `outHint` flips the normal so it
// points to the exterior.
export function flatBasis(p0, uVec, vVec, outHint = [0, 1, 0]) {
  const acrossLen = len(uVec), runLen = len(vVec)
  const u = nrm(uVec), v = nrm(vVec)
  let normal = nrm(crs(u, v))
  if (dot(normal, outHint) < 0) normal = scl(normal, -1)
  return {
    acrossLen, runLen, normal,
    at: (lane, along) => add(add(p0, scl(u, lane * acrossLen)), scl(v, along * runLen)),
    normalAt: () => normal,
    project: (P) => {
      const rel = sub(P, p0)
      return { lane: dot(rel, u) / acrossLen, along: dot(rel, v) / runLen }
    },
  }
}

// Curved surface basis (the regular-style bow). The run is straight along +Z; the
// ACROSS direction follows the cross-section curve sampled in X-Y. `samplesXY` =
// [[x,y],…] eave→ridge→eave; `zStart` = run origin; `runLen` = building length.
export function curvedBasis(samplesXY, zStart, runLen, outHint = [0, 1, 0]) {
  const cum = [0]
  for (let i = 1; i < samplesXY.length; i++) {
    const a = samplesXY[i - 1], b = samplesXY[i]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const acrossLen = cum[cum.length - 1] || 1
  const xyAt = (lane) => {
    const target = clamp(lane, 0, 1) * acrossLen
    let i = 1
    while (i < cum.length - 1 && cum[i] < target) i++
    const t = (target - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1])
    const a = samplesXY[i - 1], b = samplesXY[i]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, i]
  }
  const normalAt = (lane) => {
    const [, , i] = xyAt(lane)
    const a = samplesXY[Math.max(0, i - 1)], b = samplesXY[Math.min(samplesXY.length - 1, i)]
    let n = nrm([-(b[1] - a[1]), b[0] - a[0], 0])
    if (dot(n, outHint) < 0) n = scl(n, -1)
    return n
  }
  return {
    acrossLen, runLen, normalAt,
    at: (lane, along) => { const [x, y] = xyAt(lane); return [x, y, zStart + clamp(along, 0, 1) * runLen] },
    project: (P) => {
      let best = 0, bestD = Infinity
      for (let i = 0; i < samplesXY.length; i++) {
        const d = (samplesXY[i][0] - P[0]) ** 2 + (samplesXY[i][1] - P[1]) ** 2
        if (d < bestD) { bestD = d; best = i }
      }
      return { lane: cum[best] / acrossLen, along: (P[2] - zStart) / runLen }
    },
  }
}

// Shared translucent L5 material (uv carries the rib repeat, so one instance works).
let _mat
function skyMat() {
  if (!_mat) {
    const tex = getVertTex('l5').clone()
    tex.needsUpdate = true
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    _mat = new THREE.MeshStandardMaterial({
      color: '#cfe6ff', map: tex, transparent: true, opacity: 0.42,
      roughness: 0.15, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false,
    })
  }
  return _mat
}

// Resolve a skylight's 4 world/local corners from a basis. Returns { corners, center }.
function stripCorners(basis, lane, alongOffset, length) {
  const { acrossLen, runLen } = basis
  const L = clamp(length, SKY_MIN, Math.min(SKY_MAX, runLen))
  const lf = L / runLen
  const halfFrac = (SKY_PANEL_W / 2) / acrossLen
  const laneC = clamp(lane, halfFrac, 1 - halfFrac)
  const a0 = clamp(alongOffset, 0, 1 - lf)
  const a1 = a0 + lf
  const lo = laneC - halfFrac, hi = laneC + halfFrac
  const off = scl(basis.normalAt(laneC), PROUD)
  const corners = [
    add(basis.at(lo, a0), off),
    add(basis.at(hi, a0), off),
    add(basis.at(hi, a1), off),
    add(basis.at(lo, a1), off),
  ]
  const center = scl(corners.reduce(add, [0, 0, 0]), 0.25)
  return { corners, center, L }
}

function stripGeometry(corners, L) {
  const [c0, c1, c2, c3] = corners
  const vL = L / PANEL_FT
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    ...c0, ...c1, ...c2,  ...c0, ...c2, ...c3,
  ]), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0, 0,  1, 0,  1, vL,   0, 0,  1, vL,  0, vL,
  ]), 2))
  g.computeVertexNormals()
  return g
}

// One placed skylight strip (the translucent panel + a selection outline).
function Strip({ basis, sk, selected, onDown }) {
  const { corners, L } = useMemo(
    () => stripCorners(basis, sk.lane, sk.alongOffset, sk.length),
    [basis, sk.lane, sk.alongOffset, sk.length],
  )
  const geo  = useMemo(() => stripGeometry(corners, L), [corners, L])
  const loop = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners.flat()), 3))
    return g
  }, [corners])
  return (
    <group>
      <mesh geometry={geo} material={skyMat()} onPointerDown={(e) => { e.stopPropagation(); onDown(sk.id) }} />
      {selected && <lineLoop geometry={loop}><lineBasicMaterial color="#00e0ff" /></lineLoop>}
    </group>
  )
}

// Tessellated, lightly-tinted patch over a whole surface — catches placement /
// drag pointer events (uses the world hit point, projected through the basis).
function Patch({ basis, color, opacity, onDown, onMove, onUp }) {
  const geo = useMemo(() => {
    const NA = 24, NL = 8
    const pos = []
    // Lift the catch-surface just proud of the skin (above placed strips at PROUD)
    // so it wins the raycast and never z-fights the panel behind it.
    const P = (i, j) => add(basis.at(i / NA, j / NL), scl(basis.normalAt(i / NA), PROUD + 0.04))
    for (let i = 0; i < NA; i++) for (let j = 0; j < NL; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1)
      pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.computeVertexNormals()
    return g
  }, [basis])
  return (
    <mesh
      geometry={geo}
      onPointerDown={onDown ? (e) => { e.stopPropagation(); onDown(e.point.toArray()) } : undefined}
      onPointerMove={onMove ? (e) => { e.stopPropagation(); onMove(e.point.toArray()) } : undefined}
      onPointerUp={onUp ? (e) => { e.stopPropagation(); onUp() } : undefined}
      onPointerLeave={onUp ? (e) => { e.stopPropagation(); onUp() } : undefined}
    >
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Floating Duplicate / Delete toolbar above a selected skylight.
function Toolbar({ center, onDup, onDel }) {
  const btn = { background: 'rgba(15,23,42,0.95)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 6px', cursor: 'pointer' }
  return (
    <Html position={center} center occlude={false} zIndexRange={[120, 0]}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn} onClick={onDup}>Duplicate</button>
        <button style={{ ...btn, color: '#fca5a5' }} onClick={onDel}>Delete</button>
      </div>
    </Html>
  )
}

// A skylight-capable surface (world frame). `basis` maps lane/along ↔ world point.
export default function SkylightSurface({ surfaceKey, basis }) {
  const placing       = useBuilderStore((s) => s.placing)
  const skylights     = useBuilderStore((s) => s.skylights)
  const selectedId    = useBuilderStore((s) => s.selectedSkylightId)
  const placeSkylight = useBuilderStore((s) => s.placeSkylight)
  const selectSkylight   = useBuilderStore((s) => s.selectSkylight)
  const removeSkylight   = useBuilderStore((s) => s.removeSkylight)
  const duplicateSkylight = useBuilderStore((s) => s.duplicateSkylight)
  const setSkylightOffset = useBuilderStore((s) => s.setSkylightOffset)
  const [dragging, setDragging] = useState(false)

  const mine = skylights.filter((k) => k.surfaceKey === surfaceKey)
  const placingSky = placing?.category === 'skylight'
  const sel = mine.find((k) => k.id === selectedId)

  // An existing skylight under a click point, if any.
  const skylightAt = useCallback((P) => {
    const { lane, along } = basis.project(P)
    const halfFrac = (SKY_PANEL_W / 2) / basis.acrossLen
    for (const k of mine) {
      const lf = k.length / basis.runLen
      if (Math.abs(lane - k.lane) <= halfFrac && along >= k.alongOffset && along <= k.alongOffset + lf) return k
    }
    return null
  }, [basis, mine])

  const placeAt = useCallback((P) => {
    // Clicked ON an existing skylight → select + drag it (move, don't stack a copy).
    const hit = skylightAt(P)
    if (hit) { selectSkylight(hit.id); setDragging(true); return }
    const { lane, along } = basis.project(P)
    const L = clamp(placing?.length ?? 8, SKY_MIN, Math.min(SKY_MAX, basis.runLen))
    const lf = L / basis.runLen
    const halfFrac = (SKY_PANEL_W / 2) / basis.acrossLen
    placeSkylight(surfaceKey, clamp(lane, halfFrac, 1 - halfFrac), clamp(along - lf / 2, 0, 1 - lf))
  }, [basis, placing, surfaceKey, placeSkylight, skylightAt, selectSkylight])

  const dragTo = useCallback((P) => {
    if (!sel) return
    const { lane, along } = basis.project(P)
    const L = clamp(sel.length, SKY_MIN, Math.min(SKY_MAX, basis.runLen))
    const lf = L / basis.runLen
    const halfFrac = (SKY_PANEL_W / 2) / basis.acrossLen
    setSkylightOffset(sel.id, clamp(lane, halfFrac, 1 - halfFrac), clamp(along - lf / 2, 0, 1 - lf))
  }, [basis, sel, setSkylightOffset])

  const selCenter = useMemo(
    () => (sel ? stripCorners(basis, sel.lane, sel.alongOffset, sel.length).center : null),
    [basis, sel],
  )

  return (
    <group>
      {mine.map((sk) => (
        <Strip key={sk.id} basis={basis} sk={sk} selected={selectedId === sk.id}
          onDown={(id) => { selectSkylight(id); setDragging(true) }} />
      ))}
      {placingSky && <Patch basis={basis} color="#3b9eff" opacity={0.14} onDown={placeAt} />}
      {sel && dragging && <Patch basis={basis} color="#3b9eff" opacity={0} onMove={dragTo} onUp={() => setDragging(false)} />}
      {sel && !dragging && selCenter && (
        <Toolbar center={selCenter} onDup={() => duplicateSkylight(sel.id)} onDel={() => removeSkylight(sel.id)} />
      )}
    </group>
  )
}
