// ─────────────────────────────────────────────────────────────────────────────
// Lead pipeline — the full job lifecycle, split into two progress tracks:
//   • dealer track  — sales / permitting / scheduling (what the dealer drives)
//   • mfr track     — manufacturing / install / close-out (what QMC drives)
// Each lead stores progress in `lead.pipeline = { [key]: value, _ts: {...} }`.
// Stages flagged `neutral` are situational flags (e.g. rental equipment, repairs)
// that don't count toward the forward-progress percentage.
// ─────────────────────────────────────────────────────────────────────────────

export const TRACKS = {
  dealer: { label: 'Dealer / sales progress', color: '#0ea5e9' },
  mfr: { label: 'Manufacturing & install', color: '#c8102e' },
}

export const STAGE_GROUPS = [
  { id: 'interest', track: 'dealer', label: 'Interest' },
  { id: 'quote', track: 'dealer', label: 'Quote' },
  { id: 'permitting', track: 'dealer', label: 'Permitting & engineering' },
  { id: 'payment', track: 'dealer', label: 'Payments' },
  { id: 'site', track: 'dealer', label: 'Site readiness' },
  { id: 'production', track: 'mfr', label: 'Production & scheduling' },
  { id: 'install', track: 'mfr', label: 'Install' },
  { id: 'closeout', track: 'mfr', label: 'Close-out' },
  { id: 'aftercare', track: 'mfr', label: 'After-care' },
]

// Shared option sets. Payments are not-due → due → paid ("due" = payment needed).
// Production/scheduling can be flagged Delayed or On hold.
const PAY_OPTS = [{ v: 'not_due', label: 'Not due' }, { v: 'due', label: 'Payment due' }, { v: 'paid', label: 'Paid' }]

export const STAGES = [
  // ── Dealer / sales track ──────────────────────────────────────────────────
  { key: 'market', group: 'interest', track: 'dealer', label: 'Buyer intent', type: 'enum',
    options: [{ v: 'window_shopping', label: 'Window shopping' }, { v: 'in_market', label: 'In the market' }], doneValues: ['in_market'] },
  { key: 'quoted', group: 'quote', track: 'dealer', label: 'Quoted', type: 'bool' },
  { key: 'requoted', group: 'quote', track: 'dealer', label: 'Re-quoted', type: 'bool', neutral: true },
  { key: 'permit_status', group: 'permitting', track: 'dealer', label: 'Permit', type: 'enum',
    options: [{ v: 'unknown', label: 'Undecided' }, { v: 'not_required', label: 'No permit' }, { v: 'required', label: 'Permit required' }], doneValues: ['not_required', 'required'] },
  { key: 'engineering_plans', group: 'permitting', track: 'dealer', label: 'Engineering plans', type: 'enum',
    options: [{ v: 'none', label: 'None needed' }, { v: 'generic', label: 'Generic plans' }, { v: 'site_specific', label: 'Site-specific plans' }], doneValues: ['none', 'generic', 'site_specific'] },
  { key: 'permitting', group: 'permitting', track: 'dealer', label: 'Permitting status', type: 'enum',
    options: [
      { v: 'none', label: 'Not started' },
      { v: 'in_permitting', label: 'In permitting' },
      { v: 'waiting_on_us', label: 'Waiting on us' },
      { v: 'waiting_on_them', label: 'Waiting on them (customer)' },
      { v: 'approved', label: 'Permit approved' },
    ], doneValues: ['approved'] },
  // Payments — "Payment due" marks money owed (deposit / scheduling fee / final).
  { key: 'deposit', group: 'payment', track: 'dealer', label: 'Deposit', type: 'enum', options: PAY_OPTS, doneValues: ['paid'] },
  { key: 'scheduling_fee', group: 'payment', track: 'dealer', label: 'Scheduling fee (50%)', type: 'enum', options: PAY_OPTS, doneValues: ['paid'] },
  { key: 'final_payment', group: 'payment', track: 'dealer', label: 'Final payment', type: 'enum', options: PAY_OPTS, doneValues: ['paid'] },
  // Site readiness
  { key: 'site_level', group: 'site', track: 'dealer', label: 'Site level', type: 'enum',
    options: [{ v: 'unknown', label: 'Unknown' }, { v: 'level', label: 'Level' }, { v: 'needs_grading', label: 'Needs grading' }], doneValues: ['level'] },
  { key: 'level_photos', group: 'site', track: 'dealer', label: 'Level-site photos received', type: 'bool' },
  { key: 'rental_equipment', group: 'site', track: 'dealer', label: 'Rental equipment needed', type: 'bool', neutral: true },

  // ── Manufacturing / install track ─────────────────────────────────────────
  // Production & scheduling: sent to manufacturing → scheduling → install date.
  { key: 'manufacturing', group: 'production', track: 'mfr', label: 'Manufacturing', type: 'enum',
    options: [
      { v: 'not_started', label: 'Not started' },
      { v: 'sent', label: 'Sent to manufacturing' },
      { v: 'delayed', label: 'Delayed' },
      { v: 'on_hold', label: 'On hold' },
      { v: 'complete', label: 'Manufactured' },
    ], doneValues: ['complete'] },
  { key: 'scheduling', group: 'production', track: 'mfr', label: 'Scheduling', type: 'enum',
    options: [
      { v: 'not_started', label: 'Not started' },
      { v: 'in_progress', label: 'Scheduling' },
      { v: 'delayed', label: 'Delayed' },
      { v: 'on_hold', label: 'On hold' },
      { v: 'scheduled', label: 'Scheduled' },
    ], doneValues: ['scheduled'] },
  { key: 'install_date', group: 'production', track: 'mfr', label: 'Install date', type: 'date' },
  { key: 'crew_assigned', group: 'install', track: 'mfr', label: 'Crew assigned', type: 'text', placeholder: 'Crew name' },
  { key: 'crew_arrived', group: 'install', track: 'mfr', label: 'Crew arrived on site', type: 'bool' },
  { key: 'frame_installed', group: 'install', track: 'mfr', label: 'Frame installed', type: 'bool' },
  { key: 'panels_installed', group: 'install', track: 'mfr', label: 'Panels installed & finished', type: 'bool' },
  { key: 'installer_photos', group: 'closeout', track: 'mfr', label: 'Installer photos received', type: 'bool' },
  { key: 'post_install_support', group: 'aftercare', track: 'mfr', label: 'Post-install support', type: 'bool', neutral: true },
  { key: 'addons', group: 'aftercare', track: 'mfr', label: 'Add-on requested', type: 'bool', neutral: true },
  { key: 'repairs', group: 'aftercare', track: 'mfr', label: 'Repair requested', type: 'bool', neutral: true },
]

export const stageByKey = (key) => STAGES.find((s) => s.key === key) || null
export const enumLabel = (st, v) => st?.options?.find((o) => o.v === v)?.label || v

// Is a stage "done" for progress purposes?
export function isStageDone(st, v) {
  if (!st || v == null || v === '' || v === false) return false
  if (st.type === 'bool') return v === true
  if (st.type === 'enum') return (st.doneValues || []).includes(v)
  return !!v // date / text
}

// Non-neutral stages for a track (the ones that count toward progress).
export const progressStages = (track) => STAGES.filter((s) => s.track === track && !s.neutral)

// Progress for a track: { done, total, pct, current }.
export function trackProgress(lead, track) {
  const stages = progressStages(track)
  const p = lead?.pipeline || {}
  const done = stages.filter((s) => isStageDone(s, p[s.key])).length
  const next = stages.find((s) => !isStageDone(s, p[s.key]))
  return { done, total: stages.length, pct: stages.length ? Math.round((done / stages.length) * 100) : 0, current: next ? next.label : 'Complete' }
}

// A blended headline % (both tracks) for list rows.
export function overallProgress(lead) {
  const d = trackProgress(lead, 'dealer'), m = trackProgress(lead, 'mfr')
  const total = d.total + m.total, done = d.done + m.done
  return { pct: total ? Math.round((done / total) * 100) : 0 }
}

// Customer-facing phrasing for enum stages on the status portal. "waiting on them"
// and a "Payment due" both read as action on the customer's side.
export const CUSTOMER_STATUS = {
  permitting: {
    none: 'Not started',
    in_permitting: 'In permitting',
    waiting_on_us: 'We’re working on it',
    waiting_on_them: 'Action needed on your behalf',
    approved: 'Permit approved',
  },
  site_level: { unknown: 'Pending', level: 'Confirmed level', needs_grading: 'Action needed on your behalf' },
  manufacturing: { not_started: 'Not started', sent: 'In production', delayed: 'Delayed', on_hold: 'On hold', complete: 'Manufactured' },
  scheduling: { not_started: 'Not started', in_progress: 'Scheduling your install', delayed: 'Delayed', on_hold: 'On hold', scheduled: 'Scheduled' },
  deposit: { not_due: 'Not due yet', due: 'Payment needed', paid: 'Paid' },
  scheduling_fee: { not_due: 'Not due yet', due: 'Payment needed', paid: 'Paid' },
  final_payment: { not_due: 'Due on install day', due: 'Payment needed', paid: 'Paid' },
}
export const customerStatusLabel = (key, value) => CUSTOMER_STATUS[key]?.[value] || null
// Values that mean the ball is in the customer's court (must act).
const ACTION_NEEDED_VALUES = new Set(['waiting_on_them', 'needs_grading', 'due'])
// Values that mean the job is paused (informational, not the customer's fault).
const HOLD_VALUES = new Set(['delayed', 'on_hold'])

// Customer-facing milestone strip (no internal detail).
export const CUSTOMER_STEPS = ['quoted', 'deposit', 'permitting', 'manufacturing', 'scheduling', 'install_date', 'frame_installed', 'panels_installed', 'final_payment']
export function customerView(lead) {
  const p = lead?.pipeline || {}
  const steps = CUSTOMER_STEPS.map((key) => {
    const st = stageByKey(key)
    const value = p[key]
    return {
      key, label: st?.label || key, done: isStageDone(st, value), value,
      ts: p._ts?.[key] || null,
      status: customerStatusLabel(key, value),
      actionNeeded: ACTION_NEEDED_VALUES.has(value),
      onHold: HOLD_VALUES.has(value),
    }
  })
  return {
    steps,
    actionNeeded: steps.some((s) => s.actionNeeded),
    onHold: steps.some((s) => s.onHold),
    dealer: trackProgress(lead, 'dealer'),
    mfr: trackProgress(lead, 'mfr'),
  }
}
