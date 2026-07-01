import React from "react";

export default function StyleAndWorkflow({ profile }) {
  if (!profile.style_tags?.length && !profile.editing_ecosystem?.length) return null;

  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white">
      <h3 className="text-sm font-semibold text-slate-900 font-display mb-3">Style & Workflow</h3>
      {profile.style_tags?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-1.5 font-display uppercase tracking-wide">Shooting Style</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.style_tags.map(t => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full border font-display border-orange-200 text-orange-600 bg-orange-50">{t}</span>
            ))}
          </div>
        </div>
      )}
      {profile.editing_ecosystem?.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1.5 font-display uppercase tracking-wide">Editing Software</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.editing_ecosystem.map(e => (
              <span key={e} className="text-xs px-2.5 py-1 rounded-full border font-display border-slate-200 text-slate-600 bg-slate-50">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
