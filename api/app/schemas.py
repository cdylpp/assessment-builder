from datetime import datetime
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Literal
from app.models import AggregationType, VariableScale, VarUnit

VARIABLE_UNITS_BY_SCALE = {
    VariableScale.nominal: {VarUnit.boolean, VarUnit.text, VarUnit.integer},
    VariableScale.ordinal: {VarUnit.integer, VarUnit.float},
    VariableScale.discrete: {VarUnit.integer, VarUnit.float, VarUnit.text},
    VariableScale.interval: {VarUnit.integer, VarUnit.float, VarUnit.seconds},
    VariableScale.ratio: {
        VarUnit.integer,
        VarUnit.float,
        VarUnit.seconds,
        VarUnit.meters,
        VarUnit.reps,
    },
}

class AssessmentCreate(BaseModel):
    name: str
    description: str | None = None

class AssessmentRead(AssessmentCreate):
    id: int

    model_config = {"from_attributes": True}

class EventCreate(BaseModel):
    assessment_id: int
    name: str
    method_ids: list[int]
    scheduled_at: datetime | None = None

class EventRead(BaseModel):
    id: int
    assessment_id: int
    name: str
    status: str
    scheduled_at: datetime | None = None
    method_ids: list[int] = Field(default_factory=list)

    model_config = {"from_attributes": True}

class PassCriteria(BaseModel):
    operator: Literal["<", "<=", ">", ">=", "="]
    value: int | float | str | bool

class AggregationCriteria(BaseModel):
    type: AggregationType

class MethodCriteria(BaseModel):
    pass_: PassCriteria | None = Field(default=None, alias="pass")
    aggregation: AggregationCriteria | None = None

    model_config = {"populate_by_name": True}

class MethodCreate(BaseModel):
    name: str
    description: str | None = None
    parent_id: int | None = None
    variable_id: int | None = None
    criteria: MethodCriteria = Field(default_factory=MethodCriteria)
    display_order: int = 0
    version: int = 1
    is_required: bool = True
    competency_ids: list[int] = Field(default_factory=list)

class MethodUpdate(MethodCreate):
    pass

class MethodRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    parent_id: int | None = None
    variable_id: int | None = None
    criteria: dict = Field(default_factory=dict)
    display_order: int
    version: int
    is_required: bool
    competency_ids: list[int] = Field(default_factory=list)

    @field_validator("criteria", mode="before")
    @classmethod
    def default_criteria(cls, value):
        return value or {}

    model_config = {"from_attributes": True}


class CompetencyCreate(BaseModel):
    name: str
    description: str | None = None

class CompetencyUpdate(CompetencyCreate):
    pass

class CompetencyRead(CompetencyCreate):
    id: int

    model_config = {"from_attributes": True}

class VariableCreate(BaseModel):
    name: str
    unit: VarUnit
    scale: VariableScale
    domain: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_unit_for_scale(self):
        allowed_units = VARIABLE_UNITS_BY_SCALE[self.scale]
        if self.unit not in allowed_units:
            allowed = ", ".join(sorted(unit.value for unit in allowed_units))
            raise ValueError(
                f"Unit '{self.unit.value}' is not valid for scale "
                f"'{self.scale.value}'. Allowed units: {allowed}."
            )
        return self

class VariableUpdate(VariableCreate):
    pass

class VariableRead(VariableCreate):
    id: int

    model_config = {"from_attributes": True}

class CandidateCreate(BaseModel):
    display_name: str
    metadata: dict = Field(default_factory=dict)

class CandidateUpdate(CandidateCreate):
    pass

class CandidateRead(CandidateCreate):
    id: int

class RosterCreate(BaseModel):
    name: str
    description: str | None = None

class RosterUpdate(RosterCreate):
    pass

class RosterCandidateCreate(BaseModel):
    candidate_id: int
    display_order: int | None = None

class RosterRead(RosterCreate):
    id: int
    candidate_ids: list[int] = Field(default_factory=list)

class AssessmentRunCreate(BaseModel):
    assessment_id: int
    roster_id: int

class AssessmentRunRead(BaseModel):
    id: int
    assessment_id: int
    roster_id: int
    status: str
    locked_at: datetime | None = None
    started_at: datetime | None = None
    paused_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

class RunMethodReorder(BaseModel):
    method_ids: list[int]

class ResultValueWrite(BaseModel):
    assessment_run_method_id: int
    candidate_id: int
    observation_index: int = 0
    value: Any

class ResultBatchWrite(BaseModel):
    results: list[ResultValueWrite]

class ResultRead(BaseModel):
    id: int
    assessment_run_method_id: int
    candidate_id: int
    observation_index: int
    value: Any
    value_display: str | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

# OUTDATED
class MetricCreate(BaseModel):
    name: str
    metric_type: str
    domain: str
    description: str | None = None
    scoring: dict
