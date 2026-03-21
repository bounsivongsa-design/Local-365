import { useState } from "react";
import { Calendar as CalendarIcon, MapPin, ArrowRight, ExternalLink, Image as ImageIcon, Clock, Crown, Star, X, Video } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type EventWithTier } from "@shared/schema";

function getAdSizeLevel(adSize: string | null | undefined): "small" | "medium" | "large" {
  if (adSize === "large") return "large";
  if (adSize === "medium") return "medium";
  return "small";
}

function getAdSizeBadge(size: "small" | "medium" | "large") {
  switch (size) {
    case "large":
      return { label: "Featured", gradient: "from-amber-500 to-orange-500", icon: Star };
    case "medium":
      return { label: "Promoted", gradient: "from-[#0a4a82] to-[#1e6bb8]", icon: Crown };
    default:
      return null;
  }
}

interface EventCardProps {
  event: EventWithTier;
}

export function EventCard({ event }: EventCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const date = new Date(event.date);
  const adSize = getAdSizeLevel(event.adSize);

  const showImage = adSize === "medium" || adSize === "large";
  const showDescription = adSize === "medium" || adSize === "large";
  const showFlyerLink = adSize === "large";
  const badge = getAdSizeBadge(adSize);

  return (
    <>
      {adSize === "large" ? (
        <Card
          className="group overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl cursor-pointer border-2 border-amber-400/60 ring-1 ring-amber-300/30 shadow-amber-200/30 relative"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          <div className="relative w-full overflow-hidden">
            <div className="relative h-[300px] md:h-[380px] w-full overflow-hidden">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
                  <CalendarIcon className="h-16 w-16 text-amber-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
              {badge && (
                <div className="absolute top-4 left-4 z-20">
                  <div className={`bg-gradient-to-r ${badge.gradient} text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1.5`}>
                    <badge.icon className="h-3.5 w-3.5" />
                    {badge.label}
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/95 rounded-xl p-3 text-center min-w-[4.5rem] border border-white/50 shadow-lg backdrop-blur-sm">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">{format(date, "MMM")}</div>
                <div className="text-3xl font-bold text-slate-900 leading-none mt-0.5">{format(date, "d")}</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg mb-2">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-white/90 mb-3">
                  <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-amber-300" /><span>{event.location}</span></div>
                  <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-300" /><span>{format(date, "EEEE, MMMM d, yyyy")}</span></div>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-5 md:p-6 bg-white">
            {event.description && <p className="text-base text-slate-600 line-clamp-3 mb-4">{event.description}</p>}
            {event.promoVideoUrl && (
              <div className="rounded-xl overflow-hidden border border-amber-200 shadow-sm mb-4">
                <video
                  src={event.promoVideoUrl}
                  controls
                  className="w-full max-h-48 object-contain bg-black"
                  preload="metadata"
                  data-testid={`video-event-promo-${event.id}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {event.flyerUrl && (
                <Button variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-md px-6" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`link-event-flyer-${event.id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" /> View Event Flyer
                </Button>
              )}
              <Button variant="outline" className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 px-6" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
                Event Details <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : adSize === "medium" ? (
        <Card
          className="group overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl flex flex-col h-full cursor-pointer border border-[#0a4a82]/30 shadow-blue-100/20 relative"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          {badge && (
            <div className="absolute top-3 left-3 z-20">
              <div className={`bg-gradient-to-r ${badge.gradient} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5`}>
                <badge.icon className="h-3 w-3" />
                {badge.label}
              </div>
            </div>
          )}
          <div className="relative overflow-hidden bg-muted h-52">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0a4a82]/10 to-[#0a4a82]/5 flex items-center justify-center">
                <CalendarIcon className="h-12 w-12 text-[#0a4a82]/15" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute top-3 right-3 bg-white/95 rounded-xl p-2.5 text-center min-w-[4rem] border border-white/50 shadow-md backdrop-blur-sm">
              <div className="text-xs font-bold text-[#0a4a82] uppercase tracking-wider">{format(date, "MMM")}</div>
              <div className="text-2xl font-bold text-slate-900 leading-none mt-0.5">{format(date, "d")}</div>
            </div>
          </div>
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-2 group-hover:text-[#0a4a82] transition-colors line-clamp-2">{event.title}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              <MapPin className="h-4 w-4 shrink-0 text-[#0a4a82]" /><span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
              <Clock className="h-4 w-4 shrink-0 text-[#0a4a82]" /><span>{format(date, "EEEE, MMMM d, yyyy")}</span>
            </div>
            {event.description && <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">{event.description}</p>}
            <Button variant="outline" className="w-full group-hover:border-[#0a4a82]/50 group-hover:text-[#0a4a82] group-hover:bg-[#0a4a82]/5 rounded-xl shadow-sm mt-auto" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
              Event Details <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="group overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer border border-border/50 hover:border-[#0a4a82]/30 aspect-square max-w-[280px]"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              <div className="bg-[#0a4a82] text-white rounded-lg px-3 py-2 text-center mb-3 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{format(date, "MMM")}</div>
                <div className="text-2xl font-bold leading-none mt-0.5">{format(date, "d")}</div>
              </div>
              <h3 className="text-sm font-bold text-[#1a1a2e] group-hover:text-[#0a4a82] transition-colors line-clamp-3 leading-snug">{event.title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2">
                <MapPin className="h-3 w-3 shrink-0 text-[#0a4a82]" /><span className="line-clamp-1">{event.location}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                <Clock className="h-3 w-3 shrink-0 text-[#0a4a82]" /><span>{format(date, "MMM d, yyyy")}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-[#0a4a82] font-semibold hover:bg-[#0a4a82]/5 rounded-lg text-xs mt-2" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
              View Details <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
          {event.imageUrl && (showImage) && (
            <div className="relative h-64 w-full overflow-hidden rounded-t-2xl">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <h2 className="text-2xl font-bold text-white drop-shadow-lg">{event.title}</h2>
              </div>
            </div>
          )}

          <div className="p-6 space-y-5">
            {!(event.imageUrl && showImage) && (
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-900">{event.title}</DialogTitle>
              </DialogHeader>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 bg-[#0a4a82]/10 text-[#0a4a82] px-4 py-2 rounded-xl text-sm font-medium">
                <CalendarIcon className="h-4 w-4" />
                {format(date, "EEEE, MMMM d, yyyy")}
              </div>
              <div className="inline-flex items-center gap-2 bg-[#8a9a5b]/10 text-[#8a9a5b] px-4 py-2 rounded-xl text-sm font-medium">
                <MapPin className="h-4 w-4" />
                {event.location}
              </div>
              {badge && (
                <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${badge.gradient} text-white px-3 py-2 rounded-xl text-sm font-bold shadow-sm`}>
                  <badge.icon className="h-3.5 w-3.5" />
                  {badge.label} Event
                </div>
              )}
            </div>

            {event.description && (
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed text-base">{event.description}</p>
              </div>
            )}

            {showFlyerLink && event.flyerUrl && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                    <ExternalLink className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm">Event Flyer Available</p>
                    <p className="text-xs text-amber-700/80">View the official flyer for more details</p>
                  </div>
                  <a
                    href={event.flyerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:shadow-lg transition-shadow"
                    data-testid={`link-event-flyer-external-${event.id}`}
                  >
                    View Flyer
                  </a>
                </div>
              </div>
            )}

            {event.promoVideoUrl && (
              <div className="rounded-xl overflow-hidden border border-[#d4a373]/20 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-amber-200/40">
                  <Video className="h-4 w-4 text-[#d4a373]" />
                  <span className="text-sm font-semibold text-amber-800">Event Promo Video</span>
                  <span className="text-xs bg-gradient-to-r from-yellow-600 to-amber-500 text-white px-2 py-0.5 rounded-full font-bold ml-auto">Gold</span>
                </div>
                <video
                  src={event.promoVideoUrl}
                  controls
                  className="w-full max-h-64 object-contain bg-black"
                  preload="metadata"
                  data-testid={`video-event-detail-${event.id}`}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowDetail(false)}
                data-testid={`button-close-event-detail-${event.id}`}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
