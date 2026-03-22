import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

function AnswersPage() {

  const { gridId } = useParams()
  const navigate = useNavigate()

  // ✅ FIX: answers is an object, not array
  const [answers, setAnswers] = useState<Record<string, string[]> | null>(null)
  const [activePlayers, setActivePlayers] = useState<string[] | null>(null)

  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<string[]>([])

  const params = new URLSearchParams(window.location.search)
  const gridOverride = params.get("grid")

  const gridUrl = gridOverride ? `/grid?grid=${gridOverride}` : "/grid"
  const effectiveGridId = gridOverride ? Number(gridOverride) : Number(gridId)

  const BASE_URL = import.meta.env.VITE_API_URL

  useEffect(() => {

    // 1. Fetch grid structure
    fetch(gridUrl)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          console.error("GRID FETCH ERROR:", text)
          throw new Error("Grid fetch failed")
        }
        return res.json()
      })
      .then(data => {

        const cols = data.cols.map((c: any) => c.label)
        const rowsArr = data.rows.map((r: any) => r.label)

        setColumns(cols)
        setRows(rowsArr)

        // 2. Fetch answers
        return fetch(`${BASE_URL}/grid_answers?grid_id=${effectiveGridId}`)
      })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          console.error("GRID ANSWERS ERROR:", text)
          throw new Error("Answers fetch failed")
        }
        return res.json()
      })
      .then((data: Record<string, string[]>) => {
        console.log("GRID ANSWERS RESPONSE:", data)
        setAnswers(data)
      })
      .catch(err => {
        console.error("FINAL ERROR:", err)
      })

  }, [effectiveGridId])

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

          {columns.map((col, colIndex) => (
            <div key={colIndex} className="axis axis-col">
              {col}
            </div>
          ))}

          {rows.map((row, rowIndex) => (

            <div key={rowIndex} style={{ display: "contents" }}>

              <div className="axis axis-row">
                {row}
              </div>

              {columns.map((col, colIndex) => {

                // ✅ FIX: use key lookup instead of .find
                const key = `${row}|${col}`
                const players = answers[key] || []
                const count = players.length

                return (

                  <div
                    key={key}
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