import { useAuth } from "@/hooks/use-auth";
import { CreateBusinessForm } from "@/components/CreateBusinessForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

export default function CreateBusiness() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-[#f5f0eb] pb-20">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#0d5a9e] text-white">
        <div className="container py-8">
          <Link to="/membership">
            <Button variant="ghost" size="sm" className="mb-4 text-white/80 hover:text-white hover:bg-white/10" data-testid="button-back-membership">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Membership Plans
            </Button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="heading-create-business">
            Create Your Business Listing
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl">
            Get listed in the Local List 365 directory and start connecting with customers in Moyock, NC.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-10">
          <CreateBusinessForm
            onSuccess={() => {
              navigate("/membership");
            }}
          />
        </div>
      </div>
    </div>
  );
}
