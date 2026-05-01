import { useState, useEffect } from "react";
import { useEvents } from "@/hooks/use-events";
import { useBusinesses } from "@/hooks/use-businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { EventCard } from "@/components/EventCard";
import { AdCarousel } from "@/components/AdCarousel";
import { GrowthPromoSection } from "@/components/GrowthPromoSection";
import { IntakeForm } from "@/components/IntakeForm";
import { ItineraryBuilder } from "@/components/ItineraryBuilder";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
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
import promoVideo from "@assets/hf_20260422_184333_74bafff4-441e-4310-aa8c-c391066e1f4b_1777632767836.mp4";
import { ExampleBanner } from "@/components/ExampleBanner";
import { BUSINESS_CATEGORIES } from "@shared/config/categories";
import { LocationSearchInput } from "@/components/LocationSearchInput";
import { usePageMeta } from "@/hooks/use-page-meta";
import { pageTitle, metaDescription, regionLabel } from "@/lib/regionCopy";

const ICON_MAP: Record<string, any> = {
  UtensilsCrossed, Home: HomeIcon, Car, HeartPulse, Scissors, Building2, Scale, Landmark,
  GraduationCap, Dumbbell, ShoppingBag, PawPrint, PartyPopper, SparkleIcon: Sparkle,
  TreePine, Monitor, Plane: Compass, Truck, Bug, Camera, Church: Landmark, Baby, Shield,
  DoorOpen, Hammer, Fence, Music, MapPin: MapPinned, Wrench, Droplets, Waves, Anchor,
  Megaphone, Film,
};

const DIRECTORY_CATEGORIES = BUSINESS_CATEGORIES.map(cat => ({
  name: cat.name,
  icon: ICON_MAP[cat.icon] || Sparkle,
}));


export default function Home() {
  const { location: selectedLocation, isLocationSet } = useLocation();
  usePageMeta(pageTitle(selectedLocation), metaDescription(selectedLocation));
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

  const featuredBusinesses = (
    selectedLocation?.zipCode
      ? businesses?.filter((b) => b.zipCode === selectedLocation.zipCode)
      : businesses
  )?.slice(0, 3) || [];
  const upcomingEvents = events?.slice(0, 3) || [];

  const locationZip = selectedLocation?.zipCode || "";

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

      {/* Hero Section — Zillow-style: location-first, then services search.
          When the user hasn't picked a location yet (`!isLocationSet`), the
          location search is the only input. Once a location is set, the
          services search appears with dynamic per-region copy. */}
      <section className="text-center py-20 relative min-h-[650px] flex items-center isolate">
        <div className="absolute inset-0 overflow-hidden -z-10">
          <img
            src={heroImage}
            alt={`Local business directory for ${selectedLocation.city}, ${selectedLocation.state}`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "center 55%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60"></div>
        </div>
        <div className="container relative z-10 max-w-3xl mx-auto px-4">
          {/* Value Proposition Badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <MapPin className="h-4 w-4 text-white" />
            <span className="text-white text-sm font-medium">
              {isLocationSet
                ? selectedLocation.tagline || `Your local connection to ${regionLabel(selectedLocation)}`
                : "Now serving 41 zip codes across NC & VA"}
            </span>
          </div>

          {!isLocationSet ? (
            <>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight drop-shadow-lg">
                Where do you need
                <br />
                <span className="text-[#d4a373]">a local pro?</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-white/95 font-medium drop-shadow-md max-w-2xl mx-auto">
                Enter your town or zip to see verified businesses, events, and reviews near you.
              </p>
              <LocationSearchInput placeholder="Enter your town or zip…" autoFocus />
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight drop-shadow-lg">
                Find Trusted Local Pros in
                <br />
                <span className="text-[#d4a373]">{selectedLocation.name}</span>
              </h1>
              <p className="text-xl md:text-2xl mb-4 text-white/95 font-medium drop-shadow-md max-w-2xl mx-auto">
                Connect with verified local businesses and discover events in {selectedLocation.city}.
              </p>
              <p className="text-base mb-8 text-white/90 max-w-xl mx-auto">
                Post a project and get competitive quotes from local contractors. Join the community.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center max-w-2xl mx-auto">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search for services in ${selectedLocation.city}…`}
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
              <div className="mt-4 max-w-2xl mx-auto">
                <details className="group">
                  <summary className="text-sm text-white/80 hover:text-white cursor-pointer inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Change location
                  </summary>
                  <div className="mt-3">
                    <LocationSearchInput placeholder="Search another town or zip…" variant="hero" />
                  </div>
                </details>
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
            </>
          )}
        </div>
      </section>

      {/* 3-Tier Ad Carousels */}
      <AdCarousel zipCode={locationZip} />

      {/* Promo Video */}
      <section className="bg-gradient-to-b from-[#f5f0eb] to-white py-12 md:py-16" data-testid="section-promo-video">
        <div className="container">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#0a4a82]">
              See Local List 365 in Action
            </h2>
            <p className="text-[#555] mt-2 max-w-2xl mx-auto">
              A quick look at how neighbors connect with the businesses, events, and
              local pros that make Currituck County feel like home.
            </p>
          </div>
          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(10,74,130,0.25)] ring-1 ring-[#0a4a82]/10 bg-black">
            <video
              src={promoVideo}
              controls
              playsInline
              preload="metadata"
              className="w-full h-auto block"
              data-testid="video-home-promo"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Growth: Refer & Earn + Founding Member 100 */}
      <GrowthPromoSection />

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
              <MessageCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-medium text-lg text-[#1a1a2e] mb-2">No reviews yet</h3>
              <p className="text-slate-500 mb-6">Be the first to review a local business!</p>
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
                          <p className="text-xs text-slate-500 mt-0.5">
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
                    <div className="flex gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-[shadow,background-color,border-color] duration-200 cursor-pointer group relative">
                      {biz.isExample && (
                        <div className="absolute top-1 right-1 z-10 bg-orange-500 text-white text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded shadow" data-testid={`badge-example-gem-${biz.id}`}>
                          Example
                        </div>
                      )}
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
                        <p className="text-xs text-slate-500 truncate">{biz.category}</p>
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
