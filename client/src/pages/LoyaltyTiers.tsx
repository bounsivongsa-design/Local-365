import LoyaltyBadges from "@/components/LoyaltyBadges";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function LoyaltyTiers() {
  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm border-b">
        <div className="container py-12">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="font-display text-4xl font-bold tracking-tight">Loyalty Program</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Earn exclusive rewards and discounts with every visit to the Outer Banks. The more you explore, the more you save!
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="bg-white/80 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <LoyaltyBadges />
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-white/80 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">Book Your Stay</h3>
              <p className="text-muted-foreground text-sm">Reserve accommodations through our partner businesses in the Outer Banks.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">Earn Points</h3>
              <p className="text-muted-foreground text-sm">Every completed stay counts toward your loyalty tier progression.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">Unlock Rewards</h3>
              <p className="text-muted-foreground text-sm">Advance through tiers to unlock increasing discounts on future bookings.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
