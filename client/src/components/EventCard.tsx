import { useState } from "react";
import { Calendar as CalendarIcon, MapPin, ArrowRight, Image as ImageIcon, Clock, Crown, Star, Video, AlertTriangle, Waves, Sparkles } from "lucide-react";
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
import { ExampleEventBanner } from "@/components/ExampleBanner";

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

function DateBlock({ date, variant = "light" }: { date: Date; variant?: "light" | "dark" | "overlay" }) {
  const baseClasses = "rounded-xl text-center shadow-lg";
  const classes = variant === "overlay"
    ? `${baseClasses} bg-white/95 backdrop-blur-sm border border-white/50 p-3 min-w-[4.5rem]`
    : variant === "dark"
    ? `${baseClasses} bg-[#0a4a82] text-white p-3 min-w-[4.5rem]`
    : `${baseClasses} bg-gradient-to-br from-[#0a4a82] to-[#083a6a] text-white p-2.5 min-w-[3.5rem]`;

  return (
    <div className={classes}>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${
        variant === "overlay" ? "text-[#d4a373]" : "text-white/80"
      }`}>
        {format(date, "MMM")}
      </div>
      <div className={`text-2xl font-black leading-none mt-0.5 ${
        variant === "overlay" ? "text-[#1a1a2e]" : ""
      }`}>
        {format(date, "d")}
      </div>
      <div className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${
        variant === "overlay" ? "text-slate-500" : "text-white/60"
      }`}>
        {format(date, "EEE")}
      </div>
    </div>
  );
}

export function EventCard({ event }: EventCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const date = new Date(event.date);
  const adSize = getAdSizeLevel(event.adSize);

  const showImage = adSize === "medium" || adSize === "large";
  const showFlyerLink = adSize === "large";
  const badge = getAdSizeBadge(adSize);

  return (
    <>
      {adSize === "large" ? (
        <Card
          className="group overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 rounded-2xl cursor-pointer border-2 border-amber-400/60 ring-1 ring-amber-300/30 shadow-amber-200/30 relative"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          {event.isExample && <ExampleEventBanner />}
          <div className="relative w-full overflow-hidden">
            <div className="relative h-[300px] md:h-[380px] w-full overflow-hidden">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50 flex items-center justify-center">
                  <div className="text-center">
                    <CalendarIcon className="h-16 w-16 text-amber-300/60 mx-auto" />
                    <Waves className="h-8 w-8 text-amber-200/40 mx-auto mt-2" />
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              {badge && (
                <div className="absolute top-4 left-4 z-20">
                  <div className={`bg-gradient-to-r ${badge.gradient} text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-sm`}>
                    <badge.icon className="h-3.5 w-3.5" />
                    {badge.label}
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <DateBlock date={date} variant="overlay" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg mb-3">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-white/90">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <MapPin className="h-4 w-4 text-amber-300" /><span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Clock className="h-4 w-4 text-amber-300" /><span>{format(date, "EEEE, MMMM d")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-5 md:p-6 bg-gradient-to-b from-white to-amber-50/30">
            {event.description && <p className="text-base text-slate-600 line-clamp-3 mb-4 leading-relaxed">{event.description}</p>}
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
                <Button variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-md px-6 font-semibold" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`link-event-flyer-${event.id}`}>
                  <ImageIcon className="h-4 w-4 mr-2" /> View Event Flyer
                </Button>
              )}
              <Button variant="outline" className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 px-6 font-semibold" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
                Event Details <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : adSize === "medium" ? (
        <Card
          className="group overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 rounded-2xl flex flex-col h-full cursor-pointer border border-[#0a4a82]/20 hover:border-[#0a4a82]/40 relative bg-white"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          {event.isExample && <ExampleEventBanner />}
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
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0a4a82]/10 via-sky-50 to-[#d4a373]/10 flex items-center justify-center">
                <div className="text-center">
                  <CalendarIcon className="h-12 w-12 text-[#0a4a82]/20 mx-auto" />
                  <Waves className="h-6 w-6 text-[#0a4a82]/10 mx-auto mt-1" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute top-3 right-3">
              <DateBlock date={date} variant="overlay" />
            </div>
          </div>
          <CardContent className="p-5 flex-1 flex flex-col bg-gradient-to-b from-white to-slate-50/50">
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3 group-hover:text-[#0a4a82] transition-colors line-clamp-2">{event.title}</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-7 h-7 rounded-lg bg-[#0a4a82]/8 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-[#0a4a82]" />
                </div>
                <span className="line-clamp-1">{event.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-7 h-7 rounded-lg bg-[#d4a373]/10 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-[#d4a373]" />
                </div>
                <span>{format(date, "EEEE, MMMM d")}</span>
              </div>
            </div>
            {event.description && <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1 leading-relaxed">{event.description}</p>}
            <Button variant="outline" className="w-full group-hover:border-[#0a4a82]/50 group-hover:text-[#0a4a82] group-hover:bg-[#0a4a82]/5 rounded-xl shadow-sm mt-auto font-semibold" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
              Event Details <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="group overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500 rounded-2xl cursor-pointer border border-slate-200/80 hover:border-[#0a4a82]/30 relative bg-white"
          data-testid={`card-event-${event.id}`}
          onClick={() => setShowDetail(true)}
        >
          {event.isExample && <ExampleEventBanner />}
          <CardContent className={`p-0 ${event.isExample ? "pt-6" : ""}`}>
            <div className="flex gap-4 p-4">
              <DateBlock date={date} variant="dark" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#1a1a2e] group-hover:text-[#0a4a82] transition-colors line-clamp-2 leading-snug mb-2">{event.title}</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0 text-[#0a4a82]/60" /><span className="line-clamp-1">{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3 w-3 shrink-0 text-[#d4a373]/80" /><span>{format(date, "EEE, MMM d")}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button className="w-full text-center text-xs font-semibold text-[#0a4a82] hover:text-[#083a6a] flex items-center justify-center gap-1 transition-colors" onClick={(e) => { e.stopPropagation(); setShowDetail(true); }} data-testid={`button-event-details-${event.id}`}>
                View Details <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-0 shadow-2xl">
          {event.imageUrl && showImage ? (
            <div className="relative h-64 md:h-72 w-full overflow-hidden rounded-t-2xl">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e]/90 via-[#1a1a2e]/40 to-transparent" />
              {badge && (
                <div className="absolute top-4 left-4 z-10">
                  <div className={`bg-gradient-to-r ${badge.gradient} text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5`}>
                    <badge.icon className="h-3.5 w-3.5" />
                    {badge.label} Event
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <DateBlock date={date} variant="overlay" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg leading-tight">{event.title}</h2>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-t-2xl">
              <div className="bg-gradient-to-br from-[#0a4a82] via-[#0a4a82]/90 to-[#083a6a] px-6 pt-8 pb-6">
                <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.06]">
                  <Waves className="w-full h-full" />
                </div>
                <div className="absolute bottom-0 left-0 w-32 h-32 opacity-[0.04]">
                  <CalendarIcon className="w-full h-full" />
                </div>
                {badge && (
                  <div className="mb-4">
                    <div className={`inline-flex items-center gap-1.5 bg-gradient-to-r ${badge.gradient} text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
                      <badge.icon className="h-3 w-3" />
                      {badge.label} Event
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center min-w-[4rem] border border-white/20">
                    <div className="text-[10px] font-bold text-[#d4a373] uppercase tracking-widest">{format(date, "MMM")}</div>
                    <div className="text-3xl font-black text-white leading-none mt-0.5">{format(date, "d")}</div>
                    <div className="text-[9px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">{format(date, "EEE")}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-2">{event.title}</h2>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-white/80 text-sm bg-white/10 px-3 py-1 rounded-full">
                        <Clock className="h-3.5 w-3.5 text-[#d4a373]" />
                        {format(date, "h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-[#d4a373] via-[#8a9a5b] to-[#0a4a82]" />
            </div>
          )}

          <div className="p-6 space-y-5 bg-gradient-to-b from-white to-slate-50/50">
            {event.isExample && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-300/30 rounded-xl" data-testid="banner-example-event-detail">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <p className="text-xs font-semibold text-orange-700">
                  This is an example event — not a real event. It shows what your event listing could look like!
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <div className="inline-flex items-center gap-2.5 bg-[#0a4a82]/8 text-[#0a4a82] px-4 py-2.5 rounded-xl text-sm font-medium border border-[#0a4a82]/10">
                <div className="w-8 h-8 rounded-lg bg-[#0a4a82]/10 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#0a4a82]/60 font-bold">Date & Time</div>
                  <div className="font-semibold">{format(date, "EEEE, MMMM d, yyyy")}</div>
                  <div className="text-xs text-[#0a4a82]/70">{format(date, "h:mm a")}</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2.5 bg-[#8a9a5b]/8 text-[#8a9a5b] px-4 py-2.5 rounded-xl text-sm font-medium border border-[#8a9a5b]/10">
                <div className="w-8 h-8 rounded-lg bg-[#8a9a5b]/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#8a9a5b]/60 font-bold">Location</div>
                  <div className="font-semibold">{event.location}</div>
                </div>
              </div>
            </div>

            {event.description && (
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">About This Event</h4>
                <p className="text-slate-700 leading-relaxed text-[15px]">{event.description}</p>
              </div>
            )}

            {showFlyerLink && event.flyerUrl && (
              <div className="rounded-xl overflow-hidden border border-amber-200/60 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/40">
                  <ImageIcon className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-900">Event Flyer</span>
                </div>
                <img
                  src={event.flyerUrl}
                  alt={`${event.title} flyer`}
                  className="w-full object-contain max-h-[500px] bg-white"
                  data-testid={`img-event-flyer-${event.id}`}
                />
              </div>
            )}

            {event.promoVideoUrl && (
              <div className="rounded-xl overflow-hidden border border-[#d4a373]/20 shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-amber-200/40">
                  <Video className="h-4 w-4 text-[#d4a373]" />
                  <span className="text-sm font-bold text-amber-800">Event Promo Video</span>
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

            <div className="pt-2">
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-[#0a4a82] to-[#083a6a] hover:from-[#083a6a] hover:to-[#062d54] text-white font-semibold h-11 shadow-md"
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
