import { useState, useEffect } from "react";
import "./App.css";
import { Routes, Route, useNavigate } from "react-router-dom"
import AnswersPage from "./AnswersPage"


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
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const [isGivingUp, setIsGivingUp] = useState(false);

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

      let url = `${BASE_URL}/grid`;

      if (DEV_MODE && gridId !== null) {
        url = `${BASE_URL}/grid?grid_id=${gridId}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      setGrid(data);
      if (gridId === null) setGridId(data.grid_id);
      if (DEV_MODE) {
  setLockedCells({});
  setCellStatus({});
  setAttemptsUsed(0);
  setGridComplete(false);
  setGaveUp(false);
  setRarityScore(null);
}
      const saved = localStorage.getItem(`cricket_grid_${data.grid_id}`);
if (saved) {
  const s = JSON.parse(saved);
  setLockedCells(s.lockedCells ?? {});
  setCellStatus(s.cellStatus ?? {});
  setAttemptsUsed(s.attemptsUsed ?? 0);
  setGridComplete(s.gridComplete ?? false);
  setGaveUp(s.gaveUp ?? false);
  setRarityScore(s.rarityScore ?? null);
}

    } catch (err) {

      console.error("Grid load failed", err);

    }

  }

  loadGrid();

}, [gridId]);

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
  if (GRID_ID === null || GRID_ID === undefined) return;
  const snapshot = {
    lockedCells,
    cellStatus,
    attemptsUsed,
    gridComplete,
    gaveUp,
    rarityScore
  };
  localStorage.setItem(`cricket_grid_${GRID_ID}`, JSON.stringify(snapshot));
}, [lockedCells, cellStatus, attemptsUsed, gridComplete, gaveUp, rarityScore, GRID_ID]);

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
    setShowCompletionModal(true);

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

    let output = `Daily Cricket Grid - IPL Edition #${GRID_ID + 1}\n`;
    output += `Score: ${rarityScore ?? "-"}\n\n`;

    for (let r = 0; r < 3; r++) {

      let rowStr = "";

      for (let c = 0; c < 3; c++) {

        const key = `${r}-${c}`;
        rowStr += lockedCells[key] ? "🟩" : "⬜";

      }

      output += rowStr + "\n";

    }
    output += `\nPlay today's grid: ${window.location.origin}`;
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
        <h1>Daily Cricket Grid - IPL Edition</h1>
        <p style={{ fontStyle: "italic", margin: "4px 0 0 0", fontSize: "13px", opacity: 0.75 }}>Coverage from 2008 to 2025</p>

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

          {DEV_MODE && (
  <div
    style={{
      marginTop: "8px",
      display: "flex",
      gap: "10px",
      justifyContent: "center"
    }}
  >
    <button
      onClick={() =>
        setGridId((g: number | null) => (g !== null ? g - 1 : 0))
      }
    >
      ← Prev
    </button>

    <button
      onClick={() =>
        setGridId((g: number | null) => (g !== null ? g + 1 : 1))
      }
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
  disabled={isGivingUp}
  onClick={async () => {
    setIsGivingUp(true);
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
    setGaveUp(true);
    setActiveCell(null);

  }}
>
  {isGivingUp ? "Loading..." : "Give Up"}
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

{showCompletionModal && (
  <div className="modal-overlay" style={{ alignItems: "flex-start", paddingTop: "35vh", justifyContent: "center", width: "100%" }}>
    <div className="modal" style={{ textAlign: "center", width: "95%", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>

      <button
        className="close-btn"
        onClick={() => setShowCompletionModal(false)}
      >
        ×
      </button>

      <h2>🎉 Grid Complete!</h2>

      <p style={{ fontSize: "18px" }}>
        ⭐ Rarity Score: <strong>{rarityScore}</strong>
      </p>

      <button className="share-button" onClick={shareGrid}>
        Share Result
      </button>

      <div
        style={{ marginTop: "14px", textDecoration: "underline", cursor: "pointer" }}
        onClick={() => {
          setShowCompletionModal(false)
          navigate(`/answers/${GRID_ID}?grid=${GRID_ID}`)
        }}
      >
        See All Answers
      </div>

    </div>
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

    <p>Fill the 3×3 grid with players who satisfy <strong>both</strong> the row and column condition.</p>

<h3>📌 Example</h3>
<p>Row: <strong>Mumbai Indians</strong> × Column: <strong>India</strong> → 👉 Sachin Tendulkar ✅</p>

<h3>📊 Metric Example</h3>
<p>Row: <strong>Century</strong> × Column: <strong>Rajasthan Royals</strong> → 👉 Heinrich Klaasen ✅</p>
<p>This means Klaasen has scored an IPL century <strong>AND</strong> played for Rajasthan Royals — not necessarily at the same time.</p>
<p>⚠️ A player only needs to satisfy both conditions <strong>somewhere in their IPL career</strong>.</p>

<h3>🎯 Rules</h3>
<ul>
  <li>One player per cell, no repeats</li>
  <li>First 9 attempts count toward your rarity score</li>
  <li>You can keep going after 9 attempts</li>
  <li>Click <strong>Give Up</strong> to see answers</li>
</ul>

<h3>⭐ Rarity Score</h3>
<p>Lower = rarer picks. Based on how often your players have been chosen by others.</p>

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