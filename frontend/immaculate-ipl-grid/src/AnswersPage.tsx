import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

function AnswersPage() {

  const { gridId } = useParams()
  const navigate = useNavigate()

  const [answers, setAnswers] = useState<Record<string,string[]> | null>(null)
  const [activePlayers, setActivePlayers] = useState<string[] | null>(null)

  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<string[]>([])

  const [rowKeys, setRowKeys] = useState<string[]>([])
  const [colKeys, setColKeys] = useState<string[]>([])

  const params = new URLSearchParams(window.location.search)
  const gridOverride = params.get("grid")

  const gridUrl = gridOverride ? `/grid?grid=${gridOverride}` : "/grid"

  const effectiveGridId = gridOverride ? Number(gridOverride) : Number(gridId)

  useEffect(() => {

  fetch(gridUrl)
    .then(res => res.json())
    .then(data => {

      setColumns(data.cols.map((c:any) => c.label))
      setRows(data.rows.map((r:any) => r.label))

      setColKeys(data.cols.map((c:any) => c.key))
      setRowKeys(data.rows.map((r:any) => r.key))

      const BASE_URL = import.meta.env.VITE_API_URL;

return fetch(`${BASE_URL}/grid_answers`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    grid_id: effectiveGridId
  })
});

    })
    .then(res => res.json())
    .then(data => {
      console.log("GRID ANSWERS RESPONSE:", data)
      setAnswers(data)
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

              {columns.map((_, colIndex) => {

                const key = `${rowKeys[rowIndex]}|${colKeys[colIndex]}`
                const players = answers[key] || []

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
                      {players.length}
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