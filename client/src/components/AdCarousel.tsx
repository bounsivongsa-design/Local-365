import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExampleBanner } from "@/components/ExampleBanner";
import { Link } from "react-router-dom";
import { Megaphone, Sparkles, X, ExternalLink } from "lucide-react";
import type { AdPlacement } from "@shared/schema";

interface AdWithBusiness extends AdPlacement {
  businessName: string | null;
  businessImageUrl: string | null;
}

type AdSlide = { id: number; title: string; businessName: string; description: string; imageUrl: string; businessId: number | null; linkUrl: string | null; isPlaceholderFill?: boolean };

const LARGE_PLACEHOLDERS: AdSlide[] = [
  { id: 0, title: "Full-Service Home Repairs, Renovations & Emergency Calls", businessName: "Moyock Home Services", description: "Licensed and insured contractors serving Moyock and surrounding areas. From emergency plumbing to full kitchen remodels — we do it all.", imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Custom Homes, Additions & Luxury Renovations", businessName: "Coastal Builders Inc.", description: "Award-winning construction company building dream homes across Moyock. From blueprints to move-in day — your vision, our craftsmanship.", imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Coastal Roofing — Storm-Ready Solutions", businessName: "Moyock Roofing Co.", description: "GAF-certified roofing pros. Free storm damage inspections, insurance claim assistance, and 25-year warranties on every job.", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&h=400&fit=crop", businessId: null, linkUrl: null },
];

const MEDIUM_PLACEHOLDERS: AdSlide[] = [
  { id: 0, title: "24/7 Emergency HVAC & Plumbing", businessName: "Moyock Climate Control", description: "Same-day service from licensed technicians.", imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Mobile Mechanic — We Come to You", businessName: "Moyock Auto Pros", description: "On-site auto repair and diagnostics.", imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Professional Tree Care & Removal", businessName: "Coastal Tree Care", description: "Licensed arborists for trimming & removal.", imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Custom Kitchen Remodels", businessName: "Coastal Kitchen Co.", description: "Dream kitchens, expertly crafted.", imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=300&fit=crop", businessId: null, linkUrl: null },
];

const SMALL_PLACEHOLDERS: AdSlide[] = [
  { id: 0, title: "Lawn Care & Landscaping", businessName: "Green Thumb Lawn Care", description: "", imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Pest Control Experts", businessName: "Shield Pest Solutions", description: "", imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "House Cleaning Services", businessName: "Crystal Clean Moyock", description: "", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Pressure Washing", businessName: "Sparkle Wash OBX", description: "", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Gutter Installation", businessName: "Rain Guard Gutters", description: "", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
  { id: 0, title: "Window Cleaning", businessName: "Clear View Moyock", description: "", imageUrl: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=400&h=200&fit=crop", businessId: null, linkUrl: null },
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function mapAdsToSlides(realAds: AdWithBusiness[] | undefined, placeholders: AdSlide[], minSlots?: number): { slides: AdSlide[]; isPlaceholder: boolean; realCount: number } {
  if (realAds && realAds.length > 0) {
    const mapped = realAds.map(ad => ({
      id: ad.id,
      title: ad.title,
      businessName: ad.businessName || ad.title,
      description: ad.description || "",
      imageUrl: ad.imageUrl || "",
      businessId: ad.businessId,
      linkUrl: ad.linkUrl,
    }));
    if (minSlots && mapped.length < minSlots) {
      const fillers = placeholders.slice(0, minSlots - mapped.length).map(p => ({ ...p, isPlaceholderFill: true }));
      return { slides: [...mapped, ...fillers], isPlaceholder: false, realCount: mapped.length };
    }
    return { slides: mapped, isPlaceholder: false, realCount: mapped.length };
  }
  return { slides: placeholders, isPlaceholder: true, realCount: 0 };
}

export function AdCarousel({ zipCode = "27958" }: { zipCode?: string }) {
  const [largeAdPos, setLargeAdPos] = useState(0);
  const [mediumAdPos, setMediumAdPos] = useState(0);
  const [smallAdPos, setSmallAdPos] = useState(0);
  const [previewAd, setPreviewAd] = useState<AdSlide | null>(null);
  const impressionsSent = useRef<Set<number>>(new Set());

  const { data: realLargeAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "large_banner", zipCode],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=large_banner&zipCode=${zipCode}`); return res.ok ? res.json() : []; },
  });
  const { data: realMediumAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "medium_banner", zipCode],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=medium_banner&zipCode=${zipCode}`); return res.ok ? res.json() : []; },
  });
  const { data: realSmallAds } = useQuery<AdWithBusiness[]>({
    queryKey: ["/api/ads/active", "small_banner", zipCode],
    queryFn: async () => { const res = await fetch(`/api/ads/active?type=small_banner&zipCode=${zipCode}`); return res.ok ? res.json() : []; },
  });

  const largeAdsRaw = mapAdsToSlides(realLargeAds, LARGE_PLACEHOLDERS);
  const mediumAdsRaw = mapAdsToSlides(realMediumAds, MEDIUM_PLACEHOLDERS, 2);
  const smallAdsRaw = mapAdsToSlides(realSmallAds, SMALL_PLACEHOLDERS, 3);

  const largeAds = useMemo(() => ({
    ...largeAdsRaw,
    slides: largeAdsRaw.isPlaceholder ? largeAdsRaw.slides : shuffleArray(largeAdsRaw.slides),
  }), [realLargeAds]);
  const mediumAds = useMemo(() => ({
    ...mediumAdsRaw,
    slides: mediumAdsRaw.isPlaceholder ? mediumAdsRaw.slides : shuffleArray(mediumAdsRaw.slides),
  }), [realMediumAds]);
  const smallAds = useMemo(() => ({
    ...smallAdsRaw,
    slides: smallAdsRaw.isPlaceholder ? smallAdsRaw.slides : shuffleArray(smallAdsRaw.slides),
  }), [realSmallAds]);

  const largePageCount = largeAds.slides.length;
  const mediumPageCount = Math.ceil(mediumAds.slides.length / 2);
  const smallPageCount = Math.ceil(smallAds.slides.length / 3);

  const safeLargePos = largePageCount > 0 ? Math.min(largeAdPos, largePageCount - 1) : 0;
  const safeMediumPos = mediumPageCount > 0 ? Math.min(mediumAdPos, mediumPageCount - 1) : 0;
  const safeSmallPos = smallPageCount > 0 ? Math.min(smallAdPos, smallPageCount - 1) : 0;

  const trackImpression = (adId: number) => {
    if (adId > 0 && !impressionsSent.current.has(adId)) {
      impressionsSent.current.add(adId);
      fetch(`/api/ads/${adId}/impression`, { method: "POST" }).catch(() => {});
    }
  };

  const handleAdClick = (slide: AdSlide) => {
    if (slide.id > 0) {
      setPreviewAd(slide);
    }
  };

  const handlePreviewAction = (action: "business" | "link") => {
    if (!previewAd) return;
    if (previewAd.id > 0) {
      fetch(`/api/ads/${previewAd.id}/click`, { method: "POST" }).catch(() => {});
    }
    if (action === "link" && previewAd.linkUrl) {
      const url = previewAd.linkUrl.startsWith("http") ? previewAd.linkUrl : `https://${previewAd.linkUrl}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else if (action === "business" && previewAd.businessId) {
      window.location.href = `/directory/${previewAd.businessId}`;
    }
    setPreviewAd(null);
  };

  useEffect(() => {
    if (largePageCount > 0) {
      setLargeAdPos(p => p >= largePageCount ? 0 : p);
    }
  }, [largePageCount]);

  useEffect(() => {
    if (mediumPageCount > 0) {
      setMediumAdPos(p => p >= mediumPageCount ? 0 : p);
    }
  }, [mediumPageCount]);

  useEffect(() => {
    if (smallPageCount > 0) {
      setSmallAdPos(p => p >= smallPageCount ? 0 : p);
    }
  }, [smallPageCount]);

  useEffect(() => {
    if (largePageCount <= 1) return;
    const interval = setInterval(() => {
      setLargeAdPos(p => {
        let next;
        do { next = Math.floor(Math.random() * largePageCount); } while (next === p && largePageCount > 1);
        return next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [largePageCount]);

  useEffect(() => {
    if (mediumPageCount <= 1) return;
    const interval = setInterval(() => {
      setMediumAdPos(p => {
        let next;
        do { next = Math.floor(Math.random() * mediumPageCount); } while (next === p && mediumPageCount > 1);
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [mediumPageCount]);

  useEffect(() => {
    if (smallPageCount <= 1) return;
    const interval = setInterval(() => {
      setSmallAdPos(p => {
        let next;
        do { next = Math.floor(Math.random() * smallPageCount); } while (next === p && smallPageCount > 1);
        return next;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [smallPageCount]);

  useEffect(() => {
    if (largeAds.slides[safeLargePos]) trackImpression(largeAds.slides[safeLargePos].id);
  }, [safeLargePos, largeAds.slides]);

  useEffect(() => {
    const startIdx = safeMediumPos * 2;
    for (let i = startIdx; i < startIdx + 2 && i < mediumAds.slides.length; i++) {
      trackImpression(mediumAds.slides[i].id);
    }
  }, [safeMediumPos, mediumAds.slides]);

  useEffect(() => {
    const startIdx = safeSmallPos * 3;
    for (let i = startIdx; i < startIdx + 3 && i < smallAds.slides.length; i++) {
      trackImpression(smallAds.slides[i].id);
    }
  }, [safeSmallPos, smallAds.slides]);

  return (
    <div className="bg-gradient-to-b from-[#0a3a6e] via-[#0a4a82] to-[#0a3a6e] py-12">
      <div className="container relative z-10">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl font-bold text-white">Featured Local Businesses</h2>
          <p className="text-white/85 mt-2">Premium advertising spots — <Link to="/advertising" className="text-[#d4a373] hover:underline font-semibold" data-testid="link-advertise-here">Advertise Here</Link></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr_2fr] gap-5 items-stretch">
          {/* Large Ad Column */}
          <div>
            <div className="relative rounded-2xl shadow-2xl shadow-black/30 overflow-hidden max-h-[280px] lg:max-h-none" style={{ aspectRatio: '16/9' }}>
              {largeAds.slides.map((slide, idx) => (
                <div key={slide.id > 0 ? slide.id : `lg-${idx}`} className={`absolute inset-0 transition-opacity duration-700 ${idx === safeLargePos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} data-testid={`ad-large-${idx}`}>
                  <div onClick={() => handleAdClick(slide)} className="block w-full h-full cursor-pointer">
                    <div className="relative w-full h-full overflow-hidden group">
                      {largeAds.isPlaceholder && <ExampleBanner variant="ribbon" />}
                      {slide.imageUrl && <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 bg-amber-500 text-white font-bold rounded-full uppercase tracking-wide text-[10px] px-2.5 py-1">
                            <Sparkles className="h-3 w-3" />
                            {largeAds.isPlaceholder ? "Large — $1,000/mo" : "Featured"}
                          </span>
                        </div>
                        <p className="text-[#d4a373] text-sm font-semibold tracking-wide mb-1">{slide.businessName}</p>
                        <h3 className="text-lg md:text-2xl font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                        {slide.description && <p className="text-white/90 text-xs mt-2 leading-relaxed line-clamp-3">{slide.description}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-3">
              {largeAds.slides.map((_, idx) => (
                <button key={idx} onClick={() => setLargeAdPos(idx)} className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === safeLargePos ? 'bg-[#d4a373] w-5' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-large-dot-${idx}`} />
              ))}
            </div>
          </div>

          {/* Medium Ad Column */}
          <div className="flex flex-col">
            <div className="relative rounded-xl shadow-lg shadow-black/20 overflow-hidden flex-1">
              {Array.from({ length: mediumPageCount }).map((_, pageIdx) => {
                const pageSlides = mediumAds.slides.slice(pageIdx * 2, pageIdx * 2 + 2);
                return (
                  <div key={`med-page-${pageIdx}`} className={`${pageIdx === 0 ? 'relative h-full' : 'absolute inset-0'} transition-opacity duration-700 ${pageIdx === safeMediumPos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    <div className="flex flex-col gap-3 h-full">
                      {pageSlides.map((slide, idx) => (
                        <div key={slide.id > 0 ? slide.id : `med-${pageIdx}-${idx}`} className="flex-1 min-h-0" data-testid={`ad-medium-${pageIdx * 2 + idx}`}>
                          <div onClick={() => handleAdClick(slide)} className="block w-full h-full cursor-pointer">
                            <div className="relative overflow-hidden rounded-xl group h-full" style={{ aspectRatio: '20/9' }}>
                              {(mediumAds.isPlaceholder || slide.isPlaceholderFill) && <ExampleBanner variant="ribbon" />}
                              {slide.imageUrl && <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-85 group-hover:scale-105 transition-all duration-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center gap-1 bg-[#0a4a82] text-white font-bold rounded-full uppercase tracking-wide text-[9px] px-2 py-0.5">
                                    <Megaphone className="h-2.5 w-2.5" />
                                    {(mediumAds.isPlaceholder || slide.isPlaceholderFill) ? "Medium — $500/mo" : "Featured"}
                                  </span>
                                </div>
                                <p className="text-[#d4a373] text-xs font-semibold tracking-wide mb-0.5">{slide.businessName}</p>
                                <h3 className="text-sm md:text-base font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: mediumPageCount }).map((_, idx) => (
                <button key={idx} onClick={() => setMediumAdPos(idx)} className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === safeMediumPos ? 'bg-[#d4a373] w-5' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-medium-dot-${idx}`} />
              ))}
            </div>
          </div>

          {/* Small Ad Column */}
          <div className="flex flex-col">
            <div className="relative rounded-lg shadow-md shadow-black/15 overflow-hidden flex-1">
              {Array.from({ length: smallPageCount }).map((_, pageIdx) => {
                const pageSlides = smallAds.slides.slice(pageIdx * 3, pageIdx * 3 + 3);
                return (
                  <div key={`sm-page-${pageIdx}`} className={`${pageIdx === 0 ? 'relative h-full' : 'absolute inset-0'} transition-opacity duration-700 ${pageIdx === safeSmallPos ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    <div className="flex flex-col gap-2 h-full">
                      {pageSlides.map((slide, idx) => (
                        <div key={slide.id > 0 ? slide.id : `sm-${pageIdx}-${idx}`} className="flex-1 min-h-0" data-testid={`ad-small-${pageIdx * 3 + idx}`}>
                          <div onClick={() => handleAdClick(slide)} className="block w-full h-full cursor-pointer">
                            <div className="relative overflow-hidden rounded-lg group h-full" style={{ aspectRatio: '12/5' }}>
                              {(smallAds.isPlaceholder || slide.isPlaceholderFill) && <ExampleBanner variant="ribbon" />}
                              {slide.imageUrl && <img src={slide.imageUrl} alt={slide.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="inline-flex items-center gap-1 bg-gray-600 text-white font-bold rounded-full uppercase tracking-wide text-[8px] px-1.5 py-0.5">
                                    <Megaphone className="h-2 w-2" />
                                    {(smallAds.isPlaceholder || slide.isPlaceholderFill) ? "Small — $250/mo" : "Ad"}
                                  </span>
                                </div>
                                <p className="text-[#d4a373] text-[10px] font-semibold tracking-wide">{slide.businessName}</p>
                                <h3 className="text-xs font-bold text-white drop-shadow-md leading-tight">{slide.title}</h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-1.5 mt-3">
              {Array.from({ length: smallPageCount }).map((_, idx) => (
                <button key={idx} onClick={() => setSmallAdPos(idx)} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === safeSmallPos ? 'bg-[#d4a373] w-4' : 'bg-white/40 hover:bg-white/60'}`} data-testid={`ad-small-dot-${idx}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewAd(null)} data-testid="ad-preview-overlay">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewAd(null)} className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors" data-testid="button-close-ad-preview">
              <X className="h-4 w-4" />
            </button>
            {previewAd.imageUrl && (
              <div className="relative w-full" style={{ maxHeight: '300px' }}>
                <img src={previewAd.imageUrl} alt={previewAd.title} className="w-full h-auto object-contain bg-gray-100" style={{ maxHeight: '300px' }} />
              </div>
            )}
            <div className="p-5 space-y-3">
              <div>
                <span className="inline-flex items-center gap-1 bg-amber-500 text-white font-bold rounded-full uppercase tracking-wide text-[10px] px-2.5 py-1 mb-2">
                  <Sparkles className="h-3 w-3" /> Sponsored
                </span>
                <p className="text-[#d4a373] text-sm font-semibold tracking-wide">{previewAd.businessName}</p>
                <h3 className="text-xl font-bold text-slate-900 leading-tight mt-1">{previewAd.title}</h3>
              </div>
              {previewAd.description && (
                <p className="text-slate-600 text-sm leading-relaxed">{previewAd.description}</p>
              )}
              <div className="flex gap-3 pt-2">
                {previewAd.businessId && (
                  <button onClick={() => handlePreviewAction("business")} className="flex-1 bg-[#0a4a82] hover:bg-[#0a4a82]/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm" data-testid="button-ad-view-business">
                    View Business Listing
                  </button>
                )}
                {previewAd.linkUrl && (
                  <button onClick={() => handlePreviewAction("link")} className="flex-1 bg-[#d4a373] hover:bg-[#d4a373]/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-1.5" data-testid="button-ad-visit-link">
                    <ExternalLink className="h-4 w-4" /> Visit Website
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
