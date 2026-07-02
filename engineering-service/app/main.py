"""FastAPI entrypoint for the Quality Metal Carports engineering service (POC).

Run locally:
    cd engineering-service
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Then POST a BuildingSpec to /design (see sample_request.json) or open /docs.
"""
from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import BuildingSpec, DesignResponse
from .design import run_design

app = FastAPI(
    title="Quality Metal Carports — Engineering Service",
    version="0.1.0",
    description="Preliminary design basis (loads + member checks + BOM) for tube-framed "
                "metal buildings. Draft output — requires licensed-PE review and stamp.",
)

# The Vite client (client/) calls this in dev; tighten origins for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/design", response_model=DesignResponse)
def design(spec: BuildingSpec) -> DesignResponse:
    return DesignResponse(**run_design(spec))
