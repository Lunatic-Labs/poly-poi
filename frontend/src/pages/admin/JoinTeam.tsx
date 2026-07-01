import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";

// A code stashed here before sign-in survives the trip through Login → Onboarding,
// which reads it and sends the now-authenticated user back to this page.
const PENDING_KEY = "polypoi_pending_invite";

interface AcceptResponse {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  role: string;
}

export default function JoinTeam() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<AcceptResponse | null>(null);

  // Prefill from the invite link, falling back to a code stashed before sign-in.
  useEffect(() => {
    const fromQuery = params.get("code");
    if (fromQuery) {
      setCode(fromQuery);
      localStorage.setItem(PENDING_KEY, fromQuery);
    } else {
      const stored = localStorage.getItem(PENDING_KEY);
      if (stored) setCode(stored);
    }
  }, [params]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.post<AcceptResponse>("/api/admin/team/accept", {
        code: code.trim(),
      });
      localStorage.removeItem(PENDING_KEY);
      setJoined(res);
      setTimeout(() => navigate("/admin/dashboard"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the team");
    } finally {
      setPending(false);
    }
  }

  const card =
    "w-full max-w-sm rounded-2xl bg-white p-8 shadow";
  const wrap =
    "flex min-h-screen items-center justify-center bg-brand-cream px-4";

  if (loading) {
    return (
      <div className={wrap}>
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className={wrap}>
        <div className={`${card} text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-sky/40 text-2xl">
            🎉
          </div>
          <h1 className="mb-2 text-xl font-bold text-brand-navy">You're in</h1>
          <p className="text-sm text-gray-500">
            You've joined <span className="font-medium">{joined.tenant_name}</span> as{" "}
            {joined.role}. Taking you to the dashboard…
          </p>
        </div>
      </div>
    );
  }

  // Signed out: keep the code and send them to create an account or sign in first.
  if (!session) {
    return (
      <div className={wrap}>
        <div className={`${card} text-center`}>
          <h1 className="mb-2 text-xl font-bold text-brand-navy">Join a site</h1>
          <p className="mb-6 text-sm text-gray-500">
            You've been invited to help manage a site on Low-Key Landmarks. Sign in or
            create an account, then come back to this page to finish joining.
          </p>
          <Link
            to="/admin/login"
            className="inline-block w-full rounded-lg bg-brand-navy py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
          >
            Sign in or create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div className={card}>
        <h1 className="mb-1 text-xl font-bold text-brand-navy">Join a site</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your invite code to join the team as an admin.
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
              Invite code
            </label>
            <input
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="w-full rounded-lg bg-brand-navy py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {pending ? "Joining…" : "Join site"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Setting up your own site instead?{" "}
          <Link
            to="/admin/onboarding"
            onClick={() => localStorage.removeItem(PENDING_KEY)}
            className="text-brand-navy hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
