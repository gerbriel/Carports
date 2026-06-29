import { useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { cloneForWall } from './corrugatedTexture'
import { regularGableShape } from './BuildingRoof'
import { frameSpan } from './BuildingTrusses'
import { flatBasis } from './Skylight'
import { useBuilderStore } from '../../../store/builderStore'
import { panelFinish, DOOR_TYPES } from '../../../data/builderData'

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

// ── Partial panel ──────────────────────────────────────────────────────────────
// anchor 'top'    → panel hangs from the eave down (top-N' styles)
// anchor 'bottom' → panel rises from the ground up (fractional closures)
function PartialPanel({ wallW, wallH, fraction, anchor = 'top', color, texMap, wireframe }) {
  const panelH = wallH * fraction
  const cy = anchor === 'bottom' ? panelH / 2 : wallH - panelH / 2
  const geo = useMemo(() => wallPanelGeo(wallW, panelH, 0, cy, wallW, wallH), [wallW, panelH, cy, wallH])
  return (
    <PanelMesh position={[0, cy, 0]} geometry={geo} color={color} texMap={texMap} wireframe={wireframe} castShadow receiveShadow />
  )
}

// ── Full wall with door cutouts ───────────────────────────────────────────────
function FullWallSegments({ wallW, wallH, doors, color, texMap, wireframe }) {
  const segs = useMemo(
    () => wallSegments(wallW, wallH, doors).map((s) => ({ pos: [s.cx, s.cy, 0], geo: wallPanelGeo(s.w, s.h, s.cx, s.cy, wallW, wallH) })),
    [wallW, wallH, doors],
  )
  return (
    <>
      {segs.map((s, i) => (
        <PanelMesh key={i} position={s.pos} geometry={s.geo} color={color} texMap={texMap} wireframe={wireframe} castShadow receiveShadow />
      ))}
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
  wainscotEnabled, wainscotColor, wainscotWalls,
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

  const showGable = isEndWall

  const FIXED_FT = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }
  if (FIXED_FT[style] !== undefined) {
    return (
      <>
        <PartialPanel wallW={wallW} wallH={wallH} fraction={Math.min(FIXED_FT[style], wallH) / wallH} color={color} texMap={texMap} wireframe={wireframe} />
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
        <PartialPanel wallW={wallW} wallH={wallH} fraction={FRACTIONS[style]} anchor="top" color={color} texMap={texMap} wireframe={wireframe} />
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
      <FullWallSegments wallW={wallW} wallH={wallH} doors={doors} color={color} texMap={texMap} wireframe={wireframe} />
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
}) {
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

  const commonProps = { color, wireframe, isVertical, roofStyle, panelProfile, wainscotEnabled, wainscotColor: wainscotHex, wainscotWalls }

  return (
    <group>
      {/* Front end wall */}
      <group position={[0, 0, -hlC]}>
        <WallFace wallW={width} wallH={height} ridgeH={ridgeHeight} style={walls.front} isEndWall wallKey="front" doors={frontDoors} legOffsets={endSnaps} {...commonProps} />
      </group>

      {/* Back end wall */}
      <group position={[0, 0, hlC]} rotation={[0, Math.PI, 0]}>
        <WallFace wallW={width} wallH={height} ridgeH={ridgeHeight} style={walls.back} isEndWall wallKey="back" doors={backDoors} legOffsets={endSnaps} {...commonProps} />
      </group>

      {/* Left side wall */}
      <group position={[-hwC, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <WallFace wallW={length} wallH={height} ridgeH={ridgeHeight} style={walls.left} isEndWall={false} wallKey="left" doors={leftDoors} legOffsets={sideSnaps} {...commonProps} />
      </group>

      {/* Right side wall */}
      <group position={[hwC, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <WallFace wallW={length} wallH={height} ridgeH={ridgeHeight} style={walls.right} isEndWall={false} wallKey="right" doors={rightDoors} legOffsets={sideSnaps} {...commonProps} />
      </group>
    </group>
  )
}
