import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Shield, Users, KeyRound, ScrollText, Plus, Ban, RefreshCw } from "lucide-react";

const TABS = [
  { k: "users", t: "Users", Icon: Users },
  { k: "invites", t: "Clinician Invites", Icon: KeyRound },
  { k: "audit", t: "Audit Log", Icon: ScrollText },
];

function StatTile({ label, value, accent }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`font-serif text-3xl mt-1 ${accent || "text-white"}`}>{value}</div>
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("users");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [audit, setAudit] = useState([]);
  const [actionFilter, setActionFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [newInvite, setNewInvite] = useState({ email_allowed: "", expires_days: 30, code_prefix: "CLIN" });

  const refresh = async () => {
    try {
      const [s, u, i] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/invites"),
      ]);
      setStats(s.data);
      setUsers(u.data.users);
      setInvites(i.data.invites);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to load admin data");
    }
  };

  const refreshAudit = async () => {
    try {
      const r = await api.get("/admin/audit-log", {
        params: actionFilter ? { action: actionFilter } : {},
      });
      setAudit(r.data.events);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { if (user?.is_admin) refresh(); }, [user]);
  useEffect(() => { if (user?.is_admin && tab === "audit") refreshAudit(); }, [tab, actionFilter, user]);

  if (loading) return <div className="min-h-screen ambient-mesh flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) {
    return (
      <div className="min-h-screen ambient-mesh">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="glass rounded-xl p-8 border border-rose-500/30" data-testid="admin-denied">
            <Shield className="w-8 h-8 text-rose-400" />
            <h2 className="font-serif text-2xl text-white mt-3">Admin access required</h2>
            <p className="text-sm text-slate-400 mt-2">This area is restricted to backoffice administrators.</p>
          </div>
        </div>
      </div>
    );
  }

  const createInvite = async () => {
    setBusy(true);
    try {
      const body = {
        expires_days: Number(newInvite.expires_days) || 30,
        code_prefix: (newInvite.code_prefix || "CLIN").toUpperCase().slice(0, 20),
      };
      if (newInvite.email_allowed.trim()) body.email_allowed = newInvite.email_allowed.trim();
      const r = await api.post("/admin/invites", body);
      toast.success(`Invite created: ${r.data.invite_code}`);
      setNewInvite({ email_allowed: "", expires_days: 30, code_prefix: "CLIN" });
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create invite");
    } finally { setBusy(false); }
  };

  const revokeInvite = async (code) => {
    if (!window.confirm(`Revoke invite ${code}? This cannot be undone.`)) return;
    try {
      await api.post(`/admin/invites/${encodeURIComponent(code)}/revoke`);
      toast.success(`Revoked ${code}`);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Revoke failed");
    }
  };

  const toggleAdmin = async (u) => {
    if (u.id === user.id) {
      toast.error("You cannot demote yourself.");
      return;
    }
    try {
      await api.patch(`/admin/users/${u.id}`, { is_admin: !u.is_admin });
      toast.success(`${u.email} admin = ${!u.is_admin}`);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Update failed");
    }
  };

  return (
    <div className="min-h-screen ambient-mesh" data-testid="admin-page">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#22D3EE]">
          <Shield className="w-3 h-3" /> Backoffice · admin
        </div>
        <h1 className="font-serif text-4xl lg:text-5xl tracking-tight text-white mt-1">Operations console</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">Manage active users, generate or revoke clinician invites, and audit who accessed what.</p>

        {stats && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="admin-stats">
            <StatTile label="Total users" value={stats.total_users} />
            <StatTile label="Recovery users" value={stats.by_role.recovery_user} accent="text-emerald-300" />
            <StatTile label="Supporters" value={stats.by_role.supporter} accent="text-cyan-300" />
            <StatTile label="Clinicians" value={stats.by_role.clinician} accent="text-indigo-300" />
            <StatTile label="Audit events" value={stats.audit_events} accent="text-amber-300" />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/5 pb-2">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              data-testid={`admin-tab-${t.k}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                tab === t.k ? "bg-[#0F766E]/20 text-white border border-[#22D3EE]/30" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <t.Icon className="w-4 h-4" /> {t.t}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto text-slate-400 hover:text-white" data-testid="admin-refresh">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {tab === "users" && (
          <div className="mt-6 glass rounded-xl overflow-hidden" data-testid="admin-users-table">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Auth</th>
                  <th className="text-left p-3">Last entry</th>
                  <th className="text-left p-3">Created</th>
                  <th className="text-left p-3">Admin</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-xs text-slate-200">{u.email}</td>
                    <td className="p-3 text-slate-300">{u.name}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">{u.role}</span>
                      {u.verified_clinician && <span className="ml-1 text-[10px] text-emerald-300">✓verified</span>}
                    </td>
                    <td className="p-3 text-xs text-slate-400">{u.auth_provider}</td>
                    <td className="p-3 text-xs text-slate-400">{u.last_entry_date || "—"}</td>
                    <td className="p-3 text-xs text-slate-500">{u.created_at?.slice(0, 10)}</td>
                    <td className="p-3">{u.is_admin ? <span className="text-amber-300 text-xs">YES</span> : <span className="text-slate-500 text-xs">no</span>}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={() => toggleAdmin(u)}
                        data-testid={`toggle-admin-${u.email}`}
                      >
                        {u.is_admin ? "Revoke admin" : "Grant admin"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invites" && (
          <div className="mt-6 space-y-6">
            <div className="glass rounded-xl p-5" data-testid="invite-create">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-[#22D3EE]" />
                <h3 className="text-sm font-medium text-white">Generate clinician invite</h3>
              </div>
              <div className="grid md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Email restriction (optional)</Label>
                  <Input
                    value={newInvite.email_allowed}
                    onChange={(e) => setNewInvite({ ...newInvite, email_allowed: e.target.value })}
                    placeholder="dr.smith@hospital.org"
                    data-testid="invite-email"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Expires in (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={newInvite.expires_days}
                    onChange={(e) => setNewInvite({ ...newInvite, expires_days: e.target.value })}
                    data-testid="invite-expires"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Code prefix</Label>
                  <Input
                    value={newInvite.code_prefix}
                    onChange={(e) => setNewInvite({ ...newInvite, code_prefix: e.target.value.toUpperCase() })}
                    data-testid="invite-prefix"
                    className="mt-1 bg-white/5 border-white/10 text-white font-mono"
                  />
                </div>
                <Button
                  onClick={createInvite}
                  disabled={busy}
                  data-testid="invite-create-btn"
                  className="bg-[#0F766E] hover:bg-[#115e59] text-white"
                >
                  {busy ? "…" : "Generate"}
                </Button>
              </div>
            </div>

            <div className="glass rounded-xl overflow-hidden" data-testid="invites-table">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Email restriction</th>
                    <th className="text-left p-3">Created by</th>
                    <th className="text-left p-3">Expires</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => {
                    const expired = i.expires_at && new Date(i.expires_at) < new Date();
                    return (
                      <tr key={i.invite_code} className="border-t border-white/5 hover:bg-white/5">
                        <td className="p-3 font-mono text-xs text-cyan-200">{i.invite_code}</td>
                        <td className="p-3">
                          {i.used ? (
                            <span className="text-xs text-slate-500">{i.used_by_user_id === "REVOKED" ? "revoked" : "used"}</span>
                          ) : expired ? (
                            <span className="text-xs text-amber-300">expired</span>
                          ) : (
                            <span className="text-xs text-emerald-300">active</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-400">{i.email_allowed || "any"}</td>
                        <td className="p-3 text-xs text-slate-400">{i.created_by_admin}</td>
                        <td className="p-3 text-xs text-slate-500">{i.expires_at?.slice(0, 10) || "—"}</td>
                        <td className="p-3 text-right">
                          {!i.used && !expired && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                              onClick={() => revokeInvite(i.invite_code)}
                              data-testid={`revoke-${i.invite_code}`}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] uppercase tracking-wider text-slate-400">Filter action</Label>
              <Input
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="e.g. export_patient_pdf"
                data-testid="audit-filter"
                className="max-w-xs bg-white/5 border-white/10 text-white font-mono"
              />
            </div>
            <div className="glass rounded-xl overflow-hidden" data-testid="audit-table">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left p-3">Timestamp</th>
                    <th className="text-left p-3">Actor</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">Target</th>
                    <th className="text-left p-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-500 italic">No audit events match.</td></tr>
                  )}
                  {audit.map((e, idx) => (
                    <tr key={idx} className="border-t border-white/5">
                      <td className="p-3 text-xs text-slate-400 whitespace-nowrap">{e.created_at?.slice(0, 19).replace("T", " ")}</td>
                      <td className="p-3 text-xs font-mono text-slate-200">{e.actor_email}</td>
                      <td className="p-3 text-xs text-slate-400">{e.actor_role}{e.actor_is_admin && " · admin"}</td>
                      <td className="p-3 text-xs text-cyan-200 font-mono">{e.action}</td>
                      <td className="p-3 text-xs text-slate-300">{e.target_email || e.target_user_id || "—"}</td>
                      <td className="p-3 text-xs text-slate-500 font-mono max-w-md truncate">{JSON.stringify(e.meta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
