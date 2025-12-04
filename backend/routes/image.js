const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/parse", (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res
      .status(400)
      .json({ error: "send { text: '...' } to simulate parsed screenshot" });
  }

  // Normalize: strip "status of", "what is the status of", etc.
  let normalized = text.trim();
  normalized = normalized.replace(/^(what\s+is\s+)?status\s+of\s+/i, "").trim();
  normalized = normalized.replace(/^status\s+/i, "").trim();

  if (!normalized) {
    return res.json({ found: false });
  }

  db.get(
    "SELECT trip_id, display_name FROM daily_trips WHERE display_name LIKE ? LIMIT 1",
    [`%${normalized}%`],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ found: false });
      res.json({ found: true, trip: row });
    }
  );
});

module.exports = router;
