const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
  const q = `
    SELECT p.path_id, p.path_name,
      json_group_array(json_object('stop_id', s.stop_id, 'name', s.name, 'order', ps.stop_order)) AS stops
    FROM paths p
    LEFT JOIN path_stops ps ON ps.path_id = p.path_id
    LEFT JOIN stops s ON s.stop_id = ps.stop_id
    GROUP BY p.path_id
  `;
  db.all(q, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = rows.map(r => ({ path_id: r.path_id, path_name: r.path_name, stops: JSON.parse(r.stops || "[]") }));
    res.json(parsed);
  });
});

router.post("/", (req, res) => {
  const { path_name, stop_ids } = req.body;
  db.run("INSERT INTO paths(path_name) VALUES(?)", [path_name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const pathId = this.lastID;
    const stmt = db.prepare("INSERT INTO path_stops(path_id, stop_id, stop_order) VALUES (?, ?, ?)");
    stop_ids.forEach((sid, idx) => stmt.run(pathId, sid, idx + 1));
    stmt.finalize((e) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json({ path_id: pathId });
    });
  });
});

module.exports = router;