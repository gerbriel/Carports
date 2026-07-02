import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown, Car, Warehouse, Tractor, Truck,
  Ruler, Square, DoorOpen, Palette, Settings, Plus, X, LayoutTemplate, Globe,
  Layers, Eye, EyeOff, Sun, Trees, Anchor, RotateCw, ShieldCheck,
} from 'lucide-react'
import { useBuilderStore } from '../../store/builderStore'
import {
  BUILDING_TYPES, ROOF_STYLES, COLORS, WALL_STYLES, DOOR_TYPES,
} from '../../data/builderData'
import { deriveStructure, LEG_LABELS, WIDESPAN_TRUSS_STYLES, installRequirements, SURFACE_ANCHORS, ANCHOR_LABELS, isFullyClosed } from '../../data/structural'
import { getComponents, CATEGORY_ORDER } from '../../data/components'
import PartInstanceRows from './PartInstanceRows'
import RawMaterialsSection from './RawMaterialsSection'
import { getFastenerSchedule } from '../../data/fastenerSchedule'
import { packagingForItem } from './fastenerPackaging'
import { frameSpan, girtCourseHeights, purlinRowCount, wallGirtCount } from './scene/BuildingTrusses'
import { MapPin, ExternalLink, Wind, Snowflake } from 'lucide-react'
import { geocodeAddress, suggestAddresses, fetchSiteFeatures, fetchOvertureBuildings, esriSatUrl, fetchElevationGrid, detectPools } from './scene/siteMap'
import { getCityBySlug } from '../../data/cities'
import { citySlug } from '../../data/caGeo'
import { suggestSnowFromElevation } from '../../data/caPermits'
import { PROP_TYPES } from './scene/Landscaping'
import { VEHICLE_TYPES, vehicleMeta } from './scene/Vehicles'

// ─── Accordion section ────────────────────────────────────────────────────────
function Section({ id, active, onToggle, icon, title, children }) {
  return (
    <div className="border-b border-white/8">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
          <span className="text-brand">{icon}</span>
          {title}
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${active ? 'rotate-180' : ''}`}
        />
      </button>
      {active && <div className="px-4 pb-5 space-y-4">{children}</div>}
    </div>
  )
}

// ─── Slider with value display ─────────────────────────────────────────────────
function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-bold text-white">
          {value}
          <span className="text-slate-500 font-normal"> {unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer accent-brand"
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ─── Toggle button pair ────────────────────────────────────────────────────────
function Toggle({ value, onChange, labels = ['No', 'Yes'] }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`rounded px-2.5 py-1 text-xs font-semibold transition-all border ${
        value ? 'border-brand bg-brand/20 text-brand' : 'border-white/15 text-slate-500 hover:border-white/30'
      }`}
    >
      {value ? labels[1] : labels[0]}
    </button>
  )
}

// ─── Segmented button row ──────────────────────────────────────────────────────
function Segmented({ value, options, onChange, flex = true, disabled = false }) {
  return (
    <div className={`flex gap-1.5 ${flex ? '' : 'flex-wrap'} ${disabled ? 'opacity-70' : ''}`}>
      {options.map(({ id, label }) => (
        <button
          key={id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`flex-1 rounded border py-1.5 text-xs font-semibold transition-all ${
            value === id
              ? 'border-brand bg-brand/15 text-white'
              : 'border-white/10 text-slate-400 hover:border-white/25'
          } ${disabled ? 'cursor-not-allowed' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Building Type Section ─────────────────────────────────────────────────────
function TypeSection({ store }) {
  const TYPE_ICONS = {
    standard_carport: <Car size={18} />,
    triple_carport:   <Car size={18} />,
    standard_garage:  <Warehouse size={18} />,
    triple_garage:    <Warehouse size={18} />,
    standard_barn:    <Tractor size={18} />,
    rv_cover:         <Truck size={18} />,
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUILDING_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => store.applyBuildingType(t)}
          className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all ${
            store.buildingType === t.id
              ? 'border-brand bg-brand/15 text-white'
              : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
          }`}
        >
          <div className={store.buildingType === t.id ? 'text-brand' : ''}>
            {TYPE_ICONS[t.id] ?? <Square size={18} />}
          </div>
          <div className="text-xs font-medium leading-tight">{t.label}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Size & Structure Section ──────────────────────────────────────────────────
function SizeSection({ store }) {
  // Roof-style limits: Regular needs ≤30′ wide AND ≤30′ long; A-frame Horizontal
  // needs ≤30′ long. Past those only A-frame Vertical is offered, and crossing a
  // limit drops the now-invalid style automatically.
  const widespan = store.width > 30
  const longSpan = store.length > 30
  // Gable styles have size limits; the free-standing lean-to is always available.
  const styleBlocked = (id) =>
    (id === 'regular' && (widespan || longSpan)) ||
    (id === 'a_frame_horizontal' && longSpan)
  const dropInvalid = (w, l) => {
    const rs = store.roofStyle
    if ((rs === 'regular' && (w > 30 || l > 30)) ||
        (rs === 'a_frame_horizontal' && l > 30)) {
      store.setField('roofStyle', 'a_frame_vertical')
    }
  }
  const setWidth  = (v) => { store.setField('width', v);  dropInvalid(v, store.length) }
  const setLength = (v) => { store.setField('length', v); dropInvalid(store.width, v) }
  // Free-standing lean-to: slope runs across the width (HIGH side = `height`, LOW
  // side = its own leg height). Default the low side from the pitch until set.
  const isFreeLean = store.roofStyle === 'free_standing_lean_to'
  const lowMin     = Math.max(6, store.height - store.width * (store.roofPitch / 12))
  const lowLeg     = Math.max(lowMin, Math.min(store.height, store.lowEaveHeight ?? lowMin))
  return (
    <>
      <Slider label="Width"  value={store.width}  min={12} max={isFreeLean ? 20 : 60}  step={2} unit="ft" onChange={setWidth}  />
      <Slider label="Length" value={store.length} min={20} max={300} step={2} unit="ft" onChange={setLength} />
      {isFreeLean ? (
        <>
          <Slider label="High Side Height" value={store.height} min={6} max={20} step={1} unit="ft" onChange={(v) => store.setField('height', v)} />
          <Slider label="Low Side Height" value={lowLeg} min={lowMin} max={store.height} step={1} unit="ft" onChange={(v) => store.setField('lowEaveHeight', v)} />
        </>
      ) : (
        <Slider label="Height" value={store.height} min={6}  max={20}  step={1} unit="ft" onChange={(v) => store.setField('height', v)} />
      )}

      {/* Roof pitch — above the styles. For a free-standing lean-to it stays visible
          and caps how steeply the low side may drop (bounds the slider above). */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Roof Pitch</p>
        <Segmented
          value={store.roofPitch}
          options={[{ id: 2, label: '2/12' }, { id: 3, label: '3/12' }, { id: 4, label: '4/12' }]}
          onChange={(v) => store.setField('roofPitch', v)}
        />
        {isFreeLean && (
          <p className="text-[10px] text-slate-500 mt-1">Caps the low side at {lowMin}′ (steepest at this pitch).</p>
        )}
      </div>

      {/* Roof style */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Roof Style</p>
        <div className="space-y-1.5">
          {ROOF_STYLES.map((rs) => {
            const disabled = styleBlocked(rs.id)
            return (
            <label
              key={rs.id}
              className={`flex items-start gap-3 rounded-lg border p-2.5 transition-all ${
                disabled
                  ? 'border-white/5 text-slate-600 opacity-50 cursor-not-allowed'
                  : store.roofStyle === rs.id
                    ? 'border-brand bg-brand/10 text-white cursor-pointer'
                    : 'border-white/10 text-slate-400 hover:border-white/25 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="roofStyle"
                value={rs.id}
                disabled={disabled}
                checked={store.roofStyle === rs.id}
                onChange={() => {
                  if (disabled) return
                  store.setField('roofStyle', rs.id)
                  if (rs.id === 'regular') store.setField('wallOrientation', 'horizontal')
                  if (rs.id === 'free_standing_lean_to' && store.width > 20) store.setField('width', 20)
                }}
                className="mt-0.5 accent-brand shrink-0"
              />
              <div>
                <div className="text-xs font-semibold">{rs.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {disabled
                    ? 'Limited to 30′ wide × 30′ long — use A-Frame Vertical for larger'
                    : rs.description}
                </div>
              </div>
            </label>
          )})}
        </div>
      </div>

      {/* Frame steel gauge */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Steel Gauge</p>
        <Segmented
          value={store.gauge}
          options={[{ id: 12, label: '12 Gauge (Std)' }, { id: 14, label: '14 Gauge' }]}
          onChange={(v) => store.setField('gauge', v)}
        />
      </div>

      {/* Panel profile */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Panel Profile</p>
        <Segmented
          value={store.panelProfile}
          options={[{ id: 'l5', label: 'L5 (Std)' }, { id: 'pbr', label: 'PBR (Upgrade)' }]}
          onChange={(v) => store.setField('panelProfile', v)}
        />
        <p className="text-[10px] text-slate-500 mt-1">
          {store.panelProfile === 'pbr'
            ? 'PBR — 1¼″ ribs @ 12″ centers (heavier panel)'
            : 'L5 — ¾″ ribs @ 9″ centers (standard)'}
        </p>

        {/* Panel sheet gauge */}
        <p className="text-xs text-slate-400 mb-2 mt-3">Panel Gauge</p>
        <Segmented
          value={store.panelGauge}
          options={[{ id: 26, label: '26 Gauge (Std)' }, { id: 29, label: '29 Gauge' }]}
          onChange={(v) => store.setField('panelGauge', v)}
        />
        <p className="text-[10px] text-slate-500 mt-1">
          {store.panelGauge === 29
            ? '29 ga — thinner economy sheet'
            : '26 ga — heavier standard sheet'}
        </p>

        {/* PBR 26 GA panel upgrade — kept with the panel options */}
        <label className="flex items-center gap-2 cursor-pointer mt-3">
          <input
            type="checkbox"
            checked={!!store.extraOptions.pbr26GaPanelUpgrade}
            onChange={(e) => store.setExtraOption('pbr26GaPanelUpgrade', e.target.checked)}
            className="accent-brand"
          />
          <span className="text-xs text-slate-300">PBR 26 GA Panel Upgrade</span>
        </label>
      </div>
    </>
  )
}

// ─── Walls Section ─────────────────────────────────────────────────────────────
function WallsSection({ store }) {
  const SIDES = [
    { key: 'front', label: 'Front', isEnd: true },
    { key: 'back',  label: 'Back',  isEnd: true },
    { key: 'left',  label: 'Left',  isEnd: false },
    { key: 'right', label: 'Right', isEnd: false },
  ]
  return (
    <div className="space-y-4">
      {/* Panel orientation — Regular style locked to horizontal per engineering spec */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Panel Orientation</p>
        <div className="flex gap-1.5">
          {[
            { id: 'auto',       label: 'Auto'       },
            { id: 'vertical',   label: 'Vertical'   },
            { id: 'horizontal', label: 'Horizontal' },
          ].map(({ id, label }) => {
            const locked = store.roofStyle === 'regular' && id !== 'horizontal'
            const isActive = store.roofStyle === 'regular' ? id === 'horizontal' : store.wallOrientation === id
            return (
              <button
                key={id}
                disabled={locked}
                onClick={() => !locked && store.setField('wallOrientation', id)}
                className={`flex-1 rounded border py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-brand bg-brand/15 text-white'
                    : locked
                    ? 'border-white/5 text-slate-700 cursor-not-allowed'
                    : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {store.roofStyle === 'regular'
          ? <p className="text-[10px] text-amber-500/70 mt-1">Regular style requires horizontal panels (engineering spec)</p>
          : <p className="text-[10px] text-slate-600 mt-1">Auto: Vertical for A-Frame Vertical, Horizontal otherwise</p>
        }
      </div>

      {/* Per-wall dropdowns */}
      <div className="space-y-3">
        {SIDES.map(({ key, label, isEnd }) => {
          const options = WALL_STYLES.filter((ws) => (isEnd ? ws.forEnds : ws.forSides))
          return (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label} Wall</label>
              <select
                value={store.walls[key]}
                onChange={(e) => store.setWall(key, e.target.value)}
                className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
              >
                {options.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.label}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Doors & Windows Section ───────────────────────────────────────────────────
function DoorsSection({ store }) {
  const [form, setForm] = useState({ type: 'roll_up', sizeIdx: 0, framed: false, variantIdx: 0 })

  const selectedType = DOOR_TYPES.find((dt) => dt.id === form.type)
  const variants     = selectedType?.variants ?? null
  const selVariant   = variants?.[form.variantIdx] ?? null
  const maxDoorH = store.height - 2  // engineering spec: max overhead door height = eave − 2'

  function handlePlace() {
    const size = selectedType.sizes[form.sizeIdx]
    if (form.type === 'roll_up' && size.h > maxDoorH) return
    store.startPlacing({
      type: form.type, sizeLabel: size.label, width: size.w, height: size.h,
      framed: form.framed,
      // Walk-in style → carry the variant + its behaviour onto the placed door.
      ...(selVariant && {
        variant: selVariant.id, variantLabel: selVariant.label,
        swing: selVariant.swing, window: selVariant.window,
        frame: selVariant.frame, mount: selVariant.mount,
      }),
    })
  }

  const wallLabel = (w) => ({ front: 'Front', back: 'Back', left: 'Left', right: 'Right' }[w])
  const typeLabel = (t) => (t === 'roll_up' ? 'Roll-Up' : t === 'walk_in' ? 'Walk-In' : 'Window')
  const wallsWithDoors = [...new Set(store.doors.map((d) => d.wall))]

  return (
    <div className="space-y-4">
      {/* Placement banner */}
      {store.placing && (
        <div className="rounded-lg border border-brand bg-brand/15 p-3 text-xs text-white">
          Click the building to place the {typeLabel(store.placing.type)} — keep clicking to add more.
          <button onClick={() => store.cancelPlacing()} className="ml-2 underline text-slate-300">Done</button>
        </div>
      )}
      {/* Clearance / fit warning (e.g. door too tall for the eave) */}
      {store.placeError && (
        <div className="rounded-lg border border-amber-500/60 bg-amber-500/15 p-3 text-xs text-amber-200">
          {store.placeError}
        </div>
      )}

      {/* Existing openings — click to select, then duplicate / delete / move in 3D */}
      {store.doors.length > 0 && (
        <div className="space-y-1.5">
          {store.doors.map((d) => {
            const sel = store.selectedDoorId === d.id
            const dSizes = DOOR_TYPES.find((t) => t.id === d.type)?.sizes ?? []
            return (
              <div
                key={d.id}
                onClick={() => store.selectDoor(d.id)}
                className={`rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  sel ? 'border-brand bg-brand/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">
                      {d.framed
                        ? `Frame-Out ${d.sizeLabel}`
                        : `${typeLabel(d.type)}${d.variantLabel ? ` · ${d.variantLabel}` : ''} ${d.sizeLabel}`}
                    </div>
                    <div className="text-[10px] text-slate-500">{wallLabel(d.wall)} · drag in 3D to move</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button title="Duplicate" onClick={(e) => { e.stopPropagation(); store.duplicateDoor(d.id) }} className="text-slate-500 hover:text-brand"><Plus size={14} /></button>
                    <button title="Delete" onClick={(e) => { e.stopPropagation(); store.removeDoor(d.id) }} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                  </div>
                </div>
                {/* Resize the selected opening */}
                {sel && dSizes.length > 0 && (
                  <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-slate-400">Size</span>
                    <select
                      value={d.sizeLabel}
                      onChange={(e) => {
                        const sz = dSizes.find((s) => s.label === e.target.value)
                        if (sz) store.setDoorSize(d.id, sz.w, sz.h, sz.label)
                      }}
                      className="flex-1 rounded border border-white/15 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
                    >
                      {dSizes.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
          {wallsWithDoors.map((w) => (
            <button
              key={w}
              onClick={() => store.distributeWall(w)}
              className="w-full rounded border border-white/10 py-1 text-[10px] text-slate-400 hover:border-white/25"
            >
              Justify {wallLabel(w)} openings evenly
            </button>
          ))}
        </div>
      )}

      {/* Add opening form → click-to-place */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Add Opening</p>

        {/* Type */}
        <div>
          <p className="text-xs text-slate-400 mb-1">Type</p>
          <div className="flex gap-1.5 flex-wrap">
            {DOOR_TYPES.map((dt) => (
              <button
                key={dt.id}
                onClick={() => setForm((f) => ({ ...f, type: dt.id, sizeIdx: 0 }))}
                className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-all ${
                  form.type === dt.id ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Walk-in door style (hidden when placing a see-through frame-out) */}
        {variants && !form.framed && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Door style</p>
            <select
              value={form.variantIdx}
              onChange={(e) => setForm((f) => ({ ...f, variantIdx: Number(e.target.value) }))}
              className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
            >
              {variants.map((v, i) => <option key={v.id} value={i}>{v.label}</option>)}
            </select>
            {selVariant && (
              <p className="text-[10px] text-slate-500 mt-1">
                Opens {selVariant.swing === 'in' ? 'inward' : 'outward'} ·{' '}
                {selVariant.mount === 'baserail'
                  ? 'mounts on the base rail (≈2½″ threshold step-over)'
                  : 'own threshold (flush sill)'}
                {selVariant.window !== 'none' ? ` · ${selVariant.window} window` : ''}
              </p>
            )}
          </div>
        )}

        {/* Size */}
        <div>
          <p className="text-xs text-slate-400 mb-1">Size</p>
          <select
            value={form.sizeIdx}
            onChange={(e) => setForm((f) => ({ ...f, sizeIdx: Number(e.target.value) }))}
            className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
          >
            {(selectedType?.sizes ?? []).map((s, i) => {
              const tooTall = form.type === 'roll_up' && s.h > maxDoorH
              return (
                <option key={i} value={i} disabled={tooTall}>
                  {s.label}{tooTall ? ` (max ${maxDoorH}′ for this eave)` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Frame-out → empty, see-through framed opening (no door installed) */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300">Frame-out only (see-through)</span>
          <Toggle value={form.framed} onChange={(v) => setForm((f) => ({ ...f, framed: v }))} />
        </div>

        <button
          onClick={handlePlace}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark transition-colors"
        >
          <Plus size={13} /> Place on Building
        </button>
        <p className="text-[10px] text-slate-600">Then click the wall. Walk-in doors &amp; windows snap beside a leg post.</p>
      </div>
    </div>
  )
}

// ─── Skylights Section ─────────────────────────────────────────────────────────
const SKY_LENGTHS = [4, 6, 8, 10, 12]
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// Human label for a skylight's surfaceKey ('roof:center:left', 'wall:lean:front:outer', …)
function skylightLabel(key) {
  const p = key.split(':')
  if (p[1] === 'center') {
    return p[0] === 'roof'
      ? (p[2] ? `Roof · ${cap(p[2])}` : 'Roof')
      : `Wall · ${cap(p[2])}`
  }
  return `Lean-To ${cap(p[2])} · ${p[0] === 'roof' ? 'Roof' : 'Wall'}`
}

function SkylightsSection({ store }) {
  const [length, setLength] = useState(8)
  const isL5 = store.panelProfile === 'l5'
  const placingSky = store.placing?.category === 'skylight'

  return (
    <div className="space-y-4">
      {placingSky && (
        <div className="rounded-lg border border-brand bg-brand/15 p-3 text-xs text-white">
          Click a roof slope or wall to place the skylight — keep clicking to add more.
          <button onClick={() => store.cancelPlacing()} className="ml-2 underline text-slate-300">Done</button>
        </div>
      )}

      {/* Placed skylights — click to select, then resize / duplicate / delete / drag in 3D */}
      {store.skylights.length > 0 && (
        <div className="space-y-1.5">
          {store.skylights.map((sk) => {
            const sel = store.selectedSkylightId === sk.id
            return (
              <div
                key={sk.id}
                onClick={() => store.selectSkylight(sk.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  sel ? 'border-brand bg-brand/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">{skylightLabel(sk.surfaceKey)}</div>
                  <div className="text-[10px] text-slate-500">drag in 3D to move</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sk.length}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => store.setSkylightField(sk.id, 'length', Number(e.target.value))}
                    className="rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 focus:border-brand focus:outline-none"
                  >
                    {SKY_LENGTHS.map((l) => <option key={l} value={l}>{l}′</option>)}
                  </select>
                  <button title="Duplicate" onClick={(e) => { e.stopPropagation(); store.duplicateSkylight(sk.id) }} className="text-slate-500 hover:text-brand"><Plus size={14} /></button>
                  <button title="Delete" onClick={(e) => { e.stopPropagation(); store.removeSkylight(sk.id) }} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add skylight → click-to-place */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Add Skylight</p>

        {!isL5 && (
          <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
            Skylights are available on L5 panels only. Switch the panel profile to L5 to add one.
          </p>
        )}

        <div>
          <p className="text-xs text-slate-400 mb-1">Length</p>
          <div className="flex gap-1.5 flex-wrap">
            {SKY_LENGTHS.map((l) => (
              <button
                key={l}
                onClick={() => setLength(l)}
                className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-all ${
                  length === l ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {l}′
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!isL5}
          onClick={() => store.startPlacing({ category: 'skylight', length })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sun size={13} /> Place on Building
        </button>
        <p className="text-[10px] text-slate-600">Then click a roof slope or wall. One panel (3′) wide; chain several for a longer run.</p>
      </div>
    </div>
  )
}

// ─── Colors Section ────────────────────────────────────────────────────────────
function ColorSwatches({ currentName, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c.name}
          title={c.name}
          onClick={() => onSelect(c)}
          className={`h-7 w-7 rounded-full border-2 transition-all duration-150 ${
            currentName === c.name
              ? 'border-white scale-110 shadow-lg shadow-black/40'
              : 'border-transparent hover:border-white/50 hover:scale-105'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  )
}

function ColorsSection({ store }) {
  const BASE_PARTS = [
    { key: 'roof', label: 'Roof'  },
    { key: 'wall', label: 'Walls' },
    { key: 'trim', label: 'Trim'  },
  ]

  return (
    <div className="space-y-5">
      {BASE_PARTS.map(({ key, label }) => {
        const current = store[`${key}Color`]
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">{label}</p>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-white/20" style={{ background: current.hex }} />
                <span className="text-[10px] text-slate-500">{current.name}</span>
              </div>
            </div>
            <ColorSwatches
              currentName={current.name}
              onSelect={(c) => store.setColor(key, c)}
            />
          </div>
        )
      })}

      {/* Wainscot */}
      <div className="pt-1 border-t border-white/8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400">Wainscot (3′ base band)</p>
          <Toggle value={store.wainscotEnabled} onChange={store.setWainscot} labels={['Off', 'On']} />
        </div>
        {(store.wainscotEnabled || Object.keys(store.wainscotWalls ?? {}).length > 0) && (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-3 w-3 rounded-full border border-white/20" style={{ background: store.wainscotColor.hex }} />
              <span className="text-[10px] text-slate-500">{store.wainscotColor.name}</span>
            </div>
            <ColorSwatches
              currentName={store.wainscotColor.name}
              onSelect={(c) => store.setColor('wainscot', c)}
            />
            <WainscotWalls store={store} />
          </>
        )}
      </div>
    </div>
  )
}

// Per-wall wainscot on/off — closed center walls + closed lean-to outer walls.
// Each toggle falls back to the global default until explicitly overridden.
function WainscotWalls({ store }) {
  const rows = []
  ;['front', 'back', 'left', 'right'].forEach((w) => {
    if (isFullyClosed(store.walls?.[w])) rows.push({ key: w, label: cap(w) })
  })
  ;['left', 'right', 'front', 'back'].forEach((side) => {
    const lt = store.leanTos?.[side]
    if (lt?.enabled && lt.walls?.outer !== 'open') rows.push({ key: `lean:${side}:outer`, label: `Lean-To ${cap(side)}` })
  })
  if (!rows.length) return null
  const eff = (k) => store.wainscotWalls?.[k] ?? store.wainscotEnabled
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Per wall</p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{r.label}</span>
          <Toggle value={eff(r.key)} onChange={(v) => store.setWainscotWall(r.key, v)} labels={['Off', 'On']} />
        </div>
      ))}
    </div>
  )
}

// ─── Lean-To Section ──────────────────────────────────────────────────────────
const LEAN_TO_SIDES = [
  { key: 'left',  label: 'Left Lean-To',  dimLabel: 'Width'  },
  { key: 'right', label: 'Right Lean-To', dimLabel: 'Width'  },
  { key: 'front', label: 'Front Lean-To', dimLabel: 'Depth'  },
  { key: 'back',  label: 'Back Lean-To',  dimLabel: 'Depth'  },
]
// The two END walls of each lean-to (perpendicular to the slope).
const LEAN_TO_END_KEYS = {
  left:  ['front', 'back'],
  right: ['front', 'back'],
  front: ['left', 'right'],
  back:  ['left', 'right'],
}
const isLeanWallClosed = (v) => v === 'closed' || v === 'gable'

// Snap a normalized t∈[0,1] to the nearest INTERIOR frame line (for display).
function snapFeet(t, span, lines) {
  const interior = lines.slice(1, -1)
  if (!interior.length) return null
  const target = -span / 2 + t * span
  return interior.reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b), interior[0])
}

function InteriorWallsSection({ store }) {
  const walls = store.interiorWalls ?? []
  const structure = deriveStructure(store)
  const spacing = structure.spacing ?? 5
  const endSp = structure.endPostSpacing ?? 5

  const desc = (w) => {
    if (w.axis === 'length') {
      const x = snapFeet(w.t ?? 0.5, store.width, frameSpan(store.width, endSp))
      return x == null ? 'no interior post' : `${(x + store.width / 2).toFixed(1)}′ from left`
    }
    const z = snapFeet(w.t ?? 0.5, store.length, frameSpan(store.length, spacing))
    return z == null ? 'no interior post' : `${(z + store.length / 2).toFixed(1)}′ from front`
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        Partition the interior. Walls run full height to the roof and snap to the nearest frame post.
        Add doors afterward from Doors &amp; Windows.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => store.addInteriorWall('cross')}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:bg-white/10 flex items-center justify-center gap-1">
          <Plus size={12} /> Cross Wall
        </button>
        <button onClick={() => store.addInteriorWall('length')}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-semibold text-slate-200 hover:bg-white/10 flex items-center justify-center gap-1">
          <Plus size={12} /> Lengthwise
        </button>
      </div>
      {walls.length === 0 && <p className="text-[10px] text-slate-500">No interior walls yet.</p>}
      {walls.map((w, i) => (
        <div key={w.id} className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">
              {w.axis === 'cross' ? 'Cross Wall' : 'Lengthwise Wall'} {i + 1}
            </p>
            <button onClick={() => store.removeInteriorWall(w.id)} className="text-slate-400 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
          <Slider
            label={`Position — ${desc(w)}`}
            value={Math.round((w.t ?? 0.5) * 100)} min={0} max={100} step={2} unit="%"
            onChange={(v) => store.setInteriorWall(w.id, { t: v / 100 })}
          />
        </div>
      ))}
    </div>
  )
}

function LeanToSection({ store }) {
  const enabledCount = LEAN_TO_SIDES.filter((s) => store.leanTos?.[s.key]?.enabled).length

  return (
    <div className="space-y-3">
      {LEAN_TO_SIDES.map(({ key, label, dimLabel }) => {
        const lt = store.leanTos?.[key] ?? { enabled: false, width: 12, attachHeight: null, pitch: 2 }
        // Step-down ties in at least 1′ BELOW the center building's eave (leg
        // height); also capped so the outer eave stays ≤ 9′ (engineering spec).
        const maxAttachH = Math.min(store.height - 1, 9 + lt.width * (lt.pitch / 12))
        const attachH = Math.min(lt.attachHeight ?? store.height, maxAttachH)
        const outerEave = Math.max(6, attachH - lt.width * (lt.pitch / 12))
        return (
          <div key={key} className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">{label}</p>
              <Toggle
                value={lt.enabled}
                onChange={(v) => store.setLeanTo(key, { enabled: v })}
                labels={['Disabled', 'Enabled']}
              />
            </div>
            {lt.enabled && (
              <>
                {/* Width / Depth — max 12' per engineering spec */}
                <Slider
                  label={dimLabel} value={lt.width} min={6} max={12} step={2} unit="ft"
                  onChange={(v) => store.setLeanTo(key, { width: v })}
                />

                {/* Roof connection: continuous slope vs separate step-down roof */}
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Roof Connection</p>
                  <Segmented
                    value={lt.roofConnection ?? 'step_down'}
                    options={[{ id: 'continuous', label: 'Continuous' }, { id: 'step_down', label: 'Step-Down' }]}
                    onChange={(v) => store.setLeanTo(key, { roofConnection: v })}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {(lt.roofConnection ?? 'step_down') === 'continuous'
                      ? 'Roof carries the main slope past the eave — one unbroken roofline.'
                      : 'Separate lower roof at its own pitch & attach height.'}
                  </p>
                </div>

                {/* Pitch + attach height — only for a step-down roof (continuous
                    derives both from the main roof). */}
                {(lt.roofConnection ?? 'step_down') === 'step_down' && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 mb-1.5">Lean-To Pitch</p>
                      <Segmented
                        value={lt.pitch ?? 2}
                        options={[{ id: 1, label: '1/12' }, { id: 2, label: '2/12' }, { id: 3, label: '3/12' }, { id: 4, label: '4/12' }]}
                        onChange={(v) => store.setLeanTo(key, { pitch: v })}
                      />
                    </div>

                    <Slider
                      label="Attach Height"
                      value={attachH}
                      min={Math.max(6, Math.ceil(lt.width * (lt.pitch / 12)) + 6)}
                      max={maxAttachH}
                      step={0.5}
                      unit="ft"
                      onChange={(v) => store.setLeanTo(key, { attachHeight: v })}
                    />

                    <p className="text-[10px] text-slate-500">
                      Outer eave: <span className="text-slate-300 font-medium">{outerEave.toFixed(1)}′</span>
                      {' '}(= {attachH}′ − {lt.width}′ × {lt.pitch}/12) · max 9′
                    </p>
                  </>
                )}

                {/* Walls — outer + the two end walls */}
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Walls</p>
                  <div className="space-y-1.5">
                    {[
                      { wk: 'outer', label: 'Outer Wall' },
                      ...LEAN_TO_END_KEYS[key].map((wk) => ({ wk, label: `${wk[0].toUpperCase()}${wk.slice(1)} End` })),
                    ].map(({ wk, label }) => {
                      const closed = isLeanWallClosed(lt.walls?.[wk])
                      return (
                        <div key={wk} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-300">{label}</span>
                          <div className="flex gap-1">
                            {['open', 'closed'].map((v) => (
                              <button
                                key={v}
                                onClick={() => store.setLeanTo(key, { walls: { ...lt.walls, [wk]: v } })}
                                className={`rounded border px-2 py-1 text-[10px] font-semibold capitalize transition-all ${
                                  (v === 'closed') === closed
                                    ? 'border-brand bg-brand/15 text-white'
                                    : 'border-white/10 text-slate-400 hover:border-white/25'
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Installation surface — independent of the main building.
                    'Same' (null) inherits; otherwise its own pad + auto anchor. */}
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Installation Surface</p>
                  <Segmented
                    value={lt.surface ?? 'inherit'}
                    options={[
                      { id: 'inherit',  label: 'Same' },
                      { id: 'concrete', label: 'Cement' },
                      { id: 'asphalt',  label: 'Asphalt' },
                      { id: 'ground',   label: 'Ground' },
                      { id: 'gravel',   label: 'Gravel' },
                    ]}
                    onChange={(v) => store.setLeanTo(key, { surface: v === 'inherit' ? null : v })}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {lt.surface
                      ? `Own ${lt.surface} pad · ${ANCHOR_LABELS[SURFACE_ANCHORS[lt.surface][0]] ?? SURFACE_ANCHORS[lt.surface][0]} anchors.`
                      : `Inherits the building surface (${store.installationSurface}).`}
                  </p>
                </div>
              </>
            )}
          </div>
        )
      })}

      {enabledCount >= 2 && (
        <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-300">Wrap-Around Roof</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Continuous roof panel across all lean-to sides</p>
          </div>
          <Toggle
            value={store.wrapAroundRoof}
            onChange={(v) => store.setField('wrapAroundRoof', v)}
            labels={['Off', 'On']}
          />
        </div>
      )}
    </div>
  )
}

// ─── Options Section ───────────────────────────────────────────────────────────
const SNOW_OPTIONS = [30, 40, 50, 60, 70, 80, 90]
const WIND_OPTIONS = [105, 115, 130, 140, 155, 165, 180]
const ft = (v) => `${Number(v.toFixed(1)).toString().replace(/\.0$/, '')}′`

// Anchor add-ons available per installation surface (synced so only the relevant
// anchors show). Cement = concrete; ground & gravel share the same set.
const ANCHOR_OPTIONS_BY_SURFACE = {
  ground:   [['pinAnchor', 'Rebar / Pin Anchor'], ['rockAnchor', 'Rock Anchor'], ['mobileHomeAnchor', 'Mobile Home Anchor']],
  gravel:   [['pinAnchor', 'Rebar / Pin Anchor'], ['rockAnchor', 'Rock Anchor'], ['mobileHomeAnchor', 'Mobile Home Anchor']],
  asphalt:  [['asphaltAnchor', 'Asphalt Anchor']],
  concrete: [['titenHDScrew', 'Titen HD Screws'], ['concreteAnchor', 'Concrete Wedge Anchor'], ['weldedOnBrackets', 'Welded L-Brackets']],
}
const ALL_ANCHOR_KEYS = ['pinAnchor', 'rockAnchor', 'mobileHomeAnchor', 'asphaltAnchor', 'titenHDScrew', 'concreteAnchor', 'weldedOnBrackets']
// Non-anchor add-ons (always shown). PBR 26ga lives up in the panel section now.
const GENERAL_EXTRA_OPTIONS = [
  ['extraPurlins',        'Extra Purlins'      ],
  ['gauge26PanelUpgrade', '26 GA Panel Upgrade'],
  ['coloredScrews',       'Colored Screws'     ],
]

// Column-style options for the manual Leg Style picker (Auto = derived logic).
const LEG_STYLE_OPTIONS = [
  ['auto',   'Auto (recommended)'],
  ['single', 'Single Post'],
  ['double', 'Double'],
  ['ladder', 'Ladder (built-up)'],
  ['zigzag', 'ZigZag (built-up)'],
]
const SURFACE_LABEL = { ground: 'Ground / Gravel', gravel: 'Ground / Gravel', asphalt: 'Asphalt', concrete: 'Cement' }

// −/＋ counter for install equipment. Shows the size-based suggestion underneath;
// an "auto" link reverts a manual override back to the suggested count.
function QtyStepper({ label, hint, value, suggested, overridden, onChange, onAuto }) {
  const Btn = ({ t, on }) => (
    <button onClick={on} className="h-6 w-6 rounded border border-white/15 text-slate-200 hover:border-white/40 hover:text-white text-sm leading-none">{t}</button>
  )
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-200">{label}</div>
        <div className="text-[10px] text-slate-500">
          Suggested {suggested}{hint ? ` · ${hint}` : ''}
          {overridden && <button onClick={onAuto} className="ml-1.5 text-brand hover:underline">reset to auto</button>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Btn t="−" on={() => onChange(Math.max(0, value - 1))} />
        <span className="w-6 text-center text-sm font-bold text-white">{value}</span>
        <Btn t="+" on={() => onChange(Math.min(8, value + 1))} />
      </div>
    </div>
  )
}

// ─── Engineering Section ───────────────────────────────────────────────────────
// Certification, bracing, design loads, extra trusses and the auto-derived
// engineering-package readout — pulled out of Options into their own section.
function EngineeringSection({ store }) {
  const structure = deriveStructure(store)
  const trussLabel = store.roofStyle === 'regular' ? 'Rounded bow'
                   : store.width > 30 ? 'Webbed A-frame' : 'Peak-brace A-frame'
  const ENG_ROWS = [
    { label: 'Legs',    value: LEG_LABELS[structure.legType], why: structure.reasons.legType },
    { label: 'Trusses', value: trussLabel,                    why: structure.reasons.trussType },
    { label: 'Frames',  value: `${ft(structure.spacing)} on-center`, why: structure.reasons.spacing },
    { label: 'Purlins', value: structure.reasons.purlin, why: 'roof' },
    { label: 'Girts',   value: structure.reasons.girt,   why: 'walls' },
    { label: 'Bracing', value: structure.bracing === 'diagonal' ? 'Diagonal sway braces' : 'None', why: structure.reasons.bracing },
  ]
  const selCls = 'w-full rounded border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none'

  return (
    <div className="space-y-5">

      {/* Certification */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Certification</p>
        <Segmented
          value={store.certification}
          options={[{ id: 'uncertified', label: 'Uncertified' }, { id: 'local_code', label: 'Built To Local Code' }]}
          onChange={(v) => store.setField('certification', v)}
        />
      </div>

      {/* Side Bracing — diagonal braces are MANDATORY while the build is CERTIFIED
          (Built To Local Code). The ONLY way to turn them off is to mark the build
          Uncertified, so the toggle locks ON whenever certified. */}
      {(() => {
        const certified   = store.certification === 'local_code'
        const recommended = store.width > 30 || store.height >= 11
        const on = structure.bracing === 'diagonal'
        return (
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Side Bracing</p>
            <Segmented
              value={on ? 'diagonal' : 'none'}
              options={[{ id: 'none', label: 'None' }, { id: 'diagonal', label: 'Diagonal Braces' }]}
              onChange={(v) => store.setField('bracingType', v)}
              disabled={certified}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {certified
                ? 'Required while certified — mark Uncertified above to remove braces'
                : (recommended ? 'Recommended for this size' : 'Optional')}
            </p>
          </div>
        )
      })()}

      {/* Design loads — drive the engineering schedules below */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Design Loads <span className="text-slate-600">· snow &amp; wind</span></p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Ground Snow (PSF)</p>
            <select className={selCls} value={store.groundSnow} onChange={(e) => store.setField('groundSnow', Number(e.target.value))}>
              {SNOW_OPTIONS.map((s) => <option key={s} value={s}>{s} PSF</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Wind Speed (MPH)</p>
            <select className={selCls} value={store.windSpeed} onChange={(e) => store.setField('windSpeed', Number(e.target.value))}>
              {WIND_OPTIONS.map((w) => <option key={w} value={w}>{w} mph</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Extra trusses — manual frames ADDED beyond the load-driven spacing */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Extra Trusses <span className="text-slate-600">· added beyond load spacing</span></p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => store.setField('extraTrussCount', Math.max(0, (store.extraTrussCount ?? 0) - 1))}
            className="h-7 w-7 rounded border border-white/15 text-slate-200 hover:border-white/40 hover:text-white text-base leading-none"
          >−</button>
          <span className="min-w-[2ch] text-center text-sm font-semibold text-white">{store.extraTrussCount ?? 0}</span>
          <button
            onClick={() => store.setField('extraTrussCount', (store.extraTrussCount ?? 0) + 1)}
            className="h-7 w-7 rounded border border-white/15 text-slate-200 hover:border-white/40 hover:text-white text-base leading-none"
          >+</button>
          {(store.extraTrussCount ?? 0) > 0 && (
            <button onClick={() => store.setField('extraTrussCount', 0)} className="text-[10px] text-slate-500 hover:text-slate-300 ml-1">reset</button>
          )}
        </div>
      </div>

      {/* Widespan truss style (only when over 30′ wide) */}
      {store.width > 30 && (
        <div>
          <p className="text-xs text-slate-400 mb-1.5">Widespan Truss Style</p>
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(WIDESPAN_TRUSS_STYLES).map(([id, label]) => (
              <button
                key={id}
                onClick={() => store.setField('widespanTrussStyle', id)}
                className={`rounded border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                  store.widespanTrussStyle === id
                    ? 'border-brand bg-brand/15 text-white'
                    : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auto-derived engineering package */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
          Engineering Package <span className="text-slate-600 normal-case tracking-normal">· per stamped load schedules</span>
        </p>
        <div className="space-y-1.5">
          {ENG_ROWS.map(({ label, value, why }) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-slate-500 w-14 shrink-0">{label}</span>
              <span className="text-[11px] font-semibold text-slate-200 flex-1">{value}</span>
              <span className="text-[10px] text-slate-600 italic shrink-0">{why}</span>
            </div>
          ))}
        </div>
        {!structure.loadAllowed && (
          <p className="mt-2 text-[10px] leading-snug text-amber-400/90">
            ⚠ {store.groundSnow} PSF snow @ {store.windSpeed} mph exceeds the standard schedule for this {structure.enclosed ? 'enclosed' : 'open'} building — requires site-specific engineering.
          </p>
        )}
      </div>
    </div>
  )
}

function OptionsSection({ store }) {
  const req = installRequirements(store)

  return (
    <div className="space-y-5">

      {/* Leg (column) style — Auto keeps the derived logic; override to force a type */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Leg Style</p>
        <div className="grid grid-cols-2 gap-1.5">
          {LEG_STYLE_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => store.setField('legStyle', id)}
              className={`rounded border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                (store.legStyle ?? 'auto') === id
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-white/10 text-slate-400 hover:border-white/25'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Installation Surface — ground & gravel combined; Cement = concrete */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Installation Surface</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[['concrete', 'Cement'], ['asphalt', 'Asphalt'], ['ground', 'Ground / Gravel']].map(([s, label]) => {
            const forced = req.requiresConcrete            // cement mandated by size
            const disabled = forced && s !== 'concrete'
            const active = forced ? s === 'concrete' : store.installationSurface === s
            return (
              <button
                key={s}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  store.setField('installationSurface', s)
                  store.setField('anchorType', SURFACE_ANCHORS[s][0])
                  // Drop any anchor add-ons that don't apply to the new surface.
                  const keep = new Set((ANCHOR_OPTIONS_BY_SURFACE[s] ?? []).map(([k]) => k))
                  ALL_ANCHOR_KEYS.forEach((k) => { if (!keep.has(k) && store.extraOptions[k]) store.setExtraOption(k, false) })
                }}
                className={`rounded border py-1.5 text-xs font-semibold transition-all ${
                  disabled ? 'border-white/5 text-slate-600 opacity-40 cursor-not-allowed'
                  : active ? 'border-brand bg-brand/15 text-white'
                  : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {req.requiresConcrete && (
          <p className="mt-1 text-[10px] text-amber-400/90">Cement required over 30′ wide or 12′ tall.</p>
        )}
      </div>

      {/* Anchors — synced to the installation surface (only the relevant set shows) */}
      <div>
        <p className="text-xs text-slate-400 mb-2">
          Anchors <span className="text-slate-600">· for {SURFACE_LABEL[store.installationSurface] ?? 'Ground / Gravel'}</span>
        </p>
        <div className="space-y-1.5">
          {(ANCHOR_OPTIONS_BY_SURFACE[store.installationSurface] ?? ANCHOR_OPTIONS_BY_SURFACE.ground).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!store.extraOptions[key]}
                onChange={(e) => store.setExtraOption(key, e.target.checked)}
                className="accent-brand"
              />
              <span className="text-xs text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Extra Options (general add-ons) */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Extra Options</p>
        <div className="space-y-1.5">
          {GENERAL_EXTRA_OPTIONS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!store.extraOptions[key]}
                onChange={(e) => store.setExtraOption(key, e.target.checked)}
                className="accent-brand"
              />
              <span className="text-xs text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Install equipment the customer provides — defaults to the size-based
          suggestion; adjust to signify how many they'll supply. Quote info ONLY:
          the rigs staged in the 3-D scene are strictly size-driven and can't be
          added or removed here. */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Install Equipment to Provide</p>
        <div className="space-y-2.5 rounded-lg border border-white/8 bg-white/3 p-3">
          <QtyStepper
            label="Scissor lifts"
            suggested={req.scissorQty}
            value={store.scissorLiftCount ?? req.scissorQty}
            overridden={store.scissorLiftCount != null}
            onChange={(n) => store.setField('scissorLiftCount', n)}
            onAuto={() => store.setField('scissorLiftCount', null)}
          />
          <QtyStepper
            label="Telehandler forklifts"
            hint={req.needsTelehandler ? `reach ≥ ${req.forkliftReach}′` : null}
            suggested={req.telehandlerQty}
            value={store.telehandlerCount ?? req.telehandlerQty}
            overridden={store.telehandlerCount != null}
            onChange={(n) => store.setField('telehandlerCount', n)}
            onAuto={() => store.setField('telehandlerCount', null)}
          />
        </div>
      </div>

      {/* Cement pour / edge — only on a cement (concrete) slab */}
      {(req.requiresConcrete || store.installationSurface === 'concrete') && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Cement Pour / Edge</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[['flat', 'Flat (extends past)'], ['flush', 'Flush edge'], ['notched', 'Notched edge'], ['beveled', 'Beveled edge']].map(([e, label]) => (
              <button
                key={e}
                onClick={() => store.setField('slabEdge', e)}
                className={`rounded border py-1.5 text-[11px] font-semibold transition-all ${
                  store.slabEdge === e ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Anchor type — options depend on the (effective) surface */}
      {(() => {
        const effSurface = req.requiresConcrete ? 'concrete' : store.installationSurface
        const valid = SURFACE_ANCHORS[effSurface] ?? []
        const current = valid.includes(store.anchorType) ? store.anchorType : valid[0]
        return (
          <div>
            <p className="text-xs text-slate-400 mb-2">Anchor Type</p>
            <div className="space-y-1.5">
              {valid.map((a) => (
                <button
                  key={a}
                  onClick={() => store.setField('anchorType', a)}
                  className={`w-full rounded border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                    current === a ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {ANCHOR_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Install requirements (equipment) */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Install Requirements</p>
        <ul className="space-y-1 text-[11px] text-slate-300">
          <li>· Foundation: <span className="font-semibold">{req.requiresConcrete ? 'Concrete (required)' : 'Any surface OK'}</span></li>
          {(() => {
            const sc = store.scissorLiftCount ?? req.scissorQty
            const th = store.telehandlerCount ?? req.telehandlerQty
            return (
              <>
                {sc > 0 && <li>· <span className="font-semibold">{sc}×</span> scissor lift{sc > 1 ? 's' : ''} to provide</li>}
                {th > 0 && <li>· <span className="font-semibold">{th}×</span> telehandler forklift{th > 1 ? 's' : ''} to provide{req.forkliftReach > 0 ? <> — reach ≥ <span className="font-semibold">{req.forkliftReach}′</span> (5–6′ over peak)</> : null}</li>}
                {sc === 0 && th === 0 && <li>· Standard install equipment</li>}
              </>
            )
          })()}
          <li>· Terrain: <span className="font-semibold">{req.allTerrain ? 'All-terrain (site not level)' : 'Standard (level site)'}</span></li>
        </ul>
      </div>

      {/* Boolean toggles */}
      <div className="space-y-2">
        {[
          ['jobSiteLevel',       'Job Site Level'        ],
          ['electricityAvailable','Electricity Available'],
          ['ladderLegsBaserail', 'Ladder Legs Baserail'  ],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-slate-300">{label}</span>
            <Toggle value={store[key]} onChange={(v) => store.setField(key, v)} />
          </div>
        ))}
      </div>

      {/* Drawings */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Drawings</p>
        <div className="space-y-1">
          {[
            ['none',       'None'               ],
            ['generic',    'Generic Drawing'    ],
            ['engineered', 'Engineered Drawing' ],
          ].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="drawings"
                value={val}
                checked={store.drawings === val}
                onChange={() => store.setField('drawings', val)}
                className="accent-brand"
              />
              <span className="text-xs text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Notes</p>
        <textarea
          value={store.notes}
          onChange={(e) => store.setField('notes', e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Start typing..."
          className="w-full rounded border border-white/10 bg-slate-800 px-2.5 py-2 text-xs text-slate-200 resize-none focus:border-brand focus:outline-none"
        />
        <p className="text-right text-[10px] text-slate-500 mt-0.5">{store.notes.length}/1000</p>
      </div>

      {/* "Other Components" custom line items moved to the Parts view (Parts
          toolbar toggle) so they sit alongside the detailed bill of materials. */}

    </div>
  )
}

// ─── Scene / Background Section ───────────────────────────────────────────────
const SURFACE_OPTIONS = [
  { id: 'ground',   label: 'Lawn'    },
  { id: 'concrete', label: 'Cement'  },
  { id: 'asphalt',  label: 'Asphalt' },
  { id: 'gravel',   label: 'Gravel'  },
]

// ── Site map: address → free OSM 3-D context + drag-to-place ──────────────────
function LandscapingSection({ store }) {
  const placingProp = store.placing?.category === 'prop'
  const placingLabel = PROP_TYPES.find((t) => t.id === store.placing?.propType)?.label
  return (
    <div className="space-y-4">
      {placingProp && (
        <div className="rounded-lg border border-brand bg-brand/15 p-3 text-xs text-white">
          Click the ground to place the {placingLabel || 'item'} — keep clicking to add more.
          <button onClick={() => store.cancelPlacing()} className="ml-2 underline text-slate-300">Done</button>
        </div>
      )}

      {/* Placed props — click to select, then resize / duplicate / delete / drag in 3D */}
      {store.landscaping.length > 0 && (
        <div className="space-y-1.5">
          {store.landscaping.map((p) => {
            const sel = store.selectedPropId === p.id
            const label = PROP_TYPES.find((t) => t.id === p.type)?.label || 'Item'
            return (
              <div
                key={p.id}
                onClick={() => store.selectProp(p.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  sel ? 'border-brand bg-brand/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">{label}</div>
                  <div className="text-[10px] text-slate-500">drag in 3D to move</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={p.scale ?? 1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => store.setPropField(p.id, 'scale', Number(e.target.value))}
                    className="rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 focus:border-brand focus:outline-none"
                  >
                    {[0.6, 0.8, 1, 1.25, 1.5].map((s) => <option key={s} value={s}>{Math.round(s * 100)}%</option>)}
                  </select>
                  <button title="Rotate 45°" onClick={(e) => { e.stopPropagation(); store.setPropField(p.id, 'rotation', (p.rotation ?? 0) + Math.PI / 4) }} className="text-slate-500 hover:text-brand"><RotateCw size={14} /></button>
                  <button title="Duplicate" onClick={(e) => { e.stopPropagation(); store.duplicateProp(p.id) }} className="text-slate-500 hover:text-brand"><Plus size={14} /></button>
                  <button title="Delete" onClick={(e) => { e.stopPropagation(); store.removeProp(p.id) }} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add prop → click-to-place on the ground, grouped Plants / Structures */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-3">
        {[
          { key: 'plants',     title: 'Plants' },
          { key: 'structures', title: 'Fences & Driveways' },
        ].map(({ key, title }) => (
          <div key={key} className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
            <div className="grid grid-cols-3 gap-2">
              {PROP_TYPES.filter((t) => (t.group ?? 'plants') === key).map((t) => (
                <button
                  key={t.id}
                  onClick={() => store.startPlacing({ category: 'prop', propType: t.id, ...(t.aligned ? { rotation: 0 } : {}) })}
                  className="rounded-lg border border-white/10 px-2 py-2 text-[11px] text-slate-300 hover:border-brand hover:text-white transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-slate-500">Pick a type, then click the ground to drop it. Drag to move; select to rotate, resize or delete. Tip: with one selected, Q / E (or ←/→) rotates it from any zoom — hold Shift for 45°.</p>
      </div>
    </div>
  )
}

// Builder snow/wind input options (must match SNOW_OPTIONS / WIND_OPTIONS below).
const REQ_SNOW_OPTS = [30, 40, 50, 60, 70, 80, 90]
const REQ_WIND_OPTS = [105, 115, 130, 140, 155, 165, 180]
// Smallest available option ≥ v (capped at the max). null when v is null/≤0.
function clampUpOption(v, opts) {
  if (v == null || v <= 0) return null
  return opts.find((o) => o >= v) ?? opts[opts.length - 1]
}
// Match a geocoded city to its /locations page (CA/AZ/NV) by rebuilding the slug
// with the address's state suffix (citySlug always yields a "-ca" base slug).
function resolveLocationPage(cityName, state) {
  if (!cityName) return null
  const suf = (state || 'CA').trim().toLowerCase() || 'ca'
  const slug = `${citySlug(cityName).replace(/-ca$/, '')}-${suf}`
  return getCityBySlug(slug)
}

// ── Site requirements: once an address is known, surface that jurisdiction's
// permit page + suggest the ground-snow / wind design loads (from the matched
// location page and the site elevation) so the user can apply them to the
// Engineering inputs with one click. ────────────────────────────────────────
function SiteRequirements({ store, site }) {
  const elevFt = site.elevM != null ? Math.round(site.elevM * 3.28084) : null
  const rec = resolveLocationPage(site.city, site.state)
  // Normalized loads from the matched location page (CA/AZ/NV field names differ).
  const recWind = rec ? (rec.designWindMph ?? rec.designWindSpeed ?? rec.windSpeed ?? null) : null
  const recSnow = rec ? (rec.designSnowPsf ?? rec.groundSnowLoad ?? rec.groundSnow ?? null) : null
  const recSnowNote = rec ? (rec.snowNote ?? rec.elevationNote ?? rec.aboveBandsNote ?? null) : null

  // Suggested ground snow = max(jurisdiction baseline, elevation-based estimate).
  const rawSnow = Math.max(recSnow ?? 0, suggestSnowFromElevation(elevFt) ?? 0)
  const snowOpt = clampUpOption(rawSnow, REQ_SNOW_OPTS)
  const windOpt = clampUpOption(recWind, REQ_WIND_OPTS)
  const overSchedule = rawSnow > 90

  if (elevFt == null && !rec) return null

  return (
    <div className="rounded-lg border border-brand/40 bg-brand/10 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-brand" />
        <p className="text-[11px] font-semibold text-white">Site requirements</p>
      </div>

      {elevFt != null && (
        <p className="text-[10px] text-slate-300">
          Elevation ≈ <span className="font-semibold text-white">{elevFt.toLocaleString()} ft</span>
          {rawSnow > 0 ? ' — a snow load applies at this elevation.' : ' — low elevation; snow rarely governs.'}
        </p>
      )}

      <div className="space-y-1.5">
        {snowOpt != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-200">
              <Snowflake size={11} className="text-brand" />
              Ground snow ≈ <span className="font-semibold text-white">{rawSnow}{overSchedule ? '+' : ''} PSF</span>
            </span>
            <button
              onClick={() => store.setField('groundSnow', snowOpt)}
              disabled={store.groundSnow === snowOpt}
              className="rounded border border-brand bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand/35 disabled:opacity-40"
            >
              {store.groundSnow === snowOpt ? 'Applied' : `Set ${snowOpt}`}
            </button>
          </div>
        )}
        {windOpt != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-200">
              <Wind size={11} className="text-brand" />
              Design wind ≈ <span className="font-semibold text-white">{recWind} mph</span>
            </span>
            <button
              onClick={() => store.setField('windSpeed', windOpt)}
              disabled={store.windSpeed === windOpt}
              className="rounded border border-brand bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand/35 disabled:opacity-40"
            >
              {store.windSpeed === windOpt ? 'Applied' : `Set ${windOpt}`}
            </button>
          </div>
        )}
      </div>

      {overSchedule && (
        <p className="text-[10px] text-amber-300/90">
          ≈{rawSnow} PSF exceeds the builder's 90 PSF schedule — high-elevation sites need site-specific engineering.
        </p>
      )}

      {recSnowNote && <p className="text-[10px] leading-relaxed text-slate-400">{recSnowNote}</p>}

      <p className="text-[10px] text-slate-400">
        These are suggestions — update the <span className="text-slate-200">Snow / Wind</span> inputs under Options and the engineered purlin, girt &amp; frame spacing recalculates to match.
      </p>

      {rec ? (
        <a
          href={`/locations/${rec.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          {rec.name}, {rec.stateCode} permit &amp; load requirements
          <ExternalLink size={11} className="shrink-0" />
        </a>
      ) : (
        <a
          href="https://ascehazardtool.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          Look up exact loads (ASCE Hazard Tool)
          <ExternalLink size={11} className="shrink-0" />
        </a>
      )}
    </div>
  )
}

function SiteMapControls({ store }) {
  const site = store.siteMap ?? {}
  const [street, setStreet] = useState(site.street || '')
  const [city, setCity]     = useState(site.city || '')
  const [state, setState]   = useState(site.state || '')
  const [zip, setZip]       = useState(site.zip || '')
  const loading = site.status === 'loading'
  const ready   = site.status === 'ready'

  // Address autocomplete (key-free). Debounced suggestions carry lat/lng, so
  // picking one places the site directly — no re-geocode, no "not found" miss.
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug]         = useState(false)
  const [activeIdx, setActiveIdx]     = useState(-1)
  const justSelectedRef = useRef(false)   // suppress the fetch that field-fill would trigger

  useEffect(() => {
    // Skip the re-run caused by selecting a suggestion (it fills the fields).
    if (justSelectedRef.current) { justSelectedRef.current = false; return }
    if (street.trim().length < 4) { setSuggestions([]); setShowSug(false); return }
    const q = [street, city, state].map((v) => v.trim()).filter(Boolean).join(', ')
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const list = await suggestAddresses(q, { signal: ctrl.signal })
        setSuggestions(list)
        setShowSug(list.length > 0)
        setActiveIdx(-1)
      } catch { /* aborted or failed — leave the last list in place */ }
    }, 450)   // generous debounce (OSM policy discourages per-keystroke calls)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [street, city, state])

  const selectSuggestion = (sug) => {
    justSelectedRef.current = true
    setStreet(sug.street || street)
    setCity(sug.city || '')
    setState(sug.state || '')
    setZip(sug.zip || '')
    setSuggestions([])
    setShowSug(false)
    setActiveIdx(-1)
    load({ ...sug, street: sug.street || street })   // pass values explicitly (setState is async)
  }

  const onStreetKeyDown = (e) => {
    if (showSug && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Escape')    { setShowSug(false); return }
      if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[activeIdx]); return }
    }
    if (e.key === 'Enter') load()
  }

  const load = async (preset) => {
    const s  = (preset?.street ?? street).trim()
    const c  = (preset?.city   ?? city).trim()
    const st = (preset?.state  ?? state).trim()
    const z  = (preset?.zip    ?? zip).trim()
    const parts = [s, c, [st, z].filter(Boolean).join(' ').trim()]
    const q = preset?.label || parts.filter(Boolean).join(', ')
    if (!q || loading) return
    setShowSug(false)
    store.setSiteMap({
      status: 'loading', error: null, address: q,
      street: s, city: c, state: st, zip: z,
    })
    try {
      // A picked suggestion already carries coordinates — use them and skip geocoding.
      const { lat, lng, label } = (preset?.lat != null && preset?.lng != null)
        ? { lat: preset.lat, lng: preset.lng, label: preset.label || q }
        : await geocodeAddress(q)
      const radiusM = site.radiusM ?? 250
      const features = await fetchSiteFeatures(lat, lng, radiusM)
      // Buildings: prefer Overture (OSM+Microsoft+Google, with heights) when the
      // backend serves it; otherwise fall back to the OSM footprints. Overture
      // already conflates OSM, so we use one or the other (no double-render).
      const overture = await fetchOvertureBuildings(lat, lng, radiusM)
      const buildings = overture ?? features.buildings
      // Satellite tile (key-free) + elevation grid (server/Google; null if unavailable).
      const satUrl = esriSatUrl(lat, lng, radiusM)
      const elev = await fetchElevationGrid(lat, lng, radiusM, 32)   // finer relief (hills/valleys)
      // Pools detected by colour-analysing the satellite tile (no OSM data needed).
      const pools = await detectPools(satUrl, lat, lng, radiusM).catch(() => [])
      store.setSiteMap({
        lat, lng, label, ...features, buildings, pools, status: 'ready', error: null,
        satUrl, elevM: elev?.elevM ?? null, gridN: elev?.n ?? 0,
      })
      store.setField('siteMapEnabled', true)
      store.setBuildingPlacement({ x: 0, z: 0 })
    } catch (e) {
      store.setSiteMap({ status: 'error', error: e?.message || 'Failed to load site' })
    }
  }

  const rotDeg = Math.round(((store.buildingPlacement?.rotation ?? 0) * 180) / Math.PI)

  return (
    <div className="rounded-lg border border-white/10 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-brand" />
        <p className="text-xs font-semibold text-slate-200">Place on a real address</p>
      </div>
      <div className="space-y-1.5">
        <div className="relative">
          <input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            onKeyDown={onStreetKeyDown}
            onFocus={() => suggestions.length && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 120)}
            placeholder="Start typing an address…"
            autoComplete="off"
            className="w-full min-w-0 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-white/15 bg-slate-900/95 shadow-xl backdrop-blur">
              {suggestions.map((sug, i) => (
                <li key={`${sug.lat},${sug.lng},${i}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}   // keep input focus so onClick fires
                    onClick={() => selectSuggestion(sug)}
                    className={`flex w-full items-start gap-1.5 px-2 py-1.5 text-left text-[11px] leading-snug text-slate-200 hover:bg-white/10 ${i === activeIdx ? 'bg-white/10' : ''}`}
                  >
                    <MapPin size={11} className="mt-0.5 shrink-0 text-brand" />
                    <span className="min-w-0 truncate" title={sug.label}>{sug.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="City"
          className="w-full min-w-0 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
        />
        <div className="flex gap-1.5">
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="State"
            className="w-16 min-w-0 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
          />
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="ZIP"
            inputMode="numeric"
            className="w-20 min-w-0 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
          />
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex-1 rounded border border-brand bg-brand/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/25 disabled:opacity-50"
          >
            {loading ? '…' : 'Load'}
          </button>
        </div>
      </div>

      {site.status === 'error' && <p className="text-[10px] text-red-400">{site.error}</p>}
      {ready && (
        <>
          <p className="text-[10px] text-emerald-400/90 truncate" title={site.label}>
            {(() => {
              const bn = site.buildings?.length ?? 0
              const fn = (site.trees?.length ?? 0) + (site.roads?.length ?? 0) + (site.fences?.length ?? 0) + (site.ground?.length ?? 0)
              const summary = bn > 0 ? `${bn} building${bn === 1 ? '' : 's'}` : (fn > 0 ? 'open lot · site detail loaded' : 'open lot · satellite only')
              return `✓ ${summary} · ${site.label}`
            })()}
          </p>
          <SiteRequirements store={store} site={site} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-300">Show site map</span>
            <Toggle value={!!store.siteMapEnabled} onChange={(v) => store.setField('siteMapEnabled', v)} labels={['Off', 'On']} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-300">Satellite terrain</span>
            <Toggle value={store.terrainEnabled !== false} onChange={(v) => store.setField('terrainEnabled', v)} labels={['Off', 'On']} />
          </div>
          {store.terrainEnabled !== false && (
            <p className="text-[10px] text-slate-500">
              {site.elevM ? 'Satellite imagery + elevation relief.' : 'Satellite imagery (flat — enable the Geocoding/Elevation API for relief).'}
            </p>
          )}
          <div className="border-t border-white/10 pt-2 space-y-1.5">
            <p className="text-[10px] text-slate-400">Map detail layers</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Trees &amp; woods{site.trees?.length ? ` (${site.trees.length})` : ''}</span>
              <Toggle value={store.componentVisibility?.siteTrees !== false} onChange={() => store.toggleComponent('siteTrees')} labels={['Off', 'On']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Roads, driveways &amp; parking</span>
              <Toggle value={store.componentVisibility?.siteRoads !== false} onChange={() => store.toggleComponent('siteRoads')} labels={['Off', 'On']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Parked cars{site.parking?.length ? '' : ' (none nearby)'}</span>
              <Toggle value={store.componentVisibility?.siteCars !== false} onChange={() => store.toggleComponent('siteCars')} labels={['Off', 'On']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Swimming pools{site.pools?.length ? ` (${site.pools.length})` : ' (none found)'}</span>
              <Toggle value={store.componentVisibility?.sitePools !== false} onChange={() => store.toggleComponent('sitePools')} labels={['Off', 'On']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Ground cover (grass/crops/dirt/concrete/asphalt)</span>
              <Toggle value={store.componentVisibility?.siteGround !== false} onChange={() => store.toggleComponent('siteGround')} labels={['Off', 'On']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">Fences &amp; hedges{site.fences?.length ? ` (${site.fences.length})` : ''}</span>
              <Toggle value={store.componentVisibility?.siteFences !== false} onChange={() => store.toggleComponent('siteFences')} labels={['Off', 'On']} />
            </div>
          </div>
          <Slider label="Rotate building" value={rotDeg} min={0} max={359} step={1} unit="°"
            onChange={(v) => store.setBuildingPlacement({ rotation: (v * Math.PI) / 180 })} />
          <button
            onClick={() => store.setField('rotatingBuilding', !store.rotatingBuilding)}
            className={`w-full rounded border py-1.5 text-[11px] font-semibold transition-colors ${
              store.rotatingBuilding
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            {store.rotatingBuilding ? '✓ Place rotation' : 'Rotate freely (follows mouse)'}
          </button>
          <button
            onClick={() => store.setBuildingPlacement({ x: 0, z: 0, rotation: 0 })}
            className="w-full rounded border border-white/10 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-white/25"
          >
            Recenter building
          </button>
          <p className="text-[10px] text-slate-500">Drag the building in the 3D view to position it on the lot. "Rotate freely" makes it follow your mouse — click ✓ to place. Q / E (or ←/→) nudge 15° when nothing else is selected.</p>
        </>
      )}

      {/* Search radius is fixed at the store default (250 m) — no visible control. */}
      <p className="text-[10px] text-slate-500">Free OpenStreetMap data — no API key. Heights are estimated where unmapped.</p>
    </div>
  )
}

function SceneSection({ store }) {
  return (
    <div className="space-y-4">
      <SiteMapControls store={store} />

      {/* Ground Type — the surrounding YARD, independent of the building's
          Installation Surface (set under Options). Mix & match freely. */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">Ground Type (yard)</p>
        <Segmented
          value={store.groundType}
          options={SURFACE_OPTIONS}
          onChange={(v) => store.setField('groundType', v)}
        />
        <p className="text-[10px] text-slate-500 mt-1">
          The yard around the building. Independent of the Installation Surface
          {store.installationSurface !== store.groundType
            ? ` (currently ${SURFACE_LABEL[store.installationSurface] ?? store.installationSurface}) — the prepared pad shows under the build.`
            : ' (set under Options) — mix & match, e.g. a cement pad on a lawn.'}
        </p>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
// Component list (key → label) for the show/hide panel — order roughly outside-in.
const COMPONENT_GROUPS = [
  { label: 'Structure', items: [
    ['frames',     'Trusses / Frames'],
    ['sideLegs',   'Side Legs'],
    ['endPosts',   'End-Wall Posts'],
    ['baseRails',  'Base Rails'],
    ['purlins',    'Roof Purlins'],
    ['girts',      'Wall Girts'],
    ['braces',     'Diagonal Braces'],
    ['foundation', 'Foundation & Anchors'],
  ]},
  { label: 'Skin', items: [
    ['roof',       'Roof Panels'],
    ['walls',      'Wall Panels'],
    ['wainscot',   'Wainscot'],
    ['skylights',  'Skylights'],
    ['doors',      'Doors & Windows'],
  ]},
  { label: 'Trim', items: [
    ['ridgeCap',   'Ridge Cap'],
    ['eaveTrim',   'Eave Trim'],
    ['rakeTrim',   'Rake Trim'],
    ['cornerTrim', 'Corner Trim'],
  ]},
  { label: 'Wings', items: [
    ['leanTos',    'Lean-To Wings'],
  ]},
]
const COMPONENT_KEYS = COMPONENT_GROUPS.flatMap((g) => g.items.map(([k]) => k))

// Singular names for the enumerated parts list (Wall Girt 1, 2, 3 …).
const PART_SINGULAR = {
  frames: 'Truss', sideLegs: 'Side Leg', endPosts: 'End Post', baseRails: 'Base Rail',
  purlins: 'Roof Purlin', girts: 'Wall Girt', braces: 'Diagonal Brace', foundation: 'Foundation',
  roof: 'Roof Panel', walls: 'Wall', wainscot: 'Wainscot', skylights: 'Skylight', doors: 'Opening',
  ridgeCap: 'Ridge Cap', eaveTrim: 'Eave Trim', rakeTrim: 'Rake Trim', cornerTrim: 'Corner Trim', leanTos: 'Lean-To',
}

const SIDE_LABEL = { left: 'Left', right: 'Right', front: 'Front', back: 'Back' }

// The enumerated, individually-named instances for a component → [{ id, name }].
// Lean-tos enumerate by their actual enabled wing (Left/Right/Front/Back) so the
// id matches what Building.jsx hides; everything else is a simple 1…N list.
function partInstances(key, store, n) {
  if (key === 'leanTos') {
    return ['left', 'right', 'front', 'back']
      .filter((s) => store.leanTos?.[s]?.enabled)
      .map((s) => ({ id: `leanTos#${s}`, name: `${SIDE_LABEL[s]} Lean-To` }))
  }
  return Array.from({ length: n }, (_, i) => ({ id: `${key}#${i}`, name: `${PART_SINGULAR[key]} ${i + 1}` }))
}

// Count of each component for the current building (drives the enumerated list).
function partCounts(store) {
  const st = deriveStructure(store)
  const { width, length, height, walls = {}, roofStyle, wallOrientation, roofPitch = 3, doors = [], leanTos = {} } = store
  const closed = (s) => isFullyClosed(walls[s])
  const frames = frameSpan(length, st.spacing).length
  const closedEnds = ['front', 'back'].filter(closed).length
  const endInterior = Math.max(0, frameSpan(width, st.endPostSpacing).length - 2)
  const vertical = (wallOrientation === 'auto' || !wallOrientation) ? roofStyle === 'a_frame_vertical' : wallOrientation === 'vertical'
  const closedWalls = ['front', 'back', 'left', 'right'].filter(closed).length
  const ridgeHeight = height + (width / 2) * Math.tan(Math.atan(roofPitch / 12))
  return {
    frames,
    sideLegs: frames * 2,
    endPosts: closedEnds * endInterior,
    baseRails: 2 + closedEnds,
    purlins: roofStyle === 'a_frame_vertical' ? purlinRowCount(width, ridgeHeight, height, st.purlinSpacing) * 2 : 0,
    girts: wallGirtCount(width, length, height, ridgeHeight, roofStyle, walls, doors,
      (wallOrientation === 'auto' || !wallOrientation) ? (roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal') : wallOrientation,
      st.girtSpacing),
    braces: st.bracing === 'diagonal' ? (2 * (Math.ceil(length / 40) + 1) + closedEnds * (Math.ceil(width / 40) + 1)) : 0,
    foundation: 1,
    roof: roofStyle === 'regular' ? 1 : 2,
    walls: closedWalls,
    wainscot: store.wainscotEnabled ? closedWalls : 0,
    skylights: store.skylights?.length ?? 0,
    doors: doors.length,
    ridgeCap: roofStyle !== 'regular' ? 1 : 0,
    eaveTrim: ['left', 'right'].filter((s) => walls[s] !== 'open').length,
    rakeTrim: roofStyle !== 'regular' ? closedEnds * 2 : 0,
    cornerTrim: 4,
    leanTos: Object.values(leanTos).filter((l) => l?.enabled).length,
  }
}

// ── Detailed bill of materials ────────────────────────────────────────────────
// The SAME catalog the Diagnostic panel reads — getComponents(config) grouped by
// CATEGORY_ORDER (Foundation / Frame / Secondary steel / Skin / Trim / Fasteners /
// Openings). So Parts, Diagnostic and the calculator all stay in sync off one
// source. Each row: bubble no · name · qty+unit, with the member spec + spacing/
// length note beneath.
function BillOfMaterials({ store }) {
  const items = getComponents(store)
  const fastenerSched = getFastenerSchedule(store)   // packaging per fastener/anchor line
  const byCat = CATEGORY_ORDER
    .map((cat) => ({ cat, rows: items.filter((it) => it.category === cat) }))
    .filter((g) => g.rows.length > 0)
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 pt-1">Bill of Materials</p>
      {byCat.map(({ cat, rows }) => (
        <div key={cat} className="space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold">{cat}</p>
          {rows.map((it) => {
            const pkg = packagingForItem(it.id, store, fastenerSched)
            return (
              <div key={it.id} className="rounded border border-white/8 bg-white/3 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded bg-white/12 text-[9px] font-bold text-slate-300">{it.no}</span>
                  <span className="flex-1 text-[11px] font-medium text-slate-200 leading-tight">{it.name}</span>
                  {it.qty != null && (
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{it.qty} {it.unit}</span>
                  )}
                </div>
                <div className="pl-[24px] text-[9.5px] text-slate-500 leading-snug">
                  {it.material}{it.detail ? ` · ${it.detail}` : ''}
                </div>
                {/* Fastener/anchor packaging — ≈N · M/box · K boxes per line */}
                {pkg.map((p) => (
                  <div key={p.name} className="pl-[24px] text-[9.5px] text-slate-400 leading-snug">
                    <span className="text-slate-500">{p.name}: </span>
                    <span className="font-semibold text-brand/90">{p.text}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}

      {/* Raw material takeoff — sticks / cuts / welds + panel cut list (collapsible) */}
      <RawMaterialsSection config={store} variant="parts" />
    </div>
  )
}

// ── Custom line items ("Other") ───────────────────────────────────────────────
// Free-text add-ons appended to the parts list (name + qty). Same UX as before,
// now living in the Parts view alongside the BOM.
function CustomComponents({ store }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 pt-1 mb-2">Other Components</p>
      {store.customComponents.map((comp, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5">
          <input
            value={comp.name}
            onChange={(e) => {
              const c = [...store.customComponents]
              c[i] = { ...c[i], name: e.target.value }
              store.setField('customComponents', c)
            }}
            placeholder="Component name"
            className="flex-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
          />
          <input
            type="number"
            value={comp.qty}
            min={1}
            onChange={(e) => {
              const c = [...store.customComponents]
              c[i] = { ...c[i], qty: Number(e.target.value) }
              store.setField('customComponents', c)
            }}
            className="w-12 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
          />
          <button
            onClick={() => store.setField('customComponents', store.customComponents.filter((_, j) => j !== i))}
            className="text-slate-500 hover:text-red-400 px-1 text-xs"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => store.setField('customComponents', [...store.customComponents, { name: '', qty: 1 }])}
        className="mt-1 w-full rounded border border-dashed border-white/15 py-1.5 text-xs text-slate-500 hover:border-white/30 hover:text-slate-400 transition-colors"
      >
        + Add Component
      </button>
    </div>
  )
}

function ComponentsSection({ store }) {
  const vis = store.componentVisibility ?? {}
  const allOn = COMPONENT_KEYS.every((k) => vis[k] !== false)
  const [expanded, setExpanded] = useState(null)
  const counts = partCounts(store)
  // Catalog items (with per-instance `instances`) keyed by id — the single source
  // for the granular tree so the Parts view and the Diagnostic legend match.
  const catById = Object.fromEntries(getComponents(store).map((it) => [it.id, it]))
  // Lean-tos keep the LEGACY per-instance scheme (hiddenParts) since they enumerate
  // by enabled wing, not by the catalog.
  const hidden = store.hiddenParts ?? {}
  return (
    <div className="space-y-3">
      {/* Detailed BOM — same catalog the Diagnostic panel + calculator read */}
      <BillOfMaterials store={store} />

      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 pt-2">Show / Hide Parts</p>
      <p className="text-[10px] text-slate-500">Toggle individual parts on or off to show or hide them on the building.</p>
      <div className="flex gap-1.5">
        <button
          onClick={() => store.setAllComponents(true)}
          className="flex-1 rounded border border-white/10 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/25"
        >
          Show all
        </button>
        <button
          onClick={() => store.setAllComponents(false)}
          className="flex-1 rounded border border-white/10 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/25"
        >
          Hide all
        </button>
      </div>

      {/* Ground anchors — a view overlay rather than a removable part, so it lives
          here in the Parts view next to the structural components. */}
      <button
        onClick={() => store.setField('showAnchors', !store.showAnchors)}
        className={`flex w-full items-center justify-between rounded border px-3 py-2 text-xs font-medium transition-all ${
          store.showAnchors ? 'border-brand/40 bg-brand/10 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
        }`}
        title="Toggle per-post ground anchors"
      >
        <span className="flex items-center gap-1.5"><Anchor size={13} /> Ground Anchors</span>
        {store.showAnchors ? <Eye size={14} className="text-brand" /> : <EyeOff size={14} className="opacity-50" />}
      </button>
      {COMPONENT_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 pt-1">{group.label}</p>
          {group.items.map(([key, label]) => {
            const on = vis[key] !== false
            const n  = counts[key] ?? 0
            const item = catById[key]
            // Granular tree: prefer the catalog's per-instance list; lean-tos fall
            // back to the legacy enumerated list (by enabled wing).
            const catInstances = item?.instances ?? []
            const legacyList   = key === 'leanTos' ? partInstances(key, store, n) : []
            const canList = catInstances.length > 1 || legacyList.length > 1
            const isOpen = expanded === key
            return (
              <div key={key}>
                <div className={`flex w-full items-center gap-1 rounded border text-xs font-medium transition-all ${
                  on ? 'border-brand/40 bg-brand/10 text-white' : 'border-white/10 text-slate-500'
                }`}>
                  <button onClick={() => store.toggleComponent(key)} className="flex flex-1 items-center justify-between px-3 py-2 hover:opacity-80">
                    <span>{label}</span>
                    <span className="flex items-center gap-1.5">
                      {n > 0 && <span className="rounded bg-white/10 px-1.5 text-[10px] text-slate-300">{n}</span>}
                      {on ? <Eye size={14} className="text-brand" /> : <EyeOff size={14} className="opacity-50" />}
                    </span>
                  </button>
                  {canList && (
                    <button onClick={() => setExpanded(isOpen ? null : key)} className="px-1.5 py-2 text-slate-400 hover:text-white" title="List parts">
                      <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {isOpen && canList && catInstances.length > 1 && (
                  <PartInstanceRows item={item} variant="parts" />
                )}
                {isOpen && canList && catInstances.length <= 1 && legacyList.length > 1 && (
                  <div className="mt-1 ml-2 grid grid-cols-1 gap-y-0.5 border-l border-white/10 pl-2">
                    {legacyList.map(({ id, name }) => {
                      const partOn = !hidden[id]
                      return (
                        <button
                          key={id}
                          onClick={() => store.togglePart(id)}
                          className={`flex items-center justify-between text-[10px] ${partOn ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                          <span>{name}</span>
                          {partOn ? <Eye size={11} className="text-brand/80" /> : <EyeOff size={11} className="opacity-50" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {!allOn && (
        <p className="text-[10px] text-amber-400/80">Some parts are hidden — they're still included in the build &amp; price.</p>
      )}

      {/* Custom line items ("Other") — kept from the old parts list */}
      <CustomComponents store={store} />
    </div>
  )
}

export default function BuilderPanel() {
  const store  = useBuilderStore()
  // Sections open independently: clicking a header toggles ONLY that section, so
  // you can expand several (or all) and scroll — nothing auto-collapses.
  const [openSections, setOpenSections] = useState(() => new Set(['size']))
  const toggle = (id) => setOpenSections((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const isOpen = (id) => openSections.has(id)

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="px-4 py-3 border-b border-white/8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Configure Your Building</p>
      </div>

      <div className="overflow-y-auto flex-1">
        <Section id="size"    active={isOpen('size')}    onToggle={toggle} icon={<Ruler size={14} />}         title="Size & Structure">
          <SizeSection store={store} />
        </Section>
        <Section id="walls"   active={isOpen('walls')}   onToggle={toggle} icon={<Square size={14} />}        title="Walls">
          <WallsSection store={store} />
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Layers size={12} /> Interior Walls
            </p>
            <InteriorWallsSection store={store} />
          </div>
        </Section>
        <Section id="colors"  active={isOpen('colors')}  onToggle={toggle} icon={<Palette size={14} />}       title="Colors">
          <ColorsSection store={store} />
        </Section>
        <Section id="doors"   active={isOpen('doors')}   onToggle={toggle} icon={<DoorOpen size={14} />}      title="Doors & Windows">
          <DoorsSection store={store} />
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Sun size={12} /> Skylights
            </p>
            <SkylightsSection store={store} />
          </div>
        </Section>
        <Section id="leanto"  active={isOpen('leanto')}  onToggle={toggle} icon={<LayoutTemplate size={14} />} title="Lean-To Wings">
          <LeanToSection store={store} />
        </Section>
        <Section id="engineering" active={isOpen('engineering')} onToggle={toggle} icon={<ShieldCheck size={14} />} title="Engineering">
          <EngineeringSection store={store} />
        </Section>
        <Section id="options" active={isOpen('options')} onToggle={toggle} icon={<Settings size={14} />}      title="Options">
          <OptionsSection store={store} />
        </Section>
        <Section id="scene"   active={isOpen('scene')}   onToggle={toggle} icon={<Globe size={14} />}          title="Scene / Background">
          <SceneSection store={store} />
        </Section>
      </div>
    </div>
  )
}

// Dedicated left sidebar for the Components / Parts view — opened by the "Parts"
// toolbar toggle (store.showLabels). Shows the parts list (with its dropdown
// already open) alongside the 3D part labels; hidden otherwise.
export function PartsSidebar() {
  const store = useBuilderStore()
  if (!store.showLabels) return null
  return (
    <div className="absolute lg:relative inset-y-0 left-0 z-40 w-[86%] max-w-xs lg:w-72 lg:max-w-none shrink-0 border-r border-white/8 bg-slate-950 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Layers size={13} /> Components / Parts
        </p>
        <button onClick={() => store.setField('showLabels', false)} className="text-slate-500 hover:text-white" title="Close parts view">
          <X size={14} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3">
        <ComponentsSection store={store} />
      </div>
    </div>
  )
}

// Quick paint presets for placed vehicles (plus a free color picker per vehicle).
const VEHICLE_COLORS = ['#b3322f', '#1f2933', '#e7e9ec', '#37506b', '#2f6b4f', '#7a7d82', '#f3c01b', '#8a1c1c', '#243b53', '#c0c4c9']

function VehiclesSection({ store }) {
  const placingVehicle = store.placing?.category === 'vehicle'
  return (
    <div className="space-y-4">
      <p className="text-[10px] text-slate-500">
        Drop true-to-scale vehicles next to your building to picture how much room you'll have. Everything is sized in real feet, so it scales with the build.
      </p>

      {placingVehicle && (
        <div className="rounded-lg border border-brand bg-brand/15 p-3 text-xs text-white">
          Click the ground to place the {vehicleMeta(store.placing.vehicleType)?.label ?? 'vehicle'} — keep clicking to add more.
          <button onClick={() => store.cancelPlacing()} className="ml-2 underline text-slate-300">Done</button>
        </div>
      )}

      {/* Placed vehicles — select, recolor, rotate, duplicate, delete (drag in 3D) */}
      {store.vehicles.length > 0 && (
        <div className="space-y-2">
          {store.vehicles.map((v) => {
            const meta = vehicleMeta(v.type)
            const sel = store.selectedVehicleId === v.id
            return (
              <div
                key={v.id}
                onClick={() => store.selectVehicle(v.id)}
                className={`rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  sel ? 'border-brand bg-brand/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">{meta?.label ?? 'Vehicle'}</div>
                    <div className="text-[10px] text-slate-500">{meta ? `${meta.l}′ × ${meta.w}′` : ''} · drag in 3D</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/25" style={{ background: v.color }} />
                    <button title="Rotate 45°" onClick={(e) => { e.stopPropagation(); store.setVehicleField(v.id, 'rotation', (v.rotation ?? 0) + Math.PI / 4) }} className="text-slate-500 hover:text-brand"><RotateCw size={14} /></button>
                    <button title="Duplicate" onClick={(e) => { e.stopPropagation(); store.duplicateVehicle(v.id) }} className="text-slate-500 hover:text-brand"><Plus size={14} /></button>
                    <button title="Delete" onClick={(e) => { e.stopPropagation(); store.removeVehicle(v.id) }} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
                  </div>
                </div>
                {sel && (
                  <div className="mt-2.5 border-t border-white/8 pt-2.5" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Color</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {VEHICLE_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => store.setVehicleField(v.id, 'color', c)}
                          className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${v.color === c ? 'border-white ring-1 ring-brand' : 'border-white/20'}`}
                          style={{ background: c }}
                          title={c}
                        />
                      ))}
                      <label className="ml-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-white/30 text-[9px] text-slate-400" title="Custom color">
                        +
                        <input
                          type="color"
                          value={v.color}
                          onChange={(e) => store.setVehicleField(v.id, 'color', e.target.value)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add vehicle → click-to-place on the ground */}
      <div className="rounded-lg border border-white/8 bg-white/3 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Add Vehicle</p>
        <div className="grid grid-cols-2 gap-2">
          {VEHICLE_TYPES.map((t) => {
            const active = placingVehicle && store.placing.vehicleType === t.id
            return (
              <button
                key={t.id}
                onClick={() => store.startPlacing({ category: 'vehicle', vehicleType: t.id, color: t.color })}
                className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  active ? 'border-brand bg-brand/15 text-white' : 'border-white/10 text-slate-300 hover:border-brand hover:text-white'
                }`}
              >
                <span className="text-[11px] font-medium">{t.label}</span>
                <span className="text-[9px] text-slate-500">{t.l}′ × {t.w}′</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-500">Pick a vehicle, then click the ground to drop it. Drag to move; select to recolor, rotate or delete. Tip: with one selected, Q / E (or ←/→) rotates it from any zoom — hold Shift for 45°.</p>
      </div>
    </div>
  )
}

// Dedicated sidebar for the Vehicles & Landscaping tool — opened by the toolbar
// toggle (store.showVehicles). Lets you place scale-reference vehicles plus
// landscaping props (trees, shrubs, fences, driveways), recolor/resize them and
// drag them around the build to gauge clearance; hidden otherwise.
export function VehiclesSidebar() {
  const store = useBuilderStore()
  if (!store.showVehicles) return null
  return (
    <div className="absolute lg:relative inset-y-0 left-0 z-40 w-[86%] max-w-xs lg:w-72 lg:max-w-none shrink-0 border-r border-white/8 bg-slate-950 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Car size={13} /> Vehicles & Landscaping
        </p>
        <button onClick={() => { store.cancelPlacing(); store.setField('showVehicles', false) }} className="text-slate-500 hover:text-white" title="Close vehicles & landscaping">
          <X size={14} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5">
        <VehiclesSection store={store} />
        {/* Landscaping — shade trees, pines, shrubs, fences & driveways.
            Moved here from the left Scene panel so all scene props share one tool. */}
        <div className="border-t border-white/8 pt-4">
          <p className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Trees size={13} className="text-brand" /> Landscaping
          </p>
          <LandscapingSection store={store} />
        </div>
      </div>
    </div>
  )
}
