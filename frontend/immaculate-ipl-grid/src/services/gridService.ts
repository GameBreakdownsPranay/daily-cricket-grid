export async function getActiveGrid() {
  console.log("⚠ Running in FULL MOCK MODE");

  return {
    grid_id: 1,
    row_type: "metric",
    col_type: "franchise",
    rows: [
      "stumped_wkts_ge_3",
      "ducks_ge_5_vs_or_bat",
      "runs_gt_2000"
    ],
    cols: [
      "Punjab Kings",
      "Chennai Super Kings",
      "Mumbai Indians"
    ]
  };
}