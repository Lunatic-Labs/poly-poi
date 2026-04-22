import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { SLUG_RE, deriveSlug, useSlugCheck } from "../../../lib/slug";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface Tenant {
  slug: string;
  name: string;
  branding: {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
    welcome_text?: string;
    tone_preset?: string;
    [key: string]: string | undefined;
  };
  enabled_modules: Record<string, boolean>;
}

const MODULES: { key: string; label: string; description: string; alwaysOn?: boolean }[] = [
  {
    key: "chatbot",
    label: "AI Chatbot",
    description: "Visitors ask questions, get answers from your content",
  },
  {
    key: "map",
    label: "Interactive Map",
    description: "Map view with stops, routes, and amenities",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    description: "Personalized stop suggestions based on visitor interests",
  },
  {
    key: "amenity_lookup",
    label: "Amenity Lookup",
    description: "Restrooms, food, emergency info — always on",
    alwaysOn: true,
  },
];

const TONES = [
  {
    key: "professional",
    label: "Professional & Informative",
    description: "Clear, factual, authoritative",
  },
  {
    key: "friendly",
    label: "Friendly & Casual",
    description: "Warm, approachable, conversational",
  },
  {
    key: "enthusiastic",
    label: "Fun & Enthusiastic",
    description: "Energetic, playful, exclamation points",
  },
];

export default function SettingsTab() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [welcomeText, setWelcomeText] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [accentColor, setAccentColor] = useState("#7c3aed");
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [siteName, setSiteName] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Tenant>("/api/admin/tenants/me")
      .then((t) => {
        setTenant(t);
        setSiteName(t.name);
        setSiteSlug(t.slug);
        setOriginalSlug(t.slug);
        setWelcomeText(t.branding.welcome_text ?? "");
        setPrimaryColor(t.branding.primary_color ?? "#2563eb");
        setAccentColor(t.branding.accent_color ?? "#7c3aed");
        setLogoPreview(t.branding.logo_url);
      })
      .catch(() => {});
  }, []);

  const { available: slugAvailable, checking: checkingSlug } = useSlugCheck(siteSlug, originalSlug);

  async function patchTenant(body: Partial<Tenant>) {
    setSaving(true);
    try {
      const updated = await api.patch<Tenant>("/api/admin/tenants/me", body);
      setTenant(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveIdentity() {
    if (!tenant) return;
    setIdentityError(null);

    if (!siteName.trim()) {
      setIdentityError("Site name is required");
      return;
    }
    if (!SLUG_RE.test(siteSlug)) {
      setIdentityError("Slug must be 3–50 characters: lowercase letters, digits, or hyphens");
      return;
    }
    if (siteSlug !== originalSlug && slugAvailable === false) {
      setIdentityError("That URL is already taken — try another");
      return;
    }

    setSaving(true);
    try {
      const body: Partial<Tenant> & { slug?: string } = { name: siteName };
      if (siteSlug !== originalSlug) body.slug = siteSlug;
      const updated = await api.patch<Tenant>("/api/admin/tenants/me", body);
      setTenant(updated);
      setSiteName(updated.name);
      setSiteSlug(updated.slug);
      setOriginalSlug(updated.slug);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;
    setLogoPreview(URL.createObjectURL(file));
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.postForm<{ logo_url: string }>("/api/admin/tenants/me/logo", fd);
      setTenant({ ...tenant, branding: { ...tenant.branding, logo_url: res.logo_url } });
      setLogoPreview(res.logo_url);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveColors() {
    if (!tenant) return;
    const updated = { ...tenant.branding, primary_color: primaryColor, accent_color: accentColor };
    setTenant({ ...tenant, branding: updated });
    await patchTenant({ branding: updated });
  }

  function handleToggle(key: string) {
    if (!tenant) return;
    const updated = { ...tenant.enabled_modules, [key]: !tenant.enabled_modules[key] };
    setTenant({ ...tenant, enabled_modules: updated });
    patchTenant({ enabled_modules: updated });
  }

  function handleTone(key: string) {
    if (!tenant) return;
    const updated = { ...tenant.branding, tone_preset: key };
    setTenant({ ...tenant, branding: updated });
    patchTenant({ branding: updated });
  }

  if (!tenant) {
    return <div className="text-sm text-gray-400">Loading…</div>;
  }

  const qrUrl = `${BASE}/api/tenant/${tenant.slug}/qr`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-navy">Settings</h1>
        <p className="mt-1 text-sm text-brand-jade">Configure your visitor experience</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Site Identity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Site Identity</h2>
            <p className="mt-0.5 text-sm text-brand-jade">Your site name and visitor app URL</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Site name</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Site URL</label>
                <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-brand-navy">
                  <span className="shrink-0 text-gray-400">polypoi.com/app/</span>
                  <input
                    type="text"
                    value={siteSlug}
                    onChange={(e) => setSiteSlug(deriveSlug(e.target.value))}
                    className="min-w-0 flex-1 border-none bg-transparent focus:outline-none"
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {siteSlug === originalSlug ? (
                    <span className="text-gray-400">Current URL</span>
                  ) : checkingSlug ? (
                    <span className="text-gray-400">Checking availability…</span>
                  ) : !SLUG_RE.test(siteSlug) ? (
                    <span className="text-gray-400">Lowercase letters, digits, and hyphens only</span>
                  ) : slugAvailable === true ? (
                    <span className="text-brand-jade">Available</span>
                  ) : slugAvailable === false ? (
                    <span className="text-red-600">Already taken</span>
                  ) : null}
                </div>
              </div>
              {identityError && <p className="text-sm text-red-600">{identityError}</p>}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveIdentity}
                  disabled={saving || (siteSlug !== originalSlug && slugAvailable === false)}
                  className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Visitor Modules */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Visitor Modules</h2>
            <p className="mt-0.5 text-sm text-brand-jade">
              Toggle which features appear in your visitor app
            </p>
            <div className="mt-5 flex flex-col gap-5">
              {MODULES.map((mod) => {
                const enabled = mod.alwaysOn || !!tenant.enabled_modules[mod.key];
                return (
                  <div key={mod.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{mod.label}</p>
                      <p className="text-xs text-gray-500">{mod.description}</p>
                    </div>
                    <Toggle
                      enabled={enabled}
                      disabled={!!mod.alwaysOn}
                      onChange={() => handleToggle(mod.key)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Branding</h2>
            <p className="mt-0.5 text-sm text-brand-jade">Logo and colors shown in your visitor app</p>
            <div className="mt-5 grid grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Logo</p>
                <div
                  onClick={() => logoRef.current?.click()}
                  className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-lg object-contain" />
                  ) : (
                    <p className="text-xs text-gray-400">Click to upload logo</p>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              {/* Colors */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Primary color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Accent color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveColors}
                    disabled={saving}
                    className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    Save colors
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Welcome Message</h2>
            <p className="mt-0.5 text-sm text-brand-jade">
              Shown to visitors when they first open your guide
            </p>
            <textarea
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              rows={4}
              placeholder="Welcome to our guide…"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() =>
                  patchTenant({ branding: { ...tenant.branding, welcome_text: welcomeText } })
                }
                disabled={saving}
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* Guide Tone */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Guide Tone</h2>
            <p className="mt-0.5 text-sm text-brand-jade">Personality of your AI guide</p>
            <div className="mt-4 flex flex-col gap-3">
              {TONES.map((tone) => {
                const active = tenant.branding.tone_preset === tone.key;
                return (
                  <button
                    key={tone.key}
                    onClick={() => handleTone(tone.key)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                      active
                        ? "border-brand-navy bg-brand-sky/20"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        active ? "border-brand-navy" : "border-gray-300"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-brand-navy" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tone.label}</p>
                      <p className="text-xs text-gray-500">{tone.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column — QR Code */}
        <div className="col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-brand-navy">Visitor App QR Code</h2>
            <p className="mt-1 text-xs text-gray-500">
              Print and post at your entrance. Visitors scan to open your guide instantly — no app
              download needed.
            </p>
            <div className="mt-4 flex justify-center rounded-lg bg-gray-50 p-4">
              <img src={qrUrl} alt="Visitor app QR code" className="h-36 w-36" />
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">
              polypoi.com/app/
              <span className="font-medium text-gray-600">{tenant.slug}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
              >
                Download PNG
              </a>
              <button
                onClick={() => window.open(qrUrl)}
                className="flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Print-ready PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
          Saving…
        </div>
      )}
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: () => void;
}

function Toggle({ enabled, disabled, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-brand-jade" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
