# CRUD Routes
import os
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas

router = APIRouter()

def method_to_read(method: models.Method) -> dict:
    return {
        "id": method.id,
        "name": method.name,
        "description": method.description,
        "parent_id": method.parent_id,
        "variable_id": method.variable_id,
        "criteria": method.criteria or {},
        "display_order": method.display_order,
        "version": method.version,
        "is_required": method.is_required,
        "competency_ids": [
            method_competency.competency_id
            for method_competency in method.method_competencies
        ],
    }

def event_to_read(event: models.Event) -> dict:
    event_methods = sorted(
        event.event_methods,
        key=lambda event_method: event_method.display_order,
    )

    return {
        "id": event.id,
        "assessment_id": event.assessment_id,
        "name": event.name,
        "status": event.status,
        "scheduled_at": event.scheduled_at,
        "method_ids": [
            event_method.method_id
            for event_method in event_methods
        ],
    }

def delete_rows_if_table_exists(
    db: Session,
    table_name: str,
    where_clause: str,
    params: dict,
):
    if not inspect(db.get_bind()).has_table(table_name):
        return

    db.execute(
        text(f"DELETE FROM {table_name} WHERE {where_clause}"),
        params,
    )

def delete_event_rows(event_id: int, db: Session):
    db.query(models.EventMethod).filter(
        models.EventMethod.event_id == event_id
    ).delete(synchronize_session=False)
    db.query(models.Result).filter(
        models.Result.event_id == event_id
    ).delete(synchronize_session=False)
    delete_rows_if_table_exists(
        db,
        "event_evolutions",
        "event_id = :event_id",
        {"event_id": event_id},
    )

def variable_domain_label(variable: models.Variable) -> str:
    domain = variable.domain or {}
    parts = [f"unit: {variable.unit.value}"]

    if range_values := domain.get("range"):
        min_value = range_values.get("min", "")
        max_value = range_values.get("max", "")
        step_value = range_values.get("step")
        range_label = f"range: [{min_value}, {max_value}]"
        if step_value is not None:
            range_label = f"{range_label} step {step_value}"
        parts.append(range_label)

    if options := domain.get("options"):
        parts.append(f"options: {', '.join(str(option) for option in options)}")

    return "; ".join(parts)

def method_payload_data(
    payload: schemas.MethodCreate,
    db: Session,
    method_id: int | None = None,
):
    data = payload.model_dump(exclude={"competency_ids", "criteria"}, mode="json")
    data["criteria"] = payload.criteria.model_dump(
        by_alias=True,
        exclude_none=True,
        mode="json",
    )

    if method_id is not None and data["parent_id"] == method_id:
        raise HTTPException(status_code=400, detail="Method cannot be its own parent")

    if data["parent_id"] is not None and db.get(models.Method, data["parent_id"]) is None:
        raise HTTPException(status_code=404, detail="Parent method not found")

    if data["variable_id"] is not None and db.get(models.Variable, data["variable_id"]) is None:
        raise HTTPException(status_code=404, detail="Variable not found")

    competencies = []
    for competency_id in payload.competency_ids:
        competency = db.get(models.Competency, competency_id)
        if competency is None:
            raise HTTPException(status_code=404, detail=f"Competency {competency_id} not found")
        competencies.append(competency)

    return data, competencies

def candidate_to_read(candidate: models.Candidate) -> dict:
    return {
        "id": candidate.id,
        "display_name": candidate.display_name,
        "metadata": candidate.candidate_metadata or {},
    }

def roster_to_read(roster: models.Roster) -> dict:
    roster_candidates = sorted(
        roster.roster_candidates,
        key=lambda roster_candidate: roster_candidate.display_order,
    )
    return {
        "id": roster.id,
        "name": roster.name,
        "description": roster.description,
        "candidate_ids": [
            roster_candidate.candidate_id
            for roster_candidate in roster_candidates
        ],
    }

def run_to_read(run: models.AssessmentRun) -> dict:
    return {
        "id": run.id,
        "assessment_id": run.assessment_id,
        "roster_id": run.roster_id,
        "status": run.status,
        "locked_at": run.locked_at,
        "started_at": run.started_at,
        "paused_at": run.paused_at,
        "completed_at": run.completed_at,
        "created_at": run.created_at,
    }

def event_sort_key(event: models.Event):
    return (
        event.scheduled_at is None,
        event.scheduled_at or datetime.max,
        event.id,
    )

def variable_snapshot(variable: models.Variable | None) -> dict | None:
    if variable is None:
        return None

    return {
        "id": variable.id,
        "name": variable.name,
        "unit": variable.unit.value,
        "scale": variable.scale.value,
        "domain": variable.domain or {},
    }

def method_snapshot(method: models.Method) -> dict:
    return {
        "id": method.id,
        "name": method.name,
        "description": method.description,
        "criteria": method.criteria or {},
        "is_required": method.is_required,
        "variable_id": method.variable_id,
    }

def create_run_method_snapshot(
    db: Session,
    run_event: models.AssessmentRunEvent,
    method: models.Method,
    display_order: int,
    parent: models.AssessmentRunMethod | None,
    visited_method_ids: set[int],
):
    if method.id in visited_method_ids:
        return None

    visited_method_ids.add(method.id)
    children = sorted(method.children, key=lambda child: child.display_order)
    run_method = models.AssessmentRunMethod(
        run_event=run_event,
        method=method,
        parent=parent,
        display_order=display_order,
        observation_count=1,
        status="pending",
        is_entry_enabled=len(children) == 0 and method.variable is not None,
        method_snapshot=method_snapshot(method),
        variable_snapshot=variable_snapshot(method.variable),
    )
    db.add(run_method)
    db.flush()

    for child_order, child in enumerate(children):
        create_run_method_snapshot(
            db,
            run_event,
            child,
            child_order,
            run_method,
            visited_method_ids,
        )

    return run_method

def snapshot_assessment_run(db: Session, run: models.AssessmentRun):
    events = sorted(
        db.query(models.Event)
        .filter(models.Event.assessment_id == run.assessment_id)
        .all(),
        key=event_sort_key,
    )

    for event_order, event in enumerate(events):
        run_event = models.AssessmentRunEvent(
            assessment_run=run,
            event=event,
            status="pending",
            scheduled_at=event.scheduled_at,
            display_order=event_order,
        )
        db.add(run_event)
        db.flush()

        links = sorted(
            event.event_methods,
            key=lambda event_method: event_method.display_order,
        )
        linked_method_ids = {link.method_id for link in links}
        visited_method_ids: set[int] = set()
        root_order = 0

        for link in links:
            method = link.method
            if method.parent_id in linked_method_ids:
                continue

            created = create_run_method_snapshot(
                db,
                run_event,
                method,
                root_order,
                None,
                visited_method_ids,
            )
            if created is not None:
                root_order += 1

def roster_candidate_ids(roster: models.Roster) -> set[int]:
    return {
        roster_candidate.candidate_id
        for roster_candidate in roster.roster_candidates
    }

def format_seconds(seconds: int) -> str:
    minutes = seconds // 60
    remainder = seconds % 60
    return f"{minutes}:{remainder:02d}"

def validate_range(value: int | float, domain: dict):
    range_values = domain.get("range") or {}
    min_value = range_values.get("min")
    max_value = range_values.get("max")
    if min_value is not None and value < min_value:
        raise ValueError(f"value must be at least {min_value}")
    if max_value is not None and value > max_value:
        raise ValueError(f"value must be at most {max_value}")

def validate_result_value(value, variable: dict):
    unit = variable.get("unit")
    domain = variable.get("domain") or {}

    if unit == "boolean":
        if isinstance(value, bool):
            return value, "true" if value else "false"
        if isinstance(value, str) and value.lower() in {"true", "false", "yes", "no"}:
            bool_value = value.lower() in {"true", "yes"}
            return bool_value, "true" if bool_value else "false"
        raise ValueError("cannot save non-boolean value as boolean")

    if unit in {"integer", "reps"}:
        try:
            if isinstance(value, bool):
                raise ValueError
            int_value = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"cannot save {value!r} as integer")
        validate_range(int_value, domain)
        return int_value, str(int_value)

    if unit in {"float", "meters"}:
        try:
            if isinstance(value, bool):
                raise ValueError
            float_value = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"cannot save {value!r} as float")
        validate_range(float_value, domain)
        return float_value, str(float_value)

    if unit == "seconds":
        if isinstance(value, str):
            time_match = value.strip().split(":")
            if len(time_match) == 2:
                try:
                    minutes = int(time_match[0])
                    seconds = int(time_match[1])
                except ValueError:
                    raise ValueError("cannot save time value; use [mm]:ss")
                if seconds < 0 or seconds > 59:
                    raise ValueError("seconds must be between 00 and 59")
                seconds_value = minutes * 60 + seconds
            else:
                try:
                    seconds_value = int(value)
                except ValueError:
                    raise ValueError("cannot save time value; use [mm]:ss")
        elif isinstance(value, int):
            seconds_value = value
        else:
            raise ValueError("cannot save non-time value as seconds")
        validate_range(seconds_value, domain)
        return {"seconds": seconds_value}, format_seconds(seconds_value)

    text_value = str(value).strip()
    options = domain.get("options") or []
    if options and text_value not in options:
        raise ValueError(f"value must be one of: {', '.join(options)}")
    return text_value, text_value

def result_to_read(result: models.Result) -> dict:
    return {
        "id": result.id,
        "assessment_run_method_id": result.assessment_run_method_id,
        "candidate_id": result.candidate_id,
        "observation_index": result.observation_index,
        "value": result.value,
        "value_display": result.value_display,
        "status": result.status,
        "created_at": result.created_at,
        "updated_at": result.updated_at,
    }

def run_method_to_grid(
    run_method: models.AssessmentRunMethod,
    status: str | None = None,
) -> dict:
    snapshot = run_method.method_snapshot or {}
    return {
        "id": run_method.id,
        "method_id": run_method.method_id,
        "parent_run_method_id": run_method.parent_run_method_id,
        "name": snapshot.get("name", run_method.method.name),
        "criteria": snapshot.get("criteria", {}),
        "is_required": snapshot.get("is_required", True),
        "variable": run_method.variable_snapshot,
        "display_order": run_method.display_order,
        "observation_count": run_method.observation_count,
        "status": status or run_method.status,
        "is_entry_enabled": run_method.is_entry_enabled,
    }

def valid_result_counts(db: Session, run_id: int) -> dict[int, int]:
    results = (
        db.query(models.Result)
        .filter(
            models.Result.assessment_run_id == run_id,
            models.Result.status == "valid",
        )
        .all()
    )
    unique_cells: dict[int, set[tuple[int, int]]] = {}
    for result in results:
        if result.assessment_run_method_id is None:
            continue
        unique_cells.setdefault(result.assessment_run_method_id, set()).add(
            (result.candidate_id, result.observation_index)
        )

    return {
        run_method_id: len(cells)
        for run_method_id, cells in unique_cells.items()
    }

def build_run_method_statuses(
    run_event: models.AssessmentRunEvent,
    candidate_count: int,
    result_counts: dict[int, int],
) -> dict[int, str]:
    statuses: dict[int, str] = {}

    def status_for(run_method: models.AssessmentRunMethod) -> str:
        if run_method.id in statuses:
            return statuses[run_method.id]

        if run_method.is_entry_enabled:
            total_required = candidate_count * run_method.observation_count
            completed = result_counts.get(run_method.id, 0)
            is_required = (run_method.method_snapshot or {}).get("is_required", True)
            if completed >= total_required and total_required > 0:
                status = "completed"
            elif completed > 0:
                status = "in_progress"
            elif not is_required:
                status = "optional"
            else:
                status = "pending"
        else:
            child_statuses = [status_for(child) for child in run_method.children]
            if child_statuses and all(status == "completed" for status in child_statuses):
                status = "completed"
            elif any(status in {"completed", "in_progress"} for status in child_statuses):
                status = "in_progress"
            else:
                status = "read_only"

        statuses[run_method.id] = status
        return status

    for run_method in run_event.run_methods:
        status_for(run_method)

    return statuses

def run_event_status(
    run_event: models.AssessmentRunEvent,
    candidate_count: int,
    result_counts: dict[int, int],
) -> str:
    required_methods = [
        run_method
        for run_method in run_event.run_methods
        if run_method.is_entry_enabled
        and (run_method.method_snapshot or {}).get("is_required", True)
    ]
    if not required_methods:
        return "pending"

    total_required = sum(
        candidate_count * run_method.observation_count
        for run_method in required_methods
    )
    completed = sum(
        result_counts.get(run_method.id, 0)
        for run_method in required_methods
    )

    if completed >= total_required and total_required > 0:
        return "completed"
    if completed > 0:
        return "in_progress"
    return "pending"

@router.get("/assessments", response_model=list[schemas.AssessmentRead])
async def list_assessments(db: Session = Depends(get_db)):
    return db.query(models.Assessment).order_by(models.Assessment.id).all()

@router.post("/assessments", response_model=schemas.AssessmentRead)
async def create_assessment(payload: schemas.AssessmentCreate, db: Session = Depends(get_db)):
    row = models.Assessment(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.get("/assessments/{assessment_id}", response_model=schemas.AssessmentRead)
async def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    assessment = db.get(models.Assessment, assessment_id)
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment

@router.delete("/assessments/{assessment_id}", status_code=204)
async def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    assessment = db.get(models.Assessment, assessment_id)
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    events = (
        db.query(models.Event)
        .filter(models.Event.assessment_id == assessment_id)
        .all()
    )
    for event in events:
        delete_event_rows(event.id, db)
        db.delete(event)

    db.delete(assessment)
    db.commit()
    return Response(status_code=204)

@router.get("/events", response_model=list[schemas.EventRead])
async def list_events(db: Session = Depends(get_db)):
    events = db.query(models.Event).order_by(models.Event.id).all()
    return [event_to_read(event) for event in events]

@router.post("/events", response_model=schemas.EventRead)
async def create_event(payload: schemas.EventCreate, db: Session = Depends(get_db)):
    if db.get(models.Assessment, payload.assessment_id) is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    methods = []
    for method_id in payload.method_ids:
        method = db.get(models.Method, method_id)
        if method is None:
            raise HTTPException(status_code=404, detail=f"Method {method_id} not found")
        methods.append(method)

    event = models.Event(
        assessment_id=payload.assessment_id,
        name=payload.name,
        status="draft",
        scheduled_at=payload.scheduled_at,
    )
    db.add(event)
    db.flush()

    for i, method in enumerate(methods):
        db.add(models.EventMethod(
            event=event,
            method=method,
            display_order=i
        ))
    db.commit()
    db.refresh(event)
    return event_to_read(event)

@router.get("/events/{event_id}", response_model=schemas.EventRead)
async def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(models.Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_to_read(event)

@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(models.Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    delete_event_rows(event_id, db)
    db.delete(event)
    db.commit()
    return Response(status_code=204)

@router.get("/methods", response_model=list[schemas.MethodRead])
async def list_methods(db: Session = Depends(get_db)):
    methods = db.query(models.Method).order_by(models.Method.id).all()
    return [method_to_read(method) for method in methods]

@router.post("/methods", response_model=schemas.MethodRead)
async def create_method(payload: schemas.MethodCreate, db: Session = Depends(get_db)):
    data, competencies = method_payload_data(payload, db)
    method = models.Method(**data)
    db.add(method)
    db.flush()

    for competency in competencies:
        db.add(models.MethodCompetency(
            method=method,
            competency=competency,
        ))

    db.commit()
    db.refresh(method)
    return method_to_read(method)

@router.get("/methods/{method_id}", response_model=schemas.MethodRead)
def get_method(method_id: int, db: Session = Depends(get_db)):
    method = db.get(models.Method, method_id)
    if method is None:
        raise HTTPException(status_code=404, detail="Method not found")
    return method_to_read(method)

@router.put("/methods/{method_id}", response_model=schemas.MethodRead)
async def update_method(
    method_id: int,
    payload: schemas.MethodUpdate,
    db: Session = Depends(get_db),
):
    method = db.get(models.Method, method_id)
    if method is None:
        raise HTTPException(status_code=404, detail="Method not found")

    data, competencies = method_payload_data(payload, db, method_id)
    for key, value in data.items():
        setattr(method, key, value)

    db.query(models.MethodCompetency).filter(
        models.MethodCompetency.method_id == method_id
    ).delete(synchronize_session=False)
    db.flush()

    for competency in competencies:
        db.add(models.MethodCompetency(
            method=method,
            competency=competency,
        ))

    db.commit()
    db.refresh(method)
    return method_to_read(method)

@router.delete("/methods/{method_id}", status_code=204)
async def delete_method(method_id: int, db: Session = Depends(get_db)):
    method = db.get(models.Method, method_id)
    if method is None:
        raise HTTPException(status_code=404, detail="Method not found")

    db.query(models.Method).filter(
        models.Method.parent_id == method_id
    ).update({"parent_id": None}, synchronize_session=False)
    db.query(models.EventMethod).filter(
        models.EventMethod.method_id == method_id
    ).delete(synchronize_session=False)
    db.query(models.MethodCompetency).filter(
        models.MethodCompetency.method_id == method_id
    ).delete(synchronize_session=False)
    db.query(models.Result).filter(
        models.Result.method_id == method_id
    ).delete(synchronize_session=False)

    db.delete(method)
    db.commit()
    return Response(status_code=204)

@router.get("/competencies", response_model=list[schemas.CompetencyRead])
async def list_competencies(db: Session = Depends(get_db)):
    return db.query(models.Competency).order_by(models.Competency.id).all()

@router.post("/competencies", response_model=schemas.CompetencyRead)
async def create_competency(payload: schemas.CompetencyCreate, db: Session = Depends(get_db)):
    comp = models.Competency(**payload.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp

@router.get("/competencies/{competency_id}", response_model=schemas.CompetencyRead)
async def get_competency(competency_id: int, db: Session = Depends(get_db)):
    competency = db.get(models.Competency, competency_id)
    if competency is None:
        raise HTTPException(status_code=404, detail="Competency not found")
    return competency

@router.put("/competencies/{competency_id}", response_model=schemas.CompetencyRead)
async def update_competency(
    competency_id: int,
    payload: schemas.CompetencyUpdate,
    db: Session = Depends(get_db),
):
    competency = db.get(models.Competency, competency_id)
    if competency is None:
        raise HTTPException(status_code=404, detail="Competency not found")

    competency.name = payload.name
    competency.description = payload.description
    db.commit()
    db.refresh(competency)
    return competency

@router.delete("/competencies/{competency_id}", status_code=204)
async def delete_competency(competency_id: int, db: Session = Depends(get_db)):
    competency = db.get(models.Competency, competency_id)
    if competency is None:
        raise HTTPException(status_code=404, detail="Competency not found")

    db.query(models.MethodCompetency).filter(
        models.MethodCompetency.competency_id == competency_id
    ).delete(synchronize_session=False)
    db.delete(competency)
    db.commit()
    return Response(status_code=204)

@router.get("/variables", response_model=list[schemas.VariableRead])
async def list_variables(db: Session = Depends(get_db)):
    return db.query(models.Variable).order_by(models.Variable.id).all()

@router.post("/variables", response_model=schemas.VariableRead)
async def create_variable(payload: schemas.VariableCreate, db: Session = Depends(get_db)):
    variable = models.Variable(**payload.model_dump())
    db.add(variable)
    db.commit()
    db.refresh(variable)
    return variable

@router.get("/variables/{variable_id}", response_model=schemas.VariableRead)
async def get_variable(variable_id: int, db: Session = Depends(get_db)):
    variable = db.get(models.Variable, variable_id)
    if variable is None:
        raise HTTPException(status_code=404, detail="Variable not found")
    return variable

@router.put("/variables/{variable_id}", response_model=schemas.VariableRead)
async def update_variable(
    variable_id: int,
    payload: schemas.VariableUpdate,
    db: Session = Depends(get_db),
):
    variable = db.get(models.Variable, variable_id)
    if variable is None:
        raise HTTPException(status_code=404, detail="Variable not found")

    data = payload.model_dump(mode="json")
    for key, value in data.items():
        setattr(variable, key, value)

    db.commit()
    db.refresh(variable)
    return variable

@router.delete("/variables/{variable_id}", status_code=204)
async def delete_variable(variable_id: int, db: Session = Depends(get_db)):
    variable = db.get(models.Variable, variable_id)
    if variable is None:
        raise HTTPException(status_code=404, detail="Variable not found")

    db.query(models.Method).filter(
        models.Method.variable_id == variable_id
    ).update({"variable_id": None}, synchronize_session=False)
    db.delete(variable)
    db.commit()
    return Response(status_code=204)

@router.get("/candidates", response_model=list[schemas.CandidateRead])
async def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(models.Candidate).order_by(models.Candidate.id).all()
    return [candidate_to_read(candidate) for candidate in candidates]

@router.post("/candidates", response_model=schemas.CandidateRead)
async def create_candidate(payload: schemas.CandidateCreate, db: Session = Depends(get_db)):
    candidate = models.Candidate(
        display_name=payload.display_name,
        candidate_metadata=payload.metadata,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate_to_read(candidate)

@router.get("/candidates/{candidate_id}", response_model=schemas.CandidateRead)
async def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(models.Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate_to_read(candidate)

@router.put("/candidates/{candidate_id}", response_model=schemas.CandidateRead)
async def update_candidate(
    candidate_id: int,
    payload: schemas.CandidateUpdate,
    db: Session = Depends(get_db),
):
    candidate = db.get(models.Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.display_name = payload.display_name
    candidate.candidate_metadata = payload.metadata
    db.commit()
    db.refresh(candidate)
    return candidate_to_read(candidate)

@router.delete("/candidates/{candidate_id}", status_code=204)
async def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(models.Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    db.query(models.RosterCandidate).filter(
        models.RosterCandidate.candidate_id == candidate_id
    ).delete(synchronize_session=False)
    db.query(models.Result).filter(
        models.Result.candidate_id == candidate_id
    ).delete(synchronize_session=False)
    db.delete(candidate)
    db.commit()
    return Response(status_code=204)

@router.get("/rosters", response_model=list[schemas.RosterRead])
async def list_rosters(db: Session = Depends(get_db)):
    rosters = db.query(models.Roster).order_by(models.Roster.id).all()
    return [roster_to_read(roster) for roster in rosters]

@router.post("/rosters", response_model=schemas.RosterRead)
async def create_roster(payload: schemas.RosterCreate, db: Session = Depends(get_db)):
    roster = models.Roster(**payload.model_dump())
    db.add(roster)
    db.commit()
    db.refresh(roster)
    return roster_to_read(roster)

@router.get("/rosters/{roster_id}", response_model=schemas.RosterRead)
async def get_roster(roster_id: int, db: Session = Depends(get_db)):
    roster = db.get(models.Roster, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")
    return roster_to_read(roster)

@router.put("/rosters/{roster_id}", response_model=schemas.RosterRead)
async def update_roster(
    roster_id: int,
    payload: schemas.RosterUpdate,
    db: Session = Depends(get_db),
):
    roster = db.get(models.Roster, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")

    roster.name = payload.name
    roster.description = payload.description
    db.commit()
    db.refresh(roster)
    return roster_to_read(roster)

@router.delete("/rosters/{roster_id}", status_code=204)
async def delete_roster(roster_id: int, db: Session = Depends(get_db)):
    roster = db.get(models.Roster, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")

    if db.query(models.AssessmentRun).filter(models.AssessmentRun.roster_id == roster_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete roster with assessment runs")

    db.query(models.RosterCandidate).filter(
        models.RosterCandidate.roster_id == roster_id
    ).delete(synchronize_session=False)
    db.delete(roster)
    db.commit()
    return Response(status_code=204)

@router.post("/rosters/{roster_id}/candidates", response_model=schemas.RosterRead)
async def add_roster_candidate(
    roster_id: int,
    payload: schemas.RosterCandidateCreate,
    db: Session = Depends(get_db),
):
    roster = db.get(models.Roster, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")
    candidate = db.get(models.Candidate, payload.candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing = db.get(models.RosterCandidate, (roster_id, payload.candidate_id))
    if existing is not None:
        if payload.display_order is not None:
            existing.display_order = payload.display_order
    else:
        display_order = payload.display_order
        if display_order is None:
            display_order = len(roster.roster_candidates)
        db.add(models.RosterCandidate(
            roster=roster,
            candidate=candidate,
            display_order=display_order,
        ))

    db.commit()
    db.refresh(roster)
    return roster_to_read(roster)

@router.delete("/rosters/{roster_id}/candidates/{candidate_id}", response_model=schemas.RosterRead)
async def remove_roster_candidate(
    roster_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
):
    roster = db.get(models.Roster, roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")

    db.query(models.RosterCandidate).filter(
        models.RosterCandidate.roster_id == roster_id,
        models.RosterCandidate.candidate_id == candidate_id,
    ).delete(synchronize_session=False)
    db.commit()
    db.refresh(roster)
    return roster_to_read(roster)

@router.get("/assessment-runs", response_model=list[schemas.AssessmentRunRead])
async def list_assessment_runs(db: Session = Depends(get_db)):
    runs = db.query(models.AssessmentRun).order_by(models.AssessmentRun.id).all()
    return [run_to_read(run) for run in runs]

@router.post("/assessment-runs", response_model=schemas.AssessmentRunRead)
async def create_assessment_run(
    payload: schemas.AssessmentRunCreate,
    db: Session = Depends(get_db),
):
    if db.get(models.Assessment, payload.assessment_id) is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    roster = db.get(models.Roster, payload.roster_id)
    if roster is None:
        raise HTTPException(status_code=404, detail="Roster not found")

    run = models.AssessmentRun(
        assessment_id=payload.assessment_id,
        roster_id=payload.roster_id,
        status="draft",
    )
    db.add(run)
    db.flush()
    snapshot_assessment_run(db, run)
    db.commit()
    db.refresh(run)
    return run_to_read(run)

@router.get("/assessment-runs/{run_id}", response_model=schemas.AssessmentRunRead)
async def get_assessment_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.AssessmentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Assessment run not found")
    return run_to_read(run)

def transition_run(run_id: int, db: Session, action: str):
    run = db.get(models.AssessmentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Assessment run not found")

    now = datetime.utcnow()
    if action == "start":
        if run.status not in {"draft", "paused"}:
            raise HTTPException(status_code=400, detail="Run cannot be started")
        run.status = "active"
        run.started_at = run.started_at or now
        run.locked_at = run.locked_at or now
    elif action == "pause":
        if run.status != "active":
            raise HTTPException(status_code=400, detail="Only active runs can be paused")
        run.status = "paused"
        run.paused_at = now
    elif action == "resume":
        if run.status != "paused":
            raise HTTPException(status_code=400, detail="Only paused runs can be resumed")
        run.status = "active"
    elif action == "complete":
        if run.status not in {"active", "paused"}:
            raise HTTPException(status_code=400, detail="Run cannot be completed")
        run.status = "completed"
        run.completed_at = now
    else:
        raise HTTPException(status_code=400, detail="Unknown run transition")

    db.commit()
    db.refresh(run)
    return run_to_read(run)

@router.post("/assessment-runs/{run_id}/start", response_model=schemas.AssessmentRunRead)
async def start_assessment_run(run_id: int, db: Session = Depends(get_db)):
    return transition_run(run_id, db, "start")

@router.post("/assessment-runs/{run_id}/pause", response_model=schemas.AssessmentRunRead)
async def pause_assessment_run(run_id: int, db: Session = Depends(get_db)):
    return transition_run(run_id, db, "pause")

@router.post("/assessment-runs/{run_id}/resume", response_model=schemas.AssessmentRunRead)
async def resume_assessment_run(run_id: int, db: Session = Depends(get_db)):
    return transition_run(run_id, db, "resume")

@router.post("/assessment-runs/{run_id}/complete", response_model=schemas.AssessmentRunRead)
async def complete_assessment_run(run_id: int, db: Session = Depends(get_db)):
    return transition_run(run_id, db, "complete")

@router.get("/assessment-runs/{run_id}/task-list")
async def get_assessment_run_task_list(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.AssessmentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Assessment run not found")

    candidate_count = len(roster_candidate_ids(run.roster))
    result_counts = valid_result_counts(db, run_id)
    run_events = sorted(run.run_events, key=lambda item: item.display_order)
    return {
        "run": run_to_read(run),
        "events": [
            {
                "id": run_event.id,
                "event_id": run_event.event_id,
                "name": run_event.event.name,
                "status": run_event_status(run_event, candidate_count, result_counts),
                "scheduled_at": run_event.scheduled_at,
                "display_order": run_event.display_order,
                "methods": [
                    run_method_to_grid(
                        run_method,
                        method_statuses.get(run_method.id),
                    )
                    for run_method in sorted(
                        run_event.run_methods,
                        key=lambda item: (item.parent_run_method_id is not None, item.display_order, item.id),
                    )
                ],
            }
            for run_event in run_events
            for method_statuses in [
                build_run_method_statuses(run_event, candidate_count, result_counts)
            ]
        ],
    }

@router.get("/assessment-runs/{run_id}/events/{run_event_id}/grid")
async def get_assessment_run_event_grid(
    run_id: int,
    run_event_id: int,
    db: Session = Depends(get_db),
):
    run = db.get(models.AssessmentRun, run_id)
    run_event = db.get(models.AssessmentRunEvent, run_event_id)
    if run is None or run_event is None or run_event.assessment_run_id != run_id:
        raise HTTPException(status_code=404, detail="Run event not found")

    roster_candidates = sorted(
        run.roster.roster_candidates,
        key=lambda item: item.display_order,
    )
    result_counts = valid_result_counts(db, run_id)
    method_statuses = build_run_method_statuses(
        run_event,
        len(roster_candidates),
        result_counts,
    )
    run_methods = sorted(
        run_event.run_methods,
        key=lambda item: (item.parent_run_method_id is not None, item.display_order, item.id),
    )
    results = (
        db.query(models.Result)
        .filter(models.Result.assessment_run_event_id == run_event_id)
        .all()
    )

    return {
        "run": run_to_read(run),
        "run_event": {
            "id": run_event.id,
            "event_id": run_event.event_id,
            "name": run_event.event.name,
            "status": run_event_status(
                run_event,
                len(roster_candidates),
                result_counts,
            ),
            "scheduled_at": run_event.scheduled_at,
            "display_order": run_event.display_order,
        },
        "candidates": [
            candidate_to_read(roster_candidate.candidate)
            for roster_candidate in roster_candidates
        ],
        "methods": [
            run_method_to_grid(
                run_method,
                method_statuses.get(run_method.id),
            )
            for run_method in run_methods
        ],
        "results": [
            result_to_read(result)
            for result in results
        ],
    }

@router.put("/assessment-runs/{run_id}/events/{run_event_id}/methods/reorder")
async def reorder_run_event_methods(
    run_id: int,
    run_event_id: int,
    payload: schemas.RunMethodReorder,
    db: Session = Depends(get_db),
):
    run_event = db.get(models.AssessmentRunEvent, run_event_id)
    if run_event is None or run_event.assessment_run_id != run_id:
        raise HTTPException(status_code=404, detail="Run event not found")

    methods_by_id = {
        run_method.id: run_method
        for run_method in run_event.run_methods
    }
    for display_order, run_method_id in enumerate(payload.method_ids):
        run_method = methods_by_id.get(run_method_id)
        if run_method is not None:
            run_method.display_order = display_order

    db.commit()
    return {"status": "ok"}

@router.post("/assessment-runs/{run_id}/methods/{run_method_id}/observations")
async def add_run_method_observation(
    run_id: int,
    run_method_id: int,
    db: Session = Depends(get_db),
):
    run = db.get(models.AssessmentRun, run_id)
    run_method = db.get(models.AssessmentRunMethod, run_method_id)
    if run is None or run_method is None or run_method.run_event.assessment_run_id != run_id:
        raise HTTPException(status_code=404, detail="Run method not found")
    if not run_method.is_entry_enabled:
        raise HTTPException(status_code=400, detail="Cannot add observations to read-only method")
    if run.status in {"paused", "completed"}:
        raise HTTPException(status_code=400, detail="Run is not accepting result edits")

    run_method.observation_count += 1
    db.commit()
    return run_method_to_grid(run_method)

@router.put("/assessment-runs/{run_id}/results", response_model=list[schemas.ResultRead])
async def save_assessment_run_results(
    run_id: int,
    payload: schemas.ResultBatchWrite,
    db: Session = Depends(get_db),
):
    run = db.get(models.AssessmentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Assessment run not found")
    if run.status != "active":
        raise HTTPException(status_code=400, detail="Run must be active to save results")

    candidate_ids = roster_candidate_ids(run.roster)
    saved_results = []

    for item in payload.results:
        run_method = db.get(models.AssessmentRunMethod, item.assessment_run_method_id)
        if run_method is None or run_method.run_event.assessment_run_id != run_id:
            raise HTTPException(status_code=404, detail="Run method not found")
        if not run_method.is_entry_enabled:
            raise HTTPException(status_code=400, detail="Cannot save results for read-only method")
        if item.candidate_id not in candidate_ids:
            raise HTTPException(status_code=400, detail="Candidate is not in this run roster")
        if item.observation_index < 0 or item.observation_index >= run_method.observation_count:
            raise HTTPException(status_code=400, detail="Observation index is not available")
        if run_method.variable_snapshot is None:
            raise HTTPException(status_code=400, detail="Run method has no variable")

        try:
            normalized_value, value_display = validate_result_value(
                item.value,
                run_method.variable_snapshot,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error))

        result = (
            db.query(models.Result)
            .filter(
                models.Result.assessment_run_id == run_id,
                models.Result.assessment_run_method_id == run_method.id,
                models.Result.candidate_id == item.candidate_id,
                models.Result.observation_index == item.observation_index,
            )
            .first()
        )
        if result is None:
            result = models.Result(
                assessment_run_id=run_id,
                assessment_run_event_id=run_method.assessment_run_event_id,
                assessment_run_method_id=run_method.id,
                event_id=run_method.run_event.event_id,
                candidate_id=item.candidate_id,
                method_id=run_method.method_id,
                observation_index=item.observation_index,
            )
            db.add(result)

        result.value = normalized_value
        result.value_display = value_display
        result.status = "valid"
        saved_results.append(result)

    db.commit()
    for result in saved_results:
        db.refresh(result)

    return [result_to_read(result) for result in saved_results]

@router.get("/assessment-runs/{run_id}/summary")
async def get_assessment_run_summary(run_id: int, db: Session = Depends(get_db)):
    run = db.get(models.AssessmentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Assessment run not found")

    candidate_ids = roster_candidate_ids(run.roster)
    editable_methods = [
        run_method
        for run_event in run.run_events
        for run_method in run_event.run_methods
        if run_method.is_entry_enabled
    ]
    required_methods = [
        run_method
        for run_method in editable_methods
        if (run_method.method_snapshot or {}).get("is_required", True)
    ]
    total_required = sum(
        len(candidate_ids) * run_method.observation_count
        for run_method in required_methods
    )
    valid_results = (
        db.query(models.Result)
        .filter(
            models.Result.assessment_run_id == run_id,
            models.Result.status == "valid",
        )
        .all()
    )
    required_method_ids = {run_method.id for run_method in required_methods}
    completed_required = sum(
        1
        for result in valid_results
        if result.assessment_run_method_id in required_method_ids
    )

    pass_count = 0
    fail_count = 0
    numeric_values: list[float] = []
    candidate_totals = {candidate_id: 0 for candidate_id in candidate_ids}

    for result in valid_results:
        if result.candidate_id in candidate_totals:
            candidate_totals[result.candidate_id] += 1
        value = result.value
        if isinstance(value, dict) and "seconds" in value:
            numeric_values.append(float(value["seconds"]))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            numeric_values.append(float(value))

        run_method = db.get(models.AssessmentRunMethod, result.assessment_run_method_id)
        pass_rule = ((run_method.method_snapshot or {}).get("criteria") or {}).get("pass") if run_method else None
        if pass_rule:
            passed = evaluate_pass_rule(result.value, pass_rule)
            if passed:
                pass_count += 1
            else:
                fail_count += 1

    ranked_candidates = sorted(
        candidate_totals.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    return {
        "run": run_to_read(run),
        "completion": {
            "completed": completed_required,
            "total": total_required,
            "percent": 0 if total_required == 0 else round((completed_required / total_required) * 100),
        },
        "pass_fail": {
            "pass": pass_count,
            "fail": fail_count,
        },
        "numeric": {
            "count": len(numeric_values),
            "min": min(numeric_values) if numeric_values else None,
            "max": max(numeric_values) if numeric_values else None,
            "average": round(sum(numeric_values) / len(numeric_values), 2) if numeric_values else None,
        },
        "candidate_totals": [
            {"candidate_id": candidate_id, "valid_results": total}
            for candidate_id, total in ranked_candidates
        ],
    }

def evaluate_pass_rule(value, pass_rule: dict) -> bool:
    operator = pass_rule.get("operator")
    expected = pass_rule.get("value")
    observed = value.get("seconds") if isinstance(value, dict) and "seconds" in value else value
    if not isinstance(observed, (int, float)) or not isinstance(expected, (int, float)):
        return observed == expected
    if operator == "<":
        return observed < expected
    if operator == "<=":
        return observed <= expected
    if operator == ">":
        return observed > expected
    if operator == ">=":
        return observed >= expected
    return observed == expected

@router.post("/events/{event_id}/copy")
async def copy_event(event_id: int, db: Session = Depends(get_db)):
    # get the id from the table
    # create a new event with a new id and same version
    return

@router.get("/events/{event_id}/export")
@router.post("/events/{event_id}/export")
async def export_event(event_id: int, db: Session = Depends(get_db)):
    payload = build_event_yaml(event_id, db)
    excel_url = os.environ["EXCEL_SERVICE_URL"]
    resp = httpx.post(f"{excel_url}/generate", json=payload)
    resp.raise_for_status()

    return Response(
        resp.content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition":f'attachment; filename="event-{event_id}.xlsx"'},
    )

def build_event_yaml(event_id: int, db: Session):
    event = db.get(models.Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    # Return linked methods in event-specific display order.
    links = (
        db.query(models.EventMethod)
        .filter(models.EventMethod.event_id == event_id)
        .order_by(models.EventMethod.display_order)
        .all()
    )

    methods = []
    legacy_evolutions = []
    for link in links:
        method = link.method
        variable = method.variable
        criteria = method.criteria or {}

        method_payload = {
            "id": method.id,
            "name": method.name,
            "description": method.description,
            "criteria": criteria,
            "display_order": link.display_order,
            "version": method.version,
            "is_required": method.is_required,
            "variable": None if variable is None else {
                "id": variable.id,
                "name": variable.name,
                "unit": variable.unit.value,
                "scale": variable.scale.value,
                "domain": variable.domain or {},
            },
            "competencies": [
                {
                    "id": method_competency.competency.id,
                    "name": method_competency.competency.name,
                    "weight": method_competency.weight,
                }
                for method_competency in method.method_competencies
            ],
        }
        methods.append(method_payload)

        metric_payload = []
        if variable is not None:
            metric_payload.append({
                "id": variable.id,
                "stable_key": f"variable-{variable.id}",
                "version": method.version,
                "name": variable.name,
                "type": variable.scale.value,
                "domain": variable_domain_label(variable),
                "description": method.description,
                "scoring": criteria,
            })

        legacy_evolutions.append({
            "id": method.id,
            "stable_key": f"method-{method.id}",
            "version": method.version,
            "name": method.name,
            "description": method.description,
            "metrics": metric_payload,
        })

    return {
        "event": {
            "id": event.id,
            "name": event.name,
            "status": event.status,
            "methods": methods,
            # Compatibility for the current excel-service payload shape.
            "evolutions": legacy_evolutions,
        }
    }



@router.post("/metrics")
def create_metric(payload: schemas.MetricCreate, db: Session=Depends(get_db)):
    row = models.Metric(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
