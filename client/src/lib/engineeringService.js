// Client for the engineering-service (../engineering-service, FastAPI /design).
// Maps the builder config → the service's BuildingSpec, and exposes a debounced
// React hook the Diagnostic panel uses for the live "Engineering" section.
//
// Base URL: set VITE_ENGINEERING_URL to override (defaults to the local dev port).
import { useEffect, useRef, useState } from 'react'
import { deriveStructure } from '../data/structural'

const BASE = import.meta.env.VITE_ENGINEERING_URL || 'http://localhost:8000'

const ROOF_MAP = {
  a_frame_vertical: 'a_frame_vertical',
  a_frame_horizontal: 'a_frame_horizontal',
  regular: 'regular',
  free_standing_lean_to: 'standard', // single-slope
}

// Builder config → service BuildingSpec. We pass the spacing the builder ALREADY
// picked (from the stamped tables) so the service verifies members at the exact
// spacing shown — the "hybrid": JS selects, Python verifies.
export function configToSpec(config) {
  const structure = deriveStructure(config)
  const walls = config.walls || {}
  const wv = ['front', 'back', 'left', 'right'].map((w) => walls[w])
  const allClosed = wv.every((v) => v && v !== 'open')
  const allOpen = wv.every((v) => !v || v === 'open')
  const enclosure = allClosed ? 'enclosed' : allOpen ? 'open' : 'partial'
  const openings = (config.doors || []).map((d) => ({
    kind: d.type === 'window' ? 'window' : d.type === 'walk_in' ? 'walk' : 'rollup',
    width_ft: d.width ?? 3,
    height_ft: d.height ?? 7,
  }))
  return {
    width_ft: config.width,
    length_ft: config.length,
    eave_ft: config.height,
    pitch: config.roofPitch ?? 3,
    roof_style: ROOF_MAP[config.roofStyle] || 'a_frame_vertical',
    enclosure,
    ground_snow_psf: config.groundSnow ?? 30,
    wind_speed_mph: config.windSpeed ?? 105,
    exposure: 'C',
    tube_outer_in: 2.5,
    tube_gauge: config.gauge === 12 ? 12 : 14,
    frame_spacing_ft: structure.spacing,
    purlin_spacing_ft: structure.purlinSpacing,
    girt_spacing_ft: structure.girtSpacing,
    openings,
  }
}

export async function fetchDesign(spec, signal) {
  const res = await fetch(`${BASE}/design`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(spec),
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Debounced fetch keyed on the spec — only re-hits the service when the spec
// actually changes. Returns { data, loading, error }.
export function useEngineering(config, enabled) {
  const [state, setState] = useState({ data: null, loading: false, error: null })
  const specKey = enabled ? JSON.stringify(configToSpec(config)) : null
  const firstErr = useRef(false)

  useEffect(() => {
    if (!enabled || !specKey) return
    const spec = JSON.parse(specKey)
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true }))
    const t = setTimeout(() => {
      fetchDesign(spec, ctrl.signal)
        .then((data) => { firstErr.current = false; setState({ data, loading: false, error: null }) })
        .catch((err) => {
          if (err.name === 'AbortError') return
          firstErr.current = true
          setState((s) => ({ data: s.data, loading: false, error: err.message }))
        })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [specKey, enabled])

  return state
}
