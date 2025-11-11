import sqlite3
from pathlib import Path

sql_path = Path(r'C:\Users\ATbru\Downloads\CODE\AI_ML_DL\Movi\backend\schema_and_seed.sql')
db_path = Path(r'C:\Users\ATbru\Downloads\CODE\AI_ML_DL\Movi\backend\movi.db')

if not sql_path.exists():
    raise SystemExit(f"ERROR: SQL file not found at: {sql_path}")

print(f"Using SQL file: {sql_path}")
print(f"Creating database at: {db_path}")

sql = sql_path.read_text()
conn = sqlite3.connect(str(db_path))
try:
    conn.executescript(sql)
    conn.commit()
    print("✅ Database created and seeded successfully.")
finally:
    conn.close()
