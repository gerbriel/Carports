import { useMemo } from 'react'
import * as THREE from 'three'
import { frameSpan, M } from './BuildingTrusses'
import { isFullyClosed } from '../../../data/structural'

const COL   = M
const railY  = M / 2     // base-rail centre height
const OFF    = 0.5       // anchors sit ~6″ from each post (along the base rail)
const LADDER_GAP = 1.2   // matches BuildingColumns built-up leg gap

// Edge references, measured OUTBOARD from the wall line (= the base-rail exterior
// face, since the rail is centred at hw − M/2). The wall panel plane is CLAD past
// it (matches BuildingWalls). flush → slab edge AT the rail exterior; beveled →
// chamfer STARTS at the rail exterior; notched → seat groove AT the panel plane.
const CLAD       = 0.13   // wall-panel plane outboard of the wall line
const BEVEL_RUN  = 0.2    // chamfer horizontal run (outboard)
const BEVEL_DROP = 0.1    // chamfer vertical drop
// Notched edge: at the base rail the pour DROPS 1.5″, then steps OUT 2″ to a lower
// exterior ledge (a rebated slab edge).
const NOTCH_DROP = 1.5 / 12   // 0.125 ft — drop from the base rail
const NOTCH_OUT  = 2.0 / 12   // 0.167 ft — ledge run outboard of the base rail

// ── Materials (shared) ────────────────────────────────────────────────────────
// Medium-grey TEXTURED concrete for the slab: a grey base with fine aggregate
// speckle + faint trowel mottling and a couple of control joints, so the pour
// reads as real broomed concrete instead of a flat grey card. Cached once.
const rnd = (a, b) => a + Math.random() * (b - a)
function buildConcreteCanvas() {
  const S = 256
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#9a9a96'; ctx.fillRect(0, 0, S, S)              // medium grey base
  // aggregate / cement speckle in nearby grey tones
  const tones = ['#8d8d89', '#a6a6a1', '#909090', '#84847e', '#adada7', '#979793']
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = tones[(Math.random() * tones.length) | 0]
    ctx.beginPath()
    ctx.arc(Math.random() * S, Math.random() * S, rnd(0.5, 1.7), 0, Math.PI * 2)
    ctx.fill()
  }
  // faint trowel mottling (soft translucent smudges)
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,120,116' : '180,180,174'},0.05)`
    ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, rnd(6, 22), 0, Math.PI * 2); ctx.fill()
  }
  // control joints (one mid-tile each way) — subtle saw-cut lines
  ctx.strokeStyle = 'rgba(90,90,86,0.45)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke()
  return cv
}
let _concreteTex
function concreteTexture() {
  if (!_concreteTex) {
    _concreteTex = new THREE.CanvasTexture(buildConcreteCanvas())
    _concreteTex.wrapS = _concreteTex.wrapT = THREE.RepeatWrapping
    _concreteTex.colorSpace = THREE.SRGBColorSpace
    _concreteTex.needsUpdate = true
  }
  return _concreteTex
}

const SLAB_MATS = {
  asphalt:  new THREE.MeshStandardMaterial({ color: '#2f2f31', roughness: 0.95, metalness: 0.05 }),
  gravel:   new THREE.MeshStandardMaterial({ color: '#8a7e70', roughness: 0.98, metalness: 0.02 }),
}
const SLAB = {
  concrete: { thick: 0.5,  top: 0.04 },
  asphalt:  { thick: 0.3,  top: 0.04, margin: 3.0 },
  gravel:   { thick: 0.25, top: 0.04, margin: 1.5 },
}
const galv     = new THREE.MeshStandardMaterial({ color: '#9a9da2', roughness: 0.4, metalness: 0.85 })
const bolt     = new THREE.MeshStandardMaterial({ color: '#5f6368', roughness: 0.45, metalness: 0.8 })
const concDark = new THREE.MeshStandardMaterial({ color: '#a9a9a3', roughness: 0.95 })   // notch shadow
const concLite = new THREE.MeshStandardMaterial({ color: '#d2d2cc', roughness: 0.9 })     // bevel face
const buried   = new THREE.MeshStandardMaterial({
  color: '#b6b9be', roughness: 0.4, metalness: 0.85, depthTest: false, transparent: true, opacity: 0.92,
})

// ── Concrete pour edge detail (per side, zoom-in) ─────────────────────────────
// Local frame: x = 0 is the wall line (= base-rail exterior face), +X = outboard,
// +Z = along the wall. Notched = a seat groove AT the panel plane (the wall panel
// drops into it); beveled = a chamfer that STARTS flush with the base-rail edge.
function EdgeRun({ pos, ry, len, edge, top, thick = 0.5 }) {
  if (edge !== 'notched' && edge !== 'beveled') return null
  const ledgeTop = top - NOTCH_DROP            // lower-ledge top surface
  const slabBot  = top - thick                 // slab underside
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      {edge === 'notched' ? (
        // From the base rail (x = 0): the pour DROPS 1.5″ (shadowed step face),
        // then a 2″ lower ledge steps OUT, solid concrete down to the slab bottom.
        <>
          {/* 1.5″ drop / step face at the base rail */}
          <mesh position={[0.012, top - NOTCH_DROP / 2, 0]} material={concDark}>
            <boxGeometry args={[0.024, NOTCH_DROP, len]} />
          </mesh>
          {/* 2″ ledge stepping outboard at the dropped level */}
          <mesh position={[NOTCH_OUT / 2, (ledgeTop + slabBot) / 2, 0]} material={concLite}>
            <boxGeometry args={[NOTCH_OUT, ledgeTop - slabBot, len]} />
          </mesh>
        </>
      ) : (
        // Chamfer beginning FLUSH with the base-rail exterior (x = 0), sloping
        // down-&-out to the slab edge — the wall panel overhangs it.
        <mesh
          position={[BEVEL_RUN / 2, top - BEVEL_DROP / 2, 0]}
          rotation={[0, 0, -Math.atan2(BEVEL_DROP, BEVEL_RUN)]}
          material={concLite}
        >
          <boxGeometry args={[Math.hypot(BEVEL_RUN, BEVEL_DROP) + 0.02, 0.05, len]} />
        </mesh>
      )}
    </group>
  )
}

// ── One anchor at a post foot (local origin = anchor point, y=0 grade) ─────────
// Exported so interior partition-wall posts get the SAME anchor as the perimeter.
export function Anchor({ type, dir = [0, 0] }) {
  const [dx, dz] = dir
  const hex = (r, h, y, mat = bolt) => (
    <mesh position={[0, y, 0]} material={mat}><cylinderGeometry args={[r, r, h, 6]} /></mesh>
  )
  if (type === 'titen') {
    return <group>
      <mesh position={[0, -0.05, 0]} material={galv}><cylinderGeometry args={[0.04, 0.04, 0.6, 8]} /></mesh>
      {hex(0.09, 0.1, railY + 0.14)}
    </group>
  }
  if (type === 'wedge') {
    return <group>
      <mesh position={[0, railY + 0.12, 0]} material={galv}><cylinderGeometry args={[0.035, 0.035, 1.1, 8]} /></mesh>
      {hex(0.085, 0.08, railY + 0.1)}
    </group>
  }
  if (type === 'simpson') {
    const o = 0.28
    return <group>
      <mesh position={[dx * o / 2, railY, dz * o / 2]} material={galv}><boxGeometry args={[dx ? o : 0.22, 0.06, dz ? o : 0.22]} /></mesh>
      <mesh position={[0, railY - 0.07, 0]} material={galv}><boxGeometry args={[0.2, 0.22, 0.2]} /></mesh>
      <mesh position={[dx * o, 0.0, dz * o]} material={galv}><cylinderGeometry args={[0.035, 0.035, 0.7, 8]} /></mesh>
      <mesh position={[dx * o, railY + 0.12, dz * o]} material={bolt}><cylinderGeometry args={[0.08, 0.08, 0.07, 6]} /></mesh>
    </group>
  }
  if (type === 'pin') {
    return <group>
      <mesh position={[0, -1.2, 0]} material={buried} renderOrder={3}><cylinderGeometry args={[0.03, 0.03, 2.8, 6]} /></mesh>
      {hex(0.07, 0.08, railY + 0.1)}
    </group>
  }
  if (type === 'rock') {
    return <group>
      <mesh position={[0, -1.25, 0]} material={buried} renderOrder={3}><cylinderGeometry args={[0.04, 0.04, 3.0, 8]} /></mesh>
      <mesh position={[0, -2.85, 0]} material={buried} renderOrder={3}><coneGeometry args={[0.07, 0.28, 8]} /></mesh>
      {hex(0.08, 0.09, railY + 0.12)}
    </group>
  }
  if (type === 'asphalt') {
    // Driven asphalt spike: a stout pin into the blacktop with a washer head.
    return <group>
      <mesh position={[0, -0.85, 0]} material={buried} renderOrder={3}><cylinderGeometry args={[0.045, 0.03, 2.1, 8]} /></mesh>
      <mesh position={[0, railY + 0.06, 0]} material={galv}><cylinderGeometry args={[0.11, 0.11, 0.04, 12]} /></mesh>
      {hex(0.075, 0.09, railY + 0.13)}
    </group>
  }
  // mobile-home auger
  return <group>
    <mesh position={[0, -1.3, 0]} material={buried} renderOrder={3}><cylinderGeometry args={[0.035, 0.035, 3.1, 8]} /></mesh>
    <mesh position={[0, -2.4, 0]} material={buried} renderOrder={3} rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 0.03, 18]} /></mesh>
    {hex(0.08, 0.09, railY + 0.12)}
  </group>
}

// Welded L-brackets running the LENGTH of a ladder leg's footer rail, one on
// each side of the leg (the rail runs perpendicular to the main base rail).
function LadderLBrackets({ inboard }) {
  const [dx, dz] = inboard
  const g = LADDER_GAP
  // bracket spans inboard along the footer rail; offset to either side of the leg
  const side = dx ? 'x' : 'z'                       // leg footer runs along inboard axis
  const along = (t) => dx ? [dx * g / 2, railY + 0.04, t] : [t, railY + 0.04, dz * g / 2]
  const size  = dx ? [g, 0.07, 0.06] : [0.06, 0.07, g]
  const offs  = [-(COL / 2 + 0.05), (COL / 2 + 0.05)]
  return (
    <group>
      {offs.map((s, i) => (
        <group key={i}>
          <mesh position={along(s)} material={galv}><boxGeometry args={size} /></mesh>
          {/* a couple of bolts along each bracket */}
          {[0.25, 0.85].map((f, j) => {
            const p = dx ? [dx * g * f, railY + 0.12, s] : [s, railY + 0.12, dz * g * f]
            return <mesh key={j} position={p} material={bolt}><cylinderGeometry args={[0.06, 0.06, 0.06, 6]} /></mesh>
          })}
        </group>
      ))}
    </group>
  )
}

// Base trim (closure flashing) laps this far DOWN the outboard concrete face on a
// FLUSH or NOTCHED pour, so the wall finish wraps the slab edge instead of leaving
// bare concrete showing. ≈1.5″.
const BASE_TRIM_DROP = 1.5 / 12
const BASE_TRIM_T    = 0.025   // sheet thickness (exaggerated a touch so it reads)

// ── Slab + anchors ────────────────────────────────────────────────────────────
export default function BuildingFoundation({ width, length, structure, walls, surface, anchorType, slabEdge = 'flat', showAnchors = false, trimColor = '#1a1a1a' }) {
  const hw = width / 2
  const hl = length / 2
  const spacing = structure?.spacing ?? 5
  const endSp   = structure?.endPostSpacing ?? 5
  const sideLeg = structure?.legType ?? 'standard'
  const endLeg  = structure?.endLegType ?? 'standard'
  const inset   = COL / 2

  const feet = useMemo(() => {
    const f = []
    const zs = frameSpan(length, spacing).map((z) => Math.max(-hl + inset, Math.min(hl - inset, z)))
    zs.forEach((z) => {
      f.push({ x: -hw + COL / 2, z, inboard: [1, 0],  rail: [0, 1], legType: sideLeg })
      f.push({ x:  hw - COL / 2, z, inboard: [-1, 0], rail: [0, 1], legType: sideLeg })
    })
    const xs = frameSpan(width, endSp).slice(1, -1).map((x) => Math.max(-hw + inset, Math.min(hw - inset, x)))
    if (isFullyClosed(walls?.front)) xs.forEach((x) => f.push({ x, z: -hl + COL / 2, inboard: [0, 1],  rail: [1, 0], legType: endLeg }))
    if (isFullyClosed(walls?.back))  xs.forEach((x) => f.push({ x, z:  hl - COL / 2, inboard: [0, -1], rail: [1, 0], legType: endLeg }))
    return f
  }, [width, length, spacing, endSp, hw, hl, inset, walls, sideLeg, endLeg])

  // Uncertified buildings anchor on the base rail BETWEEN the legs (one per bay,
  // centred); certified anchors sit 6″ from each leg.
  const certified = !!structure?.certified
  const midAnchors = useMemo(() => {
    if (certified) return []
    const a = []
    const clampZ = (z) => Math.max(-hl + inset, Math.min(hl - inset, z))
    const clampX = (x) => Math.max(-hw + inset, Math.min(hw - inset, x))
    const zs    = frameSpan(length, spacing).map(clampZ)
    const xsI   = frameSpan(width, endSp).slice(1, -1).map(clampX)
    const endXs = [-hw + COL / 2, ...xsI, hw - COL / 2]
    const mids  = (arr) => arr.slice(0, -1).map((v, i) => (v + arr[i + 1]) / 2)
    mids(zs).forEach((mz) => {
      a.push({ x: -hw, z: mz, dir: [1, 0] })
      a.push({ x:  hw, z: mz, dir: [-1, 0] })
    })
    if (isFullyClosed(walls?.front)) mids(endXs).forEach((mx) => a.push({ x: mx, z: -hl, dir: [0, 1] }))
    if (isFullyClosed(walls?.back))  mids(endXs).forEach((mx) => a.push({ x: mx, z:  hl, dir: [0, -1] }))
    return a
  }, [certified, width, length, spacing, endSp, hw, hl, inset, walls])

  const slab = SLAB[surface]
  // Concrete slab half-overhang past the wall line per edge style:
  //   flat    → 1′ apron beyond the building
  //   flush   → 0: edge lands flush with the base-rail exterior (the wall line)
  //   beveled → BEVEL_RUN: slab reaches the chamfer's outboard foot
  //   notched → CLAD + lip: panel seat groove + a small retaining lip outboard
  // Outer extent of the pour past the wall line (footprint / tex / trim).
  const CONC_MARGIN = { flat: 1.0, flush: 0, beveled: BEVEL_RUN, notched: NOTCH_OUT }
  // The FULL-HEIGHT slab box may stop short: a notched edge ends at the base rail,
  // then EdgeRun steps DOWN + OUT to the lower ledge (which the box can't carve).
  const BOX_MARGIN  = { flat: 1.0, flush: 0, beveled: BEVEL_RUN, notched: 0 }
  const margin = slab
    ? (surface === 'concrete' ? (CONC_MARGIN[slabEdge] ?? 0.15) : slab.margin)
    : 0
  const boxMargin = slab
    ? (surface === 'concrete' ? (BOX_MARGIN[slabEdge] ?? margin) : slab.margin)
    : 0
  const top = slab?.top ?? 0
  const ladder = (t) => t === 'ladder' || t === 'zigzag'

  // Base trim: only a FLUSH or NOTCHED concrete pour gets the closure flashing that
  // wraps 1.5″ down the outboard slab face. (Beveled/flat aprons don't.)
  const baseTrim = surface === 'concrete' && (slabEdge === 'flush' || slabEdge === 'notched')
  const baseTrimMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.35, metalness: 0.6 }),
    [trimColor]
  )
  const fx = hw + margin                 // outboard slab face (x) for the L/R walls
  const fz = hl + margin                 // outboard slab face (z) for the F/B walls
  const trimCY = top - BASE_TRIM_DROP / 2
  const trimRunZ = length + 2 * margin + 2 * BASE_TRIM_T   // L/R strips overrun to meet corners

  // Textured medium-grey concrete, tiled ~6′ per repeat across the slab footprint.
  const concreteMat = useMemo(() => {
    const tex = concreteTexture().clone()
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.repeat.set(Math.max(2, (width + 2 * margin) / 6), Math.max(2, (length + 2 * margin) / 6))
    tex.needsUpdate = true
    return new THREE.MeshStandardMaterial({ color: '#9a9a96', map: tex, roughness: 0.92, metalness: 0.04 })
  }, [width, length, margin])
  const slabMat = surface === 'concrete' ? concreteMat : SLAB_MATS[surface]

  return (
    <group>
      {slab && (
        <mesh position={[0, top - slab.thick / 2, 0]} material={slabMat} receiveShadow>
          <boxGeometry args={[width + 2 * boxMargin, slab.thick, length + 2 * boxMargin]} />
        </mesh>
      )}

      {/* Concrete pour edge detail along each wall line */}
      {slab && surface === 'concrete' && (slabEdge === 'notched' || slabEdge === 'beveled') && (
        <group>
          <EdgeRun pos={[ hw, 0, 0]} ry={0}            len={length} edge={slabEdge} top={top} thick={slab.thick} />
          <EdgeRun pos={[-hw, 0, 0]} ry={Math.PI}      len={length} edge={slabEdge} top={top} thick={slab.thick} />
          <EdgeRun pos={[0, 0, -hl]} ry={Math.PI / 2}  len={width}  edge={slabEdge} top={top} thick={slab.thick} />
          <EdgeRun pos={[0, 0,  hl]} ry={-Math.PI / 2} len={width}  edge={slabEdge} top={top} thick={slab.thick} />
        </group>
      )}

      {/* Base trim / closure flashing — wraps 1.5″ down the outboard concrete face
          on a flush or notched pour so the wall finish caps the slab edge. */}
      {baseTrim && (
        <group>
          <mesh position={[ fx + BASE_TRIM_T / 2, trimCY, 0]} material={baseTrimMat} castShadow>
            <boxGeometry args={[BASE_TRIM_T, BASE_TRIM_DROP, trimRunZ]} />
          </mesh>
          <mesh position={[-fx - BASE_TRIM_T / 2, trimCY, 0]} material={baseTrimMat} castShadow>
            <boxGeometry args={[BASE_TRIM_T, BASE_TRIM_DROP, trimRunZ]} />
          </mesh>
          <mesh position={[0, trimCY,  fz + BASE_TRIM_T / 2]} material={baseTrimMat} castShadow>
            <boxGeometry args={[width + 2 * margin, BASE_TRIM_DROP, BASE_TRIM_T]} />
          </mesh>
          <mesh position={[0, trimCY, -fz - BASE_TRIM_T / 2]} material={baseTrimMat} castShadow>
            <boxGeometry args={[width + 2 * margin, BASE_TRIM_DROP, BASE_TRIM_T]} />
          </mesh>
        </group>
      )}

      {/* WELDED L-BRACKETS (Simpson): sit centred on the brackets AT each post —
          regardless of certification. Ladder/zigzag legs get the footer-rail
          L-brackets; other legs get the Simpson bracket. No rail centring / no
          6″ offset (those are only for the bracket-less rebar/rock anchors). */}
      {showAnchors && anchorType === 'simpson' && feet.map((ft, i) =>
        ladder(ft.legType)
          ? <group key={i} position={[ft.x, 0, ft.z]}><LadderLBrackets inboard={ft.inboard} /></group>
          : <group key={i} position={[ft.x, 0, ft.z]}><Anchor type="simpson" dir={ft.inboard} /></group>
      )}

      {/* CERTIFIED, bracket-less (rebar pin / rock / etc.): on the base-rail
          CENTRELINE, 6″ from each post (shift outboard by COL/2 to the centreline). */}
      {showAnchors && anchorType !== 'simpson' && certified && feet.map((ft, i) => {
        const [rx, rz] = ft.rail
        const sgn = rx ? -Math.sign(ft.x || 1) : -Math.sign(ft.z || 1)   // along the rail, toward wall centre
        const cx = -ft.inboard[0] * (COL / 2)
        const cz = -ft.inboard[1] * (COL / 2)
        return (
          <group key={i} position={[ft.x + rx * OFF * sgn + cx, 0, ft.z + rz * OFF * sgn + cz]}>
            <Anchor type={anchorType} dir={ft.inboard} />
          </group>
        )
      })}

      {/* UNCERTIFIED, bracket-less: on the base-rail CENTRELINE, centred BETWEEN
          each pair of posts (one per bay). */}
      {showAnchors && anchorType !== 'simpson' && !certified && midAnchors.map((a, i) => (
        <group key={`m${i}`} position={[a.x, 0, a.z]}>
          <Anchor type={anchorType} dir={a.dir} />
        </group>
      ))}
    </group>
  )
}

// ── Lean-to foundation pad + anchors ──────────────────────────────────────────
// A lean-to can sit on its OWN installation surface, independent of the main
// building. This renders a simple slab pad over the lean-to footprint (the same
// concrete / asphalt / gravel pour as the center build) plus an anchor at each
// outer-eave post foot. 'ground' → no pad, anchors only (matches the main build).
export function LeanToFoundation({ side, mainWidth, length, leanWidth, surface, anchorType, showAnchors = false }) {
  const hw = mainWidth / 2, hl = length / 2
  const isSide = side === 'left' || side === 'right'
  const slab = SLAB[surface]
  const top  = slab?.top ?? 0

  const { cx, cz, sx, sz, colPts } = useMemo(() => {
    if (isSide) {
      const outSign = side === 'left' ? -1 : 1
      const xInner  = outSign * hw
      const xOuter  = outSign * (hw + leanWidth)
      return {
        cx: (xInner + xOuter) / 2, cz: 0, sx: leanWidth, sz: length,
        colPts: frameSpan(length).map((z) => ({ x: xOuter - outSign * (COL / 2), z, dir: [-outSign, 0] })),
      }
    }
    const outSign = side === 'front' ? -1 : 1
    const zInner  = outSign * hl
    const zOuter  = outSign * (hl + leanWidth)
    return {
      cx: 0, cz: (zInner + zOuter) / 2, sx: mainWidth, sz: leanWidth,
      colPts: frameSpan(mainWidth).map((x) => ({ x, z: zOuter - outSign * (COL / 2), dir: [0, -outSign] })),
    }
  }, [side, isSide, mainWidth, length, leanWidth, hw, hl])

  // Apron past the footprint: concrete → 0.5′, asphalt/gravel use their margin.
  const margin = surface === 'concrete' ? 0.5 : (slab?.margin ?? 0.5)

  const concreteMat = useMemo(() => {
    const tex = concreteTexture().clone()
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.repeat.set(Math.max(2, (sx + 2 * margin) / 6), Math.max(2, (sz + 2 * margin) / 6))
    tex.needsUpdate = true
    return new THREE.MeshStandardMaterial({ color: '#9a9a96', map: tex, roughness: 0.92, metalness: 0.04 })
  }, [sx, sz, margin])
  const slabMat = surface === 'concrete' ? concreteMat : SLAB_MATS[surface]

  return (
    <group>
      {slab && (
        <mesh position={[cx, top - slab.thick / 2, cz]} material={slabMat} receiveShadow>
          <boxGeometry args={[sx + 2 * margin, slab.thick, sz + 2 * margin]} />
        </mesh>
      )}
      {showAnchors && colPts.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <Anchor type={anchorType} dir={p.dir} />
        </group>
      ))}
    </group>
  )
}
