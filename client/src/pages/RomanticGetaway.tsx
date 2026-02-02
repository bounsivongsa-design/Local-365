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
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Heart className="h-10 w-10 text-red-400 fill-red-400 drop-shadow-lg" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">Romantic Winter Getaway</h1>
        <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto px-4 drop-shadow">Cozy fireplaces, quiet beaches, up to 50% off — escape the cold!</p>
        <Button size="lg" className="bg-teal-300 text-teal-900 hover:bg-teal-200 px-8 py-6 rounded-lg font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-shadow">
          Learn More
        </Button>
      </div>

      {/* Featured Stays */}
      <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3 drop-shadow-lg">
        <Flame className="h-8 w-8 text-orange-400 drop-shadow" />
        Featured Cozy Stays
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 mb-16">
        {stays.map((stay, i) => (
          <div 
            key={i} 
            className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl border border-white/30 shadow-[0_10px_40px_rgba(0,0,0,0.25),0_6px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.5)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35),0_10px_20px_rgba(0,0,0,0.2)] hover:translate-y-[-4px] transition-all duration-300"
          >
            <img 
              src={stay.image} 
              alt={stay.name} 
              className="w-full h-48 object-cover mb-4 rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.2),0_3px_6px_rgba(0,0,0,0.15)]" 
            />
            <h3 className="text-xl font-bold text-gray-900">{stay.name}</h3>
            <p className="text-gray-600 text-sm mb-2">{stay.features}</p>
            <p className="text-teal-700 font-bold text-lg mb-4">{stay.rate}</p>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-[0_4px_12px_rgba(0,128,128,0.3)] hover:shadow-[0_6px_16px_rgba(0,128,128,0.4)]">
              View Details
            </Button>
          </div>
        ))}
      </div>

      {/* Activities */}
      <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3 drop-shadow-lg">
        <Heart className="h-8 w-8 text-red-400 drop-shadow" />
        Romantic Activities
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4 mb-16">
        {activities.map((act, i) => {
          const IconComponent = act.icon;
          return (
            <div 
              key={i} 
              className="bg-white/70 backdrop-blur-sm p-5 rounded-2xl border border-white/30 shadow-[0_10px_40px_rgba(0,0,0,0.25),0_6px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.5)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35),0_10px_20px_rgba(0,0,0,0.2)] hover:translate-y-[-4px] transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_rgba(0,128,128,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]">
                  <IconComponent className="h-7 w-7 text-white drop-shadow" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{act.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">{act.desc}</p>
                  <p className="text-teal-700 font-bold text-lg">{act.price}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center mt-12 pb-12 px-4">
        <div className="max-w-2xl mx-auto bg-white/20 backdrop-blur-sm rounded-3xl p-10 border border-white/30 shadow-[0_16px_48px_rgba(0,0,0,0.3),0_8px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]">
          <Heart className="h-14 w-14 text-red-400 fill-red-400 mx-auto mb-5 drop-shadow-lg" />
          <h3 className="text-3xl font-bold mb-4 drop-shadow">Ready to Plan Your Escape?</h3>
          <p className="text-white/90 mb-8 max-w-lg mx-auto">Book your romantic OBX getaway today and save up to 50% on cozy winter stays and activities.</p>
          <Button size="lg" className="bg-teal-300 text-teal-900 hover:bg-teal-200 px-10 py-6 rounded-xl font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] transition-shadow">
            Book Now
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RomanticGetaway;
