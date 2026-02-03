import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import type { AdPlacement } from "@shared/schema";

interface AdBannerProps {
  placementType: "homepage_banner" | "featured_listing" | "category_spotlight" | "directory_boost";
  category?: string;
  className?: string;
  limit?: number;
}

export function AdBanner({ placementType, category, className = "", limit = 1 }: AdBannerProps) {
  const impressionsSent = useRef<Set<number>>(new Set());
  
  const queryKey = category 
    ? ["/api/ads/active", placementType, category]
    : ["/api/ads/active", placementType];

  const { data: ads } = useQuery<AdPlacement[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ 
        type: placementType,
        ...(category && { category }),
      });
      const res = await fetch(`/api/ads/active?${params}`);
      if (!res.ok) return [];
      const allAds = await res.json();
      return allAds.slice(0, limit);
    },
  });

  // Track impressions when ads are loaded
  useEffect(() => {
    if (ads && ads.length > 0) {
      ads.forEach(ad => {
        if (!impressionsSent.current.has(ad.id)) {
          impressionsSent.current.add(ad.id);
          fetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {
            // Silently fail - impression tracking is non-critical
          });
        }
      });
    }
  }, [ads]);

  const handleClick = (ad: AdPlacement) => {
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {
      // Silently fail - click tracking is non-critical
    });
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!ads || ads.length === 0) return null;

  if (placementType === "homepage_banner") {
    const ad = ads[0];
    return (
      <div 
        className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0a4a82] to-[#0a4a82]/80 text-white ${className}`}
        data-testid={`ad-banner-${ad.id}`}
      >
        {ad.imageUrl && (
          <img 
            src={ad.imageUrl} 
            alt={ad.title} 
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="relative p-8 flex items-center justify-between">
          <div className="flex-1">
            <Badge variant="secondary" className="mb-2 bg-white/20 text-white border-0">
              <Megaphone className="h-3 w-3 mr-1" />
              Sponsored
            </Badge>
            <h3 className="text-2xl font-bold mb-2">{ad.title}</h3>
            {ad.description && (
              <p className="text-white/80 max-w-2xl">{ad.description}</p>
            )}
          </div>
          {ad.linkUrl && (
            <button
              onClick={() => handleClick(ad)}
              className="bg-white text-[#0a4a82] px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors"
              data-testid={`ad-cta-${ad.id}`}
            >
              Learn More
            </button>
          )}
        </div>
      </div>
    );
  }

  if (placementType === "featured_listing" || placementType === "directory_boost") {
    return (
      <div className={`space-y-4 ${className}`}>
        {ads.map((ad) => (
          <Card 
            key={ad.id}
            className="overflow-hidden border-[#d4a373]/50 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleClick(ad)}
            data-testid={`ad-featured-${ad.id}`}
          >
            <div className="flex items-start gap-4 p-4">
              {ad.imageUrl && (
                <img 
                  src={ad.imageUrl} 
                  alt={ad.title}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs border-[#d4a373] text-[#d4a373]">
                    <Megaphone className="h-2.5 w-2.5 mr-1" />
                    Sponsored
                  </Badge>
                </div>
                <h4 className="font-semibold text-sm line-clamp-1">{ad.title}</h4>
                {ad.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ad.description}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (placementType === "category_spotlight") {
    const ad = ads[0];
    return (
      <div 
        className={`relative bg-gradient-to-r from-[#8a9a5b]/10 to-[#8a9a5b]/5 border border-[#8a9a5b]/20 rounded-lg p-4 ${className}`}
        data-testid={`ad-spotlight-${ad.id}`}
      >
        <Badge variant="outline" className="text-xs border-[#8a9a5b] text-[#8a9a5b] mb-2">
          <Megaphone className="h-2.5 w-2.5 mr-1" />
          Category Spotlight
        </Badge>
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => handleClick(ad)}
        >
          {ad.imageUrl && (
            <img 
              src={ad.imageUrl}
              alt={ad.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div>
            <h4 className="font-semibold text-sm">{ad.title}</h4>
            {ad.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{ad.description}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
