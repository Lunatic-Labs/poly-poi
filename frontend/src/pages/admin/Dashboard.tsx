import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, string>;
  enabled_modules: Record<string, boolean>;
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Tenant>("/api/admin/tenants/me")
      .then((t) => setTenant(t))
      .catch((err: Error) => {
        if (err.message === "Unauthorized" || err.message === "Token expired") {
          signOut().then(() => navigate("/admin/login"));
        } else {
          navigate("/admin/onboarding");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate, signOut]);

  async function handleSignOut() {
    await signOut();
    navigate("/admin/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{tenant?.name ?? "PolyPOI"}</h1>
            {tenant && (
              <p className="text-xs text-gray-400">polypoi.com/app/{tenant.slug}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <DashboardCard title="Tour stops" value="—" sub="Manage in Phase 3" />
          <DashboardCard title="Documents" value="—" sub="Upload content in Phase 3" />
          <DashboardCard title="Visitors (30d)" value="—" sub="Analytics in Phase 5" />
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-400">
          <p className="text-sm">Content management and analytics arrive in Phase 3–5.</p>
          <p className="mt-1 text-xs">For now, verify your QR code works:</p>
          {tenant && (
            <a
              href={`/api/tenant/${tenant.slug}/qr`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-lg border border-blue-200 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
            >
              Download QR code
            </a>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
