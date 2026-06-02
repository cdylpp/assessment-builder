from pydantic import BaseModel

class AssessmentCreate(BaseModel):
    name: str
    description: str | None = None

class MetricCreate(BaseModel):
    stable_key: str
    name: str
    metric_type: str
    domain: str
    description: str | None = None
    scoring: dict

class EvolutionCreate(BaseModel):
    stable_key: str
    name: str
    description: str | None = None
    metric_ids = list[int]

class EventCreate(BaseModel):
    assessment_id: int
    name: str
    evolution_ids: list[int]

    