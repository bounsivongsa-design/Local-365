import { useState, useRef, useEffect } from "react";
import { useLocation } from "@/context/LocationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Search, ChevronDown, Check, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";

const ACTIVE_ZIPS = new Set(["27958"]);

const NC_REGIONS = [
  { name: "Moyock, NC", city: "Moyock", state: "NC", zipCode: "27958", region: "Currituck County", tagline: "Heart of Currituck County" },
  { name: "Currituck, NC", city: "Currituck", state: "NC", zipCode: "27929", region: "Currituck County", tagline: "County seat with coastal charm" },
  { name: "Barco, NC", city: "Barco", state: "NC", zipCode: "27917", region: "Currituck County", tagline: "Central Currituck community" },
  { name: "Maple, NC", city: "Maple", state: "NC", zipCode: "27956", region: "Currituck County", tagline: "Rural Currituck living" },
  { name: "Shawboro, NC", city: "Shawboro", state: "NC", zipCode: "27973", region: "Currituck County", tagline: "Historic Currituck countryside" },
  { name: "Knotts Island, NC", city: "Knotts Island", state: "NC", zipCode: "27950", region: "Currituck County", tagline: "Island community and nature preserve" },
  { name: "Grandy, NC", city: "Grandy", state: "NC", zipCode: "27939", region: "Currituck County", tagline: "Southern Currituck gateway" },
  { name: "Jarvisburg, NC", city: "Jarvisburg", state: "NC", zipCode: "27947", region: "Currituck County", tagline: "Currituck wine country" },
  { name: "Point Harbor, NC", city: "Point Harbor", state: "NC", zipCode: "27964", region: "Currituck County", tagline: "Waterfront community on the sound" },
  { name: "Coinjock, NC", city: "Coinjock", state: "NC", zipCode: "27923", region: "Currituck County", tagline: "Famous for steak and the Intracoastal" },
  { name: "Aydlett, NC", city: "Aydlett", state: "NC", zipCode: "27916", region: "Currituck County", tagline: "Quiet waterfront living" },
  { name: "Poplar Branch, NC", city: "Poplar Branch", state: "NC", zipCode: "27965", region: "Currituck County", tagline: "Peaceful Currituck countryside" },
  { name: "Corolla, NC", city: "Corolla", state: "NC", zipCode: "27927", region: "Currituck County", tagline: "Historic lighthouse and wild horse tours" },
  { name: "Carova Beach, NC", city: "Carova Beach", state: "NC", zipCode: "27927", region: "Currituck County", tagline: "4x4 beaches and wild horses" },
  { name: "Chesapeake, VA (23322)", city: "Chesapeake", state: "VA", zipCode: "23322", region: "Hampton Roads", tagline: "Great Bridge and southern Chesapeake" },
  { name: "Chesapeake, VA (23321)", city: "Chesapeake", state: "VA", zipCode: "23321", region: "Hampton Roads", tagline: "Deep Creek and western Chesapeake" },
  { name: "Chesapeake, VA (23320)", city: "Chesapeake", state: "VA", zipCode: "23320", region: "Hampton Roads", tagline: "Greenbrier and central Chesapeake" },
];

export function LocationPicker() {
  const { location, setLocation } = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: dbLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    enabled: open,
  });

  const allLocations = dbLocations?.length ? dbLocations.map(loc => ({
    id: loc.id,
    name: loc.name,
    city: loc.city,
    state: loc.state,
    zipCode: loc.zipCodes?.[0] || "",
    region: loc.region || "",
    tagline: loc.tagline || ""
  })) : NC_REGIONS;

  const filteredLocations = allLocations.filter(loc => {
    const searchLower = search.toLowerCase();
    return (
      loc.name.toLowerCase().includes(searchLower) ||
      loc.city.toLowerCase().includes(searchLower) ||
      loc.state.toLowerCase().includes(searchLower) ||
      loc.zipCode?.includes(search) ||
      loc.region?.toLowerCase().includes(searchLower)
    );
  });

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const [geoLoading, setGeoLoading] = useState(false);

  const handleSelect = (loc: typeof NC_REGIONS[0]) => {
    setLocation(loc);
    setOpen(false);
    setSearch("");
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "Unknown";
          const state = data.address?.state || "";
          const zip = data.address?.postcode || "";
          const stateAbbr = state.length > 2 ? state.substring(0, 2).toUpperCase() : state;
          const match = allLocations.find(loc => loc.zipCode === zip || loc.city.toLowerCase() === city.toLowerCase());
          if (match) {
            handleSelect(match);
          } else {
            handleSelect({ name: `${city}, ${stateAbbr}`, city, state: stateAbbr, zipCode: zip, region: "", tagline: "" });
          }
        } catch {
          setGeoLoading(false);
        }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 10000 }
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
          <span className="hidden sm:inline">{location.city}, {location.state}</span>
          <span className="sm:hidden">{location.city}</span>
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

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No locations found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              filteredLocations.map((loc, i) => {
                const isActive = ACTIVE_ZIPS.has(loc.zipCode);
                const isSelected = location.city === loc.city && location.state === loc.state;
                return (
                  <button
                    key={i}
                    onClick={() => isActive && handleSelect(loc)}
                    disabled={!isActive}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : isActive
                          ? "hover:bg-muted"
                          : "opacity-45 cursor-not-allowed"
                    }`}
                    data-testid={`location-option-${loc.city.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <MapPin className={`h-4 w-4 mt-1 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={isActive ? "font-medium" : "font-medium text-muted-foreground"}>{loc.name}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        {!isActive && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Coming Soon</span>
                        )}
                      </div>
                      {loc.region && (
                        <span className="text-xs text-muted-foreground">{loc.region}</span>
                      )}
                      {loc.tagline && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{loc.tagline}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              More locations coming soon! We're expanding across North Carolina.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
