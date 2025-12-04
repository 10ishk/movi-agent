const express = require("express");
const db = require("../db");
const router = express.Router();

/**
 * GET /api/deployments
 * Returns all deployments as:
 * [
 *   { deployment_id, trip_id, vehicle_id, driver_id },
 *   ...
 * ]
 */
router.get("/", (req, res) => {
  const q = "SELECT deployment_id, trip_id, vehicle_id, driver_id FROM deployments";

  db.all(q, [], (err, rows) => {
    if (err) {
      console.error("GET /api/deployments error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

/**
 * POST /api/deployments
 * Body: { trip_id, vehicle_id, driver_id }
 * Creates a new deployment.
 */
router.post("/", (req, res) => {
  const { trip_id, vehicle_id, driver_id } = req.body;
  db.run(
    "INSERT INTO deployments(trip_id, vehicle_id, driver_id) VALUES(?,?,?)",
    [trip_id, vehicle_id, driver_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ deployment_id: this.lastID });
    }
  );
});

/**
 * DELETE /api/deployments/:id
 * Deletes a deployment by deployment_id.
 */
router.delete("/:id", (req, res) => {
  const id = req.params.id;
  db.run(
    "DELETE FROM deployments WHERE deployment_id = ?",
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    }
  );
});

module.exports = router;
