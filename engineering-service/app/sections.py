"""Steel section properties for tube-framed members (POC).

Grade-50 light-gauge steel, Fy = 50 ksi, Fu = 65 ksi, E = 29,000 ksi.
Square-tube props are computed exactly; the hat-channel value comes from the
stamped section table. For production, swap in `sectionproperties` (arbitrary
shapes) + `pyCUFSM` for AISI S100 local/distortional buckling (DSM).
"""
from __future__ import annotations

FY_PSI = 50_000.0
FU_PSI = 65_000.0
E_PSI = 29_000_000.0

# AISI design thickness (in) by gauge.
GAUGE_T = {18: 0.049, 16: 0.0566, 14: 0.083, 12: 0.109}


def square_tube(outer_in: float, gauge: int) -> dict:
    t = GAUGE_T[gauge]
    bi = outer_in - 2 * t
    A = outer_in**2 - bi**2
    I = (outer_in**4 - bi**4) / 12.0
    S = I / (outer_in / 2.0)
    Z = (outer_in**3 - bi**3) / 4.0  # approx plastic modulus
    r = (I / A) ** 0.5
    return {
        "name": f"TS {outer_in}x{outer_in}x{gauge}ga",
        "A": round(A, 4), "I": round(I, 4), "S": round(S, 4),
        "Z": round(Z, 4), "r": round(r, 4), "t": t,
    }


# 4"x1" 14ga hat channel — from the stamped section schedule (A, I). S = I / c, c = 2".
HAT_4x1_14GA = {"name": "4x1x14ga hat channel", "A": 0.594, "I": 1.405, "S": 0.70}


def allowable_moment_lbin(S_in3: float, fy_psi: float = FY_PSI, omega_b: float = 1.67) -> float:
    """ASD allowable bending moment Ma = (Fy * S) / Ωb  (≈ 0.6·Fy·S). POC — does NOT
    include AISI S100 effective-width / local buckling reduction (use pyCUFSM DSM)."""
    return (fy_psi * S_in3) / omega_b


def allowable_axial_lb(A_in2: float, r_in: float, KL_in: float,
                       fy_psi: float = FY_PSI, omega_c: float = 1.67) -> float:
    """ASD allowable compression with a simple AISC E3 flexural-buckling reduction.
    POC — real design uses AISI S100 (global + local + distortional interaction)."""
    if r_in <= 0:
        return 0.0
    slenderness = KL_in / r_in
    fe = (3.14159**2 * E_PSI) / (slenderness**2) if slenderness > 0 else 1e12
    fy_fe = fy_psi / fe
    fcr = (0.658**fy_fe) * fy_psi if fy_fe <= 2.25 else 0.877 * fe  # AISC E3
    return (fcr * A_in2) / omega_c
