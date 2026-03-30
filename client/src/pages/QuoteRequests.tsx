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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
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
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Zap,
  Phone,
  Mail,
  Shield,
  Timer,
  FileText,
  User,
  Loader2,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { QuoteRequest } from "@shared/models/auth";

interface QuoteMessageData {
  id: number;
  quoteId: number;
  senderId: string;
  message: string;
  createdAt: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderAccountType: string | null;
}

function MessageThread({ quoteId, userId }: { quoteId: number; userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");

  const { data: messages = [], isLoading } = useQuery<QuoteMessageData[]>({
    queryKey: ["/api/quotes", quoteId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${quoteId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/user/message-counts"] });
      return data;
    },
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/messages`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "messages"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  return (
    <div className="mt-3 border border-[#0a4a82]/15 rounded-xl overflow-hidden" data-testid={`thread-quote-${quoteId}`}>
      <div className="bg-[#0a4a82]/5 px-4 py-2 flex items-center gap-2 border-b border-[#0a4a82]/10">
        <MessageSquare className="h-4 w-4 text-[#0a4a82]" />
        <span className="text-sm font-semibold text-[#0a4a82]">Messages</span>
        {messages.length > 0 && (
          <Badge variant="secondary" className="text-xs">{messages.length}</Badge>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto p-3 space-y-3 bg-white dark:bg-slate-900">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-[#0a4a82]" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  isMe 
                    ? "bg-[#0a4a82] text-white" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs font-medium ${isMe ? "text-white/70" : "text-slate-500"}`}>
                      {isMe ? "You" : `${msg.senderFirstName || "User"} ${msg.senderLastName?.charAt(0) || ""}.`}
                    </span>
                    {msg.senderAccountType === "business" && !isMe && (
                      <Badge className="text-[10px] px-1 py-0 bg-[#d4a373]/20 text-[#d4a373] border-0">Business</Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  {msg.createdAt && (
                    <p className={`text-[10px] mt-1 ${isMe ? "text-white/50" : "text-slate-400"}`}>
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-[#0a4a82]/10 bg-slate-50 dark:bg-slate-800">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white"
          style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
          data-testid={`input-message-${quoteId}`}
        />
        <Button
          type="submit"
          size="sm"
          disabled={sendMutation.isPending || !newMessage.trim()}
          className="bg-[#0a4a82] hover:bg-[#083a6a]"
          data-testid={`button-send-message-${quoteId}`}
        >
          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

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
  accessRound: string | null;
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

import { DIRECTORY_CATEGORY_NAMES } from "@shared/config/categories";
const CATEGORIES = DIRECTORY_CATEGORY_NAMES;

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
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [quoteFormData, setQuoteFormData] = useState({
    amount: "",
    message: "",
    estimatedDuration: ""
  });
  const [formData, setFormData] = useState({
    customerName: "",
    title: "",
    description: "",
    category: "",
    budget: "",
    timeline: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    maxQuotes: "",
  });
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [openMessageThread, setOpenMessageThread] = useState<number | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/quote-requests/${requestId}/opt-out`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/quote-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests"] });
      toast({ title: "Request cancelled", description: "Your quote request has been cancelled." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel request.", variant: "destructive" });
    },
  });

  const withdrawQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/withdraw`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests"] });
      if (expandedProject) {
        queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests", expandedProject, "quotes"] });
      }
      toast({ title: "Quote withdrawn", description: "Your quote has been withdrawn." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to withdraw quote.", variant: "destructive" });
    },
  });

  const isCustomer = !user || user.accountType === "customer";
  const isBusiness = user?.accountType === "business";

  const { data: allRequests, isLoading: allLoading } = useQuery<EnrichedQuoteRequest[]>({
    queryKey: ["/api/quotes/requests"],
    enabled: isBusiness === true,
  });

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

  const { data: myRequests, isLoading: myLoading } = useQuery({
    queryKey: ["/api/user/quote-requests"],
    enabled: isAuthenticated && isCustomer,
  });

  const createRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/quotes/requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/quote-requests"] });
      setFormSubmitted(true);
      toast({
        title: "Request Submitted!",
        description: "Local businesses will start submitting quotes soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
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
    if (!formData.description || !formData.category) {
      toast({
        title: "Missing information",
        description: "Please fill in the service category and describe what you need.",
        variant: "destructive",
      });
      return;
    }
    const title = `${formData.category} Request`;
    const submitData = {
      ...formData,
      title,
      maxQuotes: formData.maxQuotes === "unlimited" || formData.maxQuotes === "" ? null : formData.maxQuotes,
    };
    createRequest.mutate(submitData);
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

  const getCustomerRatingBadge = (rating: string | null) => {
    const numRating = rating ? parseFloat(rating) : 5.0;
    if (numRating >= 4.5) return { label: "Excellent", color: "bg-green-500/10 text-green-600 border-green-500/20", stars: 5 };
    if (numRating >= 4.0) return { label: "Great", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", stars: 4 };
    if (numRating >= 3.5) return { label: "Good", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", stars: 3 };
    if (numRating >= 3.0) return { label: "Average", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", stars: 3 };
    return { label: "New", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", stars: 0 };
  };

  // ============ CUSTOMER VIEW: Clean submission form ============
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#1a5a92] to-slate-50">
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
                <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-page-title">Get Quotes from Local Pros</h1>
                <p className="text-white/80 mt-1">Tell us what you need and local businesses will compete for your project</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8 -mt-4">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {formSubmitted ? (
                <Card className="shadow-xl border-0">
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3" data-testid="text-success-message">Request Submitted!</h2>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Local businesses will review your project and start submitting competitive quotes. 
                      You'll be able to compare prices and choose the best offer.
                    </p>
                    <div className="bg-[#0a4a82]/5 rounded-xl p-4 max-w-sm mx-auto mb-6">
                      <h4 className="font-semibold text-[#0a4a82] mb-2 flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4" />
                        How it works
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1 text-left">
                        <li>Gold members see your request first (0-24 hrs)</li>
                        <li>Silver members join at 24-48 hrs</li>
                        <li>Bronze members join after 48 hrs</li>
                        <li>All quotes expire after 10 business days</li>
                      </ul>
                    </div>
                    <Button onClick={() => {
                      setFormSubmitted(false);
                      setFormData({ customerName: "", title: "", description: "", category: "", budget: "", timeline: "", location: "", address: "", phone: "", email: "" });
                    }} variant="outline" data-testid="button-submit-another">
                      Submit Another Request
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-xl border-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <FileText className="h-6 w-6 text-[#0a4a82]" />
                      Describe Your Project
                    </CardTitle>
                    <CardDescription>Fill out the form below and local businesses will send you competitive quotes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customer-name">Your Name</Label>
                          <Input
                            id="customer-name"
                            placeholder="Full name"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            data-testid="input-customer-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customer-email">Email Address</Label>
                          <Input
                            id="customer-email"
                            type="email"
                            placeholder="your@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            data-testid="input-customer-email"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="customer-phone">Phone Number</Label>
                          <Input
                            id="customer-phone"
                            type="tel"
                            placeholder="(252) 555-0100"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            data-testid="input-customer-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Service Category <span className="text-red-500">*</span></Label>
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
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description of Work Needed <span className="text-red-500">*</span></Label>
                        <Textarea
                          id="description"
                          placeholder="Describe what you need done, including any specific details or requirements..."
                          rows={5}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          data-testid="input-project-description"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="location">Location / Zip Code</Label>
                          <Input
                            id="location"
                            placeholder="e.g., Moyock, NC or 27958"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            data-testid="input-project-location"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="budget">Budget Range <span className="text-slate-400 text-xs">(optional)</span></Label>
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
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Street Address <span className="text-slate-400 text-xs">(optional — helps with accurate quotes)</span></Label>
                        <Input
                          id="address"
                          placeholder="e.g., 123 Main St, Moyock, NC 27958"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          data-testid="input-project-address"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="timeline">Timeline <span className="text-slate-400 text-xs">(optional)</span></Label>
                          <Select value={formData.timeline} onValueChange={(v) => setFormData({ ...formData, timeline: v })}>
                            <SelectTrigger data-testid="select-timeline">
                              <SelectValue placeholder="When do you need this done?" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMELINES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-quotes">Max Quotes to Receive</Label>
                          <Select value={formData.maxQuotes} onValueChange={(v) => setFormData({ ...formData, maxQuotes: v })}>
                            <SelectTrigger data-testid="select-max-quotes">
                              <SelectValue placeholder="Unlimited (10 business days)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 quotes</SelectItem>
                              <SelectItem value="10">10 quotes</SelectItem>
                              <SelectItem value="unlimited">Unlimited (up to 10 business days)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">Choose how many quotes you'd like before your request closes automatically.</p>
                        </div>
                      </div>

                      {!isAuthenticated && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                          Please <a href="/auth" className="underline font-medium">sign in</a> to submit your request.
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full bg-[#0a4a82] hover:bg-[#093d6b] h-12 text-base"
                        disabled={createRequest.isPending || !isAuthenticated}
                        data-testid="button-submit-project"
                      >
                        {createRequest.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-5 w-5" />
                            Submit Request & Get Quotes
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card className="sticky top-28 shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-[#0a4a82]" />
                    My Requests
                  </CardTitle>
                  <CardDescription>Track your submitted quote requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <User className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Sign in to track your requests</p>
                    </div>
                  ) : myLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (myRequests as QuoteRequest[])?.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No requests yet</p>
                      <p className="text-xs mt-1">Submit your first request!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(myRequests as QuoteRequest[])?.map((req) => (
                        <div key={req.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <h4 className="font-medium text-sm line-clamp-1">{req.title}</h4>
                            {getStatusBadge(req.status || "open")}
                          </div>
                          <p className="text-xs text-slate-500">{req.category}</p>
                          {req.maxQuotes && (
                            <p className="text-xs text-slate-500 mt-1">
                              {req.receivedQuotesCount || 0}/{req.maxQuotes} quotes received
                            </p>
                          )}
                          {req.createdAt && (
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                            </p>
                          )}
                          {req.status === "open" && !(req as any).customerOptedOut && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 p-0 px-2"
                              onClick={() => cancelRequestMutation.mutate(req.id)}
                              disabled={cancelRequestMutation.isPending}
                              data-testid={`button-cancel-request-${req.id}`}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel Request
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-6 shadow-lg border-0 bg-gradient-to-br from-[#0a4a82]/5 to-[#d4a373]/5">
                <CardContent className="p-5">
                  <h4 className="font-semibold text-[#0a4a82] mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    How Quote Rounds Work
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium">Gold Members (0-24 hrs)</p>
                        <p className="text-slate-500 text-xs">Top-tier businesses see your request first</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium">Silver Members (24-48 hrs)</p>
                        <p className="text-slate-500 text-xs">More businesses compete for your project</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
                      <div>
                        <p className="font-medium">Bronze Members (48+ hrs)</p>
                        <p className="text-slate-500 text-xs">Join the bidding after Gold and Silver members</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ BUSINESS VIEW: Open projects + bidding ============
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#1a5a92] to-muted/30">
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
              <h1 className="text-3xl md:text-4xl font-bold text-white" data-testid="text-page-title">Open Projects</h1>
              <p className="text-white/80 mt-1">Browse customer requests and submit competitive quotes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Available Projects</h2>
          <Badge variant="outline" className="text-sm">
            {allRequests?.length || 0} active
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
        ) : !allRequests?.length ? (
          <Card className="p-12 text-center">
            <Waves className="h-16 w-16 mx-auto text-[#0a4a82]/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Open Projects Yet</h3>
            <p className="text-muted-foreground">Check back soon — customers post new projects regularly.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {allRequests.map((req) => {
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
                            {req.quoteCount}{(req as any).maxQuotes ? `/${(req as any).maxQuotes}` : ""} {req.quoteCount === 1 ? "quote" : "quotes"}
                          </Badge>
                        )}
                        {(req as any).maxQuotes && (
                          <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                            Max {(req as any).maxQuotes} quotes
                          </Badge>
                        )}
                      </div>
                    </div>

                    {req.hasPriorityAccess && (
                      <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              {req.accessRound || "Priority Access"}
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
                              Window ends {formatDistanceToNow(new Date(req.priorityExpiresAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!req.hasPriorityAccess && (
                      <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-500">
                            Not yet available for your tier — upgrade for earlier access
                          </span>
                        </div>
                      </div>
                    )}

                    {req.customer && (
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
                      {req.address && (
                        <span className="flex items-center gap-1 text-slate-500">
                          {req.address}
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

                    {req.hasPriorityAccess && (
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
                                          {isCustomer ? (
                                            <>
                                              <Button size="sm" className="bg-[#0a4a82]" data-testid={`button-accept-quote-${quote.id}`}>
                                                Accept Quote
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => setOpenMessageThread(openMessageThread === quote.id ? null : quote.id)}
                                                className={openMessageThread === quote.id ? "bg-[#0a4a82]/10 border-[#0a4a82]/30" : ""}
                                                data-testid={`button-message-quote-${quote.id}`}
                                              >
                                                <MessageSquare className="h-3 w-3 mr-1" />
                                                Message
                                              </Button>
                                            </>
                                          ) : quote.userId === user?.id && quote.status !== "withdrawn" ? (
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setOpenMessageThread(openMessageThread === quote.id ? null : quote.id)}
                                                className={openMessageThread === quote.id ? "bg-[#0a4a82]/10 border-[#0a4a82]/30" : ""}
                                                data-testid={`button-message-quote-${quote.id}`}
                                              >
                                                <MessageSquare className="h-3 w-3 mr-1" />
                                                Message Customer
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                onClick={() => withdrawQuoteMutation.mutate(quote.id)}
                                                disabled={withdrawQuoteMutation.isPending}
                                                data-testid={`button-withdraw-quote-${quote.id}`}
                                              >
                                                <X className="h-3 w-3 mr-1" />
                                                Withdraw Quote
                                              </Button>
                                            </div>
                                          ) : null}
                                        </div>
                                        {openMessageThread === quote.id && user?.id && (
                                          <MessageThread quoteId={quote.id} userId={user.id} />
                                        )}
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
