import { useBusiness, useCreateReview } from "@/hooks/use-businesses";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Star, MapPin, Globe, Clock, MessageSquare, ArrowLeft, Award, Gift, Sparkles, Crown, Shield, Phone, Mail, ExternalLink, Building2, Calendar, MapPinned, Home, Briefcase, Video, Upload, Trash2, Play, CheckCircle } from "lucide-react";
import { TrustBadges } from "@/components/TrustBadges";
import { MembershipBadge } from "@/components/MembershipBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

function trackEvent(businessId: number, eventType: string) {
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, eventType }),
  }).catch(() => {});
}

export default function BusinessDetails() {
  const { id: paramId } = useParams<{ id: string }>();
  const id = paramId ? parseInt(paramId) : 0;
  const { data: business, isLoading } = useBusiness(id);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (id > 0) {
      trackEvent(id, "page_view");
    }
  }, [id]);
  
  if (isLoading) {
    return <BusinessDetailsSkeleton />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Business not found</h1>
        <Link to="/directory"><Button>Back to Directory</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4f8] via-[#f5f0eb] to-[#eef2f7] pb-20">
      <div className="h-[320px] md:h-[420px] relative w-full overflow-hidden">
        {business.imageUrl && (
          <img 
            src={business.imageUrl} 
            alt={business.name} 
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a4a82] via-[#0a4a82]/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82]/40 to-transparent"></div>
        
        <div className="container absolute bottom-0 left-0 right-0 pb-8">
           <Link to="/directory">
             <Button variant="ghost" className="text-white/90 hover:text-white hover:bg-white/15 mb-6 -ml-4 backdrop-blur-sm border border-white/20">
               <ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory
             </Button>
           </Link>
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
             <div>
               <Badge className="mb-3 bg-[#d4a373] text-white border-none px-4 py-1.5 text-sm font-semibold shadow-lg">{business.category}</Badge>
               <h1 className="font-display text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{business.name}</h1>
               {business.address && (
                 <p className="text-white/80 mt-2 flex items-center gap-1.5 text-sm">
                   <MapPin className="h-4 w-4" /> {business.address}
                 </p>
               )}
             </div>
             <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl border border-white/50">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < Math.round(Number(business.averageRating || 0)) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
                  ))}
                </div>
                <span className="font-bold text-lg text-[#1a1a2e]">{Number(business.averageRating || 0).toFixed(1)}</span>
                <span className="text-[#0a4a82]/60 text-sm">({business.reviews?.length || 0})</span>
             </div>
           </div>
        </div>
      </div>

      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-[#0a4a82]/8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a4a82] via-[#d4a373] to-[#8a9a5b]"></div>
            <h2 className="font-display text-2xl font-bold mb-2 text-[#1a1a2e]">About</h2>
            <div className="w-16 h-1 bg-[#d4a373] rounded-full mb-4"></div>
            <p className="text-[#4a4a5a] text-lg leading-relaxed">
              {business.description}
            </p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 rounded-xl border border-[#0a4a82]/10">
                 <div className="w-10 h-10 rounded-lg bg-[#0a4a82] flex items-center justify-center flex-shrink-0">
                   <MapPin className="h-5 w-5 text-white" />
                 </div>
                 <div>
                   <h4 className="font-semibold mb-1 text-[#1a1a2e]">Location</h4>
                   <p className="text-[#4a4a5a] text-sm">{business.address}</p>
                 </div>
               </div>
               <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#8a9a5b]/5 to-[#8a9a5b]/10 rounded-xl border border-[#8a9a5b]/10">
                 <div className="w-10 h-10 rounded-lg bg-[#8a9a5b] flex items-center justify-center flex-shrink-0">
                   <Clock className="h-5 w-5 text-white" />
                 </div>
                 <div>
                   <h4 className="font-semibold mb-1 text-[#1a1a2e]">Hours</h4>
                   <p className="text-[#4a4a5a] text-sm">Open today: 9:00 AM - 6:00 PM</p>
                 </div>
               </div>
               {business.phone && (
                 <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#d4a373]/5 to-[#d4a373]/10 rounded-xl border border-[#d4a373]/15">
                   <div className="w-10 h-10 rounded-lg bg-[#d4a373] flex items-center justify-center flex-shrink-0">
                     <Phone className="h-5 w-5 text-white" />
                   </div>
                   <div>
                     <h4 className="font-semibold mb-1 text-[#1a1a2e]">Phone</h4>
                     <a href={`tel:${business.phone}`} className="text-[#0a4a82] hover:underline font-medium" data-testid="link-phone" onClick={() => trackEvent(business.id, "phone_click")}>
                       {business.phone}
                     </a>
                   </div>
                 </div>
               )}
               {business.email && (
                 <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 rounded-xl border border-[#0a4a82]/10">
                   <div className="w-10 h-10 rounded-lg bg-[#0a4a82] flex items-center justify-center flex-shrink-0">
                     <Mail className="h-5 w-5 text-white" />
                   </div>
                   <div>
                     <h4 className="font-semibold mb-1 text-[#1a1a2e]">Email</h4>
                     <a href={`mailto:${business.email}`} className="text-[#0a4a82] hover:underline font-medium text-sm" data-testid="link-email" onClick={() => trackEvent(business.id, "email_click")}>
                       {business.email}
                     </a>
                   </div>
                 </div>
               )}
               {business.websiteUrl && (
                 <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#8a9a5b]/5 to-[#8a9a5b]/10 rounded-xl border border-[#8a9a5b]/10">
                   <div className="w-10 h-10 rounded-lg bg-[#8a9a5b] flex items-center justify-center flex-shrink-0">
                     <Globe className="h-5 w-5 text-white" />
                   </div>
                   <div>
                     <h4 className="font-semibold mb-1 text-[#1a1a2e]">Website</h4>
                     <a 
                       href={business.websiteUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="text-[#0a4a82] hover:underline flex items-center gap-1 font-medium text-sm"
                       data-testid="link-website"
                       onClick={() => trackEvent(business.id, "website_click")}
                     >
                       Visit Website <ExternalLink className="h-3 w-3" />
                     </a>
                   </div>
                 </div>
               )}
            </div>
            
            {business.membershipTier && business.membershipTier !== "none" && (
              <div className="mt-6 pt-6 border-t border-[#0a4a82]/10">
                <MembershipBadge tier={business.membershipTier} variant="full" />
              </div>
            )}
          </div>

          <LogoUploader business={business} />

          <GalleryManager business={business} />

          {business.promoVideoUrl && (
            <PromoVideoPlayer videoUrl={business.promoVideoUrl} businessName={business.name} />
          )}

          <PromoVideoUploader business={business} />

          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-[#0a4a82]/8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8a9a5b] via-[#0a4a82] to-[#d4a373]"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/80 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#1a1a2e]">Business Credentials</h2>
            </div>
            <TrustBadges 
              hasLLC={business.hasLLC ?? false} 
              hasInsurance={business.hasInsurance ?? false}
              isLicensed={business.isLicensed ?? false}
              variant="full"
            />

            {(business.establishedYear || business.establishedZipCode || business.servicesCommercial || business.servicesResidential) && (
              <div className="mt-6 pt-6 border-t border-[#0a4a82]/10">
                <h3 className="text-lg font-semibold mb-4 text-[#1a1a2e]">Additional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {business.establishedYear && (
                    <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#d4a373]/5 to-[#d4a373]/10 rounded-xl border border-[#d4a373]/15" data-testid="detail-established-year">
                      <div className="w-9 h-9 rounded-lg bg-[#d4a373] flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-0.5 text-[#1a1a2e]">Established</h4>
                        <p className="text-[#4a4a5a] text-sm">{business.establishedYear}</p>
                      </div>
                    </div>
                  )}
                  {business.establishedZipCode && (
                    <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 rounded-xl border border-[#0a4a82]/10" data-testid="detail-established-zip">
                      <div className="w-9 h-9 rounded-lg bg-[#0a4a82] flex items-center justify-center flex-shrink-0">
                        <MapPinned className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm mb-0.5 text-[#1a1a2e]">Established Zip Code</h4>
                        <p className="text-[#4a4a5a] text-sm">{business.establishedZipCode}</p>
                      </div>
                    </div>
                  )}
                </div>

                {(business.servicesCommercial || business.servicesResidential) && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-sm mb-3 text-[#1a1a2e]">Service Types</h4>
                    <div className="flex items-center gap-3 flex-wrap">
                      {business.servicesResidential && (
                        <div 
                          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl shadow-sm"
                          data-testid="badge-residential"
                        >
                          <Home className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-700">Residential</span>
                        </div>
                      )}
                      {business.servicesCommercial && (
                        <div 
                          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl shadow-sm"
                          data-testid="badge-commercial"
                        >
                          <Briefcase className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-700">Commercial</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {business.isLocal365Partner && (
            <div className="bg-gradient-to-br from-[#8a9a5b]/10 to-[#0a4a82]/5 rounded-2xl p-6 md:p-8 border border-[#8a9a5b]/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#8a9a5b] flex items-center justify-center">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Local 365 Partner</h2>
                  <p className="text-muted-foreground">Exclusive perks for Local 365 members</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {business.silverPerk && (
                  <div className="flex items-start gap-3 p-4 bg-white/80 dark:bg-card/80 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Gift className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <Badge className="bg-gray-500 text-white mb-2">Silver Elite</Badge>
                      <p className="text-sm text-muted-foreground">{business.silverPerk}</p>
                    </div>
                  </div>
                )}
                {business.goldPerk && (
                  <div className="flex items-start gap-3 p-4 bg-white/80 dark:bg-card/80 rounded-xl border border-[#d4a373]/30">
                    <Sparkles className="h-5 w-5 text-[#d4a373] mt-0.5 flex-shrink-0" />
                    <div>
                      <Badge className="bg-[#d4a373] text-white mb-2">Gold Elite</Badge>
                      <p className="text-sm text-muted-foreground">{business.goldPerk}</p>
                    </div>
                  </div>
                )}
                {business.platinumPerk && (
                  <div className="flex items-start gap-3 p-4 bg-white/80 dark:bg-card/80 rounded-xl border border-[#0a4a82]/30">
                    <Crown className="h-5 w-5 text-[#0a4a82] mt-0.5 flex-shrink-0" />
                    <div>
                      <Badge className="bg-[#0a4a82] text-white mb-2">Platinum Elite</Badge>
                      <p className="text-sm text-muted-foreground">{business.platinumPerk}</p>
                    </div>
                  </div>
                )}
                {business.ambassadorPerk && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-500/30">
                    <Award className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-2">Ambassador</Badge>
                      <p className="text-sm text-muted-foreground">{business.ambassadorPerk}</p>
                    </div>
                  </div>
                )}
              </div>
              
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#1a1a2e]">Reviews</h2>
                <div className="w-12 h-1 bg-[#d4a373] rounded-full mt-1"></div>
              </div>
              {isAuthenticated ? (
                <ReviewDialog businessId={business.id} businessName={business.name} />
              ) : (
                <Link to="/auth">
                   <Button variant="outline" className="border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82] hover:text-white">Sign in to Review</Button>
                </Link>
              )}
            </div>

            {business.reviews?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-[#0a4a82]/15 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-[#0a4a82]/5 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-7 w-7 text-[#0a4a82]/30" />
                </div>
                <p className="text-[#4a4a5a] font-medium">No reviews yet</p>
                <p className="text-[#4a4a5a]/60 text-sm mt-1">Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {business.reviews?.map((review) => (
                  <div key={review.id} className="bg-white p-6 rounded-2xl shadow-md border border-[#0a4a82]/8 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="ring-2 ring-[#0a4a82]/10">
                          <AvatarFallback className="bg-gradient-to-br from-[#0a4a82] to-[#0a4a82]/70 text-white font-bold">
                            {review.user?.firstName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                           <p className="font-semibold text-[#1a1a2e]">{review.user?.firstName || "Anonymous"}</p>
                           <p className="text-xs text-[#4a4a5a]/60">
                             {review.createdAt && formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                           </p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[#4a4a5a] leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-md border border-[#0a4a82]/8 sticky top-24 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a4a82] to-[#d4a373]"></div>
             <div className="aspect-video w-full rounded-xl mb-5 relative overflow-hidden group cursor-pointer shadow-inner">
               <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82]/20 to-[#8a9a5b]/20"></div>
               <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-122.4194,37.7749,12,0/600x400')] bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <Button size="sm" className="shadow-xl bg-white/90 text-[#0a4a82] hover:bg-white border-0 font-semibold pointer-events-none">
                   <MapPin className="h-4 w-4 mr-1.5" /> View on Map
                 </Button>
               </div>
             </div>
             <Button className="w-full mb-3 bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90 hover:from-[#0a4a82]/90 hover:to-[#0a4a82] text-white shadow-lg" size="lg" onClick={() => { trackEvent(business.id, "directions_click"); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address + ', ' + (business.city || '') + ', ' + (business.state || ''))}`, '_blank'); }} data-testid="button-directions">
               <MapPin className="h-4 w-4 mr-2" /> Get Directions
             </Button>
             {business.websiteUrl && (
             <Button variant="outline" className="w-full border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5" onClick={() => { trackEvent(business.id, "website_click"); window.open(business.websiteUrl!, '_blank'); }} data-testid="button-visit-website">
               <Globe className="h-4 w-4 mr-2" /> Visit Website
             </Button>
             )}

             {(business.phone || business.email) && (
               <div className="mt-5 pt-5 border-t border-[#0a4a82]/10 space-y-3">
                 {business.phone && (
                   <a href={`tel:${business.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#8a9a5b]/5 to-[#8a9a5b]/10 hover:from-[#8a9a5b]/10 hover:to-[#8a9a5b]/15 transition-colors group" data-testid="sidebar-phone" onClick={() => trackEvent(business.id, "phone_click")}>
                     <div className="w-9 h-9 rounded-lg bg-[#8a9a5b] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                       <Phone className="h-4 w-4 text-white" />
                     </div>
                     <div>
                       <p className="text-xs text-[#4a4a5a]/60 font-medium">Call Now</p>
                       <p className="text-sm font-semibold text-[#1a1a2e]">{business.phone}</p>
                     </div>
                   </a>
                 )}
                 {business.email && (
                   <a href={`mailto:${business.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#d4a373]/5 to-[#d4a373]/10 hover:from-[#d4a373]/10 hover:to-[#d4a373]/15 transition-colors group" data-testid="sidebar-email" onClick={() => trackEvent(business.id, "email_click")}>
                     <div className="w-9 h-9 rounded-lg bg-[#d4a373] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                       <Mail className="h-4 w-4 text-white" />
                     </div>
                     <div>
                       <p className="text-xs text-[#4a4a5a]/60 font-medium">Email</p>
                       <p className="text-sm font-semibold text-[#1a1a2e]">{business.email}</p>
                     </div>
                   </a>
                 )}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoUploader({ business }: { business: any }) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const isOwner = isAuthenticated && user && (user as any).linkedBusinessId === business.id;
  if (!isOwner) return null;

  const saveMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const res = await apiRequest("POST", `/api/businesses/${business.id}/logo`, { logoUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Logo updated", description: "Your business logo is now live!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save logo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/businesses/${business.id}/logo`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Logo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, WebP, or SVG image.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }

    const result = await uploadFile(file);
    if (result) {
      saveMutation.mutate(result.objectPath);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-gradient-to-br from-[#0a4a82]/5 to-[#0a4a82]/10 rounded-2xl p-6 border border-[#0a4a82]/15 shadow-sm" data-testid="section-logo-upload">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#062d54] flex items-center justify-center">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-[#1a1a2e]">Business Logo</h3>
          <p className="text-sm text-[#4a4a5a]">Upload your company logo (all membership tiers)</p>
        </div>
      </div>

      {business.logoUrl ? (
        <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-xl border border-[#0a4a82]/10">
          <div className="flex items-center gap-4">
            <img
              src={business.logoUrl.startsWith("/objects/") ? business.logoUrl : `/objects/${business.logoUrl}`}
              alt="Business logo"
              className="w-16 h-16 rounded-xl object-cover border-2 border-[#0a4a82]/10"
              data-testid="img-logo-preview"
            />
            <div>
              <p className="font-medium text-sm text-[#1a1a2e]">Logo uploaded</p>
              <p className="text-xs text-[#4a4a5a]">Visible on your listing and directory card</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || saveMutation.isPending} data-testid="button-replace-logo">
              <Upload className="h-4 w-4 mr-1" /> Replace
            </Button>
            <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="button-remove-logo">
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-[#0a4a82]/20 bg-white/50 cursor-pointer hover:border-[#0a4a82]/40 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          data-testid="dropzone-logo-upload"
        >
          <div className="w-14 h-14 rounded-full bg-[#0a4a82]/10 flex items-center justify-center">
            <Upload className="h-7 w-7 text-[#0a4a82]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-[#1a1a2e]">Upload your logo</p>
            <p className="text-sm text-[#4a4a5a] mt-1">JPG, PNG, WebP, or SVG · Max 5MB</p>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#4a4a5a]">Uploading logo...</span>
            <span className="font-medium text-[#0a4a82]">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0a4a82] to-[#d4a373] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" data-testid="input-logo-file" />
    </div>
  );
}

function GalleryManager({ business }: { business: any }) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const isOwner = isAuthenticated && user && (user as any).linkedBusinessId === business.id;
  const tier = business.membershipTier;
  const canUploadPhotos = tier === "standard" || tier === "premium";
  const maxPhotos = tier === "premium" ? 10 : tier === "standard" ? 6 : 0;
  const currentPhotos: string[] = business.galleryPhotos || [];
  const remaining = maxPhotos - currentPhotos.length;

  const addMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await apiRequest("POST", `/api/businesses/${business.id}/gallery`, { photoUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Photo added", description: "Gallery photo uploaded successfully!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add photo", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (photoUrl: string) => {
      const res = await apiRequest("DELETE", `/api/businesses/${business.id}/gallery`, { photoUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Photo removed" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Photo must be under 10MB.", variant: "destructive" });
      return;
    }

    const result = await uploadFile(file);
    if (result) {
      addMutation.mutate(result.objectPath);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (currentPhotos.length > 0 && !isOwner) {
    return (
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-[#0a4a82]/8 relative overflow-hidden" data-testid="section-gallery">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#d4a373] via-[#0a4a82] to-[#8a9a5b]"></div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#b8834f] flex items-center justify-center">
            <Award className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#1a1a2e]">Photo Gallery</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {currentPhotos.map((photo: string, i: number) => (
            <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-[#0a4a82]/10">
              <img
                src={photo.startsWith("/objects/") ? photo : `/objects/${photo}`}
                alt={`Gallery photo ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                data-testid={`img-gallery-${i}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isOwner) return null;

  return (
    <div className="bg-gradient-to-br from-[#d4a373]/5 to-[#d4a373]/10 rounded-2xl p-6 border border-[#d4a373]/15 shadow-sm" data-testid="section-gallery-upload">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#b8834f] flex items-center justify-center">
            <Award className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[#1a1a2e]">Photo Gallery</h3>
            <p className="text-sm text-[#4a4a5a]">
              {canUploadPhotos
                ? `${currentPhotos.length} / ${maxPhotos} photos · ${remaining} remaining`
                : "Upgrade to Silver or Gold to add gallery photos"}
            </p>
          </div>
        </div>
        {canUploadPhotos && (
          <Badge className={tier === "premium" ? "bg-gradient-to-r from-yellow-500 to-amber-400 text-white border-0" : "bg-gray-400 text-white border-0"}>
            {tier === "premium" ? "Gold · 10 photos" : "Silver · 6 photos"}
          </Badge>
        )}
      </div>

      {!canUploadPhotos ? (
        <div className="p-6 rounded-xl bg-white/50 border border-[#d4a373]/15 text-center">
          <Crown className="h-10 w-10 text-[#d4a373]/40 mx-auto mb-3" />
          <p className="font-medium text-[#1a1a2e] mb-1">Gallery Photos Require a Membership</p>
          <p className="text-sm text-[#4a4a5a] mb-4">Silver members get 6 photos, Gold members get 10 photos</p>
          <Link to="/membership">
            <Button size="sm" className="bg-gradient-to-r from-[#d4a373] to-[#b8834f] text-white border-0 shadow-sm" data-testid="button-upgrade-for-gallery">
              <Crown className="h-4 w-4 mr-1" /> View Membership Plans
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {currentPhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {currentPhotos.map((photo: string, i: number) => (
                <div key={i} className="relative group aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-[#d4a373]/15">
                  <img
                    src={photo.startsWith("/objects/") ? photo : `/objects/${photo}`}
                    alt={`Gallery photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    data-testid={`img-gallery-${i}`}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeMutation.mutate(photo)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-remove-photo-${i}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {remaining > 0 && (
            <div
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-[#d4a373]/25 bg-white/50 cursor-pointer hover:border-[#d4a373]/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-gallery-upload"
            >
              <div className="w-12 h-12 rounded-full bg-[#d4a373]/10 flex items-center justify-center">
                <Upload className="h-6 w-6 text-[#d4a373]" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#1a1a2e]">Add photos to your gallery</p>
                <p className="text-sm text-[#4a4a5a] mt-1">JPG, PNG, or WebP · Max 10MB per photo · {remaining} slots remaining</p>
              </div>
            </div>
          )}
        </>
      )}

      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#4a4a5a]">Uploading photo...</span>
            <span className="font-medium text-[#d4a373]">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#d4a373] to-[#0a4a82] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" data-testid="input-gallery-file" />
    </div>
  );
}

function PromoVideoPlayer({ videoUrl, businessName }: { videoUrl: string; businessName: string }) {
  return (
    <div className="bg-gradient-to-br from-[#0a4a82]/5 to-[#d4a373]/5 rounded-2xl p-6 md:p-8 border border-[#d4a373]/20 shadow-sm" data-testid="section-promo-video">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 via-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
            <Play className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Promo Video</h2>
            <p className="text-sm text-muted-foreground">30-second spotlight from {businessName}</p>
          </div>
        </div>
        <Badge className="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-white border-0 shadow-sm">
          <Crown className="h-3 w-3 mr-1" />
          Gold Exclusive
        </Badge>
      </div>
      <div className="rounded-xl overflow-hidden shadow-lg bg-black">
        <video
          controls
          className="w-full aspect-video"
          preload="metadata"
          data-testid="video-promo"
        >
          <source src={videoUrl.startsWith("/objects/") ? videoUrl : `/objects/${videoUrl}`} />
          Your browser does not support the video element.
        </video>
      </div>
    </div>
  );
}

function PromoVideoUploader({ business }: { business: any }) {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const isOwner = isAuthenticated && user && (user as any).linkedBusinessId === business.id;
  const isGoldTier = business.membershipTier === "premium" || business.membershipTier === "gold";

  const saveMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const res = await apiRequest("POST", `/api/businesses/${business.id}/promo-video`, { videoUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Video uploaded", description: "Your promo video is now live on your listing!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save video", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/businesses/${business.id}/promo-video`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businesses.get.path, business.id] });
      toast({ title: "Video removed", description: "Your promo video has been removed." });
    },
  });

  if (!isOwner || !isGoldTier) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload an MP4, WebM, or MOV video.", variant: "destructive" });
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Video must be under 50MB.", variant: "destructive" });
      return;
    }

    const result = await uploadFile(file);
    if (result) {
      saveMutation.mutate(result.objectPath);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 rounded-2xl p-6 border border-[#d4a373]/20 shadow-sm" data-testid="section-video-upload">
      <div className="flex items-center gap-3 mb-4">
        <Video className="h-6 w-6 text-[#d4a373]" />
        <div>
          <h3 className="font-display text-lg font-bold">Promo Video</h3>
          <p className="text-sm text-muted-foreground">Upload a 30-second clip to showcase your business</p>
        </div>
      </div>

      {business.promoVideoUrl ? (
        <div className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Video uploaded</p>
              <p className="text-xs text-muted-foreground">Your promo video is live on your listing</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || saveMutation.isPending}
              data-testid="button-replace-video"
            >
              <Upload className="h-4 w-4 mr-1" />
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="button-remove-video"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-[#d4a373]/30 bg-white/50 dark:bg-card/50 cursor-pointer hover:border-[#d4a373]/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          data-testid="dropzone-video-upload"
        >
          <div className="w-14 h-14 rounded-full bg-[#d4a373]/10 flex items-center justify-center">
            <Upload className="h-7 w-7 text-[#d4a373]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Upload your promo video</p>
            <p className="text-sm text-muted-foreground mt-1">MP4, WebM, or MOV · Max 50MB · Up to 30 seconds</p>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Uploading video...</span>
            <span className="font-medium text-[#0a4a82]">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0a4a82] to-[#d4a373] rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-video-file"
      />
    </div>
  );
}

function ReviewDialog({ businessId, businessName }: { businessId: number; businessName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [receiptPath, setReceiptPath] = useState("");
  const createReview = useCreateReview();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      setReceiptPath(response.objectPath);
      setReceiptUploaded(true);
      try {
        const res = await fetch("/api/user/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileName: receiptFile?.name || "receipt",
            fileUrl: response.objectPath,
          }),
        });
        if (!res.ok) {
          toast({ title: "Warning", description: "Receipt saved locally but could not be recorded on your account.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Warning", description: "Receipt saved locally but could not be recorded on your account.", variant: "destructive" });
      }
    },
    onError: (error) => {
      setReceiptFile(null);
      toast({ title: "Upload failed", description: error.message || "Could not upload receipt. Please try again.", variant: "destructive" });
    },
  });

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      await uploadFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptUploaded) {
      toast({ title: "Receipt required", description: "Please upload a receipt or proof of purchase from this business.", variant: "destructive" });
      return;
    }
    createReview.mutate({ businessId, rating, comment, receiptUrl: receiptPath }, {
      onSuccess: () => {
        setIsOpen(false);
        setComment("");
        setRating(5);
        setReceiptFile(null);
        setReceiptUploaded(false);
        setReceiptPath("");
        toast({ title: "Review submitted", description: "Thanks for sharing your feedback!" });
      },
      onError: (error) => {
        toast({ title: "Review failed", description: error.message || "Could not submit your review. Please try again.", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-write-review">Write a Review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {businessName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star className={`h-8 w-8 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Your Experience</Label>
            <Textarea 
              placeholder="Tell us what you loved..." 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              className="min-h-[100px]"
              data-testid="input-review-comment"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">
              Upload Receipt / Proof of Purchase <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              To maintain trust and integrity, a receipt or proof of purchase from this business is required to post a review.
            </p>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
              {receiptUploaded ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{receiptFile?.name || "Receipt uploaded"}</span>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptChange}
                    className="hidden"
                    id="review-receipt-upload"
                    data-testid="input-review-receipt"
                  />
                  <label htmlFor="review-receipt-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isUploading ? "Uploading..." : "Click to upload receipt"}
                      </span>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
          <Button type="submit" disabled={createReview.isPending || isUploading} className="w-full" data-testid="button-submit-review">
            {createReview.isPending ? "Submitting..." : "Post Review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BusinessDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      <Skeleton className="h-[400px] w-full" />
      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
        <div>
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
