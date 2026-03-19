/*
Precompute answers for every grid cell and store them in grid_cell_answers

Architecture
-------------
schedule → normalize axes → build predicates → query players → store answers

Tables used
-----------
player_base
player_team_nat_map
player_metric_flags
metric_registry
grid_cell_answers
*/

import dotenv from "dotenv"
dotenv.config()

console.log("DATABASE_URL:", process.env.DATABASE_URL)

import fs from "fs"
import path from "path"
import pkg from "pg"

const { Pool } = pkg

/* ------------------------------------------------ */
/* CONFIG                                           */
/* ------------------------------------------------ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const SCHEDULE_PATH =
  "./daily_schedule_365.json"


async function loadAxisRegistry() {

  const res = await pool.query(`
    SELECT axis_value, axis_type
    FROM axis_registry
  `)

  const axisMap = new Map()

  for (const row of res.rows) {

    let type = row.axis_type

    // treat composite metrics as metrics
    if (type === "composite_metric")
      type = "metric"

    axisMap.set(row.axis_value, type)
  }

  return axisMap
}

/* ------------------------------------------------ */
/* LOAD METRIC REGISTRY                             */
/* ------------------------------------------------ */

async function loadMetricMaps() {

  const client = await pool.connect()

  const res = await client.query(`
    SELECT metric_key, display_label
    FROM metric_registry
  `)

  const metricAliasMap = new Map()

  for (const row of res.rows) {

    const key = row.metric_key

    metricAliasMap.set(key.toLowerCase(), key)

    if (row.display_label)
      metricAliasMap.set(row.display_label.toLowerCase(), key)
  }


/* schedule aliases */
metricAliasMap.set("has_3_wickets", "has_3_wkts_match")
metricAliasMap.set("bowling_maiden_overs", "maiden_overs_ge_1")

  client.release()

  return metricAliasMap
}


/* ------------------------------------------------ */
/* AXIS NORMALIZATION                               */
/* ------------------------------------------------ */

function normalizeAxis(value, declaredType, axisMap, metricMap) {

  if (declaredType === "franchise")
    return { type: "franchise", value }

  if (declaredType === "country")
    return { type: "country", value }

  if (declaredType === "primary_skill")
  return { type: "primary_skill", value }

  if (declaredType === "metric") {

    const key =
      metricMap.get(value.toLowerCase()) || value

    return { type: "metric", value: key }
  }

  if (declaredType === "mixed") {

    if (metricMap.has(value.toLowerCase()))
      return {
        type: "metric",
        value: metricMap.get(value.toLowerCase())
      }

    const axisType = axisMap.get(value)

if (axisType)
  return { type: axisType, value }

    throw new Error(`Unknown mixed axis value: ${value}`)
  }

  throw new Error(`Unknown axis type: ${declaredType}`)
}

/* ------------------------------------------------ */
/* PREDICATE BUILDER                                */
/* ------------------------------------------------ */

function axisPredicate(axis) {

  switch (axis.type) {

    case "franchise":
      return `
        player_name IN (
          SELECT player_name
          FROM player_team_nat_map
          WHERE franchise = '${axis.value}'
        )
      `

    case "country":
      return `
        player_name IN (
          SELECT player_name
          FROM player_base
          WHERE country = '${axis.value}'
        )
      `

    case "primary_skill":
      return `
        player_name IN (
          SELECT player_name
          FROM player_base
          WHERE primary_skill = '${axis.value}'
        )
      `

    case "metric":
      return `
        player_name IN (
          SELECT player_name
          FROM player_metric_flags
          WHERE metric_key = '${axis.value}'
        )
      `
  }
}

/* ------------------------------------------------ */
/* BUILD CELL QUERY                                 */
/* ------------------------------------------------ */

function buildCellQuery(rowAxis, colAxis) {

  const r = axisPredicate(rowAxis)
  const c = axisPredicate(colAxis)

  return `
    SELECT DISTINCT player_name
    FROM player_base
    WHERE ${r}
    AND ${c}
  `
}

/* ------------------------------------------------ */
/* MAIN PRECOMPUTE                                  */
/* ------------------------------------------------ */

async function precompute() {

  const schedule =
    JSON.parse(fs.readFileSync(SCHEDULE_PATH))

  const metricMap = await loadMetricMaps()

  const axisMap = await loadAxisRegistry()

  const client = await pool.connect()

  console.log("Starting precompute...")

  for (const grid of schedule) {

    const gridId = grid.day

    console.log(`Grid ${gridId}`)

    const rows = grid.rows.map(v =>
      normalizeAxis(v, grid.row_type, axisMap, metricMap)
    )

    const cols = grid.cols.map(v =>
  normalizeAxis(v, grid.col_type, axisMap, metricMap)
)

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {

        const query = buildCellQuery(rows[r], cols[c])

        const res = await client.query(query)

        const players = res.rows

        if (players.length === 0) {

          console.warn(
            `Dead cell → grid ${gridId} (${r},${c})`
          )
        }

        for (const p of players) {

          await client.query(`
            INSERT INTO grid_cell_answers
            (grid_id, row_idx, col_idx, player_name)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT DO NOTHING
          `, [
            gridId,
            r,
            c,
            p.player_name
          ])
        }
      }
    }

    console.log(`Grid ${gridId} complete`)
  }

  client.release()

  console.log("Precompute finished")
}

/* ------------------------------------------------ */

precompute()
  .then(() => process.exit())
  .catch(err => {
    console.error(err)
    process.exit(1)
  })