import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import ProfileChecklist from "@/components/ProfileChecklist";

import ProfileHeader from "@/components/profile/ProfileHeader";
import GearVault from "@/components/profile/GearVault";
import RatingsSection from "@/components/profile/RatingsSection";
import StyleAndWorkflow from "@/components/profile/StyleAndWorkflow";
import UsernameSetup from "@/components/profile/UsernameSetup";
import PrivateNotes from "@/components/profile/PrivateNotes";
import EditProfileDialog from "@/components/profile/EditProfileDialog";
import ChangePasswordDialog from "@/components/profile/ChangePasswordDialog";
import GearDialog from "@/components/profile/GearDialog";
import DocUploadDialog from "@/components/profile/DocUploadDialog";

export default function Profile() {
  const { id, username: usernameParam } = useParams();
  const profileIdentifier = usernameParam || id;
  const { user, api, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState({ avg_rating: null, total_ratings: 0, ratings: [] });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Username setup
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const usernameTimer = useRef(null);

  // Profile checklist
  const [checklist, setChecklist] = useState(null);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem("profile_checklist_dismissed_v1") === "true"
  );

  // Dialog open states
  const [editing, setEditing] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [docDialog, setDocDialog] = useState(false);

  // Notes
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteExists, setNoteExists] = useState(false);

  // Gear
  const [gearDialog, setGearDialog] = useState(null);
  const [gearStep, setGearStep] = useState(0);
  const [gearForm, setGearForm] = useState({ name: "", category: "Camera", brand: "", model_number: "", is_custom: false });
  const [gearSaving, setGearSaving] = useState(false);
  const [masterGear, setMasterGear] = useState([]);

  const isOwn = user?.id === id || (!id && !usernameParam);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, ratingsRes] = await Promise.all([
          api.get(`/users/${profileIdentifier}`),
          api.get(`/ratings/user/${profileIdentifier}`),
        ]);
        setProfile(userRes.data);
        const resolvedId = userRes.data.id;
        const ownProfile = user?.id === resolvedId;
        if (!ownProfile) {
          const conns = await api.get("/connections");
          const found = conns.data.find(c => c.user?.id === resolvedId);
          setConnectionStatus(found ? "connected" : null);
          if (found) {
            setNoteLoading(true);
            try {
              const noteRes = await api.get(`/notes/${resolvedId}`);
              setNote(noteRes.data.content || "");
              setNoteExists(noteRes.data.exists || false);
            } catch { /* non-critical */ }
            finally { setNoteLoading(false); }
          }
        }
        setRatings(ratingsRes.data);
        try {
          const metaRes = await api.get("/platform/gear-catalogue");
          setMasterGear(metaRes.data?.items || []);
        } catch { /* fallback */ }
        if (user?.id === userRes.data.id) {
          try {
            const clRes = await api.get("/users/me/checklist");
            setChecklist(clRes.data);
          } catch { /* non-critical */ }
        }
      } catch { toast.error("Failed to load profile"); }
      finally { setLoading(false); }
    };
    load();
  }, [id, isOwn]);

  const handleConnect = async () => {
    try {
      await api.post(`/connections/${profile.id}`);
      setConnectionStatus("pending");
      toast.success("Connection request sent!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      await api.put(`/notes/${profile.id}`, { content: note });
      setNoteExists(true);
      toast.success("Note saved privately!");
    } catch { toast.error("Failed to save note"); }
    finally { setNoteSaving(false); }
  };

  const handleDeleteNote = async () => {
    try {
      await api.delete(`/notes/${profile.id}`);
      setNote(""); setNoteExists(false);
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
  };

  const openGearAdd = () => {
    setGearStep(0);
    setGearForm({ name: "", category: "Camera", brand: "", model_number: "", is_custom: false });
    setGearDialog({ mode: "add" });
  };

  const openGearEdit = (item) => {
    setGearForm({ name: item.name, category: item.category, brand: item.brand || "", model_number: item.model_number || "", is_custom: false });
    setGearDialog({ mode: "edit", item });
  };

  const handleGearSave = async () => {
    const gearName = gearForm.name.trim();
    if (!gearName) { toast.error("Gear name required"); return; }
    if (!gearForm.category) { toast.error("Category required"); return; }
    setGearSaving(true);
    try {
      const payload = {
        name: gearName,
        category: gearForm.category,
        brand: gearForm.brand?.trim() || null,
        model_number: gearForm.model_number?.trim() || null,
      };
      if (gearDialog.mode === "add") {
        const res = await api.post("/users/gear", payload);
        setProfile(p => ({ ...p, gear_vault: [...(p.gear_vault || []), res.data] }));
        if (gearForm.is_custom) {
          try {
            const subRes = await api.post("/platform/gear-submissions", {
              name: gearName, category: gearForm.category, brand: gearForm.brand?.trim() || null,
            });
            if (subRes.data?.auto_approved) {
              toast.success("Gear added! AI auto-approved it — now in the master catalogue.");
            } else if (subRes.data?.already_in_catalogue) {
              toast.success("Gear added to your vault! (Already in master catalogue)");
            } else {
              toast.success("Gear added! Submitted for admin review to include in master catalogue.");
            }
          } catch { toast.success("Gear added to your vault!"); }
        } else {
          toast.success("Gear added!");
        }
      } else {
        await api.put(`/users/gear/${gearDialog.item.id}`, payload);
        setProfile(p => ({
          ...p,
          gear_vault: p.gear_vault.map(g => g.id === gearDialog.item.id ? { ...g, ...payload } : g),
        }));
        toast.success("Gear updated");
      }
      setGearDialog(null);
      setGearStep(0);
    } catch { toast.error("Failed to save gear"); }
    finally { setGearSaving(false); }
  };

  const handleGearDelete = async (gearId) => {
    try {
      await api.delete(`/users/gear/${gearId}`);
      setProfile(p => ({ ...p, gear_vault: p.gear_vault.filter(g => g.id !== gearId) }));
      toast.success("Gear removed");
    } catch { toast.error("Failed to remove gear"); }
  };

  const checkUsername = async (val) => {
    if (!val || val.length < 3) { setUsernameStatus(null); return; }
    const isValid = /^[a-z][a-z0-9_]{2,19}$/.test(val.toLowerCase());
    if (!isValid) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    try {
      const res = await api.get(`/users/check-username/${val.toLowerCase()}`);
      setUsernameStatus(res.data.available ? "available" : "taken");
    } catch { setUsernameStatus(null); }
  };

  const handleUsernameInputChange = (val) => {
    setUsernameInput(val.toLowerCase().replace(/[^a-z0-9_]/g, ""));
    setUsernameStatus(null);
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.trim().length >= 3) {
      usernameTimer.current = setTimeout(() => checkUsername(val.trim().toLowerCase()), 600);
    }
  };

  const handleSaveUsername = async () => {
    if (usernameStatus !== "available") return;
    setUsernameSaving(true);
    try {
      const res = await api.post("/users/set-username", { username: usernameInput.toLowerCase() });
      setProfile(res.data);
      await refreshUser();
      try { const cl = await api.get("/users/me/checklist"); setChecklist(cl.data); } catch {}
      toast.success(`@${usernameInput} set! Your profile is now at /u/${usernameInput}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save username");
    } finally { setUsernameSaving(false); }
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );
  if (!profile) return <Layout><p className="text-slate-400 text-center mt-20">Profile not found.</p></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <ProfileHeader
          profile={profile}
          isOwn={isOwn}
          connectionStatus={connectionStatus}
          ratings={ratings}
          onEdit={() => setEditing(true)}
          onConnect={handleConnect}
          onDocDialog={() => setDocDialog(true)}
          onAvatarUpdate={(url) => setProfile(p => ({ ...p, profile_image: url }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StyleAndWorkflow profile={profile} />
          <RatingsSection ratings={ratings} />
        </div>

        {isOwn && checklist && !checklist.complete && !checklistDismissed && (
          <ProfileChecklist
            checklist={checklist}
            onDismiss={() => {
              setChecklistDismissed(true);
              localStorage.setItem("profile_checklist_dismissed_v1", "true");
            }}
          />
        )}

        {isOwn && !profile.username && (
          <UsernameSetup
            usernameInput={usernameInput}
            usernameStatus={usernameStatus}
            usernameSaving={usernameSaving}
            onInputChange={handleUsernameInputChange}
            onSave={handleSaveUsername}
          />
        )}

        <GearVault
          profile={profile}
          isOwn={isOwn}
          onAddGear={openGearAdd}
          onEditGear={openGearEdit}
          onDeleteGear={handleGearDelete}
        />

        {!isOwn && connectionStatus === "connected" && (
          <PrivateNotes
            profile={profile}
            note={note}
            onNoteChange={setNote}
            noteLoading={noteLoading}
            noteSaving={noteSaving}
            noteExists={noteExists}
            onSaveNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
          />
        )}
      </div>

      <EditProfileDialog
        open={editing}
        onClose={() => setEditing(false)}
        profile={profile}
        onSaved={(updated) => setProfile(updated)}
        onChangePassword={() => setShowChangePass(true)}
      />

      <ChangePasswordDialog
        open={showChangePass}
        onClose={() => setShowChangePass(false)}
      />

      <GearDialog
        gearDialog={gearDialog}
        onClose={() => { setGearDialog(null); setGearStep(0); }}
        gearStep={gearStep}
        setGearStep={setGearStep}
        gearForm={gearForm}
        setGearForm={setGearForm}
        gearSaving={gearSaving}
        masterGear={masterGear}
        onSave={handleGearSave}
      />

      <DocUploadDialog
        open={docDialog}
        onClose={() => setDocDialog(false)}
        verificationStatus={profile.verification_status}
        onSuccess={() => setProfile(p => ({ ...p, verification_status: "pending" }))}
      />
    </Layout>
  );
}
