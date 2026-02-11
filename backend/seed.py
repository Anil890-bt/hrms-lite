"""
Seed script to populate the database with Indian dummy data.
Run: python seed.py
"""

import asyncio
import random
from datetime import date, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "hrms_lite")

EMPLOYEES = [
    {"employee_id": "EMP001", "full_name": "Aarav Sharma", "email": "aarav.sharma@company.in", "department": "Engineering"},
    {"employee_id": "EMP002", "full_name": "Priya Patel", "email": "priya.patel@company.in", "department": "Engineering"},
    {"employee_id": "EMP003", "full_name": "Rohan Gupta", "email": "rohan.gupta@company.in", "department": "Design"},
    {"employee_id": "EMP004", "full_name": "Ananya Iyer", "email": "ananya.iyer@company.in", "department": "Marketing"},
    {"employee_id": "EMP005", "full_name": "Vikram Singh", "email": "vikram.singh@company.in", "department": "Engineering"},
    {"employee_id": "EMP006", "full_name": "Neha Reddy", "email": "neha.reddy@company.in", "department": "HR"},
    {"employee_id": "EMP007", "full_name": "Arjun Nair", "email": "arjun.nair@company.in", "department": "Finance"},
    {"employee_id": "EMP008", "full_name": "Kavya Joshi", "email": "kavya.joshi@company.in", "department": "Design"},
    {"employee_id": "EMP009", "full_name": "Rahul Verma", "email": "rahul.verma@company.in", "department": "Marketing"},
    {"employee_id": "EMP010", "full_name": "Meera Kulkarni", "email": "meera.kulkarni@company.in", "department": "HR"},
    {"employee_id": "EMP011", "full_name": "Aditya Mehta", "email": "aditya.mehta@company.in", "department": "Engineering"},
    {"employee_id": "EMP012", "full_name": "Shreya Banerjee", "email": "shreya.banerjee@company.in", "department": "Finance"},
]

async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]

    # Clear existing data
    await db["employees"].delete_many({})
    await db["attendance"].delete_many({})
    print("Cleared existing data.")

    # Create indexes
    await db["employees"].create_index("employee_id", unique=True)
    await db["employees"].create_index("email", unique=True)
    await db["attendance"].create_index([("employee_id", 1), ("date", 1)], unique=True)

    # Insert employees
    for emp in EMPLOYEES:
        emp["created_at"] = datetime.utcnow()
    await db["employees"].insert_many(EMPLOYEES)
    print(f"Inserted {len(EMPLOYEES)} employees.")

    # Generate attendance for last 14 days (including today)
    today = date.today()
    attendance_records = []

    for emp in EMPLOYEES:
        for days_ago in range(14):
            d = today - timedelta(days=days_ago)
            # Skip weekends
            if d.weekday() >= 5:
                continue
            # 85% chance of being present
            status = "Present" if random.random() < 0.85 else "Absent"
            attendance_records.append({
                "employee_id": emp["employee_id"],
                "date": d.isoformat(),
                "status": status,
            })

    await db["attendance"].insert_many(attendance_records)
    print(f"Inserted {len(attendance_records)} attendance records.")

    client.close()
    print("Seed completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
