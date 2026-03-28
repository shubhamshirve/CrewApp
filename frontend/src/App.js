import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "@/App.css";

// User app pages
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Search from "@/pages/Search";
import Connections from "@/pages/Connections";
import Gigs from "@/pages/Gigs";
import GigDetail from "@/pages/GigDetail";
import CalendarPage from "@/pages/Calendar";
import Wallet from "@/pages/Wallet";
import Notifications from "@/pages/Notifications";
import GigBoard from "@/pages/GigBoard";

// Admin app pages
import AdminLogin from "@/pages/AdminLogin";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminVerification from "@/pages/admin/AdminVerification";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminPenalties from "@/pages/admin/AdminPenalties";
import AdminGigBoard from "@/pages/admin/AdminGigBoard";

// ── Guards ────────────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0A" }}>
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080B12" }}>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!user.is_admin) return <Navigate to="/admin/login" replace />;
  return children;
}

// ── Admin Routes (completely separate from user app) ──────────────────────────
function AdminRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/admin/login"
        element={user?.is_admin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />}
      />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminGuard><AdminOverview /></AdminGuard>} />
      <Route path="/admin/verification" element={<AdminGuard><AdminVerification /></AdminGuard>} />
      <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
      <Route path="/admin/penalties" element={<AdminGuard><AdminPenalties /></AdminGuard>} />
      <Route path="/admin/gig-board" element={<AdminGuard><AdminGigBoard /></AdminGuard>} />
      <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

// ── User Routes ───────────────────────────────────────────────────────────────
function UserRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
      <Route path="/connections" element={<ProtectedRoute><Connections /></ProtectedRoute>} />
      <Route path="/gigs" element={<ProtectedRoute><Gigs /></ProtectedRoute>} />
      <Route path="/gigs/:id" element={<ProtectedRoute><GigDetail /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/gig-board" element={<ProtectedRoute><GigBoard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Root Router — splits admin vs user app by URL prefix ─────────────────────
function RootRouter() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  return isAdmin ? <AdminRoutes /> : <UserRoutes />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RootRouter />
        <Toaster position="top-right" theme="dark" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
