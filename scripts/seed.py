import sqlite3
import subprocess
import time
import requests
import json
import uuid
import os
from datetime import datetime, timezone, timedelta

# Configuration
DB_PATH = "keiri.db"
AUTH_API_URL = "http://localhost:7878/api/auth/sign-up/email"
HEALTH_CHECK_URL = "http://localhost:7878/api/health"
USER_EMAIL = "gaurav61355@gmail.com"
USER_PASSWORD = "gaurav12345678"
USER_NAME = "Gaurav"


def seed_db():
    print("🚀 Starting Keiri Backend for seeding...")
    # Note: We use shell=True to handle environmental variables via the shell if needed,
    # and we capture stdout/stderr to help with debugging if it fails.
    server_process = subprocess.Popen(
        ["cargo", "run", "-p", "server"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
    )

    try:
        print("⏳ Waiting for server to become healthy (this may take up to 3-5 mins for initial compilation)...")
        server_ready = False
        start_time = time.time()
        # Wait up to 300 seconds
        while time.time() - start_time < 300:
            try:
                r = requests.get(HEALTH_CHECK_URL, timeout=2)
                if r.status_code == 200:
                    server_ready = True
                    break
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                # Print a dot to show activity
                print(".", end="", flush=True)

            # Check if process is still running
            if server_process.poll() is not None:
                print("\n❌ Server process exited unexpectedly!")
                print("Last output:")
                print(server_process.stdout.read())
                return

            time.sleep(2)

        if not server_ready:
            print("\n❌ Server failed to start within the timeout period.")
            return

        print("\n✅ Server is up! Registering user...")

        # 1. Register the user via Better Auth API
        reg_payload = {"email": USER_EMAIL, "password": USER_PASSWORD, "name": USER_NAME}

        try:
            reg_response = requests.post(AUTH_API_URL, json=reg_payload)
            if reg_response.status_code == 200:
                print(f"✅ User {USER_EMAIL} registered successfully.")
            elif reg_response.status_code == 400 and "already exists" in reg_response.text.lower():
                print(f"ℹ️ User {USER_EMAIL} already exists. Proceeding with data seeding.")
            else:
                print(f"⚠️ Registration warning ({reg_response.status_code}): {reg_response.text}")
        except Exception as e:
            print(f"❌ Error during registration: {e}")

        # 2. Database seeding via direct SQLite access
        print(f"🔌 Connecting to {DB_PATH} for data seeding...")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Get user id
        c.execute("SELECT id FROM users WHERE email = ?", (USER_EMAIL,))
        row = c.fetchone()
        if not row:
            print(f"❌ User {USER_EMAIL} not found in DB after registration attempt.")
            return

        user_id = row[0]
        now = datetime.now(timezone.utc)

        # 3. Seed Default Wallets
        print("💳 Seeding default wallets...")
        iso_now = now.isoformat()
        wallets = [
            (str(uuid.uuid4()), user_id, "Cash", "CASH", 5000.00, iso_now, iso_now),
            (str(uuid.uuid4()), user_id, "Main Bank", "BANK", 45000.00, iso_now, iso_now),
        ]

        wallet_ids = []
        for w in wallets:
            try:
                c.execute(
                    """
                    INSERT INTO wallets (id, user_id, name, type, balance, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                    w,
                )
                wallet_ids.append(w[0])
            except sqlite3.Error as e:
                # Likely already exists or integrity/operational error
                print(f"  - Wallet {w[2]} skip/error: {e}")
                pass

        # 4. Seed Transactions
        print("📝 Seeding 10 sample transactions...")
        transactions = [
            (
                str(uuid.uuid4()),
                user_id,
                3450.50,
                "CASH_OUT",
                (now - timedelta(days=1)).isoformat(),
                "Amazon Shopping",
                "Completed",
                "Personal",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                125000.00,
                "CASH_IN",
                (now - timedelta(days=2)).isoformat(),
                "Monthly Salary Tech Inc",
                "Completed",
                "Income",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                2400.00,
                "CASH_OUT",
                (now - timedelta(days=2, hours=4)).isoformat(),
                "Blinkit Groceries",
                "Completed",
                "Necessities",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                649.00,
                "CASH_OUT",
                (now - timedelta(days=4)).isoformat(),
                "Netflix Standard",
                "Completed",
                "Entertainment",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                28000.00,
                "CASH_OUT",
                (now - timedelta(days=5)).isoformat(),
                "Apartment Rent",
                "Completed",
                "Housing",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                450.00,
                "CASH_OUT",
                (now - timedelta(days=8)).isoformat(),
                "Swiggy Dinner",
                "Completed",
                "Dining",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                5000.00,
                "CASH_IN",
                (now - timedelta(days=9)).isoformat(),
                "Ramesh Repayment",
                "Completed",
                "P2P",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                119.00,
                "CASH_OUT",
                (now - timedelta(days=11)).isoformat(),
                "Spotify Premium",
                "Completed",
                "Entertainment",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                350.00,
                "CASH_OUT",
                (now - timedelta(days=12)).isoformat(),
                "Uber Ride",
                "Completed",
                "Transport",
            ),
            (
                str(uuid.uuid4()),
                user_id,
                10000.00,
                "CASH_OUT",
                (now - timedelta(days=14)).isoformat(),
                "HDFC ATM Withdrawal",
                "Completed",
                "Misc",
            ),
        ]

        inserted_count = 0
        for tx in transactions:
            try:
                # Insert Transaction
                c.execute(
                    """
                    INSERT INTO transactions (id, user_id, amount, direction, date, source, status, purpose_tag)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    tx,
                )

                # Insert metadata record
                c.execute(
                    "INSERT INTO transaction_metadata (transaction_id, app_name) VALUES (?, ?)",
                    (tx[0], "Keiri Seeder"),
                )
                inserted_count += 1
            except sqlite3.IntegrityError:
                continue

        conn.commit()
        conn.close()
        print(f"🎉 Successfully seeded {inserted_count} transactions and wallets for user {USER_EMAIL}!")

    finally:
        print("🛑 Shutting down backend...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()
        print("✅ Done!")


if __name__ == "__main__":
    seed_db()
