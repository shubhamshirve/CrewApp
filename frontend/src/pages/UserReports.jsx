import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import {
  BarChart2, BookOpen, CreditCard, Clock, Briefcase, TrendingUp,
  ChevronRight, CheckCircle2, AlertCircle, IndianRupee, Calendar,
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "bookings", label: "Bookings", icon: BookOpen },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "pending", label: "Pending", icon: Clock },
  { id: "monthly", label: "Monthly", icon: BarChart2 },
  { id: "expenses", label: "Gig Expenses", icon: Briefcase },
];

function Stat({ label, value, sub, color = "#F97316" }) {
  return (
    <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
      <p className="text-xs text-slate-400 font-display mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

export default function UserReports() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [payments, setPayments] = useState(null);
  const [pending, setPending] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, b, p, pend, m, e] = await Promise.all([
          api.get("/reports/summary"),
          api.get("/reports/bookings"),
          api.get("/reports/payments"),
          api.get("/reports/pending"),
          api.get("/reports/monthly"),
          api.get("/reports/gig-expenses"),
        ]);
        setSummary(s.data);
        setBookings(b.data);
        setPayments(p.data);
        setPending(pend.data);
        setMonthly(m.data);
        setExpenses(e.data);
      } catch {
        toast.error("Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-20">
        <h1 className="text-2xl font-bold text-slate-900 font-display mb-6">My Reports</h1>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              data-testid={`report-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-orange-200"
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
            Loading reports…
          </div>
        ) : (
          <>
            {/* ── Overview ── */}
            {activeTab === "overview" && summary && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 font-display mb-3">As Freelancer</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Stat label="Total Bookings" value={summary.as_freelancer.total_bookings} />
                    <Stat label="Total Earned" value={fmt(summary.as_freelancer.total_earned)} color="#16a34a" />
                    <Stat label="This Month" value={fmt(summary.as_freelancer.this_month_earned)} />
                    <Stat label="Advance Pending" value={fmt(summary.as_freelancer.pending_advance)} color="#F59E0B" sub="Awaiting advance" />
                    <Stat label="Balance Pending" value={fmt(summary.as_freelancer.pending_balance)} color="#EF4444" sub="Awaiting balance" />
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 font-display mb-3">As Gig Creator</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Stat label="My Gigs" value={summary.as_lead.total_gigs} />
                    <Stat label="Paid to Crew" value={fmt(summary.as_lead.total_paid_to_crew)} color="#3B82F6" />
                    <Stat label="Pending to Crew" value={fmt(summary.as_lead.pending_to_crew)} color="#F59E0B" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Booking History ── */}
            {activeTab === "bookings" && (
              bookings?.length ? (
                <div className="space-y-3">
                  {bookings.map(b => (
                    <div
                      key={b.invite_id}
                      data-testid={`booking-${b.invite_id}`}
                      onClick={() => navigate(`/gigs/${b.gig_id}`)}
                      className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm cursor-pointer hover:border-orange-200 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 font-display truncate">{b.gig_title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{b.role} · {b.session_date} · Lead: {b.lead_name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">{fmt(b.agreed_fee)}</p>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <span className={`w-2 h-2 rounded-full ${b.advance_paid ? "bg-green-400" : "bg-amber-400"}`} />
                            <span className={`w-2 h-2 rounded-full ${b.balance_paid ? "bg-green-400" : "bg-red-400"}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-slate-400">
                        <span className={b.advance_paid ? "text-green-600" : "text-amber-600"}>
                          Advance {b.advance_paid ? "✓ paid" : `${fmt(b.advance_amount)} due`}
                        </span>
                        <span className={b.balance_paid ? "text-green-600" : "text-red-500"}>
                          Balance {b.balance_paid ? "✓ paid" : `${fmt(b.balance_amount)} due`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState msg="No bookings yet" />
            )}

            {/* ── Payment History ── */}
            {activeTab === "payments" && (
              payments?.length ? (
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div key={i} data-testid={`payment-${i}`} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.type === "Advance" ? "bg-amber-400" : "bg-blue-500"}`}>
                          {p.type[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 font-display">{p.type} · {p.gig_title}</p>
                          <p className="text-xs text-slate-400">{p.role} · {p.session_date}</p>
                          {p.paid_at && <p className="text-xs text-slate-300">Paid {p.paid_at?.slice(0, 10)}</p>}
                        </div>
                      </div>
                      <p className="text-base font-bold text-green-600">{fmt(p.amount)}</p>
                    </div>
                  ))}
                  <div className="p-4 rounded-2xl border border-green-100 bg-green-50">
                    <p className="text-sm font-bold text-green-800">
                      Total Received: {fmt(payments.reduce((s, p) => s + p.amount, 0))}
                    </p>
                  </div>
                </div>
              ) : <EmptyState msg="No payments received yet" />
            )}

            {/* ── Pending Payments ── */}
            {activeTab === "pending" && (
              pending?.length ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 font-display">
                    Total pending: <strong>{fmt(pending.reduce((s, p) => s + p.total_pending, 0))}</strong> across {pending.length} booking(s)
                  </div>
                  {pending.map(p => (
                    <div key={p.invite_id} data-testid={`pending-${p.invite_id}`} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 font-display">{p.gig_title}</p>
                          <p className="text-xs text-slate-500">{p.role} · {p.session_date}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Lead: {p.lead_name}
                            {p.lead_phone && <span className="ml-2 text-blue-400">📞 {p.lead_phone}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-red-500">{fmt(p.total_pending)}</p>
                          <p className="text-xs text-slate-400">pending</p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs">
                        {p.advance_pending && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle size={11} /> Advance {fmt(p.advance_amount)} due
                          </span>
                        )}
                        {p.balance_pending && (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertCircle size={11} /> Balance {fmt(p.balance_amount)} due
                          </span>
                        )}
                        {!p.advance_pending && !p.balance_pending && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={11} /> Fully paid
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400" />
                  <p className="text-sm text-slate-500">All payments are settled!</p>
                </div>
              )
            )}

            {/* ── Monthly Ledger ── */}
            {activeTab === "monthly" && (
              monthly?.length ? (
                <div className="space-y-2">
                  {monthly.map(m => (
                    <div key={m.month_key} data-testid={`monthly-${m.month_key}`} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800 font-display">{m.month_label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{m.bookings} booking(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{fmt(m.earned)}</p>
                          {m.pending > 0 && <p className="text-xs text-amber-500">{fmt(m.pending)} pending</p>}
                        </div>
                      </div>
                      {/* Mini bar */}
                      {(m.earned + m.pending) > 0 && (
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full"
                            style={{ width: `${Math.round((m.earned / (m.earned + m.pending)) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <EmptyState msg="No monthly data yet" />
            )}

            {/* ── Gig Expenses (as Lead) ── */}
            {activeTab === "expenses" && (
              expenses?.length ? (
                <div className="space-y-4">
                  {expenses.map(g => (
                    <div key={g.gig_id} data-testid={`expense-${g.gig_id}`} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => navigate(`/gigs/${g.gig_id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800 font-display">{g.gig_title}</p>
                            <p className="text-xs text-slate-400">{g.team_size} crew member(s)</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{fmt(g.total_crew_fees)}</p>
                            <p className="text-xs text-green-600">Paid {fmt(g.total_paid)}</p>
                            {g.total_pending > 0 && <p className="text-xs text-amber-500">{fmt(g.total_pending)} pending</p>}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-slate-50">
                        {g.entries.map((e, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-slate-50 last:border-0">
                            <div>
                              <span className="font-medium text-slate-700">{e.freelancer_name}</span>
                              <span className="text-slate-400 ml-2">{e.role} · {e.session_date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{fmt(e.agreed_fee)}</span>
                              <div className="flex gap-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${e.advance_paid ? "bg-green-400" : "bg-amber-300"}`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${e.balance_paid ? "bg-green-400" : "bg-red-300"}`} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState msg="No gigs created yet" />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
