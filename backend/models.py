from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, EmailStr, Field


class AttendanceStatus(str, Enum):
    PRESENT = "Present"
    ABSENT = "Absent"


# --- Employee Models ---

class EmployeeCreate(BaseModel):
    employee_id: str = Field(..., min_length=1, description="Unique employee ID")
    full_name: str = Field(..., min_length=1, description="Full name of the employee")
    email: EmailStr = Field(..., description="Email address")
    department: str = Field(..., min_length=1, description="Department name")


class EmployeeResponse(BaseModel):
    employee_id: str
    full_name: str
    email: str
    department: str
    created_at: datetime | None = None


# --- Attendance Models ---

class AttendanceCreate(BaseModel):
    employee_id: str = Field(..., min_length=1)
    date: date
    status: AttendanceStatus


class AttendanceResponse(BaseModel):
    employee_id: str
    date: str
    status: AttendanceStatus
