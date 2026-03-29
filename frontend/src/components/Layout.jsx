import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Search, Users, Briefcase, Calendar,
  Wallet, Bell, LogOut, User, ChevronLeft, ChevronRight,
  Menu, Globe, Download, X, ShieldAlert, ArrowLeft
} from "lucide-react";
import NotificationPrompt from "@/components/NotificationPrompt";

const NAV_ITEMS = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/search", icon: Search, label: "Discover" },
  { path: "/connections", icon: Users, label: "Network" },
  { path: "/gigs", icon: Briefcase, label: "Gigs" },
  { path: "/gig-board", icon: Globe, label: "Gig Board" },
  { path: "/calendar", icon: Calendar, label: "Calendar" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/notifications", icon: Bell, label: "Alerts" },
];

export default function Layout({ children }) {
  const { user, logout, api, isImpersonating, exitImpersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const handleBackToAdmin = async () => {
    await exitImpersonation();
    navigate("/admin/dashboard");
  };

  useEffect(() => {
    api.get("/notifications/unread-count").then(r => setUnread(r.data.count)).catch(() => {});
  }, [location.pathname]);

  // Capture the browser's install prompt event
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  const handleLogout = () => { logout(); navigate("/"); };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-100 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ background: "#E05D26" }}>
              <span className="text-white font-bold text-sm font-display">C</span>
            </div>
            <span className="text-slate-900 font-semibold font-display text-lg">CrewBook</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#E05D26" }}>
            <span className="text-white font-bold text-sm">C</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              data-testid={`nav-${label.toLowerCase()}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                active
                  ? "bg-orange-50 text-orange-600 font-medium"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <div className="relative">
                <Icon size={18} />
                {label === "Alerts" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] text-white font-bold flex items-center justify-center" style={{ background: "#E05D26" }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              {!collapsed && <span className="text-sm font-display">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-3 space-y-0.5">
        <Link
          to={`/profile/${user?.id}`}
          data-testid="nav-profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: "#E05D26" }}>
            {user?.profile_image ? (
              <img src={user.profile_image} className="w-7 h-7 rounded-full object-cover" alt="" />
            ) : (
              user?.full_name?.[0]?.toUpperCase() || <User size={14} className="text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate font-display">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.primary_role || "Set your role"}</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all w-full ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut size={16} />
          {!collapsed && <span className="text-xs font-display">Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full items-center justify-center bg-white border border-slate-200 hover:border-orange-300 shadow-sm transition-all z-10"
      >
        {collapsed ? <ChevronRight size={12} className="text-slate-500" /> : <ChevronLeft size={12} className="text-slate-500" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col relative border-r border-slate-100 transition-all duration-300 flex-shrink-0 bg-white"
        style={{ width: collapsed ? "68px" : "220px", minHeight: "100vh" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-white border-r border-slate-100">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <button onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn">
            <Menu size={20} className="text-slate-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#E05D26" }}>
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-slate-900 font-semibold font-display">CrewBook</span>
          </div>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Impersonation Banner */}
          {isImpersonating && (
            <div
              data-testid="impersonation-banner"
              className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#FFFBEB", border: "1.5px solid #F59E0B" }}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={16} className="text-amber-500 flex-shrink-0" />
                <span className="text-amber-900 font-display font-medium">
                  Admin View — browsing as <strong>{user?.full_name}</strong>
                </span>
              </div>
              <button
                data-testid="back-to-admin-btn"
                onClick={handleBackToAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-display transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: "#F59E0B", color: "#fff" }}
              >
                <ArrowLeft size={12} /> Back to Admin
              </button>
            </div>
          )}

          {/* Notification Permission Prompt */}
          {!isImpersonating && <NotificationPrompt />}

          {/* PWA Install Banner */}
          {showInstallBanner && (
            <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 text-sm">
              <div className="flex items-center gap-2">
                <Download size={15} className="text-orange-500 flex-shrink-0" />
                <span className="text-slate-700 font-display">
                  Install <strong>CrewBook</strong> on your device for quick access
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  data-testid="pwa-install-btn"
                  onClick={handleInstall}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white font-display"
                  style={{ background: "#E05D26" }}
                >
                  Install
                </button>
                <button onClick={dismissBanner} className="text-slate-400 hover:text-slate-600 p-0.5">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
