import { useState } from "react";
import { Calendar as CalendarIcon, MapPin, ArrowRight, ExternalLink, Image as ImageIcon, Clock, Crown, Star, X } from "lucide-react";
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
      <Card
        className={`group overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl flex flex-col h-full cursor-pointer ${
          adSize === "large"
            ? "border-2 border-amber-400/60 ring-1 ring-amber-300/30 shadow-amber-200/30"
            : adSize === "medium"
            ? "border border-[#0a4a82]/30 shadow-blue-100/20"
            : "border border-border/50 hover:border-primary/30"
        }`}
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

        <div className={`relative overflow-hidden bg-muted ${adSize === "large" ? "h-56" : "h-48"}`}>
          {showImage && event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0a4a82]/10 to-[#0a4a82]/5 flex items-center justify-center">
              <CalendarIcon className="h-12 w-12 text-[#0a4a82]/15" />
            </div>
          )}

          {showImage && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          )}

          <div className="absolute top-3 right-3 bg-white/95 rounded-xl p-2.5 text-center min-w-[4rem] border border-white/50 shadow-md backdrop-blur-sm">
            <div className="text-xs font-bold text-[#0a4a82] uppercase tracking-wider">
              {format(date, "MMM")}
            </div>
            <div className="text-2xl font-bold text-slate-900 leading-none mt-0.5">
              {format(date, "d")}
            </div>
          </div>
        </div>

        <CardContent className="p-5 flex-1 flex flex-col">
          <h3 className={`font-bold mb-2 group-hover:text-[#0a4a82] transition-colors ${adSize === "large" ? "text-xl" : "text-lg"} line-clamp-2`}>
            {event.title}
          </h3>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 shrink-0 text-[#0a4a82]/60" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Clock className="h-4 w-4 shrink-0 text-[#0a4a82]/60" />
            <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
          </div>

          {showDescription && event.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
              {event.description}
            </p>
          )}
          {!showDescription && <div className="flex-1" />}

          <div className="flex flex-col gap-2 mt-auto">
            {showFlyerLink && event.flyerUrl && (
              <Button
                variant="default"
                className="w-full bg-gradient-to-r from-[#0a4a82] to-[#1e6bb8] hover:from-[#0a4a82]/90 hover:to-[#1e6bb8]/90 text-white rounded-xl shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetail(true);
                }}
                data-testid={`link-event-flyer-${event.id}`}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Event Flyer / Details
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full group-hover:border-[#0a4a82]/50 group-hover:text-[#0a4a82] group-hover:bg-[#0a4a82]/5 rounded-xl shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(true);
              }}
              data-testid={`button-event-details-${event.id}`}
            >
              Event Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

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
