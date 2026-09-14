import { Link } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { BusinessCard } from "@/components/BusinessCard";
import { useFavorites } from "@/hooks/use-favorites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FavoritesSection() {
  const { data: favorites, isLoading, isError, refetch } = useFavorites();

  return (
    <Card
      className="lg:col-span-3 bg-white/95 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-2xl border-[#0a4a82]/10"
      data-testid="section-favorites"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1a1a2e]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#b8834f] flex items-center justify-center">
            <Heart className="h-4 w-4 text-white fill-white" />
          </div>
          Favorites
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12" data-testid="favorites-loading">
            <Loader2 className="h-8 w-8 animate-spin text-[#0a4a82]" />
            <span className="sr-only">Loading Favorites</span>
          </div>
        ) : isError ? (
          <div className="text-center py-8" data-testid="favorites-error">
            <p className="text-gray-500 mb-4">We couldn't load your Favorites right now.</p>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-favorites">
              Try Again
            </Button>
          </div>
        ) : !favorites?.length ? (
          <div className="text-center py-10" data-testid="favorites-empty">
            <Heart className="h-12 w-12 mx-auto mb-4 text-[#0a4a82]/20" />
            <h3 className="text-lg font-semibold text-[#1a1a2e] mb-1">No Favorites yet</h3>
            <p className="text-gray-500 mb-5">
              Save vendors you love from the directory to find them here.
            </p>
            <Link to="/directory">
              <Button className="bg-[#0a4a82] hover:bg-[#083a6a] text-white" data-testid="button-browse-directory">
                Browse Directory
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="favorites-grid">
            {favorites.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}