import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://hrms-lite-production-5ef7.up.railway.app";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Employee APIs
export const getEmployees = () => api.get("/api/employees");

export const createEmployee = (data) => api.post("/api/employees", data);

export const deleteEmployee = (employeeId) =>
  api.delete(`/api/employees/${employeeId}`);

// Attendance APIs
export const getAttendance = (employeeId, params = {}) =>
  api.get(`/api/attendance/${employeeId}`, { params });

export const markAttendance = (data) => api.post("/api/attendance", data);

export const getAttendanceSummary = () => api.get("/api/attendance/summary");

export default api;
