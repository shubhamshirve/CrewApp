import React from "react";
import { Camera, Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAT_COLORS } from "./profileConstants";

export default function GearVault({ profile, isOwn, onAddGear, onEditGear, onDeleteGear }) {
  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 font-display flex items-center gap-2">
          <Camera size={14} className="text-orange-500" /> Gear Vault
          <span className="text-xs font-normal text-slate-400">({profile.gear_vault?.length || 0})</span>
        </h3>
        {isOwn && (
          <Button size="sm" data-testid="add-gear-btn" onClick={onAddGear}
            className="h-7 text-xs font-display gap-1 text-white" style={{ background: "#F97316" }}>
            <Plus size={12} /> Add Gear
          </Button>
        )}
      </div>
      {(profile.gear_vault?.length || 0) === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No gear listed yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {profile.gear_vault.map((g) => (
            <div
              key={g.id || g.name}
              data-testid={`gear-item-${g.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-display group"
              style={{
                borderColor: `${CAT_COLORS[g.category] || "#6B7280"}40`,
                background: `${CAT_COLORS[g.category] || "#6B7280"}0D`,
                color: CAT_COLORS[g.category] || "#6B7280",
              }}
            >
              <span>{g.name}</span>
              {g.brand && <span className="opacity-50">· {g.brand}</span>}
              <span className="text-[10px] opacity-50">{g.category}</span>
              {isOwn && (
                <div className="hidden group-hover:flex items-center gap-1 ml-1">
                  <button onClick={() => onEditGear(g)} className="hover:opacity-80" title="Edit"><Pencil size={11} /></button>
                  <button onClick={() => onDeleteGear(g.id)} className="hover:opacity-80" title="Delete"><X size={11} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
