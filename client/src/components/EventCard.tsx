import { Calendar as CalendarIcon, MapPin, ArrowRight, ExternalLink, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type EventWithTier } from "@shared/schema";

function getTierDisplayLevel(tier: string | null | undefined): "bronze" | "silver" | "gold" {
  if (!tier) return "bronze";
  const normalized = tier === "premium" ? "gold" : tier === "standard" ? "silver" : tier === "basic" ? "bronze" : tier;
  if (normalized === "gold") return "gold";
  if (normalized === "silver") return "silver";
  return "bronze";
}

interface EventCardProps {
  event: EventWithTier;
}

export function EventCard({ event }: EventCardProps) {
  const date = new Date(event.date);
  const tierLevel = getTierDisplayLevel(event.businessMembershipTier);
  const showImage = tierLevel === "silver" || tierLevel === "gold";
  const showDescription = tierLevel === "silver" || tierLevel === "gold";
  const showFlyerLink = tierLevel === "gold";
  
  return (
    <Card className="group overflow-hidden border border-border/50 hover:border-primary/30 shadow-md hover:shadow-xl transition-shadow duration-300 rounded-2xl flex flex-col h-full" data-testid={`card-event-${event.id}`}>
      <div className="relative h-48 overflow-hidden bg-muted">
        {showImage && event.imageUrl ? (
          <img 
            src={event.imageUrl} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            {showImage ? (
              <ImageIcon className="h-10 w-10 text-primary/20" />
            ) : (
              <CalendarIcon className="h-10 w-10 text-primary/20" />
            )}
          </div>
        )}
        
        <div className="absolute top-3 right-3 bg-white/95 rounded-xl p-2.5 text-center min-w-[4rem] border border-white/50 shadow-sm">
          <div className="text-xs font-bold text-primary uppercase tracking-wider">
            {format(date, "MMM")}
          </div>
          <div className="text-2xl font-display font-bold text-foreground leading-none mt-0.5">
            {format(date, "d")}
          </div>
        </div>
      </div>

      <CardContent className="p-5 flex-1 flex flex-col">
        <h3 className="font-display text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {event.title}
        </h3>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
          <span className="truncate">{event.location}</span>
        </div>
        
        {showDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
            {event.description}
          </p>
        )}
        {!showDescription && <div className="flex-1" />}

        <div className="flex flex-col gap-2 mt-auto">
          {showFlyerLink && event.flyerUrl && (
            <a 
              href={event.flyerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium text-[#0a4a82] bg-[#0a4a82]/10 hover:bg-[#0a4a82]/20 rounded-xl px-4 py-2 transition-colors"
              data-testid={`link-event-flyer-${event.id}`}
            >
              <ExternalLink className="h-4 w-4" />
              View Event Flyer / Details
            </a>
          )}
          <Button 
            variant="outline" 
            className="w-full group-hover:border-primary/50 group-hover:text-primary group-hover:bg-primary/5 rounded-xl shadow-sm"
            data-testid={`button-event-details-${event.id}`}
          >
            Event Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
