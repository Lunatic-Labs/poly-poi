import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Route {
  id: string;
  name: string;
  description: string | null;
  stop_order: string[];
}

interface Stop {
  id: string;
  name: string;
}

interface RouteFormData {
  name: string;
  description: string;
  stop_order: string[];
}

const EMPTY_FORM: RouteFormData = {
  name: "",
  description: "",
  stop_order: [],
};

export default function RoutesTab() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState<RouteFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Route[]>("/api/admin/routes"),
      api.get<Stop[]>("/api/admin/stops"),
    ])
      .then(([rs, sts]) => {
        setRoutes(rs);
        setStops(sts);
      })
      .finally(() => setLoading(false));
  }, []);

  const stopById = new Map(stops.map((s) => [s.id, s]));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(route: Route) {
    setEditing(route);
    setForm({
      name: route.name,
      description: route.description ?? "",
      stop_order: [...route.stop_order],
    });
    setError(null);
    setShowForm(true);
  }

  function moveStop(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= form.stop_order.length) return;
    const next = [...form.stop_order];
    [next[index], next[target]] = [next[target], next[index]];
    setForm({ ...form, stop_order: next });
  }

  function removeStop(index: number) {
    setForm({
      ...form,
      stop_order: form.stop_order.filter((_, i) => i !== index),
    });
  }

  function addStop(stopId: string) {
    if (!stopId || form.stop_order.includes(stopId)) return;
    setForm({ ...form, stop_order: [...form.stop_order, stopId] });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      stop_order: form.stop_order,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.patch<Route>(
          `/api/admin/routes/${editing.id}`,
          payload,
        );
        setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await api.post<Route>("/api/admin/routes", payload);
        setRoutes((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save route");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(route: Route) {
    if (!confirm(`Delete "${route.name}"?`)) return;
    await api.delete(`/api/admin/routes/${route.id}`);
    setRoutes((prev) => prev.filter((r) => r.id !== route.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  const unselectedStops = stops.filter((s) => !form.stop_order.includes(s.id));

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Routes</h1>
          {routes.length > 0 && (
            <p className="mt-1 text-sm text-brand-jade">
              {routes.length} route{routes.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={openCreate}
          disabled={stops.length === 0}
          title={stops.length === 0 ? "Add tour stops first" : undefined}
          className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add route
        </button>
      </div>

      {/* List */}
      {routes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          {stops.length === 0
            ? "Add tour stops first."
            : "Group stops into a guided path to get started."}
        </div>
      ) : (
        <div className="space-y-2">
          {routes.map((route) => (
            <div
              key={route.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-navy">{route.name}</p>
                <p className="truncate text-xs text-brand-jade">
                  {route.stop_order.length} stop{route.stop_order.length !== 1 ? "s" : ""}
                  {route.description ? ` · ${route.description}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(route)}
                  className="text-xs text-brand-navy hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(route)}
                  className="text-xs text-brand-blush hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="overflow-y-auto p-6">
              <h3 className="mb-4 text-base font-bold text-brand-navy">
                {editing ? "Edit route" : "Add route"}
              </h3>
              <form onSubmit={handleSave} className="space-y-3">
                <input
                  required
                  placeholder="Name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />

                {/* Stop order */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stops in route
                  </p>
                  {form.stop_order.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
                      No stops in this route yet.
                    </p>
                  ) : (
                    <ol className="space-y-1.5">
                      {form.stop_order.map((stopId, i) => {
                        const stop = stopById.get(stopId);
                        const isFirst = i === 0;
                        const isLast = i === form.stop_order.length - 1;
                        return (
                          <li
                            key={stopId}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                          >
                            <span className="w-5 shrink-0 text-xs font-medium text-gray-400">
                              {i + 1}.
                            </span>
                            <span className="flex-1 truncate text-sm text-brand-navy">
                              {stop?.name ?? <em className="text-gray-400">(deleted stop)</em>}
                            </span>
                            <button
                              type="button"
                              onClick={() => moveStop(i, -1)}
                              disabled={isFirst}
                              className="text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStop(i, 1)}
                              disabled={isLast}
                              className="text-sm text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStop(i)}
                              className="text-sm text-gray-400 hover:text-brand-blush"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {unselectedStops.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        addStop(e.target.value);
                        e.target.value = "";
                      }}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    >
                      <option value="">Add stop…</option>
                      {unselectedStops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-brand-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
