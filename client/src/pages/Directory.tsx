import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useBusinesses } from "@/hooks/use-businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, Plus, Building2, Layers, Wrench, Droplets, Wind, Zap, Home,
  Trees, Sparkles, Paintbrush, TreePine, HardHat, Construction, Baby,
  Printer, Palette, Camera, Car, Settings, Trash2, GraduationCap,
  Heart, Calculator, Scale, Hammer, ChefHat, Truck, PartyPopper, Waves,
  ShoppingBag, UtensilsCrossed, PawPrint, DoorOpen, Fence, Shield, Bug,
  Scissors, Dumbbell, Anchor, HeartPulse, Landmark, Monitor, MapPin,
  Music, MapPinned, Film
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/LocationContext";
import { getDistanceFromZips, getZipCoords, RADIUS_OPTIONS } from "@/lib/zip-coordinates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateBusinessForm } from "@/components/CreateBusinessForm";

export default function Directory() {
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "";
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory || "All");
  const [radiusMiles, setRadiusMiles] = useState(0);
  const { location: selectedLocation } = useLocation();
  const hasCoords = selectedLocation.zipCode ? !!getZipCoords(selectedLocation.zipCode) : false;

  useEffect(() => {
    if (urlSearch) setSearchTerm(urlSearch);
    if (urlCategory) setCategory(urlCategory);
  }, [urlSearch, urlCategory]);
  const { data: businesses, isLoading } = useBusinesses({ 
    search: searchTerm, 
    category: category === "All" ? undefined : category 
  });
  const { isAuthenticated } = useAuth();

  const filteredBusinesses = useMemo(() => {
    if (!businesses || radiusMiles === 0 || !selectedLocation.zipCode) return businesses;
    return businesses.filter((biz) => {
      const dist = getDistanceFromZips(selectedLocation.zipCode!, biz.zipCode || "");
      if (dist === null) return false;
      return dist <= radiusMiles;
    });
  }, [businesses, radiusMiles, selectedLocation.zipCode]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const categories = [
    { name: "All", icon: Layers },
    { name: "Animal & Pet", icon: PawPrint },
    { name: "Auto Detailing", icon: Car },
    { name: "Auto Repair", icon: Car },
    { name: "Baby Sitting & Nanny", icon: Baby },
    { name: "Baking & Cooking", icon: ChefHat },
    { name: "Beauty & Salon", icon: Scissors },
    { name: "Catering / Food Trucks", icon: Truck },
    { name: "Cleaning", icon: Sparkles },
    { name: "Concrete", icon: Building2 },
    { name: "Dock & Marine", icon: Anchor },
    { name: "Electrical", icon: Zap },
    { name: "Entertainment Locations", icon: MapPinned },
    { name: "Entertainment Services", icon: Music },
    { name: "Event Planning & Rentals", icon: PartyPopper },
    { name: "Fencing", icon: Fence },
    { name: "Fitness & Gym", icon: Dumbbell },
    { name: "Flooring", icon: Home },
    { name: "Garage Door", icon: DoorOpen },
    { name: "Health & Wellness", icon: HeartPulse },
    { name: "Home Repair", icon: Wrench },
    { name: "HVAC", icon: Wind },
    { name: "Insurance", icon: Shield },
    { name: "Landscaping", icon: Trees },
    { name: "Lawn Care", icon: TreePine },
    { name: "Legal", icon: Scale },
    { name: "Metal Work", icon: Hammer },
    { name: "Moving & Hauling", icon: Truck },
    { name: "New Construction", icon: Construction },
    { name: "Painting", icon: Paintbrush },
    { name: "Pest Control", icon: Bug },
    { name: "Photo & Video", icon: Camera },
    { name: "Plumbing", icon: Droplets },
    { name: "Pool & Spa", icon: Waves },
    { name: "Pressure Washing", icon: Waves },
    { name: "Printing", icon: Printer },
    { name: "Real Estate / Realtors", icon: Home },
    { name: "Remodeling & Addition", icon: HardHat },
    { name: "Restaurants & Dining", icon: UtensilsCrossed },
    { name: "Roofing", icon: Home },
    { name: "Security Services", icon: Shield },
    { name: "Septic & Well", icon: Droplets },
    { name: "Shopping / Retail", icon: ShoppingBag },
    { name: "Small Engine Repair", icon: Settings },
    { name: "Tax CPA", icon: Landmark },
    { name: "Trash & Junk Removal", icon: Trash2 },
    { name: "Tree Care", icon: TreePine },
    { name: "Tutor & Mentor Counseling", icon: GraduationCap },
    { name: "Web Design & Logo Design", icon: Palette },
    { name: "Window Tinting", icon: Film },
    { name: "Windows & Doors", icon: DoorOpen },
    { name: "Woodworking", icon: Hammer },
  ];

  return (
    <div className="min-h-screen">
      {/* Stunning Header with Coastal Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0a4a82] via-[#1a6aa8] to-[#2d8bc9]">
        {/* Decorative Wave Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 w-full h-24" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path fill="white" d="M0,64L48,69.3C96,75,192,85,288,90.7C384,96,480,96,576,85.3C672,75,768,53,864,48C960,43,1056,53,1152,58.7C1248,64,1344,64,1392,64L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"/>
          </svg>
        </div>
        
        <div className="container relative py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Waves className="h-8 w-8 text-white" />
                </div>
                <h1 className="font-display text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                  Local Directory
                </h1>
              </div>
              <p className="text-white/90 text-lg max-w-md">
                Discover trusted businesses and services across Currituck County's beautiful coastal community.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0a4a82]" />
                <Input
                  placeholder="Search businesses..."
                  className="pl-12 h-12 rounded-xl bg-white/95 border-0 shadow-xl text-base placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-white/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-businesses"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a4a82]" />
                <select
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  disabled={!hasCoords}
                  className={`h-12 pl-9 pr-4 rounded-xl bg-white/95 border-0 shadow-xl text-sm font-medium text-[#0a4a82] appearance-none cursor-pointer focus:ring-2 focus:ring-white/50 ${!hasCoords ? "opacity-50 cursor-not-allowed" : ""}`}
                  data-testid="select-radius"
                >
                  {RADIUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {isAuthenticated && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="h-12 px-6 bg-[#d4a373] hover:bg-[#c4936d] text-white shadow-xl border-0 rounded-xl" data-testid="button-add-business">
                      <Plus className="mr-2 h-5 w-5" />
                      Add Business
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add a New Business</DialogTitle>
                      <DialogDescription>
                        Share a local gem with the community. Please provide accurate details.
                      </DialogDescription>
                    </DialogHeader>
                    <CreateBusinessForm onSuccess={() => setIsDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#f5f0eb] min-h-screen">
      <div className="container py-8">
        <div className="flex gap-8">
          <aside className="hidden md:block w-72 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl overflow-hidden bg-white dark:bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#0a4a82]/10">
              {/* Header with Coastal Gradient */}
              <div className="p-5 bg-gradient-to-r from-[#0a4a82] to-[#1a6aa8] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <svg className="absolute -bottom-1 w-full h-8" viewBox="0 0 400 40" preserveAspectRatio="none">
                    <path fill="white" d="M0,20L20,22C40,24,80,28,120,28C160,28,200,24,240,22C280,20,320,20,360,22L400,24L400,40L0,40Z"/>
                  </svg>
                </div>
                <div className="flex items-center gap-3 relative">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg">Categories</h2>
                    <p className="text-white/90 text-xs">Browse by service type</p>
                  </div>
                </div>
              </div>
              
              {/* Distance Filter */}
              <div className="px-4 py-3 border-b border-[#0a4a82]/10">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Distance from {selectedLocation.city}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a4a82]" />
                  <select
                    value={radiusMiles}
                    onChange={(e) => setRadiusMiles(Number(e.target.value))}
                    disabled={!hasCoords}
                    className={`w-full py-2.5 pl-9 pr-3 rounded-lg border border-[#0a4a82]/15 bg-[#0a4a82]/5 text-sm font-medium text-[#0a4a82] appearance-none cursor-pointer focus:ring-2 focus:ring-[#0a4a82]/20 focus:border-[#0a4a82]/30 ${!hasCoords ? "opacity-50 cursor-not-allowed" : ""}`}
                    data-testid="select-radius-sidebar"
                  >
                    {RADIUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {!hasCoords && (
                  <p className="text-xs text-muted-foreground mt-1.5">Distance not available for this location</p>
                )}
              </div>

              {/* Category List */}
              <div className="max-h-[calc(100vh-340px)] overflow-y-auto p-3 space-y-1.5">
                  {categories.map((cat) => {
                    const IconComponent = cat.icon;
                    const isActive = category === cat.name;
                    return (
                      <button
                        key={cat.name}
                        onClick={() => setCategory(cat.name)}
                        data-testid={`button-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-[background-color,color,box-shadow] duration-200 group ${
                          isActive 
                            ? "bg-gradient-to-r from-[#0a4a82] to-[#1a6aa8] text-white font-medium shadow-lg shadow-[#0a4a82]/30 scale-[1.02]" 
                            : "text-foreground/80 hover:bg-[#0a4a82]/5 hover:text-[#0a4a82] dark:hover:bg-[#0a4a82]/20 dark:hover:text-white"
                        }`}
                      >
                        <span className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-[background-color] duration-200 ${
                          isActive 
                            ? "bg-white/20 shadow-inner" 
                            : "bg-gradient-to-br from-[#f5f5dc]/50 to-[#d4a373]/20 group-hover:from-[#0a4a82]/10 group-hover:to-[#0a4a82]/20"
                        }`}>
                          <IconComponent className={`h-5 w-5 transition-transform duration-300 ${isActive ? "" : "group-hover:scale-110"}`} />
                        </span>
                        <span className="flex-1 text-left truncate font-medium">{cat.name}</span>
                        {cat.name === "All" && filteredBusinesses && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                            isActive 
                              ? "bg-white/25 text-white" 
                              : "bg-[#d4a373]/20 text-[#d4a373] group-hover:bg-[#0a4a82]/20 group-hover:text-[#0a4a82]"
                          }`}>
                            {filteredBusinesses.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
            </div>
          </aside>

          {/* Mobile Category & Radius Selectors */}
          <div className="md:hidden mb-6 space-y-3">
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-[#0a4a82]/20 bg-white dark:bg-card appearance-none font-medium text-[#0a4a82] shadow-lg focus:border-[#0a4a82] focus:ring-2 focus:ring-[#0a4a82]/20"
                data-testid="select-category-mobile"
              >
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0a4a82] pointer-events-none" />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0a4a82] pointer-events-none" />
              <select
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                className="w-full p-4 pl-12 rounded-xl border-2 border-[#0a4a82]/20 bg-white dark:bg-card appearance-none font-medium text-[#0a4a82] shadow-lg focus:border-[#0a4a82] focus:ring-2 focus:ring-[#0a4a82]/20"
                data-testid="select-radius-mobile"
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === 0 ? "Any Distance" : `Within ${opt.value} miles of ${selectedLocation.city}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <main className="flex-1 min-w-0">
            {/* Results Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1.5 bg-gradient-to-b from-[#0a4a82] to-[#d4a373] rounded-full" />
                <div>
                  <h2 className="font-bold text-lg text-foreground">
                    {category === "All" ? "All Categories" : category}
                  </h2>
                  {filteredBusinesses && (
                    <p className="text-sm text-muted-foreground">
                      {filteredBusinesses.length} {filteredBusinesses.length === 1 ? "business" : "businesses"} found
                      {radiusMiles > 0 && ` within ${radiusMiles} miles of ${selectedLocation.city}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-[320px] rounded-2xl bg-white dark:bg-card p-5 border border-[#0a4a82]/10 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : filteredBusinesses?.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-card rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-[#0a4a82]/10">
                <div className="h-24 w-24 bg-gradient-to-br from-[#f5f5dc] to-[#d4a373]/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Search className="h-12 w-12 text-[#0a4a82]/40" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">No businesses found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {radiusMiles > 0 
                    ? `No businesses found within ${radiusMiles} miles of ${selectedLocation.city}. Try increasing the distance.`
                    : "Try adjusting your search or browse a different category."
                  }
                </p>
                {radiusMiles > 0 && (
                  <Button 
                    variant="outline" 
                    className="mt-4 text-[#0a4a82] border-[#0a4a82]/30"
                    onClick={() => setRadiusMiles(0)}
                    data-testid="button-clear-radius"
                  >
                    Clear Distance Filter
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredBusinesses?.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
      </div>
    </div>
  );
}
