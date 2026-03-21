import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Building2, 
  ArrowRight, 
  CheckCircle2,
  Waves,
  Shield,
  TrendingUp,
  Star,
  Calendar,
  MessageSquare
} from "lucide-react";

export default function AccountSetup() {
  const { user, isAuthenticated } = useAuth();
  const [selectedType, setSelectedType] = useState<"customer" | "business" | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateAccountType = useMutation({
    mutationFn: async (accountType: string) => {
      const res = await apiRequest("POST", "/api/user/account-type", { accountType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Account set up successfully!",
        description: selectedType === "business" 
          ? "Welcome to your business dashboard." 
          : "Welcome to Moyock!",
      });
      navigate("/dashboard");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set up account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleContinue = () => {
    if (selectedType) {
      updateAccountType.mutate(selectedType);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to continue.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a4a82] via-[#1a6aa8] to-[#2d8bc9] flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="absolute bottom-0 w-full h-64" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="white" d="M0,160L48,176C96,192,192,224,288,218.7C384,213,480,171,576,165.3C672,160,768,192,864,197.3C960,203,1056,181,1152,165.3C1248,149,1344,139,1392,133.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"/>
        </svg>
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Waves className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">
            Welcome to Moyock
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Hi {user?.firstName || "there"}! Let's get you set up. How will you be using Local 365?
          </p>
        </div>

        {/* Account Type Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Customer Card */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 ${
              selectedType === "customer" 
                ? "border-[#d4a373] bg-white shadow-2xl scale-[1.02]" 
                : "border-transparent bg-white/95 hover:bg-white hover:shadow-xl"
            }`}
            onClick={() => setSelectedType("customer")}
            data-testid="card-account-customer"
          >
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl ${
                  selectedType === "customer" 
                    ? "bg-gradient-to-br from-[#d4a373] to-[#c4936d]" 
                    : "bg-gradient-to-br from-[#0a4a82]/10 to-[#0a4a82]/20"
                }`}>
                  <User className={`h-8 w-8 ${selectedType === "customer" ? "text-white" : "text-[#0a4a82]"}`} />
                </div>
                {selectedType === "customer" && (
                  <CheckCircle2 className="h-8 w-8 text-[#d4a373]" />
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-[#0a4a82] mb-2">Customer Account</h2>
              <p className="text-muted-foreground mb-6">
                Explore local businesses, join the community, and discover local services.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Star className="h-5 w-5 text-[#d4a373]" />
                  <span>Rate & review local businesses</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MessageSquare className="h-5 w-5 text-[#d4a373]" />
                  <span>Post in the community feed</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-5 w-5 text-[#d4a373]" />
                  <span>Discover local events</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Card */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 ${
              selectedType === "business" 
                ? "border-[#8a9a5b] bg-white shadow-2xl scale-[1.02]" 
                : "border-transparent bg-white/95 hover:bg-white hover:shadow-xl"
            }`}
            onClick={() => setSelectedType("business")}
            data-testid="card-account-business"
          >
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className={`p-4 rounded-2xl ${
                  selectedType === "business" 
                    ? "bg-gradient-to-br from-[#8a9a5b] to-[#7a8a4b]" 
                    : "bg-gradient-to-br from-[#0a4a82]/10 to-[#0a4a82]/20"
                }`}>
                  <Building2 className={`h-8 w-8 ${selectedType === "business" ? "text-white" : "text-[#0a4a82]"}`} />
                </div>
                {selectedType === "business" && (
                  <CheckCircle2 className="h-8 w-8 text-[#8a9a5b]" />
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-[#0a4a82] mb-2">Business Account</h2>
              <p className="text-muted-foreground mb-6">
                Manage your listing, track analytics, and connect with local customers.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-5 w-5 text-[#8a9a5b]" />
                  <span>Claim & manage your listing</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <TrendingUp className="h-5 w-5 text-[#8a9a5b]" />
                  <span>View analytics & insights</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MessageSquare className="h-5 w-5 text-[#8a9a5b]" />
                  <span>Respond to reviews</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <Button 
            size="lg"
            disabled={!selectedType || updateAccountType.isPending}
            onClick={handleContinue}
            className="h-14 px-10 text-lg bg-white text-[#0a4a82] hover:bg-white/90 shadow-xl rounded-xl font-semibold"
            data-testid="button-continue-setup"
          >
            {updateAccountType.isPending ? "Setting up..." : (
              <>
                Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
          <p className="text-white/60 text-sm mt-4">
            You can change your account type later in settings
          </p>
        </div>
      </div>
    </div>
  );
}
