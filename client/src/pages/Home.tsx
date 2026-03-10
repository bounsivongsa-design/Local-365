import { useState, useRef, useEffect, useCallback } from "react";
import { usePosts, useLikePost } from "@/hooks/use-posts";
import { useEvents } from "@/hooks/use-events";
import { useBusinesses } from "@/hooks/use-businesses";
import { CreatePostForm } from "@/components/CreatePostForm";
import { BusinessCard } from "@/components/BusinessCard";
import { EventCard } from "@/components/EventCard";
import { IntakeForm } from "@/components/IntakeForm";
import { ItineraryBuilder } from "@/components/ItineraryBuilder";
import { AdBanner } from "@/components/AdBanner";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Share2, MapPin, ArrowRight, Compass, Sparkles, Calendar, Search, UtensilsCrossed, Home as HomeIcon, Car, HeartPulse, Scissors, Building2, Scale, Landmark, GraduationCap, Dumbbell, ShoppingBag, PawPrint, PartyPopper, Sparkle, TreePine, Monitor, Plane, Truck, Bug, Camera, Church, Baby, Shield, Plus, Send, Hammer, DoorOpen, Wrench, Fence, Waves, Droplets, Anchor, Megaphone, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/LocationContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import heroImage from "@assets/image_1770062898655.png";

const DIRECTORY_CATEGORIES = [
  { name: "Home Repair", icon: Wrench },
  { name: "Plumbing", icon: Droplets },
  { name: "HVAC", icon: Sparkle },
  { name: "Electrical", icon: Sparkles },
  { name: "Roofing", icon: HomeIcon },
  { name: "Landscaping", icon: TreePine },
  { name: "Lawn Care", icon: TreePine },
  { name: "Cleaning", icon: Sparkle },
  { name: "Painting", icon: Hammer },
  { name: "Tree Care", icon: TreePine },
  { name: "Concrete", icon: Building2 },
  { name: "Flooring", icon: HomeIcon },
  { name: "Remodeling & Addition", icon: Building2 },
  { name: "New Construction", icon: Building2 },
  { name: "Windows & Doors", icon: DoorOpen },
  { name: "Pressure Washing", icon: Waves },
  { name: "Garage Door", icon: DoorOpen },
  { name: "Fencing", icon: Fence },
  { name: "Pool & Spa", icon: Waves },
  { name: "Septic & Well", icon: Droplets },
  { name: "Auto Repair", icon: Car },
  { name: "Small Engine Repair", icon: Wrench },
  { name: "Dock & Marine", icon: Anchor },
  { name: "Metal Work", icon: Hammer },
  { name: "Woodworking", icon: Hammer },
  { name: "Restaurants & Dining", icon: UtensilsCrossed },
  { name: "Baking & Cooking", icon: UtensilsCrossed },
  { name: "Catering Food Trucks", icon: Truck },
  { name: "Beauty & Salon", icon: Scissors },
  { name: "Health & Wellness", icon: HeartPulse },
  { name: "Fitness & Gym", icon: Dumbbell },
  { name: "Animal & Pet", icon: PawPrint },
  { name: "Pest Control", icon: Bug },
  { name: "Baby Sitting & Nanny", icon: Baby },
  { name: "Tutor & Mentor Counseling", icon: GraduationCap },
  { name: "Event Planning & Rentals", icon: PartyPopper },
  { name: "Photo & Video", icon: Camera },
  { name: "Printing", icon: Monitor },
  { name: "Web Design & Logo Design", icon: Monitor },
  { name: "Real Estate / Realtors", icon: HomeIcon },
  { name: "Insurance", icon: Shield },
  { name: "Tax CPA", icon: Landmark },
  { name: "Legal", icon: Scale },
  { name: "Security Services", icon: Shield },
  { name: "Moving & Hauling", icon: Truck },
  { name: "Trash & Junk Removal", icon: Truck },
  { name: "Shopping / Retail", icon: ShoppingBag },
];

export default function Home() {
  const { data: posts, isLoading: postsLoading } = usePosts();
  const { data: businesses, isLoading: businessesLoading } = useBusinesses();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const likePost = useLikePost();
  const { isAuthenticated } = useAuth();
  const { location: selectedLocation } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTripPlanner, setShowTripPlanner] = useState(false);
  const [tripResult, setTripResult] = useState<any>(null);
  const [heroSearch, setHeroSearch] = useState("");
  const [showCategoryRequest, setShowCategoryRequest] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
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

  const adCarouselRef = useRef<HTMLDivElement>(null);
  const [adScrollPos, setAdScrollPos] = useState(0);

  const AD_SLIDES: { size: "small" | "medium" | "large"; price: string; title: string; business: string; description: string; image: string; link: string }[] = [
    { size: "large", price: "$2,000/mo", title: "Full-Service Home Repairs, Renovations & Emergency Calls", business: "Currituck Home Services", description: "Licensed and insured contractors serving Moyock and Currituck County. From emergency plumbing to full kitchen remodels — we do it all. Call today for a free estimate.", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop", link: "/advertising" },
    { size: "medium", price: "$1,000/mo", title: "24/7 Emergency HVAC & Plumbing", business: "OBX Climate Control", description: "Same-day service from licensed technicians. Serving Moyock & surrounding areas.", image: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=600&h=300&fit=crop", link: "/advertising" },
    { size: "small", price: "$500/mo", title: "Lawn Care & Landscaping", business: "Green Thumb Lawn Care", description: "Weekly mowing and seasonal cleanups.", image: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=200&fit=crop", link: "/advertising" },
    { size: "large", price: "$2,000/mo", title: "Custom Homes, Additions & Luxury Renovations", business: "Coastal Builders Inc.", description: "Award-winning construction company building dream homes across the OBX region. From blueprints to move-in day — your vision, our craftsmanship. Free consultations available.", image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=400&fit=crop", link: "/advertising" },
    { size: "medium", price: "$1,000/mo", title: "Mobile Mechanic — We Come to You", business: "Moyock Auto Pros", description: "On-site auto repair and diagnostics. Certified mechanics at your door.", image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=300&fit=crop", link: "/advertising" },
    { size: "small", price: "$500/mo", title: "Pest Control", business: "Shield Pest Solutions", description: "Termite inspections & mosquito treatments.", image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=200&fit=crop", link: "/advertising" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAdScrollPos(prev => (prev + 1) % AD_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [AD_SLIDES.length]);

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

      {/* Featured Businesses Ad Carousel */}
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
          <div className="relative max-w-4xl mx-auto">
            <div ref={adCarouselRef} className="overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${adScrollPos * 100}%)` }}
              >
                {AD_SLIDES.map((slide, idx) => {
                  const sizeStyles = {
                    large: { aspect: "aspect-[2.5/1] md:aspect-[3/1]", titleClass: "text-xl md:text-3xl", showDesc: true, showImage: true, padding: "p-8 md:p-12", badgeColor: "bg-amber-500" },
                    medium: { aspect: "aspect-[3/1] md:aspect-[4/1]", titleClass: "text-lg md:text-2xl", showDesc: true, showImage: true, padding: "p-6 md:p-10", badgeColor: "bg-[#0a4a82]" },
                    small: { aspect: "aspect-[4/1] md:aspect-[5/1]", titleClass: "text-base md:text-lg", showDesc: false, showImage: true, padding: "p-5 md:p-8", badgeColor: "bg-gray-600" },
                  };
                  const s = sizeStyles[slide.size];
                  return (
                    <Link
                      key={idx}
                      to={slide.link}
                      className="w-full flex-shrink-0"
                      data-testid={`ad-slide-${idx}`}
                    >
                      <div className={`relative ${s.aspect} overflow-hidden rounded-2xl group cursor-pointer`}>
                        {s.showImage && (
                          <img
                            src={slide.image}
                            alt={slide.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                        <div className={`relative h-full flex flex-col justify-center ${s.padding}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`inline-flex items-center gap-1.5 ${s.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide`}>
                              {slide.size === "large" && <Sparkles className="h-3 w-3" />}
                              {slide.size === "medium" && <Megaphone className="h-3 w-3" />}
                              {slide.size === "small" && <Megaphone className="h-3 w-3" />}
                              {slide.size} Ad — {slide.price}
                            </span>
                            <span className="text-white/50 text-xs hidden sm:inline">Example</span>
                          </div>
                          <p className="text-[#d4a373] text-sm font-semibold mb-1 tracking-wide">{slide.business}</p>
                          <h3 className={`${s.titleClass} font-bold text-white mb-1 drop-shadow-md max-w-xl leading-tight`}>{slide.title}</h3>
                          {s.showDesc && (
                            <p className="text-white/80 text-sm md:text-base max-w-lg mt-1 hidden sm:block leading-relaxed">{slide.description}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setAdScrollPos(prev => (prev - 1 + AD_SLIDES.length) % AD_SLIDES.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              data-testid="ad-carousel-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setAdScrollPos(prev => (prev + 1) % AD_SLIDES.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              data-testid="ad-carousel-next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="flex justify-center gap-2 mt-4">
              {AD_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setAdScrollPos(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === adScrollPos ? 'bg-[#d4a373] w-6' : 'bg-white/40 hover:bg-white/60'}`}
                  data-testid={`ad-dot-${idx}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Directory Category Dropdown */}
      <div className="container pt-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold text-foreground">Browse by Category</h2>
          <p className="text-muted-foreground mt-2">Find trusted local professionals in {selectedLocation.city}</p>
        </div>
        <div className="max-w-lg mx-auto space-y-4">
          <div className="relative">
            <button
              onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setCategorySearch(""); }}
              className="w-full h-14 pl-12 pr-12 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-base shadow-sm hover:shadow-md hover:border-[#0a4a82]/30 focus:outline-none focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] cursor-pointer transition-all text-left"
              data-testid="select-category-dropdown"
            >
              <Compass className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0a4a82]" />
              <span className="text-gray-400">Select a category...</span>
              <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {categoryDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCategoryDropdownOpen(false)} />
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
                  <div className="p-3 border-b border-gray-100 dark:border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a4a82]/30"
                        autoFocus
                        data-testid="input-category-search"
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {[...DIRECTORY_CATEGORIES]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((cat, idx) => {
                        const IconComponent = cat.icon;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setCategoryDropdownOpen(false);
                              navigate(`/directory?category=${encodeURIComponent(cat.name)}`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#0a4a82]/5 dark:hover:bg-slate-700 transition-colors text-left"
                            data-testid={`category-option-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0d5a9e] flex items-center justify-center flex-shrink-0">
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{cat.name}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-center gap-3">
            <Link to="/directory">
              <Button variant="outline" className="rounded-xl border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5" data-testid="button-view-all-categories">
                <Compass className="mr-2 h-4 w-4" />
                View All Categories
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

      {/* Promo Banner */}
      <div className="container pt-12">
        <Link to="/romantic-getaway">
          <div className="bg-primary text-white p-6 rounded-lg shadow-3d-lg hover:shadow-xl transition-shadow cursor-pointer" data-testid="promo-banner">
            <h3 className="text-2xl font-bold mb-2">Romantic Winter Getaway</h3>
            <p className="mb-4 text-white/90">Cozy fireplaces, quiet beaches, 40% off — escape the cold!</p>
            <Button className="bg-sand text-primary-dark hover:bg-sand/80 font-semibold">
              Learn More
            </Button>
          </div>
        </Link>
      </div>

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4 bg-white dark:bg-card rounded-xl px-4 py-3 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-foreground">Community Feed</h2>
            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">
              Latest Updates
            </Button>
          </div>

          <CreatePostForm />

          {postsLoading ? (
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
          ) : posts?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to share something with the community!</p>
            </div>
          ) : (
            posts?.map((post) => (
              <Card key={post.id} className="overflow-hidden border-border/50 shadow-3d">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={post.author.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {post.author.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">
                            {post.author.firstName} {post.author.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                      
                      <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {post.imageUrl && (
                        <div className="mt-4 rounded-xl overflow-hidden">
                          <img src={post.imageUrl} alt="Post content" className="w-full h-auto max-h-[400px] object-cover" />
                        </div>
                      )}

                      <div className="flex items-center gap-6 mt-6 pt-4 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors px-2"
                          onClick={() => isAuthenticated && likePost.mutate(post.id)}
                          disabled={!isAuthenticated}
                        >
                          <Heart className={`h-4 w-4 mr-2 ${post.likes && post.likes > 0 ? "fill-red-500 text-red-500" : ""}`} />
                          {post.likes || 0} Likes
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 px-2">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Comment
                        </Button>
                        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-primary hover:bg-primary/5 px-2">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
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
