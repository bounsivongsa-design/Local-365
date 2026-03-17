import { useState } from "react";
import { useEvents, useCreateEvent } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, LayoutGrid, List, Megaphone, Clock, Crown, Users, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertEventSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'cards'>('calendar');

  const calendarEvents = events?.map(event => ({
    id: String(event.id),
    title: event.title,
    date: event.date,
    extendedProps: {
      description: event.description,
      location: event.location,
    }
  })) || [];

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

              <Link to="/advertising#event-advertising">
                <Button className="rounded-full bg-white/15 text-white border border-white/30 shadow-lg" data-testid="link-advertise-event">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Advertise Your Event
                </Button>
              </Link>

              {isAuthenticated && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-[shadow,transform] duration-200 border-0" data-testid="button-create-event">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Event</DialogTitle>
                    </DialogHeader>
                    <CreateEventForm onSuccess={() => setIsDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
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
                  alert(`${info.event.title}\n${info.event.extendedProps.location || ''}\n${info.event.extendedProps.description || ''}`);
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
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Event Advertising Pricing Section */}
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 py-16">
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
              Event Display by Membership Tier
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-amber-200 dark:border-amber-800 shadow-sm" data-testid="card-event-tier-bronze">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Bronze</h4>
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
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-300 dark:border-gray-600 shadow-sm" data-testid="card-event-tier-silver">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-400 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Silver</h4>
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
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-yellow-400 dark:border-yellow-600 shadow-lg ring-1 ring-yellow-400/20" data-testid="card-event-tier-gold">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-600 to-amber-500 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Gold</h4>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">Best Value</span>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Event name &amp; title</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Date &amp; time</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Location</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Description</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Cover image</li>
                  <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Flyer / event link</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link to="/advertising">
              <Button size="lg" className="bg-[#0a4a82] hover:bg-[#083a6a] h-14 px-8 rounded-xl text-lg font-semibold" data-testid="link-full-advertising">
                View All Advertising Options
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const EVENT_BASE_PRICING = {
  event2Week: { small: 25, medium: 35, large: 50 },
  eventMonthly: { small: 50, medium: 75, large: 100 },
};

const EVENT_TIER_DISCOUNTS = [
  { id: null, name: "Non-Member", discount: 0, icon: Users, gradient: "from-slate-600 to-slate-800", badgeText: null },
  { id: "bronze", name: "Bronze", discount: 0.10, icon: Crown, gradient: "from-amber-700 to-amber-600", badgeText: "10% OFF" },
  { id: "silver", name: "Silver", discount: 0.25, icon: Crown, gradient: "from-gray-500 to-gray-400", badgeText: "25% OFF" },
  { id: "gold", name: "Gold", discount: 0.50, icon: Crown, gradient: "from-yellow-600 to-amber-500", badgeText: "50% OFF" },
] as const;

function EventAdPricingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {EVENT_TIER_DISCOUNTS.map((tier) => {
        const TierIcon = tier.icon;
        const isGold = tier.id === "gold";
        const getPrice = (base: number) => Math.round(base * (1 - tier.discount));
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
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">2-Week Event</h4>
                </div>
                <div className="space-y-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <div key={size} className={`rounded-xl p-3 text-center ${tier.id ? "bg-[#8a9a5b]/10 border border-[#8a9a5b]/20" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                      <p className={`text-xl font-bold ${tier.id ? "text-[#8a9a5b]" : "text-slate-900 dark:text-white"}`}>
                        ${getPrice(EVENT_BASE_PRICING.event2Week[size])}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{size}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Monthly Event</h4>
                </div>
                <div className="space-y-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <div key={size} className={`rounded-xl p-3 text-center ${tier.id ? "bg-[#8a9a5b]/10 border border-[#8a9a5b]/20" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                      <p className={`text-xl font-bold ${tier.id ? "text-[#8a9a5b]" : "text-slate-900 dark:text-white"}`}>
                        ${getPrice(EVENT_BASE_PRICING.eventMonthly[size])}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{size}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateEventForm({ onSuccess }: { onSuccess: () => void }) {
  const createEvent = useCreateEvent();
  const { toast } = useToast();
  
  const formSchema = insertEventSchema.extend({
    date: z.string().transform((str) => new Date(str)), 
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      imageUrl: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!data.imageUrl) {
      data.imageUrl = "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop"; 
    }
    
    createEvent.mutate(data, {
      onSuccess: () => {
        toast({ title: "Event Created", description: "Your event is now live on the calendar." });
        onSuccess();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title</FormLabel>
              <FormControl><Input placeholder="Summer Night Market" {...field} data-testid="input-event-title" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date & Time</FormLabel>
                <FormControl>
                  <Input 
                    type="datetime-local" 
                    {...field} 
                    value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value} 
                    data-testid="input-event-date"
                  />
                </FormControl>
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
                <FormControl><Input placeholder="Town Square" {...field} data-testid="input-event-location" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Input placeholder="What's happening?" {...field} data-testid="input-event-description" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover Image URL (Optional)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} value={field.value || ""} data-testid="input-event-image" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="flyerUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Flyer / Event Link URL (Optional)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} value={field.value || ""} data-testid="input-event-flyer" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="pt-2 flex justify-end">
          <Button type="submit" disabled={createEvent.isPending} data-testid="button-submit-event">
            {createEvent.isPending ? "Creating..." : "Create Event"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
