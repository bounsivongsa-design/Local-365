import { useState, useEffect } from "react";
import { useJobListings, useMyJobListings, useCreateJobListing, useUpdateJobListing, useJobCheckout, useDeleteJobListing, useJobPricing } from "@/hooks/use-jobs";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MembershipBadge } from "@/components/MembershipBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Plus,
  Phone,
  ExternalLink,
  Crown,
  DollarSign,
  Building2,
  Trash2,
  Mail,
  Clock,
  MapPin,
  Upload,
  X,
  ImageIcon,
  Pencil,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import type { JobListingWithBusiness } from "@shared/schema";

function getTierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case "premium": return "Gold";
    case "standard": return "Silver";
    case "basic": return "Bronze";
    default: return "";
  }
}

function getTierBorderClass(tier: string | null | undefined): string {
  switch (tier) {
    case "premium": return "border-l-4 border-l-yellow-500";
    case "standard": return "border-l-4 border-l-gray-400";
    case "basic": return "border-l-4 border-l-amber-700";
    default: return "border-l-4 border-l-transparent";
  }
}

function JobCard({ listing }: { listing: JobListingWithBusiness }) {
  const tier = listing.business?.membershipTier;
  const tierLabel = getTierLabel(tier);

  return (
    <Card className={`overflow-hidden bg-white/95 backdrop-blur-sm hover:shadow-lg transition-all ${getTierBorderClass(tier)}`} data-testid={`card-job-${listing.id}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {listing.imageUrl && (
            <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
                data-testid={`img-job-${listing.id}`}
              />
            </div>
          )}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-bold text-[#1a1a2e]" data-testid={`text-job-title-${listing.id}`}>
                {listing.title}
              </h3>
              {tierLabel && (
                <MembershipBadge tier={tier!} variant="compact" />
              )}
            </div>

            {listing.business && (
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Link
                  to={`/directory/${listing.business.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[#0a4a82] hover:underline font-medium"
                  data-testid={`link-job-business-${listing.id}`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {listing.business.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {(listing.business.city || listing.business.zipCode) && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500" data-testid={`text-job-location-${listing.id}`}>
                    <MapPin className="h-3 w-3" />
                    {listing.business.city || listing.business.zipCode}
                  </span>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600 mb-3 line-clamp-3" data-testid={`text-job-desc-${listing.id}`}>
              {listing.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
              {listing.contactPhone && (
                <a
                  href={`tel:${listing.contactPhone}`}
                  className="inline-flex items-center gap-1 text-[#0a4a82] hover:underline"
                  data-testid={`link-job-phone-${listing.id}`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  {listing.contactPhone}
                </a>
              )}
              {listing.contactEmail && (
                <a
                  href={`mailto:${listing.contactEmail}`}
                  className="inline-flex items-center gap-1 text-[#0a4a82] hover:underline"
                  data-testid={`link-job-email-${listing.id}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {listing.contactEmail}
                </a>
              )}
              {listing.createdAt && (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(listing.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateJobForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateJobListing();
  const checkoutMutation = useJobCheckout();
  const { data: pricing } = useJobPricing(true);
  const priceDisplay = pricing ? `$${(pricing.pricePerWeek / 100).toFixed(0)}` : "...";
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setFormData((prev) => ({ ...prev, imageUrl: response.objectPath }));
      toast({ title: "Image uploaded", description: "Your image has been uploaded successfully." });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    const result = await uploadFile(file);
    if (!result) {
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required.", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl || undefined,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined,
      },
      {
        onSuccess: (listing) => {
          toast({ title: "Redirecting to payment...", description: "Complete payment to activate your listing." });
          checkoutMutation.mutate(listing.id, {
            onSuccess: (data) => {
              if (data.url) {
                window.location.href = data.url;
              }
            },
            onError: (err: Error) => {
              toast({ title: "Payment Error", description: err.message, variant: "destructive" });
            },
          });
          setFormData({ title: "", description: "", imageUrl: "", contactPhone: "", contactEmail: "" });
          setImagePreview(null);
          onSuccess();
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="job-title">Job Title *</Label>
        <Input
          id="job-title"
          placeholder="e.g., HVAC Technician Needed"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          data-testid="input-job-title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="job-description">Description *</Label>
        <Textarea
          id="job-description"
          placeholder="Describe the position, requirements, pay range, etc."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          required
          data-testid="input-job-description"
        />
      </div>
      <div className="space-y-2">
        <Label>Image (optional)</Label>
        {imagePreview ? (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1 shadow-sm"
              data-testid="button-remove-job-image"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-sm font-medium">Uploading...</span>
              </div>
            )}
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0a4a82] hover:bg-slate-50 transition-colors"
            data-testid="dropzone-job-image"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) handleImageSelect(file);
            }}
          >
            <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-sm text-slate-500 font-medium">Click or drag to upload an image</span>
            <span className="text-xs text-slate-400 mt-1">JPG, PNG, or WebP — max 5MB</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageSelect(file);
              }}
              data-testid="input-job-image-file"
            />
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="job-phone">Contact Phone</Label>
          <Input
            id="job-phone"
            placeholder="(252) 555-0100"
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            data-testid="input-job-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-email">Contact Email</Label>
          <Input
            id="job-email"
            placeholder="jobs@yourbusiness.com"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            data-testid="input-job-email"
          />
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <DollarSign className="h-4 w-4" />
          {priceDisplay}/week — billed weekly until you remove the listing
        </div>
        <p className="text-blue-700 text-xs">
          {pricing?.tierLabel && pricing.tierLabel !== "No Membership"
            ? `Your ${pricing.tierLabel} membership rate. `
            : ""}
          Listing stays live until you take it down. Gold members appear first, then Silver, then Bronze.
        </p>
      </div>

      <Button
        type="submit"
        disabled={createMutation.isPending || isUploading}
        className="w-full h-11 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold"
        data-testid="button-post-job"
      >
        {createMutation.isPending || checkoutMutation.isPending ? "Processing..." : `Post Help Wanted Ad — ${priceDisplay}/week`}
      </Button>
    </form>
  );
}

function EditJobForm({ listing, onSuccess }: { listing: import("@shared/schema").JobListing; onSuccess: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateJobListing();
  const [formData, setFormData] = useState({
    title: listing.title,
    description: listing.description,
    imageUrl: listing.imageUrl || "",
    contactPhone: listing.contactPhone || "",
    contactEmail: listing.contactEmail || "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(listing.imageUrl || null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setFormData((prev) => ({ ...prev, imageUrl: response.objectPath }));
      toast({ title: "Image uploaded" });
    },
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    const result = await uploadFile(file);
    if (!result) setImagePreview(listing.imageUrl || null);
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Missing fields", description: "Title and description are required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      { id: listing.id, data: formData },
      {
        onSuccess: () => {
          toast({ title: "Listing Updated", description: "Your job listing has been updated." });
          onSuccess();
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-job-title">Job Title *</Label>
        <Input id="edit-job-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required data-testid="input-edit-job-title" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-job-description">Description *</Label>
        <Textarea id="edit-job-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} required data-testid="input-edit-job-description" />
      </div>
      <div className="space-y-2">
        <Label>Image (optional)</Label>
        {imagePreview ? (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
            <button type="button" onClick={removeImage} className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1 shadow-sm" data-testid="button-remove-edit-job-image">
              <X className="h-4 w-4 text-slate-600" />
            </button>
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-sm font-medium">Uploading...</span>
              </div>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0a4a82] hover:bg-slate-50 transition-colors" data-testid="dropzone-edit-job-image">
            <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-sm text-slate-500 font-medium">Click or drag to upload an image</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageSelect(file); }} data-testid="input-edit-job-image-file" />
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="edit-job-phone">Contact Phone</Label>
          <Input id="edit-job-phone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} data-testid="input-edit-job-phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-job-email">Contact Email</Label>
          <Input id="edit-job-email" type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} data-testid="input-edit-job-email" />
        </div>
      </div>
      <Button type="submit" disabled={updateMutation.isPending || isUploading} className="w-full h-11 rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white font-semibold" data-testid="button-save-edit-job">
        {updateMutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

function MyListingsSection({ listings, onDelete, isDeleting }: { listings: import("@shared/schema").JobListing[]; onDelete: (id: number) => void; isDeleting: boolean }) {
  const checkoutMutation = useJobCheckout();
  const { data: pricing } = useJobPricing(true);
  const priceLabel = pricing ? `$${(pricing.pricePerWeek / 100).toFixed(0)}/wk` : ".../wk";
  const { toast } = useToast();
  const [editingJob, setEditingJob] = useState<import("@shared/schema").JobListing | null>(null);

  const handlePayNow = (listingId: number) => {
    checkoutMutation.mutate(listingId, {
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url;
        }
      },
      onError: (err: Error) => {
        toast({ title: "Payment Error", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white drop-shadow mb-4 flex items-center gap-2" data-testid="heading-my-listings">
        <Building2 className="h-5 w-5" />
        Your Listings
      </h2>
      <div className="space-y-3">
        {listings.map((listing) => (
          <div key={listing.id}>
            <Card className="bg-white/95 backdrop-blur-sm rounded-xl border border-white/20 shadow-md overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1a1a2e] text-base" data-testid={`text-my-job-${listing.id}`}>{listing.title}</h3>
                      {listing.isActive ? (
                        <Badge className="bg-green-100 text-green-800 text-xs font-semibold" data-testid={`badge-active-${listing.id}`}>Active</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-xs font-semibold" data-testid={`badge-pending-${listing.id}`}>Pending Payment</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{listing.description}</p>
                    {listing.isActive && (
                      <p className="text-xs text-[#0a4a82]/60 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Auto-renews weekly ({priceLabel}/week) until cancelled
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 bg-slate-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
                  {!listing.isActive && (
                    <Button
                      size="default"
                      className="bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-lg font-semibold px-5 shadow-sm"
                      onClick={() => handlePayNow(listing.id)}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-pay-job-${listing.id}`}
                    >
                      <DollarSign className="h-4 w-4 mr-1.5" />
                      Pay {priceLabel}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="default"
                    className="text-[#0a4a82] border-[#0a4a82] hover:bg-[#0a4a82]/10 rounded-lg font-semibold px-5"
                    onClick={() => setEditingJob(listing)}
                    data-testid={`button-edit-job-${listing.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Edit Listing
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    className="text-red-600 border-red-500 hover:bg-red-50 rounded-lg font-semibold px-5"
                    onClick={() => {
                      if (window.confirm("Cancel this listing? This will stop weekly billing and remove the ad from the job board.")) {
                        onDelete(listing.id);
                      }
                    }}
                    disabled={isDeleting}
                    data-testid={`button-delete-job-${listing.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Cancel & Remove
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm">
        <p className="text-sm text-amber-900 font-semibold flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          Auto-Renewal Policy
        </p>
        <p className="text-xs text-amber-800 leading-relaxed ml-6">
          All job listings automatically renew every week at {priceLabel}/week until you click the <strong>"Cancel & Remove"</strong> button above. Cancellation takes effect immediately — your listing will be removed and billing will stop.
        </p>
      </div>

      <Dialog open={!!editingJob} onOpenChange={(open) => { if (!open) setEditingJob(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#0a4a82]" />
              Edit Job Listing
            </DialogTitle>
          </DialogHeader>
          {editingJob && <EditJobForm listing={editingJob} onSuccess={() => setEditingJob(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HelpWanted() {
  const { data: listings, isLoading } = useJobListings();
  const { isAuthenticated, user } = useAuth();
  const isBusinessAccount = isAuthenticated && user?.accountType === "business";
  const { data: myListings } = useMyJobListings(isBusinessAccount);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const deleteMutation = useDeleteJobListing();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Payment Successful!", description: "Your help wanted listing is now live." });
      searchParams.delete("success");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("canceled") === "true") {
      toast({ title: "Payment Canceled", description: "Your listing was saved but is not active yet. You can pay later from your listings.", variant: "destructive" });
      searchParams.delete("canceled");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Listing Removed", description: "Your job listing has been taken down." });
      },
      onError: (err: Error) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82] via-[#1a6ab2] to-[#8a9a5b]" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d4a373]/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-16" preserveAspectRatio="none">
            <path d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,864,64C960,53,1056,43,1152,42.7C1248,43,1344,53,1392,58.7L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z" fill="transparent" />
          </svg>
        </div>

        <div className="relative container py-16 md:py-20 text-white text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
              <Briefcase className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 drop-shadow-lg" data-testid="heading-help-wanted">
            Help Wanted / Now Hiring
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-4 drop-shadow">
            Local businesses are hiring! Browse open positions or post your own.
          </p>
          <div className="flex items-center justify-center gap-4 mb-8 text-sm text-white/90 drop-shadow">
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg"><span className="text-yellow-300 font-bold">Gold</span> $10/wk</span>
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg"><span className="text-gray-300 font-bold">Silver</span> $15/wk</span>
            <span className="bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg"><span className="text-orange-300 font-bold">Bronze</span> $18/wk</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            {isAuthenticated && isBusinessAccount && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-[#d4a373] hover:bg-[#c49363] text-white rounded-xl px-6 h-11 font-semibold"
                    data-testid="button-open-post-job"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Post a Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-[#0a4a82]" />
                      Post a Help Wanted Ad
                    </DialogTitle>
                  </DialogHeader>
                  <CreateJobForm onSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
            {!isAuthenticated && (
              <Link to="/auth?mode=register&type=business">
                <Button
                  className="bg-[#d4a373] hover:bg-[#c49363] text-white rounded-xl px-6 h-11 font-semibold"
                  data-testid="button-register-to-post"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Register to Post Jobs
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container -mt-4 relative z-10">
        {isAuthenticated && isBusinessAccount && myListings && myListings.length > 0 && (
          <MyListingsSection listings={myListings} onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
        )}

        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-bold text-white drop-shadow" data-testid="heading-all-jobs">
            Open Positions
          </h2>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {listings?.length || 0} listings
          </Badge>
        </div>

        <div className="flex items-center gap-6 mb-6 text-xs text-white/70">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-yellow-500" /> Gold — $10/wk
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-400" /> Silver — $15/wk
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-700" /> Bronze — $18/wk
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="space-y-4">
            {listings.map((listing) => (
              <JobCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <Card className="bg-white/95 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2" data-testid="text-no-jobs">
                No Openings Yet
              </h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Be the first local business to post a job! Pricing: Gold $10/wk, Silver $15/wk, Bronze $18/wk. Listings stay up until you remove them.
              </p>
              {isAuthenticated && isBusinessAccount && (
                <Button
                  className="mt-6 bg-[#0a4a82] hover:bg-[#083a6a] text-white rounded-xl"
                  onClick={() => setIsDialogOpen(true)}
                  data-testid="button-post-first-job"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post the First Job
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-12">
          <Card className="bg-gradient-to-r from-[#0a4a82] to-[#1a6ab2] text-white border-0 overflow-hidden">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-6 w-6 text-[#d4a373]" />
                  <h3 className="text-xl font-bold">Get More Visibility for Your Listing</h3>
                </div>
                <p className="text-white/80 mb-6 max-w-xl">
                  Members get priority placement. Gold members always appear first, followed by Silver, then Bronze.
                  A membership is required to post help wanted listings.
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/10 rounded-xl p-4 text-center">
                    <div className="text-yellow-400 font-bold text-lg mb-1">Gold</div>
                    <p className="text-white font-semibold">$10/wk</p>
                    <p className="text-xs text-white/70">Top placement</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 text-center">
                    <div className="text-gray-300 font-bold text-lg mb-1">Silver</div>
                    <p className="text-white font-semibold">$15/wk</p>
                    <p className="text-xs text-white/70">2nd tier placement</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 text-center">
                    <div className="text-amber-600 font-bold text-lg mb-1">Bronze</div>
                    <p className="text-white font-semibold">$18/wk</p>
                    <p className="text-xs text-white/70">3rd tier placement</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to="/membership">
                    <Button className="bg-[#d4a373] hover:bg-[#c49363] text-white rounded-xl" data-testid="button-view-membership">
                      Upgrade & Save on Job Posts
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
