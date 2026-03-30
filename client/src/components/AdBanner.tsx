import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, ArrowRight, Star } from "lucide-react";
import { useLocation } from "@/context/LocationContext";
import type { AdPlacement } from "@shared/schema";

interface AdBannerProps {
  placementType: "homepage_banner" | "large_banner" | "medium_banner" | "small_banner" | "featured_listing";
  category?: string;
  className?: string;
  limit?: number;
}

const PLACEHOLDER_ADS: Record<string, { title: string; description: string; imageUrl: string; linkUrl: string }[]> = {
  homepage_banner: [{
    title: "Trusted Local Pros — HVAC, Electrical, Plumbing & More",
    description: "Find licensed and insured contractors right here in Moyock, NC. From emergency repairs to full home renovations — your neighbors trust Local List 365.",
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&h=400&fit=crop",
    linkUrl: "/directory",
  }],
  large_banner: [{
    title: "Full-Service Home Repairs, Renovations & Emergency Calls",
    description: "Licensed and insured contractors serving Moyock, NC. From emergency plumbing to full kitchen remodels — we do it all.",
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop",
    linkUrl: "/directory",
  }],
  medium_banner: [{
    title: "24/7 Emergency HVAC & Plumbing",
    description: "Same-day service from licensed technicians. Serving Moyock & surrounding areas.",
    imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=600&h=300&fit=crop",
    linkUrl: "/directory",
  }],
  small_banner: [{
    title: "Lawn Care & Landscaping",
    description: "Weekly mowing and seasonal cleanups for Moyock homes and businesses.",
    imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=200&fit=crop",
    linkUrl: "/directory",
  }],
  featured_listing: [
    {
      title: "24/7 Emergency HVAC & Plumbing",
      description: "Licensed technicians serving Moyock, NC & surrounding areas. Same-day service available — call now for a free estimate.",
      imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=200&h=200&fit=crop",
      linkUrl: "/directory",
    },
    {
      title: "Affordable Landscaping & Lawn Care",
      description: "Weekly mowing, seasonal cleanups, and custom landscape design for Moyock homes and businesses.",
      imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=200&h=200&fit=crop",
      linkUrl: "/directory",
    },
  ],
};

export function AdBanner({ placementType, category, className = "", limit = 1 }: AdBannerProps) {
  const impressionsSent = useRef<Set<number>>(new Set());
  const { location: selectedLocation } = useLocation();
  const zipCode = selectedLocation?.zipCode || "27958";
  
  const queryKey = ["/api/ads/active", placementType, category, zipCode].filter(Boolean);

  const { data: ads } = useQuery<AdPlacement[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ 
        type: placementType,
        zipCode,
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

  if (placementType === "large_banner" || placementType === "medium_banner" || placementType === "small_banner") {
    const ad = hasRealAds ? ads[0] : null;
    const placeholder = placeholders[0];
    const title = ad?.title || placeholder?.title || "";
    const description = ad?.description || placeholder?.description || "";
    const imageUrl = ad?.imageUrl || placeholder?.imageUrl || "";
    const isPlaceholder = !ad;

    const sizeConfig = {
      large_banner: { 
        height: "min-h-[280px] md:min-h-[320px]", 
        rounded: "rounded-2xl", 
        padding: "p-8 md:p-12", 
        titleSize: "text-3xl md:text-4xl", 
        descSize: "text-base md:text-lg",
        showDesc: true, 
        badge: "bg-amber-500", 
        badgeSize: "text-sm px-3 py-1",
        label: "Large Ad — $1,000/mo",
        iconSize: "h-4 w-4",
        imgOpacity: "opacity-30 group-hover:opacity-40",
      },
      medium_banner: { 
        height: "min-h-[180px] md:min-h-[200px]", 
        rounded: "rounded-xl", 
        padding: "p-6 md:p-8", 
        titleSize: "text-xl md:text-2xl", 
        descSize: "text-sm",
        showDesc: true, 
        badge: "bg-[#0a4a82]", 
        badgeSize: "text-xs px-2.5 py-0.5",
        label: "Medium Ad — $500/mo",
        iconSize: "h-3.5 w-3.5",
        imgOpacity: "opacity-25 group-hover:opacity-30",
      },
      small_banner: { 
        height: "min-h-[90px] md:min-h-[100px]", 
        rounded: "rounded-lg", 
        padding: "p-4 md:p-5", 
        titleSize: "text-sm md:text-base", 
        descSize: "text-xs",
        showDesc: false, 
        badge: "bg-gray-600", 
        badgeSize: "text-[10px] px-2 py-0.5",
        label: "Small Ad — $250/mo",
        iconSize: "h-3 w-3",
        imgOpacity: "opacity-20 group-hover:opacity-25",
      },
    }[placementType];

    return (
      <div
        className={`relative overflow-hidden ${sizeConfig.rounded} ${sizeConfig.height} text-white cursor-pointer group flex flex-col justify-center ${className}`}
        onClick={() => {
          if (isPlaceholder) {
            window.location.href = placeholder?.linkUrl || "/directory";
          } else if (ad) {
            handleClick(ad);
          }
        }}
        data-testid={`ad-${placementType}-${ad?.id || "placeholder"}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82] via-[#0d5a9e] to-[#0a4a82]/90" />
        {imageUrl && (
          <img src={imageUrl} alt={title} className={`absolute inset-0 w-full h-full object-cover ${sizeConfig.imgOpacity} transition-opacity duration-500`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82]/80 via-[#0a4a82]/50 to-[#0a4a82]/60" />
        <div className={`relative ${sizeConfig.padding}`}>
          <Badge className={`mb-2 ${sizeConfig.badge} ${sizeConfig.badgeSize} text-white border-none`}>
            <Megaphone className={`${sizeConfig.iconSize} mr-1.5`} />
            {sizeConfig.label}
          </Badge>
          <h3 className={`${sizeConfig.titleSize} font-bold mb-1 drop-shadow-lg text-white`}>{title}</h3>
          {sizeConfig.showDesc && description && (
            <p className={`text-white/95 max-w-2xl ${sizeConfig.descSize} leading-relaxed drop-shadow-sm`}>{description}</p>
          )}
        </div>
      </div>
    );
  }

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
        onClick={() => isPlaceholder ? (window.location.href = "/directory") : ad && handleClick(ad)}
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a4a82]/80 via-[#0a4a82]/50 to-[#0a4a82]/60" />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <Badge className="mb-3 bg-white/20 text-white border border-white/20 hover:bg-white/25">
              <Megaphone className="h-3 w-3 mr-1.5" />
              {isPlaceholder ? "Ad Space Available" : "Sponsored"}
            </Badge>
            <h3 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg">{title}</h3>
            <p className="text-white/95 max-w-2xl text-sm md:text-base leading-relaxed drop-shadow-sm">{description}</p>
          </div>
          <button
            className="flex items-center gap-2 bg-[#d4a373] text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-[#c49363] shadow-[0_4px_15px_rgba(212,163,115,0.4)] hover:shadow-[0_6px_25px_rgba(212,163,115,0.5)] hover:-translate-y-0.5 transition-[shadow,transform,background-color] duration-200 whitespace-nowrap"
            data-testid={`ad-cta-${ad?.id || "placeholder"}`}
          >
            {isPlaceholder ? "Advertise Here" : "Learn More"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (placementType === "featured_listing") {
    const displayAds = hasRealAds ? ads : placeholders.slice(0, limit);
    return (
      <div className={`space-y-4 ${className}`}>
        {displayAds.map((ad, i) => {
          const isPlaceholder = !hasRealAds;
          const realAd = ad as AdPlacement;
          return (
            <Card 
              key={isPlaceholder ? `ph-${i}` : realAd.id}
              className="overflow-hidden border-[#d4a373]/30 hover:border-[#d4a373]/60 hover:shadow-[0_8px_30px_rgba(212,163,115,0.15)] transition-[shadow,border-color] duration-200 cursor-pointer group"
              onClick={() => isPlaceholder ? (window.location.href = "/directory") : handleClick(realAd)}
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
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-[#0a4a82] group-hover:translate-x-1 transition-[color,transform] duration-200 flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  return null;
}
