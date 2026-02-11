import { useState, useRef, useEffect, createContext, useContext } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarCheck, Menu, X, ChevronDown,
  User, Settings, HelpCircle, LogOut, Building2,
} from "lucide-react";

// ─── Global filter context (Dashboard reads from here) ───────────────────────
export const FilterContext = createContext({
  selectedDept: "all",
  setSelectedDept: () => {},
  departments: [],
  setDepartments: () => {},
});
export const useFilters = () => useContext(FilterContext);

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employees", icon: Users, label: "Employees" },
  { to: "/attendance", icon: CalendarCheck, label: "Attendance" },
];

const pageTitles = { "/": "Dashboard", "/employees": "Employees", "/attendance": "Attendance" };
const pageSubtitles = {
  "/": "Overview of your HR operations",
  "/employees": "Manage your employee directory",
  "/attendance": "Track and manage attendance",
};

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Global filter state (shared via context)
  const [selectedDept, setSelectedDept] = useState("all");
  const [departments, setDepartments] = useState([]);

  const userMenuRef = useRef(null);
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "HRMS Lite";
  const pageSubtitle = pageSubtitles[location.pathname] || "";

  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <FilterContext.Provider value={{ selectedDept, setSelectedDept, departments, setDepartments }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* ─── Sidebar ─── */}
        <aside className={`
          shrink-0 bg-white border-r border-border flex flex-col
          transition-all duration-200 ease-in-out z-50
          fixed inset-y-0 left-0 lg:static lg:translate-x-0
          ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
          ${collapsed ? "w-16" : "w-57.5"}
        `}>
          {/* Logo */}
          <div className={`flex items-center h-16 border-b border-border shrink-0 ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}>
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight tracking-tight">HRMS Lite</p>
                <p className="text-[10px] text-muted-foreground leading-tight">HR Management</p>
              </div>
            )}
            <button className="lg:hidden ml-auto p-1 text-muted-foreground" onClick={() => setMobileOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav label */}
          {!collapsed && (
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Navigation</p>
            </div>
          )}

          {/* Nav items */}
          <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 pt-3 space-y-1" : "px-3 pt-1 space-y-0.5"}`}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg transition-all duration-150 text-sm font-medium
                  ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5"}
                  ${isActive
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-teal-50 hover:text-teal-700"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className={`border-t border-border ${collapsed ? "py-3" : "px-4 py-3"}`}>
            {!collapsed && (
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground">Version 2.0.0</p>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-teal-600 hover:bg-muted rounded-lg transition-all ${
                collapsed ? "justify-center w-10 h-10 mx-auto" : "w-full px-3 py-2"
              }`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4 rotate-90" />
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ─── Main area ─── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top header */}
          <header className="h-16 border-b border-border bg-white flex items-center px-4 lg:px-5 shrink-0 gap-3">
            {/* Mobile menu */}
            <button className="lg:hidden p-1.5 text-muted-foreground" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>

            {/* Page title */}
            <div className="flex-1 min-w-0">
              <h2 className="text-base lg:text-lg font-bold text-foreground leading-tight">{pageTitle}</h2>
              {pageSubtitle && (
                <p className="text-[11px] lg:text-sm text-muted-foreground hidden sm:block font-medium">{pageSubtitle}</p>
              )}
            </div>

            {/* Right: User menu */}
            <div className="relative ml-auto" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  AU
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm lg:text-base font-semibold text-foreground leading-tight">Admin User</p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground leading-tight">HR Manager</p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm lg:text-base font-bold text-foreground">Admin User</p>
                    <p className="text-xs lg:text-sm text-muted-foreground">admin@hrms.com</p>
                  </div>
                  <div className="py-1">
                    {[{ icon: User, label: "Profile" }, { icon: Settings, label: "Settings" }, { icon: HelpCircle, label: "Help & Support" }].map(({ icon: Icon, label }) => (
                      <button key={label} onClick={() => setUserMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-2 text-sm lg:text-base font-medium text-foreground hover:bg-muted transition-colors">
                        <Icon className="h-4 w-4 text-muted-foreground" />{label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border py-1">
                    <button onClick={() => setUserMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-2 text-sm lg:text-base font-semibold text-red-500 hover:bg-red-50 transition-colors">
                      <LogOut className="h-4 w-4" />Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-5">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </FilterContext.Provider>
  );
}
