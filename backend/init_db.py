# backend/init_db.py
import sqlite3
import pathlib
import sys
from datetime import date

BASE = pathlib.Path(__file__).parent
DB_PATH = BASE / "data" / "movi.db"
SCHEMA_PATH = BASE / "schema_and_seed.sql"  # adjust if your SQL file is named differently

print("DB path:", DB_PATH)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# If you have a schema file, we'll run it. If not, we'll create minimal schema.
if SCHEMA_PATH.exists():
    print("Applying schema_and_seed.sql")
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
else:
    print("schema_and_seed.sql not found — creating minimal schema for daily_trips")
    sql = """
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS daily_trips (
      trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT,
      route_id INTEGER,
      scheduled_date TEXT
    );
    CREATE TABLE IF NOT EXISTS routes (
      route_id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_display_name TEXT
    );
    CREATE TABLE IF NOT EXISTS deployments (
      deployment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER,
      vehicle_id INTEGER,
      driver_id INTEGER
    );
    """

con = sqlite3.connect(str(DB_PATH))
cur = con.cursor()
cur.executescript(sql)
con.commit()

# Insert a single sample row for today (so daily_trips query with date('now') picks it up)
today = date.today().isoformat()  # YYYY-MM-DD
# check if Bulk - 00:01 exists for today
cur.execute("SELECT trip_id FROM daily_trips WHERE display_name=? AND scheduled_date=?", ("Bulk - 00:01", today))
r = cur.fetchone()
if not r:
    print("Seeding sample trip Bulk - 00:01 for today:", today)
    cur.execute("INSERT INTO daily_trips (display_name, route_id, scheduled_date) VALUES (?, ?, ?)",
                ("Bulk - 00:01", None, today))
    con.commit()
else:
    print("Sample trip already present, trip_id =", r[0])

print("Done. DB created/updated at:", DB_PATH)
con.close()
