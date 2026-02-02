import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, Utensils, MapPin, Clock, CloudRain } from "lucide-react";

interface TripFormData {
  groupSize: string;
  tripLength: string;
  interests: string[];
  budget: string;
  staying: string;
  mustHaves: string[];
}

interface ItineraryBuilderProps {
  formData: TripFormData;
}

export function ItineraryBuilder({ formData }: ItineraryBuilderProps) {
  const generateItinerary = () => {
    const days = parseInt(formData.tripLength) || 3;
    const itinerary = [];

    const beachActivities = ['Beach Relax at Nags Head', 'Sunrise Beach Walk', 'Sandcastle Building', 'Beach Volleyball'];
    const foodActivities = ['Dinner at Coastal Provisions', 'Lunch at Kill Devil Grill', 'Seafood at Sam & Omie\'s', 'Breakfast at Stack\'em High'];
    const adventureActivities = ['Wild Horse Tour in Corolla', 'Kayaking in Roanoke Sound', 'Hang Gliding at Jockey\'s Ridge', 'Kiteboarding Lesson'];
    const golfActivities = ['Golf at Nags Head Golf Links', 'Mini Golf at Paradise', 'Golf at The Currituck Club'];
    const familyActivities = ['NC Aquarium on Roanoke Island', 'Wright Brothers Memorial', 'Jockey\'s Ridge State Park', 'Jennette\'s Pier'];

    for (let day = 1; day <= days; day++) {
      const activities: string[] = [];
      
      if (day === 1) {
        activities.push('Arrival & Check-in');
      }

      if (formData.interests.includes('beach')) {
        activities.push(beachActivities[day % beachActivities.length]);
      }
      if (formData.interests.includes('food')) {
        activities.push(foodActivities[day % foodActivities.length]);
      }
      if (formData.interests.includes('adventure') && day > 1) {
        activities.push(adventureActivities[(day - 1) % adventureActivities.length]);
      }
      if (formData.interests.includes('golf') && day % 2 === 0) {
        activities.push(golfActivities[(day / 2) % golfActivities.length]);
      }
      if (formData.interests.includes('family')) {
        activities.push(familyActivities[day % familyActivities.length]);
      }

      if (activities.length < 2) {
        activities.push('Explore ' + formData.staying);
        activities.push('Local Dining Experience');
      }

      if (day === days) {
        activities.push('Departure');
      }

      itinerary.push({ day, activities });
    }

    return itinerary;
  };

  const itinerary = generateItinerary();

  const getBudgetTip = () => {
    switch (formData.budget) {
      case 'low': return 'Look for happy hour specials and free beach access!';
      case 'medium': return 'Great balance of experiences and value.';
      case 'high': return 'Consider private tours and fine dining.';
      case 'luxury': return 'Book spa treatments and private charters!';
      default: return '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sun className="h-6 w-6 text-accent" />
          Your Personalized OBX Itinerary
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary">{formData.staying}</Badge>
          <Badge variant="secondary">{formData.tripLength} Days</Badge>
          <Badge variant="secondary" className="capitalize">{formData.budget} Budget</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {itinerary.map((day) => (
          <div key={day.day} className="border-l-4 border-primary pl-4 py-2">
            <h4 className="text-lg font-bold flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Day {day.day}
            </h4>
            <ul className="space-y-2">
              {day.activities.map((activity, i) => (
                <li key={i} className="flex items-start gap-2 text-foreground/90">
                  <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="bg-muted/50 rounded-lg p-4 mt-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CloudRain className="h-4 w-4" />
            <span className="font-medium">Backup if Rain:</span>
          </div>
          <p>NC Aquarium on Roanoke Island, Outer Banks Brewing Station, or Shopping at Tanger Outlets</p>
        </div>

        {formData.mustHaves.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Your preferences:</span>{' '}
              {formData.mustHaves.map(h => h.replace('-', ' ')).join(', ')}
            </p>
          </div>
        )}

        <div className="bg-accent/10 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Utensils className="h-4 w-4 text-accent" />
            <span className="font-medium">Budget Tip:</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{getBudgetTip()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ItineraryBuilder;
