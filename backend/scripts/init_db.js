// backend/scripts/init_db.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data', 'movi.db');
const sqlPath = path.join(__dirname, '..', 'schema_and_seed.sql');

if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'data'));
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Could not open DB', err);
  console.log('Opened DB:', dbPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  db.exec(sql, (err) => {
    if (err) {
      console.error('Failed to run schema_and_seed.sql', err);
      process.exit(1);
    }
    console.log('Database initialized from schema_and_seed.sql');
    db.close();
  });
});
