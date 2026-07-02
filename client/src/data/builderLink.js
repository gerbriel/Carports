// ─────────────────────────────────────────────────────────────────────────────
// Builder context + shareable-config links.
//   • activeBuilderOrg() decides whose builder this is: an ?org=<embedKey> in the
//     URL (white-label embed on a dealer's site) wins; else a logged-in dealer;
//     else the manufacturer (QMC). Drives the logo shown and who owns captured leads.
//   • encode/decodeConfig serialize the building config into a short URL param so a
//     dealer can share a link that re-opens the exact design.
// ─────────────────────────────────────────────────────────────────────────────
import { getOrgByEmbedKey, effectiveUser, getOrg, roleScope, MFR_ORG_ID } from './adminData'

export function activeBuilderOrg(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const key = new URLSearchParams(search).get('org')
  if (key) {
    const o = getOrgByEmbedKey(key)
    if (o) return { org: o, salespersonId: null, embed: true }
  }
  const u = effectiveUser()
  if (u && roleScope(u.role) === 'dealer') return { org: getOrg(u.orgId), salespersonId: u.id, embed: false }
  return { org: getOrg(MFR_ORG_ID), salespersonId: null, embed: false }
}

// View/UI/decor fields we never put in a shared link (keeps URLs short + portable).
const SKIP = new Set([
  'vehicles', 'landscaping', 'isDark', 'viewMode', 'showVehicles', 'showLabels',
  'showDimensions', 'selectedSkylightId', 'selectedPropId', 'selectedVehicleId',
  'requestCameraPreset', 'selectedDoorId', 'placing',
])
// Plain (decoded) config snapshot — the building fields, no functions/decor/UI.
// Stored on a design/lead so a quote can itemize the exact build later.
export function configSnapshot(state) {
  return Object.fromEntries(Object.entries(state).filter(([k, v]) => typeof v !== 'function' && !SKIP.has(k)))
}
export function encodeConfig(state) {
  try { return btoa(encodeURIComponent(JSON.stringify(configSnapshot(state)))) } catch { return '' }
}
export function decodeConfig(str) {
  try { return JSON.parse(decodeURIComponent(atob(str))) } catch { return null }
}
