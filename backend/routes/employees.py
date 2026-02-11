from datetime import datetime
from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from database import employees_collection, attendance_collection
from models import EmployeeCreate, EmployeeResponse

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.get("/", response_model=list[EmployeeResponse])
async def get_employees():
    """Retrieve all employees."""
    employees = await employees_collection.find().sort("created_at", -1).to_list(1000)
    return employees


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(employee: EmployeeCreate):
    """Add a new employee."""
    doc = employee.model_dump()
    doc["created_at"] = datetime.utcnow()

    try:
        await employees_collection.insert_one(doc)
    except DuplicateKeyError:
        existing = await employees_collection.find_one({
            "$or": [
                {"employee_id": employee.employee_id},
                {"email": employee.email},
            ]
        })
        if existing and existing["employee_id"] == employee.employee_id:
            raise HTTPException(
                status_code=409,
                detail=f"Employee with ID '{employee.employee_id}' already exists",
            )
        raise HTTPException(
            status_code=409,
            detail=f"Employee with email '{employee.email}' already exists",
        )

    return doc


@router.delete("/{employee_id}", status_code=200)
async def delete_employee(employee_id: str):
    """Delete an employee and their attendance records."""
    result = await employees_collection.delete_one({"employee_id": employee_id})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"Employee with ID '{employee_id}' not found",
        )

    await attendance_collection.delete_many({"employee_id": employee_id})

    return {"message": f"Employee '{employee_id}' deleted successfully"}
