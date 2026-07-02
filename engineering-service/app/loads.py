"""ASCE 7-22 design loads (POC-level closed-form).

These are the same formulas used on the stamped calc sets, simplified for a
pre-engineered envelope. For production, pull site values from the ASCE 7 Hazard
Tool / USGS and run full MWFRS (Ch. 27) + C&C (Ch. 30).
"""
from __future__ import annotations

# Exposure-C-ish velocity-pressure coefficient Kz at low height (≤ ~15').
KZ_BY_EXPOSURE = {"B": 0.70, "C": 0.85, "D": 1.03}


def snow_loads(pg: float, ce: float = 1.0, ct: float = 1.2, i: float = 0.8, cs: float = 1.0) -> dict:
    """ASCE 7 §7: Pf = 0.7·Ce·Ct·Is·Pg ; Ps = Cs·Pf ; minimum roof snow when Pg ≤ 20."""
    pf = 0.7 * ce * ct * i * pg
    ps = cs * pf
    pm = 20.0 * i if pg <= 20 else 0.0
    return {"pf": round(pf, 2), "ps": round(max(ps, pm), 2),
            "params": {"Ce": ce, "Ct": ct, "Is": i, "Cs": cs}}


def wind_loads(v_mph: float, exposure: str = "C", G: float = 0.85, gcpi: float = 0.18) -> dict:
    """ASCE 7 §26-27: qz = 0.00256·Kz·Kzt·Kd·Ke·V² (psf), plus key net MWFRS pressures."""
    kz = KZ_BY_EXPOSURE.get(exposure, 0.85)
    kd, kzt, ke = 0.85, 1.0, 1.0
    qz = 0.00256 * kz * kzt * kd * ke * v_mph**2
    windward = qz * (G * 0.8 + gcpi)
    leeward = qz * (G * -0.5 - gcpi)
    roof_suction = qz * (G * -0.9 - gcpi)
    return {
        "qz": round(qz, 2),
        "windward_wall": round(windward, 2),
        "leeward_wall": round(leeward, 2),
        "roof_uplift": round(roof_suction, 2),
        "params": {"Kz": kz, "Kd": kd, "Kzt": kzt, "Ke": ke, "G": G, "GCpi": gcpi},
    }


def seismic_loads(sds: float, weight_lb: float, r: float = 3.25, ie: float = 1.0) -> dict:
    """ASCE 7 §12.8 ELF (OCBF, R=3.25): Cs = SDS/(R/Ie), V = Cs·W."""
    cs = sds / (r / ie)
    return {"cs": round(cs, 3), "base_shear_lb": round(cs * weight_lb, 1),
            "params": {"R": r, "Ie": ie, "SDS": sds}}
