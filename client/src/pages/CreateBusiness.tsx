import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CreateBusinessForm } from "@/components/CreateBusinessForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const STRIPE_SESSION_KEY = "ll365_stripe_session_id";

function saveStripeSession(sessionId: string) {
  try {
    localStorage.setItem(STRIPE_SESSION_KEY, sessionId);
  } catch {}
}

function getStoredStripeSession(): string | null {
  try {
    return localStorage.getItem(STRIPE_SESSION_KEY);
  } catch {
    return null;
  }
}

function clearStoredStripeSession() {
  try {
    localStorage.removeItem(STRIPE_SESSION_KEY);
  } catch {}
}

export default function CreateBusiness() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCheckoutParam = searchParams.get("success") === "true";
  const urlSessionId = searchParams.get("session_id");
  const verifiedRef = useRef(false);

  if (urlSessionId && fromCheckoutParam) {
    saveStripeSession(urlSessionId);
  }

  const effectiveSessionId = urlSessionId || getStoredStripeSession();
  const fromCheckout = fromCheckoutParam || !!getStoredStripeSession();

  useEffect(() => {
    if (effectiveSessionId && isAuthenticated && !verifiedRef.current) {
      verifiedRef.current = true;

      const verifyInBackground = async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await apiRequest("POST", "/api/stripe/verify-session", { sessionId: effectiveSessionId });
            console.log("Session verified for create-business (background)");
            return;
          } catch (err) {
            console.error(`Background session verification attempt ${attempt} failed:`, err);
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, 1500 * attempt));
            }
          }
        }
        console.warn("Background session verification failed after 3 attempts - business creation will use stripeSessionId fallback");
      };

      verifyInBackground();
    }
  }, [effectiveSessionId, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in or create a business account to list your business.
            </p>
            <Link to="/auth?mode=register&type=business">
              <Button data-testid="button-sign-in-to-create">Sign In / Register</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f0eb] pb-20">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#0d5a9e] text-white">
        <div className="container py-8">
          {!fromCheckout && (
            <Link to="/membership">
              <Button variant="ghost" size="sm" className="mb-4 text-white/80 hover:text-white hover:bg-white/10" data-testid="button-back-membership">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Membership Plans
              </Button>
            </Link>
          )}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="heading-create-business">
            {fromCheckout ? "Complete Your Business Listing" : "Create Your Business Listing"}
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl">
            {fromCheckout
              ? "Payment received! Now fill in your business details to get listed in the directory."
              : "Get listed in the Local List 365 directory and start connecting with customers in Moyock, NC."}
          </p>
        </div>
      </div>

      {fromCheckout && (
        <div className="container pt-6 max-w-4xl">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 text-sm font-medium">
              Your membership is active! Complete the form below to finish setting up your business listing.
            </p>
          </div>
        </div>
      )}

      <div className="container py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-10">
          <CreateBusinessForm
            onSuccess={() => {
              clearStoredStripeSession();
              navigate(fromCheckout ? "/dashboard" : "/membership");
            }}
            stripeSessionId={effectiveSessionId || undefined}
            initialBusinessName={(user as any)?.pendingBusinessName || ""}
          />
        </div>
      </div>
    </div>
  );
}
