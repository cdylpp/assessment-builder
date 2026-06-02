# CRUD Routes
import os
import yaml
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas

router = APIRouter()

@router.post("/assessments")
def create_assessment(payload: schemas.AssessmentCreate, db: Session = Depends(get_db)):
    row = models.Assessment(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.post("/metrics")
def create_metric(payload: schemas.MetricCreate, db: Session=Depends(get_db)):
    # get the latest version of the metric
    latest = (
        db.query(models.Metric)
        .filter(models.Metric.stable_key == payload.stable_key)
        .order_by(models.Metric.version.desc())
        .first()
    )
    version = 1 if latest is None else latest.version + 1
    row = models.Metric(**payload.model_dump(), version = version)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.post("/evolution")
def create_evolution(payload: schemas.EvolutionCreate, db: Session = Depends(get_db)):
    latest = (
        db.query(models.Evolution)
        .filter(models.Evolution.stable_key == payload.stable_key)
        .order_by(models.Evolution.version.desc())
        .first()
    )

    version = 1 if latest is None else latest.version + 1
    evo = models.Evolution(
        stable_key=payload.stable_key,
        version=version,
        name=payload.name,
        description=payload.description,
    )
    db.add(evo)
    db.commit()
    db.refresh(evo)

    for i,metric_id in enumerate(payload.metric_ids):
        db.add(models.EvolutionMetric(
            evolution_id=evo.id,
            metric_id=metric_id,
            display_order=i
        ))
    db.commit()
    return evo

@router.post("/events")
def create_event(payload: schemas.EventCreate, db: Session = Depends(get_db)):
    event = models.Event(
        assessment_id=payload.assessment_id,
        name=payload.name,
        status="draft"
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    for i, evo_id in enumerate(payload.evolution_ids):
        db.add(models.EventEvolution(
            event_id=event.id,
            evolution_id=evo_id,
            display_order=i
        ))
    db.commit()
    return event

@router.post("/events/{event_id}/export")
def export_event(event_id: int, db: Session = Depends(get_db)):
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
    # get the link to each Evolution for the given event it. Return in display order
    links = (
        db.query(models.EventEvolution)
        .filter(models.EventEvolution.event_id == event_id)
        .order_by(models.EventEvolution.display_order)
        .all()
    )

    evolutions = []
    for link in links:
        evo = db.get(models.Evolution, link.evolution_id)
        # get all the metrics for this evo
        metric_links = (
            db.query(models.EvolutionMetric)
            .filter(models.EvolutionMetric.evolution_id == evo.id)
            .order_by(models.EvolutionMetric.display_order)
            .all()
        )
        metrics = []
        for metric_link in metric_links:
            metric = db.get(models.Metric, metric.id)
            metrics.append({
                "id":metric.id,
                "stable_key": metric.stable_key,
                "version": metric.version,
                "name": metric.name,
                "type": metric.metric_type,
                "domain": metric.domain,
                "description": metric.description,
                "scoring": metric.scoring
            })
        
        evolutions.append({
            "id": evo.id,
            "stable_key": evo.stable_key,
            "version": evo.version,
            "name": evo.name,
            "description": evo.description,
            "metrics": metrics,
        })
    return {
        "event": {
            "id": event.id,
            "name": event.name,
            "status": event.status,
            "evolutions": evolutions
        }
    }