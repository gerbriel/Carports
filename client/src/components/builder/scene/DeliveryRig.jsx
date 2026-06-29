import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { cloneForWall } from './corrugatedTexture'

// Super-Duty extended-cab dually pickup + 30′ tandem trailer loaded with carport
// material: galv wall panels (same profile/texture as the build), a full-length
// hat-channel stack, leg/tube bundles, two stands carrying upside-down trusses, a
// rolled-up door coil beside the trusses, plus a roof rack w/ two orange step
// ladders. Local frame: +X = truck forward; the trailer trails toward −X.

const COL = {
  truck:  '#dfe3e6', truckD: '#b9bfc4',
  trailer:'#2c2f34',
  galv:   '#cdd2d8', galvD: '#aab0b7',
  stand:  '#3a3e44',
  wrap:   '#eceef0',
  tire:   '#1d1f22', rim: '#c6cad0',
  glass:  '#b9d2e2',
  hitch:  '#6a7079',
  ladder: '#e8701b',   // orange step ladders
}

function Wheel({ pos, r = 1.0, w = 0.7 }) {
  return (
    <group position={pos} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[r, r, w, 28]} /><meshStandardMaterial color={COL.tire} roughness={0.95} metalness={0.0} envMapIntensity={0.4} /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[r * 0.52, r * 0.52, w + 0.06, 22]} /><meshStandardMaterial color={COL.rim} metalness={0.9} roughness={0.22} envMapIntensity={1.4} /></mesh>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[r * 0.18, r * 0.18, w + 0.1, 10]} /><meshStandardMaterial color="#2a2c30" metalness={0.5} roughness={0.5} /></mesh>
    </group>
  )
}

// Painted truck/trailer panels get an automotive CLEAR-COAT (glossy reflective
// topcoat) so they catch the sky/HDRI like real vehicle paint. `flat` opts out
// rough/plastic parts (bed liner, bumpers).
function RBox({ args, radius = 0.12, position, rotation, color, metalness = 0.3, roughness = 0.5, flat = false }) {
  return (
    <RoundedBox args={args} radius={Math.min(radius, Math.min(...args) / 2 - 0.001)} smoothness={4}
      position={position} rotation={rotation} castShadow receiveShadow>
      {flat
        ? <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={0.6} />
        : <meshPhysicalMaterial color={color} metalness={metalness} roughness={roughness}
            clearcoat={0.9} clearcoatRoughness={0.12} envMapIntensity={1.2} />}
    </RoundedBox>
  )
}

function Bundle({ pos, len, w = 0.9, h = 0.7, color = COL.galv, metalness = 0.55, roughness = 0.38 }) {
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={[len, h, w]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

// Bundle of hat channels (top-hat section) running the full length. A few nested
// hats stacked so it reads as the purlin/girt stock, not a plain box.
function HatStack({ x, z, y, len, n = 5 }) {
  const CW = 1.5 / 12, DEP = 1.5 / 12, FL = (4.25 / 12 - CW) / 2, WT = 0.035
  const mat = <meshStandardMaterial color={COL.galv} metalness={0.55} roughness={0.4} />
  const Hat = ({ yy }) => (
    <group position={[x, yy, z]}>
      <mesh position={[0, DEP / 2, 0]} castShadow><boxGeometry args={[len, WT, CW]} />{mat}</mesh>
      <mesh position={[0, 0, -CW / 2]}><boxGeometry args={[len, DEP, WT]} />{mat}</mesh>
      <mesh position={[0, 0, CW / 2]}><boxGeometry args={[len, DEP, WT]} />{mat}</mesh>
      <mesh position={[0, -DEP / 2, -(CW / 2 + FL / 2)]}><boxGeometry args={[len, WT, FL]} />{mat}</mesh>
      <mesh position={[0, -DEP / 2, (CW / 2 + FL / 2)]}><boxGeometry args={[len, WT, FL]} />{mat}</mesh>
    </group>
  )
  return <group>{Array.from({ length: n }, (_, i) => <Hat key={i} yy={y + i * 0.16} />)}</group>
}

// Cross-bar stand: a vertical leg on EACH bed-frame edge (z = ±halfW) up to a
// cross bar spanning the width — the trusses/door ride on the bar.
function Stand({ x, deckY, top, halfW }) {
  const legMat = <meshStandardMaterial color={COL.stand} metalness={0.4} roughness={0.55} />
  return (
    <group>
      {[halfW, -halfW].map((z, i) => (
        <mesh key={i} position={[x, deckY + top / 2, z]} castShadow><boxGeometry args={[0.2, top, 0.2]} />{legMat}</mesh>
      ))}
      <mesh position={[x, deckY + top + 0.11, 0]} castShadow><boxGeometry args={[0.5, 0.22, halfW * 2 + 0.2]} />{legMat}</mesh>
    </group>
  )
}

function InvertedTruss({ z, x0, x1, y, depth = 1.5 }) {
  const cx = (x0 + x1) / 2, span = x1 - x0, M = 0.16
  const mat = <meshStandardMaterial color={COL.galv} metalness={0.55} roughness={0.4} />
  const rafter = (dir) => {
    const ax = cx, ay = y, bx = cx + dir * span / 2, by = y + depth
    const len = Math.hypot(bx - ax, by - ay)
    return <mesh position={[(ax + bx) / 2, (ay + by) / 2, z]} rotation={[0, 0, Math.atan2(by - ay, bx - ax)]} castShadow><boxGeometry args={[len, M, M]} />{mat}</mesh>
  }
  return (
    <group>
      <mesh position={[cx, y + depth, z]} castShadow><boxGeometry args={[span, M, M]} />{mat}</mesh>
      {rafter(1)}{rafter(-1)}
      <mesh position={[cx, y + depth / 2, z]} castShadow><boxGeometry args={[M, depth, M]} /><meshStandardMaterial color={COL.galvD} metalness={0.55} roughness={0.4} /></mesh>
    </group>
  )
}

// Heavy-duty 18′ extension ladder FOLDED (two sections nested), lying flat. Orange,
// thick rails. Length along local X — folded length ≈ 9½′.
function Ladder({ pos, len = 9.5, w = 1.5 }) {
  const mat = <meshStandardMaterial color={COL.ladder} metalness={0.15} roughness={0.5} />
  const rungs = Math.max(7, Math.round(len / 1.0))
  const Section = ({ y, dx = 0 }) => (
    <group position={[dx, y, 0]}>
      <mesh position={[0, 0, w / 2]} castShadow><boxGeometry args={[len, 0.2, 0.2]} />{mat}</mesh>
      <mesh position={[0, 0, -w / 2]} castShadow><boxGeometry args={[len, 0.2, 0.2]} />{mat}</mesh>
      {Array.from({ length: rungs }, (_, i) => {
        const lx = -len / 2 + 0.45 + (i / (rungs - 1)) * (len - 0.9)
        return <mesh key={i} position={[lx, 0, 0]}><boxGeometry args={[0.22, 0.11, w - 0.1]} />{mat}</mesh>
      })}
    </group>
  )
  // two folded sections, the fly section nested on top and slid back a touch
  return <group position={pos}><Section y={0} /><Section y={0.26} dx={0.5} /></group>
}

export default function DeliveryRig({ position = [0, 0, 0], rotation = [0, 0, 0], wallColor = '#cdd2d8', panelProfile = 'l5' }) {
  const tr = 1.25                        // tyre radius (Super Duty)
  const deckY = 2.0, halfW = 3.2
  const deckFront = -3, deckBack = -33
  const deckLen = deckBack - deckFront, deckCx = (deckFront + deckBack) / 2
  const s1 = -11, s2 = -28, standTop = 2.6
  const ballX = 1.0, ballY = deckY - 0.35   // shared hitch point (truck + trailer)

  // Trailer panel stack uses the SAME corrugated profile + colour as the wall panels.
  const panelMat = useMemo(() => {
    const tex = cloneForWall(true, 2.4, 1, panelProfile)
    tex.anisotropy = 4
    return new THREE.MeshStandardMaterial({ color: wallColor, map: tex, roughness: 0.58, metalness: 0.32 })
  }, [wallColor, panelProfile])

  return (
    <group position={position} rotation={rotation}>
      {/* ══ Super-Duty extended-cab dually (forward +X) ══ */}
      <group>
        {/* chassis + bed */}
        <RBox args={[9.0, 1.1, 6.4]} radius={0.2} position={[6.8, 2.0, 0]} color={COL.truckD} roughness={0.55} />
        <RBox args={[8.4, 1.5, 6.7]} radius={0.18} position={[6.6, 2.95, 0]} color={COL.truck} />
        <RBox args={[7.8, 1.0, 5.5]} radius={0.1} position={[6.6, 2.95, 0]} color="#33363a" roughness={0.85} flat />
        {/* extended cab (long) + glass + roof */}
        <RBox args={[6.2, 2.4, 6.4]} radius={0.32} position={[13.0, 3.3, 0]} color={COL.truck} />
        <RoundedBox args={[5.4, 1.9, 6.0]} radius={0.28} smoothness={4} position={[13.1, 4.85, 0]} castShadow>
          <meshPhysicalMaterial color={COL.glass} transparent opacity={0.42} roughness={0.04} metalness={0} ior={1.45} envMapIntensity={2.0} />
        </RoundedBox>
        <RBox args={[5.6, 0.34, 6.3]} radius={0.12} position={[13.0, 5.9, 0]} color={COL.truck} />
        {/* 4-door crew cab: door split seams + handles on BOTH sides */}
        {[3.23, -3.23].map((z, si) => (
          <group key={si}>
            {[10.5, 13.0, 15.5].map((x, i) => <mesh key={i} position={[x, 3.4, z]}><boxGeometry args={[0.05, 2.0, 0.05]} /><meshStandardMaterial color="#565b60" metalness={0.3} roughness={0.6} /></mesh>)}
            {[11.7, 14.2].map((x, i) => <mesh key={i} position={[x, 3.75, z]}><boxGeometry args={[0.55, 0.1, 0.1]} /><meshStandardMaterial color="#34373b" metalness={0.5} roughness={0.4} /></mesh>)}
          </group>
        ))}
        {/* hood + tall Super-Duty grille/front bumper */}
        <RBox args={[4.0, 1.9, 6.3]} radius={0.22} position={[17.7, 3.1, 0]} color={COL.truck} />
        <RBox args={[0.6, 1.9, 6.0]} radius={0.1} position={[19.9, 3.2, 0]} color="#2c2f33" roughness={0.55} metalness={0.7} flat />
        {[1.9, -1.9].map((z, i) => <mesh key={i} position={[20.0, 3.3, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.32, 0.32, 0.22, 12]} /><meshStandardMaterial color="#fff3c4" emissive="#fff3c4" emissiveIntensity={0.4} /></mesh>)}
        <RBox args={[0.6, 0.8, 6.6]} radius={0.12} position={[20.3, 2.1, 0]} color="#9aa0a6" metalness={0.6} roughness={0.4} />
        {/* roof rack + 2 orange step ladders laying down */}
        <group position={[13.0, 6.2, 0]}>
          {[2.7, -2.7].map((z, i) => <mesh key={i} position={[0, 0.0, z]}><boxGeometry args={[5.6, 0.12, 0.14]} /><meshStandardMaterial color="#36393d" metalness={0.5} roughness={0.5} /></mesh>)}
          {[-2.4, 0, 2.4].map((x, i) => <mesh key={i} position={[x, 0.0, 0]}><boxGeometry args={[0.14, 0.12, 5.6]} /><meshStandardMaterial color="#36393d" metalness={0.5} roughness={0.5} /></mesh>)}
          <Ladder pos={[-0.6, 0.24, 1.3]} len={9.5} w={1.5} />
          <Ladder pos={[-0.6, 0.24, -1.3]} len={9.5} w={1.5} />
        </group>
        {/* rear bumper + receiver hitch + ball */}
        <RBox args={[0.6, 0.8, 6.6]} radius={0.12} position={[2.4, 2.0, 0]} color="#9aa0a6" metalness={0.6} roughness={0.4} />
        <mesh position={[(ballX + 2.2) / 2, ballY, 0]} castShadow><boxGeometry args={[2.2 - ballX + 0.4, 0.35, 0.35]} /><meshStandardMaterial color={COL.hitch} metalness={0.6} roughness={0.45} /></mesh>
        <mesh position={[ballX, ballY + 0.28, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.3} /></mesh>
        {/* wheels — front pair + rear DUALLY (2 each side) */}
        <Wheel pos={[17.6, tr, 3.1]} r={tr} /><Wheel pos={[17.6, tr, -3.1]} r={tr} />
        {[2.9, 3.75].map((z, i) => <Wheel key={`rl${i}`} pos={[5.0, tr, z]} r={tr} w={0.55} />)}
        {[-2.9, -3.75].map((z, i) => <Wheel key={`rr${i}`} pos={[5.0, tr, z]} r={tr} w={0.55} />)}
      </group>

      {/* ══ Trailer ══ */}
      <group>
        {/* A-frame tongue from the hitch ball back to the deck front corners */}
        {[halfW - 0.6, -(halfW - 0.6)].map((z, i) => {
          const ax = ballX, az = 0, bx = deckFront, bz = z
          const len = Math.hypot(bx - ax, bz - az)
          return <mesh key={i} position={[(ax + bx) / 2, ballY, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]} castShadow><boxGeometry args={[len, 0.32, 0.3]} /><meshStandardMaterial color={COL.trailer} metalness={0.4} roughness={0.55} /></mesh>
        })}
        {/* coupler over the ball */}
        <mesh position={[ballX, ballY + 0.15, 0]} castShadow><boxGeometry args={[1.0, 0.5, 0.5]} /><meshStandardMaterial color={COL.trailer} metalness={0.4} roughness={0.55} /></mesh>
        {/* deck + side rails */}
        <mesh position={[deckCx, deckY - 0.25, 0]} castShadow receiveShadow><boxGeometry args={[deckLen, 0.4, halfW * 2]} /><meshStandardMaterial color={COL.trailer} metalness={0.35} roughness={0.6} /></mesh>
        {[halfW, -halfW].map((z, i) => <mesh key={i} position={[deckCx, deckY + 0.1, z]}><boxGeometry args={[deckLen, 0.5, 0.25]} /><meshStandardMaterial color={COL.trailer} metalness={0.4} roughness={0.55} /></mesh>)}
        {/* tandem fenders + wheels */}
        {[halfW + 0.35, -halfW - 0.35].map((z, i) => <mesh key={i} position={[-24, deckY - 0.1, z]}><boxGeometry args={[6.5, 1.4, 0.5]} /><meshStandardMaterial color={COL.trailer} roughness={0.6} /></mesh>)}
        <Wheel pos={[-22, tr, halfW + 0.35]} r={tr} /><Wheel pos={[-26, tr, halfW + 0.35]} r={tr} />
        <Wheel pos={[-22, tr, -halfW - 0.35]} r={tr} /><Wheel pos={[-26, tr, -halfW - 0.35]} r={tr} />
      </group>

      {/* ══ Cargo ══ */}
      {(() => {
        const deckSurf  = deckY - 0.05
        const crossTopY = deckSurf + standTop + 0.22   // top of the stand cross bar
        return (
      <group>
        {/* 31′ WALL PANELS on the driver side (+Z), same profile + colour as the build */}
        <mesh position={[deckCx, deckSurf + 0.3, 2.2]} castShadow material={panelMat}><boxGeometry args={[31, 0.55, 2.0]} /></mesh>
        {/* hat-channel stack, full length, mid-deck */}
        <HatStack x={deckCx} z={-0.6} y={deckSurf + 0.32} len={deckLen - 2} n={5} />
        {/* leg / tube bundles on the passenger (−Z) side */}
        <Bundle pos={[deckCx, deckSurf + 0.7, -2.5]} len={deckLen - 4} w={0.8} h={0.7} />
        <Bundle pos={[deckCx, deckSurf + 1.4, -2.5]} len={deckLen - 4} w={0.8} h={0.6} color={COL.galvD} />

        {/* two stands — legs land on the bed-frame edges (±halfW) */}
        <Stand x={s1} deckY={deckSurf} top={standTop} halfW={halfW} />
        <Stand x={s2} deckY={deckSurf} top={standTop} halfW={halfW} />

        {/* 5 trusses pushed to the FAR (+Z) side of the stand, away from the door */}
        {[0.4, 0.9, 1.4, 1.9, 2.4].map((z, i) => (
          <InvertedTruss key={i} z={z} x0={-31} x1={-8} y={crossTopY} depth={1.4} />
        ))}

        {/* rolled-up door coil on the passenger (−Z) side — clear of the trusses */}
        <group position={[-19, crossTopY + 1.0, -2.2]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.0, 1.0, 7.5, 24]} /><meshStandardMaterial color={COL.wrap} roughness={0.7} metalness={0.05} /></mesh>
          {[3.8, -3.8].map((x, i) => <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.95, 0.95, 0.05, 24]} /><meshStandardMaterial color={COL.galvD} metalness={0.6} roughness={0.4} /></mesh>)}
        </group>
      </group>
        )
      })()}
    </group>
  )
}
