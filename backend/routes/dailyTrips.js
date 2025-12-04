const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();

const dataDir = path.join(__dirname, "..", "data");
const dbFile = path.join(dataDir, "movi.db");
const jsonFile = path.join(dataDir, "trips.json");

async function readFromDb() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbFile)) return resolve(null);
    const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve(null);
    });
    db.all("SELECT trip_id, display_name FROM daily_trips LIMIT 1000", (err, rows) => {
      db.close();
      if (err) return resolve(null);
      resolve(rows || []);
    });
  });
}

router.get("/", async (req, res) => {
  try {
    // try DB first
    const fromDb = await readFromDb();
    if (fromDb && fromDb.length) {
      return res.json(fromDb);
    }

    // fallback to JSON file
    if (fs.existsSync(jsonFile)) {
      const raw = fs.readFileSync(jsonFile, "utf8");
      const trips = JSON.parse(raw);
      return res.json(trips);
    }

    // nothing => empty array
  // nothing => empty array
  return res.json([]);
} catch (err) {
  console.error("Error in dailyTrips route:", err);
  // Don't hard fail – just return an empty list so the bot UI doesn't blow up
  return res.json([]);
}
});


module.exports = router;
