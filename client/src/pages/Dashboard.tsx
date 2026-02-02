import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  ShieldCheck,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Receipt {
  id: number;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: string;
}

interface ValidationStatus {
  isValidated: boolean;
  receipts: Receipt[];
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data: validationData, isLoading } = useQuery<ValidationStatus>({
    queryKey: ["/api/user/validation-status"],
    enabled: isAuthenticated,
  });

  const { uploadFile } = useUpload({
    onSuccess: async (response) => {
      try {
        const res = await fetch("/api/user/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileName: response.metadata.name,
            fileUrl: response.objectPath,
          }),
        });
        
        if (res.ok) {
          toast({
            title: "Receipt uploaded",
            description: "Your receipt has been submitted for review.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/user/validation-status"] });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save receipt",
          variant: "destructive",
        });
      }
      setIsUploading(false);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      await uploadFile(file);
    }
  };

  if (authLoading || isLoading) {
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
              Please sign in to access your dashboard.
            </p>
            <Link to="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isValidated = validationData?.isValidated || false;
  const receipts = validationData?.receipts || [];
  const pendingReceipts = receipts.filter(r => r.status === "pending");
  const approvedReceipts = receipts.filter(r => r.status === "approved");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending Review</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm border-b">
        <div className="container py-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {user?.firstName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                Welcome, {user?.firstName || "User"}!
              </h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Validation Status Card */}
        <Card className="lg:col-span-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Validation Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isValidated ? (
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">Verified Customer</h3>
                <p className="text-muted-foreground text-sm">
                  You can now post in the community feed and access all features.
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mb-2">Pending Verification</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Upload a receipt or proof of purchase to verify your account and unlock posting.
                </p>
                {pendingReceipts.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {pendingReceipts.length} receipt(s) pending review
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Receipt Card */}
        <Card className="lg:col-span-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Proof of Purchase
            </CardTitle>
            <CardDescription>
              Submit receipts or proof of purchase from local Currituck businesses to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Drag and drop your receipt here, or click to browse
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="receipt-upload"
                data-testid="input-receipt-upload"
              />
              <label htmlFor="receipt-upload">
                <Button asChild disabled={isUploading} data-testid="button-upload-receipt">
                  <span>
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Supported formats: JPG, PNG, PDF (Max 10MB)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Receipts History */}
        <Card className="lg:col-span-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Submitted Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No receipts submitted yet.</p>
                <p className="text-sm">Upload your first receipt to get verified!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    data-testid={`receipt-item-${receipt.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(receipt.status)}
                      <div>
                        <p className="font-medium">{receipt.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {formatDistanceToNow(new Date(receipt.uploadedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(receipt.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
