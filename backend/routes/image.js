const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/parse", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "send { text: '...' } to simulate parsed screenshot" });

  db.get("SELECT trip_id, display_name FROM daily_trips WHERE display_name LIKE ? LIMIT 1", [`%${text}%`], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json({ found: false });
    res.json({ found: true, trip: row });
  });
});

module.exports = router;
