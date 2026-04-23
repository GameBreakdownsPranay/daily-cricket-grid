const BASE_URL = "http://localhost:3000";
const TOTAL_GRIDS = 365;
const MIN_ANSWERS_PER_CELL = 3;

async function testGrid(gridId) {
  const errors = [];

  let rows = [];
  let cols = [];

  try {
    // Test 1: /grid endpoint
    const gridRes = await fetch(`${BASE_URL}/grid?grid_id=${gridId}`);
    if (!gridRes.ok) {
      errors.push(`/grid returned status ${gridRes.status}`);
    } else {
      const gridData = await gridRes.json();

      rows = gridData.rows ?? [];
      cols = gridData.cols ?? [];

      if (rows.length !== 3) {
        errors.push(`Expected 3 rows, got ${rows.length}`);
      }
      if (cols.length !== 3) {
        errors.push(`Expected 3 cols, got ${cols.length}`);
      }

      // Check labels
      for (const row of rows) {
        if (!row.label || row.label.trim() === "") {
          errors.push(`Row key "${row.key}" has empty label`);
        }
      }
      for (const col of cols) {
        if (!col.label || col.label.trim() === "") {
          errors.push(`Col key "${col.key}" has empty label`);
        }
      }
    }

    // Test 2: /grid_answers endpoint
    const ansRes = await fetch(`${BASE_URL}/grid_answers?grid_id=${gridId}`);
    if (!ansRes.ok) {
      errors.push(`/grid_answers returned status ${ansRes.status}`);
    } else {
      const ansData = await ansRes.json();
      if (gridId === 198) {
  console.log("DEBUG ansData keys:", Object.keys(ansData));
  console.log("DEBUG first key value length:", Object.values(ansData)[0]?.length);
}

      // Check all 9 cells exist and have enough answers
      for (const row of rows) {
        for (const col of cols) {
          const lookupKey = `${row.key}|${col.key}`;
          const players = ansData[lookupKey];

          if (!players) {
            errors.push(`Cell "${lookupKey}" missing from answers`);
          } else if (players.length < MIN_ANSWERS_PER_CELL) {
            errors.push(`Cell "${lookupKey}" has only ${players.length} answers (min ${MIN_ANSWERS_PER_CELL})`);
          }
        }
      }
    }

  } catch (err) {
    errors.push(`Request failed: ${err.message}`);
  }

  return errors;
}

async function runTests() {
  console.log(`\n🏏 Starting grid tests (0 to ${TOTAL_GRIDS - 1})...\n`);

  const failed = [];
  let passed = 0;

  for (let i = 0; i < TOTAL_GRIDS; i++) {
    const errors = await testGrid(i);
    if (errors.length === 0) {
      console.log(`✅ Grid ${i}`);
      passed++;
    } else {
      console.log(`❌ Grid ${i}`);
      for (const err of errors) {
        console.log(`   → ${err}`);
      }
      failed.push(i);
    }
  }

  console.log("\n----------------------------------------");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`Failed grid IDs: ${failed.join(", ")}`);
  }
  console.log("----------------------------------------\n");
}

runTests();