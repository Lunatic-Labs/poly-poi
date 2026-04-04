import { useState } from "react";
import type { VisitorStop } from "../../lib/visitorApi";

interface Props {
  stops: VisitorStop[];
  primaryColor: string;
  initialTags?: string[];
}

export default function Recommendations({ stops, primaryColor, initialTags = [] }: Props) {
  const allTags = [...new Set(stops.flatMap((s) => s.interest_tags))].sort();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(initialTags));

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) { next.delete(tag); } else { next.add(tag); }
      return next;
    });
  }

  const filtered =
    selectedTags.size === 0
      ? stops
      : stops.filter((s) => s.interest_tags.some((t) => selectedTags.has(t)));

  if (stops.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 mt-8">
        No stops have been added yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Filter by interest
          </p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                style={
                  selectedTags.has(tag)
                    ? { backgroundColor: primaryColor, borderColor: primaryColor, color: "#fff" }
                    : { borderColor: "#d1d5db", color: "#374151" }
                }
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            No stops match the selected interests.
          </p>
        ) : (
          filtered.map((stop) => (
            <div
              key={stop.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex gap-3"
            >
              {stop.photo_urls[0] && (
                <img
                  src={stop.photo_urls[0]}
                  alt={stop.name}
                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {stop.name}
                  </span>
                  <span className="text-xs text-gray-400 capitalize flex-shrink-0">
                    {stop.category}
                  </span>
                </div>
                {stop.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 leading-snug">
                    {stop.description}
                  </p>
                )}
                {stop.interest_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {stop.interest_tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
