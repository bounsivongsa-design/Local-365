import { useState, useEffect, useRef } from "react";
import { useEvents } from "@/hooks/use-events";
import { useBusinesses } from "@/hooks/use-businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { EventCard } from "@/components/EventCard";
import { IntakeForm } from "@/components/IntakeForm";
import { ItineraryBuilder } from "@/components/ItineraryBuilder";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { AdPlacement } from "@shared/schema";

interface AdWithBusiness extends AdPlacement {
  businessName: string | null;
  businessImageUrl: string | null;
}
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, MapPin, ArrowRight, Compass, Sparkles, Calendar, Search, UtensilsCrossed, Home as HomeIcon, Car, HeartPulse, Scissors, Building2, Scale, Landmark, GraduationCap, Dumbbell, ShoppingBag, PawPrint, PartyPopper, Sparkle, TreePine, Monitor, Truck, Bug, Camera, Baby, Shield, Plus, Send, Hammer, DoorOpen, Wrench, Fence, Waves, Droplets, Anchor, Megaphone, ChevronLeft, ChevronRight, Music, MapPinned, Film } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/LocationContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import heroImage from "@assets/image_1773172681995.png";

const DIRECTORY_CATEGORIES = [
  { name: "Animal & Pet", icon: PawPrint },
  { name: "Auto Detailing", icon: Car },
  { name: "Auto Repair", icon: Car },
  { name: "Baby Sitting & Nanny", icon: Baby },
  { name: "Baking & Cooking", icon: UtensilsCrossed },
  { name: "Beauty & Salon", icon: Scissors },
  { name: "Catering / Food Trucks", icon: Truck },
  { name: "Cleaning", icon: Sparkle },
  { name: "Concrete", icon: Building2 },
  { name: "Dock & Marine", icon: Anchor },
  { name: "Electrical", icon: Sparkles },
  { name: "Entertainment Locations", icon: MapPinned },
  { name: "Entertainment Services", icon: Music },
  { name: "Event Planning & Rentals", icon: PartyPopper },
  { name: "Fencing", icon: Fence },
  { name: "Fitness & Gym", icon: Dumbbell },
  { name: "Flooring", icon: HomeIcon },
  { name: "Garage Door", icon: DoorOpen },
  { name: "Health & Wellness", icon: HeartPulse },
  { name: "Home Repair", icon: Wrench },
  { name: "HVAC", icon: Sparkle },
  { name: "Insurance", icon: Shield },
  { name: "Landscaping", icon: TreePine },
  { name: "Lawn Care", icon: TreePine },
  { name: "Legal", icon: Scale },
  { name: "Metal Work", icon: Hammer },
  { name: "Moving & Hauling", icon: Truck },
  { name: "New Construction", icon: Building2 },
  { name: "Painting", icon: Hammer },
  { name: "Pest Control", icon: Bug },
  { name: "Photo & Video", icon: Camera },
  { name: "Plumbing", icon: Droplets },
  { name: "Pool & Spa", icon: Waves },
  { name: "Pressure Washing", icon: Waves },
  { name: "Printing", icon: Monitor },
  { name: "Real Estate / Realtors", icon: HomeIcon },
  { name: "Remodeling & Addition", icon: Building2 },
  { name: "Restaurants & Dining", icon: UtensilsCrossed },
  { name: "Roofing", icon: HomeIcon },
  { name: "Security Services", icon: Shield },
  { name: "Septic & Well", icon: Droplets },
  { name: "Shopping / Retail", icon: ShoppingBag },
  { name: "Small Engine Repair", icon: Wrench },
  { name: "Tax CPA", icon: Landmark },
  { name: "Trash & Junk Removal", icon: Truck },
  { name: "Tree Care", icon: TreePine },
  { name: "Tutor & Mentor Counseling", icon: GraduationCap },
  { name: "Web Design & Logo Design", icon: Monitor },
  { name: "Window Tinting", icon: Film },
  { name: "Windows & Doors", icon: DoorOpen },
  { name: "Woodworking", icon: Hammer },
];


export default function Home() {
  const { location: selectedLocation } = useLocation();
  const { data: recentReviews, isLoading: reviewsLoading } = useQuery<any[]>({ queryKey: ['/api/reviews/recent'] });
  const { data: businesses, isLoading: businessesLoading } = useBusinesses();
  const { data: events, isLoading: eventsLoading } = useEvents(selectedLocation?.zipCode);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTripPlanner, setShowTripPlanner] = useState(false);
  const [tripResult, setTripResult] = useState<any>(null);
  const [heroSearch, setHeroSearch] = useState("");
  const [showCategoryRequest, setShowCategoryRequest] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ categoryName: "", description: "", submitterName: "", submitterEmail: "" });

  const categoryRequestMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const res = await apiRequest("POST", "/api/category-requests", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Category Suggestion Submitted", description: "Thank you! We'll review your suggestion soon." });
      setShowCategoryRequest(false);
      setCategoryForm({ categoryName: "", description: "", submitterName: "", submitterEmail: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit suggestion. Please try again.", variant: "destructive" });
    }
  });

  const featuredBusinesses = businesses?.slice(0, 3) || [];
  const upcomingEvents = events?.slice(0, 3) || [];

  const [largeAdPos, setLargeAdPos] = useState(0);
  const [mediumAdPos, setMediumAdPos] = useState(0);
  const [smallAdPos, setSmallAdPos] = useState(0);
  const impressionsSent = useRef<Set<number>>(new Set());

  const LARGE_PLACEHOLDERS = [
    { id: 0, title: "Full-Service Home Repairs, Renovations & Emergency Calls", businessName: "Currituck Home Services", description: "Licensed and insured contractors serving Moyock and Currituck County. From emergency plumbing to full kitchen remodels — we do it all.", imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Custom Homes, Additions & Luxury Renovations", businessName: "Coastal Builders Inc.", description: "Award-winning construction company building dream homes across Currituck County. From blueprints to move-in day — your vision, our craftsmanship.", imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Coastal Roofing — Storm-Ready Solutions", businessName: "Currituck County Roofing", description: "GAF-certified roofing pros. Free storm damage inspections, insurance claim assistance, and 25-year warranties on every job.", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
  ];

  const MEDIUM_PLACEHOLDERS = [
    { id: 0, title: "24/7 Emergency HVAC & Plumbing", businessName: "Currituck Climate Control", description: "Same-day service from licensed technicians.", imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Mobile Mechanic — We Come to You", businessName: "Moyock Auto Pros", description: "On-site auto repair and diagnostics.", imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Professional Tree Care & Removal", businessName: "Coastal Tree Care", description: "Licensed arborists for trimming & removal.", imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Custom Kitchen Remodels", businessName: "Coastal Kitchen Co.", description: "Dream kitchens, expertly crafted.", imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
  ];

  const SMALL_PLACEHOLDERS = [
    { id: 0, title: "Lawn Care & Landscaping", businessName: "Green Thumb Lawn Care", description: "", imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Pest Control Experts", businessName: "Shield Pest Solutions", description: "", imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "House Cleaning Services", businessName: "Crystal Clean Moyock", description: "", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Pressure Washing", businessName: "Sparkle Wash OBX", description: "", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Gutter Installation", businessName: "Rain Guard Gutters", description: "", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
    { id: 0, title: "Window Cleaning", businessName: "Clear View Moyock", description: "", imageUrl: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  ];

  type AdSlide = { id: number; title: string; businessName: string; description: string; imageUrl: string; businessId: number | null; linkUrl: string | null };

  const locationZip = selectedLocation?.zipCode || "27958";

  const { data: realLargeAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "large_banner", locationZip],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=large_banner&zipCode=${locationZip}`); return res.ok ? res.json() : []; },
  });
  const { data: realMediumAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "medium_banner", locationZip],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=medium_banner&zipCode=${locationZip}`); return res.ok ? res.json() : []; },
  });
  const { data: realSmallAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "small_banner", locationZip],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=small_banner&zipCode=${locationZip}`); return res.ok ? res.json() : []; },
  });

  const mapAdsToSlides = (realAds: AdWithBusiness[] | undefined, placeholders: AdSlide[]): { slides: AdSlide[]; isPlaceholder: boolean } => {
    if (realAds && realAds.length > 0) {
      return {
        slides: realAds.map(ad => ({
          id: ad.id,
          title: ad.title,
          businessName: ad.businessName || ad.title,
          description: ad.description || "",
          imageUrl: ad.imageUrl || "",
          businessId: ad.businessId,
          linkUrl: ad.linkUrl,
        })),
        isPlaceholder: false,
      };
    }
    return { slides: placeholders, isPlaceholder: true };
  };

  const largeAds = mapAdsToSlides(realLargeAds, LARGE_PLACEHOLDERS);
  const mediumAds = mapAdsToSlides(realMediumAds, MEDIUM_PLACEHOLDERS);
  const smallAds = mapAdsToSlides(realSmallAds, SMALL_PLACEHOLDERS);

  const largePageCount = largeAds.slides.length;
  const mediumPageCount = Math.ceil(mediumAds.slides.length / 2);
  const smallPageCount = Math.ceil(smallAds.slides.length / 3);

  useEffect(() => {
    if (largePageCount === 0) return;
    const largeInterval = setInterval(() => setLargeAdPos(prev => (prev + 1) % largePageCount), 6000);
    const mediumInterval = setInterval(() => setMediumAdPos(prev => (prev + 1) % mediumPageCount), 5000);
    const smallInterval = setInterval(() => setSmallAdPos(prev => (prev + 1) % smallPageCount), 4000);
    return () => { clearInterval(largeInterval); clearInterval(mediumInterval); clearInterval(smallInterval); };
  }, [largePageCount, mediumPageCount, smallPageCount]);

  const trackImpression = (adId: number) => {
    if (adId > 0 && !impressionsSent.current.has(adId)) {
      impressionsSent.current.add(adId);
      fetch(`/api/ads/${adId}/impression`, { method: "POST" }).catch(() => {});
    }
  };

  useEffect(() => {
    const currentLarge = largeAds.slides[largeAdPos];
    if (currentLarge) trackImpression(currentLarge.id);
  }, [largeAdPos, largeAds.slides]);

  useEffect(() => {
    const startIdx = mediumAdPos * 2;
    for (let i = startIdx; i < startIdx + 2 && i < mediumAds.slides.length; i++) {
      trackImpression(mediumAds.slides[i].id);
    }
  }, [mediumAdPos, mediumAds.slides]);

  useEffect(() => {
    const startIdx = smallAdPos * 3;
    for (let i = startIdx; i < startIdx + 3 && i < smallAds.slides.length; i++) {
      trackImpression(smallAds.slides[i].id);
    }
  }, [smallAdPos, smallAds.slides]);

  const handleAdClick = (slide: AdSlide) => {
    if (slide.id > 0) {
      fetch(`/api/ads/${slide.id}/click`, { method: "POST" }).catch(() => {});
    }
    if (slide.businessId) {
      navigate(`/directory/${slide.businessId}`);
    } else if (slide.linkUrl) {
      window.open(slide.linkUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate("/advertising");
    }
  };

  const handleHeroSearch = () => {
    if (heroSearch.trim()) {
      navigate(`/directory?search=${encodeURIComponent(heroSearch.trim())}`);
    }
  };

  const handleTripPlanSubmit = (data: any) => {
    setTripResult(data);
    setShowTripPlanner(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Trip Planner Modal */}
      <Dialog open={showTripPlanner} onOpenChange={setShowTripPlanner}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Plan Your {selectedLocation.city} Trip</DialogTitle>
          </DialogHeader>
          <IntakeForm onSubmit={handleTripPlanSubmit} />
        </DialogContent>
      </Dialog>

      {/* Trip Result - Itinerary */}
      {tripResult && (
        <div className="bg-accent/10 border-b border-accent/20">
          <div className="container py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-xl">Your {selectedLocation.city} Itinerary is Ready!</h3>
                <p className="text-muted-foreground">
                  {tripResult.groupSize === '1' ? 'Solo trip' : tripResult.groupSize === '2' ? 'Couple trip' : `Group of ${tripResult.groupSize}`} 
                  {' '}to {tripResult.staying} for {tripResult.tripLength} days
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTripResult(null)}>
                Start Over
              </Button>
            </div>
            <ItineraryBuilder formData={tripResult} />
          </div>
        </div>
      )}

      {/* Hero Section with Image Background */}
      <section className="text-center py-20 relative overflow-hidden min-h-[650px] flex items-center">
        <img 
          src={heroImage}
          alt="Moyock and Currituck County local business directory"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 55%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60"></div>
        <div className="container relative z-10 max-w-3xl mx-auto px-4">
          {/* Value Proposition Badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <MapPin className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-medium">
              {selectedLocation.tagline || `Your Local Connection to ${selectedLocation.city}`}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight drop-shadow-lg">
            Find Trusted Local Pros in<br />
            <span className="text-[#d4a373]">{selectedLocation.name}</span>
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-white/95 font-medium drop-shadow-md max-w-2xl mx-auto">
            Connect with verified local businesses and discover events in {selectedLocation.city}.
          </p>
          <p className="text-base mb-8 text-white/80 max-w-xl mx-auto">
            Post a project and get competitive quotes from local contractors. Join the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center max-w-2xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input 
                type="text" 
                placeholder={`Search for services in ${selectedLocation.city}...`}
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleHeroSearch()}
                className="pl-12 pr-6 py-4 rounded-l-xl sm:rounded-l-xl sm:rounded-r-none rounded-xl w-full border-0 bg-white focus:ring-2 focus:ring-sand outline-none shadow-lg text-gray-800"
                data-testid="input-hero-search"
              />
            </div>
            <Button 
              size="lg" 
              onClick={handleHeroSearch}
              className="hidden sm:flex rounded-r-xl rounded-l-none bg-[#d4a373] text-white hover:bg-[#c49363] font-semibold px-8 h-[56px] shadow-lg"
              data-testid="button-hero-search"
            >
              <Search className="h-5 w-5 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
            <Link to="/events">
              <Button 
                size="lg" 
                className="rounded-full bg-sand text-primary-dark hover:bg-sand/90 font-semibold px-8 h-12 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[shadow,transform] duration-200"
                data-testid="button-local-events"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Local Events
              </Button>
            </Link>
            <Link to="/directory">
              <Button size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold px-8 h-12 shadow-lg" data-testid="button-explore-directory">
                <Compass className="mr-2 h-5 w-5" />
                Explore Directory
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 3-Tier Ad Carousels */}
      <div className="relative overflow-hidden py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#002147] via-[#0a3068] to-[#001a3a]" />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 22px)' }} />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#d4a373] via-white to-[#0a4a82]" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a4a82] via-white to-[#d4a373]" />
        
        <div className="container relative z-10">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl font-bold text-white">Featured Local Businesses</h2>
            <p className="text-white/70 mt-2">Premium advertising spots — <Link to="/advertising" className="text-[#d4a373] hover:underline font-semibold" data-testid="link-advertise-here">Advertise Here</Link></p>
          </div>

          {/* 3-Column Ad Layout: Large (left) | Medium (middle) | Small (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr_2fr] gap-5 items-start">

            {/* Large Ad Column — 1 ad visible at a time, crossfade */}
            <div>
              <div className="relative rounded-2xl shadow-2xl shadow-black/30 overflow-hidden max-h-[350px] lg:max-h-none" style={{ aspectRatio: '4/5' }}>
                {largeAds.slides.map((slide, idx) => (
                  <div key={slide.id > 0 ? slide.id : `lg-${idx}`} className={`absolute inset-0 transition-opacity duration-700 ${idx === largeAdPos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} data-testid={`ad-large-${idx}`}>
                    <div onClick={() => handleAdClick(slide)} className="block w-full h-full cursor-pointer">
                      <div className="relative w-full h-full overflow-hidden group">
                        <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 bg-amber-500 text-white font-bold rounded-full uppercase tracking-wide text-[10px] px-2.5 py-1">
                              <Sparkles className="h-3 w-3" />
                              {largeAds.isPlaceholder ? "Large — $500/mo" : "Sponsored"}
                            </span>
                            {largeAds.isPlaceholder && <span className="text-white/50 text-[10px]">Example</span>}
                          </div>
                          <p className="text-[#d4a373] text-sm font-semibold tracking-wide mb-1">{slide.businessName}</p>
                          <h3 className="text-lg md:text-2xl font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                          {slide.description && <p className="text-white/80 text-xs mt-2 leading-relaxed line-clamp-3">{slide.description}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {largeAds.slides.map((_, idx) => (
                  <button key={idx} onClick={() => setLargeAdPos(idx)} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === largeAdPos ? 'bg-[#d4a373] w-6' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-large-dot-${idx}`} />
                ))}
              </div>
            </div>

            {/* Medium Ad Column — 2 ads visible at a time, crossfade pages */}
            <div>
              <div className="relative rounded-xl shadow-lg shadow-black/20 overflow-hidden">
                {Array.from({ length: mediumPageCount }).map((_, pageIdx) => {
                  const pageSlides = mediumAds.slides.slice(pageIdx * 2, pageIdx * 2 + 2);
                  return (
                    <div key={`med-page-${pageIdx}`} className={`${pageIdx === 0 ? 'relative' : 'absolute inset-0'} transition-opacity duration-700 ${pageIdx === mediumAdPos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                      <div className="flex flex-col gap-3">
                        {pageSlides.map((slide, idx) => (
                          <div key={slide.id > 0 ? slide.id : `med-${pageIdx}-${idx}`} data-testid={`ad-medium-${pageIdx * 2 + idx}`}>
                            <div onClick={() => handleAdClick(slide)} className="block w-full cursor-pointer">
                              <div className="relative overflow-hidden rounded-xl group" style={{ aspectRatio: '5/3' }}>
                                <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-85 group-hover:scale-105 transition-all duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex items-center gap-1 bg-[#0a4a82] text-white font-bold rounded-full uppercase tracking-wide text-[9px] px-2 py-0.5">
                                      <Megaphone className="h-2.5 w-2.5" />
                                      {mediumAds.isPlaceholder ? "Medium — $250/mo" : "Sponsored"}
                                    </span>
                                  </div>
                                  <p className="text-[#d4a373] text-xs font-semibold tracking-wide mb-0.5">{slide.businessName}</p>
                                  <h3 className="text-sm md:text-base font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {Array.from({ length: mediumPageCount }).map((_, idx) => (
                  <button key={idx} onClick={() => setMediumAdPos(idx)} className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === mediumAdPos ? 'bg-[#d4a373] w-5' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-medium-dot-${idx}`} />
                ))}
              </div>
            </div>

            {/* Small Ad Column — 3 ads visible at a time, crossfade pages */}
            <div>
              <div className="relative rounded-lg shadow-md shadow-black/15 overflow-hidden">
                {Array.from({ length: smallPageCount }).map((_, pageIdx) => {
                  const pageSlides = smallAds.slides.slice(pageIdx * 3, pageIdx * 3 + 3);
                  return (
                    <div key={`sm-page-${pageIdx}`} className={`${pageIdx === 0 ? 'relative' : 'absolute inset-0'} transition-opacity duration-700 ${pageIdx === smallAdPos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                      <div className="flex flex-col gap-2">
                        {pageSlides.map((slide, idx) => (
                          <div key={slide.id > 0 ? slide.id : `sm-${pageIdx}-${idx}`} data-testid={`ad-small-${pageIdx * 3 + idx}`}>
                            <div onClick={() => handleAdClick(slide)} className="block w-full cursor-pointer">
                              <div className="relative overflow-hidden rounded-lg group" style={{ aspectRatio: '5/2' }}>
                                <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <span className="inline-flex items-center gap-1 bg-gray-600 text-white font-bold rounded-full uppercase tracking-wide text-[8px] px-1.5 py-0.5 mb-1">
                                    <Megaphone className="h-2 w-2" />
                                    {smallAds.isPlaceholder ? "$125/mo" : "Ad"}
                                  </span>
                                  <p className="text-[#d4a373] text-[10px] font-semibold tracking-wide">{slide.businessName}</p>
                                  <h3 className="text-xs font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-1.5 mt-3">
                {Array.from({ length: smallPageCount }).map((_, idx) => (
                  <button key={idx} onClick={() => setSmallAdPos(idx)} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === smallAdPos ? 'bg-[#d4a373] w-4' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-small-dot-${idx}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Browse by Category - Full Icon Grid */}
      <div className="bg-[#f5f0eb] py-12">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold text-[#1a1a2e]">Browse by Category</h2>
          <p className="text-[#555] mt-2">Find trusted local professionals in {selectedLocation.city}</p>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 md:gap-4">
          {[...DIRECTORY_CATEGORIES].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => {
            const IconComponent = cat.icon;
            return (
              <Link
                key={cat.name}
                to={`/directory?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 group"
                data-testid={`category-icon-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0a4a82] to-[#0d5a9e] flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:-translate-y-1 group-hover:from-[#d4a373] group-hover:to-[#c4936d] transition-all duration-200">
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
                <span className="text-[11px] md:text-xs font-semibold text-[#1a1a2e] group-hover:text-[#0a4a82] transition-colors text-center leading-tight max-w-[80px]">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex justify-center gap-3 mt-8">
          <Link to="/directory">
            <Button variant="outline" className="rounded-xl border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5" data-testid="button-view-all-categories">
              <Compass className="mr-2 h-4 w-4" />
              View Full Directory
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setShowCategoryRequest(true)}
            className="rounded-xl border-[#8a9a5b]/30 text-[#8a9a5b] hover:bg-[#8a9a5b]/5"
            data-testid="button-suggest-category"
          >
            <Plus className="mr-2 h-4 w-4" />
            Suggest a Category
          </Button>
        </div>
      </div>
      </div>

      {/* Category Suggestion Dialog */}
      <Dialog open={showCategoryRequest} onOpenChange={setShowCategoryRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#8a9a5b]" />
              Suggest a New Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Category Name</label>
              <Input
                placeholder="e.g., Pool Service & Maintenance"
                value={categoryForm.categoryName}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, categoryName: e.target.value }))}
                data-testid="input-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea
                placeholder="Briefly describe the types of services in this category..."
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-category-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Your Name (optional)</label>
              <Input
                placeholder="Your name"
                value={categoryForm.submitterName}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, submitterName: e.target.value }))}
                data-testid="input-category-submitter-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email (optional)</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={categoryForm.submitterEmail}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, submitterEmail: e.target.value }))}
                data-testid="input-category-submitter-email"
              />
            </div>
            <Button
              className="w-full bg-[#0a4a82] hover:bg-[#083d6b]"
              onClick={() => categoryRequestMutation.mutate(categoryForm)}
              disabled={!categoryForm.categoryName.trim() || categoryRequestMutation.isPending}
              data-testid="button-submit-category-request"
            >
              <Send className="h-4 w-4 mr-2" />
              {categoryRequestMutation.isPending ? "Submitting..." : "Submit Suggestion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Recent Reviews */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4 bg-white dark:bg-card rounded-xl px-4 py-3 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-foreground" data-testid="heading-recent-reviews">Recent Reviews</h2>
            <Link to="/directory" className="text-sm font-medium text-primary hover:underline flex items-center" data-testid="link-browse-directory">
              Browse Directory <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>

          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : !recentReviews?.length ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-lg mb-2">No reviews yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to review a local business!</p>
            </div>
          ) : (
            recentReviews.map((review: any) => (
              <Card key={review.id} className="overflow-hidden border-border/50 shadow-3d" data-testid={`review-card-${review.id}`}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={review.user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {review.user?.firstName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">
                            {review.user?.firstName} {review.user?.lastName}
                          </p>
                          <Link to={`/directory/${review.businessId}`} className="text-sm text-primary hover:underline font-medium" data-testid={`link-review-business-${review.id}`}>
                            {review.business?.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : 'Just now'}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon key={i} filled={i < review.rating} />
                          ))}
                        </div>
                      </div>
                      
                      <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {review.comment}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Featured Businesses */}
          <div className="bg-white/90 dark:bg-card/90 rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-foreground">Local Gems</h2>
              <Link to="/directory" className="text-sm font-medium text-primary hover:underline flex items-center">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </div>
            
            {businessesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-4">
                {featuredBusinesses.map(biz => (
                  <Link key={biz.id} to={`/directory/${biz.id}`}>
                    <div className="flex gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-[shadow,background-color,border-color] duration-200 cursor-pointer group">
                      <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                        {biz.imageUrl ? (
                          <img src={biz.imageUrl} alt={biz.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary/10">
                            <MapPin className="h-6 w-6 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{biz.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{biz.category}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex text-yellow-400">
                            <StarIcon filled />
                          </div>
                          <span className="text-xs font-medium">{Number(biz.averageRating).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="bg-white/90 dark:bg-card/90 rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-foreground">Upcoming Events</h2>
              <Link to="/events" className="text-sm font-medium text-primary hover:underline flex items-center">
                View Calendar <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </div>

            {eventsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
