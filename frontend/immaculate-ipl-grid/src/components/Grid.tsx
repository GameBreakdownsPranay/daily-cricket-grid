import React from "react";
import "./Grid.css";

type GridProps = {
  rows: string[];
  cols: string[];
  rowType: string;
  colType: string;
};

export default function Grid({ rows, cols }: GridProps) {
  return (
    <div className="grid-wrapper">
      <div className="grid">
        {/* Top-left empty corner */}
        <div className="cell header empty" />

        {/* Column Headers */}
        {cols.map((col) => (
          <div key={`col-${col}`} className="cell header">
            {col}
          </div>
        ))}

        {/* Row Headers + Playable Cells */}
        {rows.map((row) => (
          <React.Fragment key={`row-${row}`}>
            {/* Row Header */}
            <div className="cell header row-header">
              {row}
            </div>

            {/* Playable Cells */}
            {cols.map((col) => (
              <div
                key={`cell-${row}-${col}`}
                className="cell playable"
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}