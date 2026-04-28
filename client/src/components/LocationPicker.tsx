import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "@/context/LocationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Search, ChevronDown, Check, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";

interface PickerLocation {
  id?: number;
  name: string;
  city: string;
  state: string;
  zipCode: string;
  region: string;
  tagline: string;
}

// Shown only while /api/locations is loading or unavailable so the dialog
// is never empty. The authoritative full list (41 zips across NC OBX/EC + VA
// Chesapeake/Virginia Beach) is seeded into the DB by server/locationSeed.ts
// and reaches the picker via /api/locations.
const FALLBACK_LOCATIONS: PickerLocation[] = [
  { name: "Moyock, NC", city: "Moyock", state: "NC", zipCode: "27958", region: "Currituck County", tagline: "Heart of Currituck County" },
  { name: "Elizabeth City, NC", city: "Elizabeth City", state: "NC", zipCode: "27909", region: "Pasquotank County", tagline: "Historic harbor of the Pasquotank" },
  { name: "Kitty Hawk, NC", city: "Kitty Hawk", state: "NC", zipCode: "27949", region: "Outer Banks", tagline: "Where flight began" },
  { name: "Nags Head, NC", city: "Nags Head", state: "NC", zipCode: "27959", region: "Outer Banks", tagline: "Classic Outer Banks beach town" },
  { name: "Chesapeake, VA", city: "Chesapeake", state: "VA", zipCode: "23320", region: "Hampton Roads", tagline: "Greenbrier and central Chesapeake" },
  { name: "Virginia Beach, VA", city: "Virginia Beach", state: "VA", zipCode: "23451", region: "Hampton Roads", tagline: "Oceanfront and resort district" },
];

export function LocationPicker() {
  const { location, setLocation } = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: dbLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const allLocations: PickerLocation[] = useMemo(() => {
    if (!dbLocations?.length) return FALLBACK_LOCATIONS;
    return dbLocations
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        city: loc.city,
        state: loc.state,
        zipCode: loc.zipCodes?.[0] || "",
        region: loc.region || "",
        tagline: loc.tagline || "",
      }))
      .sort((a, b) => {
        // NC first, then VA, then alphabetical by city.
        if (a.state !== b.state) return a.state === "NC" ? -1 : 1;
        return a.city.localeCompare(b.city);
      });
  }, [dbLocations]);

  const filteredLocations = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allLocations;
    return allLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(s) ||
        loc.city.toLowerCase().includes(s) ||
        loc.state.toLowerCase().includes(s) ||
        loc.zipCode.includes(s) ||
        loc.region.toLowerCase().includes(s),
    );
  }, [allLocations, search]);

  // Group by state → region for a Thumbtack-style sectioned list.
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, PickerLocation[]>>();
    for (const loc of filteredLocations) {
      const stateKey = loc.state;
      const regionKey = loc.region || "Other";
      if (!map.has(stateKey)) map.set(stateKey, new Map());
      const regionMap = map.get(stateKey)!;
      if (!regionMap.has(regionKey)) regionMap.set(regionKey, []);
      regionMap.get(regionKey)!.push(loc);
    }
    return map;
  }, [filteredLocations]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSelect = (loc: PickerLocation) => {
    setLocation({
      name: loc.name,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zipCode,
      region: loc.region,
      tagline: loc.tagline,
    });
    setOpen(false);
    setSearch("");
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`,
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "Unknown";
          const state = data.address?.state || "";
          const zip = data.address?.postcode || "";
          const stateAbbr = state.length > 2 ? state.substring(0, 2).toUpperCase() : state;
          const match =
            allLocations.find((loc) => loc.zipCode === zip) ||
            allLocations.find((loc) => loc.city.toLowerCase() === city.toLowerCase());
          if (match) {
            handleSelect(match);
          } else {
            handleSelect({ name: `${city}, ${stateAbbr}`, city, state: stateAbbr, zipCode: zip, region: "", tagline: "" });
          }
        } catch {
          // ignore — we'll just stop the spinner
        }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 10000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 text-sm font-medium text-white hover:bg-white/10"
          data-testid="button-location-picker"
        >
          <MapPin className="h-4 w-4 text-[#d4a373]" />
          <span className="hidden sm:inline">
            {location.city}, {location.state} {location.zipCode}
          </span>
          <span className="sm:hidden">
            {location.city} {location.zipCode}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Choose Your Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search by city, zip code, or region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-location-search"
            />
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 text-sm"
            onClick={handleUseMyLocation}
            disabled={geoLoading}
            data-testid="button-use-my-location"
          >
            <Navigation className="h-4 w-4" />
            {geoLoading ? "Detecting location..." : "Use My Location"}
          </Button>

          <div className="max-h-[360px] overflow-y-auto -mx-1 px-1">
            {filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No locations found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([state, regions]) => (
                <div key={state} className="mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                    {state === "NC" ? "North Carolina" : state === "VA" ? "Virginia" : state}
                  </div>
                  {Array.from(regions.entries()).map(([region, locs]) => (
                    <div key={region} className="mb-2">
                      <div className="text-xs text-muted-foreground/80 px-2 py-1">{region}</div>
                      <div className="space-y-0.5">
                        {locs.map((loc) => {
                          const isSelected =
                            location.city === loc.city &&
                            location.state === loc.state &&
                            location.zipCode === loc.zipCode;
                          return (
                            <button
                              key={`${loc.zipCode}-${loc.id ?? loc.city}`}
                              onClick={() => handleSelect(loc)}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-3 ${
                                isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                              }`}
                              data-testid={`location-option-${loc.zipCode}`}
                            >
                              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {loc.city}, {loc.state}
                                  </span>
                                  <span className="text-xs text-muted-foreground tabular-nums">{loc.zipCode}</span>
                                  {isSelected && <Check className="h-4 w-4 text-primary ml-auto" />}
                                </div>
                                {loc.tagline && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.tagline}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Now serving {allLocations.length} zip codes across NC &amp; VA.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
