import { useMemo } from 'react'
import * as THREE from 'three'
import { useBuilderStore } from '../../../store/builderStore'
import {
  M, TRUSS_OH, GABLE_OH, frameSpan, girtCourseHeights, EAVE_DROP, roofLift, purlinRowCount,
} from './BuildingTrusses'
import { Batch } from './BuildingHardware'
import { regularRoofProfile, REGULAR_LIFT } from './BuildingRoof'
import { isFullyClosed } from '../../../data/structural'
import { resolveLeanWings } from '../../../data/leanToTakeoff'
import { leanPurlinTs, LEAN_POST_INSET } from './BuildingLeanTo'
import { useExplode } from './useExplode'

// ── Diagnostic screw layer ───────────────────────────────────────────────────
// Hex-head screw markers at EVERY fastening line, DIAGNOSTIC VIEW ONLY (the
// normal view keeps the clean skin; the frame hardware in BuildingHardware still
// shows everywhere). One InstancedMesh per screw family so thousands of heads
// cost six draw calls. Each family explodes with the layer it fastens:
//   panel→purlin / panel→girt  'skin'   ride out with the sheeting
//   purlin→rafter, girt→post   'secondary'
//   trim runs                  'trim'
//   brace gusset plates        'frame'
// Placement mirrors the member math in BuildingTrusses / BuildingRoof /
// BuildingWalls / BuildingLeanTo — same rows the real screws land on.

const inch = (n) => n / 12
const HAT_DEPTH   = inch(1.5)     // hat-channel depth (mirrors BuildingTrusses)
const HAT_BASE    = inch(4.25)    // hat-channel brim width
const FLOOR_CLEAR = HAT_BASE / 2  // bottom girt centre (mirrors WallGirts)
const CLAD        = 0.13          // wall panel stand-off (mirrors BuildingWalls)
const PANEL_PITCH = 1.5           // ft between panel screws along a fastening line
const TRIM_PITCH  = 2.0           // ft between trim screws

// Screw head: small hex cylinder, axis +Y (instances aim it along the surface normal).
const SCREW_R = inch(0.38) / 2, SCREW_H = inch(0.55)
const screwGeo = new THREE.CylinderGeometry(SCREW_R, SCREW_R, SCREW_H, 6)
const zincMat  = new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.35, metalness: 0.85 })
const darkMat  = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.45, metalness: 0.8 })

const YAXIS = new THREE.Vector3(0, 1, 0)
const qDir = (x, y, z) => new THREE.Quaternion().setFromUnitVectors(YAXIS, new THREE.Vector3(x, y, z).normalize())

// Paneled band [yMin,yMax] for a wall style (mirrors BuildingTrusses.paneledRange).
function paneledRange(style, height) {
  if (!style || style === 'open') return null
  const top = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
  if (top !== undefined) return [Math.max(0, height - top), height]
  const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
  if (frac !== undefined) return [height * (1 - frac), height]
  return [0, height]
}

// Evenly-spaced positions a→b at ~`pitch`, inset from both ends.
function steps(a, b, pitch, inset = 0.3) {
  const lo = a + inset, hi = b - inset
  if (hi <= lo) return [(a + b) / 2]
  const n = Math.max(1, Math.round((hi - lo) / pitch))
  return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * (i / n))
}

export default function BuildingScrews({
  width, length, height, ridgeHeight, roofStyle, structure,
  walls, doors = [], wallOrientation, vis = {}, frameOnly = false, config,
}) {
  const diagnostic = useBuilderStore((s) => s.diagnosticMode)
  const { amount, maxDim } = useExplode()

  // "Colored screws" add-on → panel/trim screw heads painted to match their surface.
  const colored = !!config?.extraOptions?.coloredScrews
  const roofHex = config?.roofColor?.hex, wallHex = config?.wallColor?.hex, trimHex = config?.trimColor?.hex
  const mats = useMemo(() => {
    const mk = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.6 })
    return {
      roof: colored && roofHex ? mk(roofHex) : zincMat,
      wall: colored && wallHex ? mk(wallHex) : zincMat,
      trim: colored && trimHex ? mk(trimHex) : zincMat,
    }
  }, [colored, roofHex, wallHex, trimHex])

  const batches = useMemo(() => {
    if (!diagnostic) return null
    const hw = width / 2, hl = length / 2
    const rise  = ridgeHeight - height
    const pitch = Math.atan2(rise, hw), cp = Math.cos(pitch), sp = Math.sin(pitch)
    const LIFT  = roofLift(width)
    const ohX   = hw + TRUSS_OH
    const ohY   = height - TRUSS_OH * (rise / hw) + LIFT
    const ridgeY = ridgeHeight + LIFT
    const spacing       = structure?.spacing ?? 5
    const endSp         = structure?.endPostSpacing ?? 9
    const purlinSpacing = structure?.purlinSpacing ?? 2.5
    const girtSpacing   = structure?.girtSpacing ?? 4
    const square = width > 30
    const isAF   = roofStyle === 'a_frame' || roofStyle === 'a_frame_vertical'
    const isVerticalWalls = (wallOrientation === 'auto' || !wallOrientation)
      ? roofStyle === 'a_frame_vertical' : wallOrientation === 'vertical'
    const trussZs = frameSpan(length, spacing).map((z) => Math.max(-hl + M / 2, Math.min(hl - M / 2, z)))
    // A-frame skin height at |x| (both slopes are symmetric).
    const ySurf = (x) => ridgeY - (ridgeY - ohY) * (Math.abs(x) / ohX)

    const roofP = [], wallP = [], purl = [], girt = [], trim = [], brace = []

    // A door/window blocks a screw at wall-coord (t along the wall, y up)?
    const doorRects = (wallKey, span) => doors
      .filter((d) => d.wall === wallKey)
      .map((d) => {
        const cc = ((d.xOffset ?? 0.5) - 0.5) * span
        const isWin = d.type === 'window'
        const y0 = isWin && d.yOffset != null ? d.yOffset * height - d.height / 2 : 0
        return { lo: cc - d.width / 2 - 0.15, hi: cc + d.width / 2 + 0.15, y0: y0 - 0.15, y1: y0 + d.height + 0.15 + (isWin ? 0 : 0) }
      })
    const inRect = (rects, t, y) => rects.some((r) => t > r.lo && t < r.hi && y > r.y0 && y < r.y1)

    // ── ROOF panel screws + purlin→rafter screws ────────────────────────────────
    if (!frameOnly && vis.roof !== false && isAF) {
      const zRun = steps(-(hl + GABLE_OH), hl + GABLE_OH, PANEL_PITCH)
      if (roofStyle === 'a_frame_vertical') {
        // Vertical roof panels screw to the purlins — rows at the exact purlin
        // positions (mirrors RoofPurlins), projected up to the skin.
        const xEdge = hw + TRUSS_OH
        const xOut  = xEdge - (HAT_BASE / 2) * cp
        const xTop  = (HAT_BASE / 2) * cp
        const N = purlinRowCount(width, ridgeHeight, height, purlinSpacing)
        for (let i = 0; i < N; i++) {
          const x = N === 1 ? xOut : xOut - (xOut - xTop) * (i / (N - 1))
          for (const sgn of [-1, 1]) {
            const q = qDir(sgn * sp, cp, 0)
            for (const z of zRun) roofP.push({ pos: [sgn * x + sgn * sp * 0.015, ySurf(x) + cp * 0.015, z], quat: q })
          }
        }
      } else {
        // Horizontal roof panels screw straight to the rafters — a column of screws
        // up each slope at every truss plane.
        const xs = steps(0.5, ohX - 0.3, 2.0, 0)
        for (const sgn of [-1, 1]) {
          const q = qDir(sgn * sp, cp, 0)
          for (const z of trussZs) for (const x of xs)
            roofP.push({ pos: [sgn * x + sgn * sp * 0.015, ySurf(x) + cp * 0.015, z], quat: q })
        }
      }
    }
    if (!frameOnly && vis.roof !== false && roofStyle === 'regular') {
      // Regular (curved) roof: panels run front-to-back and screw to each bow.
      // Sample the same skin profile the shell is built from; a screw at every bow
      // crossing, every ~2′ of arc.
      const prof = regularRoofProfile(hw, height, ridgeHeight, REGULAR_LIFT).slice(2, -2)
      const curve = new THREE.CatmullRomCurve3(prof.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', 0.5)
      const nArc = Math.max(4, Math.round(curve.getLength() / 2))
      for (let i = 0; i <= nArc; i++) {
        const t = i / nArc
        const p = curve.getPoint(t), tan = curve.getTangent(t)
        let nx = -tan.y, ny = tan.x                       // surface normal in the section plane…
        if (ny < 0) { nx = -nx; ny = -ny }                 // …forced upward/outboard
        const q = qDir(nx, ny, 0)
        for (const z of trussZs) roofP.push({ pos: [p.x + nx * 0.015, p.y + ny * 0.015, z], quat: q })
      }
    }
    // Purlin→rafter screws (purlins exist only on a_frame_vertical roofs).
    if (vis.purlins !== false && roofStyle === 'a_frame_vertical') {
      const xEdge = hw + TRUSS_OH
      const xOut  = xEdge - (HAT_BASE / 2) * cp
      const xTop  = (HAT_BASE / 2) * cp
      const N = purlinRowCount(width, ridgeHeight, height, purlinSpacing)
      const rafterY = (x) => height + rise * (1 - x / hw)
      const crown = M / 2 + (square ? M : HAT_DEPTH) + 0.008   // rafter face → purlin crown
      for (let i = 0; i < N; i++) {
        const x = N === 1 ? xOut : xOut - (xOut - xTop) * (i / (N - 1))
        for (const sgn of [-1, 1]) {
          const q = qDir(sgn * sp, cp, 0)
          for (const z of trussZs) purl.push({ pos: [sgn * (x + sp * crown), rafterY(x) + cp * crown, z], quat: q })
        }
      }
    }

    // ── WALL panel screws + girt→post screws (the four main walls) ──────────────
    const wallDefs = [
      { key: 'left',  span: length, posts: frameSpan(length, spacing), at: (t, y, off) => [-(hw + off), y, t],  q: qDir(-1, 0, 0) },
      { key: 'right', span: length, posts: frameSpan(length, spacing), at: (t, y, off) => [hw + off, y, t],     q: qDir(1, 0, 0) },
      { key: 'front', span: width,  posts: frameSpan(width, endSp),    at: (t, y, off) => [t, y, -(hl + off)],  q: qDir(0, 0, -1) },
      { key: 'back',  span: width,  posts: frameSpan(width, endSp),    at: (t, y, off) => [t, y, hl + off],     q: qDir(0, 0, 1) },
    ]
    for (const wdef of wallDefs) {
      const band = paneledRange(walls?.[wdef.key], height)
      if (!band) continue
      const rects = doorRects(wdef.key, wdef.span)
      const bottom = Math.max(band[0], FLOOR_CLEAR)
      const top    = Math.min(height, band[1])
      if (top <= bottom + 0.1) continue
      const ys = girtCourseHeights(top, girtSpacing, bottom)
      ys[ys.length - 1] -= EAVE_DROP
      if (isVerticalWalls) {
        // Vertical panels → screws along every girt course; girts screw to each post.
        if (!frameOnly && vis.walls !== false) {
          for (const y of ys) for (const t of steps(-wdef.span / 2, wdef.span / 2, PANEL_PITCH))
            if (!inRect(rects, t, y)) wallP.push({ pos: wdef.at(t, y, CLAD + 0.012), quat: wdef.q })
        }
        if (vis.girts !== false) {
          for (const y of ys) for (const p of wdef.posts)
            if (!inRect(rects, p, y)) girt.push({ pos: wdef.at(p, y, 0.1), quat: wdef.q })
        }
      } else if (!frameOnly && vis.walls !== false) {
        // Horizontal panels screw straight to the posts — a column of screws at
        // every post, one per ~PANEL_PITCH of height.
        for (const p of wdef.posts) for (const y of steps(bottom + 0.3, top - 0.1, PANEL_PITCH, 0))
          if (!inRect(rects, p, y)) wallP.push({ pos: wdef.at(p, y, CLAD + 0.012), quat: wdef.q })
      }
      // Gable triangle above the eave (A-frame closed end walls): screw courses
      // continue up under the roofline.
      if (!frameOnly && vis.walls !== false && isAF && (wdef.key === 'front' || wdef.key === 'back') && isFullyClosed(walls?.[wdef.key])) {
        const roofline = (x) => height + rise * (1 - Math.abs(x) / hw)
        for (const t of steps(-hw, hw, PANEL_PITCH)) {
          for (const y of steps(height + 0.7, roofline(t) - 0.3, girtSpacing, 0)) {
            if (y > height + 0.3 && y < roofline(t) - 0.2) wallP.push({ pos: wdef.at(t, y, CLAD + 0.012), quat: wdef.q })
          }
        }
      }
    }

    // ── TRIM screws: ridge cap, eave, rake, corner ──────────────────────────────
    if (!frameOnly && isAF) {
      if (vis.ridgeCap !== false) {
        const xr = 0.55
        for (const sgn of [-1, 1]) {
          const q = qDir(sgn * sp, cp, 0)
          for (const z of steps(-(hl + GABLE_OH), hl + GABLE_OH, TRIM_PITCH))
            trim.push({ pos: [sgn * xr, ySurf(xr) + cp * 0.035, z], quat: q })
        }
      }
      if (vis.eaveTrim !== false) {
        for (const sgn of [-1, 1]) {
          const q = qDir(sgn, 0, 0)
          for (const z of steps(-hl, hl, TRIM_PITCH))
            trim.push({ pos: [sgn * (ohX + 0.03), ohY - 0.25, z], quat: q })
        }
      }
      if (vis.rakeTrim !== false) {
        for (const zs of [-(hl + GABLE_OH), hl + GABLE_OH]) {
          const q = qDir(0, 0, Math.sign(zs))
          for (const sgn of [-1, 1]) for (const x of steps(0.5, ohX - 0.4, 2.5, 0))
            trim.push({ pos: [sgn * x, ySurf(x) - 0.06, zs + Math.sign(zs) * 0.03], quat: q })
        }
      }
    }
    if (!frameOnly && vis.cornerTrim !== false) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const sideKey = sx < 0 ? 'left' : 'right'
        const endKey  = sz < 0 ? 'front' : 'back'
        if ((walls?.[sideKey] ?? 'open') === 'open' || (walls?.[endKey] ?? 'open') === 'open') continue
        for (const y of steps(0.5, height - 0.4, TRIM_PITCH, 0)) {
          trim.push({ pos: [sx * (hw + CLAD + 0.015), y, sz * (hl - 0.45)], quat: qDir(sx, 0, 0) })
          trim.push({ pos: [sx * (hw - 0.45), y, sz * (hl + CLAD + 0.015)], quat: qDir(0, 0, sz) })
        }
      }
    }

    // ── BRACE gusset-plate screws (diagonal X-bracing) ─────────────────────────
    // Mirrors DiagonalBraces' bay picking: plates at the centre crossing + the four
    // corners of each X bay; a 2×2 screw cluster per plate.
    if (vis.braces !== false && structure?.bracing === 'diagonal') {
      const countFor  = (L) => Math.max(2, Math.ceil(L / 40) + 1)
      const positions = (L, n) => Array.from({ length: n }, (_, i) => (i / (n - 1)) * L)
      const cluster = (pt, q) => {
        for (const du of [-inch(1.5), inch(1.5)]) for (const dv of [-inch(1.5), inch(1.5)]) {
          // spread the cluster in the plate's plane (vertical + along-wall)
          const p = q === 'x' ? [pt[0], pt[1] + dv, pt[2] + du] : [pt[0] + du, pt[1] + dv, pt[2]]
          brace.push({ pos: p, quat: q === 'x' ? qDir(Math.sign(pt[0]) || 1, 0, 0) : qDir(0, 0, Math.sign(pt[2]) || 1) })
        }
      }
      const PLATE_HALF = 0.5
      const placeOnWall = (L, legSpacing, toPt, axis, rects) => {
        const legs = frameSpan(L, legSpacing).map((v) => v + L / 2)
        const bays = []
        for (let i = 0; i < legs.length - 1; i++) bays.push([legs[i], legs[i + 1]])
        if (!bays.length) return
        const used = new Set()
        for (const tp of positions(L, countFor(L))) {
          let bi = -1, bd = Infinity
          bays.forEach((b, i) => {
            if (used.has(i)) return
            const d = Math.abs((b[0] + b[1]) / 2 - tp)
            if (d < bd) { bd = d; bi = i }
          })
          if (bi < 0) continue
          used.add(bi)
          const [a0, a1] = bays[bi]
          const yb = Math.min(PLATE_HALF, height / 2), yt = Math.max(height - PLATE_HALF, height / 2)
          const pts = [[(a0 + a1) / 2, height / 2], [a0, yb], [a1, yb], [a0, yt], [a1, yt]]
          for (const [t, y] of pts) if (!inRect(rects, t - L / 2, y)) cluster(toPt(t, y), axis)
        }
      }
      const INSET = M * 0.6
      for (const sx of [-hw, hw]) {
        const wallKey = sx < 0 ? 'left' : 'right'
        placeOnWall(length, spacing, (t, y) => [sx - Math.sign(sx) * INSET, y, -hl + t], 'x', doorRects(wallKey, length))
      }
      for (const [side, sz] of [['front', -hl], ['back', hl]]) {
        if (!walls?.[side] || walls[side] === 'open') continue
        placeOnWall(width, endSp, (t, y) => [-hw + t, y, sz - Math.sign(sz) * INSET], 'z', doorRects(side, width))
      }
    }

    // ── LEAN-TOS: purlin, roof panel, girt & wall panel screws per wing ─────────
    if (config && vis.leanTos !== false) {
      for (const g of resolveLeanWings(config)) {
        const isSide = g.isSide
        const base = isSide ? hw : hl
        const O = { left: [-1, 0], right: [1, 0], front: [0, -1], back: [0, 1] }[g.side]   // outward (x,z)
        const world = (d, u, y) => isSide
          ? [O[0] * (base + d), y, u]
          : [u, y, O[1] * (base + d)]
        const slopeM = (g.leanH - g.attachH) / g.width
        const ySkin  = (d) => g.attachH + slopeM * d
        // Lean roof normal (in the outward/Y plane, tilted up-slope).
        const nl = Math.hypot(slopeM, 1)
        const nOut = -slopeM / nl, nUp = 1 / nl
        const qRoof = isSide ? qDir(O[0] * nOut, nUp, 0) : qDir(0, nUp, O[1] * nOut)
        const us = frameSpan(g.runLen, g.frameSpacing ?? 5)
        const ts = leanPurlinTs(g.slopeLen, g.width)
        const dOf = (t) => t * (g.width + TRUSS_OH)

        // Roof panel screws — along every purlin row, across the run.
        if (!frameOnly && vis.roof !== false) {
          for (let i = 0; i < ts.length; i++) {
            if (g.continuous && i === 0) continue          // top row = main eave purlin
            const d = dOf(ts[i])
            for (const u of steps(-g.runLen / 2, g.runLen / 2, PANEL_PITCH)) {
              const [wx, wy, wz] = world(d, u, ySkin(d))
              roofP.push({ pos: [wx + (isSide ? O[0] * nOut : 0) * 0.015, wy + nUp * 0.015, wz + (isSide ? 0 : O[1] * nOut) * 0.015], quat: qRoof })
            }
          }
        }
        // Purlin→rafter screws — one per purlin row per frame plane.
        if (vis.purlins !== false) {
          for (let i = 0; i < ts.length; i++) {
            if (g.continuous && i === 0) continue
            const d = dOf(ts[i])
            for (const u of us) {
              const [wx, wy, wz] = world(d, u, ySkin(d) - 0.05)
              purl.push({ pos: [wx, wy, wz], quat: qRoof })
            }
          }
        }
        // Wall courses (main-building girt heights that fit this shorter wall).
        const ys = girtCourseHeights(height, girtSpacing).filter((y) => y <= g.leanH + 0.05)
        if (ys.length) ys[ys.length - 1] -= EAVE_DROP
        const qOut = isSide ? qDir(O[0], 0, 0) : qDir(0, 0, O[1])
        // Outer wall — panels at the outer plane, girts screwed to each outer post.
        if (g.outerClosed && ys.length) {
          if (!frameOnly && vis.walls !== false) {
            for (const y of ys) for (const u of steps(-g.runLen / 2, g.runLen / 2, PANEL_PITCH))
              wallP.push({ pos: world(g.width + 0.012, u, y), quat: qOut })
          }
          if (vis.girts !== false && g.vertical) {
            for (const y of ys) for (const u of us)
              girt.push({ pos: world(g.width - LEAN_POST_INSET + 0.1, u, y), quat: qOut })
          }
        }
        // Closed end walls — trapezoid under the slope; screws stop below the roofline.
        for (const key of g.ends) {
          const sgnU = (key === 'front' || key === 'left') ? -1 : 1
          const qEnd = isSide ? qDir(0, 0, sgnU) : qDir(sgnU, 0, 0)
          if (!frameOnly && vis.walls !== false) {
            for (const y of ys) for (const d of steps(0.2, g.width - 0.2, PANEL_PITCH, 0)) {
              if (y < ySkin(d) - 0.25) {
                const [wx, wy, wz] = world(d, sgnU * (g.runLen / 2 + 0.012), y)
                wallP.push({ pos: [wx, wy, wz], quat: qEnd })
              }
            }
          }
        }
      }
    }

    return { roofP, wallP, purl, girt, trim, brace }
  }, [diagnostic, width, length, height, ridgeHeight, roofStyle, structure, walls, doors, wallOrientation, vis, frameOnly, config])

  if (!diagnostic || !batches) return null
  return (
    <group>
      <Batch geometry={screwGeo} material={mats.roof} items={batches.roofP} amount={amount} maxDim={maxDim} label="Roof Panel Screw" layer="skin" />
      <Batch geometry={screwGeo} material={mats.wall} items={batches.wallP} amount={amount} maxDim={maxDim} label="Wall Panel Screw" layer="skin" />
      <Batch geometry={screwGeo} material={darkMat}  items={batches.purl}  amount={amount} maxDim={maxDim} label="Purlin Screw" layer="secondary" />
      <Batch geometry={screwGeo} material={darkMat}  items={batches.girt}  amount={amount} maxDim={maxDim} label="Girt Screw" layer="secondary" />
      <Batch geometry={screwGeo} material={mats.trim} items={batches.trim}  amount={amount} maxDim={maxDim} label="Trim Screw" layer="trim" />
      <Batch geometry={screwGeo} material={darkMat}  items={batches.brace} amount={amount} maxDim={maxDim} label="Brace Plate Screw" layer="frame" />
    </group>
  )
}
