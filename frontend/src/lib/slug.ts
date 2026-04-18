import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function deriveSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

/**
 * Debounced slug availability check against the API.
 * Returns { available, checking }.
 * Skips the check when slug matches `currentSlug` (i.e. the tenant's own slug).
 */
export function useSlugCheck(slug: string, currentSlug?: string) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!slug || slug === currentSlug || !SLUG_RE.test(slug)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tenant/${slug}/check`);
        const data = await res.json();
        setAvailable(data.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => {
      clearTimeout(id);
      setChecking(false);
    };
  }, [slug, currentSlug]);

  return { available, checking };
}
