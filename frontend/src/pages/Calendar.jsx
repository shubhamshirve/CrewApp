import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronLeft, ChevronRight, Calendar as CalIcon, Link, Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const { user, api } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [gigs, setGigs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [isStandby, setIsStandby] = useState(user?.is_standby || false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [gigRes, invRes, calRes] = await Promise.all([
          api.get("/gigs"),
          api.get("/gigs/invites/received"),
          api.get("/calendar/status"),
        ]);
        setGigs(gigRes.data);
        setInvites(invRes.data.filter(i => i.status === "accepted"));
        setCalendarConnected(calRes.data.connected || false);
      } catch {}
    };
    load();
  }, []);

  const toggleStandby = async () => {
    try {
      await api.put("/users/settings", { is_standby: !isStandby });
      setIsStandby(!isStandby);
      toast.success(isStandby ? "Standby mode off" : "Standby mode on – you're available for urgent gigs!");
    } catch { toast.error("Failed to update"); }
  };

  const handleCalendarConnect = async () => {
    setCalendarLoading(true);
    try {
      if (calendarConnected) {
        await api.post("/calendar/disconnect");
        setCalendarConnected(false);
        toast.success("Google Calendar disconnected");
      } else {
        await api.post("/calendar/connect");
        setCalendarConnected(true);
        toast.success("Google Calendar connected! (Preview mode — sync coming soon)");
      }
    } catch { toast.error("Failed to update calendar connection"); }
    finally { setCalendarLoading(false); }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = [];
    gigs.forEach(g => {
      g.sessions?.forEach(s => {
        if (s.date === dateStr) {
          events.push({ type: "gig", title: g.title, event_type: s.event_type, status: g.status });
        }
      });
    });
    invites.forEach(inv => {
      if (inv.session_date === dateStr) {
        events.push({ type: "invite", title: inv.gig_title, role: inv.role });
      }
    });
    return events;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 font-display">Calendar</h1>
            <p className="text-slate-500 text-sm mt-0.5">Your availability & scheduled gigs</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Google Calendar connect */}
            <Button
              data-testid="google-calendar-btn"
              size="sm"
              variant="outline"
              onClick={handleCalendarConnect}
              disabled={calendarLoading}
              className={`text-xs gap-1.5 ${calendarConnected ? "border-emerald-400 text-emerald-600 hover:bg-emerald-50" : "border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600"}`}
            >
              {calendarLoading
                ? <RefreshCw size={12} className="animate-spin" />
                : calendarConnected ? <Link size={12} /> : <Link2Off size={12} />
              }
              {calendarConnected ? "Google Cal: Connected" : "Connect Google Calendar"}
            </Button>
            <button
              data-testid="standby-toggle"
              onClick={toggleStandby}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-display transition-all ${isStandby ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              <Zap size={14} className={isStandby ? "text-emerald-400" : ""} />
              {isStandby ? "Standby: ON" : "Standby: OFF"}
            </button>
          </div>
        </div>

        {/* Google Calendar preview banner */}
        {calendarConnected && (
          <div className="p-3 rounded-lg border flex items-center gap-2 text-xs" style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" }}>
            <Link size={12} className="text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 font-display font-medium">Google Calendar connected</span>
            <span className="text-zinc-500">— Two-way sync is in preview mode. Your gig sessions will auto-sync once Google OAuth credentials are configured.</span>
          </div>
        )}

        {/* Calendar */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <button data-testid="prev-month-btn" onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 font-display">{MONTHS[month]} {year}</h2>
            <button data-testid="next-month-btn" onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs text-slate-400 font-display py-1.5">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px" style={{ background: "#E2E8F0" }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} style={{ background: "#FFFFFF", minHeight: "72px" }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const events = getEventsForDay(day);
              return (
                <div key={day} data-testid={`calendar-day-${dateStr}`} className="p-2 min-h-[72px]" style={{ background: "#FFFFFF" }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display mb-1 ${isToday ? "text-white font-bold" : "text-slate-500"}`} style={isToday ? { background: "#E05D26" } : {}}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {events.slice(0, 2).map((ev, i) => (
                      <div key={i} className="text-[10px] px-1 py-0.5 rounded truncate font-display" style={{
                        background: ev.type === "gig" ? "rgba(224,93,38,0.12)" : "rgba(59,130,246,0.12)",
                        color: ev.type === "gig" ? "#C2410C" : "#2563EB"
                      }}>
                        {ev.type === "gig" ? ev.event_type : ev.role}
                      </div>
                    ))}
                    {events.length > 2 && <div className="text-[10px] text-slate-400 px-1">+{events.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500 font-display">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "rgba(224,93,38,0.25)" }} />My Gigs</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "rgba(59,130,246,0.25)" }} />Booked Sessions</span>
          <span className="flex items-center gap-1.5"><Zap size={10} className="text-emerald-500" />Standby Active</span>
        </div>

        {/* Note about 90-min buffer */}
        <div className="p-3 rounded-lg border border-orange-100 text-xs text-slate-500 bg-orange-50">
          <span className="text-orange-600 font-display">90-min buffer rule:</span> The platform enforces a minimum 90-minute gap between back-to-back bookings on the same day to ensure gear pack-down and travel time.
        </div>
      </div>
    </Layout>
  );
}
