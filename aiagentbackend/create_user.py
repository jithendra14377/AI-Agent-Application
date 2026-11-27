"""Create an account from the command line.

Run from the aiagentbackend folder with the venv active:
    python create_user.py "Full Name" someone@example.com "Password123" manager

The last word is the role: member, manager or super_admin.
"""
import os
import re
import sys

import bcrypt
import psycopg
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) != 5:
    sys.exit('Usage: python create_user.py "Full Name" email "Password" role')

name, email, password, role = sys.argv[1].strip(), sys.argv[2].strip().lower(), sys.argv[3], sys.argv[4].strip()

if not 2 <= len(name) <= 100:
    sys.exit("Name must be 2 to 100 characters.")
if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
    sys.exit("Enter a valid email address.")
if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
    sys.exit("Password needs 8+ characters with a letter and a number.")
if len(password.encode()) > 72:
    sys.exit("Password is too long (maximum 72 bytes).")
if role not in ("member", "manager", "super_admin"):
    sys.exit("Role must be member, manager or super_admin.")

pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    try:
        row = conn.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s,%s,%s,%s) RETURNING id",
            (name, email, pw_hash, role),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        sys.exit("An account with this email already exists.")
print(f"Created {role} account #{row[0]} for {email}")