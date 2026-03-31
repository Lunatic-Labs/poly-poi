import { useState } from "react";

interface Props {
  onNext: (data: { name: string; slug: string; contact_info: Record<string, string> }) => void;
}

export default function Step1Identity({ onNext }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function deriveSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(deriveSlug(value));
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(deriveSlug(value));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
      setError("Slug must be 3–50 characters: lowercase letters, digits, or hyphens");
      return;
    }
    onNext({ name, slug, contact_info: { email, phone } });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Organization name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Grand Canyon National Park"
          maxLength={100}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Site URL <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500">
          <span className="text-gray-400">polypoi.com/app/</span>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="flex-1 border-none bg-transparent focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">Lowercase letters, digits, and hyphens only. Cannot be changed later.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contact email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contact phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 555-5555"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Next: Branding →
      </button>
    </form>
  );
}
