const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  db.all("SELECT * FROM stops", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post("/", (req, res) => {
  const { name, latitude, longitude } = req.body;
  db.run(
    "INSERT INTO stops(name, latitude, longitude) VALUES (?, ?, ?)",
    [name, latitude, longitude],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ stop_id: this.lastID });
    }
  );
});

module.exports = router;
