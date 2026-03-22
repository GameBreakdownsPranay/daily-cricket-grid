import { useState, useEffect } from "react";
import "./App.css";
import { Routes, Route, useNavigate } from "react-router-dom"
import AnswersPage from "./AnswersPage"
import { fetchGrid } from "./api/grid"


type CellStatus =
  | "empty"
  | "incorrect"
  | "ambiguous"
  | "correct"
  | "locked";

const RARITY_TURNS = 9;

function GamePage() {

  const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true"

  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const [lockedCells, setLockedCells] = useState<Record<string, string>>({});
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});

  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [gridId, setGridId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [gridComplete, setGridComplete] = useState(false);
  const [rarityScore, setRarityScore] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const navigate = useNavigate();

  const BASE_URL = import.meta.env.VITE_API_URL;

  const [grid, setGrid] = useState<{
  grid_id:number,
  rows:{key:string,label:string}[],
  cols:{key:string,label:string}[]
} | null>(null);
  const [timeLeft, setTimeLeft] = useState("")

  
const GRID_ID = grid?.grid_id ?? 0;
const columns = grid?.cols ?? [];
const rows = grid?.rows ?? [];

useEffect(() => {

  async function loadGrid() {

    try {

      const params = new URLSearchParams(window.location.search)
      const gridOverride = params.get("grid")

      let data;

if (gridOverride) {
  const res = await fetch(`${BASE_URL}/grid?grid=${gridOverride}`);
  data = await res.json();
} else {
  data = await fetchGrid();
}

      console.log("GRID DATA:", data)

      setGrid(data)

    } catch (err) {

      console.error("Grid load failed", err)

    }

  }

  loadGrid()

}, [])
  

useEffect(() => {

  function updateCountdown() {

    const now = new Date();

    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeLeft(
      `${hours.toString().padStart(2,"0")}:${minutes.toString().padStart(2,"0")}:${seconds.toString().padStart(2,"0")}`
    );

  }

  updateCountdown();

  const interval = setInterval(updateCountdown, 1000);

  return () => clearInterval(interval);

}, []);


useEffect(() => {

  if (!gridComplete) return;

  async function finalizeGame() {

    await fetch(`${BASE_URL}/completion?grid_id=${GRID_ID}`, {
  method: "POST"
});

    const cells = Object.entries(lockedCells).map(([key, player]) => {

      const [rowIndex, colIndex] = key.split("-").map(Number);

      return {
        row_value: rows[rowIndex].key,
        col_value: columns[colIndex].key,
        player_name: player
      };

    });

    const res = await fetch(`${BASE_URL}/rarity_score`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    grid_id: GRID_ID,
    cells: cells
  })
});

    const data = await res.json();

    setRarityScore(data.average_rarity);

  }

  finalizeGame();

}, [gridComplete]);


useEffect(() => {

  if (!activeCell) return;

  setTimeout(() => {
    const grid = document.querySelector(".grid-wrapper");
    grid?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 200);

}, [activeCell]);

  const handleSubmit = async () => {

    if (!activeCell || isSubmitting) return;

    const submittingCell = activeCell;
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setErrorMessage("Enter a player name");
      setAttemptsUsed(prev => prev + 1);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const [rowIndex, colIndex] = submittingCell.split("-").map(Number);

    const rowValue = rows[rowIndex].key;
    const colValue = columns[colIndex].key;

    try {

      const response = await fetch(`${BASE_URL}/validate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    grid_id: GRID_ID,
    row_value: rowValue,
    col_value: colValue,
    player: trimmed
  })
});

      const data = await response.json();

      if (data.status === "ambiguous") {

  setCellStatus(prev => ({
    ...prev,
    [submittingCell]: "ambiguous"
  }));

  setErrorMessage("Multiple players match that name. Try a full name.");

  setAttemptsUsed(prev => prev + 1);

  return;
}


if (data.status !== "valid") {

  setCellStatus(prev => ({
    ...prev,
    [submittingCell]: "incorrect"
  }));

  setErrorMessage("Incorrect player for this cell");

  setAttemptsUsed(prev => prev + 1);

  return;
}

      const canonical = data.canonical_player_name;

      if (Object.values(lockedCells).includes(canonical)) {

        setErrorMessage("Player already used.");
        setAttemptsUsed(prev => prev + 1);
        return;

      }

      setLockedCells(prev => {

        const updated = {
          ...prev,
          [submittingCell]: canonical
        };

        if (Object.keys(updated).length === 9) {
          setGridComplete(true);
        }

        return updated;

      });

      setCellStatus(prev => ({
        ...prev,
        [submittingCell]: "locked"
      }));

      setAttemptsUsed(prev => prev + 1);

      setActiveCell(null);
      setInputValue("");

    } catch {

      setCellStatus(prev => ({
        ...prev,
        [submittingCell]: "incorrect"
      }));

      setAttemptsUsed(prev => prev + 1);

    } finally {

      setIsSubmitting(false);

    }

  };

  const shareGrid = async () => {

    let output = `Immaculate IPL Grid #${GRID_ID + 1}\n`;
    output += `Score: ${rarityScore ?? "-"}\n\n`;

    for (let r = 0; r < 3; r++) {

      let rowStr = "";

      for (let c = 0; c < 3; c++) {

        const key = `${r}-${c}`;
        rowStr += lockedCells[key] ? "🟩" : "⬜";

      }

      output += rowStr + "\n";

    }

    await navigator.clipboard.writeText(output);

    alert("Result copied to clipboard!");

  };

  const remainingAttempts = Math.max(0, RARITY_TURNS - attemptsUsed);


  const formatCellLabel = (key: string) => {
    const [r, c] = key.split("-").map(Number);
    return `${r + 1}.${c + 1}`;
  };

  return (

    <div className="app">

       <header className="header">
        <h1>🏏 Immaculate IPL Grid</h1>

        <div
          className="how-to-play-link"
          onClick={() => setShowHowToPlay(true)}
        >
          How to Play
        </div>

       </header>

      <div className="content">

        {!grid && <div>Loading grid...</div>}

        <div className="top-info">

          <p className="grid-number">Grid #{GRID_ID + 1}</p>

          {window.location.search.includes("grid") && (

  <div style={{ marginTop: "8px", display: "flex", gap: "10px", justifyContent: "center" }}>

    <button
      onClick={() => {
        const params = new URLSearchParams(window.location.search)
        const g = Number(params.get("grid") ?? 0)
        window.location.search = `?grid=${Math.max(0, g - 1)}`
      }}
    >
      ← Prev
    </button>

    <button
      onClick={() => {
        const params = new URLSearchParams(window.location.search)
        const g = Number(params.get("grid") ?? 0)
        window.location.search = `?grid=${g + 1}`
      }}
    >
      Next →
    </button>

  </div>

)}

          <p className="countdown">Next grid in: {timeLeft}</p>

          <div className="rarity-row">

            <span>
              🎯 Attempts Left: <strong>{remainingAttempts}</strong>
            </span>

            <button
  className="give-up"
  onClick={async () => {

    await fetch(`${BASE_URL}/giveup?grid_id=${GRID_ID}`, {
  method: "POST"
})
    const cells = Object.entries(lockedCells).map(([key, player]) => {
      const [rowIndex, colIndex] = key.split("-").map(Number);

      return {
        row_value: rows[rowIndex].key,
        col_value: columns[colIndex].key,
        player_name: player
      };
    });

    const res = await fetch(`${BASE_URL}/rarity_score`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    grid_id: GRID_ID,
    cells: cells
  })
});

    const data = await res.json();
    setRarityScore(data.average_rarity);

    setGridComplete(true);
    setActiveCell(null);

  }}
>
  Give Up
</button>
          </div>

        </div>

        {activeCell && (

          <form
            className="top-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >

            <div className="input-label">
              Answer for {formatCellLabel(activeCell)}
            </div>

            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSubmitting}
            />

          </form>

        )}

        {errorMessage && (
  <div className="error-message">
    {activeCell && cellStatus[activeCell] === "ambiguous" ? "⚠" : "❌"} {errorMessage}
  </div>
)}

        <div className="grid-wrapper">

          <div className="grid">

            <div className="axis axis-empty"></div>

            {columns.map((col, i) => (
              <div key={i} className="axis axis-col">{col.label}</div>
            ))}

            {rows.map((row, rIndex) => (

              <div key={rIndex} style={{ display: "contents" }}>

  <div className="axis axis-row">
    {row.label}
  </div>

                {columns.map((_, cIndex) => {

                  const cellKey = `${rIndex}-${cIndex}`;
                  const value = lockedCells[cellKey];
                  
                  return (

                    <div
                      key={cellKey}
                      className={`cell ${value ? "correct" : ""}`}
                      onClick={() => {

                        if (lockedCells[cellKey]) return;

                        setActiveCell(cellKey);
                        setInputValue("");
                        setErrorMessage(null);

                      }}
                    >

                      {value ? value : `${rIndex + 1}.${cIndex + 1}`}

                    </div>

                  );

                })}

              </div>

            ))}

          </div>

        </div>

        {gridComplete && (
          <div className="completion-banner">
            🎉 Grid Complete!
          </div>
        )}

        {rarityScore !== null && (
          <div className="rarity-score">
            ⭐ Rarity Score: {rarityScore}
          </div>
        )}

        {gridComplete && (
          <button className="share-button" onClick={shareGrid}>
            Share Result
          </button>
        )}
        
        {gridComplete && (
  <div
    style={{
      marginTop: "10px",
      textDecoration: "underline",
      cursor: "pointer"
    }}
    onClick={() => navigate(`/answers/${GRID_ID}?grid=${GRID_ID}`)}
  >
    See All Answers
  </div>
)}


{showHowToPlay && (
  <div className="modal-overlay">

    <div className="modal">

      <button
        className="close-btn"
        onClick={() => setShowHowToPlay(false)}
      >
        ×
      </button>

    <h2>🧠 How to Play</h2>

<p>
Fill the 3×3 grid with IPL players who satisfy <strong>both</strong> the row and column condition.
</p>

<p>Each cell needs <strong>ONE</strong> player that satisfies:</p>

<ul>
  <li>The row requirement</li>
  <li>The column requirement</li>
</ul>

<h3>📌 Example</h3>

<p>
Row: <strong>Mumbai Indians</strong><br/>
Column: <strong>India</strong>
</p>

<p><strong>👉 Sachin Tendulkar</strong> works because he:</p>

<ul>
  <li>Played for Mumbai Indians</li>
  <li>Is from India</li>
</ul>

<p>He satisfies both conditions.</p>

<h3>📊 Metric Example</h3>

<p>
Some grid conditions are <strong>metrics</strong> (achievements or statistics).
</p>

<p>
Row: <strong>Century</strong><br/>
Column: <strong>Rajasthan Royals</strong>
</p>

<p><strong>👉 Heinrich Klaasen</strong> is a valid answer because:</p>

<ul>
  <li>He has scored an IPL century</li>
  <li>He has played for Rajasthan Royals</li>
</ul>

<p><strong>Read it like this:</strong></p>

<p>
Klaasen has scored a century <strong>AND</strong> played for Rajasthan Royals.
</p>

<p>
It does <strong>NOT</strong> mean Klaasen scored a century <strong>while playing for Rajasthan Royals</strong>.
</p>

<p>
⚠️ A player only needs to satisfy <strong>both conditions somewhere in their IPL career</strong>.
</p>

<h3>🎯 Rules</h3>

<ul>
  <li>A player can be used only once in the grid</li>
  <li>Your first 9 attempts determine your rarity score</li>
  <li>You can keep solving after 9 attempts</li>
  <li>Click <strong>Give Up</strong> to reveal answers</li>
</ul>

<h3>⭐ Rarity Score</h3>

<p>
Lower score = rarer picks.
</p>

<p>
Your score reflects how often your chosen players have been used historically.
</p>

    </div>

  </div>
)}
        
        
      </div>

    </div>

  );

}

function App() {

  return (

    <Routes>

      <Route path="/" element={<GamePage />} />

      <Route
        path="/answers/:gridId"
        element={<AnswersPage />}
      />

    </Routes>

  );

}

export default App;