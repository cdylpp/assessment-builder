# Database Model Implementation
from datetime import datetime
from enum import Enum
from typing import List
from sqlalchemy import String, Integer, ForeignKey, Boolean, JSON, Float, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


"""
Assessment is the root level container for a collection of events.
"""
class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    events: Mapped[List["Event"]] = relationship(back_populates="assessment")

"""
Events are a grouping of Methods. Methods are hosted in an event. Events have a time and a place.
events
------
id
assessment_id
name
status
"""
class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"))
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50), default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    assessment: Mapped["Assessment"] = relationship(back_populates="events")
    event_methods: Mapped[List["EventMethod"]] = relationship(back_populates="event")
    results: Mapped[List["Result"]] = relationship(back_populates="event")


"""
Methods are the way in which a competency is measured. Methods have variables.
Methods can measure 0 or more competencies.
Methods can be nested within other methods.

methods
------------------
id
parent_id
name
description
variable                -- Variable object
criteria                -- JSON. Evaluation rules. Examples:
                            {"pass": {"operator": "<=", "value": 570}}
                            {"aggregation": {"type": "all_children_pass"}}
display_order
version
is_required
"""
class Method(Base):
    __tablename__ = "methods"

    id: Mapped[int] = mapped_column(primary_key=True)

    parent_id: Mapped[int | None] = mapped_column(ForeignKey("methods.id"))
    parent: Mapped["Method | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["Method"]] = relationship(back_populates="parent")

    name: Mapped[str]
    description: Mapped[str | None]

    variable_id: Mapped[int | None] = mapped_column(ForeignKey("variables.id"))
    variable: Mapped["Variable | None"] = relationship()

    criteria: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    display_order: Mapped[int] = mapped_column(default=0)
    version: Mapped[int] = mapped_column(default=1)
    is_required: Mapped[bool] = mapped_column(default=True)

    event_methods: Mapped[List["EventMethod"]] = relationship(back_populates="method")
    method_competencies: Mapped[List["MethodCompetency"]] = relationship(back_populates="method")
    results: Mapped[List["Result"]] = relationship(back_populates="method")
"""
A competency is measured by a method.

competencies
------------
id
name
"""
class Competency(Base):
    __tablename__ = "competencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    method_competencies: Mapped[List["MethodCompetency"]] = relationship(back_populates="competency")


# Note: the vocabulary is still fluid. Other names could be Attributes, Metrics, Variables.
# The goal is to capture the abstract structure of a measurement system so that we can generalize our product to any assessment process that measure candidates based on defined attributes.

"""
Would like to capture
Variable Types::
    | Categorical
        | Nominal - no order
        | Ordinal - ordered set
    | Numerical
        | Discrete
        | Continuous
            | Interval
            | Ratio
"""

class VariableScale(str, Enum):
    nominal = "nominal"
    ordinal = "ordinal"
    discrete = "discrete"
    interval = "interval"
    ratio = "ratio"

class AggregationType(str, Enum):
    all_children_pass = "all_children_pass"
    sum = "sum"
    average = "average"
    concat = "concat"
    rank = "rank"

class VarUnit(str, Enum):
    integer = "integer"
    float = "float"
    boolean = "boolean"
    text = "text"
    seconds = "seconds"
    meters = "meters"
    reps = "reps"

class Variable(Base):
    __tablename__ = "variables"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    unit: Mapped[VarUnit] = mapped_column(SAEnum(VarUnit, values_callable=lambda enum: [item.value for item in enum]))
    scale: Mapped[VariableScale] = mapped_column(SAEnum(VariableScale, values_callable=lambda enum: [item.value for item in enum]))
    domain: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)




"""
A metric is used to describe or measure something quantitatively.
Leaving the stub for now. Conflicts with Methods, Variable Types.
metric
------
id
name
type -- timed, count, categorical,
domain -- allowable values.
description
version
"""
class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    metric_type: Mapped[str] = mapped_column(String(100))
    domain: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    scoring: Mapped[dict] = mapped_column(JSON)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


"""
The many-to-many relationship between Events and Methods
event_methods
-------------
event_id
method_id
display_order
"""
class EventMethod(Base):
    __tablename__ = "event_methods"

    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), primary_key=True)
    method_id: Mapped[int] = mapped_column(ForeignKey("methods.id"), primary_key=True)
    display_order: Mapped[int] = mapped_column(Integer)

    event: Mapped["Event"] = relationship(back_populates="event_methods")
    method: Mapped["Method"] = relationship(back_populates="event_methods")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(200))
    candidate_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    roster_candidates: Mapped[List["RosterCandidate"]] = relationship(back_populates="candidate")
    results: Mapped[List["Result"]] = relationship(back_populates="candidate")


class Roster(Base):
    __tablename__ = "rosters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    roster_candidates: Mapped[List["RosterCandidate"]] = relationship(back_populates="roster")
    assessment_runs: Mapped[List["AssessmentRun"]] = relationship(back_populates="roster")


class RosterCandidate(Base):
    __tablename__ = "roster_candidates"

    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"), primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), primary_key=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    roster: Mapped["Roster"] = relationship(back_populates="roster_candidates")
    candidate: Mapped["Candidate"] = relationship(back_populates="roster_candidates")


class AssessmentRun(Base):
    __tablename__ = "assessment_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"))
    roster_id: Mapped[int] = mapped_column(ForeignKey("rosters.id"))
    status: Mapped[str] = mapped_column(String(50), default="draft")
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assessment: Mapped["Assessment"] = relationship()
    roster: Mapped["Roster"] = relationship(back_populates="assessment_runs")
    run_events: Mapped[List["AssessmentRunEvent"]] = relationship(back_populates="assessment_run")
    results: Mapped[List["Result"]] = relationship(back_populates="assessment_run")


class AssessmentRunEvent(Base):
    __tablename__ = "assessment_run_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_run_id: Mapped[int] = mapped_column(ForeignKey("assessment_runs.id"))
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    assessment_run: Mapped["AssessmentRun"] = relationship(back_populates="run_events")
    event: Mapped["Event"] = relationship()
    run_methods: Mapped[List["AssessmentRunMethod"]] = relationship(back_populates="run_event")
    results: Mapped[List["Result"]] = relationship(back_populates="assessment_run_event")


class AssessmentRunMethod(Base):
    __tablename__ = "assessment_run_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_run_event_id: Mapped[int] = mapped_column(ForeignKey("assessment_run_events.id"))
    method_id: Mapped[int] = mapped_column(ForeignKey("methods.id"))
    parent_run_method_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_run_methods.id"), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    observation_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    is_entry_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    method_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    variable_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    run_event: Mapped["AssessmentRunEvent"] = relationship(back_populates="run_methods")
    method: Mapped["Method"] = relationship()
    parent: Mapped["AssessmentRunMethod | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[List["AssessmentRunMethod"]] = relationship(back_populates="parent")
    results: Mapped[List["Result"]] = relationship(back_populates="assessment_run_method")


"""
The many to many relationship between Methods and Competencies.
method_competencies
------------------------------
method_id
competency_id
weight
"""
class MethodCompetency(Base):
    __tablename__ = "method_competencies"

    method_id: Mapped[int] = mapped_column(ForeignKey("methods.id"), primary_key=True)
    competency_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"), primary_key=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    method: Mapped["Method"] = relationship(back_populates="method_competencies")
    competency: Mapped["Competency"] = relationship(back_populates="method_competencies")


"""
A Result is an observation of an Competency variable through the application of a Method.


results
-------
id
event_id
candidate_id
method_id
value_time
value_number
value_bool
value_text
status
"""
class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_run_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_runs.id"), nullable=True)
    assessment_run_event_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_run_events.id"), nullable=True)
    assessment_run_method_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_run_methods.id"), nullable=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    method_id: Mapped[int] = mapped_column(ForeignKey("methods.id"))
    observation_index: Mapped[int] = mapped_column(Integer, default=0)
    assessor_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    value: Mapped[dict | int | float | str | bool | None] = mapped_column(JSON, nullable=True)
    value_display: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    value_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    value_number: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_bool: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    event: Mapped["Event"] = relationship(back_populates="results")
    method: Mapped["Method"] = relationship(back_populates="results")
    candidate: Mapped["Candidate"] = relationship(back_populates="results")
    assessment_run: Mapped["AssessmentRun | None"] = relationship(back_populates="results")
    assessment_run_event: Mapped["AssessmentRunEvent | None"] = relationship(back_populates="results")
    assessment_run_method: Mapped["AssessmentRunMethod | None"] = relationship(back_populates="results")
