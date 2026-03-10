import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Clock, 
  MapPin, 
  DollarSign, 
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Gavel,
  Send,
  Waves,
  Star,
  Trophy,
  Users,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Zap,
  Phone,
  Mail,
  Shield,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { QuoteRequest } from "@shared/models/auth";

interface CustomerInfo {
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  customerRating: string | null;
  projectsCompleted: number | null;
  totalSpent: string | null;
}

interface CustomerContact {
  phone: string | null;
  email: string | null;
}

interface EnrichedQuoteRequest extends QuoteRequest {
  customer: CustomerInfo | null;
  customerContact: CustomerContact | null;
  quoteCount: number;
  lowestQuote: number | null;
  hasPriorityAccess: boolean;
  priorityExpiresAt: string | null;
  isEmergency: boolean;
  responseWindowHours: number;
}

interface QuoteWithBusiness {
  id: number;
  requestId: number;
  businessId: number;
  amount: string;
  message: string;
  estimatedDuration: string | null;
  status: string | null;
  createdAt: Date | null;
  business: {
    id: number;
    name: string;
    imageUrl: string;
    category: string;
    verified: boolean | null;
  } | null;
}

const CATEGORIES = [
  "Home Repair", "Plumbing", "HVAC", "Electrical", "Roofing",
  "Landscaping", "Cleaning", "Painting", "Tree Care", "Remodeling & Addition",
  "New Construction", "Baby Sitting & Nanny", "Printing", "Web Design & Logo Design",
  "Photo & Video", "Auto Repair", "Small Engine Repair", "Trash & Junk Removal",
  "Tutor & Mentor Counseling", "Health & Wellness", "Tax CPA", "Legal",
  "Concrete", "Lawn Care", "Dog Sitting", "Real Estate / Realtors",
  "Shopping / Retail", "Food & Drink",
  "Woodworking", "Baking & Cooking", "Catering Food Trucks", "Event Planning & Rentals",
  "Animal & Pet", "Garage Door", "Moving & Hauling", "Metal Work", "Fencing"
];

const TIMELINES = [
  "ASAP",
  "Within a week",
  "Within a month",
  "Within 3 months",
  "Flexible"
];

const BUDGETS = [
  "Under $100",
  "$100 - $500",
  "$500 - $1,000",
  "$1,000 - $5,000",
  "$5,000 - $10,000",
  "$10,000+",
  "Not sure yet"
];

export default function QuoteRequests() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [quoteFormData, setQuoteFormData] = useState({
    amount: "",
    message: "",
    estimatedDuration: ""
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    budget: "",
    timeline: "",
    location: ""
  });
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  const { data: allRequests, isLoading: allLoading } = useQuery<EnrichedQuoteRequest[]>({
    queryKey: ["/api/quotes/requests"],
  });

  // Get quotes for expanded project
  const { data: projectQuotes, isLoading: quotesLoading } = useQuery<QuoteWithBusiness[]>({
    queryKey: ["/api/quotes/requests", expandedProject, "quotes"],
    queryFn: async () => {
      if (!expandedProject) return [];
      const res = await fetch(`/api/quotes/requests/${expandedProject}/quotes`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    enabled: expandedProject !== null && isAuthenticated,
  });

  const getCustomerRatingBadge = (rating: string | null) => {
    const numRating = rating ? parseFloat(rating) : 5.0;
    if (numRating >= 4.5) return { label: "Excellent", color: "bg-green-500/10 text-green-600 border-green-500/20", stars: 5 };
    if (numRating >= 4.0) return { label: "Great", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", stars: 4 };
    if (numRating >= 3.5) return { label: "Good", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", stars: 3 };
    if (numRating >= 3.0) return { label: "Average", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", stars: 3 };
    return { label: "New", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", stars: 0 };
  };

  const { data: myRequests, isLoading: myLoading } = useQuery({
    queryKey: ["/api/user/quote-requests"],
    enabled: isAuthenticated,
  });

  const createRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/quotes/requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/quote-requests"] });
      toast({
        title: "Request Posted!",
        description: "Local businesses will start submitting quotes soon.",
      });
      setIsCreateOpen(false);
      setFormData({ title: "", description: "", category: "", budget: "", timeline: "", location: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitQuote = useMutation({
    mutationFn: async (data: { requestId: number; amount: string; message: string; estimatedDuration: string }) => {
      const res = await apiRequest("POST", `/api/quotes/requests/${data.requestId}/quotes`, {
        amount: parseFloat(data.amount),
        message: data.message,
        estimatedDuration: data.estimatedDuration
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests"] });
      toast({
        title: "Quote Submitted!",
        description: "The customer will review your quote and get back to you.",
      });
      setIsQuoteDialogOpen(false);
      setQuoteFormData({ amount: "", message: "", estimatedDuration: "" });
      setSelectedRequestId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to submit quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.category) {
      toast({
        title: "Missing information",
        description: "Please fill in the title, description, and category.",
        variant: "destructive",
      });
      return;
    }
    createRequest.mutate(formData);
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteFormData.amount || !quoteFormData.message || !selectedRequestId) {
      toast({
        title: "Missing information",
        description: "Please fill in the quote amount and message.",
        variant: "destructive",
      });
      return;
    }
    submitQuote.mutate({
      requestId: selectedRequestId,
      ...quoteFormData
    });
  };

  const openQuoteDialog = (requestId: number) => {
    setSelectedRequestId(requestId);
    setIsQuoteDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Open for Quotes</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#1a5a92] to-muted/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute bottom-0 w-full h-32" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path fill="white" d="M0,60L48,65C96,70,192,80,288,75C384,70,480,50,576,45C672,40,768,50,864,55C960,60,1056,60,1152,55C1248,50,1344,40,1392,35L1440,30L1440,120L0,120Z"/>
          </svg>
        </div>
        
        <div className="container py-16 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Gavel className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Get Competitive Quotes</h1>
              <p className="text-white/80 mt-1">Post your project and let local businesses compete for your business</p>
            </div>
          </div>
          
          {isAuthenticated && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="mt-6 bg-[#d4a373] hover:bg-[#c4936d] text-white shadow-lg" data-testid="button-create-request">
                  <Plus className="mr-2 h-5 w-5" />
                  Post a Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Gavel className="h-6 w-6 text-[#0a4a82]" />
                    Post Your Project
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Deck Repair Needed"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      data-testid="input-project-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Describe Your Project</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide details about what you need done..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="input-project-description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget Range</Label>
                      <Select value={formData.budget} onValueChange={(v) => setFormData({ ...formData, budget: v })}>
                        <SelectTrigger data-testid="select-budget">
                          <SelectValue placeholder="Select budget" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGETS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeline">Timeline</Label>
                      <Select value={formData.timeline} onValueChange={(v) => setFormData({ ...formData, timeline: v })}>
                        <SelectTrigger data-testid="select-timeline">
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMELINES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location (optional)</Label>
                    <Input
                      id="location"
                      placeholder="e.g., Corolla, NC"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      data-testid="input-project-location"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-[#0a4a82] hover:bg-[#093d6b]"
                    disabled={createRequest.isPending}
                    data-testid="button-submit-project"
                  >
                    {createRequest.isPending ? "Posting..." : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Post Project & Get Quotes
                      </>
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* My Requests (if authenticated) */}
          {isAuthenticated && (
            <div className="lg:col-span-1">
              <Card className="sticky top-28">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#0a4a82]" />
                    My Projects
                  </CardTitle>
                  <CardDescription>Track your quote requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {myLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (myRequests as QuoteRequest[])?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No projects yet</p>
                      <p className="text-xs mt-1">Post your first project above!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(myRequests as QuoteRequest[])?.map((req) => (
                        <div key={req.id} className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h4 className="font-medium text-sm line-clamp-1">{req.title}</h4>
                            {getStatusBadge(req.status || "open")}
                          </div>
                          <p className="text-xs text-muted-foreground">{req.category}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* All Open Requests */}
          <div className={isAuthenticated ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Open Projects</h2>
              <Badge variant="outline" className="text-sm">
                {(allRequests as QuoteRequest[])?.length || 0} active
              </Badge>
            </div>

            {allLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-3" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (allRequests as QuoteRequest[])?.length === 0 ? (
              <Card className="p-12 text-center">
                <Waves className="h-16 w-16 mx-auto text-[#0a4a82]/30 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Open Projects Yet</h3>
                <p className="text-muted-foreground mb-6">Be the first to post a project and get quotes from local pros!</p>
                {isAuthenticated && (
                  <Button onClick={() => setIsCreateOpen(true)} className="bg-[#0a4a82]">
                    <Plus className="mr-2 h-4 w-4" />
                    Post a Project
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-4">
                {allRequests?.map((req) => {
                  const ratingBadge = getCustomerRatingBadge(req.customer?.customerRating || null);
                  const isExpanded = expandedProject === req.id;
                  const isOwner = user?.id === req.userId;
                  
                  return (
                    <Card key={req.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-project-${req.id}`}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-1">{req.title}</h3>
                            <Badge variant="secondary" className="text-xs">{req.category}</Badge>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(req.status || "open")}
                            {req.quoteCount > 0 && (
                              <Badge className="bg-[#0a4a82]/10 text-[#0a4a82] border-[#0a4a82]/20">
                                <Gavel className="h-3 w-3 mr-1" />
                                {req.quoteCount} {req.quoteCount === 1 ? "quote" : "quotes"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Priority Access Badge */}
                        {req.hasPriorityAccess && user?.accountType === "business" && (
                          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-amber-600" />
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                  Priority Access
                                </span>
                                {req.isEmergency && (
                                  <Badge className="bg-red-500 text-white text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Emergency
                                  </Badge>
                                )}
                              </div>
                              {req.priorityExpiresAt && (
                                <div className="flex items-center gap-1 text-xs text-amber-600">
                                  <Timer className="h-3 w-3" />
                                  Expires {formatDistanceToNow(new Date(req.priorityExpiresAt), { addSuffix: true })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Customer Info Section - Visible to Businesses */}
                        {req.customer && user?.accountType === "business" && (
                          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-white">
                                <AvatarImage src={req.customer.profileImageUrl || undefined} />
                                <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82]">
                                  {req.customer.firstName?.charAt(0) || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">
                                    {req.customer.firstName} {req.customer.lastName?.charAt(0)}.
                                  </span>
                                  <Badge className={ratingBadge.color}>
                                    <Star className="h-3 w-3 mr-1 fill-current" />
                                    {req.customer.customerRating || "5.0"} {ratingBadge.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                  <span>{req.customer.projectsCompleted || 0} projects completed</span>
                                  {Number(req.customer.totalSpent) > 0 && (
                                    <span>${Number(req.customer.totalSpent).toLocaleString()} spent</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Customer Contact - Only for Priority Access */}
                            {req.hasPriorityAccess && req.customerContact && (req.customerContact.phone || req.customerContact.email) && (
                              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-1 mb-2 text-xs text-amber-600 dark:text-amber-400">
                                  <Shield className="h-3 w-3" />
                                  <span className="font-medium">Priority Contact Access</span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {req.customerContact.phone && (
                                    <a 
                                      href={`tel:${req.customerContact.phone}`}
                                      className="flex items-center gap-1.5 text-[#0a4a82] hover:underline"
                                      data-testid={`link-phone-${req.id}`}
                                    >
                                      <Phone className="h-4 w-4" />
                                      {req.customerContact.phone}
                                    </a>
                                  )}
                                  {req.customerContact.email && (
                                    <a 
                                      href={`mailto:${req.customerContact.email}`}
                                      className="flex items-center gap-1.5 text-[#0a4a82] hover:underline"
                                      data-testid={`link-email-${req.id}`}
                                    >
                                      <Mail className="h-4 w-4" />
                                      {req.customerContact.email}
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <p className="text-muted-foreground mb-4 line-clamp-2">{req.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {req.budget && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {req.budget}
                            </span>
                          )}
                          {req.timeline && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {req.timeline}
                            </span>
                          )}
                          {req.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {req.location}
                            </span>
                          )}
                          {req.lowestQuote && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <TrendingDown className="h-4 w-4" />
                              Lowest: ${req.lowestQuote.toLocaleString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1 ml-auto">
                            Posted {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : "recently"}
                          </span>
                        </div>

                        {/* Business: Submit Quote Button */}
                        {user?.accountType === "business" && (
                          <div className="mt-4 pt-4 border-t">
                            <Button 
                              className="w-full bg-[#8a9a5b] hover:bg-[#7a8a4b]" 
                              data-testid={`button-submit-quote-${req.id}`}
                              onClick={() => openQuoteDialog(req.id)}
                            >
                              <Gavel className="mr-2 h-4 w-4" />
                              Submit a Quote
                            </Button>
                          </div>
                        )}

                        {/* Customer: View Quotes (Bidding War) */}
                        {isOwner && req.quoteCount > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <Button 
                              variant="outline"
                              className="w-full"
                              onClick={() => setExpandedProject(isExpanded ? null : req.id)}
                              data-testid={`button-view-quotes-${req.id}`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="mr-2 h-4 w-4" />
                                  Hide Quotes
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="mr-2 h-4 w-4" />
                                  View {req.quoteCount} {req.quoteCount === 1 ? "Quote" : "Competing Quotes"}
                                </>
                              )}
                            </Button>

                            {/* Bidding War Display */}
                            {isExpanded && (
                              <div className="mt-4 space-y-3">
                                {quotesLoading ? (
                                  <div className="space-y-2">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                  </div>
                                ) : projectQuotes && projectQuotes.length > 0 ? (
                                  <>
                                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                                      <span className="font-medium">Quotes ranked by price (lowest first)</span>
                                      <Badge variant="outline" className="text-green-600">
                                        <TrendingDown className="h-3 w-3 mr-1" />
                                        Best Deal: ${Math.min(...projectQuotes.map(q => Number(q.amount))).toLocaleString()}
                                      </Badge>
                                    </div>
                                    {projectQuotes.map((quote, index) => (
                                      <div 
                                        key={quote.id} 
                                        className={`p-4 rounded-lg border ${index === 0 ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-card"}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <Avatar className="h-10 w-10">
                                            <AvatarImage src={quote.business?.imageUrl} />
                                            <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82]">
                                              {quote.business?.name?.charAt(0) || "B"}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold">{quote.business?.name || "Business"}</span>
                                                {quote.business?.verified && (
                                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                )}
                                                {index === 0 && (
                                                  <Badge className="bg-green-500 text-white">
                                                    <Trophy className="h-3 w-3 mr-1" />
                                                    Best Price
                                                  </Badge>
                                                )}
                                              </div>
                                              <span className={`text-xl font-bold ${index === 0 ? "text-green-600" : ""}`}>
                                                ${Number(quote.amount).toLocaleString()}
                                              </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">{quote.message}</p>
                                            {quote.estimatedDuration && (
                                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {quote.estimatedDuration}
                                              </div>
                                            )}
                                            <div className="flex gap-2 mt-3">
                                              <Button size="sm" className="bg-[#0a4a82]">
                                                Accept Quote
                                              </Button>
                                              <Button size="sm" variant="outline">
                                                Message
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <p className="text-center text-muted-foreground py-4">No quotes yet</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quote Submission Dialog */}
      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Gavel className="h-5 w-5 text-[#8a9a5b]" />
              Submit Your Quote
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuoteSubmit} className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label htmlFor="quote-amount">Quote Amount ($)</Label>
              <Input
                id="quote-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 500.00"
                value={quoteFormData.amount}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, amount: e.target.value })}
                data-testid="input-quote-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-duration">Estimated Duration</Label>
              <Select 
                value={quoteFormData.estimatedDuration} 
                onValueChange={(v) => setQuoteFormData({ ...quoteFormData, estimatedDuration: v })}
              >
                <SelectTrigger data-testid="select-quote-duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-2 hours">1-2 hours</SelectItem>
                  <SelectItem value="Half day">Half day</SelectItem>
                  <SelectItem value="1 day">1 day</SelectItem>
                  <SelectItem value="2-3 days">2-3 days</SelectItem>
                  <SelectItem value="1 week">1 week</SelectItem>
                  <SelectItem value="2+ weeks">2+ weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-message">Message to Customer</Label>
              <Textarea
                id="quote-message"
                placeholder="Describe your services, experience, and what's included in your quote..."
                rows={4}
                value={quoteFormData.message}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, message: e.target.value })}
                data-testid="input-quote-message"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#8a9a5b] hover:bg-[#7a8a4b]"
              disabled={submitQuote.isPending}
              data-testid="button-confirm-quote"
            >
              {submitQuote.isPending ? "Submitting..." : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Quote
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
