/**
 * Visitor API client — no authentication required.
 * Visitor routes are public; we skip the auth headers used by the admin api.ts.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function vGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types (mirrors backend schemas/visitor.py) ─────────────────────────────

export interface VisitorTenantConfig {
  slug: string;
  name: string;
  branding: {
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
    welcome_text?: string;
    tone_preset?: "friendly" | "professional" | "enthusiastic";
  };
  enabled_modules: {
    chatbot?: boolean;
    map?: boolean;
    recommendations?: boolean;
    routes?: boolean;
  };
  operating_hours: Record<string, { open: string; close: string } | string>;
  contact_info: {
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    emergency_phone?: string;
  };
}

export interface VisitorStop {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  category: string;
  is_accessible: boolean;
  interest_tags: string[];
  photo_urls: string[];
}

export interface VisitorAmenity {
  id: string;
  name: string;
  type: "restroom" | "food" | "parking" | "emergency" | "gift" | "partner" | "other";
  lat: number;
  lng: number;
  hours: Record<string, unknown>;
  notes: string | null;
}

export interface VisitorRoute {
  id: string;
  name: string;
  description: string | null;
  stop_order: string[];
}

// ── API calls ──────────────────────────────────────────────────────────────

export const visitorApi = {
  config: (slug: string) => vGet<VisitorTenantConfig>(`/api/${slug}/config`),
  stops: (slug: string) => vGet<VisitorStop[]>(`/api/${slug}/stops`),
  amenities: (slug: string) => vGet<VisitorAmenity[]>(`/api/${slug}/amenities`),
  routes: (slug: string) => vGet<VisitorRoute[]>(`/api/${slug}/routes`),
};

export { BASE as VISITOR_BASE };
