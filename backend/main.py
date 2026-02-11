import os
import random
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_indexes, db
from routes.employees import router as employees_router
from routes.attendance import router as attendance_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    yield


app = FastAPI(
    title="HRMS Lite API",
    description="Lightweight Human Resource Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employees_router)
app.include_router(attendance_router)


@app.get("/")
async def health_check():
    return {"status": "ok", "message": "HRMS Lite API is running"}


@app.post("/api/seed")
async def seed_database():
    """Seed the database with sample employees and attendance data."""
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
    ]

    # Clear existing data
    await db["employees"].delete_many({})
    await db["attendance"].delete_many({})

    # Insert employees
    for emp in EMPLOYEES:
        emp["created_at"] = datetime.utcnow()
    await db["employees"].insert_many(EMPLOYEES)

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

    return {
        "status": "success",
        "message": f"Database seeded with {len(EMPLOYEES)} employees and {len(attendance_records)} attendance records"
    }
