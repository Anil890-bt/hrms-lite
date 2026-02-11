from datetime import date
from fastapi import APIRouter, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from database import employees_collection, attendance_collection
from models import AttendanceCreate, AttendanceResponse

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@router.get("/summary")
async def get_attendance_summary():
    """Get dashboard summary stats."""
    total_employees = await employees_collection.count_documents({})

    today = date.today().isoformat()
    present_today = await attendance_collection.count_documents(
        {"date": today, "status": "Present"}
    )
    absent_today = await attendance_collection.count_documents(
        {"date": today, "status": "Absent"}
    )

    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": absent_today,
    }


@router.get("/{employee_id}", response_model=list[AttendanceResponse])
async def get_attendance(
    employee_id: str,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Get attendance records for an employee, optionally filtered by date range."""
    employee = await employees_collection.find_one({"employee_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    query: dict = {"employee_id": employee_id}

    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date.isoformat()
        if end_date:
            date_filter["$lte"] = end_date.isoformat()
        query["date"] = date_filter

    records = await attendance_collection.find(query).sort("date", -1).to_list(1000)
    return records


@router.post("/", response_model=AttendanceResponse, status_code=201)
async def mark_attendance(attendance: AttendanceCreate):
    """Mark or update attendance for an employee (upsert)."""
    employee = await employees_collection.find_one(
        {"employee_id": attendance.employee_id}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    doc = attendance.model_dump()
    doc["date"] = attendance.date.isoformat()

    # Use upsert to update if exists, insert if not
    await attendance_collection.update_one(
        {"employee_id": attendance.employee_id, "date": doc["date"]},
        {"$set": doc},
        upsert=True
    )

    return AttendanceResponse(
        employee_id=attendance.employee_id,
        date=doc["date"],
        status=attendance.status
    )
