const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/parse", (req, res) => {
  const { text, image, mimeType } = req.body || {};

  if (image && !text) {
    return res.json({
      text: "",
      mimeType: mimeType || null,
      message:
        "Image upload received. OCR and screenshot parsing are planned enhancements and are not enabled in this local prototype.",
    });
  }

  if (!text) {
    return res.status(400).json({
      error:
        "Provide { text: '...' } for text-based parsing. Image OCR is reserved for a future enhancement.",
    });
  }

  let normalized = text.trim();
  normalized = normalized.replace(/^(what\s+is\s+)?status\s+of\s+/i, "").trim();
  normalized = normalized.replace(/^status\s+/i, "").trim();

  if (!normalized) {
    return res.json({ found: false, text: "" });
  }

  db.get(
    "SELECT trip_id, display_name FROM daily_trips WHERE display_name LIKE ? LIMIT 1",
    [`%${normalized}%`],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ found: false, text: normalized });
      res.json({ found: true, text: row.display_name, trip: row });
    }
  );
});

module.exports = router;
