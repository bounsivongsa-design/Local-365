import { useState } from "react";
import { useBusinesses } from "@/hooks/use-businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateBusinessForm } from "@/components/CreateBusinessForm"; // We'll need this component

export default function Directory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const { data: businesses, isLoading } = useBusinesses({ 
    search: searchTerm, 
    category: category === "All" ? undefined : category 
  });
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const categories = [
    "All",
    "Home Repair",
    "Plumbing",
    "HVAC",
    "Electrical",
    "Roofing",
    "Landscaping",
    "Cleaning",
    "Painting",
    "Tree Care",
    "Remodeling & Addition",
    "New Construction",
    "Baby Sitting & Nanny",
    "Printing",
    "Web Design & Logo Design",
    "Photo & Video",
    "Auto Repair",
    "Small Engine Repair",
    "Trash & Junk Removal",
    "Tutor & Mentor Counseling",
    "Mind Body Soul",
    "Tax CPA",
    "Legal",
    "Woodworking & Lazer CNC",
    "Baking & Cooking",
    "Catering Food Trucks",
    "Event Planning & Rentals",
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-white border-b">
        <div className="container py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="font-display text-4xl font-bold tracking-tight">Local Directory</h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Explore the best local businesses, shops, and services in your community.
              </p>
            </div>
            
            {isAuthenticated && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full bg-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Business
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add a New Business</DialogTitle>
                    <DialogDescription>
                      Share a local gem with the community. Please provide accurate details.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateBusinessForm onSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search businesses..."
                className="pl-10 h-12 rounded-xl bg-muted/30 border-transparent focus:bg-white focus:border-primary/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-6 ${
                    category === cat 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-[350px] rounded-2xl bg-white p-4 border space-y-4">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : businesses?.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">No businesses found</h3>
            <p className="text-muted-foreground">Try adjusting your search or category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
            {businesses?.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
