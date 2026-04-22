import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface DashboardHomeProps {
  tenant: { name: string; slug: string };
}

export default function DashboardHome({ tenant }: DashboardHomeProps) {
  const [stopsCount, setStopsCount] = useState<number | null>(null);
  const [docsTotal, setDocsTotal] = useState<number | null>(null);
  const [docsReady, setDocsReady] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ id: string }[]>("/api/admin/stops")
      .then((s) => setStopsCount(s.length))
      .catch(() => setStopsCount(0));
    api
      .get<{ id: string; status: string }[]>("/api/admin/documents")
      .then((d) => {
        setDocsTotal(d.length);
        setDocsReady(d.filter((doc) => doc.status === "ready").length);
      })
      .catch(() => {
        setDocsTotal(0);
        setDocsReady(0);
      });
  }, []);

  const docsSubtext =
    docsTotal !== null && docsReady !== null
      ? docsTotal === 0
        ? "none uploaded"
        : docsReady === docsTotal
          ? "all indexed"
          : `${docsReady} of ${docsTotal} indexed`
      : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-navy">Dashboard</h1>
        <p className="mt-1 text-sm text-brand-jade">{tenant.name}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="TOUR STOPS" value={stopsCount} subtext={null} />
        <StatCard label="DOCUMENTS" value={docsTotal} subtext={docsSubtext} />
        <StatCard label="VISITORS (30D)" value={null} subtext="analytics coming soon" placeholder />
      </div>

      {/* Quick actions */}
      <div className="w-96 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-brand-navy">Quick actions</h2>
        <div className="flex flex-col gap-2">
          <a
            href={`/app/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-lg border border-brand-navy/40 px-4 py-2.5 text-sm text-brand-navy hover:bg-brand-sky/20"
          >
            Preview visitor app
          </a>
          <a
            href={`${BASE}/api/tenant/${tenant.slug}/qr`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-lg border border-brand-navy/40 px-4 py-2.5 text-sm text-brand-navy hover:bg-brand-sky/20"
          >
            Download QR code
          </a>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | null;
  subtext: string | null;
  placeholder?: boolean;
}

function StatCard({ label, value, subtext, placeholder }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-navy">{label}</p>
      {placeholder || value === null ? (
        <p className="text-4xl font-bold text-brand-navy/30">—</p>
      ) : (
        <p className="text-4xl font-bold text-brand-navy">{value}</p>
      )}
      {subtext && (
        <p className={`mt-1 text-xs ${placeholder ? "text-brand-jade/60" : "text-brand-jade"}`}>
          {subtext}
        </p>
      )}
    </div>
  );
}
