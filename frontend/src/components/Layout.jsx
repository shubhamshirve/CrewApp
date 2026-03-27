import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Search, Users, Briefcase, Calendar,
  Wallet, Bell, LogOut, Shield, User, ChevronLeft, ChevronRight,
  Menu, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/search", icon: Search, label: "Discover" },
  { path: "/connections", icon: Users, label: "Network" },
  { path: "/gigs", icon: Briefcase, label: "Gigs" },
  { path: "/calendar", icon: Calendar, label: "Calendar" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/notifications", icon: Bell, label: "Alerts" },
];

export default function Layout({ children }) {
  const { user, logout, api } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api.get("/notifications/unread-count").then(r => setUnread(r.data.count)).catch(() => {});
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate("/"); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F59E0B" }}>
              <span className="text-black font-bold text-sm font-display">C</span>
            </div>
            <span className="text-white font-semibold font-display text-lg">CrewBook</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F59E0B" }}>
            <span className="text-black font-bold text-sm">C</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              data-testid={`nav-${label.toLowerCase()}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                active
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <div className="relative">
                <Icon size={18} />
                {label === "Alerts" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-black font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              {!collapsed && <span className="text-sm font-medium font-display">{label}</span>}
            </Link>
          );
        })}
        {user?.is_admin && (
          <Link
            to="/admin"
            data-testid="nav-admin"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
              location.pathname === "/admin"
                ? "bg-amber-500/15 text-amber-400"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Shield size={18} />
            {!collapsed && <span className="text-sm font-medium font-display">Admin</span>}
          </Link>
        )}
      </nav>

      {/* User */}
      <div className={`border-t border-white/5 p-3 space-y-1`}>
        <Link
          to={`/profile/${user?.id}`}
          data-testid="nav-profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} className="w-7 h-7 rounded-full object-cover" alt="" />
            ) : (
              <User size={14} className="text-amber-400" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate font-display">{user?.full_name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.primary_role || "Set your role"}</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all w-full ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={16} />
          {!collapsed && <span className="text-xs font-display">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle - desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full items-center justify-center bg-zinc-800 border border-white/10 hover:border-amber-500/50 transition-all z-10"
      >
        {collapsed ? <ChevronRight size={12} className="text-zinc-400" /> : <ChevronLeft size={12} className="text-zinc-400" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A" }}>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col relative border-r border-white/5 transition-all duration-300 flex-shrink-0`}
        style={{
          width: collapsed ? "68px" : "220px",
          background: "#0D0D0F",
          minHeight: "100vh",
        }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col border-r border-white/5" style={{ background: "#0D0D0F" }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/5" style={{ background: "#0D0D0F" }}>
          <button onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn">
            <Menu size={20} className="text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-xs">C</span>
            </div>
            <span className="text-white font-semibold font-display">CrewBook</span>
          </div>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
