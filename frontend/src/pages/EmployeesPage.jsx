import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Users, Search, ChevronLeft, ChevronRight,
  ArrowUpDown, Settings2, SlidersHorizontal, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import { useEmployees, useCreateEmployee, useDeleteEmployee } from "@/hooks/useQueries";

// ─── Helpers ────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#0cbaba","#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444"];
function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function getAvatarColor(name = "") {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Derive role from department if not present in data
const DEPT_ROLES = {
  Engineering: "Software Engineer", Design: "Product Designer",
  Marketing: "Marketing Specialist", HR: "HR Specialist",
  Finance: "Financial Analyst", Sales: "Sales Executive",
  Operations: "Operations Manager", Legal: "Legal Advisor",
};
const getRole = (emp) => emp.role || DEPT_ROLES[emp.department] || "Employee";

// Derive employment status deterministically from ID if not present
const getStatus = (emp) => {
  if (emp.employment_type) return emp.employment_type;
  const h = (emp.employee_id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return h % 4 === 0 ? "Part-Time" : "Full-Time";
};

// How many dept pills to show before "+ more" dropdown
const MAX_PILLS = 5;
const PAGE_SIZE = 8;

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

// ─── Dept dropdown for overflow ─────────────────────────────────────────────
function DeptOverflowDropdown({ hidden, deptFilter, setDeptFilter, deptCounts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  if (!hidden.length) return null;
  const activeHidden = hidden.find((d) => d === deptFilter);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
          activeHidden
            ? "bg-teal-500 text-white border-teal-500"
            : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
        }`}
      >
        {activeHidden ? `${activeHidden} ${deptCounts[activeHidden] || ""}` : `+${hidden.length} more`}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          {hidden.map((dept) => (
            <button
              key={dept}
              onClick={() => { setDeptFilter(dept); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                deptFilter === dept ? "bg-teal-50 text-teal-700 font-medium" : "text-foreground hover:bg-muted"
              }`}
            >
              <span>{dept}</span>
              <span className="text-muted-foreground">{deptCounts[dept] || 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  // React Query hooks
  const { data: employees = [], isLoading: loading, error: queryError, refetch: fetchEmployees } = useEmployees();
  const createEmployeeMutation = useCreateEmployee();
  const deleteEmployeeMutation = useDeleteEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeptSuggestions, setShowDeptSuggestions] = useState(false);
  const deptInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const error = queryError ? "Failed to load employees. Please check your connection." : null;

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
    const matchingDept = findMatchingDept(finalDept, departments);

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

  const handleDelete = async (employeeId) => {
    try {
      await deleteEmployeeMutation.mutateAsync(employeeId);
      setDeleteConfirm(null);
      toast.success("Employee deleted successfully");
    } catch {
      toast.error("Failed to delete employee. Please try again.");
    }
  };

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department))].sort(), [employees]);
  const deptCounts = useMemo(() => {
    const map = {};
    employees.forEach((e) => { map[e.department] = (map[e.department] || 0) + 1; });
    return map;
  }, [employees]);

  // Filter department suggestions based on input
  const deptSuggestions = useMemo(() => {
    if (!form.department.trim()) return departments;
    const query = form.department.toLowerCase();
    return departments.filter(d => d.toLowerCase().includes(query));
  }, [form.department, departments]);

  const filtered = useMemo(() => {
    let list = employees.filter((emp) => {
      if (deptFilter !== "all" && emp.department !== deptFilter) return false;
      if (statusFilter !== "all" && getStatus(emp) !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          emp.employee_id.toLowerCase().includes(q) ||
          emp.full_name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q) ||
          getRole(emp).toLowerCase().includes(q)
        );
      }
      return true;
    });
    // Sort by name
    list = [...list].sort((a, b) =>
      sortOrder === "asc"
        ? a.full_name.localeCompare(b.full_name)
        : b.full_name.localeCompare(a.full_name)
    );
    return list;
  }, [employees, search, deptFilter, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFrom = filtered.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safePage * PAGE_SIZE, filtered.length);

  useEffect(() => { setCurrentPage(1); }, [search, deptFilter, statusFilter]);

  // Dept pills split: first MAX_PILLS visible, rest in overflow dropdown
  const visibleDepts = departments.slice(0, MAX_PILLS);
  const hiddenDepts = departments.slice(MAX_PILLS);

  // Page numbers to display (max 5 around current)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  }, [totalPages, safePage]);

  return (
    <div className="space-y-4">
      {/* ── Page-level filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-40 shrink-0">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Employees</SelectItem>
              <SelectItem value="Full-Time" className="text-xs">Full-Time</SelectItem>
              <SelectItem value="Part-Time" className="text-xs">Part-Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Department dropdown (always present, for overflow) */}
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-8 text-xs w-44 shrink-0">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d} className="text-xs">
                  {d} ({deptCounts[d] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder((o) => o === "asc" ? "desc" : "asc")}
            className="p-1.5 text-muted-foreground hover:text-teal-600 rounded-lg hover:bg-muted transition-colors shrink-0"
            title={`Sort by name ${sortOrder === "asc" ? "Z-A" : "A-Z"}`}
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>

          <button className="p-1.5 text-muted-foreground hover:text-teal-600 rounded-lg hover:bg-muted transition-colors shrink-0" title="Settings">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {/* Add Employee dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setForm(initialFormState); setFormErrors({}); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white h-8 text-xs px-3 shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Fill in all fields to register a new employee.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formErrors._general && <ErrorAlert message={formErrors._general} />}

              <div className="space-y-1.5">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id" name="employee_id" placeholder="e.g. EMP001"
                  value={form.employee_id} onChange={handleInputChange}
                  className={formErrors.employee_id ? "border-red-400 focus-visible:ring-red-300" : ""}
                />
                {formErrors.employee_id && <p className="text-xs text-red-500">{formErrors.employee_id}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name" name="full_name" placeholder="John Doe"
                  value={form.full_name} onChange={handleInputChange}
                  className={formErrors.full_name ? "border-red-400 focus-visible:ring-red-300" : ""}
                />
                {formErrors.full_name && <p className="text-xs text-red-500">{formErrors.full_name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email" name="email" type="email" placeholder="john@company.com"
                  value={form.email} onChange={handleInputChange}
                  className={formErrors.email ? "border-red-400 focus-visible:ring-red-300" : ""}
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>

              <div className="space-y-1.5 relative" ref={deptInputRef}>
                <Label htmlFor="department">
                  Department
                  {departments.length > 0 && <span className="text-xs text-muted-foreground ml-1">(type to search or add new)</span>}
                </Label>
                <Input
                  id="department" name="department" placeholder="Engineering"
                  value={form.department}
                  onChange={handleInputChange}
                  onFocus={() => setShowDeptSuggestions(form.department.trim().length > 0 || departments.length > 0)}
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
                {form.department && !findMatchingDept(form.department, departments) && (
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

      {/* ── Employee Directory card ── */}
      <Card>
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="space-y-3">
            {/* Title + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base lg:text-lg font-bold">Employee Directory</CardTitle>
                <CardDescription className="text-xs lg:text-sm mt-0.5 font-medium">
                  {search.trim() || deptFilter !== "all" || statusFilter !== "all"
                    ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} found`
                    : `${employees.length} employee${employees.length !== 1 ? "s" : ""} registered`}
                </CardDescription>
              </div>
              {employees.length > 0 && (
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Department quick-filter pills + overflow */}
            {departments.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* All pill */}
                <button
                  onClick={() => setDeptFilter("all")}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                    deptFilter === "all"
                      ? "bg-teal-500 text-white border-teal-500"
                      : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
                  }`}
                >
                  All
                  <span className={`text-[10px] ${deptFilter === "all" ? "text-teal-100" : "text-muted-foreground"}`}>
                    {employees.length}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                {/* Visible dept pills */}
                {visibleDepts.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDeptFilter(dept === deptFilter ? "all" : dept)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                      deptFilter === dept
                        ? "bg-teal-500 text-white border-teal-500"
                        : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {dept}
                    <span className={`text-[10px] ${deptFilter === dept ? "text-teal-100" : "text-muted-foreground"}`}>
                      {deptCounts[dept] || 0}
                    </span>
                  </button>
                ))}

                {/* Overflow dropdown for extra departments */}
                <DeptOverflowDropdown
                  hidden={hiddenDepts}
                  deptFilter={deptFilter}
                  setDeptFilter={setDeptFilter}
                  deptCounts={deptCounts}
                />

                {/* Inline filter indicator */}
                {(deptFilter !== "all" || statusFilter !== "all" || search) && (
                  <button
                    onClick={() => { setDeptFilter("all"); setStatusFilter("all"); setSearch(""); }}
                    className="text-[10px] text-red-500 hover:text-red-600 px-2 py-1 ml-1 hover:bg-red-50 rounded-full transition-colors"
                  >
                    Clear filters
                  </button>
                )}

                {/* Right: Filters button */}
                <div className="ml-auto">
                  <button className="flex items-center gap-1.5 h-7 px-2.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          {loading ? (
            <LoadingSpinner text="Loading employees..." />
          ) : error ? (
            <ErrorAlert message={error} onRetry={fetchEmployees} />
          ) : employees.length === 0 ? (
            <EmptyState icon={Users} title="No employees yet" description="Click 'Add Employee' to register your first employee." />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="No results found" description="Try adjusting your search or filter." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-24">ID</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          Employee
                          <button onClick={() => setSortOrder((o) => o === "asc" ? "desc" : "asc")}>
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                          </button>
                        </div>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          Department
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          Status
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      </TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((emp) => {
                      const role = getRole(emp);
                      const status = getStatus(emp);
                      const initials = getInitials(emp.full_name);
                      const avatarColor = getAvatarColor(emp.full_name);
                      return (
                        <TableRow key={emp.employee_id} className="group hover:bg-muted/40">
                          <TableCell className="font-mono text-xs text-muted-foreground">{emp.employee_id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                                style={{ background: avatarColor }}
                              >
                                {initials}
                              </div>
                              <span className="text-sm font-medium text-foreground">{emp.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{emp.email}</TableCell>
                          <TableCell>
                            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs font-medium">
                              {emp.department}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{role}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs font-medium border ${
                              status === "Full-Time"
                                ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                            }`}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {deleteConfirm === emp.employee_id ? (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="destructive" disabled={deleteEmployeeMutation.isPending}
                                  onClick={() => handleDelete(emp.employee_id)}>
                                  {deleteEmployeeMutation.isPending ? "..." : "Delete"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>No</Button>
                              </div>
                            ) : (
                              <Button
                                size="sm" variant="ghost"
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity h-8 w-8 p-0"
                                onClick={() => setDeleteConfirm(emp.employee_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2.5">
                {paginatedData.map((emp) => {
                  const status = getStatus(emp);
                  return (
                    <div key={emp.employee_id} className="border border-border rounded-xl p-3.5 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                            style={{ background: getAvatarColor(emp.full_name) }}
                          >
                            {getInitials(emp.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{emp.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-mono text-muted-foreground">{emp.employee_id}</span>
                              <Badge className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50">{emp.department}</Badge>
                              <Badge className={`text-[10px] border ${status === "Full-Time" ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-50" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"}`}>
                                {status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {deleteConfirm === emp.employee_id ? (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2"
                              disabled={deleteEmployeeMutation.isPending} onClick={() => handleDelete(emp.employee_id)}>
                              {deleteEmployeeMutation.isPending ? "..." : "Delete"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setDeleteConfirm(null)}>No</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                            onClick={() => setDeleteConfirm(emp.employee_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground">
                    {showFrom}–{showTo} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="h-8 px-2.5 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />Prev
                    </Button>
                    {pageNumbers.map((n) => (
                      <button
                        key={n}
                        onClick={() => setCurrentPage(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          safePage === n
                            ? "bg-teal-500 text-white"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <Button
                      variant="outline" size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="h-8 px-2.5 text-xs"
                    >
                      Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
