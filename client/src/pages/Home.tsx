import { useState } from "react";
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
import { Heart, MessageCircle, Share2, MapPin, ArrowRight, Compass, Sparkles, Calendar, Search, UtensilsCrossed, Home as HomeIcon, Car, HeartPulse, Scissors, Building2, Scale, Landmark, GraduationCap, Dumbbell, ShoppingBag, PawPrint, PartyPopper, Sparkle, TreePine, Monitor, Plane, Truck, Bug, Camera, Church, Baby, Shield, Plus, Send, Hammer, DoorOpen, Wrench, Fence } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/LocationContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BUSINESS_CATEGORIES } from "@shared/config/categories";
import heroImage from "@assets/image_1770062898655.png";

const CATEGORY_ICONS: Record<string, any> = {
  "restaurants-dining": UtensilsCrossed,
  "home-services": HomeIcon,
  "automotive": Car,
  "health-wellness": HeartPulse,
  "beauty-personal-care": Scissors,
  "real-estate": Building2,
  "legal-services": Scale,
  "financial-services": Landmark,
  "education-tutoring": GraduationCap,
  "fitness-recreation": Dumbbell,
  "shopping-retail": ShoppingBag,
  "pet-services": PawPrint,
  "wedding-events": PartyPopper,
  "cleaning-services": Sparkle,
  "landscaping": TreePine,
  "technology": Monitor,
  "travel-tourism": Plane,
  "moving-storage": Truck,
  "pest-control": Bug,
  "photography": Camera,
  "religious-spiritual": Church,
  "government-nonprofit": Landmark,
  "child-care": Baby,
  "security-services": Shield,
  "animal-pet": PawPrint,
  "garage-door": DoorOpen,
  "moving-hauling": Truck,
  "metal-work": Hammer,
  "fencing": Fence,
  "woodworking": Wrench,
};

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
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
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
            Connect with verified local businesses, discover events, and earn rewards for shopping local in {selectedLocation.city}.
          </p>
          <p className="text-base mb-8 text-white/80 max-w-xl mx-auto">
            Post a project and get competitive quotes from local contractors. Earn loyalty points with every purchase. Join 500+ community members.
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
                className="pl-12 pr-6 py-4 rounded-l-xl sm:rounded-l-xl sm:rounded-r-none rounded-xl w-full border-0 bg-white/95 backdrop-blur-sm focus:ring-2 focus:ring-sand outline-none transition-all shadow-lg text-gray-800"
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
                className="rounded-full bg-sand text-primary-dark hover:bg-sand/90 font-semibold px-8 h-12 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                data-testid="button-local-events"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Local Events
              </Button>
            </Link>
            <Link to="/directory">
              <Button size="lg" className="rounded-full bg-white/90 backdrop-blur-sm text-primary hover:bg-white font-semibold px-8 h-12 shadow-lg" data-testid="button-explore-directory">
                <Compass className="mr-2 h-5 w-5" />
                Explore Directory
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Video Showcase Section */}
      <div className="container pt-12">
        <h2 className="font-display text-2xl font-bold mb-6 text-center">Experience {selectedLocation.city}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-3d-lg group">
            <video 
              autoPlay muted loop playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            >
              <source src="/videos/coastal-views.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">Coastal Views</span>
          </div>
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-3d-lg group">
            <video 
              autoPlay muted loop playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            >
              <source src="/videos/video-2.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">Beach Life</span>
          </div>
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-3d-lg group">
            <video 
              autoPlay muted loop playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            >
              <source src="/videos/video-3.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">Local Adventures</span>
          </div>
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-3d-lg group">
            <video 
              autoPlay muted loop playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            >
              <source src="/videos/video-4.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">Sunset Magic</span>
          </div>
          <div className="relative rounded-xl overflow-hidden aspect-video shadow-3d-lg group">
            <video 
              autoPlay muted loop playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            >
              <source src="/videos/video-5.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <span className="absolute bottom-3 left-3 text-white font-semibold text-sm">Wild Horses</span>
          </div>
        </div>
      </div>

      {/* Directory Category Icons Grid */}
      <div className="container pt-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold text-foreground">Browse by Category</h2>
          <p className="text-muted-foreground mt-2">Find trusted local professionals in {selectedLocation.city}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {BUSINESS_CATEGORIES.map((cat) => {
            const IconComponent = CATEGORY_ICONS[cat.id] || Compass;
            return (
              <Link key={cat.id} to={`/directory?category=${encodeURIComponent(cat.name)}`}>
                <div
                  className="relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 dark:from-card dark:to-card/60 border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_12px_40px_rgba(10,74,130,0.15),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 active:translate-y-0 transition-all duration-300 cursor-pointer group overflow-hidden"
                  data-testid={`category-icon-${cat.id}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82]/0 via-transparent to-[#d4a373]/0 group-hover:from-[#0a4a82]/5 group-hover:to-[#d4a373]/5 transition-all duration-300 rounded-2xl" />
                  <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-[#0a4a82] to-[#0d5a9e] flex items-center justify-center shadow-[0_4px_12px_rgba(10,74,130,0.3)] group-hover:shadow-[0_6px_20px_rgba(10,74,130,0.4)] group-hover:scale-110 transition-all duration-300">
                    <IconComponent className="h-7 w-7 text-white drop-shadow-sm" />
                  </div>
                  <span className="relative text-sm font-semibold text-center text-gray-700 dark:text-gray-200 group-hover:text-[#0a4a82] transition-colors duration-300 leading-tight">{cat.name}</span>
                </div>
              </Link>
            );
          })}
          <button
            onClick={() => setShowCategoryRequest(true)}
            className="relative flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 dark:from-card dark:to-card/60 border-2 border-dashed border-[#8a9a5b]/40 shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-[#8a9a5b]/70 hover:shadow-[0_12px_40px_rgba(138,154,91,0.15),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 active:translate-y-0 transition-all duration-300 cursor-pointer group overflow-hidden"
            data-testid="button-suggest-category"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#8a9a5b]/0 to-[#8a9a5b]/0 group-hover:from-[#8a9a5b]/5 group-hover:to-[#8a9a5b]/10 transition-all duration-300 rounded-2xl" />
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-[#8a9a5b] to-[#6b7a45] flex items-center justify-center shadow-[0_4px_12px_rgba(138,154,91,0.3)] group-hover:shadow-[0_6px_20px_rgba(138,154,91,0.4)] group-hover:scale-110 transition-all duration-300">
              <Plus className="h-7 w-7 text-white drop-shadow-sm" />
            </div>
            <span className="relative text-sm font-semibold text-center text-[#8a9a5b] group-hover:text-[#6b7a45] transition-colors duration-300 leading-tight">Suggest a Category</span>
          </button>
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

      {/* Sponsored Banner Ad */}
      <div className="container pt-12">
        <AdBanner placementType="homepage_banner" className="mb-6" />
        
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

      {/* Loyalty Program Promo */}
      <div className="container pt-6">
        <Link to="/loyalty">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white p-6 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:shadow-xl transition-shadow cursor-pointer" data-testid="promo-loyalty">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1">Currituck Insider Loyalty Program</h3>
                <p className="text-white/90">Earn up to 20% off your bookings! Unlock exclusive rewards with every stay.</p>
              </div>
              <ArrowRight className="h-6 w-6 text-white/80" />
            </div>
          </div>
        </Link>
      </div>

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4 bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm">
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
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
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
                    <div className="flex gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-all cursor-pointer group">
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
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
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
