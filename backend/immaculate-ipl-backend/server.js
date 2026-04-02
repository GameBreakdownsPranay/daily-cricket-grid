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

const DEV_MODE = process.env.DEV_MODE === "true"
console.log("DEV_MODE:", DEV_MODE)

const gridCache = new Map()

const app = express()

app.set("trust proxy", 1)

app.use(cors({
  origin: [
    "https://dailycricketgrid.com",
    "https://www.dailycricketgrid.com",
    "https://daily-cricket-grid.vercel.app",
    "http://localhost:5173"
  ]
}))

app.use(express.json());

app.get("/ping", (req, res) => {
  res.json({ status: "ok" })
})

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

async function loadGridToCache(grid_id) {
  if (gridCache.has(grid_id)) return

  const { data, error } = await supabase
    .from("grid_cell_answers")
    .select("grid_id, row_idx, col_idx, player_name")
    .eq("grid_id", grid_id)

  if (error) {
    console.error("CACHE LOAD ERROR:", error)
    return
  }

  const map = {}

  for (const row of data) {
    const key = `${row.row_idx}_${row.col_idx}`

    if (!map[key]) map[key] = []

    map[key].push({
      original: row.player_name,
      normalized: row.player_name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
    })
  }

  gridCache.set(grid_id, map)

  console.log(`✅ Grid ${grid_id} cached`)
}

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

const LAUNCH_DATE_UTC = new Date("2026-03-25T18:30:00Z")

function getTodayGrid() {

  const now = new Date()

  const diffDays = Math.floor(
    (now - LAUNCH_DATE_UTC) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) return schedule[0]

  const index = diffDays % schedule.length

  return schedule[index]

}

/* ---------------- ROOT ---------------- */

app.get("/", (req, res) => {
  res.send("Immaculate IPL backend running")
})

/* ---------------- GET CURRENT GRID ---------------- */

app.get("/grid", (req, res) => {

  const overrideGrid = req.query.grid_id

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
  const start = Date.now()

  const { grid_id, row_value, col_value } = req.body;
const rawPlayer = req.body.player || req.body.player_name || "";
const input = rawPlayer.trim().toLowerCase();



  // Get cached grid
  await loadGridToCache(grid_id)
  const grid = gridCache.get(grid_id)

  if (!grid) {
    return res.status(400).json({ error: "Grid not loaded in cache" })
  }
  
  const scheduleEntry = schedule.find(g => g.day === grid_id)
const row_idx = scheduleEntry.rows.indexOf(row_value)
const col_idx = scheduleEntry.cols.indexOf(col_value)

  // Build cell key
  const cellKey = `${row_idx}_${col_idx}`

  // Get answers for this cell
  const answers = grid[cellKey] || []

  // Match player (partial match supported)
  const matches = answers.filter(p =>
    p.normalized.includes(input)
  )

  // No match
  if (matches.length === 0) {
    return res.json({
      status: "incorrect",
      message: "Incorrect. No match found."
    })
  }

  // Optional: handle ambiguity (multiple matches)
  if (matches.length > 1) {
    return res.json({
      status: "ambiguous",
      message: "Multiple matches found. Please be more specific."
    })
  }

  // Single match → success
  const matchedPlayer = matches[0]

  const duration = Date.now() - start
  console.log(`VALIDATION TIME: ${duration}ms`)

 return res.json({
    status: "valid",
    canonical_player_name: matchedPlayer.original
  })
})

/* ---------------- COMPLETION ---------------- */

app.post("/completion", validateLimiter, async (req, res) => {

  const { grid_id } = req.query
  if (DEV_MODE) return res.json({ success: true, dev: true })

  const { data, error } = await supabase.rpc("increment_completion", {
    p_grid_id: grid_id
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ success: true })

})

/* ---------------- GIVE UP ---------------- */

app.post("/giveup", validateLimiter, async (req, res) => {

  const { grid_id } = req.query
  if (DEV_MODE) return res.json({ success: true, dev: true })

  const { error } = await supabase.rpc("increment_giveup", {
    p_grid_id: grid_id
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ success: true })

})

/* ---------------- SHARE ---------------- */

app.post("/share", async (req, res) => {

  const { grid_id } = req.query
  if (DEV_MODE) return res.json({ success: true, dev: true })

  const { error } = await supabase.rpc("increment_share", {
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
  if (DEV_MODE) return res.json({ average_rarity: 100, first_solver: false, dev: true })

  const { data, error } = await supabase.rpc("get_rarity_score", {
    p_grid_id: grid_id,
    p_cells: cells
  })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)

})

app.get("/grid_answers", async (req, res) => {

  const grid_id = Number(req.query.grid_id)

  if (grid_id === null || grid_id === undefined || isNaN(grid_id)) {
    return res.status(400).json({ error: "Missing grid_id" })
  }

  const grid = schedule.find(g => g.day === grid_id)

  if (!grid) {
    return res.status(404).json({ error: "Grid not found" })
  }

  const normalize = (v) => displayToMetricMap[v] || v

  const rows = grid.rows.map(normalize)
  const cols = grid.cols.map(normalize)

  const rowTypes = rows.map(detectAxisType)
  const colTypes = cols.map(detectAxisType)

  const { data, error } = await supabase.rpc("get_grid_answers", {
    p_rows: rows,
    p_cols: cols,
    p_row_type: rowTypes,
    p_col_type: colTypes
  })

  if (error) {
    console.error("GRID ANSWERS ERROR:", error)
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})


/* ---------------- PLAYERS LIST ---------------- */

app.get("/players", async (req, res) => {
  const { data, error } = await supabase
    .from("player_base")
    .select("player_name")

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data.map(p => p.player_name))
})

/* ---------------- START SERVER ---------------- */

async function startServer() {

  await loadMetricKeys();
  await loadAxisRegistry();
  loadSchedule();
  await loadGridToCache(getTodayGrid().day)

  const PORT = process.env.PORT;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// ✅ function closed properly
startServer();