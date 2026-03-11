import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RouteGuard } from "@/components/RouteGuard";
import BookingPage from "./pages/BookingPage";
import AuthPage from "./pages/AuthPage";
import UserDashboard from "./pages/UserDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Route structure
 * ───────────────
 * Public (no guard):
 *   /        → BookingPage (anonymous booking)
 *   /auth    → AuthPage    (customer login / register)
 *   /admin   → AdminLogin  (admin-only login portal)
 *
 * Protected (RouteGuard enforces role before page mounts):
 *   /dashboard        → UserDashboard      [customer, admin, super_admin]
 *   /employee         → EmployeeDashboard  [employee, admin, super_admin]
 *   /admin/dashboard  → AdminDashboard     [admin, super_admin]
 *
 * Subdomain routing note:
 *   When oasispureshine.com domains are configured, Netlify redirects can
 *   map subdomains to route groups:
 *     app.oasispureshine.com    → /dashboard
 *     staff.oasispureshine.com  → /employee
 *     admin.oasispureshine.com  → /admin/dashboard
 *   The RouteGuard handles access control regardless of entry point.
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* ── Public routes ──────────────────────────────────────────── */}
          <Route path="/"            element={<BookingPage />} />
          <Route path="/auth"        element={<AuthPage />} />
          <Route path="/admin"       element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ── Customer dashboard ─────────────────────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <RouteGuard
                requiredRoles={["customer", "admin", "super_admin"]}
                loginPath="/auth"
              >
                <UserDashboard />
              </RouteGuard>
            }
          />

          {/* ── Employee dashboard ─────────────────────────────────────── */}
          <Route
            path="/employee"
            element={
              <RouteGuard
                requiredRoles={["employee", "admin", "super_admin"]}
                loginPath="/auth"
              >
                <EmployeeDashboard />
              </RouteGuard>
            }
          />

          {/* ── Admin dashboard ────────────────────────────────────────── */}
          <Route
            path="/admin/dashboard"
            element={
              <RouteGuard
                requiredRoles={["admin", "super_admin"]}
                loginPath="/admin"
              >
                <AdminDashboard />
              </RouteGuard>
            }
          />

          <Route path="*" element={<NotFound />} />

          <Route
            path="/platform"
            element={
              <RouteGuard
                requiredRoles={["super_admin"]}
                loginPath="/admin"
              >
                <SuperAdminDashboard />
              </RouteGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
