import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Flame, Sunset, Wine, Music } from "lucide-react";

function RomanticGetaway() {
  const stays = [
    { name: 'Ocean View Hotel', features: 'Fireplace, Hot Tub, Oceanfront', rate: '$149/night (40% off)', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop' },
    { name: 'Lighthouse Motel', features: 'Cozy Wood-Burning Stove, Sunset Views', rate: '$129/night (50% off)', image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop' },
    { name: 'Beachfront Cottage', features: 'Private Beach Access, Jacuzzi', rate: '$189/night (35% off)', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&h=300&fit=crop' },
    { name: 'Dune House Retreat', features: 'Panoramic Views, Rooftop Deck', rate: '$169/night (45% off)', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=300&fit=crop' },
    { name: 'Corolla Wild Horse Inn', features: 'Rustic Charm, Nature Trails', rate: '$119/night (40% off)', image: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=400&h=300&fit=crop' },
    { name: 'Soundside Suites', features: 'Kayak Rentals, Sunset Patio', rate: '$139/night (30% off)', image: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&h=300&fit=crop' },
  ];

  const activities = [
    { name: 'Sunset Cruise', desc: 'Private sail with wine and cheese', price: '$100/couple (30% off)', icon: Sunset },
    { name: 'Horseback Riding on Beach', desc: 'Romantic trot at dusk with wild horses', price: '$80/couple (25% off)', icon: Heart },
    { name: 'Couples Spa Day', desc: 'Massage, facial, and champagne', price: '$150/couple (20% off)', icon: Flame },
    { name: 'Wine Tasting Tour', desc: 'Local vineyards and craft beverages', price: '$60/couple (35% off)', icon: Wine },
    { name: 'Live Jazz Evening', desc: 'Dinner and live music at waterfront venue', price: '$90/couple (25% off)', icon: Music },
    { name: 'Private Beach Bonfire', desc: 'S\'mores, blankets, and stargazing', price: '$75/couple (40% off)', icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 via-orange-50 to-sky-100 dark:from-amber-950 dark:via-orange-950 dark:to-sky-950">
      {/* Hero */}
      <div className="text-center py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200')] bg-cover bg-center opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-100/80 dark:to-amber-950/80"></div>
        <div className="relative z-10 container">
          <div className="flex justify-center mb-4">
            <Heart className="h-12 w-12 text-red-500 fill-red-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary-dark dark:text-white">Romantic Winter Getaway</h1>
          <p className="text-xl mb-8 text-foreground/80 max-w-2xl mx-auto">Cozy fireplaces, quiet beaches, up to 50% off — escape the cold and rekindle the flame!</p>
          <Button size="lg" className="bg-sand text-primary-dark hover:bg-sand/90 font-semibold px-8 rounded-full shadow-pop">
            <Heart className="mr-2 h-5 w-5" />
            Plan Your Romantic Escape
          </Button>
        </div>
      </div>

      <div className="container pb-16">
        {/* Featured Stays */}
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Flame className="h-8 w-8 text-orange-500" />
          Featured Cozy Stays
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {stays.map((stay, i) => (
            <Card key={i} className="overflow-hidden shadow-pop hover:scale-[1.02] transition-transform duration-300">
              <img src={stay.image} alt={stay.name} className="w-full h-48 object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-semibold mb-2">{stay.name}</h3>
                <p className="text-muted-foreground text-sm mb-3">{stay.features}</p>
                <p className="text-primary font-bold text-lg">{stay.rate}</p>
                <Button className="w-full mt-4" variant="outline">View Details</Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Activities */}
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500" />
          Romantic Activities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {activities.map((act, i) => {
            const IconComponent = act.icon;
            return (
              <Card key={i} className="p-6 shadow-pop hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{act.name}</h3>
                    <p className="text-muted-foreground text-sm mb-2">{act.desc}</p>
                    <p className="text-primary font-bold">{act.price}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* CTA */}
        <Card className="text-center p-12 bg-gradient-to-r from-primary/10 to-sand/20 shadow-pop">
          <Heart className="h-12 w-12 text-red-500 fill-red-500 mx-auto mb-4" />
          <h3 className="text-3xl font-bold mb-4">Ready to Plan Your Escape?</h3>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">Book your romantic OBX getaway today and save up to 50% on cozy winter stays and activities.</p>
          <Button size="lg" className="rounded-full px-8 shadow-pop">
            Book Now
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default RomanticGetaway;
