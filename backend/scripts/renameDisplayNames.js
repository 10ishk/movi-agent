// scripts/renameDisplayNames.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbFile = path.join(__dirname, "..", "data", "movi.db");
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  console.log("Renaming trips...");
  db.run(
    `UPDATE daily_trips SET display_name = 'Trip ' || trip_id`,
    function (err) {
      if (err) {
        console.error("Error updating daily_trips:", err.message);
      } else {
        console.log("Updated daily_trips display_name for", this.changes, "rows");
      }
    }
  );

  console.log("Renaming routes...");
  db.run(
    `UPDATE routes SET route_display_name = 'Route ' || route_id`,
    function (err) {
      if (err) {
        console.error("Error updating routes:", err.message);
      } else {
        console.log("Updated routes route_display_name for", this.changes, "rows");
      }
    }
  );
});

db.close();