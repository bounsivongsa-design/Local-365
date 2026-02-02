import { useBusiness, useCreateReview } from "@/hooks/use-businesses";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Star, MapPin, Globe, Clock, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function BusinessDetails() {
  const { id: paramId } = useParams<{ id: string }>();
  const id = paramId ? parseInt(paramId) : 0;
  const { data: business, isLoading } = useBusiness(id);
  const { isAuthenticated } = useAuth();
  
  if (isLoading) {
    return <BusinessDetailsSkeleton />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Business not found</h1>
        <Link to="/directory"><Button>Back to Directory</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header Image */}
      <div className="h-[300px] md:h-[400px] relative w-full bg-slate-900 overflow-hidden">
        {business.imageUrl && (
          <img 
            src={business.imageUrl} 
            alt={business.name} 
            className="w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
        
        <div className="container absolute bottom-0 left-0 right-0 pb-8">
           <Link to="/directory">
             <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 mb-6 -ml-4">
               <ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory
             </Button>
           </Link>
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
             <div>
               <Badge className="mb-3 bg-primary text-primary-foreground border-none px-3 py-1 text-sm">{business.category}</Badge>
               <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">{business.name}</h1>
             </div>
             <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border shadow-sm">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-lg">{Number(business.averageRating || 0).toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">({business.reviews?.length || 0} reviews)</span>
             </div>
           </div>
        </div>
      </div>

      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl p-6 md:p-8 border shadow-sm">
            <h2 className="font-display text-2xl font-bold mb-4">About</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {business.description}
            </p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
                 <MapPin className="h-5 w-5 text-primary mt-0.5" />
                 <div>
                   <h4 className="font-semibold mb-1">Location</h4>
                   <p className="text-muted-foreground">{business.address}</p>
                 </div>
               </div>
               <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
                 <Clock className="h-5 w-5 text-primary mt-0.5" />
                 <div>
                   <h4 className="font-semibold mb-1">Hours</h4>
                   <p className="text-muted-foreground">Open today: 9:00 AM - 6:00 PM</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Reviews</h2>
              {isAuthenticated ? (
                <ReviewDialog businessId={business.id} businessName={business.name} />
              ) : (
                <Link to="/api/login">
                   <Button variant="outline">Sign in to Review</Button>
                </Link>
              )}
            </div>

            {business.reviews?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {business.reviews?.map((review) => (
                  <div key={review.id} className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {review.user?.firstName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                           <p className="font-semibold">{review.user?.firstName || "Anonymous"}</p>
                           <p className="text-xs text-muted-foreground">
                             {review.createdAt && formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                           </p>
                        </div>
                      </div>
                      <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-current" : "text-gray-200 fill-gray-200"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-foreground/80">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Map & Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm sticky top-24">
             <div className="aspect-video w-full bg-muted rounded-xl mb-4 relative overflow-hidden group cursor-pointer">
               {/* Placeholder Map */}
               <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-122.4194,37.7749,12,0/600x400')] bg-cover bg-center opacity-70 group-hover:opacity-100 transition-opacity"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <Button variant="secondary" size="sm" className="shadow-lg pointer-events-none">
                    View on Map
                 </Button>
               </div>
             </div>
             <Button className="w-full mb-3" size="lg">Get Directions</Button>
             <Button variant="outline" className="w-full">
               <Globe className="h-4 w-4 mr-2" /> Visit Website
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewDialog({ businessId, businessName }: { businessId: number; businessName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const createReview = useCreateReview();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReview.mutate({ businessId, rating, comment }, {
      onSuccess: () => {
        setIsOpen(false);
        setComment("");
        setRating(5);
        toast({ title: "Review submitted", description: "Thanks for sharing your feedback!" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Write a Review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {businessName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star className={`h-8 w-8 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Your Experience</Label>
            <Textarea 
              placeholder="Tell us what you loved..." 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>
          <Button type="submit" disabled={createReview.isPending} className="w-full">
            {createReview.isPending ? "Submitting..." : "Post Review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BusinessDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      <Skeleton className="h-[400px] w-full" />
      <div className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
        <div>
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
