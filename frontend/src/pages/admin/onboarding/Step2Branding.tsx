import { useRef, useState } from "react";
import { api } from "../../../lib/api";

interface Props {
  onNext: (branding: {
    primary_color: string;
    accent_color: string;
    welcome_text: string;
    tone_preset: string;
    logo_url?: string;
  }) => void;
}

const TONE_PRESETS = [
  { value: "friendly", label: "Friendly", description: "Warm and conversational" },
  { value: "professional", label: "Professional", description: "Formal and informative" },
  { value: "enthusiastic", label: "Enthusiastic", description: "Energetic and engaging" },
];

export default function Step2Branding({ onNext }: Props) {
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [accentColor, setAccentColor] = useState("#7c3aed");
  const [welcomeText, setWelcomeText] = useState("");
  const [tonePreset, setTonePreset] = useState("friendly");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { logo_url } = await api.postForm<{ logo_url: string }>("/api/admin/tenants/me/logo", formData);
      setLogoUrl(logo_url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({ primary_color: primaryColor, accent_color: accentColor, welcome_text: welcomeText, tone_preset: tonePreset, logo_url: logoUrl });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Logo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain border border-gray-200" />
          ) : (
            <div className="h-14 w-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xs">
              No logo
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Primary color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-gray-300" />
            <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Accent color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-gray-300" />
            <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">AI tone</label>
        <div className="grid grid-cols-3 gap-2">
          {TONE_PRESETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTonePreset(t.value)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                tonePreset === t.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">{t.label}</div>
              <div className="text-xs text-gray-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Welcome text */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Welcome message</label>
        <textarea
          value={welcomeText}
          onChange={(e) => setWelcomeText(e.target.value)}
          placeholder="Welcome! I'm your AI guide. Ask me anything about this location."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Next: Tour Stops →
      </button>
    </form>
  );
}
