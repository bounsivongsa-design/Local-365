import { useBusiness, useCreateReview } from "@/hooks/use-businesses";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Star, MapPin, Globe, Clock, MessageSquare, ArrowLeft, Award, Gift, Sparkles, Crown, Shield, ShieldCheck, Phone, Mail, ExternalLink, Building2, Calendar, MapPinned, Home, Briefcase, Video, Upload, Trash2, Play, CheckCircle, Share2, ThumbsUp, AlertTriangle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { TrustBadges } from "@/components/TrustBadges";
import { MembershipBadge } from "@/components/MembershipBadge";
import { ExampleBanner } from "@/components/ExampleBanner";
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
  const { isAuthenticated, user } = useAuth();
  const isOwner = isAuthenticated && user && (user as any).linkedBusinessId === id;

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
                 <p className="text-white/90 mt-2 flex items-center gap-1.5 text-sm drop-shadow-sm">
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
                <span className="text-[#0a4a82] text-sm">({business.reviews?.length || 0})</span>
             </div>
           </div>
        </div>
      </div>

      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {business.isExample && (
            <ExampleBanner variant="inline" />
          )}
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
               {(() => {
                 let hoursContent = null;
                 try {
                   if (business.businessHours) {
                     const parsed = JSON.parse(business.businessHours as string);
                     if (parsed._mode === "text" && parsed._note) {
                       hoursContent = <p className="text-[#4a4a5a] text-sm">{parsed._note}</p>;
                     } else {
                       const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                       const formatTime = (t: string) => {
                         const [h, m] = t.split(":").map(Number);
                         const ampm = h >= 12 ? "PM" : "AM";
                         return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
                       };
                       hoursContent = (
                         <div className="space-y-0.5">
                           {days.map(day => {
                             const d = parsed[day];
                             if (!d) return null;
                             return (
                               <div key={day} className="flex justify-between text-sm">
                                 <span className="text-[#4a4a5a] font-medium w-24">{day}</span>
                                 <span className="text-[#4a4a5a]">
                                   {d.closed ? "Closed" : `${formatTime(d.open)} - ${formatTime(d.close)}`}
                                 </span>
                               </div>
                             );
                           })}
                         </div>
                       );
                     }
                   }
                 } catch {}
                 if (!hoursContent) hoursContent = <p className="text-[#4a4a5a] text-sm">Contact for hours</p>;
                 return (
                   <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-[#8a9a5b]/5 to-[#8a9a5b]/10 rounded-xl border border-[#8a9a5b]/10">
                     <div className="w-10 h-10 rounded-lg bg-[#8a9a5b] flex items-center justify-center flex-shrink-0">
                       <Clock className="h-5 w-5 text-white" />
                     </div>
                     <div className="flex-1">
                       <h4 className="font-semibold mb-1 text-[#1a1a2e]">Hours</h4>
                       {hoursContent}
                     </div>
                   </div>
                 );
               })()}
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
                       href={business.websiteUrl?.startsWith("http") ? business.websiteUrl : `https://${business.websiteUrl}`} 
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
            
            {(() => {
              let socialUrls = null;
              try {
                socialUrls = business.socialMediaUrls ? (typeof business.socialMediaUrls === 'string' ? JSON.parse(business.socialMediaUrls) : business.socialMediaUrls) : null;
              } catch { socialUrls = null; }
              const hasSocials = socialUrls && (socialUrls.facebook || socialUrls.instagram || socialUrls.twitter || socialUrls.linkedin);
              if (!hasSocials) return null;
              return (
                <div className="mt-6 pt-6 border-t border-[#0a4a82]/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Share2 className="h-4 w-4 text-[#0a4a82]" />
                    <h4 className="font-semibold text-[#1a1a2e]">Follow Us</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    {socialUrls.facebook && (
                      <a href={socialUrls.facebook.startsWith("http") ? socialUrls.facebook : `https://${socialUrls.facebook}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-[#1877F2] flex items-center justify-center hover:scale-110 transition-transform shadow-md" data-testid="link-social-facebook" onClick={() => trackEvent(business.id, "social_click")}>
                        <SiFacebook className="h-5 w-5 text-white" />
                      </a>
                    )}
                    {socialUrls.instagram && (
                      <a href={socialUrls.instagram.startsWith("http") ? socialUrls.instagram : `https://${socialUrls.instagram}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center hover:scale-110 transition-transform shadow-md" data-testid="link-social-instagram" onClick={() => trackEvent(business.id, "social_click")}>
                        <SiInstagram className="h-5 w-5 text-white" />
                      </a>
                    )}
                    {socialUrls.twitter && (
                      <a href={socialUrls.twitter.startsWith("http") ? socialUrls.twitter : `https://${socialUrls.twitter}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-black flex items-center justify-center hover:scale-110 transition-transform shadow-md" data-testid="link-social-twitter" onClick={() => trackEvent(business.id, "social_click")}>
                        <FaXTwitter className="h-5 w-5 text-white" />
                      </a>
                    )}
                    {socialUrls.linkedin && (
                      <a href={socialUrls.linkedin.startsWith("http") ? socialUrls.linkedin : `https://${socialUrls.linkedin}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-[#0A66C2] flex items-center justify-center hover:scale-110 transition-transform shadow-md" data-testid="link-social-linkedin" onClick={() => trackEvent(business.id, "social_click")}>
                        <SiLinkedin className="h-5 w-5 text-white" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })()}

            {business.membershipTier && business.membershipTier !== "none" && (
              <div className="mt-6 pt-6 border-t border-[#0a4a82]/10">
                <MembershipBadge tier={business.membershipTier} variant="full" />
              </div>
            )}
          </div>

          {business.logoUrl && (
            <div className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-md border border-[#0a4a82]/8">
              <Avatar className="h-16 w-16 border-2 border-[#0a4a82]/20">
                <AvatarImage src={business.logoUrl} alt={business.name} />
                <AvatarFallback className="bg-[#0a4a82]/10 text-[#0a4a82] font-bold text-xl">{business.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-[#1a1a2e]">{business.name}</p>
                <p className="text-sm text-muted-foreground">{business.category}</p>
              </div>
            </div>
          )}

          <GalleryDisplay business={business} />

          {business.promoVideoUrl && (
            <PromoVideoPlayer videoUrl={business.promoVideoUrl} businessName={business.name} />
          )}

          {isOwner && (
            <div className="bg-gradient-to-r from-[#0a4a82]/5 to-[#d4a373]/5 rounded-2xl p-5 border border-[#0a4a82]/15 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#1a1a2e]">This is your business listing</p>
                <p className="text-sm text-muted-foreground">Manage your logo, photos, and settings from your dashboard</p>
              </div>
              <Link to="/dashboard">
                <Button className="bg-[#0a4a82] hover:bg-[#0a4a82]/90 text-white" data-testid="button-manage-listing">
                  Manage Listing
                </Button>
              </Link>
            </div>
          )}

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
              isVeteran={business.isVeteran ?? false}
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
              {isAuthenticated && !isOwner ? (
                <ReviewDialog businessId={business.id} businessName={business.name} />
              ) : !isAuthenticated ? (
                <Link to="/auth">
                   <Button variant="outline" className="border-[#0a4a82] text-[#0a4a82] hover:bg-[#0a4a82] hover:text-white">Sign in to Review</Button>
                </Link>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed" data-testid="text-review-guidelines">
              Reviews should be respectful, honest, and based on a real experience. Uploading proof of service (receipt, invoice, email, etc.) earns a <span className="text-green-600 font-semibold">Verified</span> badge. Business owners can also confirm reviews. Local List 365 reserves the right to remove any review that does not adhere to our <a href="/legal?section=terms" className="text-[#0a4a82] hover:underline">Terms of Service</a>.
            </p>

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
                      <div className="flex items-center gap-2">
                        <ReviewVerificationBadge status={review.verificationStatus} />
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[#4a4a5a] leading-relaxed">{review.comment}</p>

                    {user?.linkedBusinessId === business.id && review.verificationStatus !== "business_confirmed" && review.verificationStatus !== "business_disputed" && (
                      <ReviewVerifyActions reviewId={review.id} businessId={business.id} />
                    )}
                    
                    {review.ownerResponse && (
                      <div className="mt-4 ml-4 pl-4 border-l-2 border-[#d4a373]/40 bg-[#d4a373]/5 rounded-r-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-[#0a4a82]" />
                          <span className="font-semibold text-sm text-[#0a4a82]">Owner Response</span>
                          {review.ownerResponseDate && (
                            <span className="text-xs text-[#4a4a5a]/50">
                              {formatDistanceToNow(new Date(review.ownerResponseDate), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <p className="text-[#4a4a5a] text-sm leading-relaxed">{review.ownerResponse}</p>
                      </div>
                    )}

                    {!review.ownerResponse && user?.linkedBusinessId === business.id && (
                      <OwnerReplyForm reviewId={review.id} businessId={business.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-md border border-[#0a4a82]/8 sticky top-24 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a4a82] to-[#d4a373]"></div>
             <div className="aspect-video w-full rounded-xl mb-5 relative overflow-hidden shadow-inner border border-[#0a4a82]/10 cursor-pointer" onClick={() => { trackEvent(business.id, "directions_click"); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address + ', ' + (business.city || 'Moyock') + ', ' + (business.state || 'NC') + ' ' + (business.zipCode || '27958'))}`, '_blank'); }} data-testid="map-embed">
               <iframe
                 title="Business Location Map"
                 className="w-full h-full rounded-xl pointer-events-none"
                 style={{ border: 0 }}
                 loading="lazy"
                 src={`https://maps.google.com/maps?q=${encodeURIComponent(business.address + ', ' + (business.city || 'Moyock') + ', ' + (business.state || 'NC') + ' ' + (business.zipCode || '27958'))}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
               />
             </div>
             <Button className="w-full mb-3 bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/90 hover:from-[#0a4a82]/90 hover:to-[#0a4a82] text-white shadow-lg" size="lg" onClick={() => { trackEvent(business.id, "directions_click"); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address + ', ' + (business.city || '') + ', ' + (business.state || ''))}`, '_blank'); }} data-testid="button-directions">
               <MapPin className="h-4 w-4 mr-2" /> Get Directions
             </Button>
             {business.websiteUrl && (
             <Button variant="outline" className="w-full border-[#0a4a82]/20 text-[#0a4a82] hover:bg-[#0a4a82]/5" onClick={() => { trackEvent(business.id, "website_click"); window.open(business.websiteUrl!.startsWith("http") ? business.websiteUrl! : `https://${business.websiteUrl!}`, '_blank'); }} data-testid="button-visit-website">
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

function GalleryDisplay({ business }: { business: any }) {
  const currentPhotos: string[] = business.galleryPhotos || [];
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (currentPhotos.length === 0) return null;

  const resolveSrc = (p: string) => (p.startsWith("/objects/") ? p : `/objects/${p}`);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      else if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? null : (i + 1) % currentPhotos.length));
      else if (e.key === "ArrowLeft") setLightboxIdx((i) => (i === null ? null : (i - 1 + currentPhotos.length) % currentPhotos.length));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx, currentPhotos.length]);

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-[#0a4a82]/8 relative overflow-hidden" data-testid="section-gallery">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#d4a373] via-[#0a4a82] to-[#8a9a5b]"></div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#b8834f] flex items-center justify-center">
          <Award className="h-5 w-5 text-white" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#1a1a2e]">Photo Gallery</h2>
        <span className="ml-auto text-xs text-slate-400 font-medium">Click any photo to enlarge</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {currentPhotos.map((photo: string, i: number) => (
          <button
            type="button"
            key={i}
            onClick={() => setLightboxIdx(i)}
            className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-[#0a4a82]/10 cursor-zoom-in group relative bg-slate-100"
            data-testid={`button-gallery-${i}`}
          >
            <img
              src={resolveSrc(photo)}
              alt={`Gallery photo ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              data-testid={`img-gallery-${i}`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>

      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
          data-testid="lightbox-gallery"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            data-testid="button-close-lightbox"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {currentPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + currentPhotos.length) % currentPhotos.length); }}
                className="absolute left-4 md:left-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                data-testid="button-lightbox-prev"
                aria-label="Previous"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % currentPhotos.length); }}
                className="absolute right-4 md:right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                data-testid="button-lightbox-next"
                aria-label="Next"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
          <img
            src={resolveSrc(currentPhotos[lightboxIdx])}
            alt={`Gallery photo ${lightboxIdx + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full font-medium">
            {lightboxIdx + 1} / {currentPhotos.length}
          </div>
        </div>
      )}
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


function ReviewVerificationBadge({ status }: { status?: string | null }) {
  if (status === "proof_submitted" || status === "business_confirmed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold" data-testid="badge-verified-review">
        <ShieldCheck className="h-3 w-3" />
        {status === "business_confirmed" ? "Confirmed" : "Verified"}
      </span>
    );
  }
  if (status === "business_disputed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold" data-testid="badge-disputed-review">
        <AlertTriangle className="h-3 w-3" />
        Disputed
      </span>
    );
  }
  return null;
}

function ReviewVerifyActions({ reviewId, businessId }: { reviewId: number; businessId: number }) {
  const { toast } = useToast();
  const confirmMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("POST", `/api/reviews/${reviewId}/verify`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId] });
      toast({ title: "Review updated", description: "Review verification status has been updated." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message || "Could not update review.", variant: "destructive" });
    },
  });

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-xs text-muted-foreground mr-1">Was this customer yours?</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
        onClick={() => confirmMutation.mutate("business_confirmed")}
        disabled={confirmMutation.isPending}
        data-testid={`button-confirm-review-${reviewId}`}
      >
        <ThumbsUp className="h-3 w-3 mr-1" />
        Confirm
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={() => confirmMutation.mutate("business_disputed")}
        disabled={confirmMutation.isPending}
        data-testid={`button-dispute-review-${reviewId}`}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Dispute
      </Button>
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
  const { user } = useAuth();
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
    createReview.mutate({ businessId, rating, comment, receiptUrl: receiptPath || undefined }, {
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
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-xl px-4 py-3 mt-2">
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Community Guidelines:</span> Please be respectful and constructive. Share your honest experience with specific details — what went well or what could be improved. Personal attacks, vague complaints without proof, or inflammatory language will be removed. Reviews should help our community, not harm it.
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed mt-2 pt-2 border-t border-amber-200/40 dark:border-amber-700/30">
            <span className="font-semibold">Notice:</span> Local List 365 reserves the right to remove any review that violates our <a href="/legal?section=terms" className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200">Terms of Service</a>. By submitting a review, you agree to these terms.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
              placeholder="Describe your experience — what went well, what could be improved, and any details that would help others..." 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              className="min-h-[100px]"
              data-testid="input-review-comment"
            />
          </div>
          {user?.accountType !== "admin" && (
          <div className="space-y-2">
            <Label className="font-semibold">
              Upload Proof of Service <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Upload a receipt, invoice, email confirmation, closing document, business card, or any proof you worked with this business. Reviews with proof earn a <span className="font-semibold text-green-600">Verified</span> badge.
            </p>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
              {receiptUploaded ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{receiptFile?.name || "Proof uploaded"}</span>
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
                        {isUploading ? "Uploading..." : "Click to upload proof of service"}
                      </span>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
          )}
          <Button type="submit" disabled={createReview.isPending || isUploading} className="w-full" data-testid="button-submit-review">
            {createReview.isPending ? "Submitting..." : "Post Review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OwnerReplyForm({ reviewId, businessId }: { reviewId: number; businessId: number }) {
  const [isReplying, setIsReplying] = useState(false);
  const [response, setResponse] = useState("");
  const { toast } = useToast();

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/owner-response`, { response: response.trim() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Response posted", description: "Your reply is now visible to everyone." });
      setIsReplying(false);
      setResponse("");
      queryClient.invalidateQueries({ queryKey: ["/api/businesses", businessId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post response", variant: "destructive" });
    },
  });

  if (!isReplying) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 text-[#0a4a82] hover:text-[#0a4a82]/80 hover:bg-[#0a4a82]/5 text-xs"
        onClick={() => setIsReplying(true)}
        data-testid={`button-reply-review-${reviewId}`}
      >
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
        Reply to this review
      </Button>
    );
  }

  return (
    <div className="mt-4 ml-4 pl-4 border-l-2 border-[#0a4a82]/20 space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-[#0a4a82]" />
        <span className="font-semibold text-sm text-[#0a4a82]">Your Response</span>
      </div>
      <Textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write a professional response to this review..."
        className="bg-white border-[#0a4a82]/20 text-sm min-h-[80px]"
        style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
        maxLength={1000}
        data-testid={`input-owner-response-${reviewId}`}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{response.length}/1000</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setIsReplying(false); setResponse(""); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#0a4a82] hover:bg-[#083a6a] text-white"
            disabled={!response.trim() || replyMutation.isPending}
            onClick={() => replyMutation.mutate()}
            data-testid={`button-submit-response-${reviewId}`}
          >
            {replyMutation.isPending ? "Posting..." : "Post Response"}
          </Button>
        </div>
      </div>
    </div>
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
