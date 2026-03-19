const fs = require("fs");
const path = require("path");

const schedulePath = path.join(__dirname, "daily_schedule_365.json");

let schedule = [];

function loadSchedule() {
  const raw = fs.readFileSync(schedulePath, "utf8");
  schedule = JSON.parse(raw);

  console.log(`Loaded ${schedule.length} grids`);
}

function getSchedule() {
  return schedule;
}

module.exports = {
  loadSchedule,
  getSchedule
};