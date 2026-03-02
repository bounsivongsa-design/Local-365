import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface TripFormData {
  groupSize: string;
  tripLength: string;
  interests: string[];
  budget: string;
  staying: string;
  mustHaves: string[];
}

interface IntakeFormProps {
  onSubmit: (data: TripFormData) => void;
}

export function IntakeForm({ onSubmit }: IntakeFormProps) {
  const [formData, setFormData] = useState<TripFormData>({
    groupSize: '2',
    tripLength: '3',
    interests: [],
    budget: 'medium',
    staying: 'Moyock',
    mustHaves: []
  });

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: 'interests' | 'mustHaves', value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: checked 
        ? [...prev[name], value] 
        : prev[name].filter(v => v !== value)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const interests = [
    { value: 'beach', label: 'Beach & Relax' },
    { value: 'food', label: 'Food & Dining' },
    { value: 'adventure', label: 'Outdoor Adventure' },
    { value: 'golf', label: 'Golf & Sports' },
    { value: 'family', label: 'Family Activities' },
  ];

  const mustHaves = [
    { value: 'kid-friendly', label: 'Kid-Friendly' },
    { value: 'pet-friendly', label: 'Pet-Friendly' },
    { value: 'wheelchair-accessible', label: 'Wheelchair Accessible' },
    { value: 'outdoor-seating', label: 'Outdoor Seating' },
  ];

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Plan Your Currituck Trip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Group Size</Label>
            <Select value={formData.groupSize} onValueChange={(v) => handleSelectChange('groupSize', v)}>
              <SelectTrigger data-testid="select-group-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Solo</SelectItem>
                <SelectItem value="2">Couple</SelectItem>
                <SelectItem value="3-4">Small Group</SelectItem>
                <SelectItem value="5+">Large Group</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trip Length</Label>
            <Select value={formData.tripLength} onValueChange={(v) => handleSelectChange('tripLength', v)}>
              <SelectTrigger data-testid="select-trip-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Weekend</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="5">5 Days</SelectItem>
                <SelectItem value="7">7+ Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Interests (select multiple)</Label>
            <div className="grid grid-cols-1 gap-3">
              {interests.map((interest) => (
                <div key={interest.value} className="flex items-center space-x-3">
                  <Checkbox 
                    id={`interest-${interest.value}`}
                    checked={formData.interests.includes(interest.value)}
                    onCheckedChange={(checked) => handleCheckboxChange('interests', interest.value, !!checked)}
                    data-testid={`checkbox-interest-${interest.value}`}
                  />
                  <Label htmlFor={`interest-${interest.value}`} className="font-normal cursor-pointer">
                    {interest.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Budget Level</Label>
            <Select value={formData.budget} onValueChange={(v) => handleSelectChange('budget', v)}>
              <SelectTrigger data-testid="select-budget">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Where Are You Staying?</Label>
            <Select value={formData.staying} onValueChange={(v) => handleSelectChange('staying', v)}>
              <SelectTrigger data-testid="select-staying">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Moyock">Moyock</SelectItem>
                <SelectItem value="Currituck">Currituck</SelectItem>
                <SelectItem value="Chesapeake">Chesapeake</SelectItem>
                <SelectItem value="Not Sure">Not Sure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Must-Haves (select multiple)</Label>
            <div className="grid grid-cols-1 gap-3">
              {mustHaves.map((item) => (
                <div key={item.value} className="flex items-center space-x-3">
                  <Checkbox 
                    id={`musthave-${item.value}`}
                    checked={formData.mustHaves.includes(item.value)}
                    onCheckedChange={(checked) => handleCheckboxChange('mustHaves', item.value, !!checked)}
                    data-testid={`checkbox-musthave-${item.value}`}
                  />
                  <Label htmlFor={`musthave-${item.value}`} className="font-normal cursor-pointer">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6"
            data-testid="button-generate-itinerary"
          >
            Generate Itinerary
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default IntakeForm;
