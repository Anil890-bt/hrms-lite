import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "hrms_lite")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

employees_collection = db["employees"]
attendance_collection = db["attendance"]


async def create_indexes():
    """Create database indexes for uniqueness constraints."""
    await employees_collection.create_index("employee_id", unique=True)
    await employees_collection.create_index("email", unique=True)
    await attendance_collection.create_index(
        [("employee_id", 1), ("date", 1)], unique=True
    )
