import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import EmployeesPage from "@/pages/EmployeesPage";
import AttendancePage from "@/pages/AttendancePage";
import ErrorBoundary from "@/components/ErrorBoundary";

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: { fontFamily: "'Inter', sans-serif", fontSize: "13px" },
        }}
      />
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/employees" element={<ErrorBoundary><EmployeesPage /></ErrorBoundary>} />
            <Route path="/attendance" element={<ErrorBoundary><AttendancePage /></ErrorBoundary>} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
