import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEmployees,
  createEmployee,
  deleteEmployee,
  getAttendanceSummary,
  getAttendance,
  markAttendance,
} from "@/api";

// ─── Employees ──────────────────────────────────────────────────────────────
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await getEmployees();
      return data;
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
  });
}

// ─── Attendance ─────────────────────────────────────────────────────────────
export function useAttendanceSummary() {
  return useQuery({
    queryKey: ["attendance-summary"],
    queryFn: async () => {
      const { data } = await getAttendanceSummary();
      return data;
    },
  });
}

export function useAttendanceRecords(employeeId, params) {
  return useQuery({
    queryKey: ["attendance-records", employeeId, params],
    queryFn: async () => {
      const { data } = await getAttendance(employeeId, params);
      return data;
    },
    enabled: !!employeeId, // Only fetch if employeeId is provided
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    },
  });
}
