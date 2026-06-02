# Database Model Implementation
from sqlalchemy import String, Integer, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str|None] = mapped_column(String(1000), nullable=True)

class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    stable_key: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    metric_type: Mapped[str] = mapped_column(String(100))
    domain: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    scoring: Mapped[dict] = mapped_column(JSON)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)

class Evolution(Base):
    __tablename__ = "evolutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    stable_key: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


# one to many relation between evolution and metric
# evolution (1) <--has-many-- (*) metrics
class EvolutionMetric(Base):
    __tablename__ = "evolution_metrics"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    evolution_id: Mapped[int] = mapped_column(ForeignKey("evolutions.id"))
    metric_id: Mapped[int] = mapped_column(ForeignKey("metrics.id"))
    display_order: Mapped[int] = mapped_column(Integer)

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessment.id"))
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50), default="draft")


# events (1) <--has-many-- (*) evolutions
class EventEvolution(Base):
    __tablename__ = "event_evolutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    evolution_id: Mapped[int] = mapped_column(ForeignKey("evolutions.id"))
    display_order: Mapped[int] = mapped_column(Integer)
    