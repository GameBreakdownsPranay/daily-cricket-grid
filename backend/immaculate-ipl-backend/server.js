// DEPLOY CHECK V3

import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env variables");
  process.exit(1);
}

const DEV_MODE = true

const app = express()

app.set("trust proxy", 1)

app.use(cors())

app.use(express.json());

/* ---------------- RATE LIMIT ---------------- */

const validateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "rate_limited",
    message: "Too many guesses. Just chill blud."
  }
})


/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/* ---------------- LOAD DAILY GRID SCHEDULE ---------------- */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const schedulePath = path.join(__dirname, "daily_schedule_365.json")

let schedule = []

function loadSchedule() {

  console.log("Loading schedule from:", schedulePath)

  const raw = fs.readFileSync(schedulePath, "utf8")
  schedule = JSON.parse(raw)

  console.log(`Loaded ${schedule.length} grids into memory`)

}

let metricKeys = new Set()
let metricDisplayMap = {}
let displayToMetricMap = {}

const axisTypeMap = {}

function detectAxisType(value) {

  if (metricKeys.has(value)) return "metric"

  if (["AR","BAT","BOWL","WK"].includes(value))
    return "skill"

  if (
    ["India","Australia","England","New Zealand","South Africa","West Indies","Sri Lanka","Pakistan","Afghanistan","Bangladesh"]
      .includes(value)
  ) {
    return "country"
  }

  return "franchise"
}


async function loadMetricKeys() {

  const { data, error } = await supabase
    .from("metric_registry")
    .select("metric_key, display_label")
    .eq("active", true)

  if (error) {
    console.error("Failed to load metric keys:", error)
    return
  }

  metricKeys = new Set(data.map(m => m.metric_key))

  metricDisplayMap = {}
  displayToMetricMap = {}

  for (const m of data) {
    metricDisplayMap[m.metric_key] = m.display_label
    displayToMetricMap[m.display_label] = m.metric_key
  }

  console.log(`Loaded ${metricKeys.size} metric keys`)
}

async function loadAxisRegistry() {

  const { data, error } = await supabase
    .from("axis_registry")
    .select("axis_value, axis_type")

  if (error) {
    console.error("Failed to load axis registry:", error)
    process.exit(1)
  }

  data.forEach(row => {
    axisTypeMap[row.axis_value] = row.axis_type
  })

  console.log(`Loaded ${data.length} axis definitions`)
}


/* ---------------- GET TODAY GRID ---------------- */

const LAUNCH_DATE = new Date("2026-01-01")

function getTodayGrid() {

  const today = new Date()

  const diffDays = Math.floor(
    (today - LAUNCH_DATE) / (1000 * 60 * 60 * 24)
  )

  const index = diffDays % schedule.length

  return schedule[index]

}

/* ---------------- ROOT ---------------- */

app.get("/", (req, res) => {
  res.send("Immaculate IPL backend running")
})

/* ---------------- GET CURRENT GRID ---------------- */

app.get("/grid", (req, res) => {

  const overrideGrid = req.query.grid

  let grid

  if (overrideGrid) {

    const gridId = parseInt(overrideGrid)

    grid = schedule.find(g => g.day === gridId)

    if (!grid) {
      return res.status(404).json({ error: "Grid not found" })
    }

  } else {

    grid = getTodayGrid()

  }

  const formatAxis = (v) => metricDisplayMap[v] || v

  res.json({
    grid_id: grid.day,
    rows: grid.rows.map(v => ({
  key: v,
  label: metricDisplayMap[v] || v
})),

cols: grid.cols.map(v => ({
  key: v,
  label: metricDisplayMap[v] || v
}))
  })

})

/* ---------------- VALIDATION ---------------- */

app.post("/validate", validateLimiter, async (req, res) => {

  console.log("VALIDATE BODY:", req.body)

  const { player, grid_id, row_value, col_value } = req.body

  const todayGrid = getTodayGrid()

if (!DEV_MODE && grid_id !== todayGrid.day) {
  return res.status(403).json({
    status: "invalid",
    message: "Grid not active"
  })
}

  const grid = schedule.find(g => g.day === grid_id)

  if (!grid) {
    return res.status(404).json({ status: "invalid" })
  }

  const row_idx = grid.rows.indexOf(row_value)
  const col_idx = grid.cols.indexOf(col_value)

  if (row_idx === -1 || col_idx === -1) {
  return res.json({ status: "invalid" })
}

  const input = player
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

  const { data, error } = await supabase
    .from("grid_cell_answers")
    .select("player_name")
    .eq("grid_id", grid_id)
    .eq("row_idx", row_idx)
    .eq("col_idx", col_idx)

console.log("ROW IDX:", row_idx)
console.log("COL IDX:", col_idx)
console.log("DB RESULTS:", data)

  /* ADD DEBUG HERE */
console.log("INPUT:", input)
console.log("VALID ANSWERS:", (data || []).map(d => d.player_name))

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (!data || data.length === 0) {
    return res.json({ status: "invalid" })
  }

  const matches = data.filter(p => {

  const name = p.player_name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

  return name.includes(input)

})

  if (matches.length === 0) {
    return res.json({ status: "invalid" })
  }

  if (matches.length > 1) {
    return res.json({
      status: "ambiguous",
      message: "Multiple players match that name. Please type more."
    })
  }

  const canonical = matches[0].player_name

  supabase.rpc("increment_cell_player_rarity", {
    p_grid_id: grid_id,
    p_row_idx: row_idx,
    p_col_idx: col_idx,
    p_player_name: canonical
  })

  res.json({
    status: "valid",
    canonical_player_name: canonical
  })

})

/* ---------------- COMPLETION ---------------- */

app.post("/completion", async (req, res) => {

  const { grid_id } = req.query

  const { data, error } = await supabase.rpc("increment_completion", {
    p_grid_id: grid_id
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ success: true })

})

/* ---------------- GIVE UP ---------------- */

app.post("/giveup", async (req, res) => {

  const { grid_id } = req.query

  const { error } = await supabase.rpc("increment_giveup", {
    p_grid_id: grid_id
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ success: true })

})

/* ---------------- RARITY SCORE ---------------- */

app.post("/rarity_score", async (req, res) => {

  const { grid_id, cells } = req.body

  const { data, error } = await supabase.rpc("get_rarity_score", {
    p_grid_id: grid_id,
    p_cells: cells
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)

})

/* ---------------- GRID ANSWERS ---------------- */

app.get("/grid_answers", async (req, res) => {

  const grid_id = parseInt(req.query.grid_id)

  const grid = schedule.find(g => g.day === grid_id)

if (!grid) {
  return res.status(404).json({ error: "Grid not found" })
}

/* normalize display labels to metric keys */
const normalize = (v) =>
  displayToMetricMap[v] || v

const rows = grid.rows.map(normalize)
const cols = grid.cols.map(normalize)

  const rowTypes = rows.map(detectAxisType)
  const colTypes = cols.map(detectAxisType)

  console.log("ROWS:", rows)
  console.log("COLS:", cols)
  console.log("ROW TYPES:", rowTypes)
  console.log("COL TYPES:", colTypes)

  const { data, error } = await supabase.rpc("get_grid_answers", {
    p_rows: rows,
    p_cols: cols,
    p_row_type: rowTypes,
    p_col_type: colTypes
  })

  if (error) {
    console.error("GRID ANSWERS RPC ERROR:", error)
    return res.status(500).json({ error: error.message })
  }

  res.json(data)

})

/* ---------------- START SERVER ---------------- */

async function startServer() {

  await loadMetricKeys();
  await loadAxisRegistry();
  loadSchedule();

  const PORT = process.env.PORT;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// ✅ function closed properly
startServer();