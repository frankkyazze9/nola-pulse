"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Ping {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  source: string;
  label: string | null;
  note: string | null;
  accuracyM: number | null;
}

interface Props {
  caseId: string;
  initialPings: Ping[];
}

export default function CaseMap({ caseId, initialPings }: Props) {
  const [pings, setPings] = useState<Ping[]>(initialPings);
  const [showForm, setShowForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerLayerRef = useRef<unknown>(null);

  // Lazy-init Leaflet on the client (SSR would crash — leaflet touches window).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Default marker icons from the package don't resolve properly under
      // bundlers. Re-point to the CDN copies.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DefaultIconProto = (L.Icon.Default.prototype as any);
      delete DefaultIconProto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const center = pings.length > 0
        ? [pings[0].latitude, pings[0].longitude] as [number, number]
        : [29.9511, -90.0715] as [number, number]; // New Orleans default

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (L as any).map(containerRef.current).setView(center, 12);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      mapRef.current = map;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markerLayerRef.current = (L as any).layerGroup().addTo(map);
      renderPings(L, map, markerLayerRef.current, pings);
    })();
    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapRef.current) (mapRef.current as any).remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only mount once

  // Re-render pings when the list changes
  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      renderPings(L, mapRef.current, markerLayerRef.current, pings);
    })();
  }, [pings]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      latitude: parseFloat(String(data.get("latitude"))),
      longitude: parseFloat(String(data.get("longitude"))),
      timestamp:
        String(data.get("timestamp")) || new Date().toISOString(),
      source: (String(data.get("source")) || "manual") as Ping["source"],
      label: String(data.get("label") ?? "") || undefined,
      note: String(data.get("note") ?? "") || undefined,
    };
    const res = await fetch(`/api/cases/${caseId}/pings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "failed" }));
      alert(`Failed: ${err.error ?? "unknown"}`);
      return;
    }
    const ping = (await res.json()) as Ping;
    setPings((prev) => [...prev, ping].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    form.reset();
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted">
          {pings.length} point{pings.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover"
        >
          {showForm ? "Cancel" : "+ Add point"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-3 p-3 border border-card-border rounded bg-card-bg/50 space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              name="latitude"
              type="number"
              step="any"
              placeholder="Latitude (29.95...)"
              required
              className="px-2 py-1 text-sm border border-card-border rounded bg-background"
            />
            <input
              name="longitude"
              type="number"
              step="any"
              placeholder="Longitude (-90.07...)"
              required
              className="px-2 py-1 text-sm border border-card-border rounded bg-background"
            />
          </div>
          <input
            name="timestamp"
            type="datetime-local"
            className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background"
          />
          <input
            name="label"
            type="text"
            placeholder="Label (e.g. 'Transfer station')"
            className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background"
          />
          <input
            name="note"
            type="text"
            placeholder="Note (optional)"
            className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background"
          />
          <select
            name="source"
            defaultValue="manual"
            className="w-full px-2 py-1 text-sm border border-card-border rounded bg-background"
          >
            <option value="manual">Manual</option>
            <option value="airtag">AirTag</option>
            <option value="apple_findmy">Apple Find My</option>
            <option value="gpx">GPX import</option>
            <option value="other">Other</option>
          </select>
          <button
            type="submit"
            className="w-full px-3 py-1.5 text-sm font-medium bg-accent text-white rounded hover:bg-accent-hover"
          >
            Save point
          </button>
        </form>
      )}

      <div
        ref={containerRef}
        className="w-full h-80 rounded border border-card-border overflow-hidden bg-card-bg"
      />

      {pings.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted">
            Point list ({pings.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {pings.map((p, i) => (
              <li key={p.id} className="text-muted">
                <span className="font-mono">{i + 1}.</span>{" "}
                {new Date(p.timestamp).toLocaleString()} ·{" "}
                <span className="font-mono">
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </span>
                {p.label && <span className="ml-2 text-accent">{p.label}</span>}
                {p.note && <span className="ml-2">— {p.note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderPings(L: any, map: any, layer: any, pings: Ping[]): void {
  layer.clearLayers();
  if (pings.length === 0) return;

  const points: Array<[number, number]> = pings.map((p) => [p.latitude, p.longitude]);

  pings.forEach((p, i) => {
    const marker = L.marker([p.latitude, p.longitude]);
    const dt = new Date(p.timestamp).toLocaleString();
    marker.bindPopup(
      `<div style="min-width:150px"><strong>#${i + 1}${p.label ? ` — ${escapeHtml(p.label)}` : ""}</strong><br/>${dt}<br/><span style="font-family:monospace">${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}</span>${p.note ? `<br/>${escapeHtml(p.note)}` : ""}</div>`
    );
    marker.addTo(layer);
  });

  if (pings.length >= 2) {
    L.polyline(points, { color: "#0000ee", weight: 2, opacity: 0.6 }).addTo(layer);
  }

  if (pings.length === 1) {
    map.setView(points[0], 13);
  } else {
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
