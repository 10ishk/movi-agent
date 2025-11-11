const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  const q = `SELECT r.*, p.path_name FROM routes r LEFT JOIN paths p ON p.path_id = r.path_id`;
  db.all(q, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post("/", (req, res) => {
  const { path_id, route_display_name, shift_time, direction, start_point, end_point } = req.body;
  db.run(
    `INSERT INTO routes(path_id, route_display_name, shift_time, direction, start_point, end_point)
     VALUES(?,?,?,?,?,?)`,
    [path_id, route_display_name, shift_time, direction, start_point, end_point],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ route_id: this.lastID });
    }
  );
});

router.patch("/:id/deactivate", (req, res) => {
  const id = req.params.id;
  db.run("UPDATE routes SET status='deactivated' WHERE route_id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changed: this.changes });
  });
});

module.exports = router;
