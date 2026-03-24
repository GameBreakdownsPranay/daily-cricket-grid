import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

function AnswersPage() {

  const { gridId } = useParams()
  const navigate = useNavigate()

  // ✅ answers is OBJECT (matches backend)
  const [answers, setAnswers] = useState<Record<string, string[]> | null>(null)
  const [activePlayers, setActivePlayers] = useState<string[] | null>(null)

  const [columns, setColumns] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [todayGridId, setTodayGridId] = useState<number | null>(null)
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null)

  const params = new URLSearchParams(window.location.search)
  const gridOverride = params.get("grid")

  const effectiveGridId = gridOverride ? Number(gridOverride) : Number(gridId)

  const BASE_URL = import.meta.env.VITE_API_URL
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true"

  useEffect(() => {

    async function loadData() {
      try {
        const todayRes = await fetch(`${BASE_URL}/grid`)
const todayData = await todayRes.json()
const todayId = todayData.grid_id
setTodayGridId(todayId)

if (!DEV_MODE && effectiveGridId !== todayId) {
  setAccessAllowed(false)
  return
}

if (!DEV_MODE) {
  const saved = localStorage.getItem(`cricket_grid_${effectiveGridId}`)
  if (saved) {
    const s = JSON.parse(saved)
    if (s.gridComplete || s.gaveUp) {
      setAccessAllowed(true)
    } else {
      setAccessAllowed(false)
      return
    }
  } else {
    setAccessAllowed(false)
    return
  }
}
setAccessAllowed(true)
        // 1. Fetch grid
        const gridRes = await fetch(`${BASE_URL}/grid?grid_id=${effectiveGridId}`)
        if (!gridRes.ok) throw new Error("Grid fetch failed")

        const gridData = await gridRes.json()

        const cols = gridData.cols
        const rowsArr = gridData.rows

        setColumns(cols)
        setRows(rowsArr)

        // 2. Fetch answers
        const ansRes = await fetch(`${BASE_URL}/grid_answers?grid_id=${effectiveGridId}`)
        if (!ansRes.ok) throw new Error("Answers fetch failed")

        const ansData = await ansRes.json()

        const counts: Record<string, number> = {}

for (const key in ansData) {
  counts[key] = ansData[key].length
}

        console.log("GRID ANSWERS RESPONSE:", ansData)

        

for (const key in ansData) {
  counts[key] = ansData[key].length
}

console.log("COUNTS:", counts)

        // ✅ NO TRANSFORMATION — store directly
        setAnswers(ansData)

      } catch (err) {
        console.error("FINAL ERROR:", err)
      }
    }

    loadData()

  }, [effectiveGridId])

  // ⛔ wait until everything is ready
  
  if (accessAllowed === false) {
  return (
    <div style={{ padding: "40px", color: "white", textAlign: "center" }}>
      <h2>🔒 Access Denied</h2>
      <p>
        {todayGridId !== null && effectiveGridId !== todayGridId
          ? "Answers are only available for today's grid."
          : "Complete or give up today's grid to see answers."}
      </p>
      <button onClick={() => navigate("/")}>← Back to Grid</button>
    </div>
  )
}

if (!answers || rows.length === 0 || columns.length === 0) {
    return <div>Loading...</div>
  }

  return (

    <div style={{ padding: "40px", color: "white" }}>

      <button
        style={{ marginBottom: "20px" }}
        onClick={() => navigate("/")}
      >
        ← Back to Grid
      </button>

      <h1>Answer Grid</h1>

      <div className="grid-wrapper">

        <div className="answers-grid">

          <div className="axis axis-empty"></div>

          {columns.map((col) => (
  <div key={col.key} className="axis axis-col">
    {col.label}
  </div>
))}

          {rows.map((row) => (
  <div key={row.key} style={{ display: "contents" }}>

    <div className="axis axis-row">
      {row.label}
    </div>

    {columns.map((col) => {

      const lookupKey = `${row.key}|${col.key}`
      const players = answers[lookupKey] || []
      const count = players.length

      console.log("LOOKUP:", lookupKey, count)

      return (
        <div
          key={lookupKey}
          className="cell"
          style={{ cursor: "pointer" }}
          onClick={() => setActivePlayers(players)}
        >
          <span
            style={{
              color: "#3b82f6",
              textDecoration: "underline",
              fontWeight: "500",
              fontSize: "1.25em"
            }}
          >
            {count}
          </span>
        </div>
      )

    })}

  </div>
))}

        </div>

      </div>

      {activePlayers && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >

          <div
            style={{
              background: "#0f172a",
              padding: "20px",
              borderRadius: "8px",
              maxHeight: "70vh",
              overflowY: "auto",
              width: "320px"
            }}
          >

            <button
              style={{ marginBottom: "10px" }}
              onClick={() => setActivePlayers(null)}
            >
              Close
            </button>

            {activePlayers.map((p) => (
              <div key={p} style={{ padding: "4px 0" }}>
                {p}
              </div>
            ))}

          </div>

        </div>

      )}

    </div>

  )

}

export default AnswersPage