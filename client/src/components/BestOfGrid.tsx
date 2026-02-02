import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, Medal, Award, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BestOfItem {
  category: string;
  winner: string;
  runnerUp: string;
  honorable: string;
  rating: string;
}

const defaultBestOfData: BestOfItem[] = [
  { category: 'Home Repair', winner: 'Smith Home Repair', runnerUp: 'OBX Handyman Services', honorable: 'Beach House Fixers', rating: '4.9' },
  { category: 'Plumbing', winner: 'Coastal Plumbing Co', runnerUp: 'Currituck Plumbing Pros', honorable: 'Island Pipe Works', rating: '4.8' },
  { category: 'HVAC', winner: 'OBX HVAC Pros', runnerUp: 'Coastal Comfort Air', honorable: 'Beach Breeze HVAC', rating: '4.9' },
  { category: 'Electrical', winner: 'Shore Electric', runnerUp: 'Lighthouse Electrical', honorable: 'OBX Power Solutions', rating: '4.7' },
  { category: 'Roofing', winner: 'Barrier Island Roofing', runnerUp: 'Coastal Storm Roofing', honorable: 'OBX Top Roofers', rating: '4.8' },
  { category: 'Landscaping', winner: 'Sandy Shores Landscaping', runnerUp: 'Dune Gardens', honorable: 'Coastal Green Thumb', rating: '4.9' },
];

function BestOfGrid() {
  const [bestOfData, setBestOfData] = useState<BestOfItem[]>(defaultBestOfData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBestOf() {
      try {
        const response = await fetch('/api/bestof');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setBestOfData(data);
          }
        }
      } catch (err) {
        setError('Failed to load Best of OBX data — try refreshing.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchBestOf();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-6 shadow-3d">
            <Skeleton className="h-6 w-3/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestOfData.map((item, i) => (
          <Card 
            key={i} 
            className="p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.18),0_8px_16px_rgba(0,0,0,0.1)] hover:translate-y-[-4px] transition-all duration-300 rounded-2xl border border-white/50"
          >
            <h3 className="text-lg font-bold mb-5 text-primary flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-primary" />
              </span>
              Best {item.category}
            </h3>
            <div className="space-y-4">
              {/* Winner - Gold */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full trophy-gold flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-yellow-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Winner</p>
                  <p className="font-bold text-foreground">{item.winner}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-sm font-semibold text-amber-600">{item.rating}</span>
                    <span className="text-amber-500">★</span>
                  </div>
                </div>
              </div>
              
              {/* Runner-up - Silver */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full trophy-silver flex items-center justify-center">
                  <Medal className="h-5 w-5 text-gray-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Runner-Up</p>
                  <p className="text-sm font-medium">{item.runnerUp}</p>
                </div>
              </div>
              
              {/* Honorable Mention - Bronze */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full trophy-bronze flex items-center justify-center">
                  <Award className="h-5 w-5 text-orange-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Honorable Mention</p>
                  <p className="text-sm font-medium">{item.honorable}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export default BestOfGrid;
