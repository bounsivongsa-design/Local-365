import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, ArrowRight, Star, Sparkles } from "lucide-react";
import type { AdPlacement } from "@shared/schema";

interface AdBannerProps {
  placementType: "homepage_banner" | "featured_listing" | "category_spotlight" | "directory_boost";
  category?: string;
  className?: string;
  limit?: number;
}

const PLACEHOLDER_ADS: Record<string, { title: string; description: string; imageUrl: string; linkUrl: string }[]> = {
  homepage_banner: [{
    title: "Your Business Could Be Here",
    description: "Reach thousands of local customers with a premium homepage banner. Get noticed first when visitors land on Local List 365.",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=400&fit=crop",
    linkUrl: "/advertising",
  }],
  featured_listing: [
    {
      title: "Premium Featured Listing",
      description: "Stand out in the directory with a highlighted business card. Your listing appears above organic results.",
      imageUrl: "https://images.unsplash.com/photo-1560472355-536de3962603?w=200&h=200&fit=crop",
      linkUrl: "/advertising",
    },
    {
      title: "Boost Your Visibility",
      description: "Get 3x more views with a featured placement. Perfect for new businesses looking to grow quickly.",
      imageUrl: "https://images.unsplash.com/photo-1553729459-uj1ghg6hg7?w=200&h=200&fit=crop",
      linkUrl: "/advertising",
    },
  ],
  category_spotlight: [{
    title: "Category Spotlight Available",
    description: "Be the go-to business in your category. Exclusive placement above search results.",
    imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=100&h=100&fit=crop",
    linkUrl: "/advertising",
  }],
  directory_boost: [{
    title: "Directory Boost Ad Space",
    description: "Increase your ranking in directory results with a boosted listing placement.",
    imageUrl: "https://images.unsplash.com/photo-1553484771-047a44eee27b?w=200&h=200&fit=crop",
    linkUrl: "/advertising",
  }],
};

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

  useEffect(() => {
    if (ads && ads.length > 0) {
      ads.forEach(ad => {
        if (!impressionsSent.current.has(ad.id)) {
          impressionsSent.current.add(ad.id);
          fetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {});
        }
      });
    }
  }, [ads]);

  const handleClick = (ad: AdPlacement) => {
    fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasRealAds = ads && ads.length > 0;
  const placeholders = PLACEHOLDER_ADS[placementType] || [];

  if (placementType === "homepage_banner") {
    const ad = hasRealAds ? ads[0] : null;
    const placeholder = placeholders[0];
    const title = ad?.title || placeholder?.title || "";
    const description = ad?.description || placeholder?.description || "";
    const imageUrl = ad?.imageUrl || placeholder?.imageUrl || "";
    const isPlaceholder = !ad;

    return (
      <div 
        className={`relative overflow-hidden rounded-2xl text-white cursor-pointer group ${className}`}
        onClick={() => isPlaceholder ? (window.location.href = "/advertising") : ad && handleClick(ad)}
        data-testid={`ad-banner-${ad?.id || "placeholder"}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82] via-[#0d5a9e] to-[#0a4a82]/90" />
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={title} 
            className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-25 transition-opacity duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82]/70 via-transparent to-[#0a4a82]/50" />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <Badge className="mb-3 bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20">
              <Megaphone className="h-3 w-3 mr-1.5" />
              {isPlaceholder ? "Ad Space Available" : "Sponsored"}
            </Badge>
            <h3 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-md">{title}</h3>
            <p className="text-white/85 max-w-2xl text-sm md:text-base leading-relaxed">{description}</p>
          </div>
          <button
            className="flex items-center gap-2 bg-[#d4a373] text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-[#c49363] transition-all shadow-[0_4px_15px_rgba(212,163,115,0.4)] hover:shadow-[0_6px_25px_rgba(212,163,115,0.5)] hover:-translate-y-0.5 whitespace-nowrap"
            data-testid={`ad-cta-${ad?.id || "placeholder"}`}
          >
            {isPlaceholder ? "Advertise Here" : "Learn More"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (placementType === "featured_listing" || placementType === "directory_boost") {
    const displayAds = hasRealAds ? ads : placeholders.slice(0, limit);
    return (
      <div className={`space-y-4 ${className}`}>
        {displayAds.map((ad, i) => {
          const isPlaceholder = !hasRealAds;
          const realAd = ad as AdPlacement;
          return (
            <Card 
              key={isPlaceholder ? `ph-${i}` : realAd.id}
              className="overflow-hidden border-[#d4a373]/30 hover:border-[#d4a373]/60 hover:shadow-[0_8px_30px_rgba(212,163,115,0.15)] transition-all duration-300 cursor-pointer group"
              onClick={() => isPlaceholder ? (window.location.href = "/advertising") : handleClick(realAd)}
              data-testid={`ad-featured-${isPlaceholder ? `placeholder-${i}` : realAd.id}`}
            >
              <div className="flex items-center gap-4 p-4">
                {(ad as any).imageUrl && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                    <img 
                      src={(ad as any).imageUrl} 
                      alt={(ad as any).title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge className="text-xs bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/30 hover:bg-[#d4a373]/15">
                      {isPlaceholder ? <Star className="h-2.5 w-2.5 mr-1" /> : <Megaphone className="h-2.5 w-2.5 mr-1" />}
                      {isPlaceholder ? "Ad Space" : "Sponsored"}
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm group-hover:text-[#0a4a82] transition-colors">{(ad as any).title}</h4>
                  {(ad as any).description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{(ad as any).description}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[#0a4a82] group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  if (placementType === "category_spotlight") {
    const ad = hasRealAds ? ads[0] : null;
    const placeholder = placeholders[0];
    const title = (ad as any)?.title || placeholder?.title || "";
    const description = (ad as any)?.description || placeholder?.description || "";
    const imageUrl = (ad as any)?.imageUrl || placeholder?.imageUrl || "";
    const isPlaceholder = !ad;

    return (
      <div 
        className={`relative bg-gradient-to-r from-[#8a9a5b]/10 via-[#8a9a5b]/5 to-transparent border border-[#8a9a5b]/20 rounded-xl p-4 cursor-pointer group hover:border-[#8a9a5b]/40 hover:shadow-[0_4px_20px_rgba(138,154,91,0.1)] transition-all duration-300 ${className}`}
        onClick={() => isPlaceholder ? (window.location.href = "/advertising") : handleClick(ad!)}
        data-testid={`ad-spotlight-${(ad as any)?.id || "placeholder"}`}
      >
        <Badge className="text-xs bg-[#8a9a5b]/10 text-[#8a9a5b] border border-[#8a9a5b]/30 mb-2 hover:bg-[#8a9a5b]/15">
          {isPlaceholder ? <Sparkles className="h-2.5 w-2.5 mr-1" /> : <Megaphone className="h-2.5 w-2.5 mr-1" />}
          {isPlaceholder ? "Spotlight Available" : "Category Spotlight"}
        </Badge>
        <div className="flex items-center gap-3">
          {imageUrl && (
            <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm flex-shrink-0">
              <img 
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-sm group-hover:text-[#8a9a5b] transition-colors">{title}</h4>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[#8a9a5b] group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>
      </div>
    );
  }

  return null;
}
