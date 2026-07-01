import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Member {
  id: string;
  email: string | null;
  role: "owner" | "member";
  is_self: boolean;
  created_at: string;
}

interface Invite {
  id: string;
  code: string;
  email: string | null;
  role: string;
  expires_at: string;
  created_at: string;
}

function joinLink(code: string) {
  return `${window.location.origin}/admin/join?code=${encodeURIComponent(code)}`;
}

export default function TeamTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const me = members.find((m) => m.is_self);
  const isOwner = me?.role === "owner";

  async function load() {
    try {
      const [m, inv] = await Promise.all([
        api.get<Member[]>("/api/admin/team/members"),
        api.get<Invite[]>("/api/admin/team/invites"),
      ]);
      setMembers(m);
      setInvites(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateInvite() {
    setCreating(true);
    setError(null);
    try {
      const body = inviteEmail.trim() ? { email: inviteEmail.trim() } : {};
      await api.post<Invite>("/api/admin/team/invites", body);
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      await api.delete(`/api/admin/team/invites/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  async function handleRemove(member: Member) {
    if (
      !window.confirm(
        `Remove ${member.email ?? "this admin"} from the team? They'll lose access to this site.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.delete(`/api/admin/team/members/${member.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function handleCopy(inv: Invite) {
    try {
      await navigator.clipboard.writeText(joinLink(inv.code));
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the link is visible to copy manually.
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-navy">Team</h1>
        <p className="mt-1 text-sm text-brand-jade">
          Invite colleagues to help manage this site
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Members */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-brand-navy">Members</h2>
          <p className="mt-0.5 text-sm text-brand-jade">
            Everyone with admin access to this site
          </p>
          <ul className="mt-5 divide-y divide-gray-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {m.email ?? "Unknown"}
                    {m.is_self && (
                      <span className="ml-2 text-xs font-normal text-gray-400">You</span>
                    )}
                  </p>
                  <p className="text-xs capitalize text-gray-500">{m.role}</p>
                </div>
                {isOwner && !m.is_self && (
                  <button
                    onClick={() => handleRemove(m)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Invites */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-brand-navy">Invite a colleague</h2>
          <p className="mt-0.5 text-sm text-brand-jade">
            Generate a link they open to join this site. Each link works once and
            expires in 7 days.
          </p>
          <div className="mt-5 flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Their email <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
              />
            </div>
            <button
              onClick={handleCreateInvite}
              disabled={creating}
              className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create invite"}
            </button>
          </div>

          {invites.length > 0 && (
            <ul className="mt-6 flex flex-col gap-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-gray-800">
                      {joinLink(inv.code)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {inv.email ? `For ${inv.email} · ` : ""}
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleCopy(inv)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-gray-50"
                    >
                      {copiedId === inv.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
