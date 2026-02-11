import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CalendarCheck, CheckCircle2, XCircle, Users, ChevronLeft, ChevronRight,
  Clock, RefreshCw, Filter, Building2, UserCheck, UserX, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import ErrorAlert from "@/components/ErrorAlert";
import { getAttendance } from "@/api";
import { useEmployees, useAttendanceRecords, useMarkAttendance } from "@/hooks/useQueries";

const PAGE_SIZES = [10, 20, 50];
const TODAY = new Date().toISOString().split("T")[0];

export default function AttendancePage() {
  // React Query hooks
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const markAttendanceMutation = useMarkAttendance();

  // Today's overview state
  const [todayStatus, setTodayStatus] = useState({});
  const [loadingToday, setLoadingToday] = useState(false);
  const [todayStatusFilter, setTodayStatusFilter] = useState("all");
  const [todayDeptFilter, setTodayDeptFilter] = useState("all");
  const [todaySearchQuery, setTodaySearchQuery] = useState("");
  const [todayPage, setTodayPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // History state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  // Month/Year filter for history
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filterMonth, setFilterMonth] = useState(String(currentMonth).padStart(2, "0"));
  const [filterYear, setFilterYear] = useState(String(currentYear));

  // Calculate date range for history query
  const historyParams = useMemo(() => {
    if (!selectedEmployee) return null;
    const startDate = `${filterYear}-${filterMonth}-01`;
    const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate();
    const endDate = `${filterYear}-${filterMonth}-${String(lastDay).padStart(2, "0")}`;
    return { start_date: startDate, end_date: endDate };
  }, [filterMonth, filterYear, selectedEmployee]);

  // Fetch history using React Query
  const { data: records = [], isLoading: loadingHistory, error: historyQueryError } = useAttendanceRecords(
    selectedEmployee,
    historyParams
  );

  const historyError = historyQueryError ? "Failed to load attendance records." : null;

  // Fetch today's attendance for all employees in parallel
  const fetchTodayAttendance = async (empList) => {
    if (!empList || empList.length === 0) return;
    setLoadingToday(true);
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
      setTodayStatus(statusMap);
    } finally {
      setLoadingToday(false);
    }
  };

  useEffect(() => {
    if (employees.length > 0) {
      fetchTodayAttendance(employees);
    }
  }, [employees]);

  // Mark attendance inline from today's overview
  const handleMarkToday = async (employeeId, status) => {
    try {
      await markAttendanceMutation.mutateAsync({ employee_id: employeeId, date: TODAY, status });
      setTodayStatus((prev) => ({ ...prev, [employeeId]: status }));
      const name = employees.find((e) => e.employee_id === employeeId)?.full_name || employeeId;
      toast.success(`${name} marked as ${status}`);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to mark attendance.";
      toast.error(msg);
    }
  };

  // Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEmployee, filterMonth, filterYear]);

  // Today overview computed
  const todayEmployees = useMemo(() => {
    return employees.map((emp) => ({
      ...emp,
      todayStatus: todayStatus[emp.employee_id] || "Not Marked",
    }));
  }, [employees, todayStatus]);

  const filteredToday = useMemo(() => {
    let filtered = todayEmployees;
    if (todayStatusFilter !== "all") {
      filtered = filtered.filter((e) => e.todayStatus === todayStatusFilter);
    }
    if (todayDeptFilter !== "all") {
      filtered = filtered.filter((e) => e.department === todayDeptFilter);
    }
    if (todaySearchQuery.trim()) {
      const query = todaySearchQuery.toLowerCase();
      filtered = filtered.filter((e) =>
        e.full_name.toLowerCase().includes(query) ||
        e.employee_id.toLowerCase().includes(query) ||
        e.department.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [todayEmployees, todayStatusFilter, todayDeptFilter, todaySearchQuery]);

  // Pagination for today's overview
  const todayTotalPages = Math.ceil(filteredToday.length / ITEMS_PER_PAGE);
  const paginatedToday = useMemo(() => {
    const startIndex = (todayPage - 1) * ITEMS_PER_PAGE;
    return filteredToday.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredToday, todayPage, ITEMS_PER_PAGE]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setTodayPage(1);
  }, [todaySearchQuery, todayStatusFilter, todayDeptFilter]);

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department))].sort(), [employees]);

  const todayPresent = todayEmployees.filter((e) => e.todayStatus === "Present").length;
  const todayAbsent = todayEmployees.filter((e) => e.todayStatus === "Absent").length;
  const todayUnmarked = todayEmployees.filter((e) => e.todayStatus === "Not Marked").length;

  // History pagination + filter
  const filteredRecords = useMemo(() => {
    if (historyStatusFilter === "all") return records;
    return records.filter((r) => r.status === historyStatusFilter);
  }, [records, historyStatusFilter]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredRecords.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedRecords = pageSize === 0
    ? filteredRecords
    : filteredRecords.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const showingFrom = filteredRecords.length > 0
    ? (safeCurrentPage - 1) * (pageSize || filteredRecords.length) + 1
    : 0;
  const showingTo = pageSize === 0
    ? filteredRecords.length
    : Math.min(safeCurrentPage * pageSize, filteredRecords.length);

  useEffect(() => { setCurrentPage(1); }, [historyStatusFilter, pageSize]);

  const selectedEmp = employees.find((e) => e.employee_id === selectedEmployee);
  const presentCount = records.filter((r) => r.status === "Present").length;
  const absentCount = records.filter((r) => r.status === "Absent").length;
  const attendancePct = presentCount + absentCount > 0
    ? Math.round((presentCount / (presentCount + absentCount)) * 100)
    : null;

  const months = [
    ["01","January"],["02","February"],["03","March"],["04","April"],
    ["05","May"],["06","June"],["07","July"],["08","August"],
    ["09","September"],["10","October"],["11","November"],["12","December"],
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  if (loadingEmployees) return <LoadingSpinner text="Loading attendance data..." />;

  return (
    <div className="space-y-5">

      {/* ── Section 1: Today's Overview ── */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base lg:text-lg font-bold">Today's Attendance Overview</CardTitle>
              <CardDescription className="text-xs lg:text-sm mt-0.5 font-medium">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs lg:text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />{todayPresent} Present
              </span>
              <span className="flex items-center gap-1 text-xs lg:text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-full">
                <XCircle className="h-3.5 w-3.5 lg:h-4 lg:w-4" />{todayAbsent} Absent
              </span>
              <span className="flex items-center gap-1 text-xs lg:text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-full">
                <Clock className="h-3.5 w-3.5 lg:h-4 lg:w-4" />{todayUnmarked} Pending
              </span>
              <button
                onClick={() => fetchTodayAttendance(employees)}
                disabled={loadingToday}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                title="Refresh today's status"
              >
                <RefreshCw className={`h-4 w-4 ${loadingToday ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or department..."
                value={todaySearchQuery}
                onChange={(e) => setTodaySearchQuery(e.target.value)}
                className="pl-10 h-10 text-sm"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            {/* Status filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Status:</span>
              {[
                { key: "all", label: `All (${employees.length})` },
                { key: "Present", label: `Present (${todayPresent})` },
                { key: "Absent", label: `Absent (${todayAbsent})` },
                { key: "Not Marked", label: `Pending (${todayUnmarked})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTodayStatusFilter(key)}
                  className={`text-xs lg:text-sm font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    todayStatusFilter === key
                      ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                      : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Department filter */}
            {departments.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />Department:
                </span>
                <button
                  onClick={() => setTodayDeptFilter("all")}
                  className={`text-xs lg:text-sm font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    todayDeptFilter === "all"
                      ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                      : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
                  }`}
                >
                  All
                </button>
                {departments.slice(0, 4).map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setTodayDeptFilter(dept)}
                    className={`text-xs lg:text-sm font-semibold px-3 py-1.5 rounded-full border transition-all ${
                      todayDeptFilter === dept
                        ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                        : "bg-white text-muted-foreground border-border hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
                {departments.length > 4 && (
                  <Select value={todayDeptFilter} onValueChange={setTodayDeptFilter}>
                    <SelectTrigger className="h-8 text-xs lg:text-sm w-32 font-semibold">
                      <SelectValue placeholder="More..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.slice(4).map((dept) => (
                        <SelectItem key={dept} value={dept} className="text-xs lg:text-sm font-medium">{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="mt-3">
            <p className="text-xs lg:text-sm text-muted-foreground font-medium">
              Showing {paginatedToday.length} of {filteredToday.length} employees
              {todayDeptFilter !== "all" && ` in ${todayDeptFilter}`}
              {filteredToday.length !== employees.length && ` (filtered from ${employees.length} total)`}
            </p>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          {employees.length === 0 ? (
            <EmptyState icon={Users} title="No employees" description="Add employees first to track attendance." />
          ) : loadingToday ? (
            <LoadingSpinner text="Loading today's attendance..." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Mark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedToday.map((emp) => {
                      const isMarking = markAttendanceMutation.isPending;
                      return (
                        <TableRow key={emp.employee_id}>
                          <TableCell className="font-semibold text-sm lg:text-base">{emp.full_name}</TableCell>
                          <TableCell className="font-mono text-xs lg:text-sm text-muted-foreground">{emp.employee_id}</TableCell>
                          <TableCell>
                            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs">{emp.department}</Badge>
                          </TableCell>
                          <TableCell>
                            {emp.todayStatus === "Present" ? (
                              <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Present
                              </Badge>
                            ) : emp.todayStatus === "Absent" ? (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-50 text-xs">
                                <XCircle className="h-3 w-3 mr-1" />Absent
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-50 text-xs">
                                <Clock className="h-3 w-3 mr-1" />Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={isMarking}
                                onClick={() => handleMarkToday(emp.employee_id, "Present")}
                                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded border transition-all ${
                                  emp.todayStatus === "Present"
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50 disabled:opacity-50"
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />Present
                              </button>
                              <button
                                disabled={isMarking}
                                onClick={() => handleMarkToday(emp.employee_id, "Absent")}
                                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded border transition-all ${
                                  emp.todayStatus === "Absent"
                                    ? "bg-red-600 text-white border-red-600"
                                    : "bg-white text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                                }`}
                              >
                                <XCircle className="h-3.5 w-3.5" />Absent
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list */}
              <div className="sm:hidden space-y-2">
                {paginatedToday.map((emp) => {
                  const isMarking = markAttendanceMutation.isPending;
                  return (
                    <div key={emp.employee_id} className="border border-border rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{emp.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-mono text-muted-foreground">{emp.employee_id}</span>
                            <Badge className="text-xs bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50">{emp.department}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <button
                            disabled={isMarking}
                            onClick={() => handleMarkToday(emp.employee_id, "Present")}
                            className={`text-xs px-2.5 py-1.5 rounded border font-semibold transition-all inline-flex items-center gap-1 ${
                              emp.todayStatus === "Present" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50 disabled:opacity-50"
                            }`}
                          ><CheckCircle2 className="h-3 w-3" />P</button>
                          <button
                            disabled={isMarking}
                            onClick={() => handleMarkToday(emp.employee_id, "Absent")}
                            className={`text-xs px-2.5 py-1.5 rounded border font-semibold transition-all inline-flex items-center gap-1 ${
                              emp.todayStatus === "Absent" ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                            }`}
                          ><XCircle className="h-3 w-3" />A</button>
                        </div>
                      </div>
                      <div className="mt-1.5">
                        {emp.todayStatus === "Present" ? (
                          <span className="text-xs text-teal-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Present</span>
                        ) : emp.todayStatus === "Absent" ? (
                          <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" />Absent</span>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" />Not Marked</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {todayTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    Page {todayPage} of {todayTotalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTodayPage(p => Math.max(1, p - 1))}
                      disabled={todayPage === 1}
                      className="h-8 px-3 text-xs lg:text-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, todayTotalPages) }, (_, i) => {
                        let pageNum;
                        if (todayTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (todayPage <= 3) {
                          pageNum = i + 1;
                        } else if (todayPage >= todayTotalPages - 2) {
                          pageNum = todayTotalPages - 4 + i;
                        } else {
                          pageNum = todayPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            size="sm"
                            variant={todayPage === pageNum ? "default" : "outline"}
                            onClick={() => setTodayPage(pageNum)}
                            className={`h-8 w-8 p-0 text-xs lg:text-sm ${
                              todayPage === pageNum ? "bg-teal-600 hover:bg-teal-700" : ""
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
                      onClick={() => setTodayPage(p => Math.min(todayTotalPages, p + 1))}
                      disabled={todayPage === todayTotalPages}
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

      {/* ── Section 2: Attendance History ── */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Attendance History
                {selectedEmp && <span className="text-teal-600 ml-1.5">- {selectedEmp.full_name}</span>}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {selectedEmployee
                  ? `${records.length} records · ${presentCount} present · ${absentCount} absent${attendancePct !== null ? ` · ${attendancePct}% rate` : ""}`
                  : "Select an employee to view history"}
              </CardDescription>
            </div>
            {attendancePct !== null && (
              <Badge className="self-start bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs">
                {attendancePct}% Attendance Rate
              </Badge>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-9 text-sm w-52">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id} className="text-sm">
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(([val, label]) => (
                    <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="h-9 text-sm w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y} className="text-sm">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                <SelectTrigger className="h-9 text-sm w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">All</SelectItem>
                  <SelectItem value="Present" className="text-sm">Present</SelectItem>
                  <SelectItem value="Absent" className="text-sm">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5">
          {!selectedEmployee ? (
            <EmptyState icon={CalendarCheck} title="No employee selected" description="Select an employee above to view their attendance history." />
          ) : loadingHistory ? (
            <LoadingSpinner text="Loading attendance records..." />
          ) : historyError ? (
            <ErrorAlert message={historyError} />
          ) : filteredRecords.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No records found" description="No attendance records found for the selected filters." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => {
                      const d = new Date(record.date + "T00:00:00");
                      return (
                        <TableRow key={record.date}>
                          <TableCell className="text-sm font-medium">
                            {d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {d.toLocaleDateString("en-US", { weekday: "long" })}
                          </TableCell>
                          <TableCell>
                            {record.status === "Present" ? (
                              <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Present
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-50 text-xs">
                                <XCircle className="h-3.5 w-3.5 mr-1" />Absent
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list */}
              <div className="sm:hidden space-y-2">
                {paginatedRecords.map((record) => {
                  const d = new Date(record.date + "T00:00:00");
                  return (
                    <div key={record.date} className="flex items-center justify-between border border-border rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium">{d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.toLocaleDateString("en-US", { weekday: "long" })}</p>
                      </div>
                      {record.status === "Present" ? (
                        <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-50 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Present
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-50 text-xs">
                          <XCircle className="h-3.5 w-3.5 mr-1" />Absent
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination bar with rows-per-page */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-border mt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select
                      value={pageSize === 0 ? "all" : String(pageSize)}
                      onValueChange={(v) => setPageSize(v === "all" ? 0 : parseInt(v))}
                    >
                      <SelectTrigger className="h-7 text-xs w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                        ))}
                        <SelectItem value="all" className="text-xs">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {showingFrom}–{showingTo} of {filteredRecords.length}
                  </span>
                </div>

                {pageSize !== 0 && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-8 px-2.5">
                      <ChevronLeft className="h-4 w-4 mr-1" />Prev
                    </Button>
                    <span className="text-sm font-medium px-3">{safeCurrentPage} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-8 px-2.5">
                      Next<ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
