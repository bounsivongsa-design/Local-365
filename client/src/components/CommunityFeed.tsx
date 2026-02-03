import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Calendar, Trophy, Heart, TrendingUp, MessageCircle, CheckCircle2, Award, Crown, Gem, Users } from "lucide-react";
import BestOfGrid from "./BestOfGrid";
import BestOfEditor from "./BestOfEditor";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

interface PostWithAuthor {
  id: number;
  content: string;
  imageUrl: string | null;
  likes: number;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    loyaltyTier: string | null;
    isValidated: boolean | null;
  } | null;
}

const tierConfig: Record<string, { label: string; color: string; icon: typeof Users; gradient: string }> = {
  member: { label: 'Member', color: 'bg-slate-500', icon: Users, gradient: 'from-slate-500 to-slate-600' },
  silver: { label: 'Silver', color: 'bg-gray-400', icon: Award, gradient: 'from-gray-300 to-gray-500' },
  gold: { label: 'Gold', color: 'bg-amber-500', icon: Star, gradient: 'from-amber-400 to-amber-600' },
  platinum: { label: 'Platinum', color: 'bg-cyan-500', icon: Crown, gradient: 'from-cyan-400 to-cyan-600' },
  ambassador: { label: 'Ambassador', color: 'bg-purple-500', icon: Gem, gradient: 'from-purple-400 to-purple-600' },
};

function CommunityFeed() {
  const [activeTab, setActiveTab] = useState<'feed' | 'bestof' | 'events'>('feed');
  const { isAuthenticated } = useAuth();

  const { data: posts, isLoading: postsLoading } = useQuery<PostWithAuthor[]>({
    queryKey: ["/api/posts"],
  });

  const upcomingEvents = [
    { title: "Community Farmers Market", date: "Feb 7, 2026", location: "Town Square, Manteo", description: "Fresh veggies, local crafts, and live music.", image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop" },
    { title: "Currituck Home & Garden Show", date: "Feb 15, 2026", location: "Currituck Community Center", description: "Meet local contractors and home service providers.", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop" },
    { title: "Wright Brothers Day", date: "Dec 17, 2026", location: "Wright Brothers Memorial", description: "Celebrate the anniversary of powered flight.", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop" },
  ];

  const getTierBadge = (tier: string | null) => {
    if (!tier || tier === 'member') return null;
    const config = tierConfig[tier] || tierConfig.member;
    const IconComponent = config.icon;
    return (
      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0 text-xs font-semibold shadow-sm`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="py-8">
      <div className="flex items-center gap-6 border-b mb-6 pb-2 bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm">
        <button 
          onClick={() => setActiveTab('feed')} 
          data-testid="tab-feed"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'feed' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <TrendingUp className="h-4 w-4" />
          Community Feed
        </button>
        <button 
          onClick={() => setActiveTab('bestof')} 
          data-testid="tab-bestof"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'bestof' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Trophy className="h-4 w-4" />
          Best of Currituck
        </button>
        <button 
          onClick={() => setActiveTab('events')} 
          data-testid="tab-events"
          className={`flex items-center gap-2 pb-2 border-b-2 transition ${activeTab === 'events' ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Calendar className="h-4 w-4" />
          Events
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold text-foreground bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 inline-block shadow-sm">What's Happening in Currituck</h2>
          
          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => {
                const authorName = post.author 
                  ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || 'Anonymous'
                  : 'Anonymous';
                const initials = post.author 
                  ? `${post.author.firstName?.[0] || ''}${post.author.lastName?.[0] || ''}`.toUpperCase()
                  : 'A';
                
                return (
                  <Card key={post.id} className="overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl transition-shadow duration-300">
                    {/* Post Header */}
                    <div className="p-5 pb-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-800 shadow-md">
                            <AvatarImage src={post.author?.profileImageUrl || undefined} alt={authorName} />
                            <AvatarFallback className="bg-gradient-to-br from-[#0a4a82] to-[#083a6a] text-white font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          {/* Verified checkmark */}
                          {post.author?.isValidated && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0a4a82] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">{authorName}</span>
                            {post.author?.isValidated && (
                              <span className="text-[#0a4a82] text-xs font-medium">Verified</span>
                            )}
                            {getTierBadge(post.author?.loyaltyTier || null)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Post Content */}
                      <p className="text-foreground mt-4 leading-relaxed">{post.content}</p>
                    </div>
                    
                    {/* Post Image */}
                    {post.imageUrl && (
                      <div className="relative">
                        <img 
                          src={post.imageUrl} 
                          alt="Post image" 
                          className="w-full h-64 object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Post Actions */}
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-6">
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-rose-500 transition-colors group" data-testid={`button-like-${post.id}`}>
                        <Heart className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">{post.likes}</span>
                      </button>
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-[#0a4a82] transition-colors group" data-testid={`button-comment-${post.id}`}>
                        <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Comment</span>
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground">Be the first to share something with the community!</p>
            </Card>
          )}
          
          <h3 className="text-xl font-bold mt-8 mb-4 text-foreground bg-white/80 dark:bg-card/80 backdrop-blur-sm rounded-lg px-4 py-2 inline-block shadow-sm">Local Gems</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400" alt="Green Leaf Market" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Currituck Pier</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Nags Head
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.8
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400" alt="The Daily Grind" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Duck Donuts</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.9
                </p>
              </div>
            </Card>
            <Card className="overflow-hidden shadow-lg shadow-black/5">
              <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" alt="Yoga Studio" className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold">Serenity Wellness</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Duck
                  <Star className="h-3 w-3 ml-2 text-yellow-500" /> 4.7
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'bestof' && (
        <div className="py-8 animate-in fade-in duration-300">
          <h2 className="text-3xl font-bold mb-6">Best of Currituck 2026</h2>
          <p className="mb-8 text-muted-foreground">Celebrating the top local businesses based on verified reviews & performance.</p>
          <BestOfGrid />
          
          {isAuthenticated && (
            <div className="mt-12 pt-8 border-t">
              <BestOfEditor />
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.map((event, index) => (
              <Card key={index} className="overflow-hidden shadow-lg shadow-black/5">
                <img src={event.image} alt={event.title} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
                    <Calendar className="h-4 w-4" />
                    {event.date}
                  </div>
                  <h4 className="font-bold text-lg">{event.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {event.location}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityFeed;
