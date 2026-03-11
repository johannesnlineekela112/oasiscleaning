import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Search, MapPin, Navigation, X, Loader2, CheckCircle,
  AlertTriangle, LocateFixed,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Mapbox config ────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const MAP_STYLE    = "mapbox://styles/winny112/cmm25o08p000l01qy1m0z50hu";
const MARKER_COLOR = "#FF8C00";

// Windhoek city centre — primary proximity bias (spec: 17.0832, -22.5597)
const WINDHOEK_LNG = 17.0832;
const WINDHOEK_LAT = -22.5597;

// Namibia bounding box keeps results in-country
const NAMIBIA_BBOX = "11.7,-28.9,25.3,-16.9";

// ─── Geocoder parameters (spec-aligned) ──────────────────────────────────────
const GEOCODER_TYPES = "address,street,neighborhood,locality,place,poi";
const GEOCODER_LIMIT = 8;

// ─── Feature type ─────────────────────────────────────────────────────────────
interface GeocoderFeature {
  id:         string;
  place_name: string;
  place_type: string[];
  center:     [number, number];
  context?:   Array<{ id: string; text: string }>;
}

// ─── Public result type ───────────────────────────────────────────────────────
/**
 * Emitted by MapPicker via onLocationSelect on every pin move (confirmed=false)
 * and again when the user clicks "Confirm This Location" (confirmed=true).
 *
 * Design contract:
 *   - latitude/longitude are always the PRIMARY location reference
 *   - address is the formatted_address label (secondary)
 *   - areaName is the suburb/neighbourhood (secondary)
 *   - confirmed=false  → live update, DO NOT submit
 *   - confirmed=true   → user explicitly approved, safe to submit
 */
export interface LocationResult {
  latitude:   number;
  longitude:  number;
  address:    string;   // full place_name (formatted_address)
  areaName:   string;   // suburb / neighbourhood from context
  isPrecise:  boolean;  // true only when place_type includes "address" | "street"
  confirmed:  boolean;
}

export interface MapPickerProps {
  onLocationSelect: (loc: LocationResult) => void;
  initialLat?:      number;
  initialLng?:      number;
  readOnly?:        boolean;
  showDirections?:  boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract neighbourhood/suburb from a geocoder feature's context array.
 * Namibian geocoder context hierarchy (most → least specific):
 *   neighborhood → locality → place (city) → country
 * Falls back to the second comma-separated component of place_name.
 */
function extractAreaName(f: GeocoderFeature): string {
  // Try from context (most accurate)
  if (f.context?.length) {
    const nb = f.context.find(c => c.id.startsWith("neighborhood"));
    if (nb?.text) return nb.text;
    const lo = f.context.find(c => c.id.startsWith("locality"));
    if (lo?.text) return lo.text;
    const pl = f.context.find(c => c.id.startsWith("place"));
    if (pl?.text) return pl.text;
  }
  // For neighborhood/locality type results, the name IS the suburb
  if (f.place_type?.some(t => t === "neighborhood" || t === "locality")) {
    return f.place_name.split(",")[0];
  }
  const parts = (f.place_name || "").split(", ");
  return parts.length > 1 ? parts[1] : parts[0];
}

/** True when geocoder resolved to an address, street or named suburb */
function isPreciseFeature(f: GeocoderFeature): boolean {
  return (f.place_type || []).some(t =>
    t === "address" || t === "street" || t === "neighborhood" || t === "locality"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
const MapPicker = ({
  onLocationSelect,
  initialLat,
  initialLng,
  readOnly       = false,
  showDirections = false,
}: MapPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markerRef    = useRef<mapboxgl.Marker | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search state ──────────────────────────────────────────────────────────
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<GeocoderFeature[]>([]);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [searching,   setSearching]   = useState(false);

  // ── Location / confirm state ──────────────────────────────────────────────
  const [pendingResult, setPendingResult] = useState<Omit<LocationResult, "confirmed"> | null>(null);
  const [confirmed,     setConfirmed]     = useState(false);
  const [mapReady,      setMapReady]      = useState(false);
  const [isDragging,    setIsDragging]    = useState(false);

  const startLng  = initialLng ?? WINDHOEK_LNG;
  const startLat  = initialLat ?? WINDHOEK_LAT;
  const startZoom = (initialLat && initialLng) ? 15 : 12;

  // ── Publish helper ────────────────────────────────────────────────────────
  const publish = useCallback(
    (result: Omit<LocationResult, "confirmed">, isConfirmed: boolean) => {
      onLocationSelect({ ...result, confirmed: isConfirmed });
    },
    [onLocationSelect]
  );

  // ── Reverse geocode ───────────────────────────────────────────────────────
  const reverseGeocode = useCallback(
    async (lng: number, lat: number) => {
      const coordFallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`
          + `?country=na`
          + `&types=${GEOCODER_TYPES}`
          + `&language=en`
          + `&access_token=${MAPBOX_TOKEN}`
        );
        const data = await res.json();
        const feat: GeocoderFeature | undefined = data.features?.[0];

        const result: Omit<LocationResult, "confirmed"> = feat
          ? {
              latitude:  lat,
              longitude: lng,
              address:   feat.place_name,
              areaName:  extractAreaName(feat),
              isPrecise: isPreciseFeature(feat),
            }
          : {
              latitude: lat, longitude: lng,
              address: coordFallback, areaName: "", isPrecise: false,
            };

        setPendingResult(result);
        setConfirmed(false);     // any pin move un-confirms
        if (feat) setQuery(feat.place_name);
        publish(result, false);
      } catch {
        const r: Omit<LocationResult, "confirmed"> = {
          latitude: lat, longitude: lng,
          address: coordFallback, areaName: "", isPrecise: false,
        };
        setPendingResult(r);
        setConfirmed(false);
        publish(r, false);
      }
    },
    [publish]
  );

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     MAP_STYLE,
      center:    [startLng, startLat],
      zoom:      startZoom,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    const marker = new mapboxgl.Marker({
      color:     MARKER_COLOR,
      draggable: !readOnly,
    })
      .setLngLat([startLng, startLat])
      .addTo(map);

    mapRef.current    = map;
    markerRef.current = marker;

    map.on("load", () => {
      setMapReady(true);
      if (initialLat && initialLng) reverseGeocode(startLng, startLat);
    });

    if (!readOnly) {
      marker.on("dragstart", () => setIsDragging(true));
      marker.on("drag",      () => setIsDragging(true));
      marker.on("dragend",   () => {
        setIsDragging(false);
        const { lng, lat } = marker.getLngLat();
        reverseGeocode(lng, lat);
      });
      map.on("click", (e) => {
        marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        reverseGeocode(e.lngLat.lng, e.lngLat.lat);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null; markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Forward geocode (search) ──────────────────────────────────────────────
  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) { setSuggestions([]); setDropOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json`
        + `?country=na`
        + `&bbox=${NAMIBIA_BBOX}`
        + `&proximity=${WINDHOEK_LNG},${WINDHOEK_LAT}`
        + `&types=${GEOCODER_TYPES}`
        + `&limit=${GEOCODER_LIMIT}`
        + `&language=en`
        + `&access_token=${MAPBOX_TOKEN}`
      );
      const data = await res.json();
      const feats = (data.features || []) as GeocoderFeature[];
      setSuggestions(feats);
      setDropOpen(feats.length > 0);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  // ── Select suggestion from dropdown ──────────────────────────────────────
  const selectSuggestion = (f: GeocoderFeature) => {
    const [lng, lat] = f.center;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
    markerRef.current?.setLngLat([lng, lat]);

    const area = extractAreaName(f);
    const result: Omit<LocationResult, "confirmed"> = {
      latitude: lat, longitude: lng,
      address:   f.place_name,
      areaName:  area,
      isPrecise: isPreciseFeature(f),
    };

    setPendingResult(result);
    setConfirmed(false);
    setQuery(f.place_name);
    setSuggestions([]);
    setDropOpen(false);
    publish(result, false);
  };

  // ── Confirm button ────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!pendingResult) return;
    setConfirmed(true);
    publish(pendingResult, true);
  };

  // ── Clear / reset ─────────────────────────────────────────────────────────
  const handleClear = () => {
    setQuery(""); setSuggestions([]); setDropOpen(false);
    setPendingResult(null); setConfirmed(false);
    markerRef.current?.setLngLat([WINDHOEK_LNG, WINDHOEK_LAT]);
    mapRef.current?.flyTo({ center: [WINDHOEK_LNG, WINDHOEK_LAT], zoom: 12, duration: 700 });
  };

  // ── Locate current position ───────────────────────────────────────────────
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { longitude: lng, latitude: lat } = coords;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
        markerRef.current?.setLngLat([lng, lat]);
        reverseGeocode(lng, lat);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocateError("Location access denied. Please enable location in your browser settings.");
        } else {
          setLocateError("Could not get your location. Try searching instead.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  // ── Imprecision warning guard ─────────────────────────────────────────────
  const showImprecisionWarning =
    !readOnly && pendingResult !== null && !pendingResult.isPrecise && !isDragging;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-2">

      {/* Search input + Locate Me */}
      {!readOnly && (
        <div className="relative">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search street, suburb or area in Namibia…"
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setDropOpen(true)}
                onBlur={() => setTimeout(() => setDropOpen(false), 160)}
                className="w-full pl-9 pr-10 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition"
              />
              <div className="absolute right-3 flex items-center gap-1">
                {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!searching && query && (
                  <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Locate Me button */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              title="Use my current location"
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-border bg-background text-foreground hover:bg-muted transition disabled:opacity-50"
            >
              {locating
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: MARKER_COLOR }} />
                : <Navigation className="w-4 h-4" style={{ color: MARKER_COLOR }} />
              }
              <span className="hidden sm:inline text-xs font-semibold">Locate Me</span>
            </button>
          </div>

          {/* Locate error */}
          {locateError && (
            <p className="mt-1.5 text-xs text-destructive flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{locateError}
            </p>
          )}

          {/* Suggestion dropdown */}
          {dropOpen && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {suggestions.map((f) => {
                const [main, ...rest] = f.place_name.split(", ");
                const precise         = isPreciseFeature(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={() => selectSuggestion(f)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition border-b border-border/40 last:border-0"
                  >
                    <MapPin
                      className="w-4 h-4 mt-0.5 shrink-0"
                      style={{ color: precise ? MARKER_COLOR : "#94a3b8" }}
                    />
                    <div className="min-w-0 flex-1">
                      {/* Primary: street number + street name */}
                      <p className="text-sm font-semibold text-foreground leading-snug">{main}</p>
                      {/* Secondary: suburb + city chain */}
                      {rest.length > 0 && (
                        <p className="text-xs text-foreground/60 truncate mt-0.5">{rest.join(", ")}</p>
                      )}
                      {/* Suburb highlight */}
                      {(() => {
                        const suburb = extractAreaName(f);
                        const showSuburb = suburb && suburb !== main && !rest[0]?.startsWith(suburb);
                        return showSuburb ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30" style={{ color: MARKER_COLOR }}>
                            📍 {suburb}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <span className={`shrink-0 self-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      f.place_type?.includes("address")      ? "bg-green-500/15 text-green-700 dark:text-green-400" :
                      f.place_type?.includes("street")       ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"   :
                      f.place_type?.includes("neighborhood") || f.place_type?.includes("locality")
                                                              ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" :
                      f.place_type?.includes("poi")          ? "bg-purple-500/15 text-purple-700 dark:text-purple-400" :
                      "bg-muted text-foreground/60"
                    }`}>
                      {f.place_type?.includes("address")      ? "Address" :
                       f.place_type?.includes("street")       ? "Street"  :
                       f.place_type?.includes("neighborhood") ? "Suburb"  :
                       f.place_type?.includes("locality")     ? "Area"    :
                       f.place_type?.includes("poi")          ? "POI"     :
                       "Place"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Map viewport */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border transition-all ${
          confirmed
            ? "border-green-500/60 ring-2 ring-green-500/20"
            : pendingResult
            ? "border-orange-400/50"
            : "border-border"
        }`}
        style={{ paddingBottom: "56.25%" }}
      >
        {/* Loading overlay */}
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: MARKER_COLOR }} />
          </div>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Idle hint */}
        {!readOnly && mapReady && !pendingResult && (
          <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
            <span className="bg-background/85 backdrop-blur-sm text-xs text-muted-foreground px-2.5 py-1.5 rounded-lg border border-border/50 flex items-center gap-1.5">
              <LocateFixed className="w-3 h-3" style={{ color: MARKER_COLOR }} />
              Tap map or drag pin to set location
            </span>
          </div>
        )}

        {/* Active drag label */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            >
              <span className="bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                Drop to set location
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmed badge */}
        <AnimatePresence>
          {confirmed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 left-2 z-10 pointer-events-none"
            >
              <span className="flex items-center gap-1.5 bg-green-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                <CheckCircle className="w-3.5 h-3.5" />
                Location confirmed
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Imprecision warning */}
      {/*
        Shown whenever geocoder returned a place/neighborhood result rather than
        a street or address — Namibian geocoding is sparse at street level.
      */}
      <AnimatePresence>
        {showImprecisionWarning && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/8 px-3.5 py-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
                <span className="font-semibold">Can't find your exact street?</span>
                {" "}Please drag the pin to your exact location.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address display row */}
      {pendingResult && (
        <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
          confirmed
            ? "border-green-500/30 bg-green-500/5"
            : "border-border bg-muted/30"
        }`}>
          <MapPin
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: confirmed ? "#22c55e" : MARKER_COLOR }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-foreground">{pendingResult.address}</p>
            {pendingResult.areaName &&
              pendingResult.areaName !== pendingResult.address && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {pendingResult.areaName}
                </p>
              )}
          </div>
          <span className={`shrink-0 self-start mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            pendingResult.isPrecise
              ? "bg-green-500/15 text-green-600"
              : "bg-amber-500/15 text-amber-600"
          }`}>
            {pendingResult.isPrecise ? "Precise" : "Approx"}
          </span>
        </div>
      )}

      {/* Confirm / Change button */}
      {!readOnly && pendingResult && (
        <AnimatePresence mode="wait">
          {!confirmed ? (
            <motion.button
              key="confirm-btn"
              type="button"
              onClick={handleConfirm}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white shadow-md hover:opacity-90 transition"
              style={{ background: "linear-gradient(135deg, #FF8C00, #ffb347)" }}
            >
              <CheckCircle className="w-4 h-4" />
              Confirm This Location
            </motion.button>
          ) : (
            <motion.button
              key="change-btn"
              type="button"
              onClick={() => {
                setConfirmed(false);
                if (pendingResult) publish(pendingResult, false);
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border border-border text-muted-foreground hover:bg-muted/60 transition"
            >
              <MapPin className="w-4 h-4" />
              Change Location
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Directions (read-only / admin) */}
      {showDirections && initialLat && initialLng && (
        <button
          type="button"
          onClick={() =>
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${initialLat},${initialLng}`,
              "_blank"
            )
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card text-sm font-bold hover:bg-muted/60 transition"
        >
          <Navigation className="w-4 h-4" style={{ color: MARKER_COLOR }} />
          Get Directions in Google Maps
        </button>
      )}
    </div>
  );
};

export default MapPicker;
