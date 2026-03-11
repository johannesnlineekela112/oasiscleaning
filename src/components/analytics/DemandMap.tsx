/**
 * DemandMap.tsx
 *
 * "Demand Map" analytics tab — service demand heatmap using Mapbox GL.
 * Reuses the existing MAPBOX_TOKEN and custom map style already in MapPicker.
 *
 * Features:
 *  - Heat layer: intensity proportional to booking density
 *  - Cluster layer: circle clusters that expand on click
 *  - Individual markers on high zoom
 *  - Filter by service type (dropdown)
 *  - Filter by time range (7 / 30 / 90 / all days)
 *  - Status badge: # bookings on map vs total
 *  - Graceful empty state when no geolocated data exists
 */

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin, Filter, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { fetchHeatmapData, type HeatmapPoint } from "@/lib/analyticsService";

// ─── Config (shared with MapPicker) ──────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const MAP_STYLE    = "mapbox://styles/winny112/cmm25o08p000l01qy1m0z50hu";
const WINDHOEK_LNG = 17.0832;
const WINDHOEK_LAT = -22.5597;

const TIME_RANGES = [
  { label: "Last 7 days",  days: 7   },
  { label: "Last 30 days", days: 30  },
  { label: "Last 90 days", days: 90  },
  { label: "All time",     days: 0   },
];

const STATUS_COLOR: Record<string, string> = {
  completed:      "#22c55e",
  in_progress:    "#3b82f6",
  confirmed:      "#6366f1",
  pending:        "#f59e0b",
  cancelled:      "#ef4444",
  late_cancelled: "#f97316",
};

function toGeoJSON(points: HeatmapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map(p => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: {
        id:      p.id,
        service: p.primary_service,
        status:  p.status,
        value:   p.service_value,
        date:    p.booking_date,
        area:    p.area_name ?? "",
        color:   STATUS_COLOR[p.status] ?? "#94a3b8",
      },
    })),
  };
}

export function DemandMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);

  const [allData,    setAllData]    = useState<HeatmapPoint[]>([]);
  const [services,   setServices]   = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState(30);
  const [loading,    setLoading]    = useState(true);
  const [mapReady,   setMapReady]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [mapLoaded,  setMapLoaded]  = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchHeatmapData(
        serviceFilter !== "all" ? serviceFilter : undefined,
        daysFilter > 0 ? daysFilter : undefined,
      );
      setAllData(data);
      // Derive unique service types
      const svcs = Array.from(new Set(data.map(d => d.primary_service))).filter(Boolean).sort();
      setServices(svcs);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load heatmap data");
    }
    setLoading(false);
  }, [serviceFilter, daysFilter]);

  useEffect(() => { load(); }, [load]);

  // ─── Initialise map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style:     MAP_STYLE,
      center:    [WINDHOEK_LNG, WINDHOEK_LAT],
      zoom:      11,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // ── Source (will be updated on data change) ────────────────────────────
      map.addSource("bookings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // ── Heatmap layer ──────────────────────────────────────────────────────
      map.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "bookings",
        maxzoom: 14,
        paint: {
          "heatmap-weight":     ["interpolate", ["linear"], ["get", "value"], 0, 0, 500, 1],
          "heatmap-intensity":  ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            1,   "rgb(178,24,43)",
          ],
          "heatmap-radius":    ["interpolate", ["linear"], ["zoom"], 0, 2, 14, 30],
          "heatmap-opacity":   ["interpolate", ["linear"], ["zoom"], 7, 0.85, 14, 0.3],
        },
      });

      // ── Cluster circles ────────────────────────────────────────────────────
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "bookings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color":  ["step", ["get", "point_count"], "#f59e0b", 5, "#ef4444", 15, "#7c3aed"],
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 15, 32],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.6)",
        },
      });

      // ── Cluster count labels ───────────────────────────────────────────────
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "bookings",
        filter: ["has", "point_count"],
        layout: {
          "text-field":      ["get", "point_count_abbreviated"],
          "text-font":       ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size":       12,
        },
        paint: { "text-color": "#ffffff" },
      });

      // ── Individual points (visible at high zoom) ───────────────────────────
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "bookings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color":        ["get", "color"],
          "circle-radius":       7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.9)",
          "circle-opacity":      0.9,
        },
      });

      // ── Cluster click: zoom in ─────────────────────────────────────────────
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        (map.getSource("bookings") as mapboxgl.GeoJSONSource)
          .getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coords, zoom: zoom ?? 12 });
          });
      });

      // ── Point popup ────────────────────────────────────────────────────────
      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const { service, status, value, date, area } = f.properties ?? {};
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true, maxWidth: "220px" })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui;font-size:12px;line-height:1.5;padding:2px 0">
              <strong style="font-size:13px">${service ?? "Service"}</strong><br/>
              <span style="color:#64748b">${date ?? ""}</span><br/>
              <span style="background:${STATUS_COLOR[status] ?? "#94a3b8"};color:#fff;padding:1px 6px;border-radius:999px;font-size:11px">${status ?? ""}</span><br/>
              ${value ? `<strong>N$ ${Number(value).toLocaleString()}</strong><br/>` : ""}
              ${area ? `<span style="color:#64748b">${area}</span>` : ""}
            </div>
          `)
          .addTo(map);
      });

      // ── Cursor styles ──────────────────────────────────────────────────────
      map.on("mouseenter", "clusters",          () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "clusters",          () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "unclustered-point", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "unclustered-point", () => { map.getCanvas().style.cursor = ""; });

      setMapLoaded(true);
    });

    mapRef.current = map;
    setMapReady(true);

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ─── Update map source when data changes ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const src = mapRef.current.getSource("bookings") as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(toGeoJSON(allData));
  }, [allData, mapLoaded]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const geoCount   = allData.length;
  const completedCount = allData.filter(p => p.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-sm text-foreground">Demand Map</h3>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : geoCount === 0
              ? "No geolocated bookings in this period"
              : `${geoCount} booking${geoCount !== 1 ? "s" : ""} on map · ${completedCount} completed`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Service filter */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            >
              <option value="all">All Services</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Time range filter */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {TIME_RANGES.map(r => (
              <button
                key={r.days}
                onClick={() => setDaysFilter(r.days)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition
                  ${daysFilter === r.days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-xl text-xs text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden shadow-card" style={{ height: 480 }}>
        {/* Spinner overlay while loading data (map already visible) */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full shadow-lg text-xs font-medium text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading bookings…
            </div>
          </div>
        )}

        {/* Empty-state overlay */}
        {!loading && geoCount === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="bg-card/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg text-center">
              <MapPin className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">No geolocated bookings</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bookings without coordinates won't appear on the map.<br />
                Coordinates are saved when the customer uses the address picker.
              </p>
            </div>
          </div>
        )}

        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* Legend */}
      <div className="bg-card rounded-xl shadow-card p-3">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Heatmap legend */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Heat Intensity</p>
            <div className="flex items-center gap-1">
              {["rgba(33,102,172,0.6)","rgb(103,169,207)","rgb(253,219,199)","rgb(239,138,98)","rgb(178,24,43)"].map((c, i) => (
                <div key={i} className="w-6 h-3 rounded-sm" style={{ background: c }} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">Low → High</span>
            </div>
          </div>

          {/* Cluster legend */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Clusters</p>
            <div className="flex items-center gap-2">
              {[{ c: "#f59e0b", l: "1–4" }, { c: "#ef4444", l: "5–14" }, { c: "#7c3aed", l: "15+" }].map(cl => (
                <span key={cl.l} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: cl.c }} />
                  {cl.l}
                </span>
              ))}
            </div>
          </div>

          {/* Status legend */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Booking Status</p>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(STATUS_COLOR).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} />
                  {s.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Coverage tip */}
        <div className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>Only bookings where the customer used the address picker have coordinates. Bookings entered manually without a pin won't appear.</span>
        </div>
      </div>

      {/* Booking table preview */}
      {geoCount > 0 && (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-semibold text-sm">Geolocated Bookings</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  {["Date", "Service", "Area", "Status", "Value"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allData.slice(0, 20).map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition">
                    <td className="px-3 py-2 text-muted-foreground">{p.booking_date}</td>
                    <td className="px-3 py-2 font-medium">{p.primary_service}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.area_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ background: STATUS_COLOR[p.status] ?? "#94a3b8" }}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">N${Math.round(p.service_value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allData.length > 20 && (
              <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                Showing 20 of {allData.length} geolocated bookings
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
