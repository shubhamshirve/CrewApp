import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShieldCheck, Users, AlertTriangle,
  LogOut, ChevronLeft, ChevronRight, Menu, Shield, Globe, Settings, ScrollText, MessageSquare, CreditCard
} from "lucide-react";

const ADMIN_NAV = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Overview" },
  { path: "/admin/verification", icon: ShieldCheck, label: "Verification" },
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/penalties", icon: AlertTriangle, label: "Penalties" },
  { path: "/admin/gig-board", icon: Globe, label: "Gig Board" },
  { path: "/admin/plans", icon: CreditCard, label: "Plans" },
  { path: "/admin/templates", icon: MessageSquare, label: "Templates" },
  { path: "/admin/logs", icon: ScrollText, label: "Logs" },
  { path: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/"); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-100 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-600">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-sm font-display leading-none">CrewBook</p>
              <p className="text-blue-600 text-[10px] font-semibold tracking-widest uppercase mt-0.5">Admin</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600">
            <Shield size={16} className="text-white" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {ADMIN_NAV.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              data-testid={`admin-nav-${label.toLowerCase()}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                active
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon size={17} />
              {!collapsed && <span className="text-sm font-display">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin user + logout */}
      <div className="border-t border-slate-100 p-3 space-y-0.5">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-slate-900 truncate font-display">{user?.full_name}</p>
            <p className="text-[10px] text-blue-600 font-semibold">Administrator</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          data-testid="admin-logout-btn"
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all w-full ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={15} />
          {!collapsed && <span className="text-xs font-display">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full items-center justify-center bg-white border border-slate-200 hover:border-blue-300 shadow-sm transition-all z-10"
      >
        {collapsed ? <ChevronRight size={12} className="text-slate-500" /> : <ChevronLeft size={12} className="text-slate-500" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col relative border-r border-slate-100 flex-shrink-0 transition-all duration-300 bg-white"
        style={{ width: collapsed ? "68px" : "220px", minHeight: "100vh" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 flex flex-col bg-white border-r border-slate-100">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <button onClick={() => setMobileOpen(true)} data-testid="admin-mobile-menu">
            <Menu size={20} className="text-slate-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={12} className="text-white" />
            </div>
            <span className="text-slate-900 text-sm font-semibold font-display">Admin</span>
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
