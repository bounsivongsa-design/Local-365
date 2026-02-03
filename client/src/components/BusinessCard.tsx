import { Link } from "react-router-dom";
import { Star, MapPin, ArrowRight, Building2, Award } from "lucide-react";
import { type BusinessWithRating } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "@/components/TrustBadges";

interface BusinessCardProps {
  business: BusinessWithRating;
}

export function BusinessCard({ business }: BusinessCardProps) {
  return (
    <Link to={`/directory/${business.id}`}>
      <div 
        className="group relative bg-white dark:bg-card rounded-2xl overflow-hidden border border-[#0a4a82]/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_50px_rgba(10,74,130,0.15)] transition-all duration-500 hover:-translate-y-1"
        data-testid={`card-business-${business.id}`}
      >
        {/* Image Section */}
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#0a4a82]/10 to-[#d4a373]/10">
          {business.imageUrl ? (
            <img 
              src={business.imageUrl} 
              alt={business.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Building2 className="h-16 w-16 text-[#0a4a82]/20" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Category Badge */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {business.category && (
              <Badge className="bg-white/90 dark:bg-card/90 backdrop-blur-sm text-[#0a4a82] border-0 shadow-lg">
                {business.category}
              </Badge>
            )}
            {business.isLocal365Partner && (
              <Badge className="bg-[#8a9a5b] text-white border-0 shadow-lg">
                <Award className="h-3 w-3 mr-1" />
                Local 365 Partner
              </Badge>
            )}
          </div>
          
          {/* Rating Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#d4a373] text-white px-2.5 py-1 rounded-full text-sm font-bold shadow-lg">
            <Star className="h-3.5 w-3.5 fill-current" />
            {business.averageRating ? Number(business.averageRating).toFixed(1) : "New"}
          </div>
          
          {/* Hover Arrow */}
          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-lg">
            <ArrowRight className="h-5 w-5 text-[#0a4a82]" />
          </div>
        </div>
        
        {/* Content Section */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-foreground group-hover:text-[#0a4a82] transition-colors line-clamp-1">
            {business.name}
          </h3>
          
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
            <MapPin className="h-4 w-4 text-[#d4a373] flex-shrink-0" />
            <span className="truncate">{business.address.split(',')[0] || 'Currituck County'}</span>
          </div>
          
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
            {business.description}
          </p>
          
          {/* Trust Badges & Bottom Accent */}
          <div className="mt-4 pt-4 border-t border-[#0a4a82]/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TrustBadges 
                hasLLC={business.hasLLC ?? false} 
                hasInsurance={business.hasInsurance ?? false} 
                variant="compact"
              />
              <span className="text-xs text-[#0a4a82] font-medium group-hover:underline">View Details</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
