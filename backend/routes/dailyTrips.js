const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  const q = `
    SELECT dt.*, r.route_display_name, d.vehicle_id, d.driver_id
    FROM daily_trips dt
    LEFT JOIN routes r ON r.route_id = dt.route_id
    LEFT JOIN deployments d ON d.trip_id = dt.trip_id
    WHERE dt.scheduled_date = date('now')
  `;
  db.all(q, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get("/:id", (req, res) => {
  const id = req.params.id;
  const q = `SELECT dt.*, r.route_display_name FROM daily_trips dt LEFT JOIN routes r ON r.route_id = dt.route_id WHERE dt.trip_id = ?`;
  db.get(q, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

module.exports = router;
