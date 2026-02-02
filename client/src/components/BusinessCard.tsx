import { Link } from "wouter";
import { Star, MapPin } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type BusinessWithRating } from "@shared/schema";

interface BusinessCardProps {
  business: BusinessWithRating;
}

export function BusinessCard({ business }: BusinessCardProps) {
  // Use a default gradient if image fails or is placeholder
  const hasValidImage = business.imageUrl && business.imageUrl.length > 0;

  return (
    <Link href={`/directory/${business.id}`}>
      <Card className="group h-full overflow-hidden border-border/50 bg-card hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer rounded-2xl">
        <div className="relative aspect-[4/3] overflow-hidden">
          {hasValidImage ? (
             <img 
               src={business.imageUrl} 
               alt={business.name}
               className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
             />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Store className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-3 left-3">
             <Badge variant="secondary" className="backdrop-blur-md bg-white/90 text-foreground font-semibold shadow-sm">
                {business.category}
             </Badge>
          </div>
        </div>
        
        <CardHeader className="p-5 pb-2">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-display text-xl font-bold leading-tight group-hover:text-primary transition-colors">
              {business.name}
            </h3>
            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-700">
                {business.averageRating ? Number(business.averageRating).toFixed(1) : "New"}
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-5 pt-2">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {business.description}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{business.address}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Icon for placeholder
import { Store } from "lucide-react";
