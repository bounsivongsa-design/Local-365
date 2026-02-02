import { Link } from "react-router-dom";
import { Star, MapPin } from "lucide-react";
import { type BusinessWithRating } from "@shared/schema";

interface BusinessCardProps {
  business: BusinessWithRating;
}

export function BusinessCard({ business }: BusinessCardProps) {
  return (
    <Link to={`/directory/${business.id}`}>
      <div 
        className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition border border-sand/20 cursor-pointer group"
        data-testid={`card-business-${business.id}`}
      >
        {business.imageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden aspect-video">
            <img 
              src={business.imageUrl} 
              alt={business.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <h3 className="text-xl font-semibold text-primary group-hover:text-primary-dark transition-colors">
          {business.name}
        </h3>
        <div className="flex items-center gap-2 text-dune mt-1">
          <span className="flex items-center">
            {business.averageRating ? Number(business.averageRating).toFixed(1) : "New"} 
            <Star className="h-4 w-4 fill-current ml-0.5" />
          </span>
          <span className="text-muted-foreground">•</span>
          <span>{business.address.split(',')[0] || 'Currituck County'}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {business.description}
        </p>
      </div>
    </Link>
  );
}
