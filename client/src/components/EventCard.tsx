import { Calendar as CalendarIcon, MapPin, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Event } from "@shared/schema";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const date = new Date(event.date);
  
  return (
    <Card className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg rounded-2xl flex flex-col h-full">
      <div className="relative h-48 overflow-hidden bg-muted">
        {event.imageUrl ? (
          <img 
            src={event.imageUrl} 
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <CalendarIcon className="h-10 w-10 text-primary/20" />
          </div>
        )}
        
        {/* Date Badge */}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-xl p-2 shadow-sm text-center min-w-[3.5rem] border border-border/50">
          <div className="text-xs font-bold text-primary uppercase tracking-wider">
            {format(date, "MMM")}
          </div>
          <div className="text-xl font-display font-bold text-foreground leading-none mt-0.5">
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
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
          {event.description}
        </p>

        <Button variant="outline" className="w-full mt-auto group-hover:border-primary/50 group-hover:text-primary group-hover:bg-primary/5 rounded-xl">
          Event Details
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
