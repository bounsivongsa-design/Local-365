import { usePosts, useLikePost } from "@/hooks/use-posts";
import { useEvents } from "@/hooks/use-events";
import { useBusinesses } from "@/hooks/use-businesses";
import { CreatePostForm } from "@/components/CreatePostForm";
import { BusinessCard } from "@/components/BusinessCard";
import { EventCard } from "@/components/EventCard";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Share2, MapPin, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { data: posts, isLoading: postsLoading } = usePosts();
  const { data: businesses, isLoading: businessesLoading } = useBusinesses();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const likePost = useLikePost();
  const { isAuthenticated } = useAuth();

  // Featured content: take first 3 of each
  const featuredBusinesses = businesses?.slice(0, 3) || [];
  const upcomingEvents = events?.slice(0, 3) || [];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        
        <div className="container relative z-10 text-center max-w-3xl mx-auto px-4">
          <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Welcome to Local 365
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
            Discover the Heart of <br /> Your Community
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            Connect with local businesses, join exciting events, and share moments with your neighbors every day of the year.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
            <Link href="/directory">
              <Button size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold px-8 h-12 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                Explore Directory
              </Button>
            </Link>
            {!isAuthenticated && (
              <a href="/api/login">
                <Button size="lg" variant="outline" className="rounded-full border-white/40 text-white hover:bg-white/10 font-semibold px-8 h-12 backdrop-blur-sm">
                  Join Community
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="container py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-bold">Community Feed</h2>
            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">
              Latest Updates
            </Button>
          </div>

          <CreatePostForm />

          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : posts?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to share something with the community!</p>
            </div>
          ) : (
            posts?.map((post) => (
              <Card key={post.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Avatar>
                      <AvatarImage src={post.author.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {post.author.firstName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">
                            {post.author.firstName} {post.author.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                      
                      <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {post.imageUrl && (
                        <div className="mt-4 rounded-xl overflow-hidden">
                          <img src={post.imageUrl} alt="Post content" className="w-full h-auto max-h-[400px] object-cover" />
                        </div>
                      )}

                      <div className="flex items-center gap-6 mt-6 pt-4 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors px-2"
                          onClick={() => isAuthenticated && likePost.mutate(post.id)}
                          disabled={!isAuthenticated}
                        >
                          <Heart className={`h-4 w-4 mr-2 ${post.likes && post.likes > 0 ? "fill-red-500 text-red-500" : ""}`} />
                          {post.likes || 0} Likes
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-primary/5 px-2">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Comment
                        </Button>
                        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-primary hover:bg-primary/5 px-2">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Featured Businesses */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Local Gems</h2>
              <Link href="/directory" className="text-sm font-medium text-primary hover:underline flex items-center">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </div>
            
            {businessesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-4">
                {featuredBusinesses.map(biz => (
                  <Link key={biz.id} href={`/directory/${biz.id}`}>
                    <div className="flex gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-all cursor-pointer group">
                      <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                        {biz.imageUrl ? (
                          <img src={biz.imageUrl} alt={biz.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary/10">
                            <MapPin className="h-6 w-6 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{biz.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{biz.category}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex text-yellow-400">
                            <StarIcon filled />
                          </div>
                          <span className="text-xs font-medium">{Number(biz.averageRating).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold">Upcoming Events</h2>
              <Link href="/events" className="text-sm font-medium text-primary hover:underline flex items-center">
                View Calendar <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </div>

            {eventsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
