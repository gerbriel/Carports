import { useState, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useBuilderStore } from '../../../store/builderStore'
import { useTerrainHeight } from './terrainHeight'
import { useRotateKeys } from './useRotateKeys'
import { useFreeRotate, RotatePlane, RotateDonePill } from './freeRotate'

// ── Procedural low-poly site props ────────────────────────────────────────────
// Built from primitive solids with flat shading so they read as stylised low-poly
// landscaping (no external models). Dimensions are in FEET. Each prop's base sits
// on y = 0 (the ground); callers place/scale/rotate the whole group.

const TRUNK   = '#6b4f33'
const FOLIAGE = ['#4a7c3f', '#3f6e36', '#568a48']

// Shared flat-shaded standard material props.
const leaf = (c) => ({ color: c, roughness: 0.85, metalness: 0, flatShading: true })
const bark = { color: TRUNK, roughness: 0.9, metalness: 0, flatShading: true }

function RoundTree() {
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow><cylinderGeometry args={[0.4, 0.55, 5, 6]} /><meshStandardMaterial {...bark} /></mesh>
      <mesh position={[0, 9, 0]}        castShadow><icosahedronGeometry args={[4.2, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[0])} /></mesh>
      <mesh position={[2.2, 7.5, 0.8]}  castShadow><icosahedronGeometry args={[2.8, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[1])} /></mesh>
      <mesh position={[-2.0, 7.8, -1.0]} castShadow><icosahedronGeometry args={[2.9, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[2])} /></mesh>
    </group>
  )
}

function PineTree() {
  return (
    <group>
      <mesh position={[0, 1.5, 0]}  castShadow><cylinderGeometry args={[0.35, 0.5, 3, 6]} /><meshStandardMaterial {...bark} /></mesh>
      <mesh position={[0, 5.5, 0]}  castShadow><coneGeometry args={[3.6, 6, 7]} /><meshStandardMaterial {...leaf(FOLIAGE[1])} /></mesh>
      <mesh position={[0, 8.5, 0]}  castShadow><coneGeometry args={[2.6, 5, 7]} /><meshStandardMaterial {...leaf(FOLIAGE[0])} /></mesh>
      <mesh position={[0, 11.5, 0]} castShadow><coneGeometry args={[1.6, 4, 7]} /><meshStandardMaterial {...leaf(FOLIAGE[2])} /></mesh>
    </group>
  )
}

function Shrub() {
  return (
    <group>
      <mesh position={[0, 1.3, 0]}    castShadow><icosahedronGeometry args={[1.7, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[1])} /></mesh>
      <mesh position={[1.1, 1.0, 0.4]}  castShadow><icosahedronGeometry args={[1.2, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[2])} /></mesh>
      <mesh position={[-1.0, 1.0, -0.5]} castShadow><icosahedronGeometry args={[1.1, 0]} /><meshStandardMaterial {...leaf(FOLIAGE[0])} /></mesh>
    </group>
  )
}

// ── Structures (scale references): fence, driveway ────────────────────────────
// All dimensions in FEET, base on y = 0. Low-poly flat-shaded to match the trees.
const wall = (c) => ({ color: c, roughness: 0.9, metalness: 0, flatShading: true })

// Default run length per resizable type, and which LOCAL axis the run extends on.
export const DEFAULT_LEN = { fence: 10, driveway: 24 }
export const RUN_AXIS    = { fence: 'x', driveway: 'z' }

// Wood privacy/picket fence section — runs along X so rotating aligns a run.
// `length` is set by DRAWING the run (start → end); picket count scales with it.
function Fence({ length = DEFAULT_LEN.fence }) {
  const L = length, H = 4.5, postC = '#8a6f4e', boardC = '#b3946a'
  const nPickets = Math.max(3, Math.round(L * 1.3))
  const xs = Array.from({ length: nPickets }, (_, i) => -L / 2 + 0.5 + (L - 1) * (i / (nPickets - 1)))
  return (
    <group>
      {/* end posts */}
      {[-L / 2, L / 2].map((x) => (
        <mesh key={x} position={[x, H / 2, 0]} castShadow><boxGeometry args={[0.4, H, 0.4]} /><meshStandardMaterial {...wall(postC)} /></mesh>
      ))}
      {/* rails */}
      {[H - 0.7, 1.0].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[L, 0.3, 0.18]} /><meshStandardMaterial {...wall(boardC)} /></mesh>
      ))}
      {/* pickets */}
      {xs.map((x, i) => (
        <mesh key={i} position={[x, (H - 0.3) / 2, 0]} castShadow><boxGeometry args={[0.5, H - 0.3, 0.1]} /><meshStandardMaterial {...wall(boardC)} /></mesh>
      ))}
    </group>
  )
}

// Concrete driveway slab — length runs along Z so rotating points it at the build.
// `length` is set by DRAWING the run (start → end); joints scale with it.
function Driveway({ length = DEFAULT_LEN.driveway }) {
  const W = 12, L = length, t = 0.12
  const nBays   = Math.max(1, Math.round(L / 8))   // expansion joint every ~8′
  const joints  = Array.from({ length: nBays - 1 }, (_, i) => -L / 2 + L * ((i + 1) / nBays))
  return (
    <group>
      <mesh position={[0, t / 2, 0]} receiveShadow><boxGeometry args={[W, t, L]} /><meshStandardMaterial {...wall('#a6a4a0')} /></mesh>
      {/* expansion joints — thin recessed lines across + down the centre */}
      {joints.map((z) => (
        <mesh key={z} position={[0, t + 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[W, 0.12]} /><meshStandardMaterial color="#86847f" /></mesh>
      ))}
      <mesh position={[0, t + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.12, L]} /><meshStandardMaterial color="#86847f" /></mesh>
    </group>
  )
}

export const PROP_TYPES = [
  { id: 'tree_round', label: 'Shade Tree', group: 'plants' },
  { id: 'tree_pine',  label: 'Pine',       group: 'plants' },
  { id: 'shrub',      label: 'Shrub',      group: 'plants' },
  { id: 'fence',    label: 'Fence',    group: 'structures', aligned: true, selR: 7,  labelH: 7, draw: true },
  { id: 'driveway', label: 'Driveway', group: 'structures', aligned: true, selR: 15, labelH: 4, draw: true },
]
// Per-type metadata (selection-ring radius + delete-button height) for placed props.
export function propMeta(type) {
  return PROP_TYPES.find((t) => t.id === type) ?? {}
}
const RENDER = {
  tree_round: RoundTree, tree_pine: PineTree, shrub: Shrub, fence: Fence, driveway: Driveway,
}

// Transform for a fence/driveway DRAWN from start S → end E: centre = midpoint,
// length = |E−S|, rotation aligns the run axis (fence local +X / driveway local
// +Z) with S→E. (Y-rotation: local +X→(cosθ,−sinθ); local +Z→(sinθ,cosθ).)
export function drawTransform(type, sx, sz, ex, ez) {
  const dx = ex - sx, dz = ez - sz
  const length = Math.max(3, Math.hypot(dx, dz))
  const rotation = RUN_AXIS[type] === 'x' ? Math.atan2(-dz, dx) : Math.atan2(dx, dz)
  return { x: (sx + ex) / 2, z: (sz + ez) / 2, rotation, length }
}

// One placed prop — click to select / drag to reposition. Fences & driveways are
// created at their drawn length/orientation (see the draw flow below).
function Prop({ item, y = 0, selected, onSelect, onDragStart }) {
  const Body = RENDER[item.type] ?? RoundTree
  const r = propMeta(item.type).selR ?? 4
  const len = item.length ?? DEFAULT_LEN[item.type]
  return (
    <group
      position={[item.x, y, item.z]}
      rotation={[0, item.rotation ?? 0, 0]}
      scale={item.scale ?? 1}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(item.id); onDragStart(item.id) }}
    >
      <Body length={len} />
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.6, r, 40]} />
          <meshBasicMaterial color="#00e0ff" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

// Translucent preview of the fence/driveway being drawn (start → current pointer).
function DrawPreview({ type, sx, sz, ex, ez }) {
  const { x, z, rotation, length } = drawTransform(type, sx, sz, ex, ez)
  const w = type === 'driveway' ? 12 : 1.2
  // box local X runs S→E: align with atan2(-dz, dx) regardless of run-axis type.
  const ry = Math.atan2(-(ez - sz), ex - sx)
  return (
    <mesh position={[x, 0.4, z]} rotation={[0, ry, 0]}>
      <boxGeometry args={[length, 0.8, w]} />
      <meshBasicMaterial color="#3b9eff" transparent opacity={0.4} depthWrite={false} />
    </mesh>
  )
}

export default function Landscaping() {
  const items     = useBuilderStore((s) => s.landscaping)
  const placing   = useBuilderStore((s) => s.placing)
  const placeProp = useBuilderStore((s) => s.placeProp)
  const selectProp = useBuilderStore((s) => s.selectProp)
  const removeProp = useBuilderStore((s) => s.removeProp)
  const setPropPos = useBuilderStore((s) => s.setPropPos)
  const selectedId = useBuilderStore((s) => s.selectedPropId)
  const setField   = useBuilderStore((s) => s.setField)

  const placeDrawnProp = useBuilderStore((s) => s.placeDrawnProp)
  const heightAt = useTerrainHeight()
  const [dragId, setDragId] = useState(null)
  const [draw, setDraw] = useState(null)   // { sx, sz, ex, ez } while drawing a run
  const placingProp = placing?.category === 'prop'
  const drawType = placingProp && propMeta(placing.propType).draw ? placing.propType : null

  const rot = useFreeRotate()
  const rotItem = rot.rotId != null ? items.find((p) => p.id === rot.rotId) : null
  // Exit rotate mode if the prop is deselected / deleted / replaced meanwhile.
  useEffect(() => {
    if (rot.rotId != null && selectedId !== rot.rotId) rot.done()
  }, [rot.rotId, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDragStart = (id) => { if (rot.rotId != null) return; setDragId(id); setField('isDraggingBuilding', true) }
  const onDragEnd   = () => { if (dragId != null) { setDragId(null); setField('isDraggingBuilding', false) } }

  // Draw flow: pointer DOWN sets the start; MOVE updates the end (live preview);
  // UP creates the fence/driveway spanning the line. Placing stays sticky.
  const onDrawDown = (x, z) => { setDraw({ sx: x, sz: z, ex: x, ez: z }); setField('isDraggingBuilding', true) }
  const onDrawMove = (x, z) => { if (draw) setDraw((d) => ({ ...d, ex: x, ez: z })) }
  const onDrawUp = () => {
    if (draw) {
      const t = drawTransform(drawType, draw.sx, draw.sz, draw.ex, draw.ez)
      if (Math.hypot(draw.ex - draw.sx, draw.ez - draw.sz) >= 3) {
        placeDrawnProp(drawType, t.x, t.z, t.rotation, t.length)
      }
      setDraw(null); setField('isDraggingBuilding', false)
    }
  }

  const sel = items.find((p) => p.id === selectedId)
  const setPropField = useBuilderStore((s) => s.setPropField)

  // Q/E (or ←/→) rotate the selected prop from ANY zoom.
  useRotateKeys(!!sel && rot.rotId == null, (d) => setPropField(sel.id, 'rotation', (sel.rotation ?? 0) + d))

  return (
    <group>
      {items.map((item) => (
        <Prop key={item.id} item={item} y={heightAt(item.x, item.z)} selected={selectedId === item.id} onSelect={selectProp} onDragStart={onDragStart} />
      ))}

      {/* Live preview of the run being drawn */}
      {draw && drawType && <DrawPreview type={drawType} {...draw} />}

      {/* Catch plane while placing. Fence/driveway → DRAW (down-move-up draws the
          run); plants → click-to-drop. */}
      {placingProp && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => { e.stopPropagation(); drawType ? onDrawDown(e.point.x, e.point.z) : placeProp(e.point.x, e.point.z) }}
          onPointerMove={(e) => { if (drawType && draw) { e.stopPropagation(); onDrawMove(e.point.x, e.point.z) } }}
          onPointerUp={(e) => { if (drawType) { e.stopPropagation(); onDrawUp() } }}
          onPointerLeave={() => { if (drawType) onDrawUp() }}>
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial color="#3b9eff" transparent opacity={0.06} depthWrite={false} />
        </mesh>
      )}

      {/* Drag plane — active only while dragging a placed prop */}
      {dragId != null && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => { e.stopPropagation(); setPropPos(dragId, e.point.x, e.point.z) }}
          onPointerUp={(e) => { e.stopPropagation(); onDragEnd() }}
          onPointerLeave={() => onDragEnd()}>
          <planeGeometry args={[600, 600]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Free-rotate mode: prop follows the mouse; ✓ / ground click / Enter places it */}
      {rotItem && (
        <>
          <RotatePlane
            onMove={(px, pz) => setPropField(rotItem.id, 'rotation', rot.track(rotItem.x, rotItem.z, rotItem.rotation ?? 0, px, pz))}
            onDone={rot.done}
          />
          <RotateDonePill
            position={[rotItem.x, heightAt(rotItem.x, rotItem.z) + (propMeta(rotItem.type).labelH ?? 14) * (rotItem.scale ?? 1) + 3, rotItem.z]}
            onDone={rot.done}
          />
        </>
      )}

      {/* Floating controls above the selected prop: free rotate + delete */}
      {sel && dragId == null && rot.rotId == null && (
        <Html position={[sel.x, heightAt(sel.x, sel.z) + (propMeta(sel.type).labelH ?? 14) * (sel.scale ?? 1), sel.z]} center occlude={false} zIndexRange={[120, 0]}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              title="Free rotate — the prop follows your mouse; click ✓ or the ground to place. (Q/E nudge 15°)"
              onClick={() => rot.begin(sel.id)}
              style={{ background: 'rgba(15,23,42,0.95)', color: '#bae6fd', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Rotate</button>
            <button
              onClick={() => removeProp(sel.id)}
              style={{ background: 'rgba(15,23,42,0.95)', color: '#fca5a5', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 10, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Delete</button>
          </div>
        </Html>
      )}
    </group>
  )
}
