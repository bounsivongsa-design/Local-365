import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/context/LocationContext";
import { useToast } from "@/hooks/use-toast";
import type { Location } from "@shared/schema";
import { calculateDistance } from "@/lib/zip-coordinates";

interface LocationSearchInputProps {
  /** Where to navigate after selection. Defaults to /directory. */
  navigateTo?: (zip: string) => string;
  /** Visual variant. */
  variant?: "hero" | "inline";
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
}

/**
 * Zillow-style location-first input. Autocompletes against /api/locations
 * (city / zip / region) and supports "Use my location" → resolves to the
 * nearest covered zip via Haversine. Selecting a row sets LocationContext and
 * navigates to /directory?zip=NNNNN (or whatever `navigateTo` returns).
 */
export function LocationSearchInput({
  navigateTo,
  variant = "hero",
  placeholder = "Enter your town, zip, or city…",
  autoFocus = false,
}: LocationSearchInputProps) {
  const navigate = useNavigate();
  const { setLocation } = useLocation();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [geoLoading, setGeoLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: locations } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  // Each match also carries the BEST zip to route to — if the user typed a
  // specific zip we keep that exact one (preserves zip-level fidelity for
  // multi-zip cities); otherwise fall back to the location's primary zip.
  const matches = useMemo<Array<{ loc: Location; zip: string }>>(() => {
    const q = query.trim().toLowerCase();
    const all = locations || [];
    const pickZip = (l: Location): string => {
      if (q && /^\d/.test(q)) {
        const exact = (l.zipCodes || []).find((z) => z.includes(q));
        if (exact) return exact;
      }
      return l.zipCodes?.[0] || "";
    };
    if (!q) return all.slice(0, 8).map((l) => ({ loc: l, zip: pickZip(l) }));
    return all
      .filter(
        (l) =>
          l.city.toLowerCase().includes(q) ||
          l.state.toLowerCase().includes(q) ||
          (l.region || "").toLowerCase().includes(q) ||
          (l.zipCodes || []).some((z) => z.includes(q)),
      )
      .slice(0, 12)
      .map((l) => ({ loc: l, zip: pickZip(l) }));
  }, [locations, query]);

  // Out-of-coverage state: set after Use-my-location resolves to a zip more
  // than 60 miles away. Surfaces a visible CTA card (not just a toast) so
  // users have an obvious next step.
  const [outOfCoverage, setOutOfCoverage] = useState<{
    nearestCity: string;
    nearestState: string;
    distance: number;
    nearest: Location;
  } | null>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectLocation = (loc: Location, zipOverride?: string) => {
    const zip = zipOverride || loc.zipCodes?.[0] || "";
    setOutOfCoverage(null);
    setLocation({
      id: loc.id,
      name: loc.name,
      city: loc.city,
      state: loc.state,
      zipCode: zip,
      region: loc.region || "",
      tagline: loc.tagline || "",
    });
    setQuery("");
    setOpen(false);
    const target = navigateTo ? navigateTo(zip) : `/directory?zip=${zip}`;
    navigate(target);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation unavailable", description: "Your browser doesn't support location detection.", variant: "destructive" });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const all = locations || [];
        // Find the nearest covered zip via Haversine using the seeded lat/lng.
        let best: { loc: Location; dist: number } | null = null;
        for (const l of all) {
          if (!l.latitude || !l.longitude) continue;
          const lat = parseFloat(l.latitude);
          const lon = parseFloat(l.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const dist = calculateDistance(userLat, userLon, lat, lon);
          if (!best || dist < best.dist) best = { loc: l, dist };
        }
        setGeoLoading(false);
        if (!best) {
          toast({ title: "No covered area found", description: "We don't serve your region yet.", variant: "destructive" });
          return;
        }
        // If the user is more than ~60 miles from the nearest covered zip,
        // raise a visible CTA card with "Browse the closest area we cover" —
        // not just a toast — so the user has a clear next step.
        if (best.dist > 60) {
          setOutOfCoverage({
            nearestCity: best.loc.city,
            nearestState: best.loc.state,
            distance: Math.round(best.dist),
            nearest: best.loc,
          });
          setOpen(false);
          return;
        }
        toast({
          title: `Showing results for ${best.loc.city}, ${best.loc.state}`,
          description: `~${Math.round(best.dist)} miles from your current location.`,
        });
        selectLocation(best.loc);
      },
      () => {
        setGeoLoading(false);
        toast({ title: "Couldn't detect your location", description: "Please choose a town or zip from the list.", variant: "destructive" });
      },
      { timeout: 10000 },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIndex];
      if (pick) selectLocation(pick.loc, pick.zip);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const isHero = variant === "hero";

  return (
    <div ref={containerRef} className={`relative w-full ${isHero ? "max-w-2xl mx-auto" : ""}`}>
      <div
        className={`flex flex-col sm:flex-row gap-2 ${
          isHero ? "" : ""
        }`}
      >
        <div className="relative flex-1 w-full">
          <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isHero ? "text-[#0a4a82]" : "text-slate-400"}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`pl-12 pr-4 w-full border-0 bg-white outline-none shadow-lg text-gray-800 ${
              isHero
                ? "py-4 rounded-l-xl sm:rounded-l-xl sm:rounded-r-none rounded-xl text-base focus:ring-2 focus:ring-[#d4a373]"
                : "py-3 rounded-xl text-sm focus:ring-2 focus:ring-[#0a4a82]"
            }`}
            data-testid="input-location-autocomplete"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          size="lg"
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className={`${
            isHero
              ? "rounded-r-xl rounded-l-none bg-[#d4a373] text-white hover:bg-[#c49363] font-semibold px-6 h-[56px] shadow-lg whitespace-nowrap"
              : "rounded-xl bg-[#0a4a82] text-white hover:bg-[#083a6a] font-semibold px-4 h-12"
          }`}
          data-testid="button-use-my-location-hero"
        >
          {geoLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5 mr-2" />}
          {!geoLoading && <span>Use my location</span>}
        </Button>
      </div>

      {outOfCoverage && (
        <div
          className="mt-3 rounded-2xl bg-white/95 border border-amber-300 p-5 shadow-2xl text-left"
          data-testid="banner-region-not-covered"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#1a1a2e] text-base mb-1">
                We don't cover your region yet
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                The closest area we serve is{" "}
                <span className="font-medium text-[#0a4a82]">
                  {outOfCoverage.nearestCity}, {outOfCoverage.nearestState}
                </span>{" "}
                — about {outOfCoverage.distance} miles from you. We're expanding fast — want to be notified when we launch in your area?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-[#0a4a82] text-white hover:bg-[#083a6a]"
                  onClick={() => selectLocation(outOfCoverage.nearest)}
                  data-testid="button-browse-nearest-anyway"
                >
                  Browse {outOfCoverage.nearestCity} anyway
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOutOfCoverage(null)}
                  data-testid="button-dismiss-coverage-banner"
                >
                  Pick a different area
                </Button>
                <a
                  href="mailto:support@locallist365.com?subject=Expand%20to%20my%20area"
                  className="inline-flex items-center text-sm font-medium text-[#0a4a82] hover:underline px-2 py-1.5"
                  data-testid="link-request-area-coverage"
                >
                  Request coverage
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && !outOfCoverage && (matches.length > 0 || query.trim()) && (
        <div
          className="absolute left-0 right-0 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl z-30"
          data-testid="location-autocomplete-list"
        >
          {matches.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center">
              <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
              No covered areas match "{query}". We're expanding — check back soon!
            </div>
          ) : (
            matches.map(({ loc, zip }, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={`${loc.id}-${zip}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectLocation(loc, zip)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    isActive ? "bg-[#0a4a82]/5" : "hover:bg-slate-50"
                  }`}
                  data-testid={`autocomplete-option-${zip}`}
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[#0a4a82]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[#1a1a2e]">
                        {loc.city}, {loc.state}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">{zip}</span>
                    </div>
                    {loc.region && <p className="text-xs text-slate-500 truncate">{loc.region}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
