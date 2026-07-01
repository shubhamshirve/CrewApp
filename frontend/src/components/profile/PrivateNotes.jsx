import React from "react";
import { StickyNote, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivateNotes({ profile, note, onNoteChange, noteLoading, noteSaving, noteExists, onSaveNote, onDeleteNote }) {
  return (
    <div data-testid="lead-notes-section" className="p-5 rounded-xl border border-orange-100 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote size={14} className="text-orange-500" />
        <h3 className="text-sm font-semibold text-slate-900 font-display">Private Notes</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-display ml-auto bg-orange-50 text-orange-500">Only visible to you</span>
      </div>
      {noteLoading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-orange-400/40 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading…</span>
        </div>
      ) : (
        <>
          <textarea
            data-testid="lead-note-input"
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:border-orange-400 resize-none h-24 transition-colors"
            placeholder={`Private notes about ${profile.full_name}…`}
            value={note}
            onChange={e => onNoteChange(e.target.value)}
          />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" data-testid="save-note-btn" onClick={onSaveNote} disabled={noteSaving || !note.trim()}
              className="gap-1.5 text-xs font-display" style={{ background: "#F97316", color: "#fff" }}>
              <Save size={12} />{noteSaving ? "Saving…" : "Save Note"}
            </Button>
            {noteExists && (
              <Button size="sm" variant="outline" data-testid="delete-note-btn" onClick={onDeleteNote}
                className="gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50 font-display">
                <Trash2 size={12} /> Delete
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
