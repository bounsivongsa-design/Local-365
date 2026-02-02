import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Flame, Sunset, Wine, Music, Sparkles } from "lucide-react";

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
    { name: 'Couples Spa Day', desc: 'Massage, facial, and champagne', price: '$150/couple (20% off)', icon: Sparkles },
    { name: 'Wine Tasting Tour', desc: 'Local vineyards and craft beverages', price: '$60/couple (35% off)', icon: Wine },
    { name: 'Live Jazz Evening', desc: 'Dinner and live music at waterfront venue', price: '$90/couple (25% off)', icon: Music },
    { name: 'Private Beach Bonfire', desc: "S'mores, blankets, and stargazing", price: '$75/couple (40% off)', icon: Flame },
  ];

  return (
    <div className="min-h-screen py-8 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 text-white">
      {/* Hero */}
      <div className="text-center py-20">
        <div className="flex justify-center mb-4">
          <Heart className="h-16 w-16 text-red-400 fill-red-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Romantic Winter Getaway</h1>
        <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto px-4">Cozy fireplaces, quiet beaches, up to 50% off — escape the cold!</p>
        <Button size="lg" className="bg-teal-300 text-teal-900 hover:bg-teal-200 px-8 py-6 rounded-lg font-semibold shadow-pop">
          Learn More
        </Button>
      </div>

      {/* Featured Stays */}
      <h2 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-3">
        <Flame className="h-8 w-8 text-orange-400" />
        Featured Cozy Stays
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4 mb-16">
        {stays.map((stay, i) => (
          <div key={i} className="bg-white/60 backdrop-blur p-6 rounded-xl shadow-pop hover:scale-105 transition-transform duration-300">
            <img src={stay.image} alt={stay.name} className="w-full h-48 object-cover mb-4 rounded-lg shadow-md" />
            <h3 className="text-xl font-semibold text-gray-900">{stay.name}</h3>
            <p className="text-gray-700 text-sm mb-2">{stay.features}</p>
            <p className="text-teal-700 font-bold text-lg">{stay.rate}</p>
            <Button className="w-full mt-4 bg-teal-600 hover:bg-teal-700 text-white">View Details</Button>
          </div>
        ))}
      </div>

      {/* Activities */}
      <h2 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-3">
        <Heart className="h-8 w-8 text-red-400" />
        Romantic Activities
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4 mb-16">
        {activities.map((act, i) => {
          const IconComponent = act.icon;
          return (
            <div key={i} className="bg-white/60 backdrop-blur p-6 rounded-xl shadow-pop hover:scale-105 transition-transform duration-300">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                  <IconComponent className="h-6 w-6 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{act.name}</h3>
                  <p className="text-gray-700 text-sm mb-2">{act.desc}</p>
                  <p className="text-teal-700 font-bold">{act.price}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center mt-12 pb-8">
        <Heart className="h-12 w-12 text-red-400 fill-red-400 mx-auto mb-4" />
        <h3 className="text-3xl font-bold mb-4">Ready to Plan Your Escape?</h3>
        <p className="text-white/80 mb-6 max-w-lg mx-auto px-4">Book your romantic OBX getaway today and save up to 50% on cozy winter stays and activities.</p>
        <Button size="lg" className="bg-teal-300 text-teal-900 hover:bg-teal-200 px-8 py-6 rounded-lg font-semibold shadow-pop">
          Book Now
        </Button>
      </div>
    </div>
  );
}

export default RomanticGetaway;
