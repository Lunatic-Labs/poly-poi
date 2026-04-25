import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import AmenitiesTab from "./content/AmenitiesTab";
import DashboardHome from "./content/DashboardHome";
import DocumentsTab from "./content/DocumentsTab";
import RoutesTab from "./content/RoutesTab";
import SettingsTab from "./content/SettingsTab";
import StopsTab from "./content/StopsTab";
import VoicesTab from "./content/VoicesTab";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, string>;
  enabled_modules: Record<string, boolean>;
}

type ActiveView =
  | "home"
  | "stops"
  | "routes"
  | "documents"
  | "amenities"
  | "voices"
  | "settings";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("home");

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
    <div className="flex h-screen overflow-hidden bg-brand-cream">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col bg-brand-navy">
        {/* Logo + URL */}
        <div className="px-5 pb-3 pt-6">
          <img
            src="/admin-site-logo.png"
            alt="Low-Key Landmarks"
            className="mx-auto h-20 w-36 object-contain"
          />
          {tenant && (
            <p className="mt-3 truncate text-center text-[11px] text-white/60">
              polypoi.com/app/{tenant.slug}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Manage
          </p>
          <NavItem
            icon={<IconDashboard />}
            label="Dashboard"
            active={activeView === "home"}
            onClick={() => setActiveView("home")}
          />
          <NavItem
            icon={<IconDocuments />}
            label="Documents"
            active={activeView === "documents"}
            onClick={() => setActiveView("documents")}
          />
          <NavItem
            icon={<IconStops />}
            label="Tour Stops"
            active={activeView === "stops"}
            onClick={() => setActiveView("stops")}
          />
          <NavItem
            icon={<IconRoutes />}
            label="Routes"
            active={activeView === "routes"}
            onClick={() => setActiveView("routes")}
          />
          <NavItem
            icon={<IconAmenities />}
            label="Amenities"
            active={activeView === "amenities"}
            onClick={() => setActiveView("amenities")}
          />
          <NavItem
            icon={<IconVoices />}
            label="Voices"
            active={activeView === "voices"}
            onClick={() => setActiveView("voices")}
          />

          <p className="mb-1.5 mt-5 px-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Configure
          </p>
          <NavItem
            icon={<IconSettings />}
            label="Settings"
            active={activeView === "settings"}
            onClick={() => setActiveView("settings")}
          />
          {tenant && (
            <a
              href={`${BASE}/api/tenant/${tenant.slug}/qr`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              <IconQr />
              QR Code
            </a>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-3">
          <button
            onClick={handleSignOut}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-white hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {activeView === "home" && tenant && <DashboardHome tenant={tenant} />}
          {activeView === "stops" && <StopsTab />}
          {activeView === "routes" && <RoutesTab />}
          {activeView === "documents" && <DocumentsTab />}
          {activeView === "amenities" && <AmenitiesTab />}
          {activeView === "voices" && <VoicesTab />}
          {activeView === "settings" && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-brand-sky font-medium text-brand-navy"
          : "text-white hover:bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconDashboard() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function IconDocuments() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function IconStops() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconRoutes() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 114 0 2 2 0 01-4 0zm0 0v9m0 0a4 4 0 004 4h6m0 0a2 2 0 104 0 2 2 0 00-4 0z"
      />
    </svg>
  );
}

function IconAmenities() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

function IconVoices() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-8-15a4 4 0 118 0v6a4 4 0 11-8 0V7z"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconQr() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
      />
    </svg>
  );
}
