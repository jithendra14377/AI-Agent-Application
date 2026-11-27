"""Checks that every image and video in the database really exists in aiagentbackend/storage.
Run:  python check_storage.py"""
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()
storage = Path(__file__).parent / "storage"
print(f"Storage folder : {storage}")
print(f"Folder exists  : {storage.exists()}")
on_disk = sum(1 for p in storage.rglob("*") if p.is_file()) if storage.exists() else 0
print(f"Files on disk  : {on_disk}")

with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    rows = conn.execute("SELECT id, job_id, kind, storage_path FROM assets ORDER BY id").fetchall()
missing = [r for r in rows if not (storage / r[3]).is_file()]
print(f"Images and videos in the database : {len(rows)}")
print(f"Found on disk                     : {len(rows) - len(missing)}")
print(f"MISSING from disk                 : {len(missing)}")
for r in missing[:8]:
    print(f"   asset {r[0]} (content #{r[1]}, {r[2]}): {r[3]}")