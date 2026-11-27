"""Create a super admin account.  Run:  python create_superadmin.py
The password is typed here and is stored only as a bcrypt hash in the database."""
import getpass
import os
import re
import sys

import bcrypt
import psycopg
from dotenv import load_dotenv

load_dotenv()
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

name = input("Super admin name: ").strip()
email = input("Super admin email: ").strip().lower()
pw = getpass.getpass("Password (8+ characters with a letter and a number): ")
again = getpass.getpass("Type the password again: ")

if not 2 <= len(name) <= 100:
    sys.exit("The name must be 2 to 100 characters.")
if not EMAIL_RE.match(email) or len(email) > 255:
    sys.exit("That is not a valid email address.")
if pw != again:
    sys.exit("The two passwords are different.")
if len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
    sys.exit("The password needs 8+ characters with at least one letter and one number.")
if len(pw.encode()) > 72:
    sys.exit("The password is too long (72 bytes maximum).")

hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    if conn.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone():
        sys.exit("That email already belongs to a normal user. Use a different email for the super admin.")
    try:
        conn.execute("INSERT INTO superadmins (name, email, password_hash) VALUES (%s, %s, %s)", (name, email, hashed))
    except psycopg.errors.UniqueViolation:
        sys.exit("A super admin with that email already exists.")
print(f"Done. Super admin created: {email}")