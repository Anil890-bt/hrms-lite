import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users, UserCheck, UserX, CalendarDays, RefreshCw,
  MoreHorizontal, Building2, Activity, Settings2, SlidersHorizontal,
  TrendingUp, ArrowUpDown, Download, Plus, ChevronDown, Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Label,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as FormLabel } from "@/components/ui/label";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorAlert from "@/components/ErrorAlert";
import { useFilters } from "@/components/Layout";
import { useEmployees, useAttendanceSummary, useCreateEmployee, useMarkAttendance } from "@/hooks/useQueries";
import { getAttendance } from "@/api";

const PIE_COLORS = ["#0cbaba", "#ef4444", "#f59e0b"];
const STATUS_COLORS = {
  employment: ["#0cbaba", "#ef4444"],
  gender: ["#0cbaba", "#ef4444"],
  experience: ["#0cbaba", "#ef4444", "#f59e0b"],
};

// ─── Self-contained dropdown for "..." menus ────────────────────────────────
function CardDropdown({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!items || items.length === 0) {
    return (
      <button className="p-1 rounded-md text-muted-foreground/40 cursor-default shrink-0">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors shrink-0"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          {items.map(({ label, icon: Icon, onClick, divider }) => (
            divider ? (
              <div key={label} className="border-t border-border my-1" />
            ) : (
              <button
                key={label}
                onClick={() => { onClick?.(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                {label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// Mini donut for Employee Status Summary
function MiniDonut({ title, data, colors, rate }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <ResponsiveContainer width="100%" height={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={32}
            outerRadius={46}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => <Cell key={i} fill={colors[i] ?? "#e5e7eb"} />)}
            <Label
              content={({ viewBox }) => {
                const { cx, cy } = viewBox ?? {};
                if (!cx || !cy || isNaN(cx) || isNaN(cy)) return null;
                return (
                  <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111827">
                    {rate}%
                  </text>
                );
              }}
              position="center"
            />
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cce8e7" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs font-medium text-foreground text-center leading-tight">{title}</p>
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors[i] ?? "#e5e7eb" }} />
            <span className="text-[10px] text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const initialFormState = { employee_id: "", full_name: "", email: "", department: "" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Smart text formatting
const capitalizeWords = (str) => {
  return str.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Find matching department (case-insensitive)
const findMatchingDept = (input, departments) => {
  const normalized = input.trim().toLowerCase();
  return departments.find(d => d.toLowerCase() === normalized);
};

export default function DashboardPage() {
  const { selectedDept, setSelectedDept, setDepartments } = useFilters();

  // React Query hooks
  const { data: employees = [], isLoading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useEmployees();
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useAttendanceSummary();
  const createEmployeeMutation = useCreateEmployee();
  const markAttendanceMutation = useMarkAttendance();

  const [todayFilter, setTodayFilter] = useState("today");
  const [barPeriod, setBarPeriod] = useState("all");
  const [barSort, setBarSort] = useState("count-desc");
  const [trendPeriod, setTrendPeriod] = useState("7");

  // Employee dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [showDeptSuggestions, setShowDeptSuggestions] = useState(false);
  const deptInputRef = useRef(null);

  // Employee attendance details state
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Real attendance data
  const [todayAttendance, setTodayAttendance] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const loading = employeesLoading || summaryLoading;
  const error = employeesError || summaryError;

  const [refreshing, setRefreshing] = useState(false);

  // Fetch today's attendance for all employees
  const TODAY = new Date().toISOString().split("T")[0];

  const fetchTodayAttendance = async (empList) => {
    if (!empList || empList.length === 0) return;
    setLoadingAttendance(true);
    try {
      const results = await Promise.all(
        empList.map((emp) =>
          getAttendance(emp.employee_id, { start_date: TODAY, end_date: TODAY })
            .then(({ data }) => ({ id: emp.employee_id, record: data[0] || null }))
            .catch(() => ({ id: emp.employee_id, record: null }))
        )
      );
      const statusMap = {};
      results.forEach(({ id, record }) => {
        statusMap[id] = record ? record.status : "Not Marked";
      });
      setTodayAttendance(statusMap);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Fetch attendance when employees load
  useEffect(() => {
    if (employees.length > 0) {
      fetchTodayAttendance(employees);
    }
  }, [employees]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    await Promise.all([refetchEmployees(), refetchSummary()]);
    if (isRefresh) setRefreshing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Special handling for department field
    if (name === "department") {
      setForm((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({ ...prev, [name]: null }));
      setShowDeptSuggestions(value.trim().length > 0);
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleDeptSelect = (dept) => {
    setForm((prev) => ({ ...prev, department: dept }));
    setFormErrors((prev) => ({ ...prev, department: null }));
    setShowDeptSuggestions(false);
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deptInputRef.current && !deptInputRef.current.contains(e.target)) {
        setShowDeptSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!form.employee_id.trim()) errors.employee_id = "Employee ID is required";
    if (!form.full_name.trim()) errors.full_name = "Full name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!EMAIL_REGEX.test(form.email)) errors.email = "Please enter a valid email address";
    if (!form.department.trim()) errors.department = "Department is required";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});

    // Smart department formatting and matching
    let finalDept = form.department.trim();
    const matchingDept = findMatchingDept(finalDept, depts);

    if (matchingDept) {
      // Use existing department (preserves original case)
      finalDept = matchingDept;
    } else {
      // New department - capitalize properly
      finalDept = capitalizeWords(finalDept);
    }

    try {
      await createEmployeeMutation.mutateAsync({
        ...form,
        employee_id: form.employee_id.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        department: finalDept,
      });
      setForm(initialFormState);
      setDialogOpen(false);
      setShowDeptSuggestions(false);
      toast.success("Employee added successfully");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.toLowerCase().includes("email")) setFormErrors({ email: detail });
      else if (detail?.toLowerCase().includes("id")) setFormErrors({ employee_id: detail });
      else setFormErrors({ _general: detail || "Failed to add employee. Please try again." });
    }
  };

  const depts = useMemo(
    () => [...new Set(employees.map((e) => e.department))].sort(),
    [employees],
  );

  // Filter department suggestions based on input
  const deptSuggestions = useMemo(() => {
    if (!form.department.trim()) return depts;
    const query = form.department.toLowerCase();
    return depts.filter(d => d.toLowerCase().includes(query));
  }, [form.department, depts]);

  // Push to context so Layout header dropdown can list them
  useEffect(() => {
    if (depts.length > 0) setDepartments(depts);
  }, [depts, setDepartments]);

  const deptMap = useMemo(() => {
    const map = {};
    employees.forEach((emp) => { map[emp.department] = (map[emp.department] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const filteredEmployees = useMemo(
    () => selectedDept === "all" ? employees : employees.filter((e) => e.department === selectedDept),
    [employees, selectedDept],
  );

  // Calculate department-specific stats (proportional to employee count)
  const deptRatio = useMemo(() => {
    if (employees.length === 0) return 1;
    return filteredEmployees.length / employees.length;
  }, [filteredEmployees.length, employees.length]);

  // Get real attendance status for employees
  const getEmployeeAttendanceStatus = useMemo(() => (emp) => {
    return todayAttendance[emp.employee_id] || "Not Marked";
  }, [todayAttendance]);

  // Group employees by department with attendance
  const employeesByDept = useMemo(() => {
    const grouped = {};
    filteredEmployees.forEach((emp) => {
      if (!grouped[emp.department]) {
        grouped[emp.department] = { present: [], absent: [], notMarked: [] };
      }
      const status = getEmployeeAttendanceStatus(emp);
      const empData = { ...emp, attendanceStatus: status };

      if (status === "Present") grouped[emp.department].present.push(empData);
      else if (status === "Absent") grouped[emp.department].absent.push(empData);
      else grouped[emp.department].notMarked.push(empData);
    });
    return grouped;
  }, [filteredEmployees, getEmployeeAttendanceStatus]);

  // Filter employees for attendance details card
  const filteredAttendanceEmployees = useMemo(() => {
    let allEmps = filteredEmployees.map(emp => ({
      ...emp,
      attendanceStatus: getEmployeeAttendanceStatus(emp)
    }));

    // Filter by status
    if (attendanceStatusFilter !== "all") {
      allEmps = allEmps.filter(emp => emp.attendanceStatus === attendanceStatusFilter);
    }

    // Filter by search
    if (attendanceSearch.trim()) {
      const query = attendanceSearch.toLowerCase();
      allEmps = allEmps.filter(emp =>
        emp.full_name.toLowerCase().includes(query) ||
        emp.employee_id.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
      );
    }

    return allEmps;
  }, [filteredEmployees, attendanceStatusFilter, attendanceSearch, getEmployeeAttendanceStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAttendanceEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAttendanceEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAttendanceEmployees, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [attendanceSearch, attendanceStatusFilter, selectedDept]);

  // Group filtered employees by department (for old accordion view if needed)
  const filteredEmployeesByDept = useMemo(() => {
    const grouped = {};
    filteredAttendanceEmployees.forEach((emp) => {
      if (!grouped[emp.department]) {
        grouped[emp.department] = [];
      }
      grouped[emp.department].push(emp);
    });
    return grouped;
  }, [filteredAttendanceEmployees]);

  // ⚠️ Must be before early returns to follow Rules of Hooks
  const barData = useMemo(() => {
    // When a department is selected, show only that department
    if (selectedDept !== "all") {
      const deptData = deptMap.find((d) => d.name === selectedDept);
      return deptData ? [deptData] : [];
    }
    // Otherwise show all/top departments
    let data = barPeriod === "all" ? deptMap : deptMap.slice(0, barPeriod === "top5" ? 5 : 3);
    if (barSort === "count-asc") return [...data].sort((a, b) => a.count - b.count);
    if (barSort === "name-asc") return [...data].sort((a, b) => a.name.localeCompare(b.name));
    return data;
  }, [deptMap, barPeriod, barSort, selectedDept]);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;
  if (error) return <ErrorAlert message="Failed to load dashboard data." onRetry={() => fetchData()} />;
  if (!summary) return <LoadingSpinner text="Loading dashboard..." />;

  // Calculate attendance stats (proportional when filtered)
  const totalEmployees = filteredEmployees.length;
  const presentToday = Math.round(summary.present_today * deptRatio);
  const absentToday = Math.round(summary.absent_today * deptRatio);
  const todayMarked = presentToday + absentToday;
  const unmarked = Math.max(0, totalEmployees - todayMarked);
  const attendanceRate = todayMarked > 0
    ? Math.round((presentToday / todayMarked) * 100)
    : 0;
  const absentRate = todayMarked > 0 ? 100 - attendanceRate : 0;

  const pieData = [
    { name: "Present", value: presentToday },
    { name: "Absent", value: absentToday },
    { name: "Unmarked", value: unmarked },
  ].filter((d) => d.value > 0);

  // Attendance trend data (last N days, deterministic)
  const days = trendPeriod === "7" ? 7 : 14;
  const mockRates = [68, 72, 65, 75, 70, 78, 74, 80, 73, 77, 71, 82, 76, attendanceRate];
  const trendData = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rate: i === days - 1 ? attendanceRate : mockRates[i % mockRates.length],
    };
  });
  const trendDiff = attendanceRate - (trendData[0]?.rate ?? attendanceRate);

  // Employee status summary – illustrative mock data (based on filtered employees)
  const total = Math.max(filteredEmployees.length, 1);
  const statusData = [
    {
      title: "Employment Type",
      colors: STATUS_COLORS.employment,
      rate: 80,
      data: [{ name: "Full-Time", value: Math.round(total * 0.8) }, { name: "Part-Time", value: Math.round(total * 0.2) }],
    },
    {
      title: "Gender Distribution",
      colors: STATUS_COLORS.gender,
      rate: 40,
      data: [{ name: "Female", value: Math.round(total * 0.4) }, { name: "Male", value: Math.round(total * 0.6) }],
    },
    {
      title: "Experience Level",
      colors: STATUS_COLORS.experience,
      rate: 40,
      data: [{ name: "Junior", value: Math.round(total * 0.4) }, { name: "Senior", value: Math.round(total * 0.2) }, { name: "Mid", value: Math.round(total * 0.4) }],
    },
  ];

  const statCards = [
    {
      title: "Total Employees",
      value: totalEmployees,
      icon: Users,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
      sub: selectedDept === "all"
        ? `${depts.length} department${depts.length !== 1 ? "s" : ""}`
        : `${selectedDept} department`,
    },
    {
      title: "Present Today",
      value: presentToday,
      icon: UserCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      sub: todayMarked > 0 ? `${attendanceRate}% attendance rate` : "No records yet",
      badge: attendanceRate > 0 ? `+${attendanceRate}%` : null,
      badgeColor: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Absent Today",
      value: absentToday,
      icon: UserX,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
      sub: todayMarked > 0 ? `${absentRate}% absence rate` : "No records yet",
      badge: absentRate > 0 ? `${absentRate}%` : null,
      badgeColor: "bg-red-50 text-red-500",
    },
    {
      title: "Not Marked",
      value: unmarked,
      icon: CalendarDays,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      sub: `${todayMarked} of ${totalEmployees} marked`,
    },
  ];

  const handleExport = (label) => toast.success(`${label} exported`, { description: "Download will start shortly." });

  // Toggle department expansion
  const toggleDept = (dept) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Clean unified filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-border rounded-xl px-3 sm:px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Departments</SelectItem>
              {depts.map((d) => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedDept !== "all" && (
            <button
              onClick={() => setSelectedDept("all")}
              className="text-xs text-red-500 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-1.5 text-muted-foreground hover:text-teal-600 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-teal-600 rounded-lg hover:bg-muted transition-colors" title="Settings">
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Add Employee dialog */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) { setForm(initialFormState); setFormErrors({}); }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-teal-500 hover:bg-teal-600 text-white h-8 text-xs px-3 shrink-0">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Add Employee</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>Quickly add a new employee to your organization.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formErrors._general && (
                  <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {formErrors._general}
                  </div>
                )}
                <div className="space-y-1.5">
                  <FormLabel htmlFor="employee_id">Employee ID</FormLabel>
                  <Input
                    id="employee_id" name="employee_id" placeholder="e.g. EMP001"
                    value={form.employee_id} onChange={handleInputChange}
                    className={formErrors.employee_id ? "border-red-400 focus-visible:ring-red-300" : ""}
                  />
                  {formErrors.employee_id && <p className="text-xs text-red-500">{formErrors.employee_id}</p>}
                </div>

                <div className="space-y-1.5">
                  <FormLabel htmlFor="full_name">Full Name</FormLabel>
                  <Input
                    id="full_name" name="full_name" placeholder="John Doe"
                    value={form.full_name} onChange={handleInputChange}
                    className={formErrors.full_name ? "border-red-400 focus-visible:ring-red-300" : ""}
                  />
                  {formErrors.full_name && <p className="text-xs text-red-500">{formErrors.full_name}</p>}
                </div>

                <div className="space-y-1.5">
                  <FormLabel htmlFor="email">Email Address</FormLabel>
                  <Input
                    id="email" name="email" type="email" placeholder="john@company.com"
                    value={form.email} onChange={handleInputChange}
                    className={formErrors.email ? "border-red-400 focus-visible:ring-red-300" : ""}
                  />
                  {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                </div>

                <div className="space-y-1.5 relative" ref={deptInputRef}>
                  <FormLabel htmlFor="department">
                    Department
                    {depts.length > 0 && <span className="text-xs text-muted-foreground ml-1">(type to search or add new)</span>}
                  </FormLabel>
                  <Input
                    id="department" name="department" placeholder="Engineering"
                    value={form.department}
                    onChange={handleInputChange}
                    onFocus={() => setShowDeptSuggestions(form.department.trim().length > 0 || depts.length > 0)}
                    className={formErrors.department ? "border-red-400 focus-visible:ring-red-300" : ""}
                    autoComplete="off"
                  />
                  {showDeptSuggestions && deptSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {deptSuggestions.map((dept) => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => handleDeptSelect(dept)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 hover:text-teal-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{dept}</span>
                            <span className="text-xs text-muted-foreground">
                              {employees.filter(e => e.department === dept).length} employees
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {formErrors.department && <p className="text-xs text-red-500">{formErrors.department}</p>}
                  {form.department && !findMatchingDept(form.department, depts) && (
                    <p className="text-xs text-teal-600 flex items-center gap-1 mt-1">
                      <Plus className="h-3 w-3" />
                      New department: "{capitalizeWords(form.department.trim())}"
                    </p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createEmployeeMutation.isPending} className="bg-teal-500 hover:bg-teal-600">
                    {createEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ title, value, icon: Icon, iconColor, iconBg, sub, badge, badgeColor }) => (
          <Card key={title} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${iconBg}`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-1">{value}</p>
              <p className="text-xs sm:text-sm lg:text-base font-semibold text-foreground leading-snug">{title}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {badge && (
                  <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                    {badge}
                  </span>
                )}
                {sub && <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground leading-tight">{sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Attendance */}
        <Card>
          <CardHeader className="pb-1 px-5 pt-5">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm lg:text-base font-bold">Today's Attendance</CardTitle>
                <CardDescription className="text-xs lg:text-sm mt-0.5">
                  {selectedDept === "all"
                    ? `${depts.length} department${depts.length !== 1 ? "s" : ""}`
                    : `${selectedDept} department`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Select value={todayFilter} onValueChange={setTodayFilter}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today" className="text-xs">Today</SelectItem>
                    <SelectItem value="yesterday" className="text-xs">Yesterday</SelectItem>
                    <SelectItem value="week" className="text-xs">This Week</SelectItem>
                  </SelectContent>
                </Select>
                {/* "..." — refresh + export only (period filter is already in dropdown above) */}
                <CardDropdown items={[
                  { label: "Refresh", icon: RefreshCw, onClick: () => fetchData(true) },
                  { label: "Export CSV", icon: Download, onClick: () => handleExport("Attendance") },
                ]} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {pieData.length > 0 ? (
              <>
                <div className="grid grid-cols-3 items-center gap-2">
                  {/* Present - left */}
                  <div className="text-right pr-2">
                    <p className="text-2xl lg:text-3xl font-bold text-teal-600">{attendanceRate}%</p>
                    <p className="text-xs lg:text-sm font-medium text-muted-foreground mt-0.5">Present</p>
                    <p className="text-sm lg:text-base font-bold text-foreground">{presentToday}</p>
                  </div>

                  {/* Donut - center */}
                  <div>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          <Label
                            content={({ viewBox }) => {
                              const { cx, cy } = viewBox ?? {};
                              if (!cx || !cy || isNaN(cx) || isNaN(cy)) return null;
                              return (
                                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight={700} fill="#111827">
                                  {attendanceRate}%
                                </text>
                              );
                            }}
                            position="center"
                          />
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cce8e7" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Absent - right */}
                  <div className="text-left pl-2">
                    <p className="text-2xl lg:text-3xl font-bold text-red-500">{absentRate}%</p>
                    <p className="text-xs lg:text-sm font-medium text-muted-foreground mt-0.5">Absent</p>
                    <p className="text-sm lg:text-base font-bold text-foreground">
                      {absentToday}
                      {absentRate > 0 && <span className="text-xs lg:text-sm text-muted-foreground ml-1">{absentRate}%</span>}
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center items-center gap-4 mt-3 flex-wrap">
                  {[
                    { label: "Present", val: presentToday, color: "#0cbaba" },
                    { label: "Absent", val: absentToday, color: "#ef4444" },
                    { label: "Unmarked", val: unmarked, color: "#f59e0b" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-xs lg:text-sm text-muted-foreground">{label}</span>
                      <span className="text-xs lg:text-sm font-bold text-foreground">{val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-44 gap-2">
                <Activity className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Mark attendance to see breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employees by Department */}
        <Card>
          <CardHeader className="pb-1 px-5 pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-sm lg:text-base font-bold">
                  {selectedDept === "all" ? "Employees by Department" : `${selectedDept} Department`}
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm mt-0.5">
                  {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""}
                  {selectedDept === "all" && ` · ${deptMap.length} dept${deptMap.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={barPeriod} onValueChange={setBarPeriod}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Depts</SelectItem>
                    <SelectItem value="top5" className="text-xs">Top 5</SelectItem>
                    <SelectItem value="top3" className="text-xs">Top 3</SelectItem>
                  </SelectContent>
                </Select>
                {/* "..." — sort options + export */}
                <CardDropdown items={[
                  { label: "Sort: Count ↓", icon: ArrowUpDown, onClick: () => setBarSort("count-desc") },
                  { label: "Sort: Count ↑", icon: ArrowUpDown, onClick: () => setBarSort("count-asc") },
                  { label: "Sort: A → Z", icon: ArrowUpDown, onClick: () => setBarSort("name-asc") },
                  { label: "divider", divider: true },
                  { label: "Export CSV", icon: Download, onClick: () => handleExport("Department data") },
                ]} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5f7283" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5f7283" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #cce8e7" }}
                    formatter={(val) => [val, "Employees"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill="#0cbaba" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 gap-2">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Add employees to see breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Employee Attendance Details ── */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base lg:text-lg font-bold">Mark Today's Attendance</CardTitle>
                <CardDescription className="text-xs lg:text-sm mt-0.5">
                  Showing {paginatedEmployees.length} of {filteredAttendanceEmployees.length} employee{filteredAttendanceEmployees.length !== 1 ? "s" : ""}
                  {selectedDept !== "all" && ` in ${selectedDept}`}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] sm:flex-none sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={attendanceStatusFilter} onValueChange={setAttendanceStatusFilter}>
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">All Status</SelectItem>
                  <SelectItem value="Present" className="text-sm">✓ Present</SelectItem>
                  <SelectItem value="Absent" className="text-sm">✗ Absent</SelectItem>
                  <SelectItem value="Not Marked" className="text-sm">○ Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                <SelectTrigger className="h-9 text-sm w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10" className="text-sm">Show 10</SelectItem>
                  <SelectItem value="15" className="text-sm">Show 15</SelectItem>
                  <SelectItem value="25" className="text-sm">Show 25</SelectItem>
                  <SelectItem value="50" className="text-sm">Show 50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {filteredAttendanceEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No employees found</p>
              <p className="text-xs mt-1">Try adjusting your filters or search</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {paginatedEmployees.map((emp) => (
                  <div
                    key={emp.employee_id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:border-teal-200 hover:bg-teal-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        emp.attendanceStatus === "Present" ? "bg-teal-500" :
                        emp.attendanceStatus === "Absent" ? "bg-red-500" : "bg-amber-500"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm lg:text-base font-semibold truncate">{emp.full_name}</p>
                        <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                          <span>{emp.employee_id}</span>
                          <span>•</span>
                          <span>{emp.department}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={emp.attendanceStatus === "Present" ? "default" : "outline"}
                        onClick={async () => {
                          try {
                            await markAttendanceMutation.mutateAsync({
                              employee_id: emp.employee_id,
                              status: "Present",
                              date: new Date().toISOString().split('T')[0]
                            });
                            setTodayAttendance(prev => ({ ...prev, [emp.employee_id]: "Present" }));
                            toast.success(`${emp.full_name} marked as Present`);
                          } catch (err) {
                            toast.error("Failed to mark attendance");
                          }
                        }}
                        disabled={markAttendanceMutation.isPending}
                        className={emp.attendanceStatus === "Present"
                          ? "h-8 px-3 text-xs lg:text-sm bg-teal-600 hover:bg-teal-700"
                          : "h-8 px-3 text-xs lg:text-sm border-teal-200 text-teal-700 hover:bg-teal-50"
                        }
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                        <span>Present</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={emp.attendanceStatus === "Absent" ? "default" : "outline"}
                        onClick={async () => {
                          try {
                            await markAttendanceMutation.mutateAsync({
                              employee_id: emp.employee_id,
                              status: "Absent",
                              date: new Date().toISOString().split('T')[0]
                            });
                            setTodayAttendance(prev => ({ ...prev, [emp.employee_id]: "Absent" }));
                            toast.success(`${emp.full_name} marked as Absent`);
                          } catch (err) {
                            toast.error("Failed to mark attendance");
                          }
                        }}
                        disabled={markAttendanceMutation.isPending}
                        className={emp.attendanceStatus === "Absent"
                          ? "h-8 px-3 text-xs lg:text-sm bg-red-600 hover:bg-red-700"
                          : "h-8 px-3 text-xs lg:text-sm border-red-200 text-red-600 hover:bg-red-50"
                        }
                      >
                        <UserX className="h-3.5 w-3.5 mr-1.5" />
                        <span>Absent</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 text-xs lg:text-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            size="sm"
                            variant={currentPage === pageNum ? "default" : "outline"}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`h-8 w-8 p-0 text-xs lg:text-sm ${
                              currentPage === pageNum ? "bg-teal-600 hover:bg-teal-700" : ""
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 text-xs lg:text-sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Charts row 2 ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Attendance Rate Overview */}
        <Card>
          <CardHeader className="pb-1 px-5 pt-5">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Attendance Rate Overview</CardTitle>
                <CardDescription className="text-xs mt-0.5 flex items-center gap-1">
                  <TrendingUp className={`h-3 w-3 ${trendDiff >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                  <span className={trendDiff >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                    {trendDiff >= 0 ? "+" : ""}{trendDiff}%
                  </span>
                  <span>vs last {days} days</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7" className="text-xs">Last 7 Days</SelectItem>
                    <SelectItem value="14" className="text-xs">Last 14 Days</SelectItem>
                  </SelectContent>
                </Select>
                {/* "..." — refresh + export (period already in dropdown) */}
                <CardDropdown items={[
                  { label: "Refresh", icon: RefreshCw, onClick: () => fetchData(true) },
                  { label: "Export CSV", icon: Download, onClick: () => handleExport("Attendance trend") },
                ]} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0cbaba" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0cbaba" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5f7283" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[50, 100]}
                  tick={{ fontSize: 10, fill: "#5f7283" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #cce8e7" }}
                  formatter={(val) => [`${val}%`, "Attendance Rate"]}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#0cbaba"
                  strokeWidth={2}
                  fill="url(#tealGradient)"
                  dot={{ r: 3, fill: "#0cbaba", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#0cbaba" }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className={`h-3.5 w-3.5 ${trendDiff >= 0 ? "text-emerald-500" : "text-red-500"}`} />
              <span className={`font-medium ${trendDiff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {trendDiff >= 0 ? "↑" : "↓"} {Math.abs(trendDiff)}%
              </span>
              <span>vs last {days} days ({attendanceRate}%)</span>
            </div>
          </CardContent>
        </Card>

        {/* Employee Status Summary */}
        <Card>
          <CardHeader className="pb-2 px-5 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Employee Status Summary</CardTitle>
                <CardDescription className="text-xs mt-0.5">Distribution overview</CardDescription>
              </div>
              {/* "..." — refresh + export only */}
              <CardDropdown items={[
                { label: "Refresh", icon: RefreshCw, onClick: () => fetchData(true) },
                { label: "Export CSV", icon: Download, onClick: () => handleExport("Status summary") },
              ]} />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {filteredEmployees.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {statusData.map((s) => (
                    <MiniDonut key={s.title} title={s.title} data={s.data} colors={s.colors} rate={s.rate} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                  {statusData.map((s) => (
                    <div key={s.title} className="text-center">
                      {s.data.map((d) => (
                        <div key={d.name} className="text-xs text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground">{Math.round((d.value / total) * 100)}%</span>{" "}
                          {d.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-44 gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Add employees to see status</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
