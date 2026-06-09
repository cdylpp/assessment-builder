# TODO

## Frontend

- Form validation.
- Edit Methods
- Competency Library
- Variable Library
- Search, sort, filter
- adding competencies to methods is clunky.

## New Feature: Administer Assessment

### User Story

As an admin of the assessment builder, I want the capability to administer the assessment, including all events nested under the assessment, live. This lets me capture measurements based on the methods.

To administer an assessment, I need to write results to a result table based on the observed value for a particular candidate. I also need a roster, meaning a list of candidates performing in the methods. I may eventually need evaluators if I am not the only one evaluating the candidates.

My typical workflow is the following: to administer an assessment I need as input (1) a roster and (2) an assessment.
For each event, I order the events based on time. I administer each event one by one. For an event, I look at the Methods for that event, and I collect the data for each candidate on all the methods in a tabular format. I then process the next event.

At the end, I tally up all the scores to view final data cards.

The assessment administration process should be stateful. It should have a start and stop date. It should show a summary of the progress completed, including stats about the scores. Each event should be self-contained in a form with all methods and sub-methods within that event hosted on the same window.

Some methods must be graded by evaluators who need access to a specific assessment. We can handle this later, but this feature is required for the final product. Another feature we can deal with later, but should account for now, is that participants may be asked to fill out surveys as part of the assessment. They should also be granted limited, temporary access. These deal with accounts and access, which we are not ready for yet.

### Acceptance Criteria

1. The frontend has a module for running the assessment in its own environment. The assessment has a time-stamped start/stop time. The assessment can be paused at any time.
2. The assessment administration module displays the order of tasks to be completed.
3. For each event, the assessment administration module allows the user to enter the correct value type, as defined by the variable, into a tabular form for each roster item.
4. The form for an event should display methods as columns and candidates as rows. For example, let E be the event with methods `(m1, m2, ..., mm)`. Then the layout would be:

```text
(candidate1 m1, m2, ..., mm)
(candidate2 m1, m2, ..., mm)
...
(candidaten m1, m2, ..., mm)
```

5. The assessor should be able to add another observation to any editable method. For example, suppose event E has methods `(m1, m2, m3)`. The event form has 3 columns and n rows for n participants. If the assessor wants two observations on each method, they click add observation on each method column to create the tabular form: `(m1, m1, m2, m2, m3, m3)`.
6. Added observations apply to all candidates for that method.
7. The assessor should be able to rearrange the order of methods inside a run event. The default order should be the order given when created.
8. The UI should make a clear distinction for many observations.
9. The UI should validate input based on `method.variable`.
10. Invalid result values should not be saved. The UI/API should return helpful errors such as `cannot save time as integer`.
11. The UI should display the correct value/unit for each variable type.
12. Parent aggregate methods should be displayed but not directly editable.
13. Only leaf methods should receive direct result entry in the MVP.
14. Paused runs should block result edits.

### UI/UX Design

During an assessment, I would like to see a task list of what needs to be completed. For example, given the following assessment:

```text
assessment: ass-one
events: [
    event1: [m1, m2, [m3 [m4, m5, m6]]] // m3 has 3 nested methods
    event2: [m2]
    event3: [m7, m1]
]
```

I would like the UI to display an overview as:

```md
- [ ] Event 1
    - [ ] M1
    - [ ] M2
    - [ ] M3
        - [ ] M4
        - [ ] M5
        - [ ] M6
- [ ] Event 2
    - [ ] M2
- [ ] Event 3
    - [ ] M7
    - [ ] M1
```

Once all scores have been completed for M1, the box should show that it is complete. The same behavior should happen with events.

### Proposed MVP Scope

Build a new assessment administration module that is separate from the builder/editor workflow.

In scope for the first implementation:

1. Create and manage rosters.
2. Start an assessment run from an assessment plus roster.
3. Track run state: draft, active, paused, completed.
4. Store start, pause/resume, and stop timestamps.
5. Lock a run snapshot when the run starts.
6. Order events by event date/time.
7. Display the ordered event/method task list for the run.
8. Open each event into a scoring grid.
9. Render candidates as rows and editable leaf methods as columns.
10. Display parent aggregate methods as grouped, read-only headers.
11. Allow one or more observations per candidate/method.
12. Save and update results throughout an active run.
13. Validate entered values based on the method variable.
14. Compute progress for methods, events, and the whole run.
15. Show summary cards for completion, pass/fail counts, averages, ranks, and candidate-level totals.

Out of scope for the first implementation:

1. Full auth, accounts, evaluator permissions, and temporary participant access.
2. Surveys completed directly by participants.
3. CSV import implementation. Add the UI action as a "coming soon" stub.
4. Offline mode or multi-user conflict resolution.
5. Complex drag-and-drop. Use simple up/down controls first if reordering is needed.

### Suggested Data Model

Add these tables or equivalent SQLAlchemy models:

```text
candidates
----------
id
display_name
metadata                 -- JSON for future candidate fields

rosters
-------
id
name
description

roster_candidates
-----------------
roster_id
candidate_id
display_order

events
------
scheduled_at             -- add to existing Event so events can be ordered in an assessment

assessment_runs
---------------
id
assessment_id
roster_id
status                   -- draft, active, paused, completed
locked_at                -- set when the assessment/method snapshot is created
started_at
paused_at
completed_at
created_at

assessment_run_events
---------------------
id
assessment_run_id
event_id
status                   -- pending, active, completed
scheduled_at             -- copied from Event at run creation
display_order

assessment_run_methods
----------------------
id
assessment_run_event_id
method_id
parent_run_method_id
display_order
observation_count        -- default 1, increments when the assessor adds an observation
status                   -- pending, in_progress, completed
is_entry_enabled         -- false for aggregate parent methods

results
-------
id
assessment_run_id
assessment_run_event_id
assessment_run_method_id
event_id
candidate_id
method_id
observation_index        -- 0, 1, 2, ...
assessor_user_id         -- nullable until accounts exist; later used for evaluator filtering
value                    -- JSON payload for the observed value
value_display            -- normalized display string, e.g. "12:30" or "yes"
status                   -- draft, valid, omitted
created_at
updated_at
```

Notes:

1. Candidate MVP identity is `display_name`; richer metadata can come later.
2. Use schemaless `results.value` JSON for MVP. Validate on write against the method's variable schema, then normalize on read for display and summaries.
3. Do not save invalid values.
4. Add run-specific IDs to `results`; otherwise a candidate's result cannot be tied to a specific live administration session.
5. `assessment_run_methods` snapshots display order, nesting, editability, and observation count for the live run.
6. The run should snapshot the selected event/method order at start time. Builder changes after start are ignored by the run.
7. Parent aggregate methods are displayed but not directly editable. Only leaf methods receive direct result entries for MVP.
8. Added observations apply to all candidates for that run method.
9. Missing optional method results do not count against event progress.
10. A method is complete when every candidate has at least one valid observation for every required editable method column.
11. Progress should expose entries completed over total required entries.

### Backend API Scope

Roster and candidate APIs:

```text
GET    /candidates
POST   /candidates
PUT    /candidates/{candidate_id}
DELETE /candidates/{candidate_id}

GET    /rosters
POST   /rosters
GET    /rosters/{roster_id}
PUT    /rosters/{roster_id}
DELETE /rosters/{roster_id}
POST   /rosters/{roster_id}/candidates
DELETE /rosters/{roster_id}/candidates/{candidate_id}
```

Administration APIs:

```text
GET    /assessment-runs
POST   /assessment-runs
GET    /assessment-runs/{run_id}
POST   /assessment-runs/{run_id}/start
POST   /assessment-runs/{run_id}/pause
POST   /assessment-runs/{run_id}/resume
POST   /assessment-runs/{run_id}/complete

GET    /assessment-runs/{run_id}/task-list
GET    /assessment-runs/{run_id}/events/{run_event_id}/grid
PUT    /assessment-runs/{run_id}/events/{run_event_id}/methods/reorder
POST   /assessment-runs/{run_id}/methods/{run_method_id}/observations
PUT    /assessment-runs/{run_id}/results
GET    /assessment-runs/{run_id}/summary
```

The `PUT /assessment-runs/{run_id}/results` endpoint should accept a batch payload so the grid can save changed cells without one request per input.

Run behavior:

1. Creating a run snapshots the assessment, event order, method order, method nesting, and variable definitions.
2. Starting a run locks that snapshot.
3. Pausing a run blocks result writes.
4. Resuming a run re-enables result writes.
5. Completing a run blocks result writes and enables final summary views.
6. The current app has no accounts yet. Store a nullable `assessor_user_id` or equivalent placeholder so results can later be filtered by assessor.

### Frontend Scope

Add a new sidebar section:

```text
Administer
```

Initial screens:

1. Roster Library
   - Create roster.
   - Add/edit/delete candidates.
   - Reorder candidates.
   - Add a CSV import action wired to a "coming soon" stub.

2. Assessment Runs
   - Pick assessment and roster.
   - Create run.
   - Start, pause, resume, complete.
   - Show timestamps and status.

3. Run Dashboard
   - Show progress summary.
   - Show event task list.
   - Open an event for scoring.

4. Event Scoring Grid
   - Rows: roster candidates.
   - Columns: editable leaf methods.
   - Sub-methods displayed under parent method headers.
   - Parent aggregate methods are read-only.
   - Add observation per editable leaf method.
   - Validate each cell using `variable.scale`, `variable.unit`, and `variable.domain`.
   - Save changed cells in a batch.
   - Mark method/event complete when required cells are valid.

5. Run Summary
   - Completion count.
   - Missing values.
   - Pass/fail counts.
   - Min/max/average for numeric methods.
   - Counts for boolean/text/categorical methods.
   - Ranks and candidate-level totals.

### UI Notes

The scoring grid needs to be dense and operational. It should feel more like a spreadsheet than a form wizard.

Recommended layout:

```text
Run header: assessment name, roster, status, timestamps, actions
Left rail: event/method task list with completion state
Main panel: selected event scoring grid
Bottom or side panel: validation errors and summary cards
```

For many observations, use grouped column headers:

```text
Candidate | M1 obs 1 | M1 obs 2 | M2 obs 1 | M3 obs 1 | M3 obs 2
```

For nested methods, use parent headers:

```text
Candidate | M1 | M2 | M3: M4 | M3: M5 | M3: M6
```

### shadcn UI Implementation Notes

Use the installed shadcn components first:

1. `Sidebar` for the new Administer navigation group.
2. `Card`, `Badge`, and `Table` for run summaries, roster tables, run lists, and scoring grids.
3. `Field`, `FieldGroup`, `Input`, `Textarea`, `NativeSelect`, and `InputGroup` for setup forms and cell editors.
4. `Button` with lucide icons for actions. Use `data-icon` on icons.
5. `Separator` between run header, task list, and scoring grid regions.
6. `Skeleton` for run/grid loading states.
7. `Tooltip` for compact grid controls such as add observation, reorder, and validation indicators.

Use layout `div`s only for page structure:

```text
Admin shell: sidebar + main panel
Run dashboard: two-column layout, task list left and selected event right
Scoring grid: card header controls + horizontally scrollable table
```

Keep the UI quiet and operational. Avoid marketing sections. The first screen for a run should be the runnable workflow, not a landing page.

### Implementation Plan

Phase 1: backend foundation

1. Add candidate and roster models with `display_name` as the only required candidate field.
2. Add assessment run, run event, and run method models.
3. Add `Event.scheduled_at` and order assessment events by date/time during run creation.
4. Extend `Result` with run-specific columns, `observation_index`, `assessor_user_id`, `value` JSON, and `value_display`.
5. Add create/read/update/delete APIs for candidates and rosters.
6. Add assessment run lifecycle APIs.
7. Add a service helper that snapshots assessment events, methods, method nesting, variable definitions, and editability into a run.
8. Add backend validation for result writes before saving.

Phase 2: frontend run setup with shadcn

1. Add an Administer section to the app sidebar.
2. Build roster library page using `Card`, `Field`, `Table`, and `Button`.
3. Add manual candidate entry.
4. Add CSV import button that opens or displays a "coming soon" stub.
5. Build assessment run setup page using `Card`, `NativeSelect`, `Badge`, and `Button`.
6. Create run from assessment plus roster.
7. Display run status and timestamps with badges and summary cards.

Phase 3: event administration with shadcn

1. Build run dashboard with task list.
2. Build event scoring grid using `Table` inside a horizontally scrollable `Card`.
3. Add input renderers by variable unit:
   - boolean: select/toggle.
   - integer/float: numeric input.
   - seconds: `[mm]:ss` input, stored as seconds.
   - text/options: select or text input depending on `domain.options`.
4. Add batch save for result cells.
5. Add observation columns per leaf method, applied to all candidates.
6. Add method reorder controls for a run event.
7. Display aggregate parent methods as grouped, read-only headers.
8. Block result editing while the run is paused or completed.
9. Show inline validation errors and block invalid saves.

Phase 4: progress and summary

1. Compute method completion based on required valid result cells.
2. Exclude optional methods from progress denominator when missing.
3. Compute event completion from method completion.
4. Compute run completion from event completion.
5. Compute parent aggregate method scores where feasible.
6. Add run summary cards for completion, pass/fail counts, averages, ranks, and candidate-level totals.
7. Add missing value indicators.

Phase 5: hardening

1. Add frontend form validation states using `Field` invalid states.
2. Add tests for run lifecycle and result saving.
3. Add fixtures for a sample assessment run.
4. Add a dev reset seed option for demo data.
5. Add account-aware evaluator attribution after auth exists.

### Resolved Product Decisions

1. Candidate MVP identity is `display_name`; richer metadata can come later.
2. Roster MVP uses manual candidate entry.
3. CSV import should be visible but stubbed as "coming soon".
4. MVP results are entered by the admin/current user. Evaluator support comes next.
5. Runs are immutable after start. Builder changes do not mutate an active run.
6. Only editable leaf methods receive direct observations in MVP.
7. Parent aggregate methods are read-only in the scoring grid.
8. Required editable method completion means every candidate has at least one valid observation.
9. Progress should show completed entries over total required entries.
10. Optional methods do not count against event progress when missing.
11. Added observations apply to all candidates for that method.
12. Parent/aggregate scores should be computed in phase 1 if feasible.
13. Events need a date/time attribute, and assessment runs should order events by that date/time.
14. Paused runs block result edits.
15. Invalid result values are not saved.
16. Summary cards should include completion, pass/fail counts, averages, ranks, and candidate-level totals.
17. Future evaluators should probably be assigned at the assessment level first, with tighter controls later if needed.

### Open Questions

1. Participant surveys may fit as methods, but the survey model needs more design. Example: participant ranks top 5 peers, assigns negative rankings to candidates, and may add comments to any candidate.
