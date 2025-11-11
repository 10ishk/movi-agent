const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  db.all("SELECT * FROM vehicles", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get("/unassigned", (req, res) => {
  const q = `
    SELECT * FROM vehicles v
    WHERE v.vehicle_id NOT IN (
      SELECT vehicle_id FROM deployments d
      JOIN daily_trips t ON t.trip_id = d.trip_id
      WHERE t.scheduled_date = date('now')
    )
  `;
  db.all(q, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
