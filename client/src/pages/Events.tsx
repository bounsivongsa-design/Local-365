import { useState, useRef, useEffect } from "react";
import { useEvents, useCreateEvent } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/context/LocationContext";
import { useBusiness } from "@/hooks/use-businesses";
import { useUpload } from "@/hooks/use-upload";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, LayoutGrid, List, Megaphone, Clock, Crown, Users, Zap, Video, Lock, Info, Upload, Play, Trash2, X, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertEventSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

const EVENT_BASE_PRICING = {
  event2Week: { small: 25, medium: 35, large: 50 },
  eventMonthly: { small: 50, medium: 75, large: 100 },
};

const EVENT_TIER_DISCOUNTS = [
  { id: null, name: "Non-Member", discount: 0, icon: Users, gradient: "from-slate-600 to-slate-800", badgeText: null, testId: "non-member" },
  { id: "bronze", name: "Bronze", discount: 0.10, icon: Crown, gradient: "from-amber-700 to-amber-600", badgeText: "10% OFF" },
  { id: "silver", name: "Silver", discount: 0.25, icon: Crown, gradient: "from-gray-500 to-gray-400", badgeText: "25% OFF" },
  { id: "gold", name: "Gold", discount: 0.50, icon: Crown, gradient: "from-yellow-600 to-amber-500", badgeText: "50% OFF" },
] as const;

function EventAdPricingGrid() {
  const getPrice = (base: number, discount: number) => Math.round(base * (1 - discount));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {EVENT_TIER_DISCOUNTS.map((tier) => {
        const TierIcon = tier.icon;
        const isGold = tier.id === "gold";
        return (
          <div
            key={tier.name}
            className={`relative bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border ${isGold ? "ring-2 ring-[#8a9a5b] shadow-2xl shadow-[#8a9a5b]/20" : "border-slate-200/50 dark:border-slate-700/50"}`}
            data-testid={`card-event-pricing-${tier.id || "non-member"}`}
          >
            {tier.badgeText && (
              <div className="absolute -top-0 right-4 z-10">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1.5 rounded-b-xl text-xs font-bold shadow-lg flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {tier.badgeText}
                </div>
              </div>
            )}

            <div className={`bg-gradient-to-br ${tier.gradient} p-5 text-white`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <TierIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{tier.name}</h3>
                  <p className="text-white/70 text-xs">
                    {tier.discount > 0 ? `${tier.discount * 100}% off all ads` : "Standard pricing"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">2-Week (14 Days)</h4>
                </div>
                <div className="space-y-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <div key={size} className={`rounded-xl p-3 text-center ${tier.id ? "bg-[#8a9a5b]/10 border border-[#8a9a5b]/20" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                      <p className={`text-xl font-bold ${tier.id ? "text-[#8a9a5b]" : "text-slate-900 dark:text-white"}`}>
                        ${getPrice(EVENT_BASE_PRICING.event2Week[size], tier.discount)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{size}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">30-Day Event</h4>
                </div>
                <div className="space-y-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <div key={size} className={`rounded-xl p-3 text-center ${tier.id ? "bg-[#8a9a5b]/10 border border-[#8a9a5b]/20" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                      <p className={`text-xl font-bold ${tier.id ? "text-[#8a9a5b]" : "text-slate-900 dark:text-white"}`}>
                        ${getPrice(EVENT_BASE_PRICING.eventMonthly[size], tier.discount)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{size}</p>
                    </div>
                  ))}
                </div>
              </div>

              {isGold && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-700/30" data-testid="gold-promo-video-perk-event">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">30-Sec Promo Video</span>
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1 ml-6">Upload a video spotlight to your event</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Events() {
  const { location: selectedLocation } = useLocation();
  const { data: events, isLoading } = useEvents(selectedLocation?.zipCode);
  const { user, isAuthenticated } = useAuth();
  const isBusinessAccount = isAuthenticated && user?.accountType === "business";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('calendar');
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventSuccess = params.get("event_success");
    const sessionId = params.get("session_id");
    if (eventSuccess === "true" && sessionId) {
      toast({ title: "Payment Successful!", description: "Your event ad has been paid. It will appear on the calendar after admin approval." });
      fetch("/api/stripe/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      window.history.replaceState({}, "", "/events");
    }
  }, []);

  const calendarEvents = events?.flatMap(event => {
    const dates = event.eventDates?.length ? event.eventDates : [event.date];
    return dates.map((d, i) => ({
      id: `${event.id}-${i}`,
      title: event.title,
      date: d,
      extendedProps: {
        description: event.description,
        location: event.location,
        eventId: event.id,
      }
    }));
  }) || [];

  return (
    <div className="min-h-screen pb-20">
      {/* Stunning Hero Section with Gradient */}
      <div className="relative overflow-hidden">
        {/* Background gradient with coastal colors */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a4a82] via-[#1e6bb8] to-[#2dd4bf]" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-[#f59e0b]/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
        </div>
        
        {/* Animated wave pattern */}
        <div className="absolute bottom-0 left-0 right-0 h-24 opacity-20">
          <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
            <path fill="white" d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"/>
          </svg>
        </div>
        
        <div className="relative container py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-white/90 text-sm font-medium">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Live Events Near You
              </div>
              <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
                Local Events Calendar
              </h1>
              <p className="text-white/80 text-xl max-w-2xl leading-relaxed">
                Discover what's happening in your neighborhood. Concerts, markets, meetups, and more.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-white/15 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
                <Button 
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={viewMode === 'calendar' ? 'bg-white text-[#0a4a82] shadow-lg' : 'text-white hover:bg-white/20'}
                  data-testid="button-calendar-view"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
                <Button 
                  variant={viewMode === 'cards' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className={viewMode === 'cards' ? 'bg-white text-[#0a4a82] shadow-lg' : 'text-white hover:bg-white/20'}
                  data-testid="button-cards-view"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Cards
                </Button>
              </div>

              {isBusinessAccount || user?.accountType === "admin" ? (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-[shadow,transform] duration-200 border-0" data-testid="button-create-event">
                      <Plus className="mr-2 h-4 w-4" />
                      {user?.accountType === "admin" ? "Create Event" : "Advertise Your Event"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{user?.accountType === "admin" ? "Create Community Event" : "Create & Advertise Your Event"}</DialogTitle>
                      <DialogDescription>{user?.accountType === "admin" ? "Create an event for the community. All fields are available." : "Fill in your event details below. Fields available depend on your membership tier."}</DialogDescription>
                    </DialogHeader>
                    <CreateEventForm onSuccess={() => setIsDialogOpen(false)} linkedBusinessId={user?.linkedBusinessId} isAdmin={user?.accountType === "admin"} />
                  </DialogContent>
                </Dialog>
              ) : (
                <a href="#event-advertising">
                  <Button className="rounded-full bg-white/15 text-white border border-white/30 shadow-lg" data-testid="link-advertise-event">
                    <Megaphone className="mr-2 h-4 w-4" />
                    Event Ad Pricing
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12 -mt-8 relative z-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
               <div key={i} className="h-80 rounded-2xl bg-white border p-4 space-y-4">
                 <Skeleton className="h-40 w-full rounded-xl" />
                 <Skeleton className="h-6 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
               </div>
            ))}
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="relative" data-testid="calendar-container">
            {/* Decorative glow behind calendar */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[#0a4a82]/20 via-[#2dd4bf]/20 to-[#f59e0b]/20 rounded-3xl blur-2xl opacity-50" />
            
            <div className="relative bg-white rounded-2xl border border-[#0a4a82]/10 p-8 shadow-[0_20px_60px_rgba(10,74,130,0.15)]">
              {/* Custom calendar header accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0a4a82] via-[#2dd4bf] to-[#f59e0b] rounded-t-2xl" />
              
              <FullCalendar 
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin]} 
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,listWeek'
                }}
                events={calendarEvents}
                eventColor="#0a4a82"
                height="auto"
                eventClick={(info) => {
                  const eventId = info.event.extendedProps.eventId;
                  const matchedEvent = events?.find(e => e.id === eventId);
                  if (matchedEvent) {
                    setSelectedCalendarEvent(matchedEvent);
                  }
                }}
              />
            </div>
          </div>
        ) : events?.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">No events scheduled</h3>
            <p className="text-muted-foreground">Why not organize something yourself?</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {events?.map((event) => (
              <div key={event.id} className={
                event.adSize === "large" ? "md:col-span-2 lg:col-span-3" :
                event.adSize === "medium" ? "md:col-span-1 lg:col-span-1" : ""
              }>
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Advertising Pricing Section */}
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 py-16" id="event-advertising">
        <div className="container">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#0a4a82]/10 px-4 py-2 rounded-full mb-4">
              <Megaphone className="h-4 w-4 text-[#0a4a82]" />
              <span className="text-[#0a4a82] text-sm font-semibold">Promote Your Event</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4" data-testid="heading-event-ad-pricing">
              Event Advertising Rates
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Get your event in front of thousands of local residents. Members save up to 50%.
            </p>
          </div>

          <EventAdPricingGrid />

          <div className="mt-12 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-6" data-testid="heading-event-display-tiers">
              What's Included by Ad Size
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm" data-testid="card-event-ad-small">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-500 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Small Ad</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Event name &amp; title</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Date &amp; time</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Location</li>
                  <li className="flex items-center gap-2 text-slate-400"><span className="text-slate-300">&#10007;</span> Description</li>
                  <li className="flex items-center gap-2 text-slate-400"><span className="text-slate-300">&#10007;</span> Cover image</li>
                  <li className="flex items-center gap-2 text-slate-400"><span className="text-slate-300">&#10007;</span> Flyer / event link</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-[#0a4a82]/30 dark:border-[#0a4a82]/50 shadow-sm" data-testid="card-event-ad-medium">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a4a82] to-[#0d5a9e] flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Medium Ad</h4>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Event name &amp; title</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Date &amp; time</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Location</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Description</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Cover image</li>
                  <li className="flex items-center gap-2 text-slate-400"><span className="text-slate-300">&#10007;</span> Flyer / event link</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-[#d4a373] dark:border-[#d4a373] shadow-lg ring-1 ring-[#d4a373]/20" data-testid="card-event-ad-large">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a373] to-amber-500 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Large Ad</h4>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Best Value</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Event name &amp; title</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Date &amp; time</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Location</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Description</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Cover image</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Flyer / event link</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> <span className="font-semibold text-[#d4a373]">30-sec promo video</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedCalendarEvent} onOpenChange={(open) => { if (!open) setSelectedCalendarEvent(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
          {selectedCalendarEvent && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedCalendarEvent.title}</DialogTitle>
                <DialogDescription>Event details</DialogDescription>
              </DialogHeader>
              {selectedCalendarEvent.imageUrl && (selectedCalendarEvent.adSize === "medium" || selectedCalendarEvent.adSize === "large") && (
                <div className="relative h-64 w-full overflow-hidden rounded-t-2xl">
                  <img src={selectedCalendarEvent.imageUrl} alt={selectedCalendarEvent.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6">
                    <h2 className="text-2xl font-bold text-white drop-shadow-lg">{selectedCalendarEvent.title}</h2>
                  </div>
                </div>
              )}
              <div className="p-6 space-y-5">
                {selectedCalendarEvent.isExample && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" data-testid="banner-example-event-detail">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm text-amber-800 font-medium">This is an example event — not a real listing</span>
                  </div>
                )}
                {!(selectedCalendarEvent.imageUrl && (selectedCalendarEvent.adSize === "medium" || selectedCalendarEvent.adSize === "large")) && (
                  <h2 className="text-2xl font-bold text-slate-900">{selectedCalendarEvent.title}</h2>
                )}
                <div className="flex flex-wrap gap-3">
                  {(selectedCalendarEvent.eventDates?.length ? selectedCalendarEvent.eventDates : [selectedCalendarEvent.date]).map((d: string, i: number) => (
                    <div key={i} className="inline-flex items-center gap-2 bg-[#0a4a82]/10 text-[#0a4a82] px-4 py-2 rounded-xl text-sm font-medium">
                      <Calendar className="h-4 w-4" />
                      {new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  ))}
                  <div className="inline-flex items-center gap-2 bg-[#8a9a5b]/10 text-[#8a9a5b] px-4 py-2 rounded-xl text-sm font-medium">
                    <Megaphone className="h-4 w-4" />
                    {selectedCalendarEvent.location}
                  </div>
                </div>
                {selectedCalendarEvent.description && (
                  <p className="text-slate-700 leading-relaxed text-base">{selectedCalendarEvent.description}</p>
                )}
                {selectedCalendarEvent.adSize === "large" && selectedCalendarEvent.flyerUrl && (
                  <div className="rounded-xl overflow-hidden border border-amber-200/60 shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/40">
                      <Info className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-900">Event Flyer</span>
                    </div>
                    <img
                      src={selectedCalendarEvent.flyerUrl}
                      alt={`${selectedCalendarEvent.title} flyer`}
                      className="w-full object-contain max-h-[500px] bg-white"
                      data-testid="img-calendar-event-flyer"
                    />
                  </div>
                )}
                {selectedCalendarEvent.promoVideoUrl && (
                  <div className="rounded-xl overflow-hidden border border-[#d4a373]/20 shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-amber-200/40">
                      <Video className="h-4 w-4 text-[#d4a373]" />
                      <span className="text-sm font-semibold text-amber-800">Event Promo Video</span>
                      <span className="text-xs bg-gradient-to-r from-yellow-600 to-amber-500 text-white px-2 py-0.5 rounded-full font-bold ml-auto">Gold</span>
                    </div>
                    <video
                      src={selectedCalendarEvent.promoVideoUrl}
                      controls
                      className="w-full max-h-64 object-contain bg-black"
                      preload="metadata"
                    />
                  </div>
                )}
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setSelectedCalendarEvent(null)} data-testid="button-close-calendar-event">
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


function getTierLevel(membershipTier: string | undefined | null): "none" | "bronze" | "silver" | "gold" {
  if (!membershipTier) return "none";
  const tierMap: Record<string, "none" | "bronze" | "silver" | "gold"> = {
    basic: "bronze", bronze: "bronze",
    standard: "silver", silver: "silver",
    premium: "gold", gold: "gold",
  };
  return tierMap[membershipTier] || "none";
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: "Non-Member", color: "bg-slate-500" },
  bronze: { label: "Bronze", color: "bg-gradient-to-r from-amber-700 to-amber-600" },
  silver: { label: "Silver", color: "bg-gradient-to-r from-gray-500 to-gray-400" },
  gold: { label: "Gold", color: "bg-gradient-to-r from-yellow-600 to-amber-500" },
};

function CreateEventForm({ onSuccess, linkedBusinessId, isAdmin }: { onSuccess: () => void; linkedBusinessId?: number | null; isAdmin?: boolean }) {
  const createEvent = useCreateEvent();
  const { toast } = useToast();
  const { data: business } = useBusiness(linkedBusinessId || 0);
  const tier = isAdmin ? "gold" : getTierLevel(business?.membershipTier);
  const tierInfo = isAdmin ? { label: "Admin", color: "bg-red-500" } : TIER_LABELS[tier];
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const flyerInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const [eventDates, setEventDates] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    location: z.string().min(1, "Location is required"),
    imageUrl: z.string().optional(),
    flyerUrl: z.string().optional(),
    promoVideoUrl: z.string().optional(),
    adDuration: isAdmin ? z.string().optional() : z.string().min(1, "Select an ad duration"),
    adSize: isAdmin ? z.string().optional() : z.string().min(1, "Select an ad size"),
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      imageUrl: "",
      flyerUrl: "",
      promoVideoUrl: "",
      adDuration: "",
      adSize: "",
    },
  });

  const adDuration = form.watch("adDuration");
  const adSize = form.watch("adSize");

  const canDescription = isAdmin || adSize === "medium" || adSize === "large";
  const canImage = isAdmin || adSize === "medium" || adSize === "large";
  const canFlyer = isAdmin || adSize === "large";
  const canVideo = isAdmin || (adSize === "large" && tier === "gold");

  const discount = isAdmin ? 1 : tier === "gold" ? 0.50 : tier === "silver" ? 0.25 : tier === "bronze" ? 0.10 : 0;
  const basePricing = adDuration === "2week" ? EVENT_BASE_PRICING.event2Week : EVENT_BASE_PRICING.eventMonthly;
  const basePrice = adSize ? (basePricing as any)[adSize] || 0 : 0;
  const finalPrice = isAdmin ? 0 : Math.round(basePrice * (1 - discount));

  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startTime = start.includes("T") ? start.split("T")[1] : "09:00";
    const current = new Date(start.split("T")[0] + "T00:00:00");
    const last = new Date(end.split("T")[0] + "T00:00:00");
    while (current <= last) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}T${startTime}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!startDate) {
      toast({ title: "Missing Start Date", description: "Please select a start date for your event.", variant: "destructive" });
      return;
    }

    const computedDates = endDate ? generateDateRange(startDate, endDate) : [startDate];

    const selectedAdSize = isAdmin ? "large" : (data.adSize || "small");

    const eventData: any = {
      title: data.title,
      location: data.location,
      date: computedDates[0],
      eventDates: computedDates,
      adSize: selectedAdSize,
      adDuration: data.adDuration || "monthly",
      description: data.description || "",
      imageUrl: data.imageUrl || undefined,
      zipCode: "27958",
      city: "Moyock",
      state: "NC",
    };
    if (data.flyerUrl) eventData.flyerUrl = data.flyerUrl;
    if (data.promoVideoUrl) eventData.promoVideoUrl = data.promoVideoUrl;
    
    createEvent.mutate(eventData, {
      onSuccess: async (newEvent: any) => {
        if (isAdmin) {
          toast({ title: "Event Created", description: "Your community event has been published." });
          onSuccess();
          return;
        }

        try {
          const checkoutRes = await fetch("/api/stripe/event-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ eventId: newEvent.id }),
          });
          if (checkoutRes.ok) {
            const { url } = await checkoutRes.json();
            if (url) {
              window.location.href = url;
              return;
            }
          }
          toast({
            title: "Event Submitted",
            description: "Your event was created but payment could not be initiated. Please contact admin.",
          });
          onSuccess();
        } catch {
          toast({
            title: "Event Submitted",
            description: "Your event was created but payment could not be initiated. Please contact admin.",
          });
          onSuccess();
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
        {isAdmin ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Admin — all fields unlocked, no payment required</span>
            </div>
            <Badge className="bg-red-500 text-white border-0" data-testid="badge-event-tier">
              Admin
            </Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Your Tier:</span>
            </div>
            <Badge className={`${tierInfo.color} text-white border-0`} data-testid="badge-event-tier">
              {tierInfo.label}
            </Badge>
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title</FormLabel>
              <FormControl><Input placeholder="Summer Night Market" className="bg-white text-[#1a1a2e]" {...field} data-testid="input-event-title" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl><Input placeholder="Town Square, Moyock" className="bg-white text-[#1a1a2e]" {...field} data-testid="input-event-location" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <label className="text-sm font-medium leading-none mb-2 block">Event Dates & Time</label>
          <p className="text-xs text-muted-foreground mb-2">Select a start and end date. Multi-day events will appear on the calendar for every day in the range.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Start Date & Time</label>
              <Input
                type="datetime-local"
                className="bg-white text-[#1a1a2e]"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                data-testid="input-event-start-date"
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">End Date (optional for single-day events)</label>
              <Input
                type="datetime-local"
                className="bg-white text-[#1a1a2e]"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-event-end-date"
                style={{ color: "#1a1a2e", caretColor: "#1a1a2e" }}
              />
            </div>
          </div>
          {startDate && (
            <div className="mt-3 p-3 rounded-xl bg-[#0a4a82]/5 border border-[#0a4a82]/15">
              <div className="flex items-center gap-2 text-sm text-[#0a4a82] font-medium">
                <Calendar className="h-4 w-4" />
                {endDate && endDate.split("T")[0] !== startDate.split("T")[0] ? (
                  <span>
                    {new Date(startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {" — "}
                    {new Date(endDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {" "}
                    <span className="text-slate-500 font-normal">
                      ({Math.ceil((new Date(endDate.split("T")[0] + "T00:00:00").getTime() - new Date(startDate.split("T")[0] + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)) + 1} days on calendar)
                    </span>
                  </span>
                ) : (
                  <span>
                    {new Date(startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {" at "}
                    {new Date(startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    <span className="text-slate-500 font-normal ml-1">(single day)</span>
                  </span>
                )}
              </div>
            </div>
          )}
          {!startDate && (
            <p className="text-xs text-amber-600 font-medium mt-2">Please select a start date above</p>
          )}
        </div>

        {!isAdmin && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Ad Package — Choose your size to unlock features
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="adDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white text-[#1a1a2e]" data-testid="select-ad-duration">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2week">2-Week Ad (14 days)</SelectItem>
                      <SelectItem value="monthly">30-Day Ad</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Size</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white text-[#1a1a2e]" data-testid="select-ad-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="small">Small — Title, date, location only</SelectItem>
                      <SelectItem value="medium">Medium — + description & cover image</SelectItem>
                      <SelectItem value="large">Large — + flyer link (Best Value)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {adDuration && adSize && (
            <div className="mt-4 p-4 rounded-xl bg-[#0a4a82]/5 border border-[#0a4a82]/15">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {adDuration === "2week" ? "2-Week (14 days)" : "30-Day"} · {adSize.charAt(0).toUpperCase() + adSize.slice(1)} Ad
                  </p>
                  {discount > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">
                      {tierInfo.label} discount: {discount * 100}% off
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {discount > 0 && (
                    <span className="text-sm text-slate-400 line-through mr-2">${basePrice}</span>
                  )}
                  <span className="text-2xl font-bold text-[#0a4a82]" data-testid="text-event-price">${finalPrice}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {canDescription ? (
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Describe your event..." className="bg-white text-[#1a1a2e] min-h-[80px]" {...field} data-testid="input-event-description" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Description — select Medium or Large ad size to unlock</span>
          </div>
        )}

        {canImage ? (
          <div>
            <label className="text-sm font-medium leading-none mb-2 block">Cover Image</label>
            {form.watch("imageUrl") ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#0a4a82]/15">
                <div className="flex items-center gap-3">
                  <img src={form.watch("imageUrl")!.startsWith("/objects/") ? form.watch("imageUrl")! : `/objects/${form.watch("imageUrl")}`} alt="Cover" className="w-14 h-14 rounded-lg object-cover border border-[#0a4a82]/10" />
                  <p className="text-sm font-medium text-[#1a1a2e]">Cover image uploaded</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={isUploading} data-testid="button-replace-event-image">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Replace
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => form.setValue("imageUrl", "")} data-testid="button-remove-event-image">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-[#0a4a82]/20 bg-white/50 cursor-pointer hover:border-[#0a4a82]/40 transition-colors"
                onClick={() => imageInputRef.current?.click()}
                data-testid="dropzone-event-image"
              >
                <Upload className="h-6 w-6 text-[#0a4a82]/50" />
                <p className="text-sm font-medium text-[#1a1a2e]">Upload a cover image</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · Max 10MB</p>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
                  return;
                }
                const result = await uploadFile(file);
                if (result) form.setValue("imageUrl", result.objectPath);
                if (imageInputRef.current) imageInputRef.current.value = "";
              }}
              data-testid="input-event-image-file"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Cover image — select Medium or Large ad size to unlock</span>
          </div>
        )}

        {canFlyer ? (
          <div>
            <label className="text-sm font-medium leading-none mb-2 block">Event Flyer</label>
            {form.watch("flyerUrl") ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#8a9a5b]/15">
                <div className="flex items-center gap-3">
                  <img src={form.watch("flyerUrl")!.startsWith("/objects/") ? form.watch("flyerUrl")! : `/objects/${form.watch("flyerUrl")}`} alt="Flyer" className="w-14 h-14 rounded-lg object-cover border border-[#8a9a5b]/10" />
                  <p className="text-sm font-medium text-[#1a1a2e]">Flyer uploaded</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => flyerInputRef.current?.click()} disabled={isUploading} data-testid="button-replace-event-flyer">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Replace
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => form.setValue("flyerUrl", "")} data-testid="button-remove-event-flyer">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-[#8a9a5b]/20 bg-white/50 cursor-pointer hover:border-[#8a9a5b]/40 transition-colors"
                onClick={() => flyerInputRef.current?.click()}
                data-testid="dropzone-event-flyer"
              >
                <Upload className="h-6 w-6 text-[#8a9a5b]/50" />
                <p className="text-sm font-medium text-[#1a1a2e]">Upload an event flyer</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or PDF · Max 10MB</p>
              </div>
            )}
            <input
              ref={flyerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  toast({ title: "File too large", description: "Flyer must be under 10MB.", variant: "destructive" });
                  return;
                }
                const result = await uploadFile(file);
                if (result) form.setValue("flyerUrl", result.objectPath);
                if (flyerInputRef.current) flyerInputRef.current.value = "";
              }}
              data-testid="input-event-flyer-file"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Event flyer — select Large ad size to unlock</span>
          </div>
        )}

        {canVideo ? (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-[#d4a373]/20">
            <div className="flex items-center gap-2 mb-3">
              <Video className="h-5 w-5 text-[#d4a373]" />
              <span className="font-semibold text-sm">30-Sec Promo Video</span>
              <span className="text-xs bg-gradient-to-r from-yellow-600 to-amber-500 text-white px-2 py-0.5 rounded-full font-bold">Gold</span>
            </div>
            {form.watch("promoVideoUrl") ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Play className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium">Video attached</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => form.setValue("promoVideoUrl", "")} data-testid="button-remove-event-video">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-[#d4a373]/30 bg-white/50 cursor-pointer hover:border-[#d4a373]/50 transition-colors"
                onClick={() => videoInputRef.current?.click()}
                data-testid="dropzone-event-video"
              >
                <Upload className="h-6 w-6 text-[#d4a373]" />
                <p className="text-sm font-medium">Upload a promo video for this event</p>
                <p className="text-xs text-muted-foreground">MP4, WebM, or MOV · Max 50MB · Up to 30 seconds</p>
              </div>
            )}
            {isUploading && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium text-[#0a4a82]">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 50 * 1024 * 1024) {
                  toast({ title: "File too large", description: "Video must be under 50MB.", variant: "destructive" });
                  return;
                }
                const result = await uploadFile(file);
                if (result) {
                  form.setValue("promoVideoUrl", result.objectPath);
                }
                if (videoInputRef.current) videoInputRef.current.value = "";
              }}
              data-testid="input-event-video-file"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>30-sec promo video — Gold tier + Large ad size to unlock</span>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button 
            type="submit" 
            disabled={createEvent.isPending} 
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            data-testid="button-submit-event"
          >
            {createEvent.isPending ? "Creating..." : isAdmin ? "Publish Event" : "Create Event & Proceed to Payment"}
          </Button>
        </div>

        {!isAdmin && (
        <p className="text-xs text-center text-slate-400">
          <Info className="h-3 w-3 inline mr-1" />
          Event will appear on the calendar after payment is confirmed.
        </p>
        )}
      </form>
    </Form>
  );
}
