const express = require("express");
const db = require("../db");
const router = express.Router();

router.post("/", (req, res) => {
  const { trip_id, vehicle_id, driver_id } = req.body;
  db.run("INSERT INTO deployments(trip_id, vehicle_id, driver_id) VALUES(?,?,?)",
    [trip_id, vehicle_id, driver_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ deployment_id: this.lastID });
    });
});

router.delete("/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM deployments WHERE deployment_id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
