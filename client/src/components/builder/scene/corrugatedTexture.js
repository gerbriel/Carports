import * as THREE from 'three'

// ── Panel profiles (LCA Metals) ───────────────────────────────────────────────
// L5  — ¾" rib height @ 9" centers  (4 ribs per 36" sheet)  · standard
// PBR — 1¼" rib height @ 12" centers (3 ribs per 36" sheet)  · upgrade
// `spacing` = rib centre-to-centre (ft); contrast/ribFrac drive how prominent the
// rib reads (PBR taller → wider, darker shading).
export const PANEL_PROFILES = {
  l5:  { label: 'L5',  spacing: 0.75, contrast: 0.7, ribFrac: 0.16 },
  pbr: { label: 'PBR', spacing: 1.0,  contrast: 1.0, ribFrac: 0.28 },
}

const PANEL_FT = 3   // sheet coverage 36″ — one tile = one panel (seam every 3′)

// A flat pan with a raised rib/seam at each period (R-panel look).
// One 3′ sheet per tile: ribs at the profile's centers + a lap seam at the edge.
function buildCanvas(vertical, profile) {
  const { spacing, contrast, ribFrac } = PANEL_PROFILES[profile] ?? PANEL_PROFILES.l5
  const ribs = Math.max(2, Math.round(PANEL_FT / spacing))   // ribs per 3′ sheet
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')

  ctx.fillStyle = '#e6e6e6'           // flat pan between ribs
  ctx.fillRect(0, 0, S, S)

  const px   = S / ribs
  const ribW = px * ribFrac
  const d    = Math.round(150 - 80 * contrast)   // shadow value
  const drk  = `rgb(${d},${d},${d})`

  for (let i = 0; i < ribs; i++) {
    const p = i * px
    const g = vertical
      ? ctx.createLinearGradient(p, 0, p + ribW, 0)
      : ctx.createLinearGradient(0, p, 0, p + ribW)
    g.addColorStop(0,    '#cfcfcf')
    g.addColorStop(0.18, drk)
    g.addColorStop(0.50, '#ffffff')   // rib crown highlight
    g.addColorStop(0.82, drk)
    g.addColorStop(1,    '#cfcfcf')
    ctx.fillStyle = g
    if (vertical) ctx.fillRect(p, 0, ribW, S)
    else          ctx.fillRect(0, p, S, ribW)
  }

  // Panel lap seam at the sheet edge → a seam every 3′ once tiled
  ctx.fillStyle = 'rgba(58,58,56,0.9)'
  if (vertical) ctx.fillRect(0, 0, 4, S); else ctx.fillRect(0, 0, S, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  if (vertical) ctx.fillRect(4, 0, 2, S); else ctx.fillRect(0, 4, S, 2)
  return cv
}

const cache = {}
function getTex(vertical, profile) {
  const key = `${vertical ? 'v' : 'h'}-${profile}`
  if (!cache[key]) {
    const t = new THREE.CanvasTexture(buildCanvas(vertical, profile))
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    cache[key] = t
  }
  return cache[key]
}

const periodFt = () => PANEL_FT   // one 3′ sheet per tile

// Ribs run left ↔ right — for A-Frame Horizontal and Regular style walls
export function getHorizTex(profile = 'l5') { return getTex(false, profile) }
// Ribs run top ↕ bottom — for A-Frame Vertical walls
export function getVertTex(profile = 'l5')  { return getTex(true,  profile) }

// Clone with repeat sized to a specific wall panel (call once per WallFace)
export function cloneForWall(isVertical, wallW, wallH, profile = 'l5') {
  const t = getTex(isVertical, profile).clone()
  t.needsUpdate = true
  const per = periodFt(profile)          // ft spanned by one texture tile
  if (isVertical) t.repeat.set(wallW / per, 1)   // tile ribs across width
  else            t.repeat.set(1, wallH / per)   // tile ribs up height
  return t
}

// Clone with repeat sized to an A-Frame roof slope panel.
export function cloneForRoof(isVertical, buildingLength, slopeLen, profile = 'l5') {
  const t = getTex(isVertical, profile).clone()
  t.needsUpdate = true
  const per = periodFt(profile)
  if (isVertical) t.repeat.set(buildingLength / per, 1)
  else            t.repeat.set(1, slopeLen / per)
  return t
}
