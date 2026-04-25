import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VoicePicker from "../../components/VoicePicker";
import {
  visitorApi,
  type VisitorAmenity,
  type VisitorRoute,
  type VisitorStop,
  type VisitorTenantConfig,
  type VisitorVoiceCharacter,
} from "../../lib/visitorApi";
import AmenityLookup from "./AmenityLookup";
import ChatBot from "./ChatBot";
import Recommendations from "./Recommendations";
import VisitorMap from "./VisitorMap";

type Tab = "home" | "guide" | "map" | "recommendations" | "info";
type IntroStep = "splash" | "picker" | "done";

// ── Icon components ────────────────────────────────────────────────────────

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

// ── Bottom nav tab button ──────────────────────────────────────────────────

function NavTab({
  id,
  label,
  activeTab,
  primaryColor,
  onSelect,
  children,
}: {
  id: Tab;
  label: string;
  activeTab: Tab;
  primaryColor: string;
  onSelect: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  // Recommendations isn't a nav tab — it's reached from Home's explore cards,
  // so keep Home highlighted when recommendations is showing.
  const isActive = activeTab === id || (id === "home" && activeTab === "recommendations");
  return (
    <button
      onClick={() => onSelect(id)}
      className="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors"
      style={{ color: isActive ? primaryColor : "#9ca3af" }}
    >
      {children}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// ── Intro: Splash screen ───────────────────────────────────────────────────

function IntroSplash({
  config,
  onGetStarted,
}: {
  config: VisitorTenantConfig;
  onGetStarted: () => void;
}) {
  const primary = config.branding.primary_color ?? "#2563eb";
  const logo = config.branding.logo_url;
  const welcome = config.branding.welcome_text ?? "Your AI tour guide is ready to help you explore";

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end pb-10 px-6"
      style={{
        backgroundColor: primary,
        backgroundImage:
          "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 65%)",
      }}
    >
      {logo && (
        <div className="absolute top-16 left-0 right-0 flex justify-center">
          <img
            src={logo}
            alt={config.name}
            className="h-16 w-16 rounded-2xl object-contain bg-white/20 p-2"
          />
        </div>
      )}

      <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white leading-tight">{config.name}</h1>
          <p className="mt-2 text-white/75 text-base leading-snug">{welcome}</p>
        </div>
        <button
          onClick={onGetStarted}
          className="w-full rounded-2xl bg-white py-4 text-base font-semibold"
          style={{ color: primary }}
        >
          Get started →
        </button>
      </div>
    </div>
  );
}

// ── Intro: Interest picker ─────────────────────────────────────────────────

function InterestPicker({
  stops,
  primaryColor,
  onDone,
}: {
  stops: VisitorStop[];
  primaryColor: string;
  onDone: (tags: string[], destination: "home" | "recommendations") => void;
}) {
  const allTags = [...new Set(stops.flatMap((s) => s.interest_tags))].sort();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-5 py-5 text-white" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">What interests you?</h2>
            <p className="mt-0.5 text-sm text-white/75">We'll personalize your visit</p>
          </div>
          <button
            onClick={() => onDone([], "home")}
            className="text-sm font-medium text-white/80 pt-0.5"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-wrap gap-3">
          {allTags.map((tag) => {
            const active = selected.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className="rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { borderColor: primaryColor, color: primaryColor }
                    : { borderColor: "#d1d5db", color: "#374151" }
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            {selected.size} selected — tap to toggle
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 pb-10 pt-4 border-t border-gray-100">
        <button
          onClick={() =>
            onDone([...selected], selected.size > 0 ? "recommendations" : "home")
          }
          className="w-full rounded-2xl py-4 text-base font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {selected.size > 0 ? "See my recommendations →" : "Explore →"}
        </button>
      </div>
    </div>
  );
}

// ── Home view ──────────────────────────────────────────────────────────────

interface HomeViewProps {
  config: VisitorTenantConfig;
  stops: VisitorStop[];
  amenities: VisitorAmenity[];
  onNavigate: (tab: Tab) => void;
}

function HomeView({ config, stops, amenities, onNavigate }: HomeViewProps) {
  const modules = config.enabled_modules;

  type ExploreItem = { tab: Tab; title: string; subtitle: string; icon: React.ReactNode };
  const exploreItems: ExploreItem[] = [];
  if (modules.chatbot) {
    exploreItems.push({
      tab: "guide",
      title: "Ask your guide",
      subtitle: "Chat with your AI guide",
      icon: <IconChat className="h-6 w-6 text-gray-500" />,
    });
  }
  if (modules.map) {
    exploreItems.push({
      tab: "map",
      title: "Interactive map",
      subtitle: "Stops, trails, amenities",
      icon: <IconMap className="h-6 w-6 text-gray-500" />,
    });
  }
  if (modules.recommendations && stops.length > 0) {
    const tags = [...new Set(stops.flatMap((s) => s.interest_tags))].slice(0, 3);
    exploreItems.push({
      tab: "recommendations",
      title: "Recommended for you",
      subtitle: tags.length > 0 ? tags.join(" · ") : "Explore top stops",
      icon: <IconSparkle className="h-6 w-6 text-gray-500" />,
    });
  }

  const restroom = amenities.find((a) => a.type === "restroom");
  const emergency = amenities.find((a) => a.type === "emergency");

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {exploreItems.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Explore
          </p>
          <div className="flex flex-col gap-2">
            {exploreItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.subtitle}</p>
                </div>
                <IconChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      {(restroom || emergency) && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Quick Info
          </p>
          <div className="flex flex-col gap-2">
            {restroom && (
              <button
                onClick={() => onNavigate("info")}
                className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70">
                  <IconUser className="h-6 w-6 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">Restrooms</p>
                  <p className="text-sm text-gray-600 truncate">
                    {restroom.name}{restroom.notes ? ` · ${restroom.notes}` : ""}
                  </p>
                </div>
                <IconChevronRight className="h-5 w-5 shrink-0 text-amber-300" />
              </button>
            )}
            {emergency && (
              <button
                onClick={() => onNavigate("info")}
                className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70">
                  <IconAlert className="h-6 w-6 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">Emergency</p>
                  <p className="text-sm text-gray-600 truncate">
                    {emergency.name}{emergency.notes ? ` · ${emergency.notes}` : ""}
                  </p>
                </div>
                <IconChevronRight className="h-5 w-5 shrink-0 text-red-300" />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function VisitorApp() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<VisitorTenantConfig | null>(null);
  const [stops, setStops] = useState<VisitorStop[]>([]);
  const [amenities, setAmenities] = useState<VisitorAmenity[]>([]);
  const [routes, setRoutes] = useState<VisitorRoute[]>([]);
  const [voices, setVoices] = useState<VisitorVoiceCharacter[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [error, setError] = useState<string | null>(null);
  const INTRO_KEY = `polypoi_intro_done_${slug}`;
  const [introStep, setIntroStep] = useState<IntroStep>(
    () => (localStorage.getItem(`polypoi_intro_done_${slug}`) === "true" ? "done" : "splash"),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      visitorApi.config(slug),
      visitorApi.stops(slug),
      visitorApi.amenities(slug),
      visitorApi.routes(slug),
    ])
      .then(([cfg, stps, amens, rts]) => {
        setConfig(cfg);
        setStops(stps);
        setAmenities(amens);
        setRoutes(rts);
      })
      .catch(() => setError("Could not load this visitor experience. Please try again."));
  }, [slug]);

  // Fetch voice characters only when voice is enabled.
  useEffect(() => {
    if (!slug || !config?.enabled_modules.voice) return;
    visitorApi
      .voiceCharacters(slug)
      .then((vs) => {
        setVoices(vs);
        // Restore visitor's last pick, or fall back to the tenant's default.
        const stored = localStorage.getItem(`polypoi_voice_${slug}`);
        const restored = stored && vs.some((v) => v.id === stored) ? stored : null;
        const defaultChar = vs.find((v) => v.is_default) ?? vs[0];
        setSelectedVoiceId(restored ?? defaultChar?.id ?? null);
      })
      .catch(() => {
        /* leave voices empty — UI will hide the picker */
      });
  }, [slug, config?.enabled_modules.voice]);

  function handleSelectVoice(id: string) {
    setSelectedVoiceId(id);
    if (slug) localStorage.setItem(`polypoi_voice_${slug}`, id);
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  const primaryColor = config.branding.primary_color ?? "#2563eb";
  const logoUrl = config.branding.logo_url;
  const welcomeText = config.branding.welcome_text;
  const modules = config.enabled_modules;

  if (introStep === "splash") {
    return (
      <IntroSplash
        config={config}
        onGetStarted={() => {
          const hasTags = stops.some((s) => s.interest_tags.length > 0);
          if (!hasTags) {
            localStorage.setItem(INTRO_KEY, "true");
            setIntroStep("done");
          } else {
            setIntroStep("picker");
          }
        }}
      />
    );
  }

  if (introStep === "picker") {
    return (
      <InterestPicker
        stops={stops}
        primaryColor={primaryColor}
        onDone={(tags, dest) => {
          localStorage.setItem(INTRO_KEY, "true");
          setSelectedTags(tags);
          setIntroStep("done");
          setActiveTab(dest);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="shrink-0 text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={config.name}
              className="h-10 w-10 rounded-xl object-contain bg-white/20 p-1.5"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">{config.name}</h1>
            {welcomeText && (
              <p className="truncate text-sm text-white/75">{welcomeText}</p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
        {activeTab === "home" && (
          <HomeView
            config={config}
            stops={stops}
            amenities={amenities}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === "guide" && modules.chatbot && (
          <div className="px-4 py-6 flex flex-col gap-3">
            {modules.voice && voices.length > 0 && (
              <VoicePicker
                slug={slug!}
                primaryColor={primaryColor}
                voices={voices}
                selectedId={selectedVoiceId}
                onSelect={handleSelectVoice}
              />
            )}
            <ChatBot
              slug={slug!}
              tenantName={config.name}
              primaryColor={primaryColor}
              voiceEnabled={!!modules.voice}
              voiceCharacterId={selectedVoiceId}
            />
          </div>
        )}
        {activeTab === "map" && modules.map && (
          <div className="px-4 py-4">
            <VisitorMap
              stops={stops}
              amenities={amenities}
              routes={modules.routes !== false ? routes : []}
              primaryColor={primaryColor}
            />
          </div>
        )}
        {activeTab === "recommendations" && (
          <div className="px-4 py-6">
            <Recommendations stops={stops} primaryColor={primaryColor} initialTags={selectedTags} />
          </div>
        )}
        {activeTab === "info" && (
          <div className="px-4 py-6">
            <AmenityLookup amenities={amenities} />
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="shrink-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl">
          <NavTab id="home" label="Home" activeTab={activeTab} primaryColor={primaryColor} onSelect={setActiveTab}>
            <IconHome className="h-6 w-6" />
          </NavTab>
          {modules.chatbot && (
            <NavTab id="guide" label="Guide" activeTab={activeTab} primaryColor={primaryColor} onSelect={setActiveTab}>
              <IconChat className="h-6 w-6" />
            </NavTab>
          )}
          {modules.map && (
            <NavTab id="map" label="Map" activeTab={activeTab} primaryColor={primaryColor} onSelect={setActiveTab}>
              <IconMap className="h-6 w-6" />
            </NavTab>
          )}
          <NavTab id="info" label="Info" activeTab={activeTab} primaryColor={primaryColor} onSelect={setActiveTab}>
            <IconInfo className="h-6 w-6" />
          </NavTab>
        </div>
      </nav>
    </div>
  );
}
