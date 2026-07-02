# Engineering Service

The design brain of the Quality Metal Carports platform. It turns a building spec
(the same one the **3D builder** and **material calculator** produce) into a
**preliminary engineering basis**: ASCE 7 design loads, member demand/capacity
checks, and a bill of materials — the raw material for a future semi-automated,
PE-stamped plan set.

> ⚠️ **Draft output only.** Everything this service returns must be reviewed,
> verified, and **stamped by a licensed Professional Engineer** before it is used
> to fabricate or permit a building. It is a productivity tool for the engineer,
> not a replacement.

## What it does today (POC)

| Stage | Module | Status |
|---|---|---|
| Design loads (snow / wind / seismic) | `app/loads.py` | ASCE 7-22 closed-form ✓ |
| Section properties (square tube, hat) | `app/sections.py` | exact tube + AISI stub ✓ |
| Member checks (rafter, purlin, column) | `app/design.py` | simple-beam / AISC E3 ✓ |
| Frame spacing envelope | `app/design.py` | coarse estimate (see note) |
| Bill of materials | `app/design.py` | mirrors the front-end takeoff ✓ |
| REST API + docs | `app/main.py` | FastAPI `/design`, `/docs` ✓ |

Validated against the stamped calc sets: e.g. 30 psf ground snow → **Ps = 20.16 psf**
and 115 mph Exp-C → **qz = 24.46 psf** reproduce the sealed numbers exactly.

## Run it

```bash
cd engineering-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs   (interactive)
curl -X POST http://localhost:8000/design -H 'content-type: application/json' \
     -d @sample_request.json
```

The Vite client (`../client`) can call `POST /design` directly (CORS is open to the
dev ports). Wire a "Download engineering basis" button on the builder to this
endpoint; the same `BuildingSpec` shape is shared.

## Production roadmap

The POC uses closed-form checks so it runs with zero heavy dependencies. Each stage
swaps in a real open-source tool (already listed, commented, in `requirements.txt`):

1. **Frame analysis** → [PyNite](https://github.com/JWock82/PyNite) — full 2D/3D FEM
   of the bent (proper joints, moment frames, uplift, drift) instead of simple beams.
2. **Cold-formed member design** → [`sectionproperties`](https://github.com/robbievanleeuwen/section-properties)
   for arbitrary section props + [`pyCUFSM`](https://github.com/ClearCalcs/pyCUFSM)
   for AISI S100 local/distortional buckling (Direct Strength Method).
3. **Frame-spacing source** → replace the coarse estimate with the stamped Table 4
   (the builder's `client/src/data/frameSpacing.js` already encodes the full
   width × eave × load × wind chart — share it as JSON).
4. **Drawings** → [`ezdxf`](https://github.com/mozman/ezdxf) / `build123d` to emit
   DXF shop + permit sheets from the resolved geometry.
5. **Calc package** → [`ReportLab`](https://www.reportlab.com/opensource/) PDF with
   every load, combination, and member check — the document a PE reviews and seals.
6. **Site hazards** → ASCE 7 Hazard Tool / USGS APIs for Pg, V, SDS by lat/long.

## Not in scope

Cold-formed CFS stud systems (a different structural system), foundation design
beyond anchor counts, and — critically — **the engineer's judgment and seal.**
