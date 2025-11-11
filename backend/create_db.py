import sqlite3
from pathlib import Path
sql_file = Path(r'Movi\backend\schema_and_seed.sql')
if not sql_file.exists():
    raise SystemExit("ERROR: schema_and_seed.sql not found in current folder.")

db_path = Path('movi.db')
print(f"Creating database at: {db_path.resolve()}")

sql = sql_file.read_text()
conn = sqlite3.connect(str(db_path))
try:
    conn.executescript(sql)
    conn.commit()
    print("✅ Database created and seeded successfully.")
finally:
    conn.close()