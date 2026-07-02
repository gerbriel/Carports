"""Request/response models for the carport engineering service (POC).

Tube-framed metal buildings only. All lengths in feet unless noted.
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Opening(BaseModel):
    kind: Literal["rollup", "walk", "window"] = "rollup"
    width_ft: float
    height_ft: float


class BuildingSpec(BaseModel):
    # Geometry
    width_ft: float = Field(..., gt=0, description="gable-direction span")
    length_ft: float = Field(..., gt=0)
    eave_ft: float = Field(..., gt=0, description="leg height")
    pitch: float = Field(3, ge=0, description="roof rise per 12")
    roof_style: Literal["a_frame_vertical", "a_frame_horizontal", "regular", "standard"] = "a_frame_vertical"
    enclosure: Literal["enclosed", "open", "partial"] = "enclosed"

    # Loads / site (ASCE 7)
    ground_snow_psf: float = 30.0
    roof_live_psf: float = 20.0
    wind_speed_mph: float = 105.0        # Vult, 3-sec gust
    exposure: Literal["B", "C", "D"] = "C"
    sds: Optional[float] = None          # seismic; if omitted, seismic is skipped
    risk_category: Literal["I", "II"] = "I"

    # Members
    tube_outer_in: float = 2.5
    tube_gauge: Literal[12, 14, 18] = 14

    # Optional override; if None the service estimates frame spacing
    frame_spacing_ft: Optional[float] = None
    purlin_spacing_ft: float = 2.5
    girt_spacing_ft: float = 3.5

    openings: list[Opening] = []


class DesignResponse(BaseModel):
    ok: bool
    disclaimer: str
    loads: dict
    geometry: dict
    member_checks: list[dict]
    bom: list[dict]
    warnings: list[str]
