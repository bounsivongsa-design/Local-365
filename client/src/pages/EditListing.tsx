import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Building2,
  Star,
  Crown,
  Settings,
  Save,
  Image,
  Video,
  Trash2,
  Camera,
  Clock,
  Globe,
  Phone,
  Mail,
  MapPin,
  Search,
  Shield,
  CheckCircle2,
} from "lucide-react";

interface Business {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  email?: string | null;
  websiteUrl: string | null;
  address: string | null;
  ownerName: string | null;
  category: string | null;
  searchKeywords: string | null;
  membershipTier: string | null;
  businessHours: string | null;
  socialMediaUrls: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  galleryPhotos: string[] | null;
  promoVideoUrl: string | null;
  effectiveTier?: string | null;
  hasLLC: boolean;
  hasInsurance: boolean;
  isLicensed: boolean;
  isVeteran: boolean;
  servicesResidential: boolean;
  servicesCommercial: boolean;
  acceptsQuotes?: boolean;
}

const inputStyle = { color: "#1a1a2e", caretColor: "#1a1a2e" };

function LogoUploader({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Logo updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save logo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/businesses/${business.id}/logo`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove logo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Logo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) saveMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  const tier = business.effectiveTier || business.membershipTier;
  const isBronze = tier === "basic" || tier === "bronze";

  if (isBronze) {
    return (
      <Card className="rounded-2xl border-[#0a4a82]/10 opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            Business Logo
          </CardTitle>
          <CardDescription>Upgrade to Silver or Gold to upload a logo</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#0a4a82]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#0a4a82]" />
          Business Logo
        </CardTitle>
        <CardDescription>Visible on your listing and directory card</CardDescription>
      </CardHeader>
      <CardContent>
        {business.logoUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={business.logoUrl.startsWith("/objects/") ? business.logoUrl : `/objects/${business.logoUrl}`}
              alt="Logo"
              className="w-20 h-20 rounded-xl object-cover border-2 border-[#0a4a82]/15 shadow-sm"
            />
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-logo-replace" />
                <Button type="button" variant="outline" size="sm" className="rounded-lg" asChild>
                  <span><Upload className="h-3.5 w-3.5 mr-1" /> Replace</span>
                </Button>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600 rounded-lg"
                onClick={() => deleteMutation.mutate()}
                data-testid="button-logo-remove"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-logo-upload" />
            <div className="border-2 border-dashed border-[#0a4a82]/20 rounded-xl p-6 text-center hover:border-[#0a4a82]/40 transition-colors">
              <Camera className="h-8 w-8 mx-auto text-[#0a4a82]/40 mb-2" />
              <p className="text-sm font-medium text-[#1a1a2e]">Upload Logo</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP — max 5MB</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0a4a82] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListingImageUploader({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to update listing photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      toast({ title: "Listing photo updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update listing photo", variant: "destructive" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) saveMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  const currentImage = business.imageUrl;
  const isUnsplash = currentImage?.includes("unsplash.com");
  const imgSrc = currentImage
    ? (currentImage.startsWith("http") ? currentImage : currentImage.startsWith("/objects/") ? currentImage : `/objects/${currentImage}`)
    : null;

  return (
    <Card className="rounded-2xl border-[#0a4a82]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="h-4 w-4 text-[#0a4a82]" />
          Directory Listing Photo
        </CardTitle>
        <CardDescription>This photo appears on your listing card in the directory</CardDescription>
      </CardHeader>
      <CardContent>
        {imgSrc ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border-2 border-[#0a4a82]/15 shadow-sm">
              <img
                src={imgSrc}
                alt="Listing"
                className="w-full h-40 object-cover"
                data-testid="img-listing-photo"
              />
              {isUnsplash && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-amber-500/90 text-white text-[10px]">Default Photo</Badge>
                </div>
              )}
            </div>
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-listing-photo-replace" />
              <Button type="button" variant="outline" size="sm" className="rounded-lg w-full" asChild>
                <span><Upload className="h-3.5 w-3.5 mr-1" /> {isUnsplash ? "Upload Your Own Photo" : "Replace Photo"}</span>
              </Button>
            </label>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-listing-photo-upload" />
            <div className="border-2 border-dashed border-[#0a4a82]/20 rounded-xl p-6 text-center hover:border-[#0a4a82]/40 transition-colors">
              <Image className="h-8 w-8 mx-auto text-[#0a4a82]/40 mb-2" />
              <p className="text-sm font-medium text-[#1a1a2e]">Upload Listing Photo</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP — max 5MB</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0a4a82] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GalleryManager({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const tier = business.effectiveTier || business.membershipTier;
  const canUpload = tier === "standard" || tier === "premium" || tier === "silver" || tier === "gold";
  const maxPhotos = (tier === "premium" || tier === "gold") ? 10 : (tier === "standard" || tier === "silver") ? 6 : 0;
  const currentPhotos: string[] = business.galleryPhotos || [];

  const addMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) throw new Error("Failed to add photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Photo added to gallery" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/gallery`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Photo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) addMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  if (!canUpload) {
    return (
      <Card className="rounded-2xl border-[#0a4a82]/10 opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Image className="h-4 w-4 text-slate-400" />
            Photo Gallery
          </CardTitle>
          <CardDescription>Upgrade to Silver or Gold to add photos</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#0a4a82]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Image className="h-4 w-4 text-[#d4a373]" />
          Photo Gallery
          <Badge variant="secondary" className="ml-auto text-xs">{currentPhotos.length}/{maxPhotos}</Badge>
        </CardTitle>
        <CardDescription>Showcase your work, products, or location</CardDescription>
      </CardHeader>
      <CardContent>
        {currentPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {currentPhotos.map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm border border-gray-100">
                <img
                  src={photo.startsWith("/objects/") ? photo : `/objects/${photo}`}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                  onClick={() => removeMutation.mutate(photo)}
                  data-testid={`button-remove-photo-${i}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {currentPhotos.length < maxPhotos && (
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} data-testid="input-gallery-upload" />
            <div className="border-2 border-dashed border-[#d4a373]/20 rounded-xl p-5 text-center hover:border-[#d4a373]/40 transition-colors">
              <Upload className="h-6 w-6 mx-auto text-[#d4a373]/50 mb-2" />
              <p className="text-sm font-medium text-[#1a1a2e]">Add Photo</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#d4a373] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromoVideoUploader({ business }: { business: Business }) {
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload();
  const queryClient = useQueryClient();

  const tier = business.effectiveTier || business.membershipTier;
  const isGold = tier === "premium" || tier === "gold";

  const saveMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const res = await fetch(`/api/businesses/${business.id}/promo-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoUrl }),
      });
      if (!res.ok) throw new Error("Failed to save video");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Promo video uploaded" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/businesses/${business.id}/promo-video`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove video");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", business.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      toast({ title: "Video removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Video must be under 50MB", variant: "destructive" });
      return;
    }
    const result = await uploadFile(file);
    if (result) saveMutation.mutate(result.objectPath);
    e.target.value = "";
  };

  if (!isGold) {
    return (
      <Card className="rounded-2xl border-slate-200/50 bg-slate-50/50 opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Video className="h-4 w-4 text-slate-400" />
            Promotional Video
            <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs ml-auto">Gold Exclusive</Badge>
          </CardTitle>
          <CardDescription>Upgrade to Gold to upload a 30-second promotional video</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#d4a373]/20 bg-gradient-to-br from-yellow-50/50 to-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-[#d4a373]" />
          Promotional Video
          <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs ml-auto">Gold Feature</Badge>
        </CardTitle>
        <CardDescription>30-second video displayed on your listing page</CardDescription>
      </CardHeader>
      <CardContent>
        {business.promoVideoUrl ? (
          <div className="space-y-3">
            <video
              src={business.promoVideoUrl.startsWith("/objects/") ? business.promoVideoUrl : `/objects/${business.promoVideoUrl}`}
              controls
              className="w-full rounded-xl border border-gray-200 shadow-sm"
              style={{ maxHeight: "200px" }}
            />
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} data-testid="input-video-replace" />
                <Button type="button" variant="outline" size="sm" className="rounded-lg" asChild>
                  <span><Upload className="h-3.5 w-3.5 mr-1" /> Replace</span>
                </Button>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600 rounded-lg"
                onClick={() => deleteMutation.mutate()}
                data-testid="button-video-remove"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} data-testid="input-video-upload" />
            <div className="border-2 border-dashed border-[#d4a373]/20 rounded-xl p-6 text-center hover:border-[#d4a373]/40 transition-colors">
              <Video className="h-8 w-8 mx-auto text-[#d4a373]/40 mb-2" />
              <p className="text-sm font-medium text-[#1a1a2e]">Upload Promo Video</p>
              <p className="text-xs text-muted-foreground mt-1">MP4 or WebM — max 50MB, 30 seconds</p>
            </div>
          </label>
        )}
        {isUploading && (
          <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#d4a373] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileEditor({ business }: { business: Business }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const parseHours = (h: string | null | undefined) => {
    try { return h ? JSON.parse(h) : {}; } catch { return {}; }
  };
  const parseSocial = (s: string | null | undefined) => {
    try { return s ? JSON.parse(s) : {}; } catch { return {}; }
  };

  const [form, setForm] = useState({
    description: business.description || "",
    phone: business.phone || "",
    email: (business as any).email || "",
    websiteUrl: business.websiteUrl || "",
    address: business.address || "",
    ownerName: business.ownerName || "",
    category: business.category || "",
    searchKeywords: business.searchKeywords || "",
    hasLLC: business.hasLLC || false,
    hasInsurance: business.hasInsurance || false,
    isLicensed: business.isLicensed || false,
    isVeteran: business.isVeteran || false,
    servicesResidential: business.servicesResidential || false,
    servicesCommercial: business.servicesCommercial || false,
    acceptsQuotes: (business as any).acceptsQuotes !== false,
  });

  const parsedHoursInit = parseHours(business.businessHours);
  const initHoursMode: "specific" | "text" = parsedHoursInit._mode === "text" ? "text" : "specific";
  const initHoursNote = parsedHoursInit._note || "";

  const [hoursMode, setHoursMode] = useState<"specific" | "text">(initHoursMode);
  const [hoursNote, setHoursNote] = useState(initHoursNote);
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    (() => {
      const parsed = parsedHoursInit;
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const result: Record<string, { open: string; close: string; closed: boolean }> = {};
      for (const d of days) {
        result[d] = parsed[d] || { open: "09:00", close: "17:00", closed: false };
      }
      return result;
    })()
  );
  const [social, setSocial] = useState<Record<string, string>>(parseSocial(business.socialMediaUrls));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          businessHours: JSON.stringify(
            hoursMode === "text"
              ? { _mode: "text", _note: hoursNote }
              : { ...hours, _mode: "specific" }
          ),
          socialMediaUrls: JSON.stringify(social),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ variant: "destructive", title: "Error", description: err.message });
        return;
      }
      toast({ title: "Changes saved!", description: "Your listing has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save changes" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
        <CardHeader>
          <CardTitle className="text-base text-[#1a1a2e] flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#0a4a82]" />
            Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a2e]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full min-h-[100px] rounded-xl border border-gray-200 p-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none resize-y"
              style={inputStyle}
              data-testid="input-edit-description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-gray-400" /> Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
                style={inputStyle}
                placeholder="(252) 555-0123"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-gray-400" /> Email
              </label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
                style={inputStyle}
                placeholder="contact@yourbusiness.com"
                data-testid="input-edit-email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-gray-400" /> Website
              </label>
              <input
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
                style={inputStyle}
                placeholder="https://yourbusiness.com"
                data-testid="input-edit-website"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" /> Address
              </label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
                style={inputStyle}
                data-testid="input-edit-address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1a1a2e] flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-gray-400" /> Search Keywords
            </label>
            <input
              value={form.searchKeywords}
              onChange={(e) => setForm({ ...form, searchKeywords: e.target.value })}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
              style={inputStyle}
              placeholder="keyword1, keyword2, keyword3"
              maxLength={250}
              data-testid="input-edit-keywords"
            />
            <p className="text-xs text-gray-400">{form.searchKeywords.length}/250 characters — helps customers find your listing</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
        <CardHeader>
          <CardTitle className="text-base text-[#1a1a2e] flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#0a4a82]" />
            Business Hours
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setHoursMode("specific")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hoursMode === "specific" ? "bg-[#0a4a82] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              data-testid="button-hours-specific"
            >
              Set Specific Hours
            </button>
            <button
              type="button"
              onClick={() => setHoursMode("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hoursMode === "text" ? "bg-[#0a4a82] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              data-testid="button-hours-text"
            >
              Custom Text
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {hoursMode === "text" ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Describe your availability (e.g., "Online 24/7", "By appointment only")</p>
              <textarea
                value={hoursNote}
                onChange={(e) => setHoursNote(e.target.value)}
                placeholder='e.g., Online 24/7, By appointment only'
                className="w-full min-h-[80px] rounded-xl border border-gray-200 p-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none resize-y"
                style={inputStyle}
                maxLength={200}
                data-testid="input-hours-text"
              />
              <p className="text-xs text-gray-400">{hoursNote.length}/200</p>
            </div>
          ) : (
            Object.entries(hours).map(([day, val]) => (
              <div key={day} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <span className="w-24 text-sm font-medium text-[#1a1a2e]">{day}</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!val.closed}
                    onChange={(e) => setHours({ ...hours, [day]: { ...val, closed: !e.target.checked } })}
                    className="h-4 w-4 rounded border-gray-300 text-[#0a4a82]"
                  />
                  <span className="text-xs text-gray-500">{val.closed ? "Closed" : "Open"}</span>
                </label>
                {!val.closed && (
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="time" value={val.open} onChange={(e) => setHours({ ...hours, [day]: { ...val, open: e.target.value } })} className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white" style={inputStyle} />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" value={val.close} onChange={(e) => setHours({ ...hours, [day]: { ...val, close: e.target.value } })} className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white" style={inputStyle} />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
        <CardHeader>
          <CardTitle className="text-base text-[#1a1a2e]">Social Media</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "facebook", label: "Facebook" },
            { key: "instagram", label: "Instagram" },
            { key: "twitter", label: "X (Twitter)" },
            { key: "linkedin", label: "LinkedIn" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{label}</label>
              <input
                value={social[key] || ""}
                onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-[#0a4a82]/30 focus:border-[#0a4a82] outline-none"
                style={inputStyle}
                placeholder={`${label} URL`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10">
        <CardHeader>
          <CardTitle className="text-base text-[#1a1a2e] flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#0a4a82]" />
            Credentials & Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: "hasLLC" as const, label: "LLC" },
              { key: "hasInsurance" as const, label: "Insured" },
              { key: "isLicensed" as const, label: "Licensed" },
              { key: "isVeteran" as const, label: "Veteran Owned" },
            ].map(({ key, label }) => (
              <label key={key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${form[key] ? "bg-[#0a4a82]/5 border-[#0a4a82]/30" : "bg-gray-50 border-gray-200"}`}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#0a4a82]"
                />
                <span className="text-sm font-medium text-[#1a1a2e]">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "servicesResidential" as const, label: "Residential Services" },
              { key: "servicesCommercial" as const, label: "Commercial Services" },
            ].map(({ key, label }) => (
              <label key={key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${form[key] ? "bg-[#8a9a5b]/5 border-[#8a9a5b]/30" : "bg-gray-50 border-gray-200"}`}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#8a9a5b]"
                />
                <span className="text-sm font-medium text-[#1a1a2e]">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <span className="text-sm font-medium text-[#1a1a2e]">Accept Quote Requests</span>
              <p className="text-xs text-gray-500">Allow customers to request quotes from your business</p>
            </div>
            <Switch
              checked={form.acceptsQuotes}
              onCheckedChange={(v) => setForm({ ...form, acceptsQuotes: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end sticky bottom-4 bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-[#0a4a82]/10">
        <Link to="/dashboard">
          <Button variant="outline" className="rounded-xl">Cancel</Button>
        </Link>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#0a4a82] hover:bg-[#083a6a] text-white px-8"
          data-testid="button-save-listing"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default function EditListing() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const isBusinessAccount = user?.accountType === "business";

  const { data: business, isLoading: businessLoading } = useQuery<Business>({
    queryKey: ["/api/my-business"],
    enabled: isAuthenticated && isBusinessAccount,
  });

  const loading = authLoading || (isBusinessAccount && businessLoading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0a4a82]" />
      </div>
    );
  }

  if (!isAuthenticated || !isBusinessAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#0a4a82]/95 to-[#f5f0eb] flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl shadow-xl">
          <CardContent className="pt-8 text-center">
            <Building2 className="h-12 w-12 text-[#0a4a82] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Business Account Required</h2>
            <p className="text-muted-foreground mb-6">
              Only business account owners can edit their listing.
            </p>
            <Link to="/dashboard">
              <Button className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl" data-testid="button-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#0a4a82]/95 to-[#f5f0eb] flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl shadow-xl">
          <CardContent className="pt-8 text-center">
            <Building2 className="h-12 w-12 text-[#d4a373] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">No Business Found</h2>
            <p className="text-muted-foreground mb-6">
              Create your business listing first, then come back to edit it.
            </p>
            <Link to="/create-business">
              <Button className="bg-[#0a4a82] hover:bg-[#083a6a] rounded-xl" data-testid="button-create-business">Create Business</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveTier = business.effectiveTier || business.membershipTier;
  const tierName = effectiveTier === "premium" ? "Gold" : effectiveTier === "standard" ? "Silver" : effectiveTier === "basic" ? "Bronze" : effectiveTier || "No Plan";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a4a82] via-[#0a4a82]/95 to-[#f5f0eb] pb-20">
      <div className="bg-gradient-to-r from-[#0a4a82] to-[#083a6a] border-b border-white/10">
        <div className="container py-8">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4 text-white/80 hover:text-white hover:bg-white/10" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white flex items-center gap-3" data-testid="text-page-title">
                <Settings className="h-7 w-7 text-[#d4a373]" />
                Edit My Listing
              </h1>
              <p className="text-white/60 mt-1">{business.name} — {tierName} Member</p>
            </div>
            <Link to={`/directory/${business.id}`}>
              <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10 rounded-xl" data-testid="button-view-listing">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                View Live Listing
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e] flex items-center gap-2 mb-5">
            <Image className="h-5 w-5 text-[#0a4a82]" />
            Photos & Media
          </h2>
          <div className="mb-5">
            <ListingImageUploader business={business} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <LogoUploader business={business} />
            <GalleryManager business={business} />
          </div>
          <div className="mt-5">
            <PromoVideoUploader business={business} />
          </div>
        </div>

        <div className="border-t border-[#0a4a82]/10 pt-8">
          <h2 className="text-xl font-bold text-[#1a1a2e] flex items-center gap-2 mb-5">
            <Settings className="h-5 w-5 text-[#0a4a82]" />
            Business Details
          </h2>
          <ProfileEditor business={business} />
        </div>
      </div>
    </div>
  );
}
