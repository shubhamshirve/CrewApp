import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, UserX, UserPlus, MapPin, Shield, Star, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Connections() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [connRes, reqRes] = await Promise.all([
        api.get("/connections"),
        api.get("/connections/requests"),
      ]);
      setConnections(connRes.data);
      setRequests(reqRes.data);
    } catch { } finally { setLoading(false); }
  };

  const handleAccept = async (connId) => {
    try {
      await api.put(`/connections/${connId}/accept`);
      toast.success("Connection accepted!");
      load();
    } catch { toast.error("Failed"); }
  };

  const handleReject = async (connId) => {
    try {
      await api.put(`/connections/${connId}/reject`);
      toast.success("Request rejected");
      load();
    } catch { toast.error("Failed"); }
  };

  const handleRemove = async (connId) => {
    try {
      await api.delete(`/connections/${connId}`);
      toast.success("Connection removed");
      load();
    } catch { toast.error("Failed"); }
  };

  const UserCard = ({ conn, actions }) => {
    const u = conn.user;
    if (!u) return null;
    return (
      <div data-testid={`connection-card-${conn.id}`} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 card-hover bg-white shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => navigate(`/profile/${u.id}`)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-semibold text-sm" style={{ background: "#E05D2618", color: "#E05D26" }}>
            {u.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-900 font-display truncate">{u.full_name}</span>
              {u.is_verified && <Shield size={11} className="text-blue-500 flex-shrink-0" />}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              {u.primary_role && <span className="text-orange-500 font-display">{u.primary_role}</span>}
              {u.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{u.location}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 font-display">My Network</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your professional connections</p>
          </div>
          <Button data-testid="discover-btn" onClick={() => navigate("/search")} style={{ background: "#E05D26" }} className="text-sm font-display font-semibold text-white">
            <UserPlus size={15} className="mr-1.5" /> Discover
          </Button>
        </div>

        <Tabs defaultValue="connections">
          <TabsList className="bg-slate-100 border border-slate-200 w-full">
            <TabsTrigger value="connections" data-testid="tab-connections" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm font-display text-xs text-slate-500">
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm font-display text-xs text-slate-500">
              Requests ({requests.received.length + requests.sent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-4 space-y-3">
            {connections.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <UserCheck size={32} className="text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400">No connections yet.</p>
                <Button data-testid="discover-crew-btn" onClick={() => navigate("/search")} size="sm" style={{ background: "#E05D26" }} className="font-display text-white">Discover Crew</Button>
              </div>
            ) : (
              connections.map(conn => (
                <UserCard key={conn.id} conn={conn} actions={
                  <button data-testid={`remove-conn-${conn.id}`} onClick={() => handleRemove(conn.id)} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1">Remove</button>
                } />
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-4">
            {requests.received.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 font-display uppercase tracking-wide mb-3">Received ({requests.received.length})</p>
                <div className="space-y-3">
                  {requests.received.map(req => (
                    <UserCard key={req.id} conn={req} actions={
                      <>
                        <button data-testid={`accept-conn-${req.id}`} onClick={() => handleAccept(req.id)} className="text-xs px-3 py-1.5 rounded-lg font-display font-semibold text-white" style={{ background: "#E05D26" }}>Accept</button>
                        <button data-testid={`reject-conn-${req.id}`} onClick={() => handleReject(req.id)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 font-display">Decline</button>
                      </>
                    } />
                  ))}
                </div>
              </div>
            )}
            {requests.sent.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 font-display uppercase tracking-wide mb-3">Sent ({requests.sent.length})</p>
                <div className="space-y-3">
                  {requests.sent.map(req => (
                    <UserCard key={req.id} conn={req} actions={
                      <span className="text-xs flex items-center gap-1.5 text-slate-400 font-display"><Clock size={12} /> Pending</span>
                    } />
                  ))}
                </div>
              </div>
            )}
            {requests.received.length === 0 && requests.sent.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-slate-400">No pending requests</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
