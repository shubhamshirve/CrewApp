import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, MapPin, Star, Shield, Zap, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/contexts/AuthContext";

const ROLES = ["Lead Photographer","Second Shooter","Traditional Videographer","Cinematic Videographer","Drone Operator","Photo Assistant","Video Assistant","Lighting Technician"];
const STYLES = ["Cinematic","Candid","Traditional","Documentary","Fine Art","Dark & Moody","Bright & Airy"];

export default function Search() {
  const navigate = useNavigate();
  const api = useApi();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [style, setStyle] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (role) params.append("role", role);
      if (style) params.append("style", style);
      if (verifiedOnly) params.append("verified_only", "true");
      const res = await api.get(`/users/search?${params.toString()}`);
      setResults(res.data);
    } catch { toast.error("Search failed"); } finally { setLoading(false); }
  }, [query, role, style, verifiedOnly]);

  useEffect(() => {
    const t = setTimeout(doSearch, 400);
    return () => clearTimeout(t);
  }, [query, role, style, verifiedOnly]);

  const inputClass = "bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500/50";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-white font-display">Discover Crew</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Find verified photographers, videographers, and assistants</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input data-testid="search-input" className={`pl-9 ${inputClass}`} placeholder="Search by name..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <Button data-testid="toggle-filters-btn" variant="outline" className="border-white/10 text-zinc-400 hover:text-white gap-2" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> Filters
            {(role || style || verifiedOnly) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 rounded-xl border space-y-3" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 font-display mb-1 block">Role</label>
                <select data-testid="filter-role" value={role} onChange={e => setRole(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}>
                  <option value="">All Roles</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-display mb-1 block">Style</label>
                <select data-testid="filter-style" value={style} onChange={e => setStyle(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputClass} border`}>
                  <option value="">All Styles</option>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" data-testid="filter-verified" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="accent-amber-500" />
                <span className="text-xs text-zinc-300 font-display">Verified only</span>
              </label>
              {(role || style || verifiedOnly) && (
                <button onClick={() => { setRole(""); setStyle(""); setVerifiedOnly(false); }} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1" data-testid="clear-filters-btn">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div>
          <p className="text-xs text-zinc-500 mb-3 font-display">{loading ? "Searching..." : `${results.length} professional${results.length !== 1 ? "s" : ""} found`}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map(u => (
              <div key={u.id} data-testid={`user-card-${u.id}`} className="p-4 rounded-xl border card-hover cursor-pointer" style={{ background: "#131315", borderColor: "rgba(255,255,255,0.07)" }} onClick={() => navigate(`/profile/${u.id}`)}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-semibold text-sm" style={{ background: "#F59E0B1A", color: "#F59E0B" }}>
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-white font-display">{u.full_name}</span>
                      {u.is_verified && <Shield size={11} className="text-blue-400" />}
                      {u.is_standby && <Zap size={11} className="text-emerald-400" />}
                    </div>
                    {u.primary_role && <p className="text-xs text-amber-400 font-display mt-0.5">{u.primary_role}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      {u.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{u.location}</span>}
                      {u.avg_rating && <span className="flex items-center gap-0.5"><Star size={9} className="text-amber-400" />{u.avg_rating.toFixed(1)}</span>}
                      {u.primary_rate > 0 && <span>₹{u.primary_rate?.toLocaleString("en-IN")}/day</span>}
                    </div>
                  </div>
                </div>
                {u.style_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {u.style_tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border font-display" style={{ borderColor: "rgba(245,158,11,0.2)", color: "#D97706", background: "rgba(245,158,11,0.06)" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!loading && results.length === 0 && (
            <div className="text-center py-16">
              <SearchIcon size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No professionals found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
