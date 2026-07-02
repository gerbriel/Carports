"""Design orchestrator (POC): geometry → ASCE 7 loads → member checks → BOM.

This mirrors the front-end 3D builder / material calculator, but adds real
capacity checks so the output is a *draft* engineering basis. It is NOT a stamped
design — see the disclaimer. Production roadmap (see README):
  • frame analysis  → Pynite (2D/3D FEM of the bent) instead of the simple-beam POC
  • member design   → AISI S100 DSM via sectionproperties + pyCUFSM
  • drawings        → ezdxf (DXF) / build123d
  • calc package    → ReportLab PDF, then licensed-PE review + stamp
"""
from __future__ import annotations
import math

from .schemas import BuildingSpec
from . import loads, sections

DEAD_PSF = 2.0  # collateral dead load per the generics

DISCLAIMER = (
    "DRAFT — computer-generated preliminary engineering basis. NOT a permit document. "
    "Must be reviewed, verified, and stamped by a licensed Professional Engineer before "
    "use. Loads/capacities are POC closed-form approximations (no full FEM or AISI S100 "
    "local/distortional buckling)."
)


def estimate_frame_spacing(pg: float, wind: float) -> float:
    """Coarse envelope. Production should read the stamped Table 4 (the 3D builder's
    frameSpacing.js already encodes the full width×eave×load×wind chart)."""
    s = 5.0
    if pg > 30 or wind > 130:
        s = 4.0
    if pg > 50 or wind > 155:
        s = 3.0
    if pg > 70 or wind > 170:
        s = 2.5
    return s


def _check(member, section_name, demand, capacity, unit):
    dcr = (demand / capacity) if capacity else float("inf")
    return {
        "member": member, "section": section_name,
        "demand": round(demand, 1), "capacity": round(capacity, 1), "unit": unit,
        "dcr": round(dcr, 2), "status": "OK" if dcr <= 1.0 else "OVERSTRESSED",
    }


def run_design(spec: BuildingSpec) -> dict:
    warnings: list[str] = []
    has_ridge = spec.roof_style != "standard"
    angle = math.atan((spec.pitch or 0) / 12.0)
    half_w = spec.width_ft / 2.0
    rise = (half_w if has_ridge else spec.width_ft) * (spec.pitch / 12.0)
    peak = spec.eave_ft + rise
    rafter_run = half_w if has_ridge else spec.width_ft
    slope_len = rafter_run / max(0.01, math.cos(angle))

    spacing = spec.frame_spacing_ft or estimate_frame_spacing(spec.ground_snow_psf, spec.wind_speed_mph)
    frames = max(2, math.floor(spec.length_ft / spacing) + 1)

    # ── Loads ────────────────────────────────────────────────────────────────
    snow = loads.snow_loads(spec.ground_snow_psf)
    wind = loads.wind_loads(spec.wind_speed_mph, spec.exposure)
    gravity_psf = DEAD_PSF + max(snow["ps"], spec.roof_live_psf)
    load_block = {"dead_psf": DEAD_PSF, "roof_live_psf": spec.roof_live_psf,
                  "snow": snow, "wind": wind, "gravity_design_psf": round(gravity_psf, 2)}
    weight_lb = gravity_psf * spec.width_ft * spec.length_ft
    if spec.sds is not None:
        load_block["seismic"] = loads.seismic_loads(spec.sds, weight_lb)

    # ── Member checks ──────────────────────────────────────────────────────────
    tube = sections.square_tube(spec.tube_outer_in, spec.tube_gauge)
    checks = []

    # Rafter (roof beam): simple beam over the sloped half-span, tributary = spacing.
    w_rafter = gravity_psf * spacing                      # plf
    m_rafter = w_rafter * slope_len**2 / 8.0 * 12.0        # lb-in
    checks.append(_check("Roof beam (rafter)", tube["name"], m_rafter,
                         sections.allowable_moment_lbin(tube["S"]), "lb-in (moment)"))

    # Purlin (hat): simple beam spanning frame spacing, tributary = purlin spacing.
    w_purlin = gravity_psf * spec.purlin_spacing_ft
    m_purlin = w_purlin * spacing**2 / 8.0 * 12.0
    hat = sections.HAT_4x1_14GA
    checks.append(_check("Purlin", hat["name"], m_purlin,
                         sections.allowable_moment_lbin(hat["S"]), "lb-in (moment)"))

    # Column: axial from half-width tributary roof area (gravity).
    p_col = gravity_psf * (rafter_run) * spacing          # lb
    checks.append(_check("Column post", tube["name"], p_col,
                         sections.allowable_axial_lb(tube["A"], tube["r"], spec.eave_ft * 12.0),
                         "lb (axial)"))

    if any(c["status"] != "OK" for c in checks):
        warnings.append("One or more members are overstressed at this spacing — tighten "
                        "frame/purlin spacing, increase gauge, or reduce span.")
    if spec.width_ft > 30:
        warnings.append(f"{spec.width_ft}' exceeds the 30' generic envelope — project-specific engineering required.")

    # ── BOM (mirror of the front-end takeoff) ─────────────────────────────────
    enclosed_walls = 4 if spec.enclosure == "enclosed" else 0
    purlin_runs = (math.ceil(slope_len / spec.purlin_spacing_ft) + 1) * (2 if has_ridge else 1)
    girt_runs = enclosed_walls * math.ceil(spec.eave_ft / spec.girt_spacing_ft)
    roof_panels = (round(spec.length_ft / 3) * 2) if spec.roof_style == "a_frame_vertical" \
        else round(spec.width_ft / 3) + 1
    anchors_per_post = 1 if spec.wind_speed_mph <= 135 else 2
    posts = frames * 2
    bom = [
        {"item": "Frames (bents)", "qty": frames, "unit": "ea", "detail": f"{round(spacing*12)}\" o.c."},
        {"item": "Column posts", "qty": posts, "unit": "ea", "detail": tube["name"]},
        {"item": "Roof beams / rafters", "qty": frames * (2 if has_ridge else 1), "unit": "ea",
         "detail": f'{tube["name"]}, {round(slope_len,1)}\''},
        {"item": "Peak braces", "qty": frames if has_ridge else 0, "unit": "ea"},
        {"item": "Knee braces", "qty": frames * 2, "unit": "ea"},
        {"item": "Base rail", "qty": round(2 * (spec.width_ft + spec.length_ft)), "unit": "ft"},
        {"item": "Purlins (hat)", "qty": purlin_runs, "unit": "runs", "detail": hat["name"]},
        {"item": "Girts (hat)", "qty": girt_runs, "unit": "runs"},
        {"item": "Roof panels (29ga)", "qty": roof_panels, "unit": "panels"},
        {"item": "Anchors", "qty": posts * anchors_per_post, "unit": "ea",
         "detail": f'{anchors_per_post}/post @ {spec.wind_speed_mph} mph'},
    ]

    return {
        "ok": all(c["status"] == "OK" for c in checks),
        "disclaimer": DISCLAIMER,
        "loads": load_block,
        "geometry": {
            "width_ft": spec.width_ft, "length_ft": spec.length_ft, "eave_ft": spec.eave_ft,
            "peak_ft": round(peak, 2), "rise_ft": round(rise, 2), "slope_len_ft": round(slope_len, 2),
            "frame_spacing_ft": spacing, "frames": frames,
        },
        "member_checks": checks,
        "bom": bom,
        "warnings": warnings,
    }
