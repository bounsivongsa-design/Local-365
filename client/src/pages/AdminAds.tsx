import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Megaphone, 
  Eye, 
  MousePointer,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  Calendar,
  Shield
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "react-router-dom";
import type { AdPlacement } from "@shared/schema";

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500 text-white"><Clock className="h-3 w-3 mr-1" /> Pending Review</Badge>;
    case "expired":
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Expired</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPaymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-[#8a9a5b] text-white"><DollarSign className="h-3 w-3 mr-1" /> Paid</Badge>;
    case "unpaid":
      return <Badge className="bg-orange-500 text-white"><Clock className="h-3 w-3 mr-1" /> Awaiting Payment</Badge>;
    case "refunded":
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminAds() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAd, setSelectedAd] = useState<AdPlacement | null>(null);
  const [editData, setEditData] = useState({
    status: "",
    paymentStatus: "",
    startDate: "",
    endDate: "",
  });
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: ads, isLoading } = useQuery<AdPlacement[]>({
    queryKey: ["/api/admin/ads"],
    enabled: isAuthenticated,
  });

  const updateAd = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<AdPlacement> }) => {
      const res = await fetch(`/api/admin/ads/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data.updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update ad");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Ad Updated",
        description: "The ad has been updated successfully.",
      });
      setSelectedAd(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update ad",
      });
    },
  });

  const handleEdit = (ad: AdPlacement) => {
    setSelectedAd(ad);
    setEditData({
      status: ad.status || "pending",
      paymentStatus: ad.paymentStatus || "unpaid",
      startDate: ad.startDate ? format(new Date(ad.startDate), "yyyy-MM-dd") : "",
      endDate: ad.endDate ? format(new Date(ad.endDate), "yyyy-MM-dd") : "",
    });
  };

  const handleSave = () => {
    if (!selectedAd) return;
    updateAd.mutate({
      id: selectedAd.id,
      updates: {
        status: editData.status,
        paymentStatus: editData.paymentStatus,
        startDate: editData.startDate ? new Date(editData.startDate) : null,
        endDate: editData.endDate ? new Date(editData.endDate) : null,
      },
    });
  };

  const filteredAds = ads?.filter(ad => {
    if (statusFilter === "all") return true;
    return ad.status === statusFilter;
  });

  if (!isAuthenticated || user?.accountType !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md text-center p-8">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground mb-6">
            {!isAuthenticated 
              ? "Please sign in to access the admin panel."
              : "You don't have permission to access this page."}
          </p>
          {!isAuthenticated && (
            <Link to="/auth">
              <Button size="lg" className="bg-[#0a4a82]">Sign In</Button>
            </Link>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/80 text-white py-10">
        <div className="container">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Ad Management</h1>
              <p className="text-white/80">Review and manage advertising requests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ads</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredAds?.length || 0} ads
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filteredAds || filteredAds.length === 0 ? (
          <Card className="text-center p-12">
            <Megaphone className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Ads Found</h3>
            <p className="text-muted-foreground">
              {statusFilter === "all" 
                ? "No advertising requests have been submitted yet."
                : `No ${statusFilter} ads found.`}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAds.map((ad) => (
              <Card key={ad.id} className="overflow-hidden" data-testid={`card-admin-ad-${ad.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1">
                      {ad.imageUrl && (
                        <img 
                          src={ad.imageUrl}
                          alt={ad.title}
                          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1">{ad.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {ad.placementType?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          {ad.category && ` • ${ad.category}`}
                        </p>
                        {ad.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{ad.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {getStatusBadge(ad.status || "pending")}
                          {getPaymentBadge(ad.paymentStatus || "unpaid")}
                          <Badge variant="outline" className="text-xs">
                            ${((ad.pricePerWeek || 0) / 100).toFixed(0)}/week
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {ad.impressions || 0} impressions
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointer className="h-3 w-3" />
                            {ad.clicks || 0} clicks
                          </span>
                          {ad.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(ad.startDate), "MMM d")} - {ad.endDate ? format(new Date(ad.endDate), "MMM d, yyyy") : "Ongoing"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(ad)}
                        data-testid={`button-edit-ad-${ad.id}`}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedAd} onOpenChange={(open) => !open && setSelectedAd(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ad: {selectedAd?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={editData.paymentStatus} onValueChange={(v) => setEditData({ ...editData, paymentStatus: v })}>
                <SelectTrigger data-testid="select-edit-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editData.startDate}
                  onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editData.endDate}
                  onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAd(null)}>Cancel</Button>
            <Button 
              className="bg-[#0a4a82]"
              onClick={handleSave}
              disabled={updateAd.isPending}
              data-testid="button-save-ad"
            >
              {updateAd.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
