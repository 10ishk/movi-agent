const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'movi.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('SQLite error: ', err);
});

module.exports = db;
