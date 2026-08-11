#!/usr/bin/env python3
"""
Idempotent dev/demo seed for the ubiqedge water-billing DB.

Standalone — talks to MySQL directly via raw SQL (matching the backend's
TypeORM migrations column-for-column), so it has no dependency on the
backend's compiled TypeScript. Safe to re-run: every insert is guarded by a
find-by-natural-key check first.

Seeds org/roles/device-types/users/accounts/devices/pricing only — it
deliberately does NOT write any device_telemetry rows. Telemetry is the
meter-simulator/tank-simulator's job: they push readings for the serialNos
this script creates, via the ingestion-service.

Usage:
    pip install -r requirements.txt
    cp .env.example .env   # edit if your DB isn't on localhost:3306
    python seed.py
"""
import hashlib
import os
import secrets
import time
from datetime import datetime

import bcrypt
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()

ORG_ID = "ORG01"
ORG_NAME = "Rivergate Municipal Water Utility"
ORG_EMAIL_DOMAIN = "rivergatewater.in"
BCRYPT_ROUNDS = 10  # matches backend's BCRYPT_ROUNDS (user.service.ts)

ADMIN = {
    "firstName": "Priya",
    "lastName": "Nair",
    "email": f"priya.nair@{ORG_EMAIL_DOMAIN}",
    "phoneNumber": "9820011223",
    "address": "Water Utility HQ, Civic Centre, Sector 1, Rivergate",
    "pincode": "411001",
}

CUSTOMERS = [
    {
        "firstName": "Anjali",
        "lastName": "Deshpande",
        "email": "anjali.deshpande@gmail.com",
        "phoneNumber": "9823456701",
        "address": "Flat 302, Sunrise Residency, Church Road, Rivergate",
        "pincode": "411004",
    },
    {
        "firstName": "Rohan",
        "lastName": "Mehta",
        "email": "rohan.mehta@gmail.com",
        "phoneNumber": "9823456702",
        "address": "12, Laxmi Nagar, Riverside Lane, Rivergate",
        "pincode": "411038",
    },
    {
        "firstName": "Priyanka",
        "lastName": "Iyer",
        "email": "priyanka.iyer@gmail.com",
        "phoneNumber": "9823456703",
        "address": "Flat 15, Green Meadows, Station Road, Rivergate",
        "pincode": "411006",
    },
    {
        "firstName": "Karan",
        "lastName": "Malhotra",
        "email": "karan.malhotra@gmail.com",
        "phoneNumber": "9823456704",
        "address": "44, Model Colony, Ferguson Road, Rivergate",
        "pincode": "411016",
    },
    {
        "firstName": "Sneha",
        "lastName": "Reddy",
        "email": "sneha.reddy@gmail.com",
        "phoneNumber": "9823456705",
        "address": "Bungalow 7, Palm Grove, Airport Road, Rivergate",
        "pincode": "411032",
    },
    {
        "firstName": "Arjun",
        "lastName": "Nair",
        "email": "arjun.nair@gmail.com",
        "phoneNumber": "9823456706",
        "address": "Flat 208, Silver Oak Heights, MG Road, Rivergate",
        "pincode": "411001",
    },
    {
        "firstName": "Meera",
        "lastName": "Pillai",
        "email": "meera.pillai@gmail.com",
        "phoneNumber": "9823456707",
        "address": "23, Lakeview Society, Baner Road, Rivergate",
        "pincode": "411045",
    },
    {
        "firstName": "Vikram",
        "lastName": "Choudhary",
        "email": "vikram.choudhary@gmail.com",
        "phoneNumber": "9823456708",
        "address": "Row House 9, Elmwood Park, Kothrud Road, Rivergate",
        "pincode": "411029",
    },
    {
        "firstName": "Divya",
        "lastName": "Menon",
        "email": "divya.menon@gmail.com",
        "phoneNumber": "9823456709",
        "address": "Flat 501, Orchid Towers, Aundh Road, Rivergate",
        "pincode": "411007",
    },
    {
        "firstName": "Rahul",
        "lastName": "Kapoor",
        "email": "rahul.kapoor@gmail.com",
        "phoneNumber": "9823456710",
        "address": "18, Sunflower Enclave, Wakad Road, Rivergate",
        "pincode": "411057",
    },
]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


def hash_api_key(plain: str) -> str:
    # SHA-256, not bcrypt: this key is a high-entropy random secret, not a
    # user-chosen password — slow hashing buys no brute-force resistance
    # here and only adds latency to every ingest call. See data model.
    return hashlib.sha256(plain.encode()).hexdigest()


def format_account_no(org_id: str, row_id: int) -> str:
    return f"{org_id}-{row_id:06d}"


def format_serial_no(org_id: str, device_type: str, row_id: int) -> str:
    return f"{org_id}-{device_type}-{row_id:06d}"


def fetch_one(cur, sql: str, params=()):
    cur.execute(sql, params)
    return cur.fetchone()


def create_spare_devices(cur, device_type_id: int, dtype: str, label: str, target_unassigned_count: int) -> None:
    existing = fetch_one(
        cur,
        "SELECT COUNT(*) AS n FROM device WHERE deviceTypeId = %s AND connectionId IS NULL AND orgId = %s",
        (device_type_id, ORG_ID),
    )
    to_create = target_unassigned_count - existing["n"]
    for i in range(to_create):
        placeholder = f"PENDING-{int(time.time() * 1000)}-SPARE-{dtype}-{i}"
        device_name = f"Spare {label} #{existing['n'] + i + 1}"
        cur.execute(
            "INSERT INTO device (name, serialNo, deviceTypeId, connectionId, orgId) VALUES (%s, %s, %s, NULL, %s)",
            (device_name, placeholder, device_type_id, ORG_ID),
        )
        device_id = cur.lastrowid
        serial_no = format_serial_no(ORG_ID, dtype, device_id)
        cur.execute("UPDATE device SET serialNo = %s WHERE id = %s", (serial_no, device_id))
        print(f"Created device {serial_no} ({dtype}, unassigned)")


def seed(cur):
    # --- organization ---
    org = fetch_one(cur, "SELECT id FROM organization WHERE id = %s", (ORG_ID,))
    if not org:
        # plaintext API key exists only for this one printed line — only the
        # SHA-256 hash is persisted. Simulators need this value in their own
        # .env (X-Api-Key header); if it's lost, there's no way to recover
        # it — only reset it (re-run with a fresh key, requires an UPDATE).
        api_key = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO organization (id, name, apiKeySecretHash) VALUES (%s, %s, %s)",
            (ORG_ID, ORG_NAME, hash_api_key(api_key)),
        )
        print(f"Created organization {ORG_ID}")
        print(f"  Ingestion API key (save this — shown only once): {api_key}")

    # --- roles ---
    role_ids = {}
    for role_type, display_name in [("Admin", "Admin"), ("Customer", "Customer")]:
        row = fetch_one(
            cur, "SELECT id FROM role WHERE type = %s AND orgId = %s", (role_type, ORG_ID)
        )
        if not row:
            cur.execute(
                "INSERT INTO role (type, displayName, orgId) VALUES (%s, %s, %s)",
                (role_type, display_name, ORG_ID),
            )
            role_ids[role_type] = cur.lastrowid
            print(f"Created {role_type} role")
        else:
            role_ids[role_type] = row["id"]

    # --- device types ---
    device_type_ids = {}
    for dtype, billed in [("METER", 1), ("TANK", 0)]:
        row = fetch_one(
            cur, "SELECT id FROM device_type WHERE type = %s AND orgId = %s", (dtype, ORG_ID)
        )
        if not row:
            cur.execute(
                "INSERT INTO device_type (type, billed, orgId) VALUES (%s, %s, %s)",
                (dtype, billed, ORG_ID),
            )
            device_type_ids[dtype] = cur.lastrowid
            print(f"Created {dtype} device type")
        else:
            device_type_ids[dtype] = row["id"]

    # --- device type params (unique per (paramKey, orgId), see data model) ---
    param_defs = [
        ("TOTAL", "Total Consumption", device_type_ids["METER"]),
        ("FLOW", "Instantaneous Flow Rate", device_type_ids["METER"]),
        ("LEVEL", "Tank Water Level", device_type_ids["TANK"]),
    ]
    for param_key, display_name, device_type_id in param_defs:
        row = fetch_one(
            cur, "SELECT id FROM device_type_param WHERE paramKey = %s AND orgId = %s", (param_key, ORG_ID)
        )
        if not row:
            cur.execute(
                "INSERT INTO device_type_param (deviceTypeId, paramKey, displayName, orgId) "
                "VALUES (%s, %s, %s, %s)",
                (device_type_id, param_key, display_name, ORG_ID),
            )
            print(f"Created device_type_param {param_key}")

    # --- admin user ---
    admin = fetch_one(cur, "SELECT id FROM user WHERE email = %s", (ADMIN["email"],))
    if not admin:
        cur.execute(
            "INSERT INTO user (firstName, lastName, email, passwordHash, phoneNumber, address, "
            "pincode, orgId, roleId) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                ADMIN["firstName"],
                ADMIN["lastName"],
                ADMIN["email"],
                hash_password("Admin@12345"),
                ADMIN["phoneNumber"],
                ADMIN["address"],
                ADMIN["pincode"],
                ORG_ID,
                role_ids["Admin"],
            ),
        )
        print(f"Created admin user {ADMIN['email']}")

    # --- demo customers, each with an account (connection) + one meter + one tank ---
    for c in CUSTOMERS:
        customer = fetch_one(cur, "SELECT id FROM user WHERE email = %s", (c["email"],))
        if not customer:
            cur.execute(
                "INSERT INTO user (firstName, lastName, email, passwordHash, phoneNumber, address, "
                "pincode, orgId, roleId) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    c["firstName"],
                    c["lastName"],
                    c["email"],
                    hash_password("Customer@12345"),
                    c["phoneNumber"],
                    c["address"],
                    c["pincode"],
                    ORG_ID,
                    role_ids["Customer"],
                ),
            )
            customer_id = cur.lastrowid
            print(f"Created customer user {c['email']}")
        else:
            customer_id = customer["id"]

        connection = fetch_one(
            cur, "SELECT id, accountNo FROM customer_connection WHERE userId = %s", (customer_id,)
        )
        if not connection:
            # two-step generation, same pattern as AccountService.create:
            # insert a placeholder to satisfy NOT NULL, then set the real
            # value once the row's own auto-increment id exists
            placeholder = f"PENDING-{int(time.time() * 1000)}-{customer_id}"
            cur.execute(
                "INSERT INTO customer_connection (accountNo, userId, orgId) VALUES (%s, %s, %s)",
                (placeholder, customer_id, ORG_ID),
            )
            connection_id = cur.lastrowid
            account_no = format_account_no(ORG_ID, connection_id)
            cur.execute(
                "UPDATE customer_connection SET accountNo = %s WHERE id = %s", (account_no, connection_id)
            )
            print(f"Created account {account_no} for {c['email']}")
        else:
            connection_id = connection["id"]

        for dtype, label in [("METER", "Domestic Water Meter"), ("TANK", "Overhead Tank")]:
            device_type_id = device_type_ids[dtype]
            existing = fetch_one(
                cur,
                "SELECT id FROM device WHERE connectionId = %s AND deviceTypeId = %s",
                (connection_id, device_type_id),
            )
            if existing:
                continue
            placeholder = f"PENDING-{int(time.time() * 1000)}-{dtype}"
            device_name = f"{label} - {c['address']}"
            cur.execute(
                "INSERT INTO device (name, serialNo, deviceTypeId, connectionId, orgId) "
                "VALUES (%s, %s, %s, %s, %s)",
                (device_name, placeholder, device_type_id, connection_id, ORG_ID),
            )
            device_id = cur.lastrowid
            serial_no = format_serial_no(ORG_ID, dtype, device_id)
            cur.execute("UPDATE device SET serialNo = %s WHERE id = %s", (serial_no, device_id))
            print(f"Created device {serial_no} ({dtype}) for {c['email']}")

    # --- spare inventory devices: added to inventory but not yet linked to
    # an account, e.g. newly installed devices awaiting assignment. Brings
    # the org to 20 meters (10 assigned above + 10 unassigned) and 15 tanks
    # (10 assigned + 5 unassigned) — a realistic assigned/unassigned mix for
    # testing the devices list's "unassigned only" filter.
    create_spare_devices(cur, device_type_ids["METER"], "METER", "Domestic Water Meter", 10)
    create_spare_devices(cur, device_type_ids["TANK"], "TANK", "Overhead Tank", 5)

    # --- pricing: SLAB rate for METER (the only billed device type) ---
    active_meter_config = fetch_one(
        cur,
        "SELECT id FROM pricing_config WHERE deviceTypeId = %s AND orgId = %s AND effectiveTo IS NULL",
        (device_type_ids["METER"], ORG_ID),
    )
    if not active_meter_config:
        effective_from = datetime(2026, 1, 1)  # well before any demo telemetry
        cur.execute(
            "INSERT INTO pricing_config (deviceTypeId, rateType, fixedRate, effectiveFrom, effectiveTo, orgId) "
            "VALUES (%s, %s, NULL, %s, NULL, %s)",
            (device_type_ids["METER"], "SLAB", effective_from, ORG_ID),
        )
        config_id = cur.lastrowid
        slabs = [
            ("0", "10", "10.0000"),
            ("10", "20", "15.0000"),
            ("20", None, "20.0000"),
        ]
        for slab_from, slab_to, rate in slabs:
            cur.execute(
                "INSERT INTO pricing_slab (pricingConfigId, slabFrom, slabTo, rate) VALUES (%s, %s, %s, %s)",
                (config_id, slab_from, slab_to, rate),
            )
        print("Created SLAB pricing config for METER")


def main():
    conn = pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USERNAME", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "ubiqedge_water_billing"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )
    print("Connected. Seeding...")
    try:
        with conn.cursor() as cur:
            seed(cur)
        conn.commit()
        print("Seed complete.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
