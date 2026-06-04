import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() { 
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);

  async function createDemo() { 
    const assessment = await axios.post(`${API}/assessments`, {
      name: "Demo Assessment",
      description: "Weekend project assessment",
    });
    
    const metricA = await axios.post(`${API}/metrics`, {
      stable_key: "technical-judgment",
      name: "Technical Judgment",
      metric_type: "Likert",
      domain: "Engineering",
      description: "Evaluates engineering reasoning.",
      scoring: { min: 1, max: 7 },
    });

    const metricB = await axios.post(`${API}/metrics`, {
      stable_key: "communication",
      name: "Communication",
      metric_type: "Likert",
      domain: "Leadership",
      description: "Evaluates clarity of communication",
      scoring: { min: 1, max: 7 },
    });

    const evolution = await axios.post(`${API}/evolutions`, {
      stable_key: "engineering-review",
      name: "Engineering Review",
      description: "Core review evolution.",
      metric_ids: [metricA.data.id, metricB.data.id],
    });

    const event = await axios.post(`${API}/events`, {
      assessment_id: assessment.data.id,
      name: "Prototype Event",
      evolution_ids: [evolution.data.id],
    });

    setAssessmentId(assessment.data.id);
    setEventId(event.data.id);
  }

  function exportExcel() { 
    if (!eventId) return;
    window.location.href = `${API}/events/${eventId}/export`;
  }
  return (
    <main style={{ maxWidth: 800, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h1>Assessment Builder</h1>
      <p>Create a demo assessment, event, evolution, and metrics. Then export the event as Excel.</p>
      <button onClick={createDemo}>Create Demo Event</button>
      <button onClick={exportExcel} disabled={!eventId} style={{ marginLeft: 12 }}>
        Export Excel
      </button>
      <pre>
        {JSON.stringify({ assessmentId, eventId }, null, 2)}
      </pre>
    </main>
  );
}
