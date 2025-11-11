const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/trip/:tripId", (req, res) => {
  const tripId = req.params.tripId;
  db.all("SELECT * FROM bookings WHERE trip_id = ? AND status = 'confirmed'", [tripId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post("/", (req, res) => {
  const { trip_id, passenger_name } = req.body;
  db.run("INSERT INTO bookings(trip_id, passenger_name, status) VALUES(?,?, 'confirmed')",
    [trip_id, passenger_name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ booking_id: this.lastID });
    });
});

module.exports = router;
