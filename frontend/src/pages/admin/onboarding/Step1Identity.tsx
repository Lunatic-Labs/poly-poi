import { useRef, useState } from "react";
import { SLUG_RE, deriveSlug, useSlugCheck } from "../../../lib/slug";

interface BrandingData {
  primary_color: string;
  accent_color: string;
}

interface Props {
  onNext: (data: {
    name: string;
    slug: string;
    branding: BrandingData;
    logoFile?: File;
  }) => void;
  loading?: boolean;
  initialData?: {
    name: string;
    slug: string;
    branding?: { primary_color?: string; accent_color?: string; logo_url?: string };
  };
}

export default function Step1Identity({ onNext, loading, initialData }: Props) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!initialData);
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [logoPreview, setLogoPreview] = useState<string | undefined>(
    initialData?.branding?.logo_url,
  );
  const [primaryColor, setPrimaryColor] = useState(
    initialData?.branding?.primary_color ?? "#2563eb",
  );
  const [accentColor, setAccentColor] = useState(
    initialData?.branding?.accent_color ?? "#7c3aed",
  );
  const [logoDragOver, setLogoDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Skip availability check during onboarding re-entry (slug already claimed)
  const { available: slugAvailable, checking: checkingSlug } = useSlugCheck(
    initialData ? "" : slug,
  );

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(deriveSlug(value));
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(deriveSlug(value));
  }

  function applyLogoFile(file: File) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleLogoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyLogoFile(file);
  }

  function handleLogoDrop(e: React.DragEvent) {
    e.preventDefault();
    setLogoDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) applyLogoFile(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!SLUG_RE.test(slug)) {
      setError("Slug must be 3–50 characters: lowercase letters, digits, or hyphens");
      return;
    }
    if (slugAvailable === false) {
      setError("That URL is already taken — try another");
      return;
    }
    onNext({
      name,
      slug,
      branding: {
        primary_color: primaryColor,
        accent_color: accentColor,
      },
      logoFile,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Site name + slug */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Site name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Grand Canyon National Park"
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Site URL <span className="text-red-500">*</span>
          </label>
          <div className={`flex items-center rounded-lg border px-3 py-2 text-sm ${initialData ? "border-gray-200 bg-gray-50" : "border-gray-300 focus-within:ring-2 focus-within:ring-brand-navy"}`}>
            <span className="shrink-0 text-gray-400">polypoi.com/app/</span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={!!initialData}
              className="min-w-0 flex-1 border-none bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:text-gray-400"
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {initialData ? (
              <span className="text-gray-400">Site URL cannot be changed here.</span>
            ) : checkingSlug ? (
              <span className="text-gray-400">Checking availability…</span>
            ) : slugAvailable === true ? (
              <span className="text-brand-jade">Available</span>
            ) : slugAvailable === false ? (
              <span className="text-red-600">Already taken</span>
            ) : (
              <span className="text-gray-400">Lowercase letters, digits, and hyphens only</span>
            )}
          </div>
        </div>
      </div>

      {/* Logo + Colors */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Logo upload */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Logo</label>
          <div
            onClick={() => logoRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
            onDragLeave={() => setLogoDragOver(false)}
            onDrop={handleLogoDrop}
            className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              logoDragOver ? "border-brand-navy bg-brand-sky/20" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-20 w-20 rounded-lg object-contain"
              />
            ) : (
              <>
                <svg
                  className="mb-1 h-8 w-8 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <p className="text-xs text-gray-500">Drop logo or click to upload</p>
              </>
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoInput}
          />
        </div>

        {/* Colors */}
        <div className="space-y-3">
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
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-navy py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
      >
        {loading ? "Setting up…" : "Next: Upload content →"}
      </button>
    </form>
  );
}
