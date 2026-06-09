import axios from "axios"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { AppSidebar, type AppView } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

const variableScales = [
  "nominal",
  "ordinal",
  "discrete",
  "interval",
  "ratio",
] as const

const variableUnits = [
  "integer",
  "float",
  "boolean",
  "text",
  "seconds",
  "meters",
  "reps",
] as const

const unitsByScale = {
  nominal: ["boolean", "text", "integer"],
  ordinal: ["integer", "float"],
  discrete: ["integer", "float", "text"],
  interval: ["integer", "float", "seconds"],
  ratio: ["integer", "float", "seconds", "meters", "reps"],
} as const satisfies Record<VariableScale, readonly VariableUnit[]>

const aggregationTypes = [
  "none",
  "all_children_pass",
  "sum",
  "average",
  "concat",
  "rank",
] as const

type VariableScale = (typeof variableScales)[number]
type VariableUnit = (typeof variableUnits)[number]
type AggregationSelection = (typeof aggregationTypes)[number]
type AggregationType = Exclude<AggregationSelection, "none">
type CriteriaOperator = "<" | ">" | "="

type MethodCriteria = {
  pass?: {
    operator: CriteriaOperator
    value: number | string
  }
  aggregation?: {
    type: AggregationType
  }
}

type VariableDomain = {
  range?: {
    min?: number
    max?: number
    step?: number
  }
  options?: string[]
}

type Assessment = {
  id: number
  name: string
  description: string | null
}

type Variable = {
  id: number
  name: string
  unit: VariableUnit
  scale: VariableScale
  domain: VariableDomain
}

type Competency = {
  id: number
  name: string
  description: string | null
}

type Method = {
  id: number
  parent_id: number | null
  name: string
  description: string | null
  variable_id: number | null
  criteria: MethodCriteria
  display_order: number
  version: number
  is_required: boolean
  competencyIds: number[]
}

type ApiMethod = Omit<Method, "competencyIds"> & {
  competency_ids: number[]
}

type EventRecord = {
  id: number
  assessment_id: number
  name: string
  status: string
  scheduled_at: string | null
  methodIds: number[]
}

type ApiEventRecord = Omit<EventRecord, "methodIds"> & {
  method_ids: number[]
}

type Candidate = {
  id: number
  display_name: string
  metadata: Record<string, unknown>
}

type Roster = {
  id: number
  name: string
  description: string | null
  candidate_ids: number[]
}

type AssessmentRun = {
  id: number
  assessment_id: number
  roster_id: number
  status: "draft" | "active" | "paused" | "completed"
  locked_at: string | null
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  created_at: string
}

type RunMethod = {
  id: number
  method_id: number
  parent_run_method_id: number | null
  name: string
  criteria: MethodCriteria
  is_required: boolean
  variable: Variable | null
  display_order: number
  observation_count: number
  status: string
  is_entry_enabled: boolean
}

type RunEvent = {
  id: number
  event_id: number
  name: string
  status: string
  scheduled_at: string | null
  display_order: number
}

type RunTaskList = {
  run: AssessmentRun
  events: Array<RunEvent & { methods: RunMethod[] }>
}

type RunResult = {
  id: number
  assessment_run_method_id: number
  candidate_id: number
  observation_index: number
  value: unknown
  value_display: string | null
  status: string
}

type RunGrid = {
  run: AssessmentRun
  run_event: RunEvent
  candidates: Candidate[]
  methods: RunMethod[]
  results: RunResult[]
}

type RunSummary = {
  run: AssessmentRun
  completion: {
    completed: number
    total: number
    percent: number
  }
  pass_fail: {
    pass: number
    fail: number
  }
  numeric: {
    count: number
    min: number | null
    max: number | null
    average: number | null
  }
  candidate_totals: Array<{
    candidate_id: number
    valid_results: number
  }>
}

type AssessmentForm = {
  name: string
  description: string
}

type VariableForm = {
  name: string
  unit: VariableUnit
  scale: VariableScale
  rangeMin: string
  rangeMax: string
  rangeStep: string
  options: string
}

type CompetencyForm = {
  name: string
  description: string
}

type MethodForm = {
  name: string
  description: string
  parentId: string
  variableId: string
  criteriaOperator: CriteriaOperator
  criteriaValue: string
  aggregationType: AggregationSelection
  displayOrder: string
  isRequired: string
  competencyIds: number[]
}

type EventForm = {
  assessmentId: string
  name: string
  scheduledAt: string
  methodIds: number[]
}

type CandidateForm = {
  displayName: string
}

type RosterForm = {
  name: string
  description: string
}

type RunForm = {
  assessmentId: string
  rosterId: string
}

type WorkspaceData = {
  assessments: Assessment[]
  variables: Variable[]
  competencies: Competency[]
  methods: Method[]
  events: EventRecord[]
  candidates: Candidate[]
  rosters: Roster[]
  assessmentRuns: AssessmentRun[]
}

const emptyAssessment: AssessmentForm = {
  name: "",
  description: "",
}

const emptyVariable: VariableForm = {
  name: "",
  unit: "integer",
  scale: "ratio",
  rangeMin: "",
  rangeMax: "",
  rangeStep: "",
  options: "",
}

const emptyCompetency: CompetencyForm = {
  name: "",
  description: "",
}

const emptyMethod: MethodForm = {
  name: "",
  description: "",
  parentId: "",
  variableId: "",
  criteriaOperator: "<",
  criteriaValue: "",
  aggregationType: "none",
  displayOrder: "0",
  isRequired: "true",
  competencyIds: [],
}

const emptyEvent: EventForm = {
  assessmentId: "",
  name: "",
  scheduledAt: "",
  methodIds: [],
}

const emptyCandidate: CandidateForm = {
  displayName: "",
}

const emptyRoster: RosterForm = {
  name: "",
  description: "",
}

const emptyRun: RunForm = {
  assessmentId: "",
  rosterId: "",
}

function normalizeMethod(method: ApiMethod): Method {
  return {
    ...method,
    criteria: method.criteria ?? {},
    competencyIds: method.competency_ids,
  }
}

function normalizeVariable(variable: Variable): Variable {
  return {
    ...variable,
    domain: variable.domain ?? {},
  }
}

function normalizeEvent(event: ApiEventRecord): EventRecord {
  return {
    ...event,
    methodIds: event.method_ids,
  }
}

function variableToForm(variable: Variable): VariableForm {
  return {
    name: variable.name,
    unit: variable.unit,
    scale: variable.scale,
    rangeMin: String(variable.domain.range?.min ?? ""),
    rangeMax: String(variable.domain.range?.max ?? ""),
    rangeStep: String(variable.domain.range?.step ?? ""),
    options: variable.domain.options?.join(", ") ?? "",
  }
}

function competencyToForm(competency: Competency): CompetencyForm {
  return {
    name: competency.name,
    description: competency.description ?? "",
  }
}

function methodToForm(method: Method, variable?: Variable): MethodForm {
  const passCriteria = method.criteria.pass
  const aggregationType = getAggregationType(method.criteria)

  return {
    name: method.name,
    description: method.description ?? "",
    parentId: method.parent_id === null ? "" : String(method.parent_id),
    variableId: method.variable_id === null ? "" : String(method.variable_id),
    criteriaOperator: passCriteria?.operator ?? "<",
    criteriaValue:
      passCriteria?.value === undefined
        ? ""
        : formatCriteriaValue(passCriteria.value, variable),
    aggregationType,
    displayOrder: String(method.display_order),
    isRequired: String(method.is_required),
    competencyIds: method.competencyIds,
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard")
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [variables, setVariables] = useState<Variable[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [methods, setMethods] = useState<Method[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [assessmentRuns, setAssessmentRuns] = useState<AssessmentRun[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [selectedRunEventId, setSelectedRunEventId] = useState<number | null>(null)
  const [runTaskList, setRunTaskList] = useState<RunTaskList | null>(null)
  const [runGrid, setRunGrid] = useState<RunGrid | null>(null)
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [assessmentForm, setAssessmentForm] = useState(emptyAssessment)
  const [variableForm, setVariableForm] = useState(emptyVariable)
  const [competencyForm, setCompetencyForm] = useState(emptyCompetency)
  const [methodForm, setMethodForm] = useState(emptyMethod)
  const [eventForm, setEventForm] = useState(emptyEvent)
  const [candidateForm, setCandidateForm] = useState(emptyCandidate)
  const [rosterForm, setRosterForm] = useState(emptyRoster)
  const [runForm, setRunForm] = useState(emptyRun)
  const [editingVariableId, setEditingVariableId] = useState<number | null>(null)
  const [editingCompetencyId, setEditingCompetencyId] = useState<number | null>(null)
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const selectedEventMethods = selectedEvent
    ? methods.filter((method) => selectedEvent.methodIds.includes(method.id))
    : []
  const selectedRoster = rosters.find((roster) => roster.id === selectedRosterId)
  const selectedRun = assessmentRuns.find((run) => run.id === selectedRunId)

  async function fetchWorkspace(): Promise<WorkspaceData> {
    const [
      assessmentsResponse,
      variablesResponse,
      competenciesResponse,
      methodsResponse,
      eventsResponse,
      candidatesResponse,
      rostersResponse,
      assessmentRunsResponse,
    ] = await Promise.all([
      axios.get<Assessment[]>(`${API}/assessments`),
      axios.get<Variable[]>(`${API}/variables`),
      axios.get<Competency[]>(`${API}/competencies`),
      axios.get<ApiMethod[]>(`${API}/methods`),
      axios.get<ApiEventRecord[]>(`${API}/events`),
      axios.get<Candidate[]>(`${API}/candidates`),
      axios.get<Roster[]>(`${API}/rosters`),
      axios.get<AssessmentRun[]>(`${API}/assessment-runs`),
    ])

    return {
      assessments: assessmentsResponse.data,
      variables: variablesResponse.data.map(normalizeVariable),
      competencies: competenciesResponse.data,
      methods: methodsResponse.data.map(normalizeMethod),
      events: eventsResponse.data.map(normalizeEvent),
      candidates: candidatesResponse.data,
      rosters: rostersResponse.data,
      assessmentRuns: assessmentRunsResponse.data,
    }
  }

  function applyWorkspace(data: WorkspaceData) {
    setAssessments(data.assessments)
    setVariables(data.variables)
    setCompetencies(data.competencies)
    setMethods(data.methods)
    setEvents(data.events)
    setCandidates(data.candidates)
    setRosters(data.rosters)
    setAssessmentRuns(data.assessmentRuns)
    setSelectedEventId((current) => {
      if (current === null) return null
      return data.events.some((event) => event.id === current) ? current : null
    })
    setSelectedRosterId((current) => {
      if (current === null) return data.rosters[0]?.id ?? null
      return data.rosters.some((roster) => roster.id === current) ? current : null
    })
    setSelectedRunId((current) => {
      if (current === null) return data.assessmentRuns[0]?.id ?? null
      return data.assessmentRuns.some((run) => run.id === current) ? current : null
    })
  }

  async function loadWorkspace() {
    setIsLoading(true)
    const data = await fetchWorkspace()
    applyWorkspace(data)
    setIsLoading(false)
  }

  async function loadRunWorkspace(runId: number, preferredEventId?: number | null) {
    const [taskResponse, summaryResponse] = await Promise.all([
      axios.get<RunTaskList>(`${API}/assessment-runs/${runId}/task-list`),
      axios.get<RunSummary>(`${API}/assessment-runs/${runId}/summary`),
    ])
    const taskList = taskResponse.data
    const runEventId =
      preferredEventId !== null &&
      preferredEventId !== undefined &&
      taskList.events.some((event) => event.id === preferredEventId)
        ? preferredEventId
        : taskList.events[0]?.id ?? null

    setRunTaskList(taskList)
    setRunSummary(summaryResponse.data)
    setSelectedRunEventId(runEventId)

    if (runEventId) {
      const gridResponse = await axios.get<RunGrid>(
        `${API}/assessment-runs/${runId}/events/${runEventId}/grid`
      )
      setRunGrid(gridResponse.data)
    } else {
      setRunGrid(null)
    }
    setResultDrafts({})
  }

  useEffect(() => {
    let ignore = false

    async function loadInitialWorkspace() {
      try {
        const data = await fetchWorkspace()
        if (ignore) return
        applyWorkspace(data)
      } catch (error) {
        if (ignore) return
        setMessage(error instanceof Error ? error.message : "Failed to load data.")
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialWorkspace()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!selectedRunId) {
      setRunTaskList(null)
      setRunGrid(null)
      setRunSummary(null)
      setSelectedRunEventId(null)
      return
    }

    void loadRunWorkspace(selectedRunId, selectedRunEventId)
  }, [selectedRunId])

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = assessmentForm.name.trim()

    if (!name) return

    const response = await axios.post<Assessment>(`${API}/assessments`, {
      name,
      description: assessmentForm.description.trim() || null,
    })

    setEventForm((current) => ({
      ...current,
      assessmentId: String(response.data.id),
    }))
    setAssessmentForm(emptyAssessment)
    await loadWorkspace()
    setMessage(`Created assessment ${response.data.name}.`)
  }

  async function saveVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = variableForm.name.trim()

    if (!name) return

    const payload = {
      name,
      unit: variableForm.unit,
      scale: variableForm.scale,
      domain: buildVariableDomain(variableForm),
    }

    const response = editingVariableId
      ? await axios.put<Variable>(`${API}/variables/${editingVariableId}`, payload)
      : await axios.post<Variable>(`${API}/variables`, payload)

    if (!editingVariableId) {
      setMethodForm((current) => ({
        ...current,
        variableId: current.variableId || String(response.data.id),
      }))
    }
    setVariableForm(emptyVariable)
    setEditingVariableId(null)
    await loadWorkspace()
    setMessage(`${editingVariableId ? "Updated" : "Created"} variable ${response.data.name}.`)
  }

  async function saveCompetency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = competencyForm.name.trim()

    if (!name) return

    const payload = {
      name,
      description: competencyForm.description.trim() || null,
    }

    const response = editingCompetencyId
      ? await axios.put<Competency>(
          `${API}/competencies/${editingCompetencyId}`,
          payload
        )
      : await axios.post<Competency>(`${API}/competencies`, payload)

    if (!editingCompetencyId) {
      setMethodForm((current) => ({
        ...current,
        competencyIds: [...current.competencyIds, response.data.id],
      }))
    }
    setCompetencyForm(emptyCompetency)
    setEditingCompetencyId(null)
    await loadWorkspace()
    setMessage(`${editingCompetencyId ? "Updated" : "Created"} competency ${response.data.name}.`)
  }

  function toggleCompetencyForMethod(competencyId: number) {
    setMethodForm((current) => {
      if (current.competencyIds.includes(competencyId)) {
        return {
          ...current,
          competencyIds: current.competencyIds.filter((id) => id !== competencyId),
        }
      }

      return {
        ...current,
        competencyIds: [...current.competencyIds, competencyId],
      }
    })
  }

  async function saveMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = methodForm.name.trim()

    if (!name) return

    const selectedVariable = variables.find(
      (variable) => variable.id === Number(methodForm.variableId)
    )
    const criteria = buildCriteria(methodForm, selectedVariable)
    const payload = {
      name,
      description: methodForm.description.trim() || null,
      parent_id: methodForm.parentId ? Number(methodForm.parentId) : null,
      variable_id: methodForm.variableId ? Number(methodForm.variableId) : null,
      criteria,
      display_order: Number(methodForm.displayOrder) || 0,
      version: 1,
      is_required: methodForm.isRequired === "true",
      competency_ids: methodForm.competencyIds,
    }

    const response = editingMethodId
      ? await axios.put<ApiMethod>(`${API}/methods/${editingMethodId}`, payload)
      : await axios.post<ApiMethod>(`${API}/methods`, payload)

    const createdMethod = normalizeMethod(response.data)

    if (!editingMethodId) {
      setEventForm((current) => ({
        ...current,
        methodIds: [...current.methodIds, createdMethod.id],
      }))
    }
    setMethodForm({
      ...emptyMethod,
      variableId: methodForm.variableId,
      aggregationType: methodForm.aggregationType,
    })
    setEditingMethodId(null)
    await loadWorkspace()
    setMessage(`${editingMethodId ? "Updated" : "Created"} method ${createdMethod.name}.`)
  }

  function addMethodToDraft(methodId: number) {
    setEventForm((current) => {
      if (current.methodIds.includes(methodId)) {
        return current
      }

      return {
        ...current,
        methodIds: [...current.methodIds, methodId],
      }
    })
  }

  function removeMethodFromDraft(methodId: number) {
    setEventForm((current) => ({
      ...current,
      methodIds: current.methodIds.filter((id) => id !== methodId),
    }))
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!eventForm.assessmentId || !eventForm.name.trim()) return

    const response = await axios.post<ApiEventRecord>(`${API}/events`, {
      assessment_id: Number(eventForm.assessmentId),
      name: eventForm.name.trim(),
      scheduled_at: eventForm.scheduledAt || null,
      method_ids: eventForm.methodIds,
    })

    const createdEvent = normalizeEvent(response.data)

    setSelectedEventId(createdEvent.id)
    setEventForm(emptyEvent)
    await loadWorkspace()
    setActiveView("event")
    setMessage(`Created event ${createdEvent.name}.`)
  }

  async function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const displayName = candidateForm.displayName.trim()
    if (!displayName) return

    const response = await axios.post<Candidate>(`${API}/candidates`, {
      display_name: displayName,
      metadata: {},
    })
    setCandidateForm(emptyCandidate)
    await loadWorkspace()
    setMessage(`Created candidate ${response.data.display_name}.`)
  }

  async function deleteCandidate(candidateId: number) {
    await axios.delete(`${API}/candidates/${candidateId}`)
    await loadWorkspace()
    setMessage("Deleted candidate.")
  }

  async function createRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = rosterForm.name.trim()
    if (!name) return

    const response = await axios.post<Roster>(`${API}/rosters`, {
      name,
      description: rosterForm.description.trim() || null,
    })
    setRosterForm(emptyRoster)
    setSelectedRosterId(response.data.id)
    await loadWorkspace()
    setMessage(`Created roster ${response.data.name}.`)
  }

  async function deleteRoster(rosterId: number) {
    await axios.delete(`${API}/rosters/${rosterId}`)
    setSelectedRosterId((current) => (current === rosterId ? null : current))
    await loadWorkspace()
    setMessage("Deleted roster.")
  }

  async function addCandidateToRoster(candidateId: number) {
    if (!selectedRosterId) return
    await axios.post<Roster>(`${API}/rosters/${selectedRosterId}/candidates`, {
      candidate_id: candidateId,
    })
    await loadWorkspace()
    setMessage("Added candidate to roster.")
  }

  async function removeCandidateFromRoster(candidateId: number) {
    if (!selectedRosterId) return
    await axios.delete(`${API}/rosters/${selectedRosterId}/candidates/${candidateId}`)
    await loadWorkspace()
    setMessage("Removed candidate from roster.")
  }

  async function createAssessmentRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!runForm.assessmentId || !runForm.rosterId) return

    const response = await axios.post<AssessmentRun>(`${API}/assessment-runs`, {
      assessment_id: Number(runForm.assessmentId),
      roster_id: Number(runForm.rosterId),
    })
    setRunForm(emptyRun)
    setSelectedRunId(response.data.id)
    await loadWorkspace()
    await loadRunWorkspace(response.data.id)
    setMessage("Created assessment run.")
  }

  async function transitionAssessmentRun(action: "start" | "pause" | "resume" | "complete") {
    if (!selectedRunId) return
    await axios.post<AssessmentRun>(`${API}/assessment-runs/${selectedRunId}/${action}`)
    await loadWorkspace()
    await loadRunWorkspace(selectedRunId, selectedRunEventId)
    const actionLabels = {
      start: "started",
      pause: "paused",
      resume: "resumed",
      complete: "completed",
    }
    setMessage(`Run ${actionLabels[action]}.`)
  }

  async function openAssessmentRun(runId: number) {
    setSelectedRunId(runId)
    setActiveView("assessment-runs")
    await loadRunWorkspace(runId)
  }

  async function openRunEvent(runEventId: number) {
    if (!selectedRunId) return
    setSelectedRunEventId(runEventId)
    const gridResponse = await axios.get<RunGrid>(
      `${API}/assessment-runs/${selectedRunId}/events/${runEventId}/grid`
    )
    setRunGrid(gridResponse.data)
    setResultDrafts({})
  }

  async function addRunMethodObservation(runMethodId: number) {
    if (!selectedRunId) return
    await axios.post(`${API}/assessment-runs/${selectedRunId}/methods/${runMethodId}/observations`)
    await loadRunWorkspace(selectedRunId, selectedRunEventId)
    setMessage("Added observation.")
  }

  function updateResultDraft(key: string, value: string) {
    setResultDrafts((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function saveResultDrafts() {
    if (!selectedRunId || !runGrid) return

    const results = Object.entries(resultDrafts)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => {
        const [runMethodId, candidateId, observationIndex] = key.split(":").map(Number)
        return {
          assessment_run_method_id: runMethodId,
          candidate_id: candidateId,
          observation_index: observationIndex,
          value,
        }
      })

    if (results.length === 0) return

    try {
      await axios.put(`${API}/assessment-runs/${selectedRunId}/results`, {
        results,
      })
      await loadRunWorkspace(selectedRunId, runGrid.run_event.id)
      setMessage("Saved results.")
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setMessage(String(error.response?.data?.detail ?? error.message))
      } else {
        setMessage("Failed to save results.")
      }
    }
  }

  async function moveRunMethod(runMethodId: number, direction: -1 | 1) {
    if (!selectedRunId || !runGrid) return
    const methodIds = runGrid.methods.map((method) => method.id)
    const index = methodIds.indexOf(runMethodId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= methodIds.length) return
    const nextMethodIds = [...methodIds]
    const [methodId] = nextMethodIds.splice(index, 1)
    nextMethodIds.splice(nextIndex, 0, methodId)
    await axios.put(
      `${API}/assessment-runs/${selectedRunId}/events/${runGrid.run_event.id}/methods/reorder`,
      { method_ids: nextMethodIds }
    )
    await loadRunWorkspace(selectedRunId, runGrid.run_event.id)
    setMessage("Reordered methods.")
  }

  async function deleteAssessment(assessmentId: number) {
    await axios.delete(`${API}/assessments/${assessmentId}`)
    setEventForm((current) => ({
      ...current,
      assessmentId: current.assessmentId === String(assessmentId) ? "" : current.assessmentId,
    }))
    await loadWorkspace()
    setMessage("Deleted assessment.")
  }

  async function deleteEvent(eventId: number) {
    await axios.delete(`${API}/events/${eventId}`)
    setSelectedEventId((current) => (current === eventId ? null : current))
    await loadWorkspace()
    setMessage("Deleted event.")
  }

  async function deleteMethod(methodId: number) {
    await axios.delete(`${API}/methods/${methodId}`)
    setEventForm((current) => ({
      ...current,
      methodIds: current.methodIds.filter((id) => id !== methodId),
    }))
    setMethodForm((current) => ({
      ...current,
      parentId: current.parentId === String(methodId) ? "" : current.parentId,
    }))
    if (editingMethodId === methodId) {
      setMethodForm(emptyMethod)
      setEditingMethodId(null)
    }
    await loadWorkspace()
    setMessage("Deleted method.")
  }

  async function deleteVariable(variableId: number) {
    await axios.delete(`${API}/variables/${variableId}`)
    setMethodForm((current) => ({
      ...current,
      variableId: current.variableId === String(variableId) ? "" : current.variableId,
    }))
    if (editingVariableId === variableId) {
      setVariableForm(emptyVariable)
      setEditingVariableId(null)
    }
    await loadWorkspace()
    setMessage("Deleted variable.")
  }

  async function deleteCompetency(competencyId: number) {
    await axios.delete(`${API}/competencies/${competencyId}`)
    setMethodForm((current) => ({
      ...current,
      competencyIds: current.competencyIds.filter((id) => id !== competencyId),
    }))
    if (editingCompetencyId === competencyId) {
      setCompetencyForm(emptyCompetency)
      setEditingCompetencyId(null)
    }
    await loadWorkspace()
    setMessage("Deleted competency.")
  }

  function editMethod(method: Method) {
    const variable = variables.find((item) => item.id === method.variable_id)
    setEditingMethodId(method.id)
    setMethodForm(methodToForm(method, variable))
    setActiveView("methods")
  }

  function cancelMethodEdit() {
    setEditingMethodId(null)
    setMethodForm(emptyMethod)
  }

  function editVariable(variable: Variable) {
    setEditingVariableId(variable.id)
    setVariableForm(variableToForm(variable))
    setActiveView("variables")
  }

  function cancelVariableEdit() {
    setEditingVariableId(null)
    setVariableForm(emptyVariable)
  }

  function editCompetency(competency: Competency) {
    setEditingCompetencyId(competency.id)
    setCompetencyForm(competencyToForm(competency))
    setActiveView("competencies")
  }

  function cancelCompetencyEdit() {
    setEditingCompetencyId(null)
    setCompetencyForm(emptyCompetency)
  }

  function openEvent(eventId: number) {
    setSelectedEventId(eventId)
    setActiveView("event")
  }

  function exportEvent() {
    if (!selectedEventId) return
    window.location.href = `${API}/events/${selectedEventId}/export`
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeView={activeView}
        competencyCount={competencies.length}
        eventCount={events.length}
        methodCount={methods.length}
        rosterCount={rosters.length}
        runCount={assessmentRuns.length}
        variableCount={variables.length}
        onViewChange={setActiveView}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-heading text-base font-medium">
              {viewTitle(activeView)}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Build assessments from events, methods, variables, and competencies.
            </p>
          </div>
          {activeView === "event" && selectedEvent ? (
            <Button onClick={exportEvent}>
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          ) : null}
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          {message ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {message}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Loading workspace data...
            </div>
          ) : null}
          {activeView === "dashboard" ? (
            <DashboardScreen
              assessments={assessments}
              events={events}
              methods={methods}
              variables={variables}
              onDeleteEvent={deleteEvent}
              onNewEvent={() => setActiveView("event")}
              onOpenEvent={openEvent}
            />
          ) : null}
          {activeView === "assessment" ? (
            <AssessmentScreen
              assessmentForm={assessmentForm}
              assessments={assessments}
              onAssessmentFormChange={setAssessmentForm}
              onCreateAssessment={createAssessment}
              onDeleteAssessment={deleteAssessment}
            />
          ) : null}
          {activeView === "event" ? (
            <EventScreen
              assessments={assessments}
              eventForm={eventForm}
              events={events}
              methods={methods}
              selectedEvent={selectedEvent}
              selectedEventMethods={selectedEventMethods}
              onAddMethodToDraft={addMethodToDraft}
              onCreateEvent={createEvent}
              onDeleteEvent={deleteEvent}
              onEventFormChange={setEventForm}
              onExportEvent={exportEvent}
              onOpenEvent={openEvent}
              onRemoveMethodFromDraft={removeMethodFromDraft}
            />
          ) : null}
          {activeView === "methods" ? (
            <MethodsScreen
              competencies={competencies}
              editingMethodId={editingMethodId}
              methodForm={methodForm}
              methods={methods}
              variables={variables}
              onCancelMethodEdit={cancelMethodEdit}
              onDeleteMethod={deleteMethod}
              onEditMethod={editMethod}
              onMethodFormChange={setMethodForm}
              onSaveMethod={saveMethod}
              onToggleCompetencyForMethod={toggleCompetencyForMethod}
            />
          ) : null}
          {activeView === "competencies" ? (
            <CompetenciesScreen
              competencies={competencies}
              competencyForm={competencyForm}
              editingCompetencyId={editingCompetencyId}
              onCancelCompetencyEdit={cancelCompetencyEdit}
              onCompetencyFormChange={setCompetencyForm}
              onDeleteCompetency={deleteCompetency}
              onEditCompetency={editCompetency}
              onSaveCompetency={saveCompetency}
            />
          ) : null}
          {activeView === "variables" ? (
            <VariablesScreen
              editingVariableId={editingVariableId}
              variableForm={variableForm}
              variables={variables}
              onCancelVariableEdit={cancelVariableEdit}
              onDeleteVariable={deleteVariable}
              onEditVariable={editVariable}
              onSaveVariable={saveVariable}
              onVariableFormChange={setVariableForm}
            />
          ) : null}
          {activeView === "rosters" ? (
            <RostersScreen
              candidateForm={candidateForm}
              candidates={candidates}
              rosterForm={rosterForm}
              rosters={rosters}
              selectedRoster={selectedRoster}
              onAddCandidateToRoster={addCandidateToRoster}
              onCandidateFormChange={setCandidateForm}
              onCreateCandidate={createCandidate}
              onCreateRoster={createRoster}
              onDeleteCandidate={deleteCandidate}
              onDeleteRoster={deleteRoster}
              onRemoveCandidateFromRoster={removeCandidateFromRoster}
              onRosterFormChange={setRosterForm}
              onSelectRoster={setSelectedRosterId}
            />
          ) : null}
          {activeView === "assessment-runs" ? (
            <AssessmentRunsScreen
              assessmentRuns={assessmentRuns}
              assessments={assessments}
              runForm={runForm}
              runGrid={runGrid}
              runSummary={runSummary}
              runTaskList={runTaskList}
              rosters={rosters}
              selectedRun={selectedRun}
              selectedRunEventId={selectedRunEventId}
              resultDrafts={resultDrafts}
              onAddObservation={addRunMethodObservation}
              onCreateRun={createAssessmentRun}
              onMoveRunMethod={moveRunMethod}
              onOpenRun={openAssessmentRun}
              onOpenRunEvent={openRunEvent}
              onRunFormChange={setRunForm}
              onSaveResults={saveResultDrafts}
              onTransitionRun={transitionAssessmentRun}
              onUpdateResultDraft={updateResultDraft}
            />
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function viewTitle(view: AppView) {
  if (view === "assessment") return "Assessment editor"
  if (view === "event") return "Event editor"
  if (view === "methods") return "Method library"
  if (view === "competencies") return "Competencies"
  if (view === "variables") return "Variables"
  if (view === "rosters") return "Rosters"
  if (view === "assessment-runs") return "Assessment runs"
  return "Dashboard"
}

function buildCriteria(form: MethodForm, variable?: Variable) {
  const criteria: MethodCriteria = {}
  const rawValue = form.criteriaValue.trim()

  if (form.aggregationType !== "none") {
    criteria.aggregation = {
      type: form.aggregationType,
    }
  }

  if (rawValue) {
    const parsedValue = parseCriteriaValue(rawValue, variable)
    criteria.pass = {
      operator: form.criteriaOperator,
      value: parsedValue,
    }
  }

  return criteria
}

function parseCriteriaValue(value: string, variable?: Variable) {
  if (variable?.unit === "seconds") {
    const timeMatch = value.match(/^(\d+):([0-5]\d)$/)
    if (timeMatch) {
      return Number(timeMatch[1]) * 60 + Number(timeMatch[2])
    }
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : value
}

function formatCriteriaValue(value: number | string, variable?: Variable) {
  if (variable?.unit === "seconds" && typeof value === "number") {
    const minutes = Math.floor(value / 60)
    const seconds = String(value % 60).padStart(2, "0")
    return `${minutes}:${seconds}`
  }

  return String(value)
}

function buildVariableDomain(form: VariableForm): VariableDomain {
  const domain: VariableDomain = {}
  const min = parseOptionalNumber(form.rangeMin)
  const max = parseOptionalNumber(form.rangeMax)
  const step = parseOptionalNumber(form.rangeStep)
  const options = form.options
    .split(/\n|,/)
    .map((option) => option.trim())
    .filter(Boolean)

  if (min !== undefined || max !== undefined || step !== undefined) {
    domain.range = {}
    if (min !== undefined) domain.range.min = min
    if (max !== undefined) domain.range.max = max
    if (step !== undefined) domain.range.step = step
  }

  if (options.length > 0) {
    domain.options = options
  }

  return domain
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function getAggregationType(criteria: MethodCriteria) {
  return criteria.aggregation?.type ?? "none"
}

function getCriteriaUnitLabel(variable?: Variable) {
  if (!variable) return "value"
  return variable.unit
}

function getCriteriaPlaceholder(variable?: Variable) {
  if (variable?.unit === "seconds") return "12:30"
  return "10"
}

function getUnitsForScale(scale: VariableScale) {
  return unitsByScale[scale] as readonly VariableUnit[]
}

function shouldShowVariableRange(form: VariableForm) {
  return (
    form.scale === "ordinal" ||
    form.scale === "interval" ||
    form.scale === "ratio" ||
    (form.scale === "discrete" && form.unit !== "text")
  )
}

function shouldShowVariableOptions(form: VariableForm) {
  return (
    (form.scale === "nominal" && form.unit !== "boolean") ||
    form.scale === "discrete"
  )
}

function formatVariableDomain(domain: VariableDomain) {
  const parts: string[] = []

  if (domain.range) {
    const min = domain.range.min ?? ""
    const max = domain.range.max ?? ""
    const step = domain.range.step
    parts.push(
      `range [${min}, ${max}]${step !== undefined ? ` step ${step}` : ""}`
    )
  }

  if (domain.options?.length) {
    parts.push(`options: ${domain.options.join(", ")}`)
  }

  return parts.join("; ") || "No domain"
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not set"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function DashboardScreen({
  assessments,
  events,
  methods,
  variables,
  onDeleteEvent,
  onNewEvent,
  onOpenEvent,
}: {
  assessments: Assessment[]
  events: EventRecord[]
  methods: Method[]
  variables: Variable[]
  onDeleteEvent: (eventId: number) => void
  onNewEvent: () => void
  onOpenEvent: (eventId: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Events" value={events.length} />
        <SummaryCard label="Assessments" value={assessments.length} />
        <SummaryCard label="Methods" value={methods.length} />
        <SummaryCard label="Variables" value={variables.length} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Draft events created in this workspace session.
          </CardDescription>
          <CardAction>
            <Button onClick={onNewEvent}>
              <PlusIcon data-icon="inline-start" />
              New event
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Methods</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No events yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const assessment = assessments.find(
                    (item) => item.id === event.assessment_id
                  )

                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.name}
                      </TableCell>
                      <TableCell>
                        {assessment?.name ?? `#${event.assessment_id}`}
                      </TableCell>
                      <TableCell>{event.methodIds.length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{event.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenEvent(event.id)}
                          >
                            Open
                            <ArrowRightIcon data-icon="inline-end" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteEvent(event.id)}
                          >
                            <Trash2Icon data-icon="inline-start" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">Current session</div>
      </CardContent>
    </Card>
  )
}

function AssessmentScreen({
  assessmentForm,
  assessments,
  onAssessmentFormChange,
  onCreateAssessment,
  onDeleteAssessment,
}: {
  assessmentForm: AssessmentForm
  assessments: Assessment[]
  onAssessmentFormChange: (form: AssessmentForm) => void
  onCreateAssessment: (event: FormEvent<HTMLFormElement>) => void
  onDeleteAssessment: (assessmentId: number) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card>
        <form onSubmit={onCreateAssessment}>
          <CardHeader>
            <CardTitle>Assessment editor</CardTitle>
            <CardDescription>
              Create the parent assessment that events belong to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="assessment-name">Name</FieldLabel>
                <Input
                  id="assessment-name"
                  value={assessmentForm.name}
                  onChange={(event) =>
                    onAssessmentFormChange({
                      ...assessmentForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Candidate fitness assessment"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="assessment-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="assessment-description"
                  value={assessmentForm.description}
                  onChange={(event) =>
                    onAssessmentFormChange({
                      ...assessmentForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="What this assessment is used for"
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit">
              <SaveIcon data-icon="inline-start" />
              Save assessment
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
          <CardDescription>Available assessment records.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No assessments yet.
                  </TableCell>
                </TableRow>
              ) : (
                assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">
                      {assessment.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {assessment.description || "No description"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteAssessment(assessment.id)}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function EventScreen({
  assessments,
  eventForm,
  events,
  methods,
  selectedEvent,
  selectedEventMethods,
  onAddMethodToDraft,
  onCreateEvent,
  onDeleteEvent,
  onEventFormChange,
  onExportEvent,
  onOpenEvent,
  onRemoveMethodFromDraft,
}: {
  assessments: Assessment[]
  eventForm: EventForm
  events: EventRecord[]
  methods: Method[]
  selectedEvent: EventRecord | undefined
  selectedEventMethods: Method[]
  onAddMethodToDraft: (methodId: number) => void
  onCreateEvent: (event: FormEvent<HTMLFormElement>) => void
  onDeleteEvent: (eventId: number) => void
  onEventFormChange: (form: EventForm) => void
  onExportEvent: () => void
  onOpenEvent: (eventId: number) => void
  onRemoveMethodFromDraft: (methodId: number) => void
}) {
  const draftMethods = methods.filter((method) =>
    eventForm.methodIds.includes(method.id)
  )
  const availableMethods = methods.filter(
    (method) => !eventForm.methodIds.includes(method.id)
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <div className="flex flex-col gap-6">
        <Card>
          <form onSubmit={onCreateEvent}>
            <CardHeader>
              <CardTitle>Event editor</CardTitle>
              <CardDescription>
                Create an event and attach methods before saving.
              </CardDescription>
              {selectedEvent ? (
                <CardAction>
                  <Button type="button" onClick={onExportEvent}>
                    <DownloadIcon data-icon="inline-start" />
                    Export
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="event-assessment">
                    Assessment
                  </FieldLabel>
                  <NativeSelect
                    id="event-assessment"
                    className="w-full"
                    value={eventForm.assessmentId}
                    onChange={(event) =>
                      onEventFormChange({
                        ...eventForm,
                        assessmentId: event.target.value,
                      })
                    }
                  >
                    <NativeSelectOption value="">
                      Select assessment
                    </NativeSelectOption>
                    {assessments.map((assessment) => (
                      <NativeSelectOption
                        key={assessment.id}
                        value={String(assessment.id)}
                      >
                        {assessment.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-name">Event name</FieldLabel>
                  <Input
                    id="event-name"
                    value={eventForm.name}
                    onChange={(event) =>
                      onEventFormChange({
                        ...eventForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="June selection event"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-scheduled-at">
                    Scheduled time
                  </FieldLabel>
                  <Input
                    id="event-scheduled-at"
                    type="datetime-local"
                    value={eventForm.scheduledAt}
                    onChange={(event) =>
                      onEventFormChange({
                        ...eventForm,
                        scheduledAt: event.target.value,
                      })
                    }
                  />
                </Field>
                <FieldSet>
                  <FieldLegend>Draft methods</FieldLegend>
                  <FieldDescription>
                    Methods are saved to the event through EventMethod rows.
                  </FieldDescription>
                  <div className="flex flex-col gap-2">
                    {draftMethods.length === 0 ? (
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        No methods added.
                      </div>
                    ) : (
                      draftMethods.map((method) => (
                        <div
                          key={method.id}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {method.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getAggregationType(method.criteria)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveMethodFromDraft(method.id)}
                          >
                            <XIcon data-icon="inline-start" />
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableMethods.map((method) => (
                      <Button
                        key={method.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddMethodToDraft(method.id)}
                      >
                        <PlusIcon data-icon="inline-start" />
                        {method.name}
                      </Button>
                    ))}
                  </div>
                </FieldSet>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={assessments.length === 0}>
                <SaveIcon data-icon="inline-start" />
                Save event
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Selected event</CardTitle>
            <CardDescription>
              Export appears here after an event is saved.
            </CardDescription>
            {selectedEvent ? (
              <CardAction>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onExportEvent}>
                    <DownloadIcon data-icon="inline-start" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onDeleteEvent(selectedEvent.id)}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Delete
                  </Button>
                </div>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {selectedEvent ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {selectedEvent.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Event #{selectedEvent.id}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Scheduled {formatTimestamp(selectedEvent.scheduled_at)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEventMethods.length === 0 ? (
                    <Badge variant="outline">No methods</Badge>
                  ) : (
                    selectedEventMethods.map((method) => (
                      <Badge key={method.id} variant="secondary">
                        {method.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                Save or open an event to export it.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Open another saved event.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {events.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                  No events saved.
                </div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex gap-2">
                    <Button
                      variant={event.id === selectedEvent?.id ? "secondary" : "outline"}
                      onClick={() => onOpenEvent(event.id)}
                      className="flex-1 justify-start"
                    >
                      {event.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${event.name}`}
                      onClick={() => onDeleteEvent(event.id)}
                    >
                      <Trash2Icon data-icon="icon" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MethodsScreen({
  competencies,
  editingMethodId,
  methodForm,
  methods,
  variables,
  onCancelMethodEdit,
  onDeleteMethod,
  onEditMethod,
  onMethodFormChange,
  onSaveMethod,
  onToggleCompetencyForMethod,
}: {
  competencies: Competency[]
  editingMethodId: number | null
  methodForm: MethodForm
  methods: Method[]
  variables: Variable[]
  onCancelMethodEdit: () => void
  onDeleteMethod: (methodId: number) => void
  onEditMethod: (method: Method) => void
  onMethodFormChange: (form: MethodForm) => void
  onSaveMethod: (event: FormEvent<HTMLFormElement>) => void
  onToggleCompetencyForMethod: (competencyId: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-5xl">
        <MethodEditor
          competencies={competencies}
          editingMethodId={editingMethodId}
          methodForm={methodForm}
          methods={methods}
          variables={variables}
          onCancelMethodEdit={onCancelMethodEdit}
          onMethodFormChange={onMethodFormChange}
          onSaveMethod={onSaveMethod}
          onToggleCompetencyForMethod={onToggleCompetencyForMethod}
        />
      </div>
      <MethodTable
        competencies={competencies}
        methods={methods}
        variables={variables}
        onDeleteMethod={onDeleteMethod}
        onEditMethod={onEditMethod}
      />
    </div>
  )
}

function CompetenciesScreen({
  competencies,
  competencyForm,
  editingCompetencyId,
  onCancelCompetencyEdit,
  onCompetencyFormChange,
  onDeleteCompetency,
  onEditCompetency,
  onSaveCompetency,
}: {
  competencies: Competency[]
  competencyForm: CompetencyForm
  editingCompetencyId: number | null
  onCancelCompetencyEdit: () => void
  onCompetencyFormChange: (form: CompetencyForm) => void
  onDeleteCompetency: (competencyId: number) => void
  onEditCompetency: (competency: Competency) => void
  onSaveCompetency: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
      <CompetencyEditor
        competencyForm={competencyForm}
        editingCompetencyId={editingCompetencyId}
        onCancelCompetencyEdit={onCancelCompetencyEdit}
        onCompetencyFormChange={onCompetencyFormChange}
        onSaveCompetency={onSaveCompetency}
      />
      <CompetencyTable
        competencies={competencies}
        onDeleteCompetency={onDeleteCompetency}
        onEditCompetency={onEditCompetency}
      />
    </div>
  )
}

function VariablesScreen({
  editingVariableId,
  variableForm,
  variables,
  onCancelVariableEdit,
  onDeleteVariable,
  onEditVariable,
  onSaveVariable,
  onVariableFormChange,
}: {
  editingVariableId: number | null
  variableForm: VariableForm
  variables: Variable[]
  onCancelVariableEdit: () => void
  onDeleteVariable: (variableId: number) => void
  onEditVariable: (variable: Variable) => void
  onSaveVariable: (event: FormEvent<HTMLFormElement>) => void
  onVariableFormChange: (form: VariableForm) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
      <VariableEditor
        editingVariableId={editingVariableId}
        variableForm={variableForm}
        onCancelVariableEdit={onCancelVariableEdit}
        onSaveVariable={onSaveVariable}
        onVariableFormChange={onVariableFormChange}
      />
      <VariableTable
        variables={variables}
        onDeleteVariable={onDeleteVariable}
        onEditVariable={onEditVariable}
      />
    </div>
  )
}

function RostersScreen({
  candidateForm,
  candidates,
  rosterForm,
  rosters,
  selectedRoster,
  onAddCandidateToRoster,
  onCandidateFormChange,
  onCreateCandidate,
  onCreateRoster,
  onDeleteCandidate,
  onDeleteRoster,
  onRemoveCandidateFromRoster,
  onRosterFormChange,
  onSelectRoster,
}: {
  candidateForm: CandidateForm
  candidates: Candidate[]
  rosterForm: RosterForm
  rosters: Roster[]
  selectedRoster: Roster | undefined
  onAddCandidateToRoster: (candidateId: number) => void
  onCandidateFormChange: (form: CandidateForm) => void
  onCreateCandidate: (event: FormEvent<HTMLFormElement>) => void
  onCreateRoster: (event: FormEvent<HTMLFormElement>) => void
  onDeleteCandidate: (candidateId: number) => void
  onDeleteRoster: (rosterId: number) => void
  onRemoveCandidateFromRoster: (candidateId: number) => void
  onRosterFormChange: (form: RosterForm) => void
  onSelectRoster: (rosterId: number) => void
}) {
  const selectedCandidateIds = new Set(selectedRoster?.candidate_ids ?? [])
  const selectedCandidates = candidates.filter((candidate) =>
    selectedCandidateIds.has(candidate.id)
  )
  const availableCandidates = candidates.filter(
    (candidate) => !selectedCandidateIds.has(candidate.id)
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <form onSubmit={onCreateRoster}>
            <CardHeader>
              <CardTitle>Create roster</CardTitle>
              <CardDescription>
                A roster is the candidate list for an assessment run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="roster-name">Name</FieldLabel>
                  <Input
                    id="roster-name"
                    value={rosterForm.name}
                    onChange={(event) =>
                      onRosterFormChange({
                        ...rosterForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="June cohort"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="roster-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="roster-description"
                    value={rosterForm.description}
                    onChange={(event) =>
                      onRosterFormChange({
                        ...rosterForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Who is included in this roster"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit">
                <PlusIcon data-icon="inline-start" />
                Create roster
              </Button>
            </CardFooter>
          </form>
        </Card>
        <Card>
          <form onSubmit={onCreateCandidate}>
            <CardHeader>
              <CardTitle>Create candidate</CardTitle>
              <CardDescription>
                Candidate MVP identity is a display name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="candidate-display-name">
                    Display name
                  </FieldLabel>
                  <Input
                    id="candidate-display-name"
                    value={candidateForm.displayName}
                    onChange={(event) =>
                      onCandidateFormChange({
                        displayName: event.target.value,
                      })
                    }
                    placeholder="Candidate 001"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit">
                <PlusIcon data-icon="inline-start" />
                Create candidate
              </Button>
            </CardFooter>
          </form>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CSV import</CardTitle>
            <CardDescription>
              Bulk roster imports will be added later.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button type="button" variant="outline" disabled>
              <UploadIcon data-icon="inline-start" />
              Coming soon
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rosters</CardTitle>
            <CardDescription>Select a roster to manage candidates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {rosters.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                  No rosters yet.
                </div>
              ) : (
                rosters.map((roster) => (
                  <div key={roster.id} className="flex gap-2">
                    <Button
                      type="button"
                      variant={roster.id === selectedRoster?.id ? "secondary" : "outline"}
                      className="flex-1 justify-start"
                      onClick={() => onSelectRoster(roster.id)}
                    >
                      {roster.name}
                      <Badge variant="outline">{roster.candidate_ids.length}</Badge>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${roster.name}`}
                      onClick={() => onDeleteRoster(roster.id)}
                    >
                      <Trash2Icon data-icon="icon" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{selectedRoster?.name ?? "Roster candidates"}</CardTitle>
            <CardDescription>
              Add or remove candidates from the selected roster.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {availableCandidates.length === 0 ? (
                  <Badge variant="outline">No available candidates</Badge>
                ) : (
                  availableCandidates.map((candidate) => (
                    <Button
                      key={candidate.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedRoster}
                      onClick={() => onAddCandidateToRoster(candidate.id)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {candidate.display_name}
                    </Button>
                  ))
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCandidates.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No candidates in this roster.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          {candidate.display_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveCandidateFromRoster(candidate.id)}
                          >
                            <XIcon data-icon="inline-start" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Candidate library</CardTitle>
            <CardDescription>All candidate records.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No candidates yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">
                        {candidate.display_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteCandidate(candidate.id)}
                        >
                          <Trash2Icon data-icon="inline-start" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AssessmentRunsScreen({
  assessmentRuns,
  assessments,
  runForm,
  runGrid,
  runSummary,
  runTaskList,
  rosters,
  selectedRun,
  selectedRunEventId,
  resultDrafts,
  onAddObservation,
  onCreateRun,
  onMoveRunMethod,
  onOpenRun,
  onOpenRunEvent,
  onRunFormChange,
  onSaveResults,
  onTransitionRun,
  onUpdateResultDraft,
}: {
  assessmentRuns: AssessmentRun[]
  assessments: Assessment[]
  runForm: RunForm
  runGrid: RunGrid | null
  runSummary: RunSummary | null
  runTaskList: RunTaskList | null
  rosters: Roster[]
  selectedRun: AssessmentRun | undefined
  selectedRunEventId: number | null
  resultDrafts: Record<string, string>
  onAddObservation: (runMethodId: number) => void
  onCreateRun: (event: FormEvent<HTMLFormElement>) => void
  onMoveRunMethod: (runMethodId: number, direction: -1 | 1) => void
  onOpenRun: (runId: number) => void
  onOpenRunEvent: (runEventId: number) => void
  onRunFormChange: (form: RunForm) => void
  onSaveResults: () => void
  onTransitionRun: (action: "start" | "pause" | "resume" | "complete") => void
  onUpdateResultDraft: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
        <Card>
          <form onSubmit={onCreateRun}>
            <CardHeader>
              <CardTitle>Create assessment run</CardTitle>
              <CardDescription>
                Select an assessment and roster to snapshot for administration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="run-assessment">Assessment</FieldLabel>
                  <NativeSelect
                    id="run-assessment"
                    className="w-full"
                    value={runForm.assessmentId}
                    onChange={(event) =>
                      onRunFormChange({
                        ...runForm,
                        assessmentId: event.target.value,
                      })
                    }
                  >
                    <NativeSelectOption value="">Select assessment</NativeSelectOption>
                    {assessments.map((assessment) => (
                      <NativeSelectOption
                        key={assessment.id}
                        value={String(assessment.id)}
                      >
                        {assessment.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="run-roster">Roster</FieldLabel>
                  <NativeSelect
                    id="run-roster"
                    className="w-full"
                    value={runForm.rosterId}
                    onChange={(event) =>
                      onRunFormChange({
                        ...runForm,
                        rosterId: event.target.value,
                      })
                    }
                  >
                    <NativeSelectOption value="">Select roster</NativeSelectOption>
                    {rosters.map((roster) => (
                      <NativeSelectOption key={roster.id} value={String(roster.id)}>
                        {roster.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit">
                <PlayIcon data-icon="inline-start" />
                Create run
              </Button>
            </CardFooter>
          </form>
        </Card>
        <AssessmentRunList
          assessmentRuns={assessmentRuns}
          assessments={assessments}
          rosters={rosters}
          selectedRun={selectedRun}
          onOpenRun={onOpenRun}
        />
      </div>
      {selectedRun ? (
        <RunDashboard
          runGrid={runGrid}
          runSummary={runSummary}
          runTaskList={runTaskList}
          selectedRun={selectedRun}
          selectedRunEventId={selectedRunEventId}
          resultDrafts={resultDrafts}
          onAddObservation={onAddObservation}
          onMoveRunMethod={onMoveRunMethod}
          onOpenRunEvent={onOpenRunEvent}
          onSaveResults={onSaveResults}
          onTransitionRun={onTransitionRun}
          onUpdateResultDraft={onUpdateResultDraft}
        />
      ) : null}
    </div>
  )
}

function AssessmentRunList({
  assessmentRuns,
  assessments,
  rosters,
  selectedRun,
  onOpenRun,
}: {
  assessmentRuns: AssessmentRun[]
  assessments: Assessment[]
  rosters: Roster[]
  selectedRun: AssessmentRun | undefined
  onOpenRun: (runId: number) => void
}) {
  const runs = [...assessmentRuns].sort((a, b) => b.id - a.id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runs</CardTitle>
        <CardDescription>Open and administer saved runs.</CardDescription>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
            No run selected.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {runs.map((run) => {
              const assessment = assessments.find((item) => item.id === run.assessment_id)
              const roster = rosters.find((item) => item.id === run.roster_id)
              return (
                <Button
                  key={run.id}
                  type="button"
                  variant={run.id === selectedRun?.id ? "secondary" : "outline"}
                  className="justify-start"
                  onClick={() => onOpenRun(run.id)}
                >
                  <span className="truncate">
                    {assessment?.name ?? `Assessment #${run.assessment_id}`}
                  </span>
                  <Badge variant="outline">{run.status}</Badge>
                  <span className="text-muted-foreground">
                    {roster?.name ?? `Roster #${run.roster_id}`}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatTimestamp(run.created_at)}
                  </span>
                </Button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RunDashboard({
  runGrid,
  runSummary,
  runTaskList,
  selectedRun,
  selectedRunEventId,
  resultDrafts,
  onAddObservation,
  onMoveRunMethod,
  onOpenRunEvent,
  onSaveResults,
  onTransitionRun,
  onUpdateResultDraft,
}: {
  runGrid: RunGrid | null
  runSummary: RunSummary | null
  runTaskList: RunTaskList | null
  selectedRun: AssessmentRun
  selectedRunEventId: number | null
  resultDrafts: Record<string, string>
  onAddObservation: (runMethodId: number) => void
  onMoveRunMethod: (runMethodId: number, direction: -1 | 1) => void
  onOpenRunEvent: (runEventId: number) => void
  onSaveResults: () => void
  onTransitionRun: (action: "start" | "pause" | "resume" | "complete") => void
  onUpdateResultDraft: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Run controls</CardTitle>
          <CardDescription>
            Start, pause, resume, or complete the live assessment run.
          </CardDescription>
          <CardAction>
            <RunActions run={selectedRun} onTransitionRun={onTransitionRun} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Created</div>
              <div className="font-medium">{formatTimestamp(selectedRun.created_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Started</div>
              <div className="font-medium">{formatTimestamp(selectedRun.started_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Paused</div>
              <div className="font-medium">{formatTimestamp(selectedRun.paused_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Completed</div>
              <div className="font-medium">{formatTimestamp(selectedRun.completed_at)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Completion"
          value={`${runSummary?.completion.percent ?? 0}%`}
        />
        <SummaryCard
          label="Required entries"
          value={runSummary?.completion.total ?? 0}
        />
        <SummaryCard
          label="Valid results"
          value={runSummary?.numeric.count ?? 0}
        />
        <SummaryCard
          label="Average"
          value={runSummary?.numeric.average?.toFixed(2) ?? "n/a"}
        />
        <SummaryCard label="Pass" value={runSummary?.pass_fail.pass ?? 0} />
        <SummaryCard label="Fail" value={runSummary?.pass_fail.fail ?? 0} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <RunTaskListPanel
          runTaskList={runTaskList}
          selectedRunEventId={selectedRunEventId}
          onOpenRunEvent={onOpenRunEvent}
        />
        <RunGridPanel
          resultDrafts={resultDrafts}
          run={selectedRun}
          runGrid={runGrid}
          onAddObservation={onAddObservation}
          onMoveRunMethod={onMoveRunMethod}
          onSaveResults={onSaveResults}
          onUpdateResultDraft={onUpdateResultDraft}
        />
      </div>
    </div>
  )
}

function RunActions({
  run,
  onTransitionRun,
}: {
  run: AssessmentRun
  onTransitionRun: (action: "start" | "pause" | "resume" | "complete") => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {run.status === "draft" ? (
        <Button type="button" onClick={() => onTransitionRun("start")}>
          <PlayIcon data-icon="inline-start" />
          Start
        </Button>
      ) : null}
      {run.status === "active" ? (
        <Button type="button" variant="outline" onClick={() => onTransitionRun("pause")}>
          <PauseIcon data-icon="inline-start" />
          Pause
        </Button>
      ) : null}
      {run.status === "paused" ? (
        <Button type="button" onClick={() => onTransitionRun("resume")}>
          <RefreshCwIcon data-icon="inline-start" />
          Resume
        </Button>
      ) : null}
      {run.status === "active" || run.status === "paused" ? (
        <Button type="button" variant="outline" onClick={() => onTransitionRun("complete")}>
          <CheckCircle2Icon data-icon="inline-start" />
          Complete
        </Button>
      ) : null}
      <Badge variant="secondary">{run.status}</Badge>
    </div>
  )
}

function RunTaskListPanel({
  runTaskList,
  selectedRunEventId,
  onOpenRunEvent,
}: {
  runTaskList: RunTaskList | null
  selectedRunEventId: number | null
  onOpenRunEvent: (runEventId: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Task list</CardTitle>
        <CardDescription>Events and methods for this run.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {!runTaskList || runTaskList.events.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
              No events in this run.
            </div>
          ) : (
            runTaskList.events.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <Button
                  type="button"
                  variant={event.id === selectedRunEventId ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => onOpenRunEvent(event.id)}
                >
                  {event.status === "completed" ? (
                    <CheckCircle2Icon data-icon="inline-start" />
                  ) : null}
                  <span className="truncate">{event.name}</span>
                  <Badge variant="outline">{event.status}</Badge>
                </Button>
                <div className="flex flex-col gap-1 pl-3">
                  {event.methods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                    >
                      <span className="truncate">
                        {method.parent_run_method_id ? "- " : ""}
                        {method.name}
                      </span>
                      <Badge variant={method.is_entry_enabled ? "secondary" : "outline"}>
                        {method.is_entry_enabled ? "entry" : "read-only"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RunGridPanel({
  resultDrafts,
  run,
  runGrid,
  onAddObservation,
  onMoveRunMethod,
  onSaveResults,
  onUpdateResultDraft,
}: {
  resultDrafts: Record<string, string>
  run: AssessmentRun
  runGrid: RunGrid | null
  onAddObservation: (runMethodId: number) => void
  onMoveRunMethod: (runMethodId: number, direction: -1 | 1) => void
  onSaveResults: () => void
  onUpdateResultDraft: (key: string, value: string) => void
}) {
  if (!runGrid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scoring grid</CardTitle>
          <CardDescription>Select an event to enter results.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const canEdit = run.status === "active"
  const methodColumns = runGrid.methods.flatMap((method) => {
    if (!method.is_entry_enabled) {
      return [{ method, observationIndex: 0, readOnly: true }]
    }

    return Array.from({ length: method.observation_count }, (_, observationIndex) => ({
      method,
      observationIndex,
      readOnly: false,
    }))
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{runGrid.run_event.name}</CardTitle>
        <CardDescription>
          Candidates are rows. Editable leaf methods are columns.
        </CardDescription>
        <CardAction>
          <Button type="button" onClick={onSaveResults} disabled={!canEdit}>
            <SaveIcon data-icon="inline-start" />
            Save results
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                {methodColumns.map(({ method, observationIndex, readOnly }) => (
                  <TableHead key={`${method.id}-${observationIndex}-${readOnly}`}>
                    <div className="flex min-w-40 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{method.name}</span>
                        <Badge variant={method.is_entry_enabled ? "secondary" : "outline"}>
                          {readOnly ? "aggregate" : `obs ${observationIndex + 1}`}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveRunMethod(method.id, -1)}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveRunMethod(method.id, 1)}
                        >
                          Down
                        </Button>
                        {method.is_entry_enabled && observationIndex === method.observation_count - 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canEdit}
                            onClick={() => onAddObservation(method.id)}
                          >
                            <PlusIcon data-icon="inline-start" />
                            Obs
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {runGrid.candidates.map((candidate) => (
                <TableRow key={candidate.id}>
                  <TableCell className="font-medium">
                    {candidate.display_name}
                  </TableCell>
                  {methodColumns.map(({ method, observationIndex, readOnly }) => (
                    <TableCell key={`${candidate.id}-${method.id}-${observationIndex}`}>
                      {readOnly ? (
                        <Badge variant="outline">Read-only</Badge>
                      ) : (
                        <RunResultInput
                          candidate={candidate}
                          method={method}
                          observationIndex={observationIndex}
                          resultDrafts={resultDrafts}
                          results={runGrid.results}
                          disabled={!canEdit}
                          onUpdateResultDraft={onUpdateResultDraft}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {run.status !== "active" ? (
          <div className="pt-3 text-sm text-muted-foreground">
            Result edits are available only while the run is active.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RunResultInput({
  candidate,
  disabled,
  method,
  observationIndex,
  resultDrafts,
  results,
  onUpdateResultDraft,
}: {
  candidate: Candidate
  disabled: boolean
  method: RunMethod
  observationIndex: number
  resultDrafts: Record<string, string>
  results: RunResult[]
  onUpdateResultDraft: (key: string, value: string) => void
}) {
  const key = resultKey(method.id, candidate.id, observationIndex)
  const existingResult = results.find(
    (result) =>
      result.assessment_run_method_id === method.id &&
      result.candidate_id === candidate.id &&
      result.observation_index === observationIndex
  )
  const value = resultDrafts[key] ?? existingResult?.value_display ?? ""
  const variable = method.variable
  const options = variable?.domain.options ?? []

  if (variable?.unit === "boolean") {
    return (
      <NativeSelect
        className="w-full min-w-28"
        value={value}
        disabled={disabled}
        onChange={(event) => onUpdateResultDraft(key, event.target.value)}
      >
        <NativeSelectOption value="">Select</NativeSelectOption>
        <NativeSelectOption value="true">true</NativeSelectOption>
        <NativeSelectOption value="false">false</NativeSelectOption>
      </NativeSelect>
    )
  }

  if (options.length > 0) {
    return (
      <NativeSelect
        className="w-full min-w-36"
        value={value}
        disabled={disabled}
        onChange={(event) => onUpdateResultDraft(key, event.target.value)}
      >
        <NativeSelectOption value="">Select</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    )
  }

  return (
    <InputGroup className="min-w-36">
      <InputGroupInput
        value={value}
        disabled={disabled}
        placeholder={variable?.unit === "seconds" ? "12:30" : "value"}
        onChange={(event) => onUpdateResultDraft(key, event.target.value)}
      />
      <InputGroupAddon align="inline-end">
        {variable?.unit ?? "value"}
      </InputGroupAddon>
    </InputGroup>
  )
}

function resultKey(runMethodId: number, candidateId: number, observationIndex: number) {
  return `${runMethodId}:${candidateId}:${observationIndex}`
}

function VariableEditor({
  editingVariableId,
  onCancelVariableEdit,
  onSaveVariable,
  variableForm,
  onVariableFormChange,
}: {
  editingVariableId: number | null
  onCancelVariableEdit: () => void
  onSaveVariable: (event: FormEvent<HTMLFormElement>) => void
  variableForm: VariableForm
  onVariableFormChange: (form: VariableForm) => void
}) {
  const allowedUnits = getUnitsForScale(variableForm.scale)

  return (
    <Card>
      <form onSubmit={onSaveVariable}>
        <CardHeader>
          <CardTitle>
            {editingVariableId ? "Edit variable" : "Create variable"}
          </CardTitle>
          <CardDescription>
            Define the value a method produces.
          </CardDescription>
          {editingVariableId ? (
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelVariableEdit}
              >
                <XIcon data-icon="inline-start" />
                Cancel
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="variable-name">Name</FieldLabel>
              <Input
                id="variable-name"
                value={variableForm.name}
                onChange={(event) =>
                  onVariableFormChange({
                    ...variableForm,
                    name: event.target.value,
                  })
                }
                placeholder="Elapsed time"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="variable-scale">Scale</FieldLabel>
                <NativeSelect
                  id="variable-scale"
                  className="w-full"
                  value={variableForm.scale}
                  onChange={(event) => {
                    const scale = event.target.value as VariableScale
                    const nextUnits = getUnitsForScale(scale)

                    onVariableFormChange({
                      ...variableForm,
                      scale,
                      unit: nextUnits.includes(variableForm.unit)
                        ? variableForm.unit
                        : nextUnits[0],
                    })
                  }}
                >
                  {variableScales.map((scale) => (
                    <NativeSelectOption key={scale} value={scale}>
                      {scale}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="variable-unit">Unit</FieldLabel>
                <NativeSelect
                  id="variable-unit"
                  className="w-full"
                  value={variableForm.unit}
                  onChange={(event) =>
                    onVariableFormChange({
                      ...variableForm,
                      unit: event.target.value as VariableUnit,
                    })
                  }
                >
                  {allowedUnits.map((unit) => (
                    <NativeSelectOption key={unit} value={unit}>
                      {unit}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {shouldShowVariableRange(variableForm) ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="variable-range-min">Range min</FieldLabel>
                  <Input
                    id="variable-range-min"
                    value={variableForm.rangeMin}
                    onChange={(event) =>
                      onVariableFormChange({
                        ...variableForm,
                        rangeMin: event.target.value,
                      })
                    }
                    placeholder="1"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="variable-range-max">Range max</FieldLabel>
                  <Input
                    id="variable-range-max"
                    value={variableForm.rangeMax}
                    onChange={(event) =>
                      onVariableFormChange({
                        ...variableForm,
                        rangeMax: event.target.value,
                      })
                    }
                    placeholder="7"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="variable-range-step">
                    Step
                  </FieldLabel>
                  <Input
                    id="variable-range-step"
                    value={variableForm.rangeStep}
                    onChange={(event) =>
                      onVariableFormChange({
                        ...variableForm,
                        rangeStep: event.target.value,
                      })
                    }
                    placeholder={variableForm.unit === "float" ? "0.1" : "1"}
                  />
                </Field>
              </div>
            ) : null}
            {shouldShowVariableOptions(variableForm) ? (
              <Field>
                <FieldLabel htmlFor="variable-options">Options</FieldLabel>
                <Textarea
                  id="variable-options"
                  value={variableForm.options}
                  onChange={(event) =>
                    onVariableFormChange({
                      ...variableForm,
                      options: event.target.value,
                    })
                  }
                  placeholder="yes, no, maybe"
                />
                <FieldDescription>
                  Enter values separated by commas or new lines.
                </FieldDescription>
              </Field>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit">
            {editingVariableId ? (
              <SaveIcon data-icon="inline-start" />
            ) : (
              <PlusIcon data-icon="inline-start" />
            )}
            {editingVariableId ? "Save variable" : "Create variable"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function CompetencyEditor({
  competencyForm,
  editingCompetencyId,
  onCancelCompetencyEdit,
  onCompetencyFormChange,
  onSaveCompetency,
}: {
  competencyForm: CompetencyForm
  editingCompetencyId: number | null
  onCancelCompetencyEdit: () => void
  onCompetencyFormChange: (form: CompetencyForm) => void
  onSaveCompetency: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Card>
      <form onSubmit={onSaveCompetency}>
        <CardHeader>
          <CardTitle>
            {editingCompetencyId ? "Edit competency" : "Create competency"}
          </CardTitle>
          <CardDescription>
            Define attributes measured by one or more methods.
          </CardDescription>
          {editingCompetencyId ? (
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelCompetencyEdit}
              >
                <XIcon data-icon="inline-start" />
                Cancel
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="competency-name">Name</FieldLabel>
              <Input
                id="competency-name"
                value={competencyForm.name}
                onChange={(event) =>
                  onCompetencyFormChange({
                    ...competencyForm,
                    name: event.target.value,
                  })
                }
                placeholder="Aerobic capacity"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="competency-description">
                Description
              </FieldLabel>
              <Textarea
                id="competency-description"
                value={competencyForm.description}
                onChange={(event) =>
                  onCompetencyFormChange({
                    ...competencyForm,
                    description: event.target.value,
                  })
                }
                placeholder="What this competency represents"
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit">
            {editingCompetencyId ? (
              <SaveIcon data-icon="inline-start" />
            ) : (
              <PlusIcon data-icon="inline-start" />
            )}
            {editingCompetencyId ? "Save competency" : "Create competency"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function MethodEditor({
  competencies,
  editingMethodId,
  methodForm,
  methods,
  variables,
  onCancelMethodEdit,
  onMethodFormChange,
  onSaveMethod,
  onToggleCompetencyForMethod,
}: {
  competencies: Competency[]
  editingMethodId: number | null
  methodForm: MethodForm
  methods: Method[]
  variables: Variable[]
  onCancelMethodEdit: () => void
  onMethodFormChange: (form: MethodForm) => void
  onSaveMethod: (event: FormEvent<HTMLFormElement>) => void
  onToggleCompetencyForMethod: (competencyId: number) => void
}) {
  const selectedVariable = variables.find(
    (variable) => variable.id === Number(methodForm.variableId)
  )
  const isRootMethod = !methodForm.parentId

  return (
    <Card>
      <form onSubmit={onSaveMethod}>
        <CardHeader>
          <CardTitle>
            {editingMethodId ? "Edit method" : "Create method"}
          </CardTitle>
          <CardDescription>
            Create a method and link it to variables and competencies.
          </CardDescription>
          {editingMethodId ? (
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelMethodEdit}
              >
                <XIcon data-icon="inline-start" />
                Cancel
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="method-name">Name</FieldLabel>
              <Input
                id="method-name"
                value={methodForm.name}
                onChange={(event) =>
                  onMethodFormChange({
                    ...methodForm,
                    name: event.target.value,
                  })
                }
                placeholder="1.5 mile run"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="method-description">
                Description
              </FieldLabel>
              <Textarea
                id="method-description"
                value={methodForm.description}
                onChange={(event) =>
                  onMethodFormChange({
                    ...methodForm,
                    description: event.target.value,
                  })
                }
                placeholder="How this method is administered"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="method-variable">Variable</FieldLabel>
                <NativeSelect
                  id="method-variable"
                  className="w-full"
                  value={methodForm.variableId}
                  onChange={(event) =>
                    onMethodFormChange({
                      ...methodForm,
                      variableId: event.target.value,
                    })
                  }
                >
                  <NativeSelectOption value="">No variable</NativeSelectOption>
                  {variables.map((variable) => (
                    <NativeSelectOption
                      key={variable.id}
                      value={String(variable.id)}
                    >
                      {variable.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="method-parent">Parent method</FieldLabel>
                <NativeSelect
                  id="method-parent"
                  className="w-full"
                  value={methodForm.parentId}
                  onChange={(event) =>
                    onMethodFormChange({
                      ...methodForm,
                      parentId: event.target.value,
                      aggregationType: event.target.value
                        ? "none"
                        : methodForm.aggregationType,
                    })
                  }
                >
                  <NativeSelectOption value="">No parent</NativeSelectOption>
                  {methods
                    .filter((method) => method.id !== editingMethodId)
                    .map((method) => (
                      <NativeSelectOption
                        key={method.id}
                        value={String(method.id)}
                      >
                        {method.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {isRootMethod ? (
                <Field>
                  <FieldLabel htmlFor="method-aggregation">
                    Aggregation
                  </FieldLabel>
                  <NativeSelect
                    id="method-aggregation"
                    className="w-full"
                    value={methodForm.aggregationType}
                    onChange={(event) =>
                      onMethodFormChange({
                        ...methodForm,
                        aggregationType: event.target.value as AggregationSelection,
                      })
                    }
                  >
                    {aggregationTypes.map((aggregationType) => (
                      <NativeSelectOption
                        key={aggregationType}
                        value={aggregationType}
                      >
                        {aggregationType}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    Available only for methods without a parent.
                  </FieldDescription>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="method-order">Display order</FieldLabel>
                <Input
                  id="method-order"
                  type="number"
                  value={methodForm.displayOrder}
                  onChange={(event) =>
                    onMethodFormChange({
                      ...methodForm,
                      displayOrder: event.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="method-required">Required</FieldLabel>
                <NativeSelect
                  id="method-required"
                  className="w-full"
                  value={methodForm.isRequired}
                  onChange={(event) =>
                    onMethodFormChange({
                      ...methodForm,
                      isRequired: event.target.value,
                    })
                  }
                >
                  <NativeSelectOption value="true">Required</NativeSelectOption>
                  <NativeSelectOption value="false">Optional</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <Field>
                <FieldLabel htmlFor="method-criteria-operator">
                  Criteria
                </FieldLabel>
                <NativeSelect
                  id="method-criteria-operator"
                  className="w-full"
                  value={methodForm.criteriaOperator}
                  onChange={(event) =>
                    onMethodFormChange({
                      ...methodForm,
                      criteriaOperator: event.target.value as CriteriaOperator,
                    })
                  }
                >
                  <NativeSelectOption value="<">less than</NativeSelectOption>
                  <NativeSelectOption value=">">greater than</NativeSelectOption>
                  <NativeSelectOption value="=">equal to</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="method-criteria-value">
                  Passing value
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="method-criteria-value"
                    value={methodForm.criteriaValue}
                    onChange={(event) =>
                      onMethodFormChange({
                        ...methodForm,
                        criteriaValue: event.target.value,
                      })
                    }
                    placeholder={getCriteriaPlaceholder(selectedVariable)}
                  />
                  <InputGroupAddon align="inline-end">
                    {getCriteriaUnitLabel(selectedVariable)}
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {selectedVariable?.unit === "seconds"
                    ? "Enter time as [mm]:ss; it is stored as seconds."
                    : "Leave blank when the method does not have pass criteria."}
                </FieldDescription>
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Competencies</FieldLegend>
              <FieldDescription>
                A method can measure zero or more competencies.
              </FieldDescription>
              <div className="flex flex-wrap gap-2">
                {competencies.length === 0 ? (
                  <Badge variant="outline">No competencies</Badge>
                ) : (
                  competencies.map((competency) => {
                    const selected = methodForm.competencyIds.includes(
                      competency.id
                    )

                    return (
                      <Button
                        key={competency.id}
                        type="button"
                        variant={selected ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => onToggleCompetencyForMethod(competency.id)}
                      >
                        {selected ? (
                          <XIcon data-icon="inline-start" />
                        ) : (
                          <PlusIcon data-icon="inline-start" />
                        )}
                        {competency.name}
                      </Button>
                    )
                  })
                )}
              </div>
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit">
            <SaveIcon data-icon="inline-start" />
            {editingMethodId ? "Save method" : "Create method"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function MethodTable({
  competencies,
  methods,
  variables,
  onDeleteMethod,
  onEditMethod,
}: {
  competencies: Competency[]
  methods: Method[]
  variables: Variable[]
  onDeleteMethod: (methodId: number) => void
  onEditMethod: (method: Method) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Methods</CardTitle>
        <CardDescription>
          Measurement methods available to events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Variable</TableHead>
              <TableHead>Aggregation</TableHead>
              <TableHead>Competencies</TableHead>
              <TableHead>Required</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No methods yet.
                </TableCell>
              </TableRow>
            ) : (
              methods.map((method) => {
                const variable = variables.find(
                  (item) => item.id === method.variable_id
                )
                const methodCompetencies = competencies.filter((competency) =>
                  method.competencyIds.includes(competency.id)
                )

                return (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell>
                      {variable ? (
                        <div className="flex flex-col">
                          <span>{variable.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {variable.scale} / {variable.unit}
                          </span>
                        </div>
                      ) : (
                        "None"
                      )}
                    </TableCell>
                    <TableCell>{getAggregationType(method.criteria)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {methodCompetencies.length === 0 ? (
                          <Badge variant="outline">None</Badge>
                        ) : (
                          methodCompetencies.map((competency) => (
                            <Badge key={competency.id} variant="secondary">
                              {competency.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {method.is_required ? "Required" : "Optional"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditMethod(method)}
                        >
                          <PencilIcon data-icon="inline-start" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteMethod(method.id)}
                        >
                          <Trash2Icon data-icon="inline-start" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function VariableTable({
  variables,
  onDeleteVariable,
  onEditVariable,
}: {
  variables: Variable[]
  onDeleteVariable: (variableId: number) => void
  onEditVariable: (variable: Variable) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variables</CardTitle>
        <CardDescription>Values produced by methods.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Scale</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No variables yet.
                </TableCell>
              </TableRow>
            ) : (
              variables.map((variable) => (
                <TableRow key={variable.id}>
                  <TableCell className="font-medium">{variable.name}</TableCell>
                  <TableCell>{variable.unit}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{variable.scale}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatVariableDomain(variable.domain)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditVariable(variable)}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteVariable(variable.id)}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CompetencyTable({
  competencies,
  onDeleteCompetency,
  onEditCompetency,
}: {
  competencies: Competency[]
  onDeleteCompetency: (competencyId: number) => void
  onEditCompetency: (competency: Competency) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Competencies</CardTitle>
        <CardDescription>
          Attributes that methods can measure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competencies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  No competencies yet.
                </TableCell>
              </TableRow>
            ) : (
              competencies.map((competency) => (
                <TableRow key={competency.id}>
                  <TableCell className="font-medium">
                    {competency.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {competency.description || "No description"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditCompetency(competency)}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteCompetency(competency.id)}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
