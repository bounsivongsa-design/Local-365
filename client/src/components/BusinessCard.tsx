import { Link } from "react-router-dom";
import { Star, MapPin, ArrowRight, Building2, Award } from "lucide-react";
import { type BusinessWithRating } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "@/components/TrustBadges";
import { MembershipBadge } from "@/components/MembershipBadge";
import { ExampleBanner } from "@/components/ExampleBanner";

function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(1, Math.max(0, rating - (i - 1)));
    stars.push(
      <div key={i} className="relative h-4 w-4">
        <Star className="absolute inset-0 h-4 w-4 text-gray-200 fill-gray-200" />
        {fill > 0 && (
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5" data-testid="star-rating">
      <div className="flex items-center gap-0.5">{stars}</div>
      {rating > 0 ? (
        <span className="text-sm font-semibold" style={{ color: "#334155" }}>{rating.toFixed(1)}</span>
      ) : null}
      <span className="text-xs" style={{ color: "#64748b" }}>({reviewCount})</span>
    </div>
  );
}

interface BusinessCardProps {
  business: BusinessWithRating;
}

export function BusinessCard({ business }: BusinessCardProps) {
  const rating = business.averageRating ? Number(business.averageRating) : 0;
  const reviewCount = business.reviewCount ?? 0;

  return (
    <Link to={`/directory/${business.id}`}>
      <div 
        className="group relative bg-white dark:bg-card rounded-2xl overflow-hidden border border-[#0a4a82]/10 hover:border-[#0a4a82]/25 shadow-md hover:shadow-xl transition-shadow duration-300"
        data-testid={`card-business-${business.id}`}
      >
        {business.isExample && <ExampleBanner variant="ribbon" />}
        <div className={`relative h-48 sm:h-48 overflow-hidden bg-gradient-to-br from-[#f5f5f0] to-[#e8e4de]`}>
          {business.imageUrl ? (
            <img 
              src={business.imageUrl} 
              alt={business.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2">
              <Building2 className="h-12 w-12 text-[#0a4a82]/30" />
              <span className="text-xs font-medium text-[#0a4a82]/40 uppercase tracking-wider">No Photo</span>
            </div>
          )}
          
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 max-w-[70%]">
            {business.category && (
              <div className="flex flex-wrap gap-1">
                <Badge className="bg-white/95 text-[#0a4a82] border-0 shadow-sm text-xs">
                  {business.category}
                </Badge>
                {Array.isArray((business as any).additionalCategories) &&
                  (business as any).additionalCategories
                    .filter((c: string) => c && c !== business.category)
                    .slice(0, 2)
                    .map((c: string) => (
                      <Badge key={c} className="bg-white/80 text-[#0a4a82]/90 border-0 shadow-sm text-[10px] font-medium">
                        {c}
                      </Badge>
                    ))}
                {Array.isArray((business as any).additionalCategories) &&
                  (business as any).additionalCategories.filter((c: string) => c && c !== business.category).length > 2 && (
                    <Badge className="bg-white/70 text-[#0a4a82]/80 border-0 shadow-sm text-[10px] font-medium">
                      +{(business as any).additionalCategories.filter((c: string) => c && c !== business.category).length - 2} more
                    </Badge>
                  )}
              </div>
            )}
            {business.isLocal365Partner && (
              <Badge className="bg-[#8a9a5b] text-white border-0 shadow-sm w-fit">
                <Award className="h-3 w-3 mr-1" />
                Local 365 Partner
              </Badge>
            )}
          </div>
          
          {rating > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm text-slate-800 px-2.5 py-1.5 rounded-full text-sm font-bold shadow-sm border border-white/50">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              {rating.toFixed(1)}
            </div>
          )}
          {rating === 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#d4a373] text-white px-2.5 py-1.5 rounded-full text-sm font-bold shadow-sm">
              <Star className="h-4 w-4 fill-current" />
              New
            </div>
          )}
        </div>
        
        <div className="p-5">
          <h3 className="text-lg font-bold group-hover:text-[#0a4a82] transition-colors line-clamp-1" style={{ color: "#1a1a2e" }}>
            {business.name}
          </h3>

          <div className="mt-2">
            <StarRating rating={rating} reviewCount={reviewCount} />
          </div>
          
          <div className="flex items-center gap-2 text-sm sm:text-base mt-2" style={{ color: "#475569" }}>
            <MapPin className="h-4 w-4 text-[#d4a373] flex-shrink-0" />
            <span className="truncate">{business.address.split(',')[0] || 'Moyock, NC'}</span>
          </div>
          
          <p className="text-sm sm:text-base mt-3 line-clamp-2 leading-relaxed" style={{ color: "#334155" }}>
            {business.description}
          </p>
          
          <div className="mt-4 pt-4 border-t border-[#0a4a82]/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <TrustBadges 
                  hasLLC={business.hasLLC ?? false} 
                  hasInsurance={business.hasInsurance ?? false}
                  isLicensed={business.isLicensed ?? false}
                  isVeteran={business.isVeteran ?? false}
                  variant="compact"
                />
                <MembershipBadge tier={business.membershipTier} variant="compact" />
              </div>
              <span className="text-sm text-[#0a4a82] font-semibold group-hover:underline flex items-center gap-1">
                View Details
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
