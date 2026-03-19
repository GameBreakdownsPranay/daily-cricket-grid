import { useState } from "react";
import "./App.css";

function App() {
  const [showHelp, setShowHelp] = useState(false);

  const columns = [
    "Deccan Chargers",
    "Delhi Capitals",
    "Mumbai Indians"
  ];

  const rows = [
    "Punjab Kings",
    "Rising Pune Supergiant",
    "Sunrisers Hyderabad"
  ];

  const formatYAxis = (name: string) => {
    const parts = name.split(" ");
    if (parts.length <= 1) return name;
    const lastWord = parts.pop();
    return (
      <>
        {parts.join(" ")}
        <br />
        {lastWord}
      </>
    );
  };

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <h1>🏏 Immaculate IPL Grid</h1>
        <button
          className="how-link"
          onClick={() => setShowHelp(true)}
        >
          How to Play
        </button>
      </header>

      {/* MAIN CONTENT */}
      <div className="content">

        {/* TOP INFO */}
        <div className="top-info">
          <p className="subtext">🕒 New grid daily at 10:00 AM IST</p>
          <p className="grid-number">Grid #1</p>

          <div className="rarity-row">
            <span>🎯 Rarity Attempts Left: <strong>9</strong></span>
            <button className="give-up">Give Up</button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid-wrapper">
          <div className="grid">

            {/* Top-left empty */}
            <div className="axis axis-empty"></div>

            {/* Column Axes */}
            {columns.map((col, i) => (
              <div key={`col-${i}`} className="axis axis-col">
                {col}
              </div>
            ))}

            {/* Rows + Cells */}
            {rows.map((row, rowIndex) => (
              <div key={`rowgroup-${rowIndex}`} style={{ display: "contents" }}>
                <div className="axis axis-row">
                  {formatYAxis(row)}
                </div>

                {columns.map((_, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="cell"
                  />
                ))}
              </div>
            ))}

          </div>
        </div>

      </div>

      {/* HELP MODAL */}
      {showHelp && (
        <div
          className="modal-overlay"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-btn"
              onClick={() => setShowHelp(false)}
            >
              ✕
            </button>

            <h2>🧠 How to Play</h2>

            <p>
              Fill the 3×3 grid with IPL players who satisfy both
              the row and column condition.
            </p>

            <p>Each cell needs ONE player that satisfies:</p>
            <ul>
              <li>The row requirement</li>
              <li>The column requirement</li>
            </ul>

            <h3>📌 Example</h3>
            <p>
              If a row says <strong>Rajasthan Royals</strong><br />
              and a column says <strong>Australia</strong>,
            </p>

            <p>
              A correct answer could be:<br />
              👉 <strong>Shane Watson</strong>
            </p>

            <p>Because he:</p>
            <ul>
              <li>Played for Rajasthan Royals</li>
              <li>Is from Australia</li>
            </ul>

            <h3>🎯 Rules</h3>
            <ul>
              <li>A player can be used only once</li>
              <li>Your 1st 9 attempts determine your rarity score</li>
              <li>You can keep solving after 9 attempts</li>
              <li>Click Give Up to reveal answers</li>
            </ul>

            <h3>⭐ Rarity Score</h3>
            <p>Lower score = rarer picks.</p>
            <p>
              Your score reflects how often your chosen players
              have been used historically.
            </p>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;