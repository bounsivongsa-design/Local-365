import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites, useToggleFavorite } from "@/hooks/use-favorites";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  businessId: number;
  className?: string;
}

export function FavoriteButton({ businessId, className }: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const favoritesQuery = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [optimisticFavorite, setOptimisticFavorite] = useState<boolean | null>(null);

  const isFavorite = !!favoritesQuery.data?.some((business) => business.id === businessId);
  const pressed = optimisticFavorite ?? isFavorite;

  useEffect(() => {
    if (!toggleFavorite.isPending) {
      setOptimisticFavorite(null);
    }
  }, [toggleFavorite.isPending, favoritesQuery.data]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // BusinessCard places this button over a navigable card. Preventing both
    // default and propagation keeps a favorite click from opening the card.
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      toast({
        title: "Sign in to save favorites",
        description: "Create an account or sign in to keep vendors in your Favorites.",
      });
      return;
    }

    setOptimisticFavorite(!pressed);
    toggleFavorite.mutate(
      { businessId, favorited: pressed },
      {
        onError: (error: Error) => {
          setOptimisticFavorite(null);
          toast({
            title: "Unable to update favorites",
            description: error.message || "Please try again.",
            variant: "destructive",
          });
        },
        onSuccess: (_, variables) => {
          toast({
            title: variables.favorited ? "Removed from Favorites" : "Saved to Favorites",
            description: variables.favorited
              ? "The vendor was removed from your saved vendors."
              : "You can find this vendor in your dashboard Favorites.",
          });
        },
      },
    );
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-10 w-10 rounded-full bg-white/95 text-[#0a4a82] shadow-md hover:bg-white hover:text-[#0a4a82]",
        className,
      )}
      onClick={handleClick}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={toggleFavorite.isPending}
      aria-label={pressed ? "Remove vendor from Favorites" : "Save vendor to Favorites"}
      aria-pressed={pressed}
      data-testid={`button-favorite-${businessId}`}
    >
      <Heart className={cn("h-5 w-5", pressed && "fill-[#d4a373] text-[#d4a373]")} />
      <span className="sr-only">{pressed ? "Saved to Favorites" : "Save to Favorites"}</span>
    </Button>
  );
}