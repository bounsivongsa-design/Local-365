import { Card } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";

function BestOfGrid() {
  const bestOfData = [
    { category: 'Home Repair', winner: 'Smith Home Repair', runnerUp: 'OBX Handyman Services', honorable: 'Beach House Fixers', rating: '4.9' },
    { category: 'Plumbing', winner: 'Coastal Plumbing Co', runnerUp: 'Currituck Plumbing Pros', honorable: 'Island Pipe Works', rating: '4.8' },
    { category: 'HVAC', winner: 'OBX HVAC Pros', runnerUp: 'Coastal Comfort Air', honorable: 'Beach Breeze HVAC', rating: '4.9' },
    { category: 'Electrical', winner: 'Shore Electric', runnerUp: 'Lighthouse Electrical', honorable: 'OBX Power Solutions', rating: '4.7' },
    { category: 'Roofing', winner: 'Barrier Island Roofing', runnerUp: 'Coastal Storm Roofing', honorable: 'OBX Top Roofers', rating: '4.8' },
    { category: 'Landscaping', winner: 'Sandy Shores Landscaping', runnerUp: 'Dune Gardens', honorable: 'Coastal Green Thumb', rating: '4.9' },
    { category: 'Cleaning', winner: 'Crystal Clean OBX', runnerUp: 'Beach Sparkle Cleaning', honorable: 'Tidy Shores Services', rating: '4.8' },
    { category: 'Painting', winner: 'Outer Banks Painters', runnerUp: 'Coastal Colors Pro', honorable: 'Beach House Painting', rating: '4.7' },
    { category: 'Tree Care', winner: 'Coastal Tree Care', runnerUp: 'OBX Arborists', honorable: 'Maritime Tree Service', rating: '4.8' },
    { category: 'Remodeling & Addition', winner: 'Beach House Remodeling', runnerUp: 'OBX Renovations', honorable: 'Coastal Makeover Co', rating: '4.9' },
    { category: 'New Construction', winner: 'OBX Custom Builders', runnerUp: 'Barrier Island Construction', honorable: 'Soundside Builders', rating: '4.8' },
    { category: 'Baby Sitting & Nanny', winner: 'Trusted Nannies OBX', runnerUp: 'Beach Kids Care', honorable: 'Coastal Sitters', rating: '4.9' },
    { category: 'Printing', winner: 'Coastal Print Shop', runnerUp: 'OBX Graphics', honorable: 'Beach Signs & Print', rating: '4.6' },
    { category: 'Web Design & Logo Design', winner: 'Beach Digital Design', runnerUp: 'OBX Web Studio', honorable: 'Coastal Creative Co', rating: '4.8' },
    { category: 'Photo & Video', winner: 'OBX Photo & Video', runnerUp: 'Lighthouse Lens', honorable: 'Sunset Shots OBX', rating: '4.9' },
    { category: 'Auto Repair', winner: 'Reliable Auto Repair', runnerUp: 'Beach Garage', honorable: 'OBX Auto Care', rating: '4.7' },
    { category: 'Small Engine Repair', winner: 'Small Engine Experts', runnerUp: 'OBX Power Equipment', honorable: 'Coastal Motor Works', rating: '4.6' },
    { category: 'Trash & Junk Removal', winner: 'Junk Be Gone OBX', runnerUp: 'Coastal Cleanout', honorable: 'Beach Haul Away', rating: '4.8' },
    { category: 'Tutor & Mentor Counseling', winner: 'OBX Tutoring Center', runnerUp: 'Bright Minds OBX', honorable: 'Coastal Learning', rating: '4.9' },
    { category: 'Mind Body Soul', winner: 'Serenity Wellness', runnerUp: 'Ocean Yoga Studio', honorable: 'Coastal Zen Center', rating: '4.9' },
    { category: 'Tax CPA', winner: 'Coastal Tax Services', runnerUp: 'OBX Accounting', honorable: 'Beach Business CPAs', rating: '4.7' },
    { category: 'Legal', winner: 'Beach Law Group', runnerUp: 'OBX Legal Services', honorable: 'Coastal Attorneys', rating: '4.8' },
    { category: 'Woodworking & Lazer CNC', winner: 'OBX Woodworks', runnerUp: 'Coastal Craftsmen', honorable: 'Beach Timber Creations', rating: '4.9' },
    { category: 'Baking & Cooking', winner: 'Sweet Coastal Bakery', runnerUp: 'Duck Donuts', honorable: 'OBX Bread Company', rating: '4.9' },
    { category: 'Catering Food Trucks', winner: 'Taco Truck OBX', runnerUp: 'Coastal Catering Co', honorable: 'Beach Bites Mobile', rating: '4.8' },
    { category: 'Event Planning & Rentals', winner: 'Coastal Events & Rentals', runnerUp: 'OBX Party Pros', honorable: 'Beach Celebration Co', rating: '4.8' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bestOfData.map((item, i) => (
        <Card key={i} className="p-6 shadow-lg shadow-black/5 hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-bold mb-4 text-primary">Best {item.category}</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Winner</p>
                <p className="font-semibold">{item.winner}</p>
                <p className="text-sm text-yellow-600 font-medium">{item.rating} ★</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Medal className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Runner-Up</p>
                <p className="text-sm">{item.runnerUp}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Award className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Honorable Mention</p>
                <p className="text-sm">{item.honorable}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default BestOfGrid;
