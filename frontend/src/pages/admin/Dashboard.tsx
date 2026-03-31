import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import AmenitiesTab from "./content/AmenitiesTab";
import DocumentsTab from "./content/DocumentsTab";
import StopsTab from "./content/StopsTab";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, string>;
  enabled_modules: Record<string, boolean>;
}

type Tab = "stops" | "documents" | "amenities";

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("stops");

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

  const TABS: { id: Tab; label: string }[] = [
    { id: "stops", label: "Tour stops" },
    { id: "documents", label: "Documents" },
    { id: "amenities", label: "Amenities" },
  ];

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
          <div className="flex items-center gap-3">
            {tenant && (
              <a
                href={`/api/tenant/${tenant.slug}/qr`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                QR code
              </a>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "stops" && <StopsTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "amenities" && <AmenitiesTab />}
      </main>
    </div>
  );
}
