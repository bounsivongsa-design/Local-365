import { useState } from "react";
import { useBusinesses } from "@/hooks/use-businesses";
import { BusinessCard } from "@/components/BusinessCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Building2 } from "lucide-react";
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
import { CreateBusinessForm } from "@/components/CreateBusinessForm";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <div className="min-h-screen bg-muted/30">
      <div className="bg-white dark:bg-card border-b">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-bold tracking-tight">Local Directory</h1>
              <p className="text-muted-foreground">
                Find trusted local businesses and services in the Outer Banks.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search businesses..."
                  className="pl-10 h-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-businesses"
                />
              </div>
              
              {isAuthenticated && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-business">
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
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="flex gap-6">
          <aside className="hidden md:block w-64 flex-shrink-0">
            <Card className="sticky top-20 shadow-lg shadow-black/5 dark:shadow-black/20">
              <div className="p-4 border-b bg-primary/5 dark:bg-primary/10">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-sm uppercase tracking-wide">Categories</h2>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="p-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                      className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-all ${
                        category === cat 
                          ? "bg-primary text-primary-foreground font-medium shadow-md" 
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {cat}
                      {cat === "All" && businesses && (
                        <span className="ml-2 text-xs opacity-70">({businesses.length})</span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </aside>

          <div className="md:hidden mb-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 rounded-lg border bg-white dark:bg-card"
              data-testid="select-category-mobile"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <main className="flex-1 min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {category === "All" ? "All Categories" : category}
                {businesses && <span className="ml-1">({businesses.length} results)</span>}
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-[320px] rounded-xl bg-white dark:bg-card p-4 border space-y-4 shadow-lg shadow-black/5">
                    <Skeleton className="h-36 w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : businesses?.length === 0 ? (
              <div className="text-center py-20">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Search className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-bold mb-2">No businesses found</h3>
                <p className="text-muted-foreground">Try adjusting your search or category filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                {businesses?.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
