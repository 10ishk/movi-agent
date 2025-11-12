// backend/routes/admin_helpers.js
const express = require("express");
const db = require("../db");
const router = express.Router();

/**
 * GET /api/helpers/deployment_for_trip/:tripId
 * Returns { found: true, deployment: { deployment_id, vehicle_id, driver_id } } or { found: false }
 */
router.get("/deployment_for_trip/:tripId", (req, res) => {
  const tripId = req.params.tripId;
  const q = `SELECT deployment_id, vehicle_id, driver_id FROM deployments WHERE trip_id = ? LIMIT 1`;
  db.get(q, [tripId], (err, row) => {
    if (err) {
      console.error("helpers error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) return res.json({ found: false });
    return res.json({ found: true, deployment: row });
  });
});

module.exports = router;
