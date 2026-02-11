# HRMS Lite

A lightweight Human Resource Management System for managing employee records and tracking daily attendance.

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Frontend   | React 19, Vite, Tailwind CSS v4, shadcn/ui |
| Backend    | Python, FastAPI                    |
| Database   | MongoDB (Motor async driver)       |
| Deployment | Vercel (Frontend), Render (Backend) |

## Features

- **Employee Management** - Add, view, and delete employee records
- **Attendance Tracking** - Mark daily attendance (Present/Absent) per employee
- **Dashboard** - Summary view with total employees, present/absent counts
- **Date Filtering** - Filter attendance records by date range
- **Validation** - Server-side validation for emails, duplicates, and required fields
- **UI States** - Loading spinners, empty states, and error alerts

## Project Structure

```
hrms-lite/
├── backend/
│   ├── main.py            # FastAPI app with CORS
│   ├── models.py          # Pydantic request/response models
│   ├── database.py        # MongoDB connection & indexes
│   └── routes/
│       ├── employees.py   # Employee CRUD endpoints
│       └── attendance.py  # Attendance endpoints
├── frontend/
│   └── src/
│       ├── api.js         # Axios API service layer
│       ├── components/    # Reusable UI components
│       └── pages/         # Page components
└── README.md
```

## API Endpoints

### Employees

| Method | Endpoint                     | Description         |
| ------ | ---------------------------- | ------------------- |
| GET    | `/api/employees`             | List all employees  |
| POST   | `/api/employees`             | Add a new employee  |
| DELETE | `/api/employees/{employee_id}` | Delete an employee |

### Attendance

| Method | Endpoint                            | Description                  |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/attendance/{employee_id}`     | Get attendance records       |
| POST   | `/api/attendance`                   | Mark attendance              |
| GET    | `/api/attendance/summary`           | Dashboard summary stats      |

## Running Locally

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Update MONGODB_URI if needed
uvicorn main:app --reload
```

The API will be available at `http://localhost:6202`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # Update VITE_API_URL if needed
npm run dev
```

The app will be available at `http://localhost:5173`.

## Assumptions & Limitations

- Single admin user (no authentication required as per assignment spec)
- Leave management, payroll, and advanced HR features are out of scope
- Attendance is limited to Present/Absent status per day per employee
- Employee ID is manually entered (not auto-generated) to allow custom IDs
