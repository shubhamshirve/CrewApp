import React from "react";

export default function RatingsSection({ ratings }) {
  const avgStyle = ratings.ratings?.length ? {
    punctuality: (ratings.ratings.reduce((s, r) => s + r.punctuality, 0) / ratings.ratings.length).toFixed(1),
    gear_handling: (ratings.ratings.reduce((s, r) => s + r.gear_handling, 0) / ratings.ratings.length).toFixed(1),
    teamwork: (ratings.ratings.reduce((s, r) => s + r.teamwork, 0) / ratings.ratings.length).toFixed(1),
  } : null;

  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white" data-testid="ratings-section">
      <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Rating Breakdown</h3>
      {avgStyle ? (
        <div className="space-y-2.5">
          {[["Punctuality", avgStyle.punctuality], ["Gear Handling", avgStyle.gear_handling], ["Teamwork", avgStyle.teamwork]].map(([label, val]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 font-display">{label}</span>
                <span className="text-orange-500 font-display">{val}/5</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-orange-400" style={{ width: `${(val / 5) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-2">{ratings.total_ratings} anonymous review{ratings.total_ratings !== 1 ? "s" : ""}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">No ratings yet</p>
      )}
    </div>
  );
}
