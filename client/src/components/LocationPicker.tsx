import { useState, useRef, useEffect } from "react";
import { useLocation } from "@/context/LocationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Search, ChevronDown, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";

const NC_REGIONS = [
  { name: "Currituck County, NC", city: "Currituck", state: "NC", zipCode: "27929", region: "Outer Banks", tagline: "Wild horses, pristine beaches, and coastal charm" },
  { name: "Duck, NC", city: "Duck", state: "NC", zipCode: "27949", region: "Outer Banks", tagline: "Upscale beach town with boardwalks and boutiques" },
  { name: "Corolla, NC", city: "Corolla", state: "NC", zipCode: "27927", region: "Outer Banks", tagline: "Historic lighthouse and wild horse tours" },
  { name: "Kill Devil Hills, NC", city: "Kill Devil Hills", state: "NC", zipCode: "27948", region: "Outer Banks", tagline: "Birthplace of flight and family beaches" },
  { name: "Nags Head, NC", city: "Nags Head", state: "NC", zipCode: "27959", region: "Outer Banks", tagline: "Jockey's Ridge and legendary surf" },
  { name: "Kitty Hawk, NC", city: "Kitty Hawk", state: "NC", zipCode: "27949", region: "Outer Banks", tagline: "Wright Brothers heritage and maritime forests" },
  { name: "Manteo, NC", city: "Manteo", state: "NC", zipCode: "27954", region: "Outer Banks", tagline: "Historic waterfront and Roanoke Island charm" },
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

  const handleSelect = (loc: typeof NC_REGIONS[0]) => {
    setLocation(loc);
    setOpen(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-2 text-sm font-medium hover:bg-primary/5"
          data-testid="button-location-picker"
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">{location.city}, {location.state}</span>
          <span className="sm:hidden">{location.city}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
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

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No locations found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              filteredLocations.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(loc)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                    location.city === loc.city && location.state === loc.state
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`location-option-${loc.city.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <MapPin className="h-4 w-4 mt-1 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{loc.name}</span>
                      {location.city === loc.city && location.state === loc.state && (
                        <Check className="h-4 w-4 text-primary" />
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
              ))
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
