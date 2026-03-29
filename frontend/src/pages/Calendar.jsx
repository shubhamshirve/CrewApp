import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Zap, ChevronLeft, ChevronRight, Link, Link2Off, RefreshCw,
  MapPin, Clock, Calendar as CalIcon, X, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [gigs, setGigs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [isStandby, setIsStandby] = useState(user?.is_standby || false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD"

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
  }, [api]);

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

  /** Returns full event objects including gig_id for navigation */
  const getEventsForDay = (dateStr) => {
    const events = [];
    gigs.forEach(g => {
      g.sessions?.forEach(s => {
        if (s.date === dateStr) {
          events.push({
            type: "gig",
            gig_id: g.id,
            title: g.title,
            event_type: s.event_type,
            status: g.status,
            start_time: s.start_time,
            end_time: s.end_time,
            location: s.location,
            venue_name: s.venue_name,
            role: "Lead Photographer",
          });
        }
      });
    });
    invites.forEach(inv => {
      if (inv.session_date === dateStr) {
        events.push({
          type: "invite",
          gig_id: inv.gig_id,
          title: inv.gig_title || "Untitled Gig",
          event_type: inv.event_type || "",
          status: inv.status,
          start_time: inv.start_time || "",
          end_time: inv.end_time || "",
          location: inv.location || "",
          venue_name: inv.venue_name || "",
          role: inv.role,
        });
      }
    });
    return events;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

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

        {calendarConnected && (
          <div className="p-3 rounded-lg border flex items-center gap-2 text-xs" style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" }}>
            <Link size={12} className="text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 font-display font-medium">Google Calendar connected</span>
            <span className="text-zinc-500">— Two-way sync is in preview mode. Your gig sessions will auto-sync once Google OAuth credentials are configured.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Calendar grid */}
          <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <button data-testid="prev-month-btn" onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-semibold text-slate-900 font-display">{MONTHS[month]} {year}</h2>
              <button data-testid="next-month-btn" onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs text-slate-400 font-display py-1.5">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px" style={{ background: "#E2E8F0" }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} style={{ background: "#FFFFFF", minHeight: "68px" }} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const events = getEventsForDay(dateStr);
                const hasEvents = events.length > 0;

                return (
                  <div
                    key={day}
                    data-testid={`calendar-day-${dateStr}`}
                    onClick={() => hasEvents ? setSelectedDate(isSelected ? null : dateStr) : setSelectedDate(null)}
                    className={`p-1.5 min-h-[68px] transition-colors ${
                      hasEvents ? "cursor-pointer hover:bg-orange-50" : "cursor-default"
                    } ${isSelected ? "bg-orange-50 ring-1 ring-inset ring-orange-300" : ""}`}
                    style={{ background: isSelected ? "#FFF7ED" : "#FFFFFF" }}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-display mb-1 mx-auto ${
                        isToday ? "text-white font-bold" : "text-slate-500"
                      }`}
                      style={isToday ? { background: "#E05D26" } : {}}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 2).map((ev, i) => (
                        <div
                          key={i}
                          className="text-[10px] px-1 py-0.5 rounded truncate font-display"
                          style={{
                            background: ev.type === "gig" ? "rgba(224,93,38,0.15)" : "rgba(59,130,246,0.15)",
                            color: ev.type === "gig" ? "#C2410C" : "#2563EB",
                          }}
                        >
                          {ev.type === "gig" ? ev.event_type || ev.title : ev.role}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[10px] text-slate-400 px-1 font-display">+{events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail panel */}
          <div className="lg:col-span-1">
            {selectedDate && selectedEvents.length > 0 ? (
              <div
                data-testid="day-detail-panel"
                className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden"
                style={{ borderTop: "2.5px solid #E05D26" }}
              >
                {/* Panel header */}
                <div className="px-4 py-3 flex items-start justify-between gap-2 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CalIcon size={13} className="text-orange-500" />
                      <p className="text-xs font-semibold text-orange-600 font-display uppercase tracking-wide">
                        {selectedEvents.length} Gig{selectedEvents.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 font-display mt-0.5">{selectedDateLabel}</p>
                  </div>
                  <button
                    data-testid="close-day-panel-btn"
                    onClick={() => setSelectedDate(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Event list */}
                <div className="divide-y divide-slate-100">
                  {selectedEvents.map((ev, i) => (
                    <div
                      key={i}
                      data-testid={`day-event-${i}`}
                      className="px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Type badge */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-display font-semibold"
                              style={{
                                background: ev.type === "gig" ? "rgba(224,93,38,0.12)" : "rgba(59,130,246,0.12)",
                                color: ev.type === "gig" ? "#C2410C" : "#2563EB",
                              }}
                            >
                              {ev.type === "gig" ? "My Gig" : "Booked"}
                            </span>
                            {ev.event_type && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-display bg-slate-100 text-slate-500">
                                {ev.event_type}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <p className="text-sm font-semibold text-slate-900 font-display truncate">{ev.title}</p>

                          {/* Role */}
                          {ev.role && (
                            <p className="text-xs text-slate-500 mt-0.5 font-display">{ev.role}</p>
                          )}

                          {/* Time */}
                          {ev.start_time && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                              <Clock size={10} />
                              <span>{ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}</span>
                            </div>
                          )}

                          {/* Location */}
                          {ev.location && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <MapPin size={10} />
                              <span className="truncate">{ev.venue_name ? `${ev.venue_name}, ` : ""}{ev.location}</span>
                            </div>
                          )}
                        </div>

                        {/* View button */}
                        {ev.gig_id && (
                          <Button
                            size="sm"
                            data-testid={`view-gig-btn-${i}`}
                            onClick={() => navigate(`/gigs/${ev.gig_id}`)}
                            className="h-7 text-xs px-3 font-display gap-1 flex-shrink-0 text-white"
                            style={{ background: "#E05D26" }}
                          >
                            View <ArrowRight size={10} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Empty state — shown when no date selected */
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                <CalIcon size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-display">Click a booked date</p>
                <p className="text-xs text-slate-300 mt-1">to see your gigs for that day</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500 font-display">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "rgba(224,93,38,0.25)" }} />My Gigs</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "rgba(59,130,246,0.25)" }} />Booked Sessions</span>
          <span className="flex items-center gap-1.5"><Zap size={10} className="text-emerald-500" />Standby Active</span>
        </div>

        {/* 90-min buffer note */}
        <div className="p-3 rounded-lg border border-orange-100 text-xs text-slate-500 bg-orange-50">
          <span className="text-orange-600 font-display">90-min buffer rule:</span> The platform enforces a minimum 90-minute gap between back-to-back bookings on the same day to ensure gear pack-down and travel time.
        </div>
      </div>
    </Layout>
  );
}
