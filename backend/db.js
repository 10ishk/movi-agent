const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "movi.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ SQLite connection error:", err.message);
    process.exit(1);
  } else {
    console.log("✅ SQLite connected:", dbPath);
  }
});

module.exports = db;
