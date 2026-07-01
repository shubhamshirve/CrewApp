import React, { useState, useEffect } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "profile_checklist_dismissed_v1";

/**
 * ProfileChecklist — shown on own profile when not 100% complete.
 * Dismissible; once all items are done it auto-hides.
 *
 * Props:
 *   checklist  – { items, done_count, total, percent, complete }
 *   onDismiss  – called when user permanently dismisses
 */
export default function ProfileChecklist({ checklist, onDismiss }) {
  const [expanded, setExpanded] = useState(false);

  if (!checklist || checklist.complete) return null;

  const { items, done_count, total, percent } = checklist;
  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
          <Sparkles size={16} className="text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 font-display">
              Complete your profile
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium font-display">
              {done_count}/{total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 rounded-full bg-violet-100 overflow-hidden w-full max-w-xs">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {percent}% complete — a full profile gets 3× more booking requests
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            title={expanded ? "Collapse" : "Show checklist"}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Dismiss checklist"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expandable checklist */}
      {expanded && (
        <div className="border-t border-violet-100 px-5 py-4 space-y-2">
          {/* Pending items first */}
          {pending.map(item => (
            <div key={item.id} className="flex items-start gap-2.5">
              <Circle size={15} className="text-slate-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 font-display">{item.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.hint}</p>
              </div>
            </div>
          ))}
          {/* Completed items */}
          {done.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Done</p>
              {done.map(item => (
                <div key={item.id} className="flex items-center gap-2.5 opacity-60">
                  <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-slate-500 font-display line-through">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
